#!/usr/bin/env sh
set -eu

REPO="weigefenxiang/WeiG-qB-WebUI"
DEFAULT_DEST="${HOME}/.local/share/weigg-qb-webui"
DEST="${WEIGG_QB_WEBUI_DIR:-$DEFAULT_DEST}"
REQUESTED_DEST="$DEST"
QBT_ROOT_FOLDER="$DEST"
DEST_EXPLICIT=0
MODE="install"
CONFIGURE=0
DOCKER_CONTAINER=""
DOCKER_CONFIG_ROOT=""
CONTAINER_REQUESTED=""
CONFIG_ROOT_REQUESTED=""
SOURCE_SHA=""

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Options:
  --update                  Update the selected installation.
  --rollback                Roll back the last installation.
  --configure               Update the detected qBittorrent config.
  --dir=/path               WebUI path. For Docker, /config/... means container path.
  --container=name_or_id    Select one qBittorrent Docker container explicitly.
  --config-root=/host/path  Host path mounted as qBittorrent container /config.
  --list-containers         List detected qBittorrent Docker containers and exit.
  -h, --help                Show this help.
EOF
}

LIST_CONTAINERS=0
for arg in "$@"; do
  case "$arg" in
    --update) MODE="update" ;;
    --rollback) MODE="rollback" ;;
    --configure) CONFIGURE=1 ;;
    --dir=*) DEST=${arg#--dir=}; REQUESTED_DEST="$DEST"; QBT_ROOT_FOLDER="$DEST"; DEST_EXPLICIT=1 ;;
    --container=*) CONTAINER_REQUESTED=${arg#--container=} ;;
    --config-root=*) CONFIG_ROOT_REQUESTED=${arg#--config-root=} ;;
    --list-containers) LIST_CONTAINERS=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

STATE="${HOME}/.config/weigg-qb-webui"
BACKUPS="$STATE/backups"
mkdir -p "$BACKUPS"

if [ "$MODE" = "rollback" ] && [ "$DEST_EXPLICIT" -eq 0 ] && [ -s "$STATE/last-dest" ]; then
  DEST=$(cat "$STATE/last-dest")
fi

is_safe_config_path() {
  case "$1" in
    /var/lib/docker/*|*/overlayfs/*|*/overlay2/*|*/rootfs/*|*/snap/*) return 1 ;;
    *) return 0 ;;
  esac
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

valid_sha() {
  printf '%s' "$1" | grep -Eq '^[0-9a-fA-F]{40}$'
}

resolve_main_sha() {
  api="https://api.github.com/repos/$REPO/commits/main"
  if command -v curl >/dev/null 2>&1; then
    body=$(curl -fsSL -H 'Accept: application/vnd.github+json' "$api" 2>/dev/null || true)
  else
    body=$(wget -qO- "$api" 2>/dev/null || true)
  fi
  printf '%s\n' "$body" | sed -n 's/^[[:space:]]*"sha":[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' | head -n1
}

inject_build_sha() {
  valid_sha "$SOURCE_SHA" || { echo "Unable to resolve a valid 40-character Git SHA for this payload." >&2; exit 1; }
  find "$DEST.new" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name 'GIT_SHA' \) -exec sed -i "s/__WEIGG_GIT_SHA__/$SOURCE_SHA/g" {} +
  printf '%s\n' "$SOURCE_SHA" > "$DEST.new/GIT_SHA"
}

write_install_metadata() {
  [ -d "$DEST.new/private" ] || mkdir -p "$DEST.new/private"
  meta_version=$(cat "$DEST.new/VERSION" 2>/dev/null || printf 'unknown')
  meta_version=$(json_escape "$meta_version")
  meta_git_sha=$(json_escape "$SOURCE_SHA")
  meta_container=$(json_escape "$DOCKER_CONTAINER")
  meta_qb_path=$(json_escape "$QBT_ROOT_FOLDER")
  meta_host_path=$(json_escape "$DEST")
  meta_installed_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  cat > "$DEST.new/private/weigg-install.json" <<EOF
{
  "version": "$meta_version",
  "gitSha": "$meta_git_sha",
  "container": "$meta_container",
  "qbPath": "$meta_qb_path",
  "hostPath": "$meta_host_path",
  "installedAt": "$meta_installed_at",
  "installer": "linux"
}
EOF
}

qb_container_lines() {
  command -v docker >/dev/null 2>&1 || return 0
  docker ps --format '{{.ID}}|{{.Image}}|{{.Names}}' 2>/dev/null | grep -Ei 'qbittorrent|qbit' || true
}

container_config_source() {
  docker inspect -f '{{range .Mounts}}{{if eq .Destination "/config"}}{{.Source}}{{end}}{{end}}' "$1" 2>/dev/null || true
}

print_qb_containers() {
  lines=$(qb_container_lines)
  if [ -z "$lines" ]; then
    echo "No running qBittorrent Docker containers detected."
    return 0
  fi
  echo "Detected qBittorrent Docker containers:"
  printf '%s\n' "$lines" | while IFS='|' read -r id image name; do
    source=$(container_config_source "$id")
    [ -n "$source" ] || source="(no /config mount detected)"
    echo "  $name | $image | id=$id | /config -> $source"
  done
}

select_qb_docker() {
  command -v docker >/dev/null 2>&1 || return 1

  if [ -n "$CONFIG_ROOT_REQUESTED" ]; then
    [ -d "$CONFIG_ROOT_REQUESTED" ] || { echo "Config root does not exist: $CONFIG_ROOT_REQUESTED" >&2; exit 2; }
    DOCKER_CONFIG_ROOT=${CONFIG_ROOT_REQUESTED%/}
    echo "Using explicit qBittorrent config root: $DOCKER_CONFIG_ROOT"

    lines=$(qb_container_lines)
    if [ -n "$lines" ]; then
      match=$(printf '%s\n' "$lines" | while IFS='|' read -r id image name; do
        source=$(container_config_source "$id")
        if [ "$source" = "$DOCKER_CONFIG_ROOT" ]; then
          printf '%s|%s\n' "$name" "$image"
        fi
      done | head -n1)
      if [ -n "$match" ]; then
        DOCKER_CONTAINER=${match%%|*}
        image=${match#*|}
        echo "Matched Docker container: $DOCKER_CONTAINER ($image)"
      fi
    fi
    return 0
  fi

  lines=$(qb_container_lines)
  [ -n "$lines" ] || return 1

  if [ -n "$CONTAINER_REQUESTED" ]; then
    line=$(printf '%s\n' "$lines" | awk -F'|' -v want="$CONTAINER_REQUESTED" '$1==want || $3==want {print; exit}')
    [ -n "$line" ] || {
      echo "Requested qBittorrent container not found: $CONTAINER_REQUESTED" >&2
      print_qb_containers >&2
      exit 2
    }
  else
    count=$(printf '%s\n' "$lines" | grep -c . || true)
    if [ "$count" -gt 1 ]; then
      echo "Multiple qBittorrent Docker containers found; refusing to guess." >&2
      print_qb_containers >&2
      echo "Re-run with --container=<name> or --config-root=<host /config path>." >&2
      exit 3
    fi
    line=$(printf '%s\n' "$lines" | head -n1)
  fi

  id=${line%%|*}
  rest=${line#*|}
  image=${rest%%|*}
  name=${rest#*|}
  source=$(container_config_source "$id")
  [ -n "$source" ] && [ -d "$source" ] || {
    echo "Container $name does not expose a usable /config mount." >&2
    exit 2
  }

  DOCKER_CONTAINER="$name"
  DOCKER_CONFIG_ROOT="$source"
  echo "Selected qBittorrent Docker container: $name ($image)"
  echo "Container /config -> Host $source"
  return 0
}

map_docker_destination() {
  [ -n "$DOCKER_CONFIG_ROOT" ] || return 0

  if [ "$DEST_EXPLICIT" -eq 0 ]; then
    DEST="$DOCKER_CONFIG_ROOT/weigg-qb-webui"
    QBT_ROOT_FOLDER="/config/weigg-qb-webui"
    return 0
  fi

  case "$REQUESTED_DEST" in
    /config)
      DEST="$DOCKER_CONFIG_ROOT"
      QBT_ROOT_FOLDER="/config"
      ;;
    /config/*)
      rel=${REQUESTED_DEST#/config/}
      DEST="$DOCKER_CONFIG_ROOT/$rel"
      QBT_ROOT_FOLDER="/config/$rel"
      ;;
    "$DOCKER_CONFIG_ROOT")
      DEST="$REQUESTED_DEST"
      QBT_ROOT_FOLDER="/config"
      ;;
    "$DOCKER_CONFIG_ROOT"/*)
      rel=${REQUESTED_DEST#"$DOCKER_CONFIG_ROOT"/}
      DEST="$REQUESTED_DEST"
      QBT_ROOT_FOLDER="/config/$rel"
      ;;
    *)
      DEST="$REQUESTED_DEST"
      QBT_ROOT_FOLDER="$REQUESTED_DEST"
      echo "Warning: requested path is outside the selected Docker /config mount." >&2
      echo "qBittorrent may not be able to see: $REQUESTED_DEST" >&2
      ;;
  esac
}

if [ "$LIST_CONTAINERS" -eq 1 ]; then
  print_qb_containers
  exit 0
fi

if [ "$MODE" != "rollback" ]; then
  select_qb_docker || true
  map_docker_destination
fi

find_config() {
  if [ -n "$DOCKER_CONFIG_ROOT" ]; then
    for f in \
      "$DOCKER_CONFIG_ROOT/qBittorrent/qBittorrent.conf" \
      "$DOCKER_CONFIG_ROOT/qBittorrent/qBittorrent.ini" \
      "$DOCKER_CONFIG_ROOT/qbittorrent/qBittorrent.conf" \
      "$DOCKER_CONFIG_ROOT/qBittorrent.conf"; do
      if [ -f "$f" ] && is_safe_config_path "$f"; then
        printf '%s\n' "$f"
        return 0
      fi
    done
  fi

  for f in \
    "${XDG_CONFIG_HOME:-$HOME/.config}/qBittorrent/qBittorrent.conf" \
    "$HOME/.config/qBittorrent/qBittorrent.conf" \
    "$HOME/.config/qBittorrent/qBittorrent.ini" \
    "/config/qBittorrent/qBittorrent.conf" \
    "/config/qBittorrent/qBittorrent.ini" \
    "/config/qbittorrent/qBittorrent.conf" \
    "/config/qbittorrent/qBittorrent.ini" \
    "/etc/qBittorrent/qBittorrent.conf" \
    "/var/lib/qbittorrent/.config/qBittorrent/qBittorrent.conf"; do
    if [ -f "$f" ] && is_safe_config_path "$f"; then
      printf '%s\n' "$f"
      return 0
    fi
  done

  for root in /config /home /var/lib; do
    [ -d "$root" ] || continue
    if [ "$root" = "/var/lib" ]; then
      found=$(find "$root" \
        \( -path '/var/lib/docker' -o -path '/var/lib/docker/*' \) -prune -o \
        -maxdepth 6 -type f \( -name qBittorrent.conf -o -name qBittorrent.ini \) -print 2>/dev/null | head -n1 || true)
    else
      found=$(find "$root" -maxdepth 6 -type f \( -name qBittorrent.conf -o -name qBittorrent.ini \) 2>/dev/null | head -n1 || true)
    fi
    if [ -n "$found" ] && is_safe_config_path "$found"; then
      printf '%s\n' "$found"
      return 0
    fi
  done
  return 1
}

backup_now() {
  stamp=$(date '+%Y%m%d-%H%M%S')
  b="$BACKUPS/$stamp"
  mkdir -p "$b"

  if [ -d "$DEST" ]; then
    cp -a "$DEST" "$b/webui"
    printf '1\n' > "$b/had-webui"
  else
    printf '0\n' > "$b/had-webui"
  fi

  cfg=$(find_config || true)
  if [ -n "$cfg" ]; then
    cp -a "$cfg" "$b/qBittorrent.conf"
    printf '%s\n' "$cfg" > "$b/config-path"
  fi

  printf '%s\n' "$DEST" > "$b/dest-path"
  printf '%s\n' "$QBT_ROOT_FOLDER" > "$b/qb-root-folder"
  printf '%s\n' "$b" > "$STATE/last-backup"
  printf '%s\n' "$DEST" > "$STATE/last-dest"
  printf '%s\n' "$QBT_ROOT_FOLDER" > "$STATE/last-qb-root-folder"
  echo "Backup: $b"
}

rollback() {
  [ -f "$STATE/last-backup" ] || { echo "No backup found." >&2; exit 1; }
  b=$(cat "$STATE/last-backup")
  [ -d "$b" ] || { echo "Backup directory missing: $b" >&2; exit 1; }

  if [ -s "$b/dest-path" ] && [ "$DEST_EXPLICIT" -eq 0 ]; then
    DEST=$(cat "$b/dest-path")
  fi

  had_webui=0
  [ -s "$b/had-webui" ] && had_webui=$(cat "$b/had-webui")

  rm -rf "$DEST"
  if [ "$had_webui" = "1" ]; then
    [ -d "$b/webui" ] || { echo "Backup WebUI missing: $b/webui" >&2; exit 1; }
    mkdir -p "$(dirname "$DEST")"
    cp -a "$b/webui" "$DEST"
    echo "Restored previous WebUI: $DEST"
  else
    echo "Removed WeiG qB WebUI from: $DEST"
  fi

  if [ -s "$b/config-path" ] && [ -f "$b/qBittorrent.conf" ]; then
    cfg=$(cat "$b/config-path")
    if is_safe_config_path "$cfg"; then
      mkdir -p "$(dirname "$cfg")"
      cp -a "$b/qBittorrent.conf" "$cfg"
      echo "Restored qBittorrent config: $cfg"
    fi
  fi
  exit 0
}

[ "$MODE" = "rollback" ] && rollback

command -v unzip >/dev/null 2>&1 || { echo "unzip is required." >&2; exit 1; }
if ! command -v curl >/dev/null 2>&1 && ! command -v wget >/dev/null 2>&1; then
  echo "curl or wget is required." >&2
  exit 1
fi

if [ "$DEST" != "$REQUESTED_DEST" ]; then
  echo "Host install path: $DEST"
  echo "qBittorrent Root Folder: $QBT_ROOT_FOLDER"
fi

backup_now
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM
PACKAGE="$TMP/WeiG-qB-WebUI.zip"
RELEASE_URL="https://github.com/$REPO/releases/latest/download/WeiG-qB-WebUI.zip"
SUM_URL="https://github.com/$REPO/releases/latest/download/SHA256SUMS"
release_ok=0

if command -v curl >/dev/null 2>&1; then
  if curl -fsSL "$RELEASE_URL" -o "$PACKAGE" 2>/dev/null; then release_ok=1; fi
else
  if wget -q "$RELEASE_URL" -O "$PACKAGE" 2>/dev/null; then release_ok=1; fi
fi

if [ "$release_ok" -eq 1 ]; then
  echo "Source: latest GitHub Release"
  if command -v sha256sum >/dev/null 2>&1; then
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "$SUM_URL" -o "$TMP/SHA256SUMS" 2>/dev/null || true
    else
      wget -q "$SUM_URL" -O "$TMP/SHA256SUMS" 2>/dev/null || true
    fi
    if [ -s "$TMP/SHA256SUMS" ]; then
      (cd "$TMP" && sha256sum -c SHA256SUMS)
    fi
  fi
  unzip -q "$PACKAGE" -d "$TMP/release"
  SRC="$TMP/release/WeiG-qB-WebUI"
  SOURCE_SHA=$(cat "$SRC/GIT_SHA" 2>/dev/null | tr -d '\r\n' || true)
  valid_sha "$SOURCE_SHA" || { echo "Latest Release does not contain a valid GIT_SHA; refusing an unversioned asset deployment." >&2; exit 1; }
else
  echo "No published Release found; using the current main branch."
  SOURCE_SHA=$(resolve_main_sha)
  valid_sha "$SOURCE_SHA" || { echo "Could not resolve the current main Git SHA." >&2; exit 1; }
  ARCHIVE="$TMP/source.zip"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.zip" -o "$ARCHIVE"
  else
    wget -q "https://github.com/$REPO/archive/refs/heads/main.zip" -O "$ARCHIVE"
  fi
  unzip -q "$ARCHIVE" -d "$TMP/source"
  SRC=$(find "$TMP/source" -maxdepth 3 -type d -name webui | head -n1)
fi

[ -n "$SRC" ] && [ -d "$SRC" ] || { echo "WebUI payload not found." >&2; exit 1; }
[ -f "$SRC/public/index.html" ] && [ -f "$SRC/public/login.html" ] && [ -f "$SRC/private/index.html" ] || { echo "Source package is not a valid qBittorrent Alternate WebUI." >&2; exit 1; }

rm -rf "$DEST.new"
mkdir -p "$DEST.new"
cp -a "$SRC"/. "$DEST.new"/
inject_build_sha
write_install_metadata
[ -f "$DEST.new/public/index.html" ] && [ -f "$DEST.new/public/login.html" ] && [ -f "$DEST.new/private/index.html" ] && [ -f "$DEST.new/VERSION" ] && [ -f "$DEST.new/GIT_SHA" ] && [ -f "$DEST.new/private/weigg-install.json" ] || { echo "Installed payload validation failed." >&2; rm -rf "$DEST.new"; exit 1; }
valid_sha "$(cat "$DEST.new/GIT_SHA" | tr -d '\r\n')" || { echo "Installed Git SHA validation failed." >&2; rm -rf "$DEST.new"; exit 1; }

rm -rf "$DEST.old"
[ -d "$DEST" ] && mv "$DEST" "$DEST.old" || true
if ! mv "$DEST.new" "$DEST"; then
  [ -d "$DEST.old" ] && mv "$DEST.old" "$DEST" || true
  echo "Installation failed; previous WebUI restored." >&2
  exit 1
fi
rm -rf "$DEST.old"
echo "Installed and verified: $DEST"
echo "Installed version: $(cat "$DEST/VERSION")"
echo "Installed Git SHA: $(cat "$DEST/GIT_SHA")"
echo "Install metadata: $DEST/private/weigg-install.json"

cfg=$(find_config || true)
if [ "$CONFIGURE" -eq 1 ]; then
  [ -n "$cfg" ] || { echo "No safe qBittorrent config was found; WebUI files are installed but configuration was not changed." >&2; exit 2; }
  cp -a "$cfg" "$cfg.weigg.bak"
  if grep -q '^WebUI\\AlternativeUIEnabled=' "$cfg"; then
    sed -i 's#^WebUI\\AlternativeUIEnabled=.*#WebUI\\AlternativeUIEnabled=true#' "$cfg"
  else
    printf '\nWebUI\\AlternativeUIEnabled=true\n' >> "$cfg"
  fi
  esc=$(printf '%s' "$QBT_ROOT_FOLDER" | sed 's/[&|]/\\&/g')
  if grep -q '^WebUI\\RootFolder=' "$cfg"; then
    sed -i "s|^WebUI\\RootFolder=.*|WebUI\\RootFolder=$esc|" "$cfg"
  else
    printf 'WebUI\\RootFolder=%s\n' "$QBT_ROOT_FOLDER" >> "$cfg"
  fi
  echo "Configured: $cfg"
  echo "qBittorrent Root Folder: $QBT_ROOT_FOLDER"
else
  echo "qBittorrent -> Tools -> Preferences -> Web UI -> Use alternative WebUI"
  echo "WebUI Root Folder: $QBT_ROOT_FOLDER"
  if [ -n "$cfg" ]; then
    echo "Detected safe config: $cfg"
  else
    echo "No safe host qBittorrent config auto-detected; set the Root Folder manually."
  fi
fi

echo "Rollback (last destination is remembered automatically):"
echo "  curl -fsSL https://raw.githubusercontent.com/$REPO/main/installers/install.sh -o /tmp/weigg-qb-install.sh"
echo "  sh /tmp/weigg-qb-install.sh --rollback"

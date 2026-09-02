#!/usr/bin/env sh
set -eu

REPO="weigefenxiang/WeiG-qB-WebUI"
DEFAULT_DEST="${HOME}/.local/share/weigg-qb-webui"
DEST="${WEIGG_QB_WEBUI_DIR:-$DEFAULT_DEST}"
REQUESTED_DEST="$DEST"
QBT_ROOT_FOLDER="$DEST"
DEST_EXPLICIT=0
MODE="install"
CHANNEL="${WEIGG_QB_CHANNEL:-release}"
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
  --channel=release|dev     Install latest Release (default) or current dev exact SHA.
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
    --channel=release) CHANNEL="release" ;;
    --channel=dev) CHANNEL="dev" ;;
    --channel=*) echo "Unsupported channel: ${arg#--channel=}. Use release or dev." >&2; exit 2 ;;
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
case "$CHANNEL" in release|dev) ;; *) echo "Unsupported channel: $CHANNEL. Use release or dev." >&2; exit 2 ;; esac

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

has_busybox_applet() {
  command -v busybox >/dev/null 2>&1 || return 1
  busybox --list 2>/dev/null | grep -qx "$1"
}

download_file() {
  url=$1
  out=$2
  if command -v curl >/dev/null 2>&1; then
    curl -fL --retry 2 --connect-timeout 15 "$url" -o "$out"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$out"
    return
  fi
  if has_busybox_applet wget; then
    busybox wget -O "$out" "$url" >/dev/null
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$url" "$out" <<'PY'
import shutil, sys, urllib.request
req=urllib.request.Request(sys.argv[1], headers={'User-Agent':'WeiG-qB-WebUI-installer'})
with urllib.request.urlopen(req, timeout=60) as src, open(sys.argv[2], 'wb') as dst:
    shutil.copyfileobj(src, dst)
PY
    return
  fi
  echo "No supported downloader found. Install curl/wget, use BusyBox/Python, or download the package in a browser." >&2
  return 127
}

extract_zip() {
  archive=$1
  target=$2
  mkdir -p "$target"
  if command -v unzip >/dev/null 2>&1; then
    unzip -q "$archive" -d "$target"
    return
  fi
  if has_busybox_applet unzip; then
    busybox unzip "$archive" -d "$target" >/dev/null
    return
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -m zipfile -e "$archive" "$target"
    return
  fi
  if command -v bsdtar >/dev/null 2>&1; then
    bsdtar -xf "$archive" -C "$target"
    return
  fi
  echo "No supported ZIP extractor found. Install unzip, use BusyBox/Python/bsdtar, or extract the package manually." >&2
  return 127
}

sha256_file() {
  file=$1
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$file" | awk '{print $1}'; return; fi
  if has_busybox_applet sha256sum; then busybox sha256sum "$file" | awk '{print $1}'; return; fi
  if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$file" | awk '{print $1}'; return; fi
  if command -v openssl >/dev/null 2>&1; then openssl dgst -sha256 "$file" | awk '{print $NF}'; return; fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$file" <<'PY'
import hashlib, sys
h=hashlib.sha256()
with open(sys.argv[1], 'rb') as f:
    for chunk in iter(lambda: f.read(1024*1024), b''):
        h.update(chunk)
print(h.hexdigest())
PY
    return
  fi
  echo "No SHA256 implementation found; refusing an unverified Release installation." >&2
  return 127
}

verify_release_checksum() {
  sums=$1
  package=$2
  expected=$(awk '$2=="WeiG-qB-WebUI.zip" || $2=="*WeiG-qB-WebUI.zip" {print $1; exit}' "$sums")
  printf '%s' "$expected" | grep -Eq '^[0-9a-fA-F]{64}$' || { echo "SHA256SUMS does not contain a valid WeiG-qB-WebUI.zip checksum." >&2; return 1; }
  actual=$(sha256_file "$package") || return 1
  expected=$(printf '%s' "$expected" | tr 'A-F' 'a-f')
  actual=$(printf '%s' "$actual" | tr 'A-F' 'a-f')
  [ "$expected" = "$actual" ] || { echo "SHA256 verification failed." >&2; return 1; }
  echo "SHA256 verified: $actual"
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
  meta_channel=$(json_escape "$CHANNEL")
  meta_container=$(json_escape "$DOCKER_CONTAINER")
  meta_qb_path=$(json_escape "$QBT_ROOT_FOLDER")
  meta_host_path=$(json_escape "$DEST")
  meta_installed_at=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  cat > "$DEST.new/private/weigg-install.json" <<EOF
{
  "version": "$meta_version",
  "gitSha": "$meta_git_sha",
  "channel": "$meta_channel",
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

if [ "$DEST" != "$REQUESTED_DEST" ]; then
  echo "Host install path: $DEST"
  echo "qBittorrent Root Folder: $QBT_ROOT_FOLDER"
fi

backup_now
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM
PACKAGE="$TMP/WeiG-qB-WebUI.zip"

if [ "$CHANNEL" = "release" ]; then
  RELEASE_URL="https://github.com/$REPO/releases/latest/download/WeiG-qB-WebUI.zip"
  SUM_URL="https://github.com/$REPO/releases/latest/download/SHA256SUMS"
  download_file "$RELEASE_URL" "$PACKAGE" || {
    echo "No published stable GitHub Release is available. Release installation will not fall back to a branch archive." >&2
    exit 1
  }
  download_file "$SUM_URL" "$TMP/SHA256SUMS" || {
    echo "The latest Release is missing SHA256SUMS; refusing an unverified installation." >&2
    exit 1
  }
  [ -s "$TMP/SHA256SUMS" ] || { echo "SHA256SUMS is empty; refusing installation." >&2; exit 1; }
  verify_release_checksum "$TMP/SHA256SUMS" "$PACKAGE"
  extract_zip "$PACKAGE" "$TMP/release"
  SRC="$TMP/release/WeiG-qB-WebUI"
  SOURCE_SHA=$(cat "$SRC/GIT_SHA" 2>/dev/null | tr -d '\r\n' || true)
  valid_sha "$SOURCE_SHA" || { echo "Latest Release does not contain a valid GIT_SHA; refusing an unversioned asset deployment." >&2; exit 1; }
  echo "Source: latest GitHub Release (checksum verified)"
else
  DEV_META="$TMP/dev-commit.json"
  download_file "https://api.github.com/repos/$REPO/commits/dev" "$DEV_META" || { echo "Unable to resolve the current dev commit." >&2; exit 1; }
  SOURCE_SHA=$(sed -n 's/^[[:space:]]*"sha":[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' "$DEV_META" | head -n1)
  valid_sha "$SOURCE_SHA" || { echo "GitHub did not return a valid dev commit SHA." >&2; exit 1; }
  DEV_URL="https://github.com/$REPO/archive/$SOURCE_SHA.zip"
  download_file "$DEV_URL" "$PACKAGE" || { echo "Unable to download dev exact SHA $SOURCE_SHA." >&2; exit 1; }
  extract_zip "$PACKAGE" "$TMP/dev"
  entry=$(find "$TMP/dev" -type f -path '*/webui/public/index.html' -print 2>/dev/null | head -n1 || true)
  [ -n "$entry" ] || { echo "dev source archive does not contain webui/public/index.html." >&2; exit 1; }
  SRC=$(dirname "$(dirname "$entry")")
  echo "Source: dev exact SHA $SOURCE_SHA (development channel; no Release checksum)"
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
echo "Channel: $CHANNEL"
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
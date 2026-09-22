#!/usr/bin/env sh
set -eu

REPO="weigefenxiang/WeiG-qB-WebUI"
DEV_DIST_BASE="https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev"
DEFAULT_DEST="${HOME}/.local/share/weig_qb-webui"
DEST="${WEIG_QB_WEBUI_DIR:-$DEFAULT_DEST}"
REQUESTED_DEST="$DEST"
QBT_ROOT_FOLDER="$DEST"
DEST_EXPLICIT=0
TARGETS=""
TARGET_COUNT=0
BACKUP_RETENTION=3
MODE="install"
CHANNEL="${WEIG_QB_CHANNEL:-main}"
CHANNEL_EXPLICIT=""
REQUEST_DEV=0
RELEASE_VERSION=""
RELEASE_TAG=""
CONFIGURE=0
DOCKER_CONTAINER=""
DOCKER_CONFIG_ROOT=""
CONTAINER_REQUESTED=""
CONFIG_ROOT_REQUESTED=""
SOURCE_SHA=""
LIST_CONTAINERS=0

usage() {
  cat <<'EOF_USAGE'
Usage: weig_qb-webui_install.sh [options]

Default: install/update the stable main version using the latest verified GitHub Release.

Main options:
  -dev, --dev               Install/update the current dev exact Git SHA.
  -o PATH, --output PATH    WebUI install path. Repeat -o to update multiple targets with one download.
  -configure, --configure   Enable qBittorrent Alternative WebUI and set Root Folder (single target only).
  -rollback, --rollback     Restore the previous installer backup.
  -help, -h, --help         Show this help.

Advanced / compatibility:
  -version VERSION, --version VERSION
                            Install a specific verified Release, for example 1.0.0.
  -update, --update         Reinstall/update the selected source (legacy-compatible).
  --container NAME_OR_ID    Select one qBittorrent Docker container explicitly.
  --config-root HOST_PATH   Host path mounted as qBittorrent container /config.
  --list-containers         List detected qBittorrent Docker containers and exit.
  --channel=main|release|dev
                            Legacy channel syntax; release is an alias of main.
  --dir=/path               Legacy single install-path syntax.

Notes:
  - No -dev option means main/stable.
  - -dev and -version cannot be used together.
  - Multiple -o targets download and verify one payload, then update all targets transactionally.
  - Multiple -o targets cannot be combined with -configure, --container or --config-root.
  - Installer backups stay under ~/.config/weig_qb-webui/backups/ and retain the latest 3 per target.
  - A requested Release version never falls back to latest or dev.
EOF_USAGE
}

need_value() {
  option=$1
  value=${2-}
  [ -n "$value" ] || { echo "$option requires a value." >&2; exit 2; }
}

append_target() {
  target=$1
  [ -n "$target" ] || { echo "Install path cannot be empty." >&2; exit 2; }
  while [ "$target" != "/" ] && [ "${target%/}" != "$target" ]; do
    target=${target%/}
  done
  if [ -z "$TARGETS" ]; then
    TARGETS=$target
  else
    TARGETS="$TARGETS
$target"
  fi
  TARGET_COUNT=$((TARGET_COUNT+1))
  DEST_EXPLICIT=1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    -dev|--dev)
      REQUEST_DEV=1
      ;;
    -version|--version)
      [ "$#" -ge 2 ] || { echo "$1 requires a value, for example -version 1.0.0." >&2; exit 2; }
      shift
      RELEASE_VERSION=$1
      ;;
    --version=*)
      RELEASE_VERSION=${1#--version=}
      need_value --version "$RELEASE_VERSION"
      ;;
    -o|--output)
      [ "$#" -ge 2 ] || { echo "$1 requires a path." >&2; exit 2; }
      shift
      append_target "$1"
      ;;
    --output=*)
      target=${1#--output=}
      need_value --output "$target"
      append_target "$target"
      ;;
    -configure|--configure)
      CONFIGURE=1
      ;;
    -rollback|--rollback)
      MODE="rollback"
      ;;
    -update|--update)
      MODE="update"
      ;;
    --container)
      [ "$#" -ge 2 ] || { echo "--container requires a name or ID." >&2; exit 2; }
      shift
      CONTAINER_REQUESTED=$1
      ;;
    --container=*)
      CONTAINER_REQUESTED=${1#--container=}
      need_value --container "$CONTAINER_REQUESTED"
      ;;
    --config-root)
      [ "$#" -ge 2 ] || { echo "--config-root requires a host path." >&2; exit 2; }
      shift
      CONFIG_ROOT_REQUESTED=$1
      ;;
    --config-root=*)
      CONFIG_ROOT_REQUESTED=${1#--config-root=}
      need_value --config-root "$CONFIG_ROOT_REQUESTED"
      ;;
    --list-containers)
      LIST_CONTAINERS=1
      ;;
    --channel=main)
      CHANNEL="main"
      CHANNEL_EXPLICIT="main"
      ;;
    --channel=release)
      CHANNEL="main"
      CHANNEL_EXPLICIT="release"
      ;;
    --channel=dev)
      CHANNEL="dev"
      CHANNEL_EXPLICIT="dev"
      ;;
    --channel=*)
      echo "Unsupported channel: ${1#--channel=}. Use main or dev." >&2
      exit 2
      ;;
    --dir=*)
      target=${1#--dir=}
      need_value --dir "$target"
      append_target "$target"
      ;;
    -help|-h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "$CHANNEL" in
  main|dev) ;;
  release) CHANNEL="main" ;;
  *) echo "Unsupported channel: $CHANNEL. Use main or dev." >&2; exit 2 ;;
esac

if [ "$REQUEST_DEV" -eq 1 ]; then
  case "$CHANNEL_EXPLICIT" in
    main|release) echo "-dev conflicts with an explicit main/release channel." >&2; exit 2 ;;
  esac
  CHANNEL="dev"
fi

if [ -n "$RELEASE_VERSION" ] && [ "$CHANNEL" = "dev" ]; then
  echo "-version and -dev cannot be used together." >&2
  exit 2
fi

if [ -n "$RELEASE_VERSION" ]; then
  case "$RELEASE_VERSION" in v*) RELEASE_VERSION=${RELEASE_VERSION#v} ;; esac
  printf '%s' "$RELEASE_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || {
    echo "Invalid Release version: $RELEASE_VERSION. Expected a version such as 1.0.0." >&2
    exit 2
  }
  RELEASE_TAG="v$RELEASE_VERSION"
fi

if [ "$TARGET_COUNT" -gt 0 ]; then
  DEST=$(printf '%s\n' "$TARGETS" | sed -n '1p')
  REQUESTED_DEST="$DEST"
  QBT_ROOT_FOLDER="$DEST"
fi

if [ "$TARGET_COUNT" -gt 1 ]; then
  duplicate=$(printf '%s\n' "$TARGETS" | sort | uniq -d | head -n1 || true)
  [ -z "$duplicate" ] || { echo "Duplicate -o target: $duplicate" >&2; exit 2; }
  [ "$CONFIGURE" -eq 0 ] || { echo "Multiple -o targets cannot be combined with -configure; configure each qBittorrent instance separately." >&2; exit 2; }
  [ -z "$CONTAINER_REQUESTED" ] || { echo "Multiple -o targets cannot be combined with --container." >&2; exit 2; }
  [ -z "$CONFIG_ROOT_REQUESTED" ] || { echo "Multiple -o targets cannot be combined with --config-root." >&2; exit 2; }
fi

STATE="${HOME}/.config/weig_qb-webui"
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

is_pages_irrelevant_path() {
  case "$1" in
    webui/*|simulator/*|installers/*|VERSION|tools/data/qb-stable-lkg.json|tools/data/qb-locale-lkg.json|tests/fixtures/qb-release-catalog.lkg.json) return 1 ;;
    *) return 0 ;;
  esac
}

dev_payload_can_represent_head() {
  published_sha=$1
  dev_head_sha=$2
  compare_file=$3

  [ "$published_sha" = "$dev_head_sha" ] && return 0
  valid_sha "$published_sha" && valid_sha "$dev_head_sha" || return 1

  download_file "https://api.github.com/repos/$REPO/compare/$published_sha...$dev_head_sha" "$compare_file" || return 1
  grep -Eq '^[[:space:]]*"status":[[:space:]]*"ahead"' "$compare_file" || return 1

  changed_paths=$(sed -n 's/^[[:space:]]*"filename":[[:space:]]*"\([^"]*\)".*/\1/p' "$compare_file")
  [ -n "$changed_paths" ] || return 1
  changed_count=$(printf '%s\n' "$changed_paths" | grep -c . || true)
  [ "$changed_count" -lt 300 ] || {
    echo "GitHub compare returned 300 changed files; refusing to assume the file list is complete." >&2
    return 1
  }

  while IFS= read -r changed_path; do
    [ -n "$changed_path" ] || continue
    if ! is_pages_irrelevant_path "$changed_path"; then
      echo "Pages-relevant change exists after published dev payload: $changed_path" >&2
      return 1
    fi
  done <<EOF_CHANGED_PATHS
$changed_paths
EOF_CHANGED_PATHS

  return 0
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

assert_materialized_webui() {
  root=$1
  registry="$root/private/data/qb-settings-native.txt"
  translations="$root/translations"
  for contract in capabilities.json torrent-compat.json detail-compat.json settings-compat.json source-actions.json; do
    [ -s "$root/private/data/$contract" ] || { echo "Materialized WebUI is missing compact runtime contract $contract." >&2; return 1; }
  done
  [ ! -e "$root/private/scripts/release-profile.js" ] && [ ! -e "$root/private/data/qb-releases.json" ] && [ ! -e "$root/private/data/qb-release-profiles" ] || { echo "Materialized WebUI retained retired release-profile runtime assets." >&2; return 1; }
  [ -s "$registry" ] || { echo "Materialized WebUI is missing the native Settings QBT_TR registry." >&2; return 1; }
  grep -Eq '^@@(P|SET|VAL|REF|META|S)([[:space:]]|$)' "$registry" || { echo "Materialized WebUI qB-owned copy registry is a placeholder or malformed." >&2; return 1; }
  [ -d "$translations" ] || { echo "Materialized WebUI is missing the translations directory." >&2; return 1; }
  find "$translations" -maxdepth 1 -type f -name 'webui_*.qm' -print -quit | grep -q . || { echo "Materialized WebUI is missing official qB WebUI translation QM assets." >&2; return 1; }
}

inject_build_sha() {
  valid_sha "$SOURCE_SHA" || { echo "Unable to resolve a valid 40-character Git SHA for this payload." >&2; exit 1; }
  find "$DEST.new" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name 'GIT_SHA' \) -exec sed -i "s/__WEIG_GIT_SHA__/$SOURCE_SHA/g" {} +
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
  cat > "$DEST.new/private/weig-install.json" <<EOF_META
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
EOF_META
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
      echo "Re-run with --container <name> or --config-root <host /config path>." >&2
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
    DEST="$DOCKER_CONFIG_ROOT/weig_qb-webui"
    QBT_ROOT_FOLDER="/config/weig_qb-webui"
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

validate_qb_webui_config_file() {
  validate_cfg=$1
  validate_expected_root=${2-}
  validate_require_values=${3:-0}
  awk -v expected_root="$validate_expected_root" -v require_values="$validate_require_values" '
    BEGIN { section=""; preferences=0; alt=0; root=0; wrong=0; alt_true=0; root_exact=0 }
    {
      line=$0
      sub(/\r$/, "", line)
      if (line ~ /^\[[^]]+\]$/) {
        section=line
        if (line == "[Preferences]") preferences++
        next
      }
      if (line ~ /^WebUI\\AlternativeUIEnabled=/) {
        alt++
        if (section != "[Preferences]") wrong=1
        if (line == "WebUI\\AlternativeUIEnabled=true") alt_true++
      }
      if (line ~ /^WebUI\\RootFolder=/) {
        root++
        if (section != "[Preferences]") wrong=1
        if (line == "WebUI\\RootFolder=" expected_root) root_exact++
      }
    }
    END {
      if (preferences != 1) { print "qBittorrent config must contain exactly one [Preferences] section; found " preferences "." > "/dev/stderr"; exit 41 }
      if (wrong) { print "qBittorrent managed WebUI keys must belong to the [Preferences] section." > "/dev/stderr"; exit 42 }
      if (alt > 1 || root > 1) { print "qBittorrent config contains duplicate managed WebUI keys; refusing ambiguous mutation." > "/dev/stderr"; exit 43 }
      if (require_values && (alt != 1 || root != 1 || alt_true != 1 || root_exact != 1)) { print "qBittorrent managed WebUI values failed exact post-write verification." > "/dev/stderr"; exit 44 }
    }
  ' "$validate_cfg"
}

configure_qb_webui_file() {
  cfg=$1
  qb_root=$2
  [ -f "$cfg" ] || { echo "qBittorrent config does not exist: $cfg" >&2; return 1; }
  validate_qb_webui_config_file "$cfg" "$qb_root" 0 || return 1

  backup="$cfg.weig.bak"
  cp -a "$cfg" "$backup"
  cmp -s "$cfg" "$backup" || { echo "qBittorrent safety backup is not byte-identical; refusing mutation." >&2; return 1; }

  cfg_dir=$(dirname "$cfg")
  tmp_cfg=$(mktemp "$cfg_dir/.weig-qb-config.XXXXXX")
  tmp_body="$tmp_cfg.body"
  cleanup_qb_tmp() { rm -f "$tmp_cfg" "$tmp_body"; }
  cp -p "$cfg" "$tmp_cfg" 2>/dev/null || cp "$cfg" "$tmp_cfg"

  if ! awk -v root="$qb_root" '
    BEGIN { in_preferences=0; alt=0; root_seen=0; saw_cr=0 }
    function emit_missing(suffix) {
      if (!alt) print "WebUI\\AlternativeUIEnabled=true" suffix
      if (!root_seen) print "WebUI\\RootFolder=" root suffix
    }
    {
      raw=$0
      line=raw
      had_cr=sub(/\r$/, "", line)
      if (had_cr) saw_cr=1
      if (line ~ /^\[[^]]+\]$/) {
        if (in_preferences) { emit_missing(saw_cr ? "\r" : ""); in_preferences=0 }
        if (line == "[Preferences]") in_preferences=1
        print raw
        next
      }
      if (in_preferences && line ~ /^WebUI\\AlternativeUIEnabled=/) {
        print "WebUI\\AlternativeUIEnabled=true" (had_cr ? "\r" : "")
        alt=1
        next
      }
      if (in_preferences && line ~ /^WebUI\\RootFolder=/) {
        print "WebUI\\RootFolder=" root (had_cr ? "\r" : "")
        root_seen=1
        next
      }
      print raw
    }
    END { if (in_preferences) emit_missing(saw_cr ? "\r" : "") }
  ' "$cfg" > "$tmp_body"; then
    cleanup_qb_tmp
    return 1
  fi
  cat "$tmp_body" > "$tmp_cfg"
  rm -f "$tmp_body"

  if ! validate_qb_webui_config_file "$tmp_cfg" "$qb_root" 1; then
    cleanup_qb_tmp
    return 1
  fi
  if ! mv "$tmp_cfg" "$cfg"; then
    cleanup_qb_tmp
    cp -a "$backup" "$cfg"
    echo "Failed to atomically replace qBittorrent config; original restored." >&2
    return 1
  fi
  if ! validate_qb_webui_config_file "$cfg" "$qb_root" 1; then
    cp -a "$backup" "$cfg"
    echo "qBittorrent config post-write verification failed; original restored." >&2
    return 1
  fi
}

if [ "${WEIG_QB_CONFIG_TEST_ONLY:-0}" = "1" ]; then
  [ -n "${WEIG_QB_CONFIG_TEST_PATH:-}" ] && [ -n "${WEIG_QB_CONFIG_TEST_ROOT:-}" ] || {
    echo "WEIG_QB_CONFIG_TEST_PATH and WEIG_QB_CONFIG_TEST_ROOT are required in config test mode." >&2
    exit 2
  }
  configure_qb_webui_file "$WEIG_QB_CONFIG_TEST_PATH" "$WEIG_QB_CONFIG_TEST_ROOT"
  exit $?
fi

if [ "$LIST_CONTAINERS" -eq 1 ]; then
  print_qb_containers
  exit 0
fi

if [ "$MODE" != "rollback" ]; then
  if [ "$TARGET_COUNT" -le 1 ]; then
    select_qb_docker || true
    map_docker_destination
    TARGETS="$DEST"
    TARGET_COUNT=1
  else
    DOCKER_CONTAINER=""
    DOCKER_CONFIG_ROOT=""
    QBT_ROOT_FOLDER=""
    echo "Multiple explicit WebUI targets selected; Docker auto-detection/config mutation is disabled."
  fi
fi
SINGLE_QBT_ROOT_FOLDER="$QBT_ROOT_FOLDER"

find_config() {
  if [ -n "$DOCKER_CONFIG_ROOT" ]; then
    for f in \
      "$DOCKER_CONFIG_ROOT/qBittorrent/config/qBittorrent.conf" \
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

backup_is_owned() {
  backup=$1
  [ -d "$backup" ] && [ -f "$backup/had-webui" ] && [ -f "$backup/dest-path" ]
}

latest_backup_for_dest() {
  target=$1
  find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -r | while IFS= read -r backup; do
    backup_is_owned "$backup" || continue
    saved_dest=$(cat "$backup/dest-path" 2>/dev/null || true)
    [ "$saved_dest" = "$target" ] || continue
    printf '%s\n' "$backup"
    break
  done
}

prune_backups_for_dest() {
  target=$1
  keep=${2:-$BACKUP_RETENTION}
  [ "$keep" -ge 1 ] || { echo "Backup retention must keep at least one backup." >&2; return 1; }
  count=0
  find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort -r | while IFS= read -r backup; do
    backup_is_owned "$backup" || continue
    saved_dest=$(cat "$backup/dest-path" 2>/dev/null || true)
    [ "$saved_dest" = "$target" ] || continue
    count=$((count+1))
    if [ "$count" -gt "$keep" ]; then
      rm -rf -- "$backup"
      echo "Pruned old installer backup: $backup"
    fi
  done
}

qb_root_for_target() {
  target=$1
  if [ "$TARGET_COUNT" -eq 1 ]; then
    printf '%s\n' "$SINGLE_QBT_ROOT_FOLDER"
  else
    # Explicit multi-target -o values are host paths. Do not invent a container-visible qB path.
    printf '%s\n' ""
  fi
}

backup_target() {
  dest=$1
  index=$2
  qb_root=$3
  suffix=$(printf '%02d' "$index")
  b="$BACKUPS/$BACKUP_STAMP-$suffix-$$"
  [ ! -e "$b" ] || { echo "Backup path already exists: $b" >&2; return 1; }
  mkdir -p "$b"

  if [ -e "$dest" ] && [ ! -d "$dest" ]; then
    echo "Install target exists but is not a directory: $dest" >&2
    rm -rf "$b"
    return 1
  fi
  if [ -d "$dest" ]; then
    cp -a "$dest" "$b/webui"
    printf '1\n' > "$b/had-webui"
  else
    printf '0\n' > "$b/had-webui"
  fi

  cfg=""
  if [ "$TARGET_COUNT" -eq 1 ]; then
    cfg=$(find_config || true)
  fi
  if [ -n "$cfg" ]; then
    cp -a "$cfg" "$b/qBittorrent.conf"
    printf '%s\n' "$cfg" > "$b/config-path"
  fi

  printf '%s\n' "$dest" > "$b/dest-path"
  printf '%s\n' "$qb_root" > "$b/qb-root-folder"
  printf '%s\n' "$b" > "$STATE/last-backup"
  printf '%s\n' "$dest" > "$STATE/last-dest"
  printf '%s\n' "$qb_root" > "$STATE/last-qb-root-folder"
  printf '%s|%s\n' "$dest" "$b" >> "$BACKUP_MAP_FILE"
  echo "Backup: $b"
}

restore_webui_from_backup() {
  dest=$1
  b=$2
  had_webui=0
  [ -s "$b/had-webui" ] && had_webui=$(cat "$b/had-webui")
  rm -rf "$dest"
  if [ "$had_webui" = "1" ]; then
    [ -d "$b/webui" ] || { echo "Backup WebUI missing: $b/webui" >&2; return 1; }
    mkdir -p "$(dirname "$dest")"
    cp -a "$b/webui" "$dest"
    echo "Restored previous WebUI: $dest"
  else
    echo "Removed WeiG qB WebUI from: $dest"
  fi
}

restore_full_backup() {
  dest=$1
  b=$2
  restore_webui_from_backup "$dest" "$b" || return 1
  if [ -s "$b/config-path" ] && [ -f "$b/qBittorrent.conf" ]; then
    cfg=$(cat "$b/config-path")
    if is_safe_config_path "$cfg"; then
      mkdir -p "$(dirname "$cfg")"
      cp -a "$b/qBittorrent.conf" "$cfg"
      echo "Restored qBittorrent config: $cfg"
    fi
  fi
}

rollback() {
  plan="$TMP/rollback-plan"
  : > "$plan"
  if [ "$TARGET_COUNT" -gt 0 ]; then
    while IFS= read -r target; do
      [ -n "$target" ] || continue
      b=$(latest_backup_for_dest "$target")
      [ -n "$b" ] || { echo "No installer backup found for target: $target" >&2; return 1; }
      printf '%s|%s\n' "$target" "$b" >> "$plan"
    done <<EOF_TARGETS
$TARGETS
EOF_TARGETS
  else
    [ -f "$STATE/last-backup" ] || { echo "No backup found." >&2; return 1; }
    b=$(cat "$STATE/last-backup")
    [ -d "$b" ] || { echo "Backup directory missing: $b" >&2; return 1; }
    [ -s "$b/dest-path" ] || { echo "Backup destination marker missing: $b/dest-path" >&2; return 1; }
    target=$(cat "$b/dest-path")
    printf '%s|%s\n' "$target" "$b" >> "$plan"
  fi
  while IFS='|' read -r target b; do
    [ -n "$target" ] || continue
    restore_full_backup "$target" "$b" || return 1
  done < "$plan"
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT INT TERM

if [ "$MODE" = "rollback" ]; then
  rollback
  exit $?
fi

if [ "$TARGET_COUNT" -eq 1 ] && [ "$DEST" != "$REQUESTED_DEST" ]; then
  echo "Host install path: $DEST"
  echo "qBittorrent Root Folder: $QBT_ROOT_FOLDER"
fi

PACKAGE="$TMP/WeiG-qB-WebUI.zip"

if [ "$CHANNEL" = "main" ]; then
  REQUESTED_RELEASE_VERSION="$RELEASE_VERSION"
  REQUESTED_RELEASE_TAG="$RELEASE_TAG"
  RELEASE_META="$TMP/release.json"
  if [ -n "$REQUESTED_RELEASE_VERSION" ]; then
    RELEASE_META_URL="https://api.github.com/repos/$REPO/releases/tags/$REQUESTED_RELEASE_TAG"
  else
    RELEASE_META_URL="https://api.github.com/repos/$REPO/releases/latest"
  fi

  download_file "$RELEASE_META_URL" "$RELEASE_META" || {
    if [ -n "$REQUESTED_RELEASE_VERSION" ]; then
      echo "Release $REQUESTED_RELEASE_TAG was not found. Refusing to fall back to latest or dev." >&2
    else
      echo "No published stable GitHub Release is available. Release installation will not fall back to a branch archive." >&2
    fi
    exit 1
  }
  RESOLVED_RELEASE_TAG=$(sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$RELEASE_META" | head -n1)
  printf '%s' "$RESOLVED_RELEASE_TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' || {
    echo "GitHub Release metadata returned an invalid tag: ${RESOLVED_RELEASE_TAG:-<empty>}." >&2
    exit 1
  }
  if [ -n "$REQUESTED_RELEASE_TAG" ] && [ "$RESOLVED_RELEASE_TAG" != "$REQUESTED_RELEASE_TAG" ]; then
    echo "Requested $REQUESTED_RELEASE_TAG but GitHub Release metadata resolved $RESOLVED_RELEASE_TAG; refusing mismatched Release identity." >&2
    exit 1
  fi
  RESOLVED_RELEASE_VERSION=${RESOLVED_RELEASE_TAG#v}

  RELEASE_COMMIT_META="$TMP/release-commit.json"
  download_file "https://api.github.com/repos/$REPO/commits/$RESOLVED_RELEASE_TAG" "$RELEASE_COMMIT_META" || {
    echo "Unable to resolve commit identity for Release $RESOLVED_RELEASE_TAG." >&2
    exit 1
  }
  RELEASE_EXPECTED_SHA=$(sed -n 's/^[[:space:]]*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' "$RELEASE_COMMIT_META" | head -n1 | tr 'A-F' 'a-f')
  valid_sha "$RELEASE_EXPECTED_SHA" || { echo "Release $RESOLVED_RELEASE_TAG did not resolve to a valid commit SHA." >&2; exit 1; }

  RELEASE_TAG="$RESOLVED_RELEASE_TAG"
  RELEASE_VERSION="$RESOLVED_RELEASE_VERSION"
  RELEASE_BASE="https://github.com/$REPO/releases/download/$RELEASE_TAG"
  RELEASE_LABEL="Release $RELEASE_TAG"
  RELEASE_URL="$RELEASE_BASE/WeiG-qB-WebUI.zip"
  SUM_URL="$RELEASE_BASE/SHA256SUMS"

  download_file "$RELEASE_URL" "$PACKAGE" || {
    echo "$RELEASE_LABEL does not contain WeiG-qB-WebUI.zip. Refusing to fall back to another Release or branch." >&2
    exit 1
  }
  download_file "$SUM_URL" "$TMP/SHA256SUMS" || {
    echo "$RELEASE_LABEL is missing SHA256SUMS; refusing an unverified installation." >&2
    exit 1
  }
  [ -s "$TMP/SHA256SUMS" ] || { echo "SHA256SUMS is empty; refusing installation." >&2; exit 1; }
  verify_release_checksum "$TMP/SHA256SUMS" "$PACKAGE"
  extract_zip "$PACKAGE" "$TMP/release"
  SRC="$TMP/release/WeiG-qB-WebUI"
  SOURCE_SHA=$(cat "$SRC/GIT_SHA" 2>/dev/null | tr -d '\r\n' | tr 'A-F' 'a-f' || true)
  valid_sha "$SOURCE_SHA" || { echo "$RELEASE_LABEL does not contain a valid GIT_SHA; refusing an unversioned asset deployment." >&2; exit 1; }
  PACKAGE_VERSION=$(cat "$SRC/VERSION" 2>/dev/null | tr -d '\r\n' || true)
  [ "$PACKAGE_VERSION" = "$RELEASE_VERSION" ] || {
    echo "$RELEASE_LABEL maps to VERSION=$RELEASE_VERSION but the package reports VERSION=$PACKAGE_VERSION; refusing mismatched Release content." >&2
    exit 1
  }
  [ "$SOURCE_SHA" = "$RELEASE_EXPECTED_SHA" ] || {
    echo "$RELEASE_LABEL points to Git SHA $RELEASE_EXPECTED_SHA but the package reports GIT_SHA=$SOURCE_SHA; refusing mismatched Release content." >&2
    exit 1
  }
  echo "Source: $RELEASE_LABEL at $RELEASE_EXPECTED_SHA (checksum and Release identity verified)"
else
  DEV_META="$TMP/dev-commit.json"
  download_file "https://api.github.com/repos/$REPO/commits/dev" "$DEV_META" || { echo "Unable to resolve the current dev commit." >&2; exit 1; }
  DEV_HEAD_SHA=$(sed -n 's/^[[:space:]]*"sha":[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' "$DEV_META" | head -n1)
  valid_sha "$DEV_HEAD_SHA" || { echo "GitHub did not return a valid dev commit SHA." >&2; exit 1; }

  PUBLISHED_SHA_FILE="$TMP/DEV_GIT_SHA"
  download_file "$DEV_DIST_BASE/GIT_SHA" "$PUBLISHED_SHA_FILE" || {
    echo "The materialized dev WebUI payload is not published yet. Wait for Virtual qB Pages to finish and retry." >&2
    exit 1
  }
  PUBLISHED_SHA=$(tr -d '\r\n' < "$PUBLISHED_SHA_FILE")
  valid_sha "$PUBLISHED_SHA" || { echo "The materialized dev payload does not publish a valid GIT_SHA." >&2; exit 1; }

  SOURCE_SHA="$PUBLISHED_SHA"
  if [ "$PUBLISHED_SHA" != "$DEV_HEAD_SHA" ]; then
    if dev_payload_can_represent_head "$PUBLISHED_SHA" "$DEV_HEAD_SHA" "$TMP/dev-compare.json"; then
      echo "Current dev HEAD $DEV_HEAD_SHA differs from materialized SHA $PUBLISHED_SHA only by Pages-irrelevant changes; reusing the verified payload."
    else
      echo "The materialized dev payload is still at $PUBLISHED_SHA while dev is $DEV_HEAD_SHA, and at least one Pages-relevant change is not published. Wait for the exact Pages build and retry; refusing raw-source fallback." >&2
      exit 1
    fi
  fi

  download_file "$DEV_DIST_BASE/WeiG-qB-WebUI.zip" "$PACKAGE" || { echo "Unable to download the materialized dev payload for exact SHA $SOURCE_SHA." >&2; exit 1; }
  download_file "$DEV_DIST_BASE/SHA256SUMS" "$TMP/SHA256SUMS" || { echo "Materialized dev payload is missing SHA256SUMS; refusing installation." >&2; exit 1; }
  [ -s "$TMP/SHA256SUMS" ] || { echo "Materialized dev SHA256SUMS is empty; refusing installation." >&2; exit 1; }
  verify_release_checksum "$TMP/SHA256SUMS" "$PACKAGE"
  extract_zip "$PACKAGE" "$TMP/dev"
  SRC="$TMP/dev/WeiG-qB-WebUI"
  [ -d "$SRC" ] || { echo "Materialized dev payload does not contain WeiG-qB-WebUI." >&2; exit 1; }
  PACKAGE_SHA=$(tr -d '\r\n' < "$SRC/GIT_SHA" 2>/dev/null || true)
  [ "$PACKAGE_SHA" = "$SOURCE_SHA" ] || { echo "Dev package Git SHA $PACKAGE_SHA does not match materialized dev SHA $SOURCE_SHA." >&2; exit 1; }
  assert_materialized_webui "$SRC" || exit 1
  if [ "$SOURCE_SHA" = "$DEV_HEAD_SHA" ]; then
    echo "Source: dev exact SHA $SOURCE_SHA (materialized Pages payload; checksum verified)"
  else
    echo "Source: dev materialized SHA $SOURCE_SHA for current HEAD $DEV_HEAD_SHA (only Pages-irrelevant changes are newer; checksum verified)"
  fi
fi

[ -n "$SRC" ] && [ -d "$SRC" ] || { echo "WebUI payload not found." >&2; exit 1; }
[ -f "$SRC/public/index.html" ] && [ -f "$SRC/public/login.html" ] && [ -f "$SRC/private/index.html" ] || { echo "Source package is not a valid qBittorrent Alternate WebUI." >&2; exit 1; }

TARGET_FILE="$TMP/install-targets"
PREPARED_FILE="$TMP/prepared-targets"
BACKUP_MAP_FILE="$TMP/backup-map"
SWITCHED_FILE="$TMP/switched-targets"
printf '%s\n' "$TARGETS" > "$TARGET_FILE"
: > "$PREPARED_FILE"
: > "$BACKUP_MAP_FILE"
: > "$SWITCHED_FILE"

prepare_target() {
  dest=$1
  qb_root=$2
  [ -n "$dest" ] || return 0
  if [ -e "$dest" ] && [ ! -d "$dest" ]; then
    echo "Install target exists but is not a directory: $dest" >&2
    return 1
  fi
  mkdir -p "$(dirname "$dest")"
  DEST="$dest"
  QBT_ROOT_FOLDER="$qb_root"
  rm -rf "$DEST.new"
  mkdir -p "$DEST.new"
  cp -a "$SRC"/. "$DEST.new"/
  inject_build_sha
  write_install_metadata
  if [ "$CHANNEL" = "dev" ]; then
    assert_materialized_webui "$DEST.new" || { rm -rf "$DEST.new"; return 1; }
  fi
  [ -f "$DEST.new/public/index.html" ] && [ -f "$DEST.new/public/login.html" ] && [ -f "$DEST.new/private/index.html" ] && [ -f "$DEST.new/VERSION" ] && [ -f "$DEST.new/GIT_SHA" ] && [ -f "$DEST.new/private/weig-install.json" ] || { echo "Installed payload validation failed for $dest." >&2; rm -rf "$DEST.new"; return 1; }
  valid_sha "$(tr -d '\r\n' < "$DEST.new/GIT_SHA")" || { echo "Installed Git SHA validation failed for $dest." >&2; rm -rf "$DEST.new"; return 1; }
  printf '%s|%s|%s\n' "$dest" "$DEST.new" "$qb_root" >> "$PREPARED_FILE"
  echo "Prepared: $dest"
}

while IFS= read -r target; do
  [ -n "$target" ] || continue
  prepare_target "$target" "$(qb_root_for_target "$target")" || exit 1
done < "$TARGET_FILE"

BACKUP_STAMP=$(date '+%Y%m%d-%H%M%S')
index=0
while IFS='|' read -r target new qb_root; do
  [ -n "$target" ] || continue
  index=$((index+1))
  backup_target "$target" "$index" "$qb_root" || exit 1
done < "$PREPARED_FILE"

backup_for_target() {
  target=$1
  awk -F'|' -v want="$target" '$1==want {print $2; exit}' "$BACKUP_MAP_FILE"
}

rollback_switched() {
  [ -s "$SWITCHED_FILE" ] || return 0
  echo "Rolling back already-switched WebUI targets..." >&2
  while IFS='|' read -r target b; do
    [ -n "$target" ] || continue
    restore_webui_from_backup "$target" "$b" || true
  done < "$SWITCHED_FILE"
}

while IFS='|' read -r target new qb_root; do
  [ -n "$target" ] || continue
  b=$(backup_for_target "$target")
  [ -n "$b" ] || { echo "Backup map missing for target: $target" >&2; rollback_switched; exit 1; }
  old="$target.old"
  rm -rf "$old"
  if [ -d "$target" ]; then
    mv "$target" "$old" || { echo "Unable to stage previous install for switch: $target" >&2; rollback_switched; exit 1; }
  fi
  if mv "$new" "$target"; then
    rm -rf "$old"
    printf '%s|%s\n' "$target" "$b" >> "$SWITCHED_FILE"
    echo "Installed and verified: $target"
    echo "  Channel: $CHANNEL"
    echo "  Version: $(cat "$target/VERSION")"
    echo "  Git SHA: $(cat "$target/GIT_SHA")"
    echo "  Metadata: $target/private/weig-install.json"
  else
    [ -d "$old" ] && mv "$old" "$target" || true
    echo "Installation switch failed: $target" >&2
    rollback_switched
    exit 1
  fi
done < "$PREPARED_FILE"

while IFS='|' read -r target b; do
  [ -n "$target" ] || continue
  prune_backups_for_dest "$target" "$BACKUP_RETENTION"
done < "$SWITCHED_FILE"

echo "Backup root: $BACKUPS"
echo "Backup retention: latest $BACKUP_RETENTION per install target"

if [ "$TARGET_COUNT" -eq 1 ]; then
  DEST=$(sed -n '1p' "$TARGET_FILE")
  QBT_ROOT_FOLDER="$SINGLE_QBT_ROOT_FOLDER"
  cfg=$(find_config || true)
  if [ "$CONFIGURE" -eq 1 ]; then
    [ -n "$cfg" ] || { echo "No safe qBittorrent config was found; WebUI files are installed but configuration was not changed." >&2; exit 2; }
    configure_qb_webui_file "$cfg" "$QBT_ROOT_FOLDER"
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
  echo "Rollback:"
  echo "  sh $0 -o '$DEST' -rollback"
else
  echo "Updated $TARGET_COUNT WebUI targets with one verified payload."
  echo "qBittorrent configuration was not changed; keep each instance's existing Alternative WebUI Root Folder."
  printf 'Rollback all updated targets:\n  sh %s' "$0"
  while IFS= read -r target; do
    [ -n "$target" ] || continue
    printf " -o '%s'" "$target"
  done < "$TARGET_FILE"
  printf ' -rollback\n'
fi

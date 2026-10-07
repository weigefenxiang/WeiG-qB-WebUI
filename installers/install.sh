#!/usr/bin/env sh
set -eu

REPO="weigefenxiang/WeiG-qB-WebUI"
DEV_DIST_BASE="https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev"
DEFAULT_DEST="${HOME}/.local/share/weig-qb-webui"
LEGACY_DEFAULT_DEST="${HOME}/.local/share/weig_qb-webui"
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
PURGE_BACKUPS=0

usage() {
  cat <<'EOF_USAGE'
Usage: install.sh [options]

Default: install/update the stable main version using the latest verified GitHub Release.

Main options:
  -dev, --dev               Install/update the current dev exact Git SHA.
  -o PATH, --output PATH    WebUI install path. Repeat -o to update multiple targets with one download.
  -configure, --configure   Enable qBittorrent Alternative WebUI and set Root Folder (single target only).
  -rollback, --rollback     Restore previous WeiG files. Add -configure to restore a saved qB WebUI config snapshot.
  -uninstall, --uninstall   Remove an installer-owned WeiG WebUI. Add -configure to disable it in qBittorrent too.
  -purge, --purge           With -uninstall, also remove installer-owned backups for the selected target(s).
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
  - Installer backups stay under ~/.config/weig-qb-webui/backups/, prefer verified compressed archives when supported, and retain the latest 3 per target.
  - -purge is destructive and is only accepted together with -uninstall.
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
    -uninstall|--uninstall)
      MODE="uninstall"
      ;;
    -purge|--purge)
      PURGE_BACKUPS=1
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

if [ "$PURGE_BACKUPS" -eq 1 ] && [ "$MODE" != "uninstall" ]; then
  echo "-purge can only be used together with -uninstall." >&2
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

if [ "$TARGET_COUNT" -eq 0 ] && [ -z "${WEIG_QB_WEBUI_DIR:-}" ] && { [ "$MODE" = "install" ] || [ "$MODE" = "update" ]; } && [ ! -e "$DEFAULT_DEST" ] && [ -d "$LEGACY_DEFAULT_DEST" ] && [ -f "$LEGACY_DEFAULT_DEST/public/index.html" ] && [ -f "$LEGACY_DEFAULT_DEST/private/index.html" ] && [ -f "$LEGACY_DEFAULT_DEST/private/weig-install.json" ]; then
  DEST="$LEGACY_DEFAULT_DEST"
  REQUESTED_DEST="$DEST"
  QBT_ROOT_FOLDER="$DEST"
  echo "Using existing legacy install directory: $DEST"
fi

if [ "$TARGET_COUNT" -gt 0 ]; then
  DEST=$(printf '%s\n' "$TARGETS" | sed -n '1p')
  REQUESTED_DEST="$DEST"
  QBT_ROOT_FOLDER="$DEST"
fi

if [ "$TARGET_COUNT" -gt 1 ]; then
  duplicate=$(printf '%s\n' "$TARGETS" | sort | uniq -d | head -n 1 || true)
  [ -z "$duplicate" ] || { echo "Duplicate -o target: $duplicate" >&2; exit 2; }
  [ "$CONFIGURE" -eq 0 ] || { echo "Multiple -o targets cannot be combined with -configure; configure each qBittorrent instance separately." >&2; exit 2; }
  [ -z "$CONTAINER_REQUESTED" ] || { echo "Multiple -o targets cannot be combined with --container." >&2; exit 2; }
  [ -z "$CONFIG_ROOT_REQUESTED" ] || { echo "Multiple -o targets cannot be combined with --config-root." >&2; exit 2; }
fi

STATE="${HOME}/.config/weig-qb-webui"
LEGACY_STATE="${HOME}/.config/weig_qb-webui"
BACKUPS="$STATE/backups"
LEGACY_BACKUPS="$LEGACY_STATE/backups"
mkdir -p "$BACKUPS"

state_marker_value() {
  marker_name=$1
  for marker_root in "$STATE" "$LEGACY_STATE"; do
    marker_path="$marker_root/$marker_name"
    [ -s "$marker_path" ] || continue
    cat "$marker_path"
    return 0
  done
  return 1
}

if { [ "$MODE" = "rollback" ] || [ "$MODE" = "uninstall" ]; } && [ "$DEST_EXPLICIT" -eq 0 ]; then
  remembered_dest=$(state_marker_value last-dest 2>/dev/null || true)
  if [ -n "$remembered_dest" ]; then
    DEST=$remembered_dest
    REQUESTED_DEST="$DEST"
    QBT_ROOT_FOLDER="$DEST"
  fi
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

portable_mktemp_dir() {
  pm_base=${TMPDIR:-/tmp}
  if command -v mktemp >/dev/null 2>&1; then
    mktemp -d "$pm_base/weig-qb-webui.XXXXXX" 2>/dev/null && return 0
  fi
  if has_busybox_applet mktemp; then
    busybox mktemp -d "$pm_base/weig-qb-webui.XXXXXX" 2>/dev/null && return 0
  fi
  pm_i=0
  umask 077
  while [ "$pm_i" -lt 100 ]; do
    pm_candidate="$pm_base/weig-qb-webui-$$-$pm_i"
    if mkdir "$pm_candidate" 2>/dev/null; then
      printf '%s\n' "$pm_candidate"
      return 0
    fi
    pm_i=$((pm_i+1))
  done
  echo "Unable to create a private temporary directory under $pm_base." >&2
  return 1
}

portable_mktemp_file() {
  pm_dir=$1
  pm_prefix=$2
  if command -v mktemp >/dev/null 2>&1; then
    mktemp "$pm_dir/$pm_prefix.XXXXXX" 2>/dev/null && return 0
  fi
  if has_busybox_applet mktemp; then
    busybox mktemp "$pm_dir/$pm_prefix.XXXXXX" 2>/dev/null && return 0
  fi
  pm_i=0
  umask 077
  while [ "$pm_i" -lt 100 ]; do
    pm_candidate="$pm_dir/$pm_prefix-$$-$pm_i"
    pm_lock="$pm_candidate.lock"
    if mkdir "$pm_lock" 2>/dev/null; then
      if : > "$pm_candidate"; then
        rmdir "$pm_lock" 2>/dev/null || true
        printf '%s\n' "$pm_candidate"
        return 0
      fi
      rmdir "$pm_lock" 2>/dev/null || true
    fi
    pm_i=$((pm_i+1))
  done
  echo "Unable to create a temporary file in $pm_dir." >&2
  return 1
}

download_file() {
  url=$1
  out=$2
  if command -v curl >/dev/null 2>&1; then
    if curl -fL "$url" -o "$out"; then return 0; fi
    rm -f "$out"
  fi
  if command -v wget >/dev/null 2>&1; then
    if wget -q "$url" -O "$out"; then return 0; fi
    rm -f "$out"
  fi
  if has_busybox_applet wget; then
    if busybox wget -O "$out" "$url" >/dev/null 2>&1; then return 0; fi
    rm -f "$out"
  fi
  if command -v python3 >/dev/null 2>&1; then
    if python3 - "$url" "$out" <<'PY'
import shutil, sys, urllib.request
req=urllib.request.Request(sys.argv[1], headers={'User-Agent':'WeiG-qB-WebUI-installer'})
with urllib.request.urlopen(req, timeout=60) as src, open(sys.argv[2], 'wb') as dst:
    shutil.copyfileobj(src, dst)
PY
    then
      return 0
    fi
    rm -f "$out"
  fi
  echo "No supported downloader succeeded. Install curl/wget, use BusyBox/Python, or download the package in a browser." >&2
  return 127
}

extract_zip() {
  archive=$1
  target=$2
  mkdir -p "$target"
  if command -v unzip >/dev/null 2>&1; then
    if unzip -q "$archive" -d "$target"; then return 0; fi
    rm -rf "$target"; mkdir -p "$target"
  fi
  if has_busybox_applet unzip; then
    if busybox unzip "$archive" -d "$target" >/dev/null 2>&1; then return 0; fi
    rm -rf "$target"; mkdir -p "$target"
  fi
  if command -v bsdtar >/dev/null 2>&1; then
    if bsdtar -xf "$archive" -C "$target"; then return 0; fi
    rm -rf "$target"; mkdir -p "$target"
  fi
  if command -v python3 >/dev/null 2>&1; then
    if python3 -m zipfile -e "$archive" "$target"; then return 0; fi
    rm -rf "$target"; mkdir -p "$target"
  fi
  echo "No supported ZIP extractor succeeded. Install unzip, use BusyBox/Python/bsdtar, or extract the package manually." >&2
  return 127
}

sha256_file() {
  file=$1
  digest=""
  if command -v sha256sum >/dev/null 2>&1; then
    digest=$(sha256sum "$file" 2>/dev/null | awk 'NR==1{print $1}' || true)
    if printf '%s' "$digest" | grep -Eq '^[0-9a-fA-F]{64}$'; then printf '%s\n' "$digest"; return 0; fi
  fi
  if has_busybox_applet sha256sum; then
    digest=$(busybox sha256sum "$file" 2>/dev/null | awk 'NR==1{print $1}' || true)
    if printf '%s' "$digest" | grep -Eq '^[0-9a-fA-F]{64}$'; then printf '%s\n' "$digest"; return 0; fi
  fi
  if command -v shasum >/dev/null 2>&1; then
    digest=$(shasum -a 256 "$file" 2>/dev/null | awk 'NR==1{print $1}' || true)
    if printf '%s' "$digest" | grep -Eq '^[0-9a-fA-F]{64}$'; then printf '%s\n' "$digest"; return 0; fi
  fi
  if command -v openssl >/dev/null 2>&1; then
    digest=$(openssl dgst -sha256 "$file" 2>/dev/null | awk 'NR==1{print $NF}' || true)
    if printf '%s' "$digest" | grep -Eq '^[0-9a-fA-F]{64}$'; then printf '%s\n' "$digest"; return 0; fi
  fi
  if command -v python3 >/dev/null 2>&1; then
    digest=$(python3 - "$file" <<'PY' 2>/dev/null || true
import hashlib, sys
h=hashlib.sha256()
with open(sys.argv[1], 'rb') as f:
    for chunk in iter(lambda: f.read(1024*1024), b''):
        h.update(chunk)
print(h.hexdigest())
PY
)
    if printf '%s' "$digest" | grep -Eq '^[0-9a-fA-F]{64}$'; then printf '%s\n' "$digest"; return 0; fi
  fi
  echo "No SHA256 implementation succeeded; refusing an unverified Release installation." >&2
  return 127
}
verify_release_checksum() {
  sums=$1
  package=$2
  package_name=$3
  expected=$(awk -v name="$package_name" '$2==name || $2=="*" name {print $1; exit}' "$sums")
  printf '%s' "$expected" | grep -Eq '^[0-9a-fA-F]{64}$' || { echo "SHA256SUMS does not contain a valid checksum for $package_name." >&2; return 1; }
  actual=$(sha256_file "$package") || return 1
  expected=$(printf '%s' "$expected" | tr 'A-F' 'a-f')
  actual=$(printf '%s' "$actual" | tr 'A-F' 'a-f')
  [ "$expected" = "$actual" ] || { echo "SHA256 verification failed for $package_name." >&2; return 1; }
  echo "SHA256 verified: $package_name $actual"
}

manifest_string_field() {
  manifest=$1
  key=$2
  sed -n 's/^[[:space:]]*"'"$key"'":[[:space:]]*"\([^"]*\)".*/\1/p' "$manifest" | sed -n '1p'
}

extract_tar_gz() {
  archive=$1
  target=$2
  mkdir -p "$target"
  if command -v tar >/dev/null 2>&1 && tar -xzf "$archive" -C "$target" 2>/dev/null; then return 0; fi
  if has_busybox_applet tar && busybox tar -xzf "$archive" -C "$target" >/dev/null 2>&1; then return 0; fi
  return 127
}

extract_dist_archive() {
  archive=$1
  target=$2
  case "$archive" in
    *.tar.gz) extract_tar_gz "$archive" "$target" ;;
    *.zip) extract_zip "$archive" "$target" ;;
    *) return 127 ;;
  esac
}

prepare_manifest_dist() {
  dist_base=$1
  dist_manifest=$2
  dist_sums=$3
  dist_target=$4
  dist_root=$(manifest_string_field "$dist_manifest" rootFolder)
  dist_tar=$(manifest_string_field "$dist_manifest" unixArchive)
  dist_zip=$(manifest_string_field "$dist_manifest" zipArchive)
  [ "$dist_root" = "weig-qb-webui" ] || { echo "Distribution manifest has an unsupported rootFolder: $dist_root" >&2; return 1; }
  [ "$dist_tar" = "weig-qb-webui.tar.gz" ] || { echo "Distribution manifest has an unsupported unixArchive: $dist_tar" >&2; return 1; }
  [ "$dist_zip" = "weig-qb-webui.zip" ] || { echo "Distribution manifest has an unsupported zipArchive: $dist_zip" >&2; return 1; }

  dist_candidates="$dist_zip"
  if command -v tar >/dev/null 2>&1 || has_busybox_applet tar; then
    dist_candidates="$dist_tar
$dist_zip"
  fi
  while IFS= read -r dist_name; do
    [ -n "$dist_name" ] || continue
    dist_package="$TMP/$dist_name"
    download_file "$dist_base/$dist_name" "$dist_package" || continue
    verify_release_checksum "$dist_sums" "$dist_package" "$dist_name" || return 1
    rm -rf "$dist_target"
    mkdir -p "$dist_target"
    if extract_dist_archive "$dist_package" "$dist_target"; then
      [ -d "$dist_target/$dist_root" ] || { echo "Distribution archive $dist_name is missing root folder $dist_root." >&2; return 1; }
      PACKAGE="$dist_package"
      PACKAGE_NAME="$dist_name"
      SRC="$dist_target/$dist_root"
      return 0
    fi
  done <<EOF_DIST_CANDIDATES
$dist_candidates
EOF_DIST_CANDIDATES
  echo "No supported verified distribution archive could be extracted. Install tar+gzip or unzip/BusyBox unzip." >&2
  return 1
}

assert_materialized_webui() {
  root=$1
  data="$root/private/data"
  translations="$root/translations"
  for contract in capabilities.json torrent-compat.json detail-compat.json settings-compat.json source-actions.json rss-compat.json; do
    [ -s "$data/$contract" ] || { echo "Materialized WebUI is missing compact runtime contract $contract." >&2; return 1; }
  done
  [ ! -e "$root/private/scripts/release-profile.js" ] && [ ! -e "$data/qb-releases.json" ] && [ ! -e "$data/qb-release-profiles" ] && [ ! -e "$data/qb-settings-native.txt" ] || { echo "Materialized WebUI retained a retired runtime owner." >&2; return 1; }
  for spec in 'qb-copy-routes/*.json.gz' 'qb-copy-bindings/*.txt' 'qb-copy-fallback/*.json.gz'; do
    shard_found=0
    for shard in "$data"/$spec; do [ -f "$shard" ] || continue; [ -s "$shard" ] || { echo "Materialized WebUI contains an empty qB copy shard: $shard" >&2; return 1; }; shard_found=1; break; done
    [ "$shard_found" -eq 1 ] || { echo "Materialized WebUI is missing qB copy shards for $spec." >&2; return 1; }
  done
  weig_locale_dir="$data/weig-i18n"
  [ -d "$weig_locale_dir" ] || { echo "Materialized WebUI is missing WeiG locale shard directory." >&2; return 1; }
  weig_locale_count=0
  for locale_file in "$weig_locale_dir"/*.json; do [ -f "$locale_file" ] || continue; [ -s "$locale_file" ] || { echo "Materialized WebUI contains an empty WeiG locale shard: $locale_file" >&2; return 1; }; weig_locale_count=$((weig_locale_count+1)); done
  [ "$weig_locale_count" -eq 10 ] || { echo "Materialized WebUI WeiG locale shard count mismatch: $weig_locale_count != 10." >&2; return 1; }
  for locale in de es fr ja ko pt ru zh-CN zh-HK zh-TW; do [ -s "$weig_locale_dir/$locale.json" ] || { echo "Materialized WebUI is missing WeiG locale shard $locale.json." >&2; return 1; }; done
  binding_found=0
  for binding in "$data"/qb-copy-bindings/*.txt; do [ -f "$binding" ] || continue; grep -Eq '^@@BINDING[[:space:]]+b[0-9a-f]{20}$' "$binding" || { echo "Malformed qB copy binding shard: $binding" >&2; return 1; }; binding_found=1; break; done
  [ "$binding_found" -eq 1 ] || return 1
  [ -d "$translations" ] || { echo "Materialized WebUI is missing the translations directory." >&2; return 1; }
  qm_found=0
  for qm_file in "$translations"/webui_*.qm; do [ -f "$qm_file" ] || continue; qm_found=1; break; done
  [ "$qm_found" -eq 1 ] || { echo "Materialized WebUI is missing official qB WebUI translation QM assets." >&2; return 1; }
}

inject_build_sha() {
  valid_sha "$SOURCE_SHA" || { echo "Unable to resolve a valid 40-character Git SHA for this payload." >&2; exit 1; }
  INJECT_SHA="$SOURCE_SHA" find "$DEST.new" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name 'GIT_SHA' \) -exec sh -c '
    for inject_file do
      inject_tmp="$inject_file.weig.$"
      if ! sed "s/__WEIG_GIT_SHA__/$INJECT_SHA/g" "$inject_file" > "$inject_tmp"; then
        rm -f "$inject_tmp"; exit 1
      fi
      mv "$inject_tmp" "$inject_file" || { rm -f "$inject_tmp"; exit 1; }
    done
  ' sh {} + || { echo "Unable to materialize build identity with portable sed." >&2; exit 1; }
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
      done | head -n 1)
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
    line=$(printf '%s\n' "$lines" | head -n 1)
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
    docker_canonical="$DOCKER_CONFIG_ROOT/weig-qb-webui"
    docker_legacy="$DOCKER_CONFIG_ROOT/weig_qb-webui"
    if [ ! -e "$docker_canonical" ] && [ -d "$docker_legacy" ] && [ -f "$docker_legacy/public/index.html" ] && [ -f "$docker_legacy/private/index.html" ] && [ -f "$docker_legacy/private/weig-install.json" ]; then
      DEST="$docker_legacy"
      QBT_ROOT_FOLDER="/config/weig_qb-webui"
      echo "Using existing legacy Docker install directory: $DEST"
    else
      DEST="$docker_canonical"
      QBT_ROOT_FOLDER="/config/weig-qb-webui"
    fi
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
  cp -p "$cfg" "$backup" 2>/dev/null || cp "$cfg" "$backup"
  cmp -s "$cfg" "$backup" || { echo "qBittorrent safety backup is not byte-identical; refusing mutation." >&2; return 1; }

  cfg_dir=$(dirname "$cfg")
  tmp_cfg=$(portable_mktemp_file "$cfg_dir" ".weig-qb-config") || return 1
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
    cp -p "$backup" "$cfg" 2>/dev/null || cp "$backup" "$cfg"
    echo "Failed to atomically replace qBittorrent config; original restored." >&2
    return 1
  fi
  if ! validate_qb_webui_config_file "$cfg" "$qb_root" 1; then
    cp -p "$backup" "$cfg" 2>/dev/null || cp "$backup" "$cfg"
    echo "qBittorrent config post-write verification failed; original restored." >&2
    return 1
  fi
}

qb_config_has_exact_line() {
  exact_cfg=$1
  exact_expected=$2
  QB_EXPECTED_LINE="$exact_expected" awk '
    {
      line=$0
      sub(/\r$/, "", line)
      if (line == ENVIRON["QB_EXPECTED_LINE"]) found=1
    }
    END { exit found ? 0 : 1 }
  ' "$exact_cfg"
}

disable_qb_webui_file() {
  cfg=$1
  qb_root=$2
  [ -f "$cfg" ] || { echo "qBittorrent config does not exist: $cfg" >&2; return 1; }
  validate_qb_webui_config_file "$cfg" "$qb_root" 0 || return 1
  qb_config_has_exact_line "$cfg" "WebUI\\RootFolder=$qb_root" || { echo "qBittorrent Root Folder does not match the uninstall target; refusing config mutation." >&2; return 1; }

  backup="$cfg.weig.bak"
  cp -p "$cfg" "$backup" 2>/dev/null || cp "$cfg" "$backup"
  cmp -s "$cfg" "$backup" || { echo "qBittorrent safety backup is not byte-identical; refusing mutation." >&2; return 1; }

  cfg_dir=$(dirname "$cfg")
  tmp_cfg=$(portable_mktemp_file "$cfg_dir" ".weig-qb-uninstall") || return 1
  tmp_body="$tmp_cfg.body"
  cleanup_qb_uninstall_tmp() { rm -f "$tmp_cfg" "$tmp_body"; }
  cp -p "$cfg" "$tmp_cfg" 2>/dev/null || cp "$cfg" "$tmp_cfg"

  if ! awk '
    BEGIN { in_preferences=0 }
    {
      raw=$0
      line=raw
      had_cr=sub(/\r$/, "", line)
      if (line ~ /^\[[^]]+\]$/) {
        in_preferences=(line == "[Preferences]")
        print raw
        next
      }
      if (in_preferences && line ~ /^WebUI\\AlternativeUIEnabled=/) {
        print "WebUI\\AlternativeUIEnabled=false" (had_cr ? "\r" : "")
        next
      }
      print raw
    }
  ' "$cfg" > "$tmp_body"; then
    cleanup_qb_uninstall_tmp
    return 1
  fi
  cat "$tmp_body" > "$tmp_cfg"
  rm -f "$tmp_body"

  validate_qb_webui_config_file "$tmp_cfg" "$qb_root" 0 || { cleanup_qb_uninstall_tmp; return 1; }
  qb_config_has_exact_line "$tmp_cfg" "WebUI\\RootFolder=$qb_root" || { cleanup_qb_uninstall_tmp; return 1; }
  qb_config_has_exact_line "$tmp_cfg" "WebUI\\AlternativeUIEnabled=false" || { cleanup_qb_uninstall_tmp; return 1; }

  if ! mv "$tmp_cfg" "$cfg"; then
    cleanup_qb_uninstall_tmp
    cp -p "$backup" "$cfg" 2>/dev/null || cp "$backup" "$cfg"
    echo "Failed to atomically replace qBittorrent config during uninstall; original restored." >&2
    return 1
  fi
  if ! validate_qb_webui_config_file "$cfg" "$qb_root" 0 \
    || ! qb_config_has_exact_line "$cfg" "WebUI\\RootFolder=$qb_root" \
    || ! qb_config_has_exact_line "$cfg" "WebUI\\AlternativeUIEnabled=false"; then
    cp -p "$backup" "$cfg" 2>/dev/null || cp "$backup" "$cfg"
    echo "qBittorrent uninstall config post-write verification failed; original restored." >&2
    return 1
  fi
}


if [ "${WEIG_QB_UNINSTALL_CONFIG_TEST_ONLY:-0}" = "1" ]; then
  [ -n "${WEIG_QB_CONFIG_TEST_PATH:-}" ] && [ -n "${WEIG_QB_CONFIG_TEST_ROOT:-}" ] || {
    echo "WEIG_QB_CONFIG_TEST_PATH and WEIG_QB_CONFIG_TEST_ROOT are required in uninstall config test mode." >&2
    exit 2
  }
  disable_qb_webui_file "$WEIG_QB_CONFIG_TEST_PATH" "$WEIG_QB_CONFIG_TEST_ROOT"
  exit $?
fi

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
        -type f \( -name qBittorrent.conf -o -name qBittorrent.ini \) -print 2>/dev/null | awk -v root="$root" '
          BEGIN { prefix=root "/"; limit=6 }
          index($0,prefix)==1 { rel=substr($0,length(prefix)+1); depth=gsub(/\//,"/",rel)+1; if(depth<=limit){print; exit} }
        ' || true)
    else
      found=$(find "$root" -type f \( -name qBittorrent.conf -o -name qBittorrent.ini \) -print 2>/dev/null | awk -v root="$root" '
        BEGIN { prefix=root "/"; limit=6 }
        index($0,prefix)==1 { rel=substr($0,length(prefix)+1); depth=gsub(/\//,"/",rel)+1; if(depth<=limit){print; exit} }
      ' || true)
    fi
    if [ -n "$found" ] && is_safe_config_path "$found"; then
      printf '%s\n' "$found"
      return 0
    fi
  done
  return 1
}

backup_record_read() {
  backup=$1
  member=$2
  if [ -d "$backup" ]; then
    [ -f "$backup/$member" ] || return 1
    cat "$backup/$member"
    return 0
  fi
  [ -f "$backup" ] || return 1
  case "$backup" in *.tar.gz) ;; *) return 1 ;; esac
  if command -v tar >/dev/null 2>&1; then
    tar -xOzf "$backup" "./$member" 2>/dev/null && return 0
  fi
  if has_busybox_applet tar; then
    busybox tar -xOzf "$backup" "./$member" 2>/dev/null && return 0
  fi
  return 1
}

backup_record_copy() {
  backup=$1
  member=$2
  output=$3
  if [ -d "$backup" ]; then
    [ -f "$backup/$member" ] || return 1
    cp -p "$backup/$member" "$output" 2>/dev/null || cp "$backup/$member" "$output"
    return $?
  fi
  backup_record_read "$backup" "$member" > "$output" || { rm -f "$output"; return 1; }
}

backup_record_unpack() {
  backup=$1
  target=$2
  [ -f "$backup" ] || return 1
  mkdir -p "$target" || return 1
  if command -v tar >/dev/null 2>&1 && tar -xzf "$backup" -C "$target" 2>/dev/null; then return 0; fi
  rm -rf "$target"; mkdir -p "$target"
  if has_busybox_applet tar && busybox tar -xzf "$backup" -C "$target" >/dev/null 2>&1; then return 0; fi
  rm -rf "$target"
  return 1
}

backup_record_pack() {
  record=$1
  output=$2
  tmp="$output.tmp.$$"
  rm -f "$tmp"
  if command -v tar >/dev/null 2>&1 && tar -C "$record" -czf "$tmp" . 2>/dev/null; then mv "$tmp" "$output"; return 0; fi
  rm -f "$tmp"
  if has_busybox_applet tar && busybox tar -C "$record" -czf "$tmp" . >/dev/null 2>&1; then mv "$tmp" "$output"; return 0; fi
  rm -f "$tmp"
  echo "No tar+gzip provider can create the canonical single-file backup bundle." >&2
  return 1
}

reserve_backup_path() {
  stamp=$1
  n=1
  for reserve_root in "$BACKUPS" "$LEGACY_BACKUPS"; do
    [ -d "$reserve_root" ] || continue
    for existing in "$reserve_root/$stamp.tar.gz" "$reserve_root/$stamp-"[0-9][0-9].tar.gz; do
      [ -e "$existing" ] || continue
      existing_name=$(basename "$existing")
      case "$existing_name" in
        "$stamp.tar.gz") existing_n=1 ;;
        "$stamp-"[0-9][0-9].tar.gz)
          existing_suffix=${existing_name#"$stamp-"}
          existing_suffix=${existing_suffix%.tar.gz}
          case "$existing_suffix" in 0?) existing_n=${existing_suffix#0} ;; ??) existing_n=$existing_suffix ;; *) continue ;; esac
          ;;
        *) continue ;;
      esac
      [ "$existing_n" -ge "$n" ] && n=$((existing_n+1))
    done
  done
  while [ "$n" -le 99 ]; do
    if [ "$n" -eq 1 ]; then name="$stamp.tar.gz"; else suffix=$(printf '%02d' "$n"); name="$stamp-$suffix.tar.gz"; fi
    candidate="$BACKUPS/$name"
    lock="$candidate.lock"
    if [ ! -e "$candidate" ] && mkdir "$lock" 2>/dev/null; then
      if [ ! -e "$candidate" ]; then printf '%s\n' "$candidate"; return 0; fi
      rmdir "$lock" 2>/dev/null || true
    fi
    n=$((n+1))
  done
  echo "Unable to reserve a unique backup name for $stamp." >&2
  return 1
}

backup_sort_key() {
  name=$(basename "$1")
  case "$name" in
    ????????-????.tar.gz) printf '%sZ01\n' "${name%.tar.gz}" ;;
    ????????-????-[0-9][0-9].tar.gz)
      stem=${name%.tar.gz}
      suffix=${stem##*-}
      minute=${stem%-*}
      printf '%sZ%s\n' "$minute" "$suffix"
      ;;
    *) printf '%s\n' "$name" ;;
  esac
}

backup_is_owned() {
  backup=$1
  had=$(backup_record_read "$backup" had-webui 2>/dev/null || true)
  dest=$(backup_record_read "$backup" dest-path 2>/dev/null || true)
  [ -n "$dest" ] && { [ "$had" = "0" ] || [ "$had" = "1" ]; }
}

owned_backups_for_dest() {
  target=$1
  for backup_root in "$BACKUPS" "$LEGACY_BACKUPS"; do
    [ -d "$backup_root" ] || continue
    for backup in "$backup_root"/*; do
      [ -e "$backup" ] || continue
      backup_is_owned "$backup" || continue
      saved_dest=$(backup_record_read "$backup" dest-path 2>/dev/null || true)
      [ "$saved_dest" = "$target" ] || continue
      printf '%s|%s\n' "$(backup_sort_key "$backup")" "$backup"
    done
  done | sort -r | sed 's/^[^|]*|//'
}

latest_backup_for_dest() {
  owned_backups_for_dest "$1" | sed -n '1p'
}

prune_backups_for_dest() {
  target=$1
  keep=${2:-$BACKUP_RETENTION}
  [ "$keep" -ge 1 ] || { echo "Backup retention must keep at least one backup." >&2; return 1; }
  count=0
  owned_backups_for_dest "$target" | while IFS= read -r backup; do
    [ -n "$backup" ] || continue
    count=$((count+1))
    if [ "$count" -gt "$keep" ]; then
      rm -rf "$backup"
      echo "Pruned old installer backup: $backup"
    fi
  done
}

purge_backups_for_dest() {
  target=$1
  owned_backups_for_dest "$target" | while IFS= read -r backup; do
    [ -n "$backup" ] || continue
    rm -rf "$backup"
    echo "Purged installer backup: $backup"
  done

  for marker_root in "$STATE" "$LEGACY_STATE"; do
    marker_matches_target=0
    if [ -s "$marker_root/last-dest" ] && [ "$(cat "$marker_root/last-dest" 2>/dev/null || true)" = "$target" ]; then
      marker_matches_target=1
    fi
    if [ -s "$marker_root/last-backup" ]; then
      marker_backup=$(cat "$marker_root/last-backup" 2>/dev/null || true)
      marker_backup_dest=$(backup_record_read "$marker_backup" dest-path 2>/dev/null || true)
      [ "$marker_backup_dest" = "$target" ] && marker_matches_target=1
    fi
    if [ "$marker_matches_target" -eq 1 ]; then
      rm -f "$marker_root/last-backup" "$marker_root/last-dest" "$marker_root/last-qb-root-folder"
    fi
  done
  rmdir "$BACKUPS" 2>/dev/null || true
  rmdir "$LEGACY_BACKUPS" 2>/dev/null || true
  rmdir "$STATE" 2>/dev/null || true
  rmdir "$LEGACY_STATE" 2>/dev/null || true
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

backup_sha256() {
  backup_hash_file=$1
  backup_hash=$(sha256_file "$backup_hash_file") || return 1
  printf '%s\n' "$backup_hash" | tr 'A-F' 'a-f'
}
write_backup_manifest() {
  backup_manifest_root=$1
  backup_manifest_format=$2
  backup_manifest_file=$3
  backup_manifest_tool=$4
  backup_manifest_sha=$5
  backup_manifest_bytes=$6
  cat > "$backup_manifest_root/archive-manifest" <<EOF_ARCHIVE_MANIFEST
schema=1
format=$backup_manifest_format
file=$backup_manifest_file
tool=$backup_manifest_tool
sha256=$backup_manifest_sha
bytes=$backup_manifest_bytes
EOF_ARCHIVE_MANIFEST
}

record_backup_archive() {
  backup_record_root=$1
  backup_record_path=$2
  backup_record_format=$3
  backup_record_tool=$4
  backup_record_sha=$(backup_sha256 "$backup_record_path" 2>/dev/null || true)
  [ -n "$backup_record_sha" ] || return 1
  backup_record_bytes=$(wc -c < "$backup_record_path" | tr -d '[:space:]')
  backup_record_name=$(basename "$backup_record_path")
  write_backup_manifest "$backup_record_root" "$backup_record_format" "$backup_record_name" "$backup_record_tool" "$backup_record_sha" "$backup_record_bytes"
  return 0
}

create_webui_backup_payload() {
  backup_source=$1
  backup_root=$2
  backup_archive="$backup_root/webui.tar.gz"
  if command -v tar >/dev/null 2>&1; then
    rm -f "$backup_archive"
    if tar -C "$backup_source" -czf "$backup_archive" . 2>/dev/null && record_backup_archive "$backup_root" "$backup_archive" "tar.gz" "tar"; then
      echo "Backup payload: compressed tar.gz ($(cat "$backup_root/archive-manifest" | sed -n 's/^bytes=//p') bytes)"
      return 0
    fi
    rm -f "$backup_archive"
  fi

  backup_7z=""
  for backup_tool in 7z 7za; do
    if command -v "$backup_tool" >/dev/null 2>&1; then backup_7z=$backup_tool; break; fi
  done
  if [ -n "$backup_7z" ]; then
    backup_archive="$backup_root/webui.7z"
    rm -f "$backup_archive"
    if (cd "$backup_source" && "$backup_7z" a -bd -y -t7z -mx=5 "$backup_archive" . >/dev/null 2>&1) && record_backup_archive "$backup_root" "$backup_archive" "7z" "$backup_7z"; then
      echo "Backup payload: compressed 7z ($(sed -n 's/^bytes=//p' "$backup_root/archive-manifest") bytes)"
      return 0
    fi
    rm -f "$backup_archive"
  fi

  if command -v zip >/dev/null 2>&1; then
    backup_archive="$backup_root/webui.zip"
    rm -f "$backup_archive"
    if (cd "$backup_source" && zip -qry "$backup_archive" .) && record_backup_archive "$backup_root" "$backup_archive" "zip" "zip"; then
      echo "Backup payload: compressed zip ($(sed -n 's/^bytes=//p' "$backup_root/archive-manifest") bytes)"
      return 0
    fi
    rm -f "$backup_archive"
  fi

  echo "No verified compressed backup backend with SHA-256 support is available; refusing an unverified directory backup." >&2
  return 1
}

backup_manifest_value() {
  backup_manifest_root=$1
  backup_manifest_key=$2
  [ -f "$backup_manifest_root/archive-manifest" ] || return 1
  sed -n "s/^$backup_manifest_key=//p" "$backup_manifest_root/archive-manifest" | sed -n '1p'
}

verify_backup_archive() {
  backup_verify_root=$1
  backup_verify_name=$(backup_manifest_value "$backup_verify_root" file 2>/dev/null || true)
  backup_verify_expected=$(backup_manifest_value "$backup_verify_root" sha256 2>/dev/null || true)
  case "$backup_verify_name" in
    webui.tar.gz|webui.7z|webui.zip) ;;
    *) echo "Backup archive manifest has an unsupported file: $backup_verify_name" >&2; return 1 ;;
  esac
  backup_verify_path="$backup_verify_root/$backup_verify_name"
  [ -f "$backup_verify_path" ] || { echo "Backup archive missing: $backup_verify_path" >&2; return 1; }
  [ -n "$backup_verify_expected" ] || { echo "Backup archive SHA-256 is missing." >&2; return 1; }
  backup_verify_actual=$(backup_sha256 "$backup_verify_path" 2>/dev/null || true)
  [ -n "$backup_verify_actual" ] || { echo "No SHA-256 tool is available to verify the backup archive." >&2; return 1; }
  [ "$backup_verify_actual" = "$backup_verify_expected" ] || { echo "Backup archive checksum mismatch: $backup_verify_path" >&2; return 1; }
  return 0
}

extract_webui_backup_payload() {
  backup_extract_root=$1
  backup_extract_stage=$2

  if [ -f "$backup_extract_root" ]; then
    backup_record_stage=$(portable_mktemp_dir) || return 1
    if ! backup_record_unpack "$backup_extract_root" "$backup_record_stage"; then
      rm -rf "$backup_record_stage"
      echo "Unable to unpack backup bundle: $backup_extract_root" >&2
      return 1
    fi
    if ! extract_webui_backup_payload "$backup_record_stage" "$backup_extract_stage"; then
      rm -rf "$backup_record_stage"
      return 1
    fi
    rm -rf "$backup_record_stage"
    return 0
  fi

  # Bounded legacy reader for backups created before archive payloads existed.
  if [ -d "$backup_extract_root/webui" ]; then
    mkdir -p "$backup_extract_stage" || return 1
    cp -Rp "$backup_extract_root/webui/." "$backup_extract_stage/" || return 1
    return 0
  fi

  backup_extract_format=$(backup_manifest_value "$backup_extract_root" format 2>/dev/null || true)
  verify_backup_archive "$backup_extract_root" || return 1
  backup_extract_name=$(backup_manifest_value "$backup_extract_root" file)
  backup_extract_archive="$backup_extract_root/$backup_extract_name"
  mkdir -p "$backup_extract_stage" || return 1

  case "$backup_extract_format" in
    tar.gz)
      command -v tar >/dev/null 2>&1 || { echo "tar is required to restore this backup." >&2; return 1; }
      tar -xzf "$backup_extract_archive" -C "$backup_extract_stage" || return 1
      ;;
    7z)
      backup_extract_7z=""
      for backup_tool in 7z 7za; do
        if command -v "$backup_tool" >/dev/null 2>&1; then backup_extract_7z=$backup_tool; break; fi
      done
      [ -n "$backup_extract_7z" ] || { echo "7z/7za is required to restore this backup." >&2; return 1; }
      "$backup_extract_7z" x -bd -y "-o$backup_extract_stage" "$backup_extract_archive" >/dev/null || return 1
      ;;
    zip)
      command -v unzip >/dev/null 2>&1 || { echo "unzip is required to restore this backup." >&2; return 1; }
      unzip -q "$backup_extract_archive" -d "$backup_extract_stage" || return 1
      ;;
    *)
      echo "Unsupported backup archive format: $backup_extract_format" >&2
      return 1
      ;;
  esac

  backup_extract_probe=$(find "$backup_extract_stage" ! -path "$backup_extract_stage" -print 2>/dev/null | sed -n '1p' || true)
  [ -n "$backup_extract_probe" ] || { echo "Backup archive extracted no WebUI files." >&2; return 1; }
  return 0
}

backup_target() {
  dest=$1
  index=$2
  qb_root=$3
  b=$(reserve_backup_path "$BACKUP_STAMP") || return 1
  lock="$b.lock"
  record=$(portable_mktemp_dir) || { rmdir "$lock" 2>/dev/null || true; return 1; }

  if [ -e "$dest" ] && [ ! -d "$dest" ]; then
    echo "Install target exists but is not a directory: $dest" >&2
    rm -rf "$record"
    rmdir "$lock" 2>/dev/null || true
    return 1
  fi
  if [ -d "$dest" ]; then
    create_webui_backup_payload "$dest" "$record" || { rm -rf "$record"; rmdir "$lock" 2>/dev/null || true; echo "Unable to create a verified WebUI backup payload." >&2; return 1; }
    printf '1\n' > "$record/had-webui"
  else
    write_backup_manifest "$record" "none" "" "none" "" "0"
    printf '0\n' > "$record/had-webui"
  fi

  cfg=""
  if [ "$CONFIGURE" -eq 1 ] && [ "$TARGET_COUNT" -eq 1 ]; then
    cfg=$(find_config || true)
  fi
  if [ -n "$cfg" ]; then
    cp -p "$cfg" "$record/qBittorrent.conf" 2>/dev/null || cp "$cfg" "$record/qBittorrent.conf"
    printf '%s\n' "$cfg" > "$record/config-path"
  fi

  printf '%s\n' "$dest" > "$record/dest-path"
  printf '%s\n' "$qb_root" > "$record/qb-root-folder"
  if ! backup_record_pack "$record" "$b"; then
    rm -rf "$record"
    rm -f "$b"
    rmdir "$lock" 2>/dev/null || true
    return 1
  fi
  rm -rf "$record"
  rmdir "$lock" 2>/dev/null || true
  backup_is_owned "$b" || { rm -f "$b"; echo "Backup bundle verification failed: $b" >&2; return 1; }

  printf '%s\n' "$b" > "$STATE/last-backup"
  printf '%s\n' "$dest" > "$STATE/last-dest"
  printf '%s\n' "$qb_root" > "$STATE/last-qb-root-folder"
  printf '%s|%s\n' "$dest" "$b" >> "$BACKUP_MAP_FILE"
  echo "Backup: $b"
}

deploy_staged_webui() {
  deploy_dest=$1
  deploy_stage=$2

  [ -d "$deploy_stage" ] || { echo "Prepared WebUI stage is missing: $deploy_stage" >&2; return 1; }
  for deploy_required in public/index.html public/login.html private/index.html VERSION GIT_SHA private/weig-install.json; do
    [ -f "$deploy_stage/$deploy_required" ] || { echo "Prepared WebUI stage is missing $deploy_required." >&2; return 1; }
  done
  if find "$deploy_stage" -type l -print 2>/dev/null | sed -n '1p' | grep -q .; then
    echo "Prepared WebUI stage contains a symlink; refusing a qBittorrent Alternative WebUI deployment." >&2
    return 1
  fi

  if [ ! -e "$deploy_dest" ]; then
    mv "$deploy_stage" "$deploy_dest" || { echo "Unable to install prepared WebUI: $deploy_dest" >&2; return 1; }
    return 0
  fi
  [ -d "$deploy_dest" ] || { echo "Install target exists but is not a directory: $deploy_dest" >&2; return 1; }
  [ -f "$deploy_dest/public/index.html" ] && [ -f "$deploy_dest/private/index.html" ] || {
    echo "Existing WeiG WebUI is missing a live index entry; refusing an in-place update." >&2
    return 1
  }

  deploy_expected_version=$(tr -d '\r\n' < "$deploy_stage/VERSION") || return 1
  deploy_expected_sha=$(tr -d '\r\n' < "$deploy_stage/GIT_SHA") || return 1

  DEPLOY_STAGE="$deploy_stage" DEPLOY_DEST="$deploy_dest" find "$deploy_stage" -type d -exec sh -c '
    for deploy_dir do
      [ "$deploy_dir" = "$DEPLOY_STAGE" ] && continue
      deploy_rel=${deploy_dir#"$DEPLOY_STAGE"/}
      mkdir -p "$DEPLOY_DEST/$deploy_rel" || exit 1
    done
  ' sh {} + || return 1

  DEPLOY_STAGE="$deploy_stage" DEPLOY_DEST="$deploy_dest" find "$deploy_stage" -type f -exec sh -c '
    for deploy_src do
      deploy_rel=${deploy_src#"$DEPLOY_STAGE"/}
      deploy_dst="$DEPLOY_DEST/$deploy_rel"
      deploy_parent=$(dirname "$deploy_dst")
      mkdir -p "$deploy_parent" || exit 1
      if [ -e "$deploy_dst" ] && [ ! -f "$deploy_dst" ] && [ ! -L "$deploy_dst" ]; then
        echo "Live WebUI path type collision: $deploy_dst" >&2
        exit 1
      fi
      deploy_tmp="$deploy_parent/.weig-stage-$"
      while [ -e "$deploy_tmp" ]; do deploy_tmp="$deploy_tmp.x"; done
      cp -p "$deploy_src" "$deploy_tmp" || { rm -f "$deploy_tmp"; exit 1; }
      mv -f "$deploy_tmp" "$deploy_dst" || { rm -f "$deploy_tmp"; exit 1; }
    done
  ' sh {} + || return 1

  DEPLOY_STAGE="$deploy_stage" DEPLOY_DEST="$deploy_dest" find "$deploy_dest" \( -type f -o -type l \) -exec sh -c '
    for deploy_path do
      deploy_rel=${deploy_path#"$DEPLOY_DEST"/}
      [ -f "$DEPLOY_STAGE/$deploy_rel" ] && continue
      rm -f "$deploy_path" || exit 1
    done
  ' sh {} + || return 1

  DEPLOY_STAGE="$deploy_stage" DEPLOY_DEST="$deploy_dest" find "$deploy_dest" -depth -type d -exec sh -c '
    for deploy_dir do
      [ "$deploy_dir" = "$DEPLOY_DEST" ] && continue
      deploy_rel=${deploy_dir#"$DEPLOY_DEST"/}
      [ -d "$DEPLOY_STAGE/$deploy_rel" ] && continue
      rmdir "$deploy_dir" 2>/dev/null || true
    done
  ' sh {} + || return 1

  deploy_actual_version=$(tr -d '\r\n' < "$deploy_dest/VERSION" 2>/dev/null || true)
  deploy_actual_sha=$(tr -d '\r\n' < "$deploy_dest/GIT_SHA" 2>/dev/null || true)
  if [ "$deploy_actual_version" != "$deploy_expected_version" ] || [ "$deploy_actual_sha" != "$deploy_expected_sha" ]; then
    echo "Live WebUI identity verification failed after deployment: expected VERSION=$deploy_expected_version GIT_SHA=$deploy_expected_sha, got VERSION=$deploy_actual_version GIT_SHA=$deploy_actual_sha" >&2
    return 1
  fi

  rm -rf "$deploy_stage"
  [ -f "$deploy_dest/public/index.html" ] && [ -f "$deploy_dest/public/login.html" ] && [ -f "$deploy_dest/private/index.html" ] || {
    echo "Live WebUI verification failed after deployment: $deploy_dest" >&2
    return 1
  }
  return 0
}

restore_webui_from_backup() {
  dest=$1
  b=$2
  had_webui=$(backup_record_read "$b" had-webui 2>/dev/null || true)
  case "$had_webui" in 0|1) ;; *) echo "Backup had-webui marker is missing or invalid: $b" >&2; return 1 ;; esac

  if [ "$had_webui" = "1" ]; then
    restore_parent=$(dirname "$dest")
    mkdir -p "$restore_parent" || return 1
    restore_stage="$dest.weig-restore.$$"
    [ ! -e "$restore_stage" ] || { echo "Restore staging path already exists: $restore_stage" >&2; return 1; }
    if ! extract_webui_backup_payload "$b" "$restore_stage"; then
      rm -rf "$restore_stage"
      return 1
    fi
    if ! deploy_staged_webui "$dest" "$restore_stage"; then
      rm -rf "$restore_stage"
      echo "Unable to restore verified backup into the live WebUI: $dest" >&2
      return 1
    fi
    echo "Restored previous WebUI: $dest"
  else
    rm -rf "$dest"
    echo "Removed WeiG qB WebUI from: $dest"
  fi
}

restore_full_backup() {
  dest=$1
  b=$2
  cfg_tmp=""
  if [ "$CONFIGURE" -eq 1 ]; then
    cfg=$(backup_record_read "$b" config-path 2>/dev/null || true)
    [ -n "$cfg" ] || { echo "This backup has no qBittorrent config snapshot; refusing -rollback -configure." >&2; return 1; }
    is_safe_config_path "$cfg" || { echo "Backup qBittorrent config path is unsafe: $cfg" >&2; return 1; }
    cfg_tmp=$(portable_mktemp_file "$TMP" "rollback-qb-config") || return 1
    backup_record_copy "$b" qBittorrent.conf "$cfg_tmp" || { rm -f "$cfg_tmp"; echo "This backup has no qBittorrent config snapshot; refusing -rollback -configure." >&2; return 1; }
  fi

  restore_webui_from_backup "$dest" "$b" || { [ -n "$cfg_tmp" ] && rm -f "$cfg_tmp"; return 1; }

  if [ "$CONFIGURE" -eq 1 ]; then
    mkdir -p "$(dirname "$cfg")"
    cp -p "$cfg_tmp" "$cfg" 2>/dev/null || cp "$cfg_tmp" "$cfg"
    rm -f "$cfg_tmp"
    echo "Restored qBittorrent WebUI config by explicit -configure: $cfg"
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
    b=$(state_marker_value last-backup 2>/dev/null || true)
    [ -n "$b" ] || { echo "No backup found." >&2; return 1; }
    backup_is_owned "$b" || { echo "Backup record missing or invalid: $b" >&2; return 1; }
    target=$(backup_record_read "$b" dest-path 2>/dev/null || true)
    [ -n "$target" ] || { echo "Backup destination metadata missing: $b" >&2; return 1; }
    printf '%s|%s\n' "$target" "$b" >> "$plan"
  fi
  while IFS='|' read -r target b; do
    [ -n "$target" ] || continue
    restore_full_backup "$target" "$b" || return 1
  done < "$plan"
}

TMP=$(portable_mktemp_dir) || exit 1
trap 'rm -rf "$TMP"' EXIT INT TERM

if [ "$MODE" = "uninstall" ]; then
  BACKUP_MAP_FILE="$TMP/backup-map"
  : > "$BACKUP_MAP_FILE"
  BACKUP_STAMP=$(date '+%Y%m%d-%H%M')
  index=0
  while IFS= read -r target; do
    [ -n "$target" ] || continue
    case "$target" in ""|"/") echo "Refusing unsafe uninstall target." >&2; exit 1 ;; esac
    [ -d "$target" ] && [ -f "$target/public/index.html" ] && [ -f "$target/private/index.html" ] && [ -f "$target/VERSION" ] && [ -f "$target/GIT_SHA" ] && [ -f "$target/private/weig-install.json" ] || {
      echo "Refusing to uninstall a directory that is not an installer-owned WeiG qB WebUI: $target" >&2
      exit 1
    }
    index=$((index+1))
    backup_target "$target" "$index" "$(qb_root_for_target "$target")" || exit 1
  done <<EOF_UNINSTALL_TARGETS
$TARGETS
EOF_UNINSTALL_TARGETS

  if [ "$CONFIGURE" -eq 1 ]; then
    [ "$TARGET_COUNT" -le 1 ] || { echo "-uninstall -configure supports one target at a time." >&2; exit 2; }
    cfg=$(find_config || true)
    [ -n "$cfg" ] || { echo "No unambiguous qBittorrent config was found; uninstall stopped before deleting files." >&2; exit 1; }
    disable_qb_webui_file "$cfg" "$QBT_ROOT_FOLDER" || exit 1
    echo "Disabled qBittorrent Alternative WebUI: $cfg"
  fi

  while IFS= read -r target; do
    [ -n "$target" ] || continue
    rm -rf "$target"
    [ ! -e "$target" ] || { echo "Failed to remove WeiG qB WebUI: $target" >&2; exit 1; }
    echo "Uninstalled WeiG qB WebUI: $target"
  done <<EOF_UNINSTALL_REMOVE
$TARGETS
EOF_UNINSTALL_REMOVE
  if [ "$PURGE_BACKUPS" -eq 1 ]; then
    while IFS= read -r target; do
      [ -n "$target" ] || continue
      purge_backups_for_dest "$target"
    done <<EOF_UNINSTALL_PURGE
$TARGETS
EOF_UNINSTALL_PURGE
    echo "Installer backups for the uninstalled target(s) were purged; installer rollback is no longer available for them."
  else
    while IFS= read -r target; do
      [ -n "$target" ] || continue
      prune_backups_for_dest "$target" "$BACKUP_RETENTION" || exit 1
    done <<EOF_UNINSTALL_RETENTION
$TARGETS
EOF_UNINSTALL_RETENTION
    echo "Rollback is available with: sh $0 -rollback"
  fi
  exit 0
fi

if [ "$MODE" = "rollback" ]; then
  rollback
  exit $?
fi

if [ "$TARGET_COUNT" -eq 1 ] && [ "$DEST" != "$REQUESTED_DEST" ]; then
  echo "Host install path: $DEST"
  echo "qBittorrent Root Folder: $QBT_ROOT_FOLDER"
fi

PACKAGE=""
PACKAGE_NAME=""
SRC=""

if [ "$CHANNEL" = "main" ]; then
  REQUESTED_RELEASE_VERSION="$RELEASE_VERSION"
  REQUESTED_RELEASE_TAG="$RELEASE_TAG"
  RELEASE_META="$TMP/release.json"
  if [ -n "$REQUESTED_RELEASE_VERSION" ]; then RELEASE_META_URL="https://api.github.com/repos/$REPO/releases/tags/$REQUESTED_RELEASE_TAG"; else RELEASE_META_URL="https://api.github.com/repos/$REPO/releases/latest"; fi
  download_file "$RELEASE_META_URL" "$RELEASE_META" || { if [ -n "$REQUESTED_RELEASE_VERSION" ]; then echo "Release $REQUESTED_RELEASE_TAG was not found. Refusing to fall back to latest or dev." >&2; else echo "No published stable GitHub Release is available. Release installation will not fall back to a branch archive." >&2; fi; exit 1; }
  RESOLVED_RELEASE_TAG=$(sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$RELEASE_META" | head -n 1)
  printf '%s' "$RESOLVED_RELEASE_TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' || { echo "GitHub Release metadata returned an invalid tag: ${RESOLVED_RELEASE_TAG:-<empty>}." >&2; exit 1; }
  [ -z "$REQUESTED_RELEASE_TAG" ] || [ "$RESOLVED_RELEASE_TAG" = "$REQUESTED_RELEASE_TAG" ] || { echo "Requested $REQUESTED_RELEASE_TAG but GitHub Release metadata resolved $RESOLVED_RELEASE_TAG; refusing mismatched Release identity." >&2; exit 1; }
  RESOLVED_RELEASE_VERSION=${RESOLVED_RELEASE_TAG#v}
  RELEASE_COMMIT_META="$TMP/release-commit.json"
  download_file "https://api.github.com/repos/$REPO/commits/$RESOLVED_RELEASE_TAG" "$RELEASE_COMMIT_META" || { echo "Unable to resolve commit identity for Release $RESOLVED_RELEASE_TAG." >&2; exit 1; }
  RELEASE_EXPECTED_SHA=$(sed -n 's/^[[:space:]]*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' "$RELEASE_COMMIT_META" | head -n 1 | tr 'A-F' 'a-f')
  valid_sha "$RELEASE_EXPECTED_SHA" || { echo "Release $RESOLVED_RELEASE_TAG did not resolve to a valid commit SHA." >&2; exit 1; }
  RELEASE_TAG="$RESOLVED_RELEASE_TAG"; RELEASE_VERSION="$RESOLVED_RELEASE_VERSION"; RELEASE_BASE="https://github.com/$REPO/releases/download/$RELEASE_TAG"; RELEASE_LABEL="Release $RELEASE_TAG"
  download_file "$RELEASE_BASE/SHA256SUMS" "$TMP/SHA256SUMS" || { echo "$RELEASE_LABEL is missing SHA256SUMS; refusing an unverified installation." >&2; exit 1; }
  [ -s "$TMP/SHA256SUMS" ] || { echo "SHA256SUMS is empty; refusing installation." >&2; exit 1; }
  if download_file "$RELEASE_BASE/manifest.json" "$TMP/manifest.json"; then
    verify_release_checksum "$TMP/SHA256SUMS" "$TMP/manifest.json" "manifest.json" || exit 1
    prepare_manifest_dist "$RELEASE_BASE" "$TMP/manifest.json" "$TMP/SHA256SUMS" "$TMP/release" || exit 1
  else
    PACKAGE_NAME="WeiG-qB-WebUI.zip"; PACKAGE="$TMP/$PACKAGE_NAME"
    download_file "$RELEASE_BASE/$PACKAGE_NAME" "$PACKAGE" || { echo "$RELEASE_LABEL has neither the canonical manifest artifact set nor legacy $PACKAGE_NAME." >&2; exit 1; }
    verify_release_checksum "$TMP/SHA256SUMS" "$PACKAGE" "$PACKAGE_NAME" || exit 1
    extract_zip "$PACKAGE" "$TMP/release"
    SRC="$TMP/release/WeiG-qB-WebUI"
    [ -d "$SRC" ] || { echo "Legacy Release archive does not contain WeiG-qB-WebUI." >&2; exit 1; }
  fi
  SOURCE_SHA=$(cat "$SRC/GIT_SHA" 2>/dev/null | tr -d '\r\n' | tr 'A-F' 'a-f' || true)
  valid_sha "$SOURCE_SHA" || { echo "$RELEASE_LABEL does not contain a valid GIT_SHA; refusing an unversioned asset deployment." >&2; exit 1; }
  PACKAGE_VERSION=$(cat "$SRC/VERSION" 2>/dev/null | tr -d '\r\n' || true)
  [ "$PACKAGE_VERSION" = "$RELEASE_VERSION" ] || { echo "$RELEASE_LABEL maps to VERSION=$RELEASE_VERSION but the package reports VERSION=$PACKAGE_VERSION; refusing mismatched Release content." >&2; exit 1; }
  [ "$SOURCE_SHA" = "$RELEASE_EXPECTED_SHA" ] || { echo "$RELEASE_LABEL points to Git SHA $RELEASE_EXPECTED_SHA but the package reports GIT_SHA=$SOURCE_SHA; refusing mismatched Release content." >&2; exit 1; }
  echo "Source: $RELEASE_LABEL at $RELEASE_EXPECTED_SHA ($PACKAGE_NAME; checksum and Release identity verified)"
else
  DEV_META="$TMP/dev-commit.json"
  download_file "https://api.github.com/repos/$REPO/commits/dev" "$DEV_META" || { echo "Unable to resolve the current dev commit." >&2; exit 1; }
  DEV_HEAD_SHA=$(sed -n 's/^[[:space:]]*"sha":[[:space:]]*"\([0-9a-fA-F]\{40\}\)".*/\1/p' "$DEV_META" | head -n 1)
  valid_sha "$DEV_HEAD_SHA" || { echo "GitHub did not return a valid dev commit SHA." >&2; exit 1; }
  PUBLISHED_SHA_FILE="$TMP/DEV_GIT_SHA"
  download_file "$DEV_DIST_BASE/GIT_SHA" "$PUBLISHED_SHA_FILE" || { echo "The materialized dev WebUI payload is not published yet. Wait for Virtual qB Pages to finish and retry." >&2; exit 1; }
  PUBLISHED_SHA=$(tr -d '\r\n' < "$PUBLISHED_SHA_FILE"); valid_sha "$PUBLISHED_SHA" || { echo "The materialized dev payload does not publish a valid GIT_SHA." >&2; exit 1; }
  SOURCE_SHA="$PUBLISHED_SHA"
  if [ "$PUBLISHED_SHA" != "$DEV_HEAD_SHA" ]; then
    if dev_payload_can_represent_head "$PUBLISHED_SHA" "$DEV_HEAD_SHA" "$TMP/dev-compare.json"; then echo "Current dev HEAD $DEV_HEAD_SHA differs from materialized SHA $PUBLISHED_SHA only by Pages-irrelevant changes; reusing the verified payload."; else echo "The materialized dev payload is still at $PUBLISHED_SHA while dev is $DEV_HEAD_SHA, and at least one Pages-relevant change is not published. Wait for the exact Pages build and retry; refusing raw-source fallback." >&2; exit 1; fi
  fi
  download_file "$DEV_DIST_BASE/manifest.json" "$TMP/manifest.json" || { echo "Materialized dev payload is missing manifest.json; refusing legacy/raw fallback." >&2; exit 1; }
  download_file "$DEV_DIST_BASE/SHA256SUMS" "$TMP/SHA256SUMS" || { echo "Materialized dev payload is missing SHA256SUMS; refusing installation." >&2; exit 1; }
  verify_release_checksum "$TMP/SHA256SUMS" "$TMP/manifest.json" "manifest.json" || exit 1
  prepare_manifest_dist "$DEV_DIST_BASE" "$TMP/manifest.json" "$TMP/SHA256SUMS" "$TMP/dev" || exit 1
  PACKAGE_SHA=$(tr -d '\r\n' < "$SRC/GIT_SHA" 2>/dev/null || true)
  [ "$PACKAGE_SHA" = "$SOURCE_SHA" ] || { echo "Dev package Git SHA $PACKAGE_SHA does not match materialized dev SHA $SOURCE_SHA." >&2; exit 1; }
  assert_materialized_webui "$SRC" || exit 1
  if [ "$SOURCE_SHA" = "$DEV_HEAD_SHA" ]; then echo "Source: dev exact SHA $SOURCE_SHA ($PACKAGE_NAME; materialized Pages payload; checksum verified)"; else echo "Source: dev materialized SHA $SOURCE_SHA for current HEAD $DEV_HEAD_SHA ($PACKAGE_NAME; only Pages-irrelevant changes are newer; checksum verified)"; fi
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
  cp -Rp "$SRC"/. "$DEST.new"/
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

BACKUP_STAMP=$(date '+%Y%m%d-%H%M')
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
  if deploy_staged_webui "$target" "$new"; then
    printf '%s|%s\n' "$target" "$b" >> "$SWITCHED_FILE"
    echo "Installed and verified: $target"
    echo "  Channel: $CHANNEL"
    echo "  Version: $(cat "$target/VERSION")"
    echo "  Git SHA: $(cat "$target/GIT_SHA")"
    echo "  Metadata: $target/private/weig-install.json"
  else
    echo "Live WebUI deployment failed: $target" >&2
    restore_webui_from_backup "$target" "$b" || true
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

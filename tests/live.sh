#!/bin/sh
set -eu

REPO="weigefenxiang/WeiG-qB-WebUI"
SHA=""
TARGETS=""
BACKUP_RETENTION=3

usage() {
  cat <<'EOF'
Usage:
  sh tests/live.sh --sha <40-char-git-sha> --target <installed-webui-dir> [--target <installed-webui-dir> ...]

Each --target must point to an existing WeiG Alternate WebUI installation directory.
The script downloads and deploys exactly the requested Git SHA, reads the candidate VERSION from that SHA, and never encodes a WeiG release version in its own filename or deployment paths.
It never contains deployment-specific qB URLs, host paths, credentials or container names.
It replaces only Alternate WebUI files and does NOT restart Docker or qBittorrent.
After a successful switch it keeps only the three newest sibling rollback backups, including historical before-* and ui-backup-* names.
EOF
}

append_target() {
  if [ -z "$TARGETS" ]; then TARGETS="$1"; else TARGETS="$TARGETS
$1"; fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --sha) SHA="${2:-}"; shift 2 ;;
    --target) append_target "${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

printf '%s' "$SHA" | grep -Eq '^[0-9a-fA-F]{40}$' || { echo "ERROR: --sha must be exactly 40 hexadecimal characters." >&2; exit 2; }
[ -n "$TARGETS" ] || { echo "ERROR: at least one --target is required." >&2; usage >&2; exit 2; }

TMP="$(mktemp -d)"
STAMP="$(date +%Y%m%d-%H%M%S)"
NOW="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
TARGET_FILE="$TMP/targets"
PREPARED_FILE="$TMP/prepared"
SWITCHED_FILE="$TMP/switched"
trap 'rm -rf "$TMP"' EXIT INT TERM
printf '%s\n' "$TARGETS" > "$TARGET_FILE"
: > "$PREPARED_FILE"
: > "$SWITCHED_FILE"

echo "==> Download exact WeiG qB WebUI candidate"
echo "SHA: $SHA"
curl -fL "https://github.com/${REPO}/archive/${SHA}.tar.gz" -o "$TMP/source.tar.gz"
mkdir -p "$TMP/source"
tar -xzf "$TMP/source.tar.gz" -C "$TMP/source"
SRC="$(find "$TMP/source" -mindepth 2 -maxdepth 3 -type d -name webui | head -n1)"
[ -n "$SRC" ] && [ -f "$SRC/private/index.html" ] && [ -f "$SRC/public/index.html" ] && [ -f "$SRC/public/login.html" ] && [ -f "$SRC/VERSION" ] || { echo "ERROR: downloaded archive does not contain a complete qBittorrent Alternate WebUI payload" >&2; exit 1; }
VERSION="$(tr -d '\r\n ' < "$SRC/VERSION")"
printf '%s' "$VERSION" | grep -Eq '^[0-9]+([.][0-9]+){2}([+-][0-9A-Za-z.-]+)?$' || { echo "ERROR: candidate VERSION is invalid: $VERSION" >&2; exit 1; }
echo "VERSION: $VERSION"

update_metadata() {
  file="$1"
  [ -f "$file" ] || return 0
  sed -i -E \
    -e "s#(\"version\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")#\1${VERSION}\2#" \
    -e "s#(\"gitSha\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")#\1${SHA}\2#" \
    -e "s#(\"installedAt\"[[:space:]]*:[[:space:]]*\")[^\"]*(\")#\1${NOW}\2#" \
    -e 's#("installer"[[:space:]]*:[[:space:]]*")[^"]*(")#\1live-test\2#' \
    "$file"
}

prune_target_backups() {
  dest="$1"
  parent=$(dirname "$dest")
  base=$(basename "$dest")
  candidates=$(ls -1dt "$parent/$base".before-* "$parent/$base".ui-backup-* 2>/dev/null || true)
  [ -n "$candidates" ] || return 0
  first=$((BACKUP_RETENTION + 1))
  old=$(printf '%s\n' "$candidates" | sed -n "${first},\$p")
  [ -n "$old" ] || return 0
  printf '%s\n' "$old" | while IFS= read -r path; do
    [ -n "$path" ] || continue
    [ -d "$path" ] || continue
    rm -rf -- "$path"
    echo "PRUNE: removed old backup $path"
  done
}

prepare_target() {
  dest="$1"
  [ -n "$dest" ] || return 0
  [ -d "$dest" ] || { echo "ERROR: install directory not found: $dest" >&2; return 1; }
  [ -f "$dest/private/index.html" ] || { echo "ERROR: not a WeiG WebUI install: $dest" >&2; return 1; }
  new="${dest}.new-live-$$"
  backup="${dest}.before-live-${STAMP}"
  [ ! -e "$backup" ] || { echo "ERROR: backup already exists: $backup" >&2; return 1; }
  rm -rf "$new"
  cp -a "$SRC" "$new"
  find "$new" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name 'GIT_SHA' \) -exec sed -i "s/__WEIGG_GIT_SHA__/${SHA}/g" {} +
  printf '%s\n' "$SHA" > "$new/GIT_SHA"
  if [ -f "$dest/private/weigg-install.json" ]; then
    cp -f "$dest/private/weigg-install.json" "$new/private/weigg-install.json"
  fi
  update_metadata "$new/private/weigg-install.json"
  [ "$(tr -d '\r\n ' < "$new/VERSION")" = "$VERSION" ] || { rm -rf "$new"; echo "ERROR: staged VERSION invalid: $dest" >&2; return 1; }
  [ "$(tr -d '\r\n ' < "$new/GIT_SHA")" = "$SHA" ] || { rm -rf "$new"; echo "ERROR: staged SHA invalid: $dest" >&2; return 1; }
  [ -f "$new/public/index.html" ] && [ -f "$new/public/login.html" ] && [ -f "$new/private/index.html" ] || { rm -rf "$new"; echo "ERROR: staged Alternate WebUI entry points are incomplete: $dest" >&2; return 1; }
  if grep -R '__WEIGG_GIT_SHA__' "$new/private" "$new/public" >/dev/null 2>&1; then
    rm -rf "$new"; echo "ERROR: unresolved Git SHA placeholder: $dest" >&2; return 1
  fi
  printf '%s|%s|%s\n' "$dest" "$new" "$backup" >> "$PREPARED_FILE"
  echo "READY: $dest"
}

rollback_switched() {
  [ -s "$SWITCHED_FILE" ] || return 0
  echo "==> Rolling back already-switched targets" >&2
  while IFS='|' read -r dest backup; do
    [ -n "$dest" ] || continue
    rm -rf "$dest"
    [ -d "$backup" ] && mv "$backup" "$dest"
  done < "$SWITCHED_FILE"
}

while IFS= read -r dest; do
  [ -n "$dest" ] || continue
  prepare_target "$dest" || exit 1
done < "$TARGET_FILE"

while IFS='|' read -r dest new backup; do
  [ -n "$dest" ] || continue
  mv "$dest" "$backup"
  if mv "$new" "$dest"; then
    printf '%s|%s\n' "$dest" "$backup" >> "$SWITCHED_FILE"
    echo "PASS: switched $dest"
  else
    echo "ERROR: switch failed: $dest" >&2
    [ -d "$backup" ] && mv "$backup" "$dest"
    rollback_switched
    exit 1
  fi
done < "$PREPARED_FILE"

while IFS='|' read -r dest backup; do
  [ -n "$dest" ] || continue
  prune_target_backups "$dest"
done < "$SWITCHED_FILE"

echo
echo "========== LIVE TEST READY =========="
while IFS='|' read -r dest backup; do
  [ -n "$dest" ] || continue
  echo "Target:  $dest"
  echo "  VERSION: $(cat "$dest/VERSION")"
  echo "  SHA:     $(cat "$dest/GIT_SHA")"
  echo "  backup:  $backup"
done < "$SWITCHED_FILE"
echo "Backup retention: latest $BACKUP_RETENTION"
echo "Docker/qB restart: NOT REQUIRED"
echo "Browser: hard refresh once after deployment"
echo
echo "Rollback commands:"
while IFS='|' read -r dest backup; do
  [ -n "$dest" ] || continue
  printf "  rm -rf '%s' && mv '%s' '%s'\n" "$dest" "$backup" "$dest"
done < "$SWITCHED_FILE"
echo "====================================="

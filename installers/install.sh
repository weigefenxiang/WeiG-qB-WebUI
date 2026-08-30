#!/usr/bin/env sh
set -eu
REPO="weigefenxiang/WeiG-qB-WebUI"
DEFAULT_DEST="${HOME}/.local/share/weigg-qb-webui"
DEST="${WEIGG_QB_WEBUI_DIR:-$DEFAULT_DEST}"
MODE="install"
CONFIGURE=0
for arg in "$@"; do
  case "$arg" in
    --update) MODE="update" ;;
    --rollback) MODE="rollback" ;;
    --configure) CONFIGURE=1 ;;
    --dir=*) DEST=${arg#--dir=} ;;
    -h|--help) echo "Usage: install.sh [--update|--rollback] [--configure] [--dir=/path/to/webui]"; exit 0 ;;
  esac
done
STATE="${HOME}/.config/weigg-qb-webui"
BACKUPS="$STATE/backups"
mkdir -p "$BACKUPS"
find_config(){
  for f in \
    "${XDG_CONFIG_HOME:-$HOME/.config}/qBittorrent/qBittorrent.conf" \
    "$HOME/.config/qBittorrent/qBittorrent.conf" \
    "$HOME/.config/qBittorrent/qBittorrent.ini" \
    "/config/qBittorrent/qBittorrent.conf" \
    "/config/qBittorrent/qBittorrent.ini" \
    "/config/qbittorrent/qBittorrent.conf" \
    "/etc/qBittorrent/qBittorrent.conf" \
    "/var/lib/qbittorrent/.config/qBittorrent/qBittorrent.conf"; do
    [ -f "$f" ] && { printf '%s\n' "$f"; return 0; }
  done
  for root in /config /home /var/lib; do
    [ -d "$root" ] || continue
    found=$(find "$root" -maxdepth 6 -type f \( -name qBittorrent.conf -o -name qBittorrent.ini \) 2>/dev/null | head -n1 || true)
    [ -n "$found" ] && { printf '%s\n' "$found"; return 0; }
  done
  return 1
}
backup_now(){
  stamp=$(date '+%Y%m%d-%H%M%S'); b="$BACKUPS/$stamp"; mkdir -p "$b"
  [ -d "$DEST" ] && cp -a "$DEST" "$b/webui"
  cfg=$(find_config || true); [ -n "$cfg" ] && cp -a "$cfg" "$b/qBittorrent.conf"
  printf '%s\n' "$b" > "$STATE/last-backup"; echo "Backup: $b"
}
rollback(){
  [ -f "$STATE/last-backup" ] || { echo "No backup found." >&2; exit 1; }
  b=$(cat "$STATE/last-backup"); [ -d "$b/webui" ] || { echo "Backup webui missing: $b" >&2; exit 1; }
  rm -rf "$DEST"; mkdir -p "$(dirname "$DEST")"; cp -a "$b/webui" "$DEST"
  cfg=$(find_config || true); [ -n "$cfg" ] && [ -f "$b/qBittorrent.conf" ] && cp -a "$b/qBittorrent.conf" "$cfg"
  echo "Rolled back to: $b"; exit 0
}
[ "$MODE" = rollback ] && rollback
command -v unzip >/dev/null 2>&1 || { echo "unzip is required." >&2; exit 1; }
backup_now
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT INT TERM
PACKAGE="$TMP/WeiG-qB-WebUI.zip"
RELEASE_URL="https://github.com/$REPO/releases/latest/download/WeiG-qB-WebUI.zip"
SUM_URL="https://github.com/$REPO/releases/latest/download/SHA256SUMS"
release_ok=0
if command -v curl >/dev/null 2>&1; then
  if curl -fsSL "$RELEASE_URL" -o "$PACKAGE"; then release_ok=1; fi
elif command -v wget >/dev/null 2>&1; then
  if wget -q "$RELEASE_URL" -O "$PACKAGE"; then release_ok=1; fi
else
  echo "curl or wget is required." >&2; exit 1
fi
if [ "$release_ok" -eq 1 ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    if command -v curl >/dev/null 2>&1; then curl -fsSL "$SUM_URL" -o "$TMP/SHA256SUMS" || true; else wget -q "$SUM_URL" -O "$TMP/SHA256SUMS" || true; fi
    if [ -s "$TMP/SHA256SUMS" ]; then (cd "$TMP" && sha256sum -c SHA256SUMS); fi
  fi
  unzip -q "$PACKAGE" -d "$TMP/release"
  SRC="$TMP/release/WeiG-qB-WebUI"
else
  ARCHIVE="$TMP/source.zip"
  if command -v curl >/dev/null 2>&1; then curl -fsSL "https://github.com/$REPO/archive/refs/heads/main.zip" -o "$ARCHIVE"; else wget -q "https://github.com/$REPO/archive/refs/heads/main.zip" -O "$ARCHIVE"; fi
  unzip -q "$ARCHIVE" -d "$TMP/source"
  SRC=$(find "$TMP/source" -maxdepth 3 -type d -name webui | head -n1)
fi
[ -n "$SRC" ] && [ -d "$SRC" ] || { echo "WebUI payload not found." >&2; exit 1; }
rm -rf "$DEST.new"; mkdir -p "$DEST.new"; cp -a "$SRC"/. "$DEST.new"/
[ -f "$DEST.new/public/login.html" ] && [ -f "$DEST.new/private/index.html" ] || { echo "Invalid WebUI package." >&2; exit 1; }
rm -rf "$DEST.old"; [ -d "$DEST" ] && mv "$DEST" "$DEST.old" || true; mv "$DEST.new" "$DEST"; rm -rf "$DEST.old"
echo "Installed: $DEST"
cfg=$(find_config || true)
if [ "$CONFIGURE" -eq 1 ] && [ -n "$cfg" ]; then
  cp -a "$cfg" "$cfg.weigg.bak"
  if grep -q '^WebUI\\AlternativeUIEnabled=' "$cfg"; then sed -i 's#^WebUI\\AlternativeUIEnabled=.*#WebUI\\AlternativeUIEnabled=true#' "$cfg"; else printf '\nWebUI\\AlternativeUIEnabled=true\n' >> "$cfg"; fi
  esc=$(printf '%s' "$DEST" | sed 's/[&|]/\\&/g')
  if grep -q '^WebUI\\RootFolder=' "$cfg"; then sed -i "s|^WebUI\\RootFolder=.*|WebUI\\RootFolder=$esc|" "$cfg"; else printf 'WebUI\\RootFolder=%s\n' "$DEST" >> "$cfg"; fi
  echo "Configured: $cfg"
else
  echo "qBittorrent -> Tools -> Preferences -> Web UI -> Use alternative WebUI"
  echo "WebUI Root Folder: $DEST"
  [ -n "$cfg" ] && echo "Detected config: $cfg"
fi
echo "Rollback: sh install.sh --rollback"

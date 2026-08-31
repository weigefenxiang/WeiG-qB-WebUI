#!/bin/sh
set -eu

REPO="weigefenxiang/WeiG-qB-WebUI"
SHA=""
ONLY="all"

usage() {
  cat <<'EOF'
Usage:
  sh tests/live-v036.sh --sha <40-char-git-sha> [--only all|qb4191|qb52]

Targets:
  qb4191  /root/qbittorrent/config/weigg-qb-webui
  qb52    /root/qbittorrent3/config/weigg-qb-webui

This script replaces only Alternate WebUI files. It does NOT restart Docker or qBittorrent.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --sha) SHA="${2:-}"; shift 2 ;;
    --only) ONLY="${2:-all}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$SHA" in
  ????????*) : ;;
  *) echo "ERROR: --sha is required." >&2; exit 2 ;;
esac
printf '%s' "$SHA" | grep -Eq '^[0-9a-fA-F]{40}$' || { echo "ERROR: SHA must be exactly 40 hexadecimal characters." >&2; exit 2; }
case "$ONLY" in all|qb4191|qb52) ;; *) echo "ERROR: --only must be all, qb4191 or qb52" >&2; exit 2 ;; esac

TMP="$(mktemp -d)"
STAMP="$(date +%Y%m%d-%H%M%S)"
NOW="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
trap 'rm -rf "$TMP"' EXIT INT TERM

echo "==> Download exact WeiG qB WebUI candidate"
echo "SHA: $SHA"
curl -fL "https://github.com/${REPO}/archive/${SHA}.tar.gz" -o "$TMP/source.tar.gz"
mkdir -p "$TMP/source"
tar -xzf "$TMP/source.tar.gz" -C "$TMP/source"
SRC="$(find "$TMP/source" -mindepth 2 -maxdepth 3 -type d -name webui | head -n1)"
[ -n "$SRC" ] && [ -f "$SRC/private/index.html" ] && [ -f "$SRC/public/login.html" ] || { echo "ERROR: downloaded archive does not contain webui payload" >&2; exit 1; }
[ "$(tr -d '\r\n ' < "$SRC/VERSION")" = "0.3.6" ] || { echo "ERROR: candidate VERSION is not 0.3.6" >&2; exit 1; }

find_container() {
  config_root="$1"
  command -v docker >/dev/null 2>&1 || return 0
  docker ps -q 2>/dev/null | while IFS= read -r cid; do
    [ -n "$cid" ] || continue
    if docker inspect --format '{{range .Mounts}}{{println .Source "|" .Destination}}{{end}}' "$cid" 2>/dev/null | grep -Fq "$config_root | /config"; then
      docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##'
      break
    fi
  done
}

prepare_target() {
  name="$1" dest="$2" qb_path="$3" config_root="$4"
  [ -d "$dest" ] || { echo "ERROR: $name install directory not found: $dest" >&2; return 1; }
  new="${dest}.new-v036-$$"
  rm -rf "$new"
  cp -a "$SRC" "$new"
  find "$new" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name 'GIT_SHA' \) -exec sed -i "s/__WEIGG_GIT_SHA__/${SHA}/g" {} +
  printf '%s\n' "$SHA" > "$new/GIT_SHA"
  container="$(find_container "$config_root" || true)"
  cat > "$new/private/weigg-install.json" <<EOF
{
  "version": "0.3.6",
  "gitSha": "$SHA",
  "container": "$container",
  "qbPath": "$qb_path",
  "hostPath": "$dest",
  "installedAt": "$NOW",
  "installer": "live-v036-test"
}
EOF
  [ "$(tr -d '\r\n ' < "$new/VERSION")" = "0.3.6" ] || { rm -rf "$new"; echo "ERROR: staged VERSION invalid for $name" >&2; return 1; }
  [ "$(tr -d '\r\n ' < "$new/GIT_SHA")" = "$SHA" ] || { rm -rf "$new"; echo "ERROR: staged SHA invalid for $name" >&2; return 1; }
  if grep -R '__WEIGG_GIT_SHA__' "$new/private" "$new/public" >/dev/null 2>&1; then rm -rf "$new"; echo "ERROR: unresolved Git SHA placeholder in $name" >&2; return 1; fi
  eval "NEW_${name}=\$new"
  eval "BACKUP_${name}=\${dest}.before-v036-${STAMP}"
}

switch_target() {
  name="$1" dest="$2"
  eval "new=\${NEW_${name}}"
  eval "backup=\${BACKUP_${name}}"
  mv "$dest" "$backup"
  if mv "$new" "$dest"; then
    echo "PASS: $name live files switched"
  else
    echo "ERROR: $name switch failed; restoring previous files" >&2
    mv "$backup" "$dest"
    return 1
  fi
}

DO_QB4191=0; DO_QB52=0
[ "$ONLY" = all ] || [ "$ONLY" = qb4191 ] && DO_QB4191=1
[ "$ONLY" = all ] || [ "$ONLY" = qb52 ] && DO_QB52=1

if [ "$DO_QB4191" -eq 1 ]; then prepare_target QB4191 "/root/qbittorrent/config/weigg-qb-webui" "/config/weigg-qb-webui" "/root/qbittorrent/config"; fi
if [ "$DO_QB52" -eq 1 ]; then prepare_target QB52 "/root/qbittorrent3/config/weigg-qb-webui" "/config/weigg-qb-webui" "/root/qbittorrent3/config"; fi

if [ "$DO_QB4191" -eq 1 ]; then switch_target QB4191 "/root/qbittorrent/config/weigg-qb-webui"; fi
if [ "$DO_QB52" -eq 1 ]; then
  if ! switch_target QB52 "/root/qbittorrent3/config/weigg-qb-webui"; then
    if [ "$DO_QB4191" -eq 1 ]; then
      echo "Restoring QB4191 because the second target failed..."
      rm -rf "/root/qbittorrent/config/weigg-qb-webui"
      mv "$BACKUP_QB4191" "/root/qbittorrent/config/weigg-qb-webui"
    fi
    exit 1
  fi
fi

echo
echo "========== v0.3.6 LIVE TEST READY =========="
if [ "$DO_QB4191" -eq 1 ]; then
  echo "qB 4.1.9.1: https://qb.weigshare.com/"
  echo "  VERSION: $(cat /root/qbittorrent/config/weigg-qb-webui/VERSION)"
  echo "  SHA:     $(cat /root/qbittorrent/config/weigg-qb-webui/GIT_SHA)"
  echo "  backup:  $BACKUP_QB4191"
fi
if [ "$DO_QB52" -eq 1 ]; then
  echo "qB 5.2.x:  https://q.weigshare.com/"
  echo "  VERSION: $(cat /root/qbittorrent3/config/weigg-qb-webui/VERSION)"
  echo "  SHA:     $(cat /root/qbittorrent3/config/weigg-qb-webui/GIT_SHA)"
  echo "  backup:  $BACKUP_QB52"
fi
echo "Docker/qB restart: NOT REQUIRED"
echo "Browser: Ctrl+F5 once after deployment"
echo
echo "Rollback commands:"
if [ "$DO_QB4191" -eq 1 ]; then echo "  rm -rf /root/qbittorrent/config/weigg-qb-webui && mv '$BACKUP_QB4191' /root/qbittorrent/config/weigg-qb-webui"; fi
if [ "$DO_QB52" -eq 1 ]; then echo "  rm -rf /root/qbittorrent3/config/weigg-qb-webui && mv '$BACKUP_QB52' /root/qbittorrent3/config/weigg-qb-webui"; fi
echo "============================================"

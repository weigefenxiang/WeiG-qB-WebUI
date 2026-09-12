#!/usr/bin/env bash
set -Eeuo pipefail
LOCALE="${1:-${WEIG_QB_LOCALE:-}}"
VERSION="${WEIG_QB_EXPECTED_VERSION:-}"
[[ -n "$LOCALE" ]] || { echo 'locale argument is required' >&2; exit 2; }
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){2,3}$ ]] || { echo 'WEIG_QB_EXPECTED_VERSION must be an exact qB stable version' >&2; exit 2; }
for cmd in docker node curl; do command -v "$cmd" >/dev/null || { echo "$cmd is required" >&2; exit 2; }; done
case "$VERSION" in
  5.2.3) IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7' ;;
  *) echo "No immutable current-stable qB provider pin is admitted for $VERSION." >&2; exit 3 ;;
esac
PASSWORD='Wei.G'
TMP_ROOT="$(mktemp -d)"
NAME="weig-locale-${GITHUB_RUN_ID:-$$}-${RANDOM}"
NET="weig-locale-net-${GITHUB_RUN_ID:-$$}-${RANDOM}"
cleanup(){
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT INT TERM

secret="$(WEIG_QB_PRESET_PASSWORD="$PASSWORD" node --input-type=module <<'NODE'
import crypto from 'node:crypto';
const password=process.env.WEIG_QB_PRESET_PASSWORD;
const salt=crypto.randomBytes(16);
const key=crypto.pbkdf2Sync(Buffer.from(password,'utf8'),salt,100000,64,'sha512');
process.stdout.write(`${salt.toString('base64')}:${key.toString('base64')}`);
NODE
)"
PROFILE="$TMP_ROOT/profile"
mkdir -p "$PROFILE/qBittorrent/config" "$PROFILE/qBittorrent"
for conf in "$PROFILE/qBittorrent/config/qBittorrent.conf" "$PROFILE/qBittorrent/qBittorrent.conf"; do
  cat > "$conf" <<EOF_CONF
[BitTorrent]
Session\\DefaultSavePath=/downloads
Session\\Port=6881
Session\\TempPath=/downloads/temp
Session\\TempPathEnabled=true
[Meta]
MigrationVersion=9999
[Preferences]
WebUI\\Port=8080
WebUI\\Username=admin
WebUI\\Password_PBKDF2="@ByteArray(${secret})"
EOF_CONF
done
chmod -R u+rwX,go+rX "$PROFILE"

docker pull --quiet "$IMAGE" >/dev/null
resolved="$(docker image inspect "$IMAGE" --format '{{index .RepoDigests 0}}')"
[[ "$resolved" == *@sha256:* ]] || { echo 'Pinned qB image has no immutable RepoDigest.' >&2; exit 1; }
docker network create --internal "$NET" >/dev/null
docker run -d --name "$NAME" --network "$NET" -p 127.0.0.1::8080 \
  --mount "type=bind,src=${PROFILE},dst=/config" \
  --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
  -e PUID="$(id -u)" -e PGID="$(id -g)" \
  -e QBT_LEGAL_NOTICE=confirm -e QBT_WEBUI_PORT=8080 -e QBT_TORRENTING_PORT=6881 \
  "$IMAGE" >/dev/null

PORT=''; actual=''
for _ in $(seq 1 120); do
  PORT="$(docker port "$NAME" 8080/tcp 2>/dev/null | awk -F: 'NR==1{print $NF}')"
  if [[ "$PORT" =~ ^[0-9]+$ ]]; then
    actual="$(curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/api/v2/app/version" 2>/dev/null || true)"
    if [[ "${actual#v}" == "$VERSION" ]]; then break; fi
  fi
  sleep 1
done
[[ "$PORT" =~ ^[0-9]+$ && "${actual#v}" == "$VERSION" ]] || { docker logs "$NAME" >&2 || true; echo "Exact qB $VERSION did not become ready: $actual" >&2; exit 1; }

WEIG_QB_URL="http://127.0.0.1:${PORT}" \
WEIG_QB_USER=admin \
WEIG_QB_PASS="$PASSWORD" \
WEIG_QB_LOCALE="$LOCALE" \
WEIG_QB_EXPECTED_VERSION="$VERSION" \
node tests/real-qb-locale-harness.mjs

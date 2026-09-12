#!/usr/bin/env bash
set -Eeuo pipefail
LOCALE="${1:-${WEIG_QB_LOCALE:-}}"
VERSION="${WEIG_QB_EXPECTED_VERSION:-}"
[[ -n "$LOCALE" ]] || { echo 'locale argument is required' >&2; exit 2; }
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){2,3}$ ]] || { echo 'WEIG_QB_EXPECTED_VERSION must be an exact qB stable version' >&2; exit 2; }
for cmd in docker node curl; do command -v "$cmd" >/dev/null || { echo "$cmd is required" >&2; exit 2; }; done
case "$VERSION" in
  5.2.3)
    IMAGE_PIN='qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7'
    IMAGE_TAG='qbittorrentofficial/qbittorrent-nox:5.2.3-1'
    ;;
  *) echo "No immutable current-stable qB provider pin is admitted for $VERSION." >&2; exit 3 ;;
esac
if [[ "${WEIG_QB_RUNTIME_PRELOADED:-0}" == 1 ]]; then
  docker image inspect "$IMAGE_TAG" >/dev/null 2>&1 || { echo "Pre-materialized exact qB image is missing: $IMAGE_TAG" >&2; exit 1; }
  IMAGE="$IMAGE_TAG"
else
  pulled=0
  for attempt in 1 2 3; do
    if docker pull "$IMAGE_PIN"; then pulled=1; break; fi
    [[ "$attempt" == 3 ]] || sleep $((attempt*5))
  done
  [[ "$pulled" == 1 ]] || { echo "Unable to pull exact qB runtime $IMAGE_PIN after 3 attempts." >&2; exit 1; }
  resolved="$(docker image inspect "$IMAGE_PIN" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
  [[ "$resolved" == *@sha256:* ]] || { echo 'Pinned qB image has no immutable RepoDigest.' >&2; exit 1; }
  IMAGE="$IMAGE_PIN"
fi
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
trap 'rc=$?; echo "Locale runner failed at line ${BASH_LINENO[0]} (exit ${rc})." >&2; exit "$rc"' ERR

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

docker network create --internal "$NET" >/dev/null
docker run -d --name "$NAME" --network "$NET" \
  --mount "type=bind,src=${PROFILE},dst=/config" \
  --tmpfs /downloads:rw,nosuid,nodev,mode=1777 \
  -e PUID="$(id -u)" -e PGID="$(id -g)" \
  -e QBT_LEGAL_NOTICE=confirm -e QBT_WEBUI_PORT=8080 -e QBT_TORRENTING_PORT=6881 \
  "$IMAGE" >/dev/null

TARGET=''; ready=0
for _ in $(seq 1 120); do
  ip="$(docker inspect "$NAME" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' 2>/dev/null || true)"
  if [[ "$ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
    TARGET="http://${ip}:8080"
    code="$(curl --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 2 "${TARGET}/api/v2/app/version" || true)"
    if [[ "$code" =~ ^(200|403)$ ]]; then ready=1; break; fi
  fi
  if [[ "$(docker inspect "$NAME" --format '{{.State.Running}}' 2>/dev/null || true)" != true ]]; then break; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then
  docker logs "$NAME" >&2 || true
  echo "qB $VERSION WebUI did not become reachable on the isolated bridge." >&2
  exit 1
fi

# A 403 readiness response is expected when WebUI authentication is enabled.
# The authenticated harness below is the exact-version authority and fails closed
# unless /api/v2/app/version reports WEIG_QB_EXPECTED_VERSION after login.
WEIG_QB_URL="$TARGET" \
WEIG_QB_USER=admin \
WEIG_QB_PASS="$PASSWORD" \
WEIG_QB_LOCALE="$LOCALE" \
WEIG_QB_EXPECTED_VERSION="$VERSION" \
node tests/real-qb-locale-harness.mjs

#!/usr/bin/env bash
set -Eeuo pipefail

VERSION=""
ALLOW_WRITES=0
while (($#)); do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --allow-writes) ALLOW_WRITES=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$VERSION" ]] || { echo "--version is required" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker is required" >&2; exit 2; }
command -v node >/dev/null || { echo "node is required" >&2; exit 2; }
command -v curl >/dev/null || { echo "curl is required" >&2; exit 2; }

case "$VERSION" in
  4.1.0)
    [[ "$(uname -m)" == "x86_64" ]] || { echo "qB 4.1.0 historical image is amd64-only" >&2; exit 2; }
    IMAGE='wernight/qbittorrent@sha256:f4504b29dce8f4cddcc3e0fe2e6a3410269a41e6843ffc8cb99e0c923f3dee4a'
    PACKAGE_ID='wernight source-built historical qB 4.1.0 image (non-official container wrapper)'
    USERNAME='admin'
    STATIC_PASSWORD='adminadmin'
    OFFICIAL_IMAGE=0
    ;;
  4.6.7)
    IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:4f8059f1ec56f404fca04193b1134563e3aed3179428b1bc659cfe69bfedb951'
    PACKAGE_ID='qBittorrent official Docker image 4.6.7-1'
    USERNAME='admin'
    STATIC_PASSWORD=''
    OFFICIAL_IMAGE=1
    ;;
  5.0.0)
    IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:03c968cd9d82c92a90b6ddde6c9a7a4093cf072c329090815c355dabeadd1fc9'
    PACKAGE_ID='qBittorrent official Docker image 5.0.0-1'
    USERNAME='admin'
    STATIC_PASSWORD=''
    OFFICIAL_IMAGE=1
    ;;
  5.2.3)
    IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7'
    PACKAGE_ID='qBittorrent official Docker image 5.2.3-1'
    USERNAME='admin'
    STATIC_PASSWORD=''
    OFFICIAL_IMAGE=1
    ;;
  *) echo "Unsupported Phase G representative version: $VERSION" >&2; exit 2 ;;
esac

SAFE_VERSION="${VERSION//./-}"
SUFFIX="${GITHUB_RUN_ID:-$$}-${RANDOM}"
NAME="weig-real-qb-${SAFE_VERSION}-${SUFFIX}"
NET="weig-real-qb-net-${SAFE_VERSION}-${SUFFIX}"
PASSWORD=''
TARGET=''

cleanup() {
  set +e
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

# Historical qB releases are intentionally denied internet access. The host
# reaches the container only through its private internal Docker bridge IP; no
# qB WebUI port is published on a host interface.
docker pull "$IMAGE" >/dev/null
docker network create --internal "$NET" >/dev/null
COMMON=(
  -d -t --name "$NAME" --network "$NET"
  --tmpfs /config:rw,exec,nosuid,nodev,mode=1777
  --tmpfs /downloads:rw,nosuid,nodev,mode=1777
)
if ((OFFICIAL_IMAGE)); then
  docker run "${COMMON[@]}" \
    -e QBT_LEGAL_NOTICE=confirm \
    -e QBT_WEBUI_PORT=8080 \
    -e QBT_TORRENTING_PORT=6881 \
    "$IMAGE" >/dev/null
else
  docker run "${COMMON[@]}" --tmpfs /torrents:rw,nosuid,nodev,mode=1777 "$IMAGE" >/dev/null
fi

CONTAINER_IP="$(docker inspect "$NAME" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')"
[[ "$CONTAINER_IP" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || { echo "Unable to resolve private qB container IP" >&2; exit 1; }
TARGET="http://${CONTAINER_IP}:8080/"

# Wait for the WebUI listener. 403 is acceptable here because it proves the
# authenticated API is reachable without bypassing auth.
READY=0
for _ in $(seq 1 90); do
  CODE="$(curl --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 2 "${TARGET}api/v2/app/version" || true)"
  if [[ "$CODE" =~ ^(200|403)$ ]]; then READY=1; break; fi
  sleep 1
done
((READY)) || { echo "qB $VERSION WebUI did not become ready" >&2; exit 1; }

if ((OFFICIAL_IMAGE)); then
  # qB >=4.6.1 generates a temporary admin password. -t above ensures the
  # historical console path flushes it; never echo the credential.
  for _ in $(seq 1 30); do
    PASSWORD="$(docker logs "$NAME" 2>&1 | sed -n 's/.*temporary password is provided for this session: \([^[:space:]]*\).*/\1/p' | tail -n1)"
    [[ -n "$PASSWORD" ]] && break
    sleep 1
  done
  [[ -n "$PASSWORD" ]] || { echo "Temporary qB admin password was not emitted" >&2; exit 1; }
else
  PASSWORD="$STATIC_PASSWORD"
fi

RUNTIME_VERSION="$(docker exec "$NAME" qbittorrent-nox --version 2>/dev/null | head -n1 | tr -d '\r' || true)"
[[ -n "$RUNTIME_VERSION" ]] || { echo "Unable to read qB runtime version identity" >&2; exit 1; }
IMAGE_ID="$(docker image inspect "$IMAGE" --format '{{.Id}}')"
BINARY_IDENTITY="${PACKAGE_ID}; image=${IMAGE}; imageId=${IMAGE_ID}; runtime=${RUNTIME_VERSION}"

ARGS=()
((ALLOW_WRITES)) && ARGS+=(--allow-writes)
WEIG_QB_URL="$TARGET" \
WEIG_QB_USER="$USERNAME" \
WEIG_QB_PASS="$PASSWORD" \
WEIG_GIT_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}" \
WEIG_QB_BINARY_IDENTITY="$BINARY_IDENTITY" \
WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' \
WEIG_QB_ARCH="$(uname -m)" \
WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB Docker; outbound network denied; host access via private internal bridge only' \
WEIG_QB_INSTALL_MODE="$PACKAGE_ID" \
WEIG_QB_REVERSE_PROXY='none' \
node tests/real-qb-harness.mjs "${ARGS[@]}"

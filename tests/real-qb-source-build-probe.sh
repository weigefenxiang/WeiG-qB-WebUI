#!/usr/bin/env bash
set -Eeuo pipefail

VERSION="${1:-}"
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){2,3}$ ]] || { echo "usage: $0 <exact-qb-version>" >&2; exit 2; }

case "$VERSION" in
  4.1.*) LT_REF='libtorrent-1_1_14'; LT_BUILD='autotools' ;;
  4.2.*|4.3.*) LT_REF='v1.2.12'; LT_BUILD='cmake' ;;
  *) echo "probe only supports historical qB 4.1.x-4.3.x" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
IMAGE="weig-gfm-source-probe:${VERSION}"
NET="weig-gfm-source-probe-${VERSION//./-}-${GITHUB_RUN_ID:-$$}-${RANDOM}"
NAME="weig-gfm-source-probe-${VERSION//./-}-${GITHUB_RUN_ID:-$$}-${RANDOM}"
cleanup(){ docker rm -f "$NAME" >/dev/null 2>&1 || true; docker network rm "$NET" >/dev/null 2>&1 || true; rm -rf "$TMP"; }
trap cleanup EXIT INT TERM

cat >"$TMP/Dockerfile" <<'DOCKER'
FROM ubuntu:20.04
ARG DEBIAN_FRONTEND=noninteractive
ARG QB_VERSION
ARG LT_REF
ARG LT_BUILD
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates git build-essential pkg-config autoconf automake libtool cmake ninja-build \
    libssl-dev zlib1g-dev \
    libboost-dev libboost-system-dev libboost-chrono-dev libboost-random-dev \
    qtbase5-dev qttools5-dev qttools5-dev-tools libqt5svg5-dev \
    python3 curl \
 && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "$LT_REF" https://github.com/arvidn/libtorrent.git /src/libtorrent \
 && cd /src/libtorrent \
 && if [ "$LT_BUILD" = autotools ]; then \
      ./autotool.sh \
      && ./configure --disable-debug --enable-encryption --disable-python-binding \
      && make -j2 \
      && make install; \
    else \
      cmake -B build -DCMAKE_BUILD_TYPE=Release -DCMAKE_CXX_STANDARD=17 -Ddeprecated-functions=OFF \
      && cmake --build build -j2 \
      && cmake --install build; \
    fi \
 && ldconfig

RUN git clone --depth 1 --branch "release-${QB_VERSION}" https://github.com/qbittorrent/qBittorrent.git /src/qbittorrent \
 && cd /src/qbittorrent \
 && ./bootstrap.sh \
 && ./configure --disable-gui --prefix=/opt/qb \
 && make -j2 \
 && make install \
 && /opt/qb/bin/qbittorrent-nox --version

ENV PATH="/opt/qb/bin:${PATH}" LD_LIBRARY_PATH="/usr/local/lib:${LD_LIBRARY_PATH}"
RUN mkdir -p /root/.config/qBittorrent \
 && printf '[LegalNotice]\nAccepted=true\n' > /root/.config/qBittorrent/qBittorrent.conf
ENTRYPOINT ["/opt/qb/bin/qbittorrent-nox"]
DOCKER

echo "Building qB ${VERSION} from official tag release-${VERSION} with libtorrent ${LT_REF}"
docker build --pull \
  --build-arg "QB_VERSION=$VERSION" \
  --build-arg "LT_REF=$LT_REF" \
  --build-arg "LT_BUILD=$LT_BUILD" \
  -t "$IMAGE" "$TMP"

reported="$(docker run --rm "$IMAGE" --version 2>&1 | tr -d '\r' | tail -n 1)"
echo "binary identity: $reported"
[[ "$reported" == *"$VERSION"* ]] || { echo "binary did not report expected qB ${VERSION}" >&2; exit 1; }

docker network create --internal "$NET" >/dev/null
docker run -d --name "$NAME" --network "$NET" "$IMAGE" --webui-port=8080 >/dev/null
IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$NAME")"
[[ -n "$IP" ]] || { echo 'container has no internal IP' >&2; exit 1; }

ready=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 2 "http://${IP}:8080/api/v2/app/version" >/dev/null 2>&1; then ready=1; break; fi
  code="$(curl -sS --max-time 2 -o /dev/null -w '%{http_code}' -X POST \
    --data-urlencode 'username=admin' --data-urlencode 'password=adminadmin' \
    "http://${IP}:8080/api/v2/auth/login" || true)"
  if [[ "$code" =~ ^(200|204)$ ]]; then ready=1; break; fi
  sleep 1
done
if (( ! ready )); then
  echo 'qB WebAPI did not become ready; container logs:' >&2
  docker logs "$NAME" >&2 || true
  exit 1
fi

HDR="$TMP/login.headers"
BODY="$TMP/login.body"
code="$(curl -sS --max-time 5 -D "$HDR" -o "$BODY" -w '%{http_code}' -X POST \
  --data-urlencode 'username=admin' --data-urlencode 'password=adminadmin' \
  "http://${IP}:8080/api/v2/auth/login")"
[[ "$code" =~ ^(200|204)$ ]] || { echo "login failed: HTTP $code" >&2; cat "$BODY" >&2; docker logs "$NAME" >&2 || true; exit 1; }
SID="$(awk 'BEGIN{IGNORECASE=1} /^Set-Cookie:/ {gsub("\r",""); if (match($0,/SID=[^; ]+/)) {print substr($0,RSTART,RLENGTH); exit}}' "$HDR")"
[[ -n "$SID" ]] || { echo 'login returned no SID cookie' >&2; cat "$HDR" >&2; exit 1; }

api_version="$(curl -fsS --max-time 5 -H "Cookie: $SID" "http://${IP}:8080/api/v2/app/version" | tr -d '\r\n')"
webapi_version="$(curl -fsS --max-time 5 -H "Cookie: $SID" "http://${IP}:8080/api/v2/app/webapiVersion" | tr -d '\r\n')"
[[ "$api_version" == "$VERSION" || "$api_version" == "v$VERSION" ]] || { echo "exact API identity mismatch: expected $VERSION got $api_version" >&2; exit 1; }

echo "SOURCE_BUILD_PROBE_PASS qb=${VERSION} webapi=${webapi_version} lt=${LT_REF} image=${IMAGE} network=internal published_ports=none"

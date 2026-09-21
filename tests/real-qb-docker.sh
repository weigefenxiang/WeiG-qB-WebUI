#!/usr/bin/env bash
set -Eeuo pipefail

VERSION=""
ALLOW_WRITES=0
BROWSER_SMOKE=0
FULL_MATRIX=0
while (($#)); do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --allow-writes) ALLOW_WRITES=1; shift ;;
    --browser-smoke) BROWSER_SMOKE=1; shift ;;
    --full-matrix) FULL_MATRIX=1; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$VERSION" ]] || { echo "--version is required" >&2; exit 2; }
command -v docker >/dev/null || { echo "docker is required" >&2; exit 2; }
command -v node >/dev/null || { echo "node is required" >&2; exit 2; }
command -v curl >/dev/null || { echo "curl is required" >&2; exit 2; }

STAGE=''
WEIG_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
[[ "$WEIG_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo "Exact Git SHA is required" >&2; exit 2; }
if ((FULL_MATRIX)); then
  node tests/real-qb-full-matrix.mjs --assert-version "$VERSION" >/dev/null
fi
if ((BROWSER_SMOKE)); then
  [[ "$VERSION" == "5.2.3" ]] || { echo "--browser-smoke currently admits only latest stable qB 5.2.3" >&2; exit 2; }
  ((ALLOW_WRITES)) || { echo "--browser-smoke requires --allow-writes on the isolated target" >&2; exit 2; }
  command -v google-chrome >/dev/null || { echo "Google Chrome Stable is required for --browser-smoke" >&2; exit 2; }
  STAGE="$(mktemp -d)"
  cp -a webui/. "$STAGE/"
  node tools/qb-webui-catalog.mjs \
    tests/fixtures/qb-release-catalog.lkg.json \
    "$STAGE/private/data/qb-releases.json"
  if find "$STAGE" -type l -print -quit | grep -q .; then
    echo "Alternative WebUI staging contains a symlink; qB rejects symlinks" >&2
    exit 1
  fi
  find "$STAGE" -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name 'GIT_SHA' \) \
    -exec sed -i "s/__WEIGG_GIT_SHA__/${WEIG_SHA}/g" {} +
  printf '%s\n' "$WEIG_SHA" > "$STAGE/GIT_SHA"
  cat > "$STAGE/private/weigg-install.json" <<EOF_META
{
  "version": "$(tr -d '\r\n' < "$STAGE/VERSION")",
  "gitSha": "$WEIG_SHA",
  "channel": "dev",
  "container": "ephemeral-real-qB",
  "qbPath": "/weig-webui",
  "hostPath": "ephemeral-ci-staging",
  "installedAt": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "installer": "phase-g-ci"
}
EOF_META
  if grep -R -l --include='*.html' --include='*.js' --include='*.css' --include='*.json' --include='GIT_SHA' \
      '__WEIGG_GIT_SHA__' "$STAGE" | grep -q .; then
    echo "Alternative WebUI staging still contains an unresolved Git SHA placeholder" >&2
    exit 1
  fi
fi

IMAGE=''
PACKAGE_ID=''
USERNAME='admin'
STATIC_PASSWORD='adminadmin'
OFFICIAL_IMAGE=0
LINUXSERVER_IMAGE=0
RUNTIME_PROVIDER=''
RUNTIME_VERSION=''
FULL_EVIDENCE_DIR="${WEIG_REAL_QB_EVIDENCE_DIR:-artifacts/real-qb-full}"
FULL_RUNTIME_STATUS=''
GFM_CLEANUP_RESULT='PENDING'

write_runtime_evidence() {
  ((FULL_MATRIX)) || return 0
  local status="$1" reason="${2:-}"
  mkdir -p "$FULL_EVIDENCE_DIR"
  GFM_STATUS="$status" \
  GFM_REASON="$reason" \
  GFM_VERSION="$VERSION" \
  GFM_WEIG_SHA="$WEIG_SHA" \
  GFM_PROVIDER="$RUNTIME_PROVIDER" \
  GFM_IMAGE="$IMAGE" \
  GFM_PACKAGE_ID="$PACKAGE_ID" \
  GFM_RUNTIME_VERSION="$RUNTIME_VERSION" \
  GFM_CLEANUP_RESULT="$GFM_CLEANUP_RESULT" \
  GFM_EVIDENCE_DIR="$FULL_EVIDENCE_DIR" \
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const manifest=JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8'));
const version=process.env.GFM_VERSION;
const out={
  schemaVersion:1,
  phase:'G-FM',
  module:'runtime-resolver',
  status:process.env.GFM_STATUS,
  reason:process.env.GFM_REASON||null,
  expected_qb_version:version,
  weig_sha:process.env.GFM_WEIG_SHA,
  webui_version:fs.readFileSync('VERSION','utf8').trim(),
  frozen_catalog_sha256:manifest.catalogSha256,
  provider:process.env.GFM_PROVIDER||null,
  resolved_image:process.env.GFM_IMAGE||null,
  package_id:process.env.GFM_PACKAGE_ID||null,
  runtime_version:process.env.GFM_RUNTIME_VERSION||null,
  platform:'GitHub Actions Ubuntu / isolated Docker network',
  architecture:process.arch,
  remote_service_exposure:'none',
  cleanup_result:process.env.GFM_CLEANUP_RESULT||'PENDING'
};
const dir=process.env.GFM_EVIDENCE_DIR;
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,`${process.env.GFM_WEIG_SHA}-${version}-runtime.json`),`${JSON.stringify(out,null,2)}\n`);
NODE
  FULL_RUNTIME_STATUS="$status"
}

resolve_mutable_image() {
  local ref="$1" provider="$2" package="$3" official="$4" linuxserver="$5"
  if docker manifest inspect "$ref" >/dev/null 2>&1; then
    docker pull "$ref" >/dev/null
    local resolved
    resolved="$(docker image inspect "$ref" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
    [[ "$resolved" == *@sha256:* ]] || return 1
    IMAGE="$resolved"
    RUNTIME_PROVIDER="$provider"
    PACKAGE_ID="$package; sourceTag=$ref"
    OFFICIAL_IMAGE="$official"
    LINUXSERVER_IMAGE="$linuxserver"
    return 0
  fi
  return 1
}

resolve_full_matrix_image() {
  # Preserve already-certified representative pins where available.
  case "$VERSION" in
    4.1.0)
      [[ "$(uname -m)" == "x86_64" ]] || return 1
      IMAGE='wernight/qbittorrent@sha256:f4504b29dce8f4cddcc3e0fe2e6a3410269a41e6843ffc8cb99e0c923f3dee4a'
      PACKAGE_ID='wernight source-built historical qB 4.1.0 image (non-official container wrapper)'
      RUNTIME_PROVIDER='wernight'
      return 0
      ;;
    4.6.7)
      IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:4f8059f1ec56f404fca04193b1134563e3aed3179428b1bc659cfe69bfedb951'
      PACKAGE_ID='qBittorrent official Docker image 4.6.7-1'
      RUNTIME_PROVIDER='qbittorrentofficial'
      OFFICIAL_IMAGE=1
      return 0
      ;;
    5.0.0)
      IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:03c968cd9d82c92a90b6ddde6c9a7a4093cf072c329090815c355dabeadd1fc9'
      PACKAGE_ID='qBittorrent official Docker image 5.0.0-1'
      RUNTIME_PROVIDER='qbittorrentofficial'
      OFFICIAL_IMAGE=1
      return 0
      ;;
    5.2.3)
      IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7'
      PACKAGE_ID='qBittorrent official Docker image 5.2.3-1'
      RUNTIME_PROVIDER='qbittorrentofficial'
      OFFICIAL_IMAGE=1
      return 0
      ;;
  esac

  # Resolve exact version tags to an immutable RepoDigest before execution.
  # Never fall back to latest, a major-only tag, or a different qB version.
  resolve_mutable_image "qbittorrentofficial/qbittorrent-nox:${VERSION}-1" \
    'qbittorrentofficial' "qBittorrent official Docker image ${VERSION}-1" 1 0 && return 0
  resolve_mutable_image "qbittorrentofficial/qbittorrent-nox:${VERSION}" \
    'qbittorrentofficial' "qBittorrent official Docker image ${VERSION}" 1 0 && return 0
  for ref in \
    "linuxserver/qbittorrent:${VERSION}" \
    "linuxserver/qbittorrent:amd64-${VERSION}" \
    "linuxserver/qbittorrent:version-${VERSION}" \
    "linuxserver/qbittorrent:amd64-version-${VERSION}"; do
    resolve_mutable_image "$ref" 'linuxserver' "LinuxServer historical qB ${VERSION} wrapper" 0 1 && return 0
  done
  resolve_mutable_image "justmiles/qbittorrent:${VERSION}" 'justmiles' "justmiles historical qB ${VERSION} wrapper" 0 0 && return 0
  resolve_mutable_image "wernight/qbittorrent:${VERSION}" 'wernight' "wernight historical qB ${VERSION} wrapper" 0 0 && return 0
  return 1
}

if ((FULL_MATRIX)); then
  if ! resolve_full_matrix_image; then
    write_runtime_evidence 'BLOCKED' 'No auditable exact-version container runtime could be resolved from approved providers.'
    echo "BLOCKED: no auditable real qB runtime resolved for $VERSION" >&2
    exit 3
  fi
else
  case "$VERSION" in
    4.1.0)
      [[ "$(uname -m)" == "x86_64" ]] || { echo "qB 4.1.0 historical image is amd64-only" >&2; exit 2; }
      IMAGE='wernight/qbittorrent@sha256:f4504b29dce8f4cddcc3e0fe2e6a3410269a41e6843ffc8cb99e0c923f3dee4a'
      PACKAGE_ID='wernight source-built historical qB 4.1.0 image (non-official container wrapper)'
      RUNTIME_PROVIDER='wernight'
      ;;
    4.6.7)
      IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:4f8059f1ec56f404fca04193b1134563e3aed3179428b1bc659cfe69bfedb951'
      PACKAGE_ID='qBittorrent official Docker image 4.6.7-1'
      RUNTIME_PROVIDER='qbittorrentofficial'
      OFFICIAL_IMAGE=1
      ;;
    5.0.0)
      IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:03c968cd9d82c92a90b6ddde6c9a7a4093cf072c329090815c355dabeadd1fc9'
      PACKAGE_ID='qBittorrent official Docker image 5.0.0-1'
      RUNTIME_PROVIDER='qbittorrentofficial'
      OFFICIAL_IMAGE=1
      ;;
    5.2.3)
      IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7'
      PACKAGE_ID='qBittorrent official Docker image 5.2.3-1'
      RUNTIME_PROVIDER='qbittorrentofficial'
      OFFICIAL_IMAGE=1
      ;;
    *) echo "Unsupported Phase G representative version: $VERSION" >&2; exit 2 ;;
  esac
fi

SAFE_VERSION="${VERSION//./-}"
SUFFIX="${GITHUB_RUN_ID:-$$}-${RANDOM}"
NAME="weig-real-qb-${SAFE_VERSION}-${SUFFIX}"
NET="weig-real-qb-net-${SAFE_VERSION}-${SUFFIX}"
PASSWORD=''
TARGET=''

cleanup() {
  local failed=0
  docker rm -f "$NAME" >/dev/null 2>&1 || failed=1
  docker network rm "$NET" >/dev/null 2>&1 || failed=1
  if [[ -n "${STAGE:-}" ]]; then rm -rf "$STAGE" || failed=1; fi
  return "$failed"
}
on_error() {
  local code=$?
  trap - ERR
  if cleanup; then GFM_CLEANUP_RESULT='PASS'; else GFM_CLEANUP_RESULT='FAIL'; fi
  if ((FULL_MATRIX)) && [[ "$FULL_RUNTIME_STATUS" != 'BLOCKED' && "$FULL_RUNTIME_STATUS" != 'PASS' && "$FULL_RUNTIME_STATUS" != 'FAIL' ]]; then
    write_runtime_evidence 'FAIL' "Runtime or semantic execution failed with exit code ${code}."
  fi
  exit "$code"
}
trap on_error ERR
trap 'cleanup >/dev/null 2>&1 || true' EXIT INT TERM

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
if ((BROWSER_SMOKE)); then
  COMMON+=(-v "$STAGE:/weig-webui:ro")
fi
if ((OFFICIAL_IMAGE)); then
  docker run "${COMMON[@]}" \
    -e QBT_LEGAL_NOTICE=confirm \
    -e QBT_WEBUI_PORT=8080 \
    -e QBT_TORRENTING_PORT=6881 \
    "$IMAGE" >/dev/null
elif ((LINUXSERVER_IMAGE)); then
  docker run "${COMMON[@]}" \
    -e PUID="$(id -u)" \
    -e PGID="$(id -g)" \
    -e WEBUI_PORT=8080 \
    -e TORRENTING_PORT=6881 \
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
for _ in $(seq 1 120); do
  CODE="$(curl --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 2 "${TARGET}api/v2/app/version" || true)"
  if [[ "$CODE" =~ ^(200|403)$ ]]; then READY=1; break; fi
  sleep 1
done
((READY)) || { echo "qB $VERSION WebUI did not become ready" >&2; exit 1; }

# qB >=4.6.1 may emit a temporary password. Historical wrappers without that
# behavior retain the old isolated default admin/adminadmin credentials.
for _ in $(seq 1 30); do
  PASSWORD="$(docker logs "$NAME" 2>&1 | sed -n 's/.*temporary password is provided for this session: \([^[:space:]]*\).*/\1/p' | tail -n1)"
  [[ -n "$PASSWORD" ]] && break
  sleep 1
done
[[ -n "$PASSWORD" ]] || PASSWORD="$STATIC_PASSWORD"

RUNTIME_VERSION="$(docker exec "$NAME" sh -lc 'qbittorrent-nox --version 2>/dev/null || qbittorrent --version 2>/dev/null' | head -n1 | tr -d '\r' || true)"
[[ -n "$RUNTIME_VERSION" ]] || { echo "Unable to read qB runtime version identity" >&2; exit 1; }
RUNTIME_NUMERIC="$(printf '%s\n' "$RUNTIME_VERSION" | grep -oE '[0-9]+(\.[0-9]+){2,3}' | head -n1 || true)"
if [[ "$RUNTIME_NUMERIC" != "$VERSION" ]]; then
  echo "Resolved runtime identity mismatch: expected qB $VERSION, got $RUNTIME_VERSION" >&2
  exit 1
fi
IMAGE_ID="$(docker image inspect "$IMAGE" --format '{{.Id}}')"
BINARY_IDENTITY="${PACKAGE_ID}; provider=${RUNTIME_PROVIDER}; image=${IMAGE}; imageId=${IMAGE_ID}; runtime=${RUNTIME_VERSION}"

ARGS=()
((ALLOW_WRITES)) && ARGS+=(--allow-writes)
run_evidence() {
  local evidence_dir='artifacts/real-qb'
  ((FULL_MATRIX)) && evidence_dir="$FULL_EVIDENCE_DIR"
  WEIG_QB_URL="$TARGET" \
  WEIG_QB_USER="$USERNAME" \
  WEIG_QB_PASS="$PASSWORD" \
  WEIG_GIT_SHA="$WEIG_SHA" \
  WEIG_QB_BINARY_IDENTITY="$BINARY_IDENTITY" \
  WEIG_QB_PLATFORM='GitHub Actions Ubuntu / isolated Docker network' \
  WEIG_QB_ARCH="$(uname -m)" \
  WEIG_QB_DEPLOYMENT_MODE='ephemeral real-qB Docker; outbound network denied; host access via private internal bridge only' \
  WEIG_QB_INSTALL_MODE="$PACKAGE_ID" \
  WEIG_QB_REVERSE_PROXY='none' \
  WEIG_QB_ALT_WEBUI_PATH="${WEIG_QB_ALT_WEBUI_PATH:-}" \
  WEIG_REAL_QB_EVIDENCE_DIR="$evidence_dir" \
  "$@"
}

run_evidence node tests/real-qb-harness.mjs "${ARGS[@]}"
run_evidence node tests/real-qb-search.mjs
if ((BROWSER_SMOKE)); then
  WEIG_QB_ALT_WEBUI_PATH='/weig-webui' run_evidence node tests/real-qb-browser.mjs
fi
if ((FULL_MATRIX)); then
  if cleanup; then
    GFM_CLEANUP_RESULT='PASS'
  else
    GFM_CLEANUP_RESULT='FAIL'
    write_runtime_evidence 'FAIL' 'Semantic execution passed but isolated Docker cleanup failed.'
    trap - EXIT INT TERM ERR
    exit 1
  fi
  trap - EXIT INT TERM ERR
  write_runtime_evidence 'PASS' ''
fi

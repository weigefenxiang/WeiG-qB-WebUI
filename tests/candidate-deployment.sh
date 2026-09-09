#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CANDIDATE_DIR=${1:-candidate-artifact}
CANDIDATE_DIR=$(cd "$CANDIDATE_DIR" && pwd)
PACKAGE="$CANDIDATE_DIR/WeiG-qB-WebUI.zip"
SUMS="$CANDIDATE_DIR/SHA256SUMS"
CANDIDATE_SHA_FILE="$CANDIDATE_DIR/CANDIDATE_SHA"
IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7'
EXPECTED_SHA=${GITHUB_SHA:-}

command -v docker >/dev/null || { echo 'docker is required' >&2; exit 2; }
command -v node >/dev/null || { echo 'node is required' >&2; exit 2; }
command -v unzip >/dev/null || { echo 'unzip is required' >&2; exit 2; }
command -v google-chrome >/dev/null || { echo 'Google Chrome Stable is required' >&2; exit 2; }
[[ -s "$PACKAGE" && -s "$SUMS" && -s "$CANDIDATE_SHA_FILE" ]] || { echo 'Candidate artifact is incomplete.' >&2; exit 2; }

CANDIDATE_SHA=$(tr -d '\r\n' < "$CANDIDATE_SHA_FILE")
[[ "$CANDIDATE_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'CANDIDATE_SHA is not an exact Git SHA.' >&2; exit 1; }
if [[ -z "$EXPECTED_SHA" ]]; then EXPECTED_SHA="$CANDIDATE_SHA"; fi
[[ "$EXPECTED_SHA" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'GITHUB_SHA is not an exact Git SHA.' >&2; exit 1; }
[[ "$CANDIDATE_SHA" == "$EXPECTED_SHA" ]] || { echo 'Candidate artifact SHA does not match workflow SHA.' >&2; exit 1; }

VERSION=$(unzip -p "$PACKAGE" WeiG-qB-WebUI/VERSION 2>/dev/null | tr -d '\r\n')
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Candidate VERSION is invalid.' >&2; exit 1; }
PACKAGE_GIT_SHA=$(unzip -p "$PACKAGE" WeiG-qB-WebUI/GIT_SHA 2>/dev/null | tr -d '\r\n')
[[ "$PACKAGE_GIT_SHA" == "$EXPECTED_SHA" ]] || { echo 'Candidate package GIT_SHA does not match workflow SHA.' >&2; exit 1; }
EXPECTED_SUM=$(awk '$2=="WeiG-qB-WebUI.zip" || $2=="*WeiG-qB-WebUI.zip" {print $1; exit}' "$SUMS" | tr 'A-F' 'a-f')
ACTUAL_SUM=$(sha256sum "$PACKAGE" | awk '{print $1}' | tr 'A-F' 'a-f')
[[ "$EXPECTED_SUM" =~ ^[0-9a-f]{64}$ && "$EXPECTED_SUM" == "$ACTUAL_SUM" ]] || { echo 'Candidate artifact SHA256 verification failed.' >&2; exit 1; }

TMP=$(mktemp -d)
HOME_DIR="$TMP/home"
CONFIG_ROOT="$TMP/qb-config"
DOWNLOADS="$TMP/downloads"
MOCK_BIN="$TMP/mock-bin"
DEST="$CONFIG_ROOT/weigg-qb-webui"
QB_ROOT='/config/weigg-qb-webui'
QBT_CONFIG="$CONFIG_ROOT/qBittorrent/config/qBittorrent.conf"
NAME="weigg-candidate-qb-${GITHUB_RUN_ID:-$$}-${RANDOM}"
NET="weigg-candidate-net-${GITHUB_RUN_ID:-$$}-${RANDOM}"
REAL_CURL=$(command -v curl)

cleanup() {
  set +e
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  chmod -R u+w "$TMP" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

mkdir -p "$HOME_DIR" "$CONFIG_ROOT" "$DOWNLOADS" "$MOCK_BIN"
cat > "$MOCK_BIN/curl" <<'EOF_CURL'
#!/usr/bin/env bash
set -euo pipefail
url=''
out=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o) out=${2-}; shift 2 ;;
    http://*|https://*) url=$1; shift ;;
    *) shift ;;
  esac
done
[[ -n "$url" && -n "$out" ]] || { echo 'candidate mock curl: missing URL or output path' >&2; exit 2; }
case "$url" in
  */releases/download/v"$WEIG_CANDIDATE_VERSION"/WeiG-qB-WebUI.zip)
    src="$WEIG_CANDIDATE_PACKAGE"
    ;;
  */releases/download/v"$WEIG_CANDIDATE_VERSION"/SHA256SUMS)
    src="$WEIG_CANDIDATE_SUMS"
    ;;
  *)
    echo "candidate mock curl: unexpected URL: $url" >&2
    exit 22
    ;;
esac
cp "$src" "$out"
EOF_CURL
chmod +x "$MOCK_BIN/curl"

export HOME="$HOME_DIR"
export XDG_CONFIG_HOME="$HOME_DIR/.config"
export WEIG_CANDIDATE_VERSION="$VERSION"
export WEIG_CANDIDATE_PACKAGE="$PACKAGE"
export WEIG_CANDIDATE_SUMS="$SUMS"
export PATH="$MOCK_BIN:$PATH"

docker pull "$IMAGE" >/dev/null
docker network create --internal "$NET" >/dev/null
run_qb() {
  docker run -d -t \
    --name "$NAME" \
    --network "$NET" \
    -e QBT_LEGAL_NOTICE=confirm \
    -e QBT_WEBUI_PORT=8080 \
    -e QBT_TORRENTING_PORT=6881 \
    -e PUID="$(id -u)" \
    -e PGID="$(id -g)" \
    -v "$CONFIG_ROOT:/config" \
    -v "$DOWNLOADS:/downloads" \
    "$IMAGE" >/dev/null
}
run_qb

for _ in $(seq 1 30); do
  [[ -f "$QBT_CONFIG" ]] && break
  sleep 1
done
[[ -f "$QBT_CONFIG" ]] || { echo 'Official qB image did not create its configuration.' >&2; exit 1; }
RUNTIME_VERSION=$(docker exec "$NAME" qbittorrent-nox --version 2>/dev/null | head -n1 | tr -d '\r' || true)
[[ -n "$RUNTIME_VERSION" ]] || { echo 'Unable to read qB runtime version identity.' >&2; exit 1; }
docker pause "$NAME" >/dev/null

bash "$ROOT/installers/install.sh" --version "$VERSION" --configure --container "$NAME"
[[ -f "$DEST/public/index.html" && -f "$DEST/private/index.html" ]] || { echo 'Candidate install payload is incomplete.' >&2; exit 1; }
[[ "$(tr -d '\r\n' < "$DEST/VERSION")" == "$VERSION" ]] || { echo 'Installed VERSION mismatch.' >&2; exit 1; }
[[ "$(tr -d '\r\n' < "$DEST/GIT_SHA")" == "$EXPECTED_SHA" ]] || { echo 'Installed GIT_SHA mismatch.' >&2; exit 1; }
grep -Fx 'WebUI\AlternativeUIEnabled=true' "$QBT_CONFIG" >/dev/null
grep -Fx "WebUI\\RootFolder=$QB_ROOT" "$QBT_CONFIG" >/dev/null

node - "$DEST" "$VERSION" "$EXPECTED_SHA" "$NAME" "$CONFIG_ROOT" "$QB_ROOT" <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const [dest,version,sha,container,hostConfigRoot,qbRoot]=process.argv.slice(2);
const meta=JSON.parse(fs.readFileSync(path.join(dest,'private/weigg-install.json'),'utf8'));
if(meta.version!==version)throw new Error('candidate metadata version mismatch');
if(meta.gitSha!==sha)throw new Error('candidate metadata Git SHA mismatch');
if(meta.channel!=='release')throw new Error('candidate metadata channel mismatch');
if(meta.installer!=='linux')throw new Error('candidate metadata installer mismatch');
if(meta.container!==container)throw new Error('candidate metadata container mismatch');
if(meta.hostPath!==path.join(hostConfigRoot,'weigg-qb-webui'))throw new Error('candidate metadata host path mismatch');
if(meta.qbPath!==qbRoot)throw new Error('candidate metadata qB path mismatch');
const catalogPath=path.join(dest,'private/data/qb-releases.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
if(!Array.isArray(catalog)||catalog.length===0)throw new Error('candidate packed catalog is empty');
if(fs.statSync(catalogPath).size>=10*1024*1024)throw new Error('candidate packed catalog exceeds qB static-file limit');
NODE

docker rm -f "$NAME" >/dev/null
run_qb
container_ip=$(docker inspect "$NAME" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
[[ "$container_ip" =~ ^[0-9]+(\.[0-9]+){3}$ ]] || { echo 'Unable to resolve private qB container IP.' >&2; exit 1; }
TARGET="http://${container_ip}:8080/"
READY=0
for _ in $(seq 1 60); do
  code=$($REAL_CURL --silent --output /dev/null --write-out '%{http_code}' --connect-timeout 1 --max-time 2 "$TARGET" || true)
  if [[ "$code" == 200 ]]; then READY=1; break; fi
  sleep 1
done
((READY)) || { echo 'Candidate qB WebUI did not become ready.' >&2; exit 1; }
RAW_ROOT=$($REAL_CURL --silent --show-error --connect-timeout 1 --max-time 3 "$TARGET")
grep -Fq "$EXPECTED_SHA" <<<"$RAW_ROOT" || { echo 'Candidate qB public root did not expose exact build SHA.' >&2; exit 1; }

PASSWORD=''
for _ in $(seq 1 30); do
  PASSWORD=$(docker logs "$NAME" 2>&1 | sed -n 's/.*temporary password is provided for this session: \([^[:space:]]*\).*/\1/p' | tail -n1)
  [[ -n "$PASSWORD" ]] && break
  sleep 1
done
[[ -n "$PASSWORD" ]] || { echo 'Temporary qB admin password was not emitted.' >&2; exit 1; }
WEIG_QB_URL="$TARGET" \
WEIG_QB_USER='admin' \
WEIG_QB_PASS="$PASSWORD" \
WEIG_LIFECYCLE_MARKER='candidate' \
WEIG_LIFECYCLE_SHA="$EXPECTED_SHA" \
WEIG_QB_EXPECTED_VERSION='5.2.3' \
WEIG_QB_ALT_WEBUI_PATH="$QB_ROOT" \
  node "$ROOT/tests/installer-lifecycle-browser.mjs"

mkdir -p "$ROOT/artifacts/candidate-deployment"
export ROOT VERSION EXPECTED_SHA ACTUAL_SUM IMAGE RUNTIME_VERSION
node <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const evidence={
  schemaVersion:1,
  kind:'release-candidate-deployment-acceptance',
  gitSha:process.env.EXPECTED_SHA,
  candidate:{version:process.env.VERSION,packageSha256:process.env.ACTUAL_SUM},
  qB:{
    image:process.env.IMAGE,
    runtimeVersion:process.env.RUNTIME_VERSION,
    network:'isolated internal Docker bridge',
    publishedHostPorts:0
  },
  browser:{channel:'Google Chrome Stable',headless:true,externalRequestsBlocked:true},
  checks:{
    candidateSha:true,
    packageGitSha:true,
    packageSha256:true,
    installerReleasePath:true,
    officialDockerConfig:true,
    packedCatalog:true,
    installMetadata:true,
    qbConfigWrite:true,
    realWebuiServe:true,
    exactBuildSha:true,
    browserLogin:true,
    canonicalSettings:true,
    alternativeWebuiPath:true
  }
};
fs.writeFileSync(path.join(process.env.ROOT,'artifacts/candidate-deployment/candidate.json'),JSON.stringify(evidence,null,2)+'\n');
NODE

bash -n "$ROOT/tests/promotion-release-rehearsal.sh"
bash "$ROOT/tests/promotion-release-rehearsal.sh" "$CANDIDATE_DIR" "$ROOT/artifacts/candidate-deployment/candidate.json"

printf 'Release candidate deployment acceptance passed: version %s exact SHA %s on official qB 5.2.3 with Chrome smoke and isolated promotion/release rehearsal\n' "$VERSION" "$EXPECTED_SHA"

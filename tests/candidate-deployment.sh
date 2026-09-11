#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
CANDIDATE_DIR=${1:-candidate-artifact}
CANDIDATE_DIR=$(cd "$CANDIDATE_DIR" && pwd)

# The real qB Alternative WebUI server is the acceptance owner for runtime static-file
# behavior. Run the exact same materialized candidate on the user-reported late-4.x
# release and on the latest admitted 5.x release. Keep the existing 5.2.3 evidence as
# the canonical promotion/release rehearsal input so downstream release contracts stay
# byte- and schema-compatible.
if [[ "${WEIG_CANDIDATE_MATRIX_CHILD:-0}" != 1 && -z "${WEIG_QB_IMAGE:-}" && -z "${WEIG_QB_EXPECTED_VERSION:-}" ]]; then
  WEIG_CANDIDATE_MATRIX_CHILD=1 \
  WEIG_QB_IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:4f8059f1ec56f404fca04193b1134563e3aed3179428b1bc659cfe69bfedb951' \
  WEIG_QB_EXPECTED_VERSION='4.6.7' \
  WEIG_QB_LOCALE_TARGET='zh_CN' \
  WEIG_CANDIDATE_EVIDENCE_BASENAME='candidate-qb-4.6.7.json' \
  WEIG_CANDIDATE_RUN_REHEARSAL=0 \
    bash "$ROOT/tests/candidate-deployment.sh" "$CANDIDATE_DIR"

  WEIG_CANDIDATE_MATRIX_CHILD=1 \
  WEIG_QB_IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7' \
  WEIG_QB_EXPECTED_VERSION='5.2.3' \
  WEIG_QB_LOCALE_TARGET='zh_CN' \
  WEIG_CANDIDATE_EVIDENCE_BASENAME='candidate.json' \
  WEIG_CANDIDATE_RUN_REHEARSAL=1 \
    bash "$ROOT/tests/candidate-deployment.sh" "$CANDIDATE_DIR"

  printf 'Release candidate real-qB matrix passed: qB 4.6.7 + 5.2.3 both completed app/preferences, locale write/read/reload and canonical Settings acceptance.\n'
  exit 0
fi

PACKAGE="$CANDIDATE_DIR/WeiG-qB-WebUI.zip"
SUMS="$CANDIDATE_DIR/SHA256SUMS"
CANDIDATE_SHA_FILE="$CANDIDATE_DIR/CANDIDATE_SHA"
IMAGE=${WEIG_QB_IMAGE:-'qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7'}
EXPECTED_QB_VERSION=${WEIG_QB_EXPECTED_VERSION:-'5.2.3'}
LOCALE_TARGET=${WEIG_QB_LOCALE_TARGET:-'zh_CN'}
EVIDENCE_BASENAME=${WEIG_CANDIDATE_EVIDENCE_BASENAME:-'candidate.json'}
RUN_REHEARSAL=${WEIG_CANDIDATE_RUN_REHEARSAL:-1}
EXPECTED_SHA=${GITHUB_SHA:-}

[[ "$EXPECTED_QB_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.][0-9]+)?$ ]] || { echo 'WEIG_QB_EXPECTED_VERSION is invalid.' >&2; exit 2; }
[[ "$EVIDENCE_BASENAME" =~ ^[A-Za-z0-9._-]+\.json$ ]] || { echo 'WEIG_CANDIDATE_EVIDENCE_BASENAME must be a simple .json filename.' >&2; exit 2; }
[[ "$RUN_REHEARSAL" == 0 || "$RUN_REHEARSAL" == 1 ]] || { echo 'WEIG_CANDIDATE_RUN_REHEARSAL must be 0 or 1.' >&2; exit 2; }
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
    -e QBT_EULA=accept \
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

INITIAL_READY=0
for _ in $(seq 1 60); do
  if docker logs "$NAME" 2>&1 | grep -q 'temporary password is provided for this session:'; then
    INITIAL_READY=1
    break
  fi
  sleep 1
done
if (( ! INITIAL_READY )); then
  echo 'Official qB image did not finish WebUI initialization before safe configuration handoff.' >&2
  docker logs "$NAME" >&2 2>/dev/null || true
  exit 1
fi

RUNTIME_VERSION=$(docker exec "$NAME" qbittorrent-nox --version 2>/dev/null | head -n1 | tr -d '\r' || true)
[[ -n "$RUNTIME_VERSION" ]] || { echo 'Unable to read qB runtime version identity.' >&2; exit 1; }
[[ "$RUNTIME_VERSION" == *"$EXPECTED_QB_VERSION"* ]] || { echo "Official qB image runtime mismatch: expected $EXPECTED_QB_VERSION, got $RUNTIME_VERSION" >&2; exit 1; }

# qB may defer writing [Preferences] until a graceful exit. Never mutate a live
# qB configuration in acceptance: stop it, require the flushed structure, then
# configure through the explicit host /config root and restart the same container.
docker stop --time 30 "$NAME" >/dev/null
[[ "$(docker inspect -f '{{.State.Running}}' "$NAME")" == false ]] || { echo 'qBittorrent container did not stop before configuration mutation.' >&2; exit 1; }
[[ -f "$QBT_CONFIG" ]] || { echo 'Official qB image did not flush its configuration on graceful stop.' >&2; exit 1; }
awk '
  BEGIN { count=0 }
  { line=$0; sub(/\r$/, "", line); if (line=="[Preferences]") count++ }
  END { exit !(count==1) }
' "$QBT_CONFIG" || { echo 'Gracefully stopped qBittorrent config must contain exactly one [Preferences] section.' >&2; exit 1; }

bash "$ROOT/installers/install.sh" --version "$VERSION" --configure --config-root "$CONFIG_ROOT"
[[ -f "$DEST/public/index.html" && -f "$DEST/private/index.html" ]] || { echo 'Candidate install payload is incomplete.' >&2; exit 1; }
[[ "$(tr -d '\r\n' < "$DEST/VERSION")" == "$VERSION" ]] || { echo 'Installed VERSION mismatch.' >&2; exit 1; }
[[ "$(tr -d '\r\n' < "$DEST/GIT_SHA")" == "$EXPECTED_SHA" ]] || { echo 'Installed GIT_SHA mismatch.' >&2; exit 1; }
grep -Fx 'WebUI\AlternativeUIEnabled=true' "$QBT_CONFIG" >/dev/null
grep -Fx "WebUI\\RootFolder=$QB_ROOT" "$QBT_CONFIG" >/dev/null
awk -v want="$QB_ROOT" '
  /^\[[^]]+\]$/ { section=$0 }
  /^WebUI\\AlternativeUIEnabled=/ { if(section!="[Preferences]" || $0!="WebUI\\AlternativeUIEnabled=true") exit 1; alt++ }
  /^WebUI\\RootFolder=/ { if(section!="[Preferences]" || $0!="WebUI\\RootFolder=" want) exit 1; root++ }
  END { exit !(alt==1 && root==1) }
' "$QBT_CONFIG" || { echo 'Candidate installer did not write exact managed WebUI keys under [Preferences].' >&2; exit 1; }

node - "$DEST" "$VERSION" "$EXPECTED_SHA" "" "$CONFIG_ROOT" "$QB_ROOT" "$EXPECTED_QB_VERSION" "$LOCALE_TARGET" <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const [dest,version,sha,container,hostConfigRoot,qbRoot,expectedQb,localeTarget]=process.argv.slice(2);
const meta=JSON.parse(fs.readFileSync(path.join(dest,'private/weigg-install.json'),'utf8'));
if(meta.version!==version)throw new Error('candidate metadata version mismatch');
if(meta.gitSha!==sha)throw new Error('candidate metadata Git SHA mismatch');
if(meta.channel!=='release')throw new Error('candidate metadata channel mismatch');
if(meta.installer!=='linux')throw new Error('candidate metadata installer mismatch');
if(meta.container!==container)throw new Error('candidate metadata container mismatch');
if(meta.hostPath!==path.join(hostConfigRoot,'weigg-qb-webui'))throw new Error('candidate metadata host path mismatch');
if(meta.qbPath!==qbRoot)throw new Error('candidate metadata qB path mismatch');
const dataDir=path.join(dest,'private/data');
const catalogPath=path.join(dataDir,'qb-releases.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
if(!Array.isArray(catalog)||catalog.length===0)throw new Error('candidate release profile index is empty');
if(fs.statSync(catalogPath).size>=64*1024)throw new Error('candidate release profile index exceeds the 64 KiB runtime budget');
const entry=catalog.find(item=>String(item&&item.qbVersion||'')===expectedQb);
if(!entry)throw new Error(`candidate release profile index is missing qB ${expectedQb}`);
if(!entry.profilePath)throw new Error(`candidate qB ${expectedQb} index entry has no profile shard path`);
const profilePath=path.join(dataDir,entry.profilePath);
if(!fs.existsSync(profilePath))throw new Error(`candidate qB ${expectedQb} profile shard is missing`);
if(fs.statSync(profilePath).size>=5*1024*1024)throw new Error(`candidate qB ${expectedQb} profile shard exceeds project static-file budget`);
const profile=JSON.parse(fs.readFileSync(profilePath,'utf8'));
if(profile.qbVersion!==expectedQb||profile.sourceSha!==entry.sourceSha)throw new Error(`candidate qB ${expectedQb} profile shard identity mismatch`);
for(const action of ['appcontroller.h:preferencesAction','appcontroller.h:setPreferencesAction']){
  if(!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))throw new Error(`candidate qB ${expectedQb} profile does not source-prove ${action}`);
}
if(localeTarget){
  const routes=new Set([...(profile.settingsNativeLocales||[]),...(profile.settingsTranslationLocales||[])]);
  if(!routes.has(localeTarget))throw new Error(`candidate qB ${expectedQb} profile has no source-bound ${localeTarget} Settings translation route`);
  if(profile.settingsTranslationPath&&!fs.existsSync(path.join(dataDir,profile.settingsTranslationPath)))throw new Error(`candidate qB ${expectedQb} translation shard is missing`);
}
NODE

docker start "$NAME" >/dev/null
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
WEIG_LIFECYCLE_MARKER="candidate-qb-$EXPECTED_QB_VERSION" \
WEIG_LIFECYCLE_SHA="$EXPECTED_SHA" \
WEIG_QB_EXPECTED_VERSION="$EXPECTED_QB_VERSION" \
WEIG_QB_LOCALE_TARGET="$LOCALE_TARGET" \
WEIG_QB_ALT_WEBUI_PATH="$QB_ROOT" \
  node "$ROOT/tests/installer-lifecycle-browser.mjs"

mkdir -p "$ROOT/artifacts/candidate-deployment"
EVIDENCE_PATH="$ROOT/artifacts/candidate-deployment/$EVIDENCE_BASENAME"
export ROOT VERSION EXPECTED_SHA ACTUAL_SUM IMAGE RUNTIME_VERSION EXPECTED_QB_VERSION LOCALE_TARGET EVIDENCE_PATH
node <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const evidence={
  schemaVersion:2,
  kind:'release-candidate-deployment-acceptance',
  gitSha:process.env.EXPECTED_SHA,
  candidate:{version:process.env.VERSION,packageSha256:process.env.ACTUAL_SUM},
  qB:{
    expectedVersion:process.env.EXPECTED_QB_VERSION,
    image:process.env.IMAGE,
    runtimeVersion:process.env.RUNTIME_VERSION,
    network:'isolated internal Docker bridge',
    publishedHostPorts:0
  },
  browser:{channel:'Google Chrome Stable',headless:true,externalRequestsBlocked:true,localeTarget:process.env.LOCALE_TARGET||null},
  checks:{
    candidateSha:true,
    packageGitSha:true,
    packageSha256:true,
    installerReleasePath:true,
    officialDockerConfig:true,
    smallReleaseIndex:true,
    exactProfileShard:true,
    sourceProvenPreferences:true,
    installMetadata:true,
    qbConfigWrite:true,
    realWebuiServe:true,
    exactBuildSha:true,
    browserLogin:true,
    canonicalSettings:true,
    localeRoundTrip:!!process.env.LOCALE_TARGET,
    alternativeWebuiPath:true
  }
};
fs.writeFileSync(path.resolve(process.env.EVIDENCE_PATH),JSON.stringify(evidence,null,2)+'\n');
NODE

if [[ "$RUN_REHEARSAL" == 1 ]]; then
  bash -n "$ROOT/tests/promotion-release-rehearsal.sh"
  bash "$ROOT/tests/promotion-release-rehearsal.sh" "$CANDIDATE_DIR" "$EVIDENCE_PATH"
fi

printf 'Release candidate deployment acceptance passed: version %s exact SHA %s on official qB %s with real app/preferences + locale round trip%s\n' \
  "$VERSION" "$EXPECTED_SHA" "$EXPECTED_QB_VERSION" "$([[ "$RUN_REHEARSAL" == 1 ]] && printf ' and isolated promotion/release rehearsal' || true)"

#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
FIXTURES="$TMP/releases"
MOCK_BIN="$TMP/mock-bin"
HOME_DIR="$TMP/home"
CONFIG_ROOT="$TMP/qb-config"
DOWNLOADS="$TMP/downloads"
VERSION_ONE=9.9.90
VERSION_TWO=9.9.91
SHA_ONE=1111111111111111111111111111111111111111
SHA_TWO=2222222222222222222222222222222222222222
IMAGE='qbittorrentofficial/qbittorrent-nox@sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7'
NAME="weigg-installer-qb-${GITHUB_RUN_ID:-$$}-${RANDOM}"
QBT_CONFIG="$CONFIG_ROOT/qBittorrent/config/qBittorrent.conf"
DEST="$CONFIG_ROOT/weigg-qb-webui"
QB_ROOT='/config/weigg-qb-webui'
STATE="$HOME_DIR/.config/weigg-qb-webui"
PAUSED=0

cleanup() {
  set +e
  if [[ "$PAUSED" == 1 ]]; then docker unpause "$NAME" >/dev/null 2>&1 || true; fi
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  chmod -R u+w "$TMP" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

mkdir -p "$FIXTURES" "$MOCK_BIN" "$HOME_DIR" "$CONFIG_ROOT" "$DOWNLOADS"

BASE="$TMP/base/WeiG-qB-WebUI"
mkdir -p "$BASE"
cp -a "$ROOT/webui/." "$BASE/"
node "$ROOT/tools/qb-webui-catalog.mjs" \
  "$ROOT/tests/fixtures/qb-release-catalog.lkg.json" \
  "$BASE/private/data/qb-releases.json"

build_release() {
  local version=$1 source_sha=$2 marker=$3
  local work="$TMP/build-$version" out="$FIXTURES/v$version"
  rm -rf "$work"
  mkdir -p "$work/WeiG-qB-WebUI" "$out"
  cp -a "$BASE/." "$work/WeiG-qB-WebUI/"
  printf '%s\n' "$version" > "$work/WeiG-qB-WebUI/VERSION"
  printf '%s\n' "$source_sha" > "$work/WeiG-qB-WebUI/GIT_SHA"
  printf '%s\n' "$marker" > "$work/WeiG-qB-WebUI/private/lifecycle-marker.txt"
  find "$work/WeiG-qB-WebUI" -type f \
    \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' -o -name 'GIT_SHA' \) \
    -exec sed -i "s/__WEIGG_GIT_SHA__/$source_sha/g" {} +
  (
    cd "$work"
    zip -qr "$out/WeiG-qB-WebUI.zip" WeiG-qB-WebUI
  )
  (
    cd "$out"
    sha256sum WeiG-qB-WebUI.zip > SHA256SUMS
  )
}

build_release "$VERSION_ONE" "$SHA_ONE" release-one
build_release "$VERSION_TWO" "$SHA_TWO" release-two

cat > "$MOCK_BIN/curl" <<'EOF_CURL'
#!/usr/bin/env bash
set -euo pipefail
url=''
out=''
while [[ $# -gt 0 ]]; do
  case "$1" in
    -o)
      out=${2-}
      shift 2
      ;;
    http://*|https://*)
      url=$1
      shift
      ;;
    *)
      shift
      ;;
  esac
done
[[ -n "$url" && -n "$out" ]] || { echo 'mock curl: missing URL or output path' >&2; exit 2; }
case "$url" in
  */releases/download/v9.9.90/WeiG-qB-WebUI.zip)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.90/WeiG-qB-WebUI.zip"
    ;;
  */releases/download/v9.9.90/SHA256SUMS)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.90/SHA256SUMS"
    ;;
  */releases/download/v9.9.91/WeiG-qB-WebUI.zip)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.91/WeiG-qB-WebUI.zip"
    ;;
  */releases/download/v9.9.91/SHA256SUMS)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.91/SHA256SUMS"
    ;;
  *)
    echo "mock curl: unexpected URL: $url" >&2
    exit 22
    ;;
esac
cp "$src" "$out"
EOF_CURL
chmod +x "$MOCK_BIN/curl"

export HOME="$HOME_DIR"
export XDG_CONFIG_HOME="$HOME_DIR/.config"
export WEIGG_INSTALLER_FIXTURE_ROOT="$FIXTURES"
export PATH="$MOCK_BIN:$PATH"

# Use the exact official qB 5.2.3 image already admitted by the Phase G matrix.
# No host port is published and the container has no network access.
docker pull "$IMAGE" >/dev/null
docker run -d -t \
  --name "$NAME" \
  --network none \
  -e QBT_LEGAL_NOTICE=confirm \
  -e QBT_WEBUI_PORT=8080 \
  -e QBT_TORRENTING_PORT=6881 \
  -e PUID="$(id -u)" \
  -e PGID="$(id -g)" \
  -v "$CONFIG_ROOT:/config" \
  -v "$DOWNLOADS:/downloads" \
  "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  [[ -f "$QBT_CONFIG" ]] && break
  sleep 1
done
[[ -f "$QBT_CONFIG" ]] || {
  echo "Official qB image did not create expected config: REDACTED/qBittorrent/config/qBittorrent.conf" >&2
  exit 1
}

RUNTIME_VERSION=$(docker exec "$NAME" qbittorrent-nox --version 2>/dev/null | head -n1 | tr -d '\r' || true)
[[ -n "$RUNTIME_VERSION" ]] || { echo 'Unable to read qB runtime version identity' >&2; exit 1; }
cp -a "$QBT_CONFIG" "$TMP/original-qbittorrent.conf"

# Freeze qB after it has created its real profile. The installer can still
# discover the running/paused container and inspect its bind mount, while the
# config file cannot race with qB writes during the lifecycle assertions.
docker pause "$NAME" >/dev/null
PAUSED=1

assert_install() {
  local expected_version=$1 expected_sha=$2 expected_marker=$3
  test -f "$DEST/public/index.html"
  test -f "$DEST/public/login.html"
  test -f "$DEST/private/index.html"
  test "$(tr -d '\r\n' < "$DEST/VERSION")" = "$expected_version"
  test "$(tr -d '\r\n' < "$DEST/GIT_SHA")" = "$expected_sha"
  test "$(tr -d '\r\n' < "$DEST/private/lifecycle-marker.txt")" = "$expected_marker"
  grep -Fx 'WebUI\AlternativeUIEnabled=true' "$QBT_CONFIG" >/dev/null
  grep -Fx "WebUI\\RootFolder=$QB_ROOT" "$QBT_CONFIG" >/dev/null

  node - "$DEST" "$expected_version" "$expected_sha" "$NAME" "$CONFIG_ROOT" "$QB_ROOT" <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const [dest,version,sha,container,hostConfigRoot,qbRoot]=process.argv.slice(2);
const meta=JSON.parse(fs.readFileSync(path.join(dest,'private/weigg-install.json'),'utf8'));
if(meta.version!==version)throw new Error(`metadata version ${meta.version} != ${version}`);
if(meta.gitSha!==sha)throw new Error(`metadata gitSha ${meta.gitSha} != ${sha}`);
if(meta.channel!=='release')throw new Error(`metadata channel ${meta.channel} != release`);
if(meta.installer!=='linux')throw new Error(`metadata installer ${meta.installer} != linux`);
if(meta.container!==container)throw new Error('metadata container mismatch');
if(meta.hostPath!==path.join(hostConfigRoot,'weigg-qb-webui'))throw new Error('metadata hostPath mismatch');
if(meta.qbPath!==qbRoot)throw new Error('metadata qbPath mismatch');
const catalogPath=path.join(dest,'private/data/qb-releases.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
if(!Array.isArray(catalog)||catalog.length===0)throw new Error('packed release catalog is empty');
if(fs.statSync(catalogPath).size>=10*1024*1024)throw new Error('packed release catalog exceeds qB static-file limit');
NODE
}

bash "$ROOT/installers/install.sh" --version "$VERSION_ONE" --configure --container "$NAME"
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
FIRST_BACKUP=$(cat "$STATE/last-backup")
test "$(cat "$FIRST_BACKUP/had-webui")" = 0
cmp "$FIRST_BACKUP/qBittorrent.conf" "$TMP/original-qbittorrent.conf"
test "$(cat "$FIRST_BACKUP/config-path")" = "$QBT_CONFIG"
test "$(cat "$FIRST_BACKUP/dest-path")" = "$DEST"
test "$(cat "$FIRST_BACKUP/qb-root-folder")" = "$QB_ROOT"

sleep 1
bash "$ROOT/installers/install.sh" --version "$VERSION_TWO" --configure --container "$NAME"
assert_install "$VERSION_TWO" "$SHA_TWO" release-two
SECOND_BACKUP=$(cat "$STATE/last-backup")
test "$SECOND_BACKUP" != "$FIRST_BACKUP"
test "$(cat "$SECOND_BACKUP/had-webui")" = 1
test "$(tr -d '\r\n' < "$SECOND_BACKUP/webui/VERSION")" = "$VERSION_ONE"
test "$(tr -d '\r\n' < "$SECOND_BACKUP/webui/GIT_SHA")" = "$SHA_ONE"
test "$(tr -d '\r\n' < "$SECOND_BACKUP/webui/private/lifecycle-marker.txt")" = release-one
grep -Fx 'WebUI\AlternativeUIEnabled=true' "$SECOND_BACKUP/qBittorrent.conf" >/dev/null
grep -Fx "WebUI\\RootFolder=$QB_ROOT" "$SECOND_BACKUP/qBittorrent.conf" >/dev/null

sed -i 's#^WebUI\\AlternativeUIEnabled=.*#WebUI\\AlternativeUIEnabled=false#' "$QBT_CONFIG"
sed -i 's#^WebUI\\RootFolder=.*#WebUI\\RootFolder=/config/post-upgrade-mutated#' "$QBT_CONFIG"

bash "$ROOT/installers/install.sh" --rollback
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
cmp "$QBT_CONFIG" "$SECOND_BACKUP/qBittorrent.conf"

test "$(cat "$STATE/last-dest")" = "$DEST"
test "$(cat "$STATE/last-qb-root-folder")" = "$QB_ROOT"

mkdir -p "$ROOT/artifacts/install-lifecycle"
REPO_SHA=${GITHUB_SHA:-$(git -C "$ROOT" rev-parse HEAD)}
export ROOT DEST REPO_SHA VERSION_ONE VERSION_TWO SHA_ONE SHA_TWO IMAGE RUNTIME_VERSION
node - "$QBT_CONFIG" <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const configPath=process.argv[2];
const root=process.env.ROOT;
const dest=process.env.DEST;
const catalogPath=path.join(dest,'private/data/qb-releases.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const meta=JSON.parse(fs.readFileSync(path.join(dest,'private/weigg-install.json'),'utf8'));
const evidence={
  schemaVersion:1,
  kind:'official-qb-docker-installer-lifecycle',
  gitSha:process.env.REPO_SHA,
  target:'REDACTED',
  qB:{
    image:process.env.IMAGE,
    runtimeVersion:process.env.RUNTIME_VERSION,
    network:'none',
    publishedHostPorts:0,
    configPath:'REDACTED/qBittorrent/config/qBittorrent.conf'
  },
  fixture:{
    versions:[process.env.VERSION_ONE,process.env.VERSION_TWO],
    sourceShas:[process.env.SHA_ONE,process.env.SHA_TWO]
  },
  checks:{
    officialConfigPath:true,
    dockerMountDiscovery:true,
    containerPathMapping:true,
    initialInstall:true,
    releaseChecksum:true,
    packedCatalog:true,
    installMetadata:true,
    qbConfigWrite:true,
    upgradeBackup:true,
    upgrade:true,
    rollbackWebui:true,
    rollbackQbConfig:true
  },
  rollbackState:{
    version:meta.version,
    gitSha:meta.gitSha,
    catalogProfiles:catalog.length,
    packedCatalogBytes:fs.statSync(catalogPath).size,
    configBytes:fs.statSync(configPath).size
  }
};
fs.writeFileSync(path.join(root,'artifacts/install-lifecycle/docker.json'),JSON.stringify(evidence,null,2)+'\n');
NODE

printf 'Official qB Docker installer lifecycle passed: install %s -> upgrade %s -> rollback %s\n' \
  "$VERSION_ONE" "$VERSION_TWO" "$VERSION_ONE"

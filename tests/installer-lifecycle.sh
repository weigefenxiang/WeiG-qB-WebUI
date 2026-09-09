#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
cleanup() {
  chmod -R u+w "$TMP" 2>/dev/null || true
  rm -rf "$TMP"
}
trap cleanup EXIT INT TERM

FIXTURES="$TMP/releases"
MOCK_BIN="$TMP/mock-bin"
HOME_DIR="$TMP/home"
DEST="$TMP/install/weigg-qb-webui"
CFG="$HOME_DIR/.config/qBittorrent/qBittorrent.conf"
STATE="$HOME_DIR/.config/weigg-qb-webui"
VERSION_ONE=9.9.90
VERSION_TWO=9.9.91
SHA_ONE=1111111111111111111111111111111111111111
SHA_TWO=2222222222222222222222222222222222222222

mkdir -p "$FIXTURES" "$MOCK_BIN" "$(dirname "$CFG")"
cat > "$CFG" <<'EOF_CFG'
[Preferences]
WebUI\AlternativeUIEnabled=false
WebUI\RootFolder=/original/webui
Lifecycle\Marker=preserve-me
EOF_CFG

BASE="$TMP/base/WeiG-qB-WebUI"
mkdir -p "$(dirname "$BASE")"
cp -a "$ROOT/webui" "$BASE"
node "$ROOT/tools/qb-webui-catalog.mjs" \
  "$ROOT/tests/fixtures/qb-release-catalog.lkg.json" \
  "$BASE/private/data/qb-releases.json"

build_release() {
  version=$1
  source_sha=$2
  marker=$3
  work="$TMP/build-$version"
  out="$FIXTURES/v$version"
  rm -rf "$work"
  mkdir -p "$work" "$out"
  cp -a "$BASE" "$work/WeiG-qB-WebUI"
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

assert_install() {
  expected_version=$1
  expected_sha=$2
  expected_marker=$3
  test -f "$DEST/public/index.html"
  test -f "$DEST/public/login.html"
  test -f "$DEST/private/index.html"
  test "$(tr -d '\r\n' < "$DEST/VERSION")" = "$expected_version"
  test "$(tr -d '\r\n' < "$DEST/GIT_SHA")" = "$expected_sha"
  test "$(tr -d '\r\n' < "$DEST/private/lifecycle-marker.txt")" = "$expected_marker"
  grep -Fx "WebUI\\AlternativeUIEnabled=true" "$CFG" >/dev/null
  grep -Fx "WebUI\\RootFolder=$DEST" "$CFG" >/dev/null
  grep -Fx 'Lifecycle\Marker=preserve-me' "$CFG" >/dev/null
  node - "$DEST" "$expected_version" "$expected_sha" <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const [dest,version,sha]=process.argv.slice(2);
const meta=JSON.parse(fs.readFileSync(path.join(dest,'private/weigg-install.json'),'utf8'));
if(meta.version!==version)throw new Error(`metadata version ${meta.version} != ${version}`);
if(meta.gitSha!==sha)throw new Error(`metadata gitSha ${meta.gitSha} != ${sha}`);
if(meta.channel!=='release')throw new Error(`metadata channel ${meta.channel} != release`);
if(meta.installer!=='linux')throw new Error(`metadata installer ${meta.installer} != linux`);
if(meta.hostPath!==dest||meta.qbPath!==dest)throw new Error('metadata install paths do not match isolated destination');
const catalogPath=path.join(dest,'private/data/qb-releases.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
if(!Array.isArray(catalog)||catalog.length===0)throw new Error('packed release catalog is empty');
if(fs.statSync(catalogPath).size>=10*1024*1024)throw new Error('packed release catalog exceeds qB static-file limit');
NODE
}

bash "$ROOT/installers/install.sh" --version "$VERSION_ONE" --configure -o "$DEST"
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
FIRST_BACKUP=$(cat "$STATE/last-backup")
test "$(cat "$FIRST_BACKUP/had-webui")" = 0
grep -Fx 'WebUI\AlternativeUIEnabled=false' "$FIRST_BACKUP/qBittorrent.conf" >/dev/null
grep -Fx 'WebUI\RootFolder=/original/webui' "$FIRST_BACKUP/qBittorrent.conf" >/dev/null

sleep 1
bash "$ROOT/installers/install.sh" --version "$VERSION_TWO" --configure -o "$DEST"
assert_install "$VERSION_TWO" "$SHA_TWO" release-two
SECOND_BACKUP=$(cat "$STATE/last-backup")
test "$SECOND_BACKUP" != "$FIRST_BACKUP"
test "$(cat "$SECOND_BACKUP/had-webui")" = 1
test "$(tr -d '\r\n' < "$SECOND_BACKUP/webui/VERSION")" = "$VERSION_ONE"
test "$(tr -d '\r\n' < "$SECOND_BACKUP/webui/GIT_SHA")" = "$SHA_ONE"
test "$(tr -d '\r\n' < "$SECOND_BACKUP/webui/private/lifecycle-marker.txt")" = release-one
grep -Fx "WebUI\\AlternativeUIEnabled=true" "$SECOND_BACKUP/qBittorrent.conf" >/dev/null
grep -Fx "WebUI\\RootFolder=$DEST" "$SECOND_BACKUP/qBittorrent.conf" >/dev/null

sed -i 's#^WebUI\\AlternativeUIEnabled=.*#WebUI\\AlternativeUIEnabled=false#' "$CFG"
sed -i 's#^WebUI\\RootFolder=.*#WebUI\\RootFolder=/post-upgrade-mutated#' "$CFG"

bash "$ROOT/installers/install.sh" --rollback
assert_install "$VERSION_ONE" "$SHA_ONE" release-one

test "$(cat "$STATE/last-dest")" = "$DEST"
test "$(cat "$STATE/last-qb-root-folder")" = "$DEST"

mkdir -p "$ROOT/artifacts/install-lifecycle"
REPO_SHA=${GITHUB_SHA:-$(git -C "$ROOT" rev-parse HEAD)}
export ROOT DEST REPO_SHA VERSION_ONE VERSION_TWO SHA_ONE SHA_TWO
node <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const root=process.env.ROOT;
const dest=process.env.DEST;
const catalogPath=path.join(dest,'private/data/qb-releases.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const meta=JSON.parse(fs.readFileSync(path.join(dest,'private/weigg-install.json'),'utf8'));
const evidence={
  schemaVersion:1,
  kind:'isolated-linux-installer-lifecycle',
  gitSha:process.env.REPO_SHA,
  target:'REDACTED',
  fixture:{
    versions:[process.env.VERSION_ONE,process.env.VERSION_TWO],
    sourceShas:[process.env.SHA_ONE,process.env.SHA_TWO]
  },
  checks:{
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
    packedCatalogBytes:fs.statSync(catalogPath).size
  }
};
fs.writeFileSync(path.join(root,'artifacts/install-lifecycle/linux.json'),JSON.stringify(evidence,null,2)+'\n');
NODE

printf 'Linux installer lifecycle passed: install %s -> upgrade %s -> rollback %s\n' \
  "$VERSION_ONE" "$VERSION_TWO" "$VERSION_ONE"

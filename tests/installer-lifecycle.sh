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
DEST="$TMP/install/weig-qb-webui"
CFG="$HOME_DIR/.config/qBittorrent/qBittorrent.conf"
STATE="$HOME_DIR/.config/weig-qb-webui"
LEGACY_STATE="$HOME_DIR/.config/weig_qb-webui"
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
for required in capabilities.json detail-compat.json settings-compat.json torrent-compat.json source-actions.json rss-compat.json; do
  test -s "$BASE/private/data/$required" || { echo "Missing current compact runtime fixture: $required" >&2; exit 1; }
done
test ! -e "$BASE/private/data/qb-releases.json"
for shard in qb-copy-profiles qb-copy-bindings qb-copy-fallback; do test -d "$BASE/private/data/$shard" || { echo "Missing current qB copy shard fixture: $shard" >&2; exit 1; }; done
test ! -e "$BASE/private/data/qb-settings-native.txt"

build_legacy_release() {
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
  (
    cd "$work"
    zip -qr "$out/WeiG-qB-WebUI.zip" WeiG-qB-WebUI
  )
  (
    cd "$out"
    sha256sum WeiG-qB-WebUI.zip > SHA256SUMS
  )
  printf '{"tag_name":"v%s"}\n' "$version" > "$out/release.json"
  printf '{\n  "sha": "%s"\n}\n' "$source_sha" > "$out/commit.json"
}

build_canonical_release() {
  version=$1
  source_sha=$2
  marker=$3
  work="$TMP/build-$version"
  out="$FIXTURES/v$version"
  root=weig-qb-webui
  rm -rf "$work"
  mkdir -p "$work" "$out"
  cp -a "$BASE" "$work/$root"
  printf '%s\n' "$version" > "$work/$root/VERSION"
  printf '%s\n' "$source_sha" > "$work/$root/GIT_SHA"
  printf '%s\n' "$marker" > "$work/$root/private/lifecycle-marker.txt"
  (
    cd "$work"
    zip -qr "$out/weig-qb-webui.zip" "$root"
    tar -czf "$out/weig-qb-webui.tar.gz" "$root"
  )
  zip_sha=$(sha256sum "$out/weig-qb-webui.zip" | awk '{print $1}')
  tar_sha=$(sha256sum "$out/weig-qb-webui.tar.gz" | awk '{print $1}')
  zip_bytes=$(wc -c < "$out/weig-qb-webui.zip" | tr -d '[:space:]')
  tar_bytes=$(wc -c < "$out/weig-qb-webui.tar.gz" | tr -d '[:space:]')
  cat > "$out/manifest.json" <<EOF_MANIFEST
{
  "schemaVersion": 5,
  "kind": "materialized-webui-dist",
  "gitSha": "$source_sha",
  "version": "$version",
  "rootFolder": "weig-qb-webui",
  "unixArchive": "weig-qb-webui.tar.gz",
  "zipArchive": "weig-qb-webui.zip",
  "preferred": {
    "unix": "tar.gz",
    "windows": "zip"
  },
  "artifacts": {
    "tarGz": {
      "file": "weig-qb-webui.tar.gz",
      "format": "tar.gz",
      "sha256": "$tar_sha",
      "bytes": $tar_bytes
    },
    "zip": {
      "file": "weig-qb-webui.zip",
      "format": "zip",
      "sha256": "$zip_sha",
      "bytes": $zip_bytes
    }
  }
}
EOF_MANIFEST
  (
    cd "$out"
    sha256sum weig-qb-webui.tar.gz weig-qb-webui.zip manifest.json > SHA256SUMS
  )
  printf '{"tag_name":"v%s"}\n' "$version" > "$out/release.json"
  printf '{\n  "sha": "%s"\n}\n' "$source_sha" > "$out/commit.json"
}

build_legacy_release "$VERSION_ONE" "$SHA_ONE" release-one
build_canonical_release "$VERSION_TWO" "$SHA_TWO" release-two

cat > "$MOCK_BIN/curl" <<'EOF_CURL'
#!/bin/sh
set -eu
url=''
out=''
while [ "$#" -gt 0 ]; do
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
[ -n "$url" ] && [ -n "$out" ] || { echo 'mock curl: missing URL or output path' >&2; exit 2; }
printf '%s\n' "$url" >> "$WEIGG_INSTALLER_DOWNLOAD_LOG"
case "$url" in
  */releases/tags/v9.9.90)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.90/release.json"
    ;;
  */commits/v9.9.90)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.90/commit.json"
    ;;
  */releases/tags/v9.9.91)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.91/release.json"
    ;;
  */commits/v9.9.91)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.91/commit.json"
    ;;
  */releases/download/v9.9.90/WeiG-qB-WebUI.zip)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.90/WeiG-qB-WebUI.zip"
    ;;
  */releases/download/v9.9.90/SHA256SUMS)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.90/SHA256SUMS"
    ;;
  */releases/download/v9.9.91/manifest.json)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.91/manifest.json"
    ;;
  */releases/download/v9.9.91/weig-qb-webui.tar.gz)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.91/weig-qb-webui.tar.gz"
    ;;
  */releases/download/v9.9.91/weig-qb-webui.zip)
    src="$WEIGG_INSTALLER_FIXTURE_ROOT/v9.9.91/weig-qb-webui.zip"
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
DOWNLOAD_LOG="$TMP/download.log"
: > "$DOWNLOAD_LOG"
export WEIGG_INSTALLER_FIXTURE_ROOT="$FIXTURES"
export WEIGG_INSTALLER_DOWNLOAD_LOG="$DOWNLOAD_LOG"
export PATH="$MOCK_BIN:$PATH"

INSTALLER_PROFILE=${WEIG_INSTALLER_SHELL:-dash}
BUSYBOX_CMD=""
BUSYBOX_BIN="$TMP/busybox-bin"
if [ "$INSTALLER_PROFILE" = "busybox-ash" ]; then
  BUSYBOX_CMD=$(command -v busybox || true)
  [ -n "$BUSYBOX_CMD" ] || { echo "BusyBox profile requested but busybox is unavailable." >&2; exit 2; }
  mkdir -p "$BUSYBOX_BIN"
  "$BUSYBOX_CMD" --install -s "$BUSYBOX_BIN"
  cat > "$MOCK_BIN/python3" <<'EOF_PYTHON_GUARD'
#!/bin/sh
echo "python3 fallback was unexpectedly required by the BusyBox installer profile." >&2
exit 99
EOF_PYTHON_GUARD
  chmod +x "$MOCK_BIN/python3"
fi

run_installer() {
  case "$INSTALLER_PROFILE" in
    dash)
      command -v dash >/dev/null 2>&1 || { echo "dash profile requested but dash is unavailable." >&2; return 2; }
      dash "$ROOT/installers/install.sh" "$@"
      ;;
    busybox-ash)
      PATH="$MOCK_BIN:$BUSYBOX_BIN" "$BUSYBOX_CMD" ash "$ROOT/installers/install.sh" "$@"
      ;;
    sh)
      sh "$ROOT/installers/install.sh" "$@"
      ;;
    *)
      echo "Unsupported WEIG_INSTALLER_SHELL profile: $INSTALLER_PROFILE" >&2
      return 2
      ;;
  esac
}

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
  grep -Fx 'Lifecycle\Marker=preserve-me' "$CFG" >/dev/null
  node - "$DEST" "$expected_version" "$expected_sha" <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const [dest,version,sha]=process.argv.slice(2);
const meta=JSON.parse(fs.readFileSync(path.join(dest,'private/weig-install.json'),'utf8'));
if(meta.version!==version)throw new Error(`metadata version ${meta.version} != ${version}`);
if(meta.gitSha!==sha)throw new Error(`metadata gitSha ${meta.gitSha} != ${sha}`);
if(meta.channel!=='main')throw new Error(`metadata channel ${meta.channel} != main`);
if(meta.installer!=='linux')throw new Error(`metadata installer ${meta.installer} != linux`);
if(meta.hostPath!==dest||meta.qbPath!==dest)throw new Error('metadata install paths do not match isolated destination');
const compact=['capabilities.json','detail-compat.json','settings-compat.json','torrent-compat.json','source-actions.json','rss-compat.json'];
for(const name of compact){const file=path.join(dest,'private/data',name);if(!fs.existsSync(file)||fs.statSync(file).size<=0)throw new Error('missing compact runtime '+name);}
for(const dir of ['qb-copy-profiles','qb-copy-bindings','qb-copy-fallback']){const full=path.join(dest,'private/data',dir);if(!fs.existsSync(full)||!fs.statSync(full).isDirectory())throw new Error('missing qB copy shard directory '+dir);}
if(fs.existsSync(path.join(dest,'private/data/qb-settings-native.txt')))throw new Error('retired all-version qB copy registry reappeared');
if(fs.existsSync(path.join(dest,'private/data/qb-releases.json')))throw new Error('retired qb-releases.json must not be restored by installer lifecycle fixtures');
NODE
}

assert_config_enabled() {
  grep -Fx 'WebUI\AlternativeUIEnabled=true' "$CFG" >/dev/null
  grep -Fx "WebUI\RootFolder=$DEST" "$CFG" >/dev/null
  grep -Fx 'Lifecycle\Marker=preserve-me' "$CFG" >/dev/null
}

backup_record_read() {
  tar -xOzf "$1" "./$2"
}

assert_archive_backup() {
  backup=$1
  expected_version=${2-}
  test -f "$backup"
  case "$(basename "$backup")" in
    ????????-????.tar.gz|????????-????-[0-9][0-9].tar.gz) ;;
    *) echo "Unexpected current backup filename: $backup" >&2; return 1 ;;
  esac
  record="$TMP/backup-record-check"
  rm -rf "$record"
  mkdir -p "$record"
  tar -xzf "$backup" -C "$record"
  test -f "$record/archive-manifest"
  format=$(sed -n 's/^format=//p' "$record/archive-manifest")
  file=$(sed -n 's/^file=//p' "$record/archive-manifest")
  expected_sha=$(sed -n 's/^sha256=//p' "$record/archive-manifest")
  if [ "$(cat "$record/had-webui")" = 1 ]; then
    test "$format" = "tar.gz"
    test "$file" = "webui.tar.gz"
    test -f "$record/$file"
    test ! -d "$record/webui"
    actual_sha=$(sha256sum "$record/$file" | awk '{print tolower($1)}')
    test "$actual_sha" = "$expected_sha"
    if [ -n "$expected_version" ]; then
      archived_version=$(tar -xOzf "$record/$file" ./VERSION | tr -d '\r\n')
      test "$archived_version" = "$expected_version"
    fi
  fi
}


run_installer --version "$VERSION_ONE" --configure -o "$DEST"
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
assert_config_enabled
FIRST_BACKUP=$(cat "$STATE/last-backup")
test "$(backup_record_read "$FIRST_BACKUP" had-webui)" = 0
backup_record_read "$FIRST_BACKUP" qBittorrent.conf | grep -Fx 'WebUI\AlternativeUIEnabled=false' >/dev/null
backup_record_read "$FIRST_BACKUP" qBittorrent.conf | grep -Fx 'WebUI\RootFolder=/original/webui' >/dev/null

CFG_BEFORE_PLAIN_UPDATE=$(sha256sum "$CFG" | awk '{print $1}')
sleep 1
run_installer --version "$VERSION_TWO" -o "$DEST"
assert_install "$VERSION_TWO" "$SHA_TWO" release-two
grep -F '/releases/download/v9.9.90/WeiG-qB-WebUI.zip' "$DOWNLOAD_LOG" >/dev/null
grep -F '/releases/download/v9.9.91/manifest.json' "$DOWNLOAD_LOG" >/dev/null
grep -F '/releases/download/v9.9.91/weig-qb-webui.tar.gz' "$DOWNLOAD_LOG" >/dev/null
if grep -F '/releases/download/v9.9.91/weig-qb-webui.zip' "$DOWNLOAD_LOG" >/dev/null; then
  echo "Unix installer downloaded canonical ZIP even though tar.gz extraction was available." >&2
  exit 1
fi
assert_config_enabled
CFG_AFTER_PLAIN_UPDATE=$(sha256sum "$CFG" | awk '{print $1}')
test "$CFG_AFTER_PLAIN_UPDATE" = "$CFG_BEFORE_PLAIN_UPDATE"
SECOND_BACKUP=$(cat "$STATE/last-backup")
test "$SECOND_BACKUP" != "$FIRST_BACKUP"
test "$(backup_record_read "$SECOND_BACKUP" had-webui)" = 1
assert_archive_backup "$SECOND_BACKUP" "$VERSION_ONE"
if tar -tzf "$SECOND_BACKUP" | grep -Fx './qBittorrent.conf' >/dev/null; then
  echo "Plain update unexpectedly captured qBittorrent config." >&2
  exit 1
fi
if tar -tzf "$SECOND_BACKUP" | grep -Fx './config-path' >/dev/null; then
  echo "Plain update unexpectedly published qBittorrent config path." >&2
  exit 1
fi

sed -i 's#^WebUI\\AlternativeUIEnabled=.*#WebUI\\AlternativeUIEnabled=false#' "$CFG"
sed -i 's#^WebUI\\RootFolder=.*#WebUI\\RootFolder=/post-upgrade-mutated#' "$CFG"
CFG_BEFORE_PLAIN_ROLLBACK=$(sha256sum "$CFG" | awk '{print $1}')

LEGACY_SECOND_BACKUP="$LEGACY_STATE/backups/$(basename "$SECOND_BACKUP")"
rm -rf "$LEGACY_STATE"
mv "$STATE" "$LEGACY_STATE"
printf '%s\n' "$LEGACY_SECOND_BACKUP" > "$LEGACY_STATE/last-backup"
test ! -e "$STATE"

run_installer --rollback
test -d "$STATE/backups"
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
CFG_AFTER_PLAIN_ROLLBACK=$(sha256sum "$CFG" | awk '{print $1}')
test "$CFG_AFTER_PLAIN_ROLLBACK" = "$CFG_BEFORE_PLAIN_ROLLBACK"
grep -Fx 'WebUI\AlternativeUIEnabled=false' "$CFG" >/dev/null
grep -Fx 'WebUI\RootFolder=/post-upgrade-mutated' "$CFG" >/dev/null

sleep 1
run_installer --version "$VERSION_TWO" --configure -o "$DEST"
assert_install "$VERSION_TWO" "$SHA_TWO" release-two
assert_config_enabled
CONFIGURED_BACKUP=$(cat "$STATE/last-backup")
assert_archive_backup "$CONFIGURED_BACKUP" "$VERSION_ONE"
backup_record_read "$CONFIGURED_BACKUP" qBittorrent.conf | grep -Fx 'WebUI\AlternativeUIEnabled=false' >/dev/null
backup_record_read "$CONFIGURED_BACKUP" qBittorrent.conf | grep -Fx 'WebUI\RootFolder=/post-upgrade-mutated' >/dev/null

run_installer --rollback --configure
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
grep -Fx 'WebUI\AlternativeUIEnabled=false' "$CFG" >/dev/null
grep -Fx 'WebUI\RootFolder=/post-upgrade-mutated' "$CFG" >/dev/null

sleep 1
run_installer --version "$VERSION_ONE" --configure -o "$DEST"
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
assert_config_enabled

test "$(cat "$STATE/last-dest")" = "$DEST"
test "$(cat "$STATE/last-qb-root-folder")" = "$DEST"

sleep 1
run_installer -uninstall -configure -o "$DEST"
test ! -e "$DEST"
grep -Fx 'WebUI\AlternativeUIEnabled=false' "$CFG" >/dev/null
grep -Fx "WebUI\\RootFolder=$DEST" "$CFG" >/dev/null
UNINSTALL_BACKUP=$(cat "$STATE/last-backup")
test "$(backup_record_read "$UNINSTALL_BACKUP" had-webui)" = 1
assert_archive_backup "$UNINSTALL_BACKUP" "$VERSION_ONE"
retained_backups=0
for backup_root in "$STATE/backups" "$LEGACY_STATE/backups"; do
  [ -d "$backup_root" ] || continue
  for backup in "$backup_root"/*; do
    [ -e "$backup" ] || continue
    retained_backups=$((retained_backups+1))
  done
done
test "$retained_backups" -le 3

run_installer -rollback -configure
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
assert_config_enabled

sleep 1
run_installer -uninstall -configure -purge -o "$DEST"
test ! -e "$DEST"
test ! -e "$STATE/last-backup"
test ! -e "$STATE/last-dest"
test ! -e "$STATE/last-qb-root-folder"
remaining_backup=$(
  for backup_root in "$STATE/backups" "$LEGACY_STATE/backups"; do
    [ -d "$backup_root" ] || continue
    find "$backup_root" -mindepth 1 -maxdepth 1 -print 2>/dev/null
  done | sed -n '1p'
)
if [ -n "$remaining_backup" ]; then
  echo "Purge left an installer-owned backup for $DEST: $remaining_backup" >&2
  exit 1
fi

if run_installer -rollback >/dev/null 2>&1; then
  echo "Rollback unexpectedly succeeded after target backup purge." >&2
  exit 1
fi
run_installer --version "$VERSION_ONE" --configure -o "$DEST"
assert_install "$VERSION_ONE" "$SHA_ONE" release-one
assert_config_enabled

sed -i 's#^WebUI\\AlternativeUIEnabled=.*#WebUI\\AlternativeUIEnabled=false#' "$CFG"
sed -i 's#^WebUI\\RootFolder=.*#WebUI\\RootFolder=/disabled-user-root#' "$CFG"
DISABLED_CFG_BEFORE_PLAIN_UPDATE=$(sha256sum "$CFG" | awk '{print $1}')
sleep 1
run_installer --version "$VERSION_TWO" -o "$DEST"
assert_install "$VERSION_TWO" "$SHA_TWO" release-two
DISABLED_CFG_AFTER_PLAIN_UPDATE=$(sha256sum "$CFG" | awk '{print $1}')
test "$DISABLED_CFG_AFTER_PLAIN_UPDATE" = "$DISABLED_CFG_BEFORE_PLAIN_UPDATE"
grep -Fx 'WebUI\AlternativeUIEnabled=false' "$CFG" >/dev/null
grep -Fx 'WebUI\RootFolder=/disabled-user-root' "$CFG" >/dev/null

mkdir -p "$ROOT/artifacts/install-lifecycle"
REPO_SHA=${GITHUB_SHA:-$(git -C "$ROOT" rev-parse HEAD)}
export ROOT DEST REPO_SHA VERSION_ONE VERSION_TWO SHA_ONE SHA_TWO
node <<'NODE'
const fs=require('node:fs');
const path=require('node:path');
const root=process.env.ROOT;
const dest=process.env.DEST;
const compact=['capabilities.json','detail-compat.json','settings-compat.json','torrent-compat.json','source-actions.json','rss-compat.json','qb-settings-native.txt'];
const compactBytes=compact.reduce((sum,name)=>sum+fs.statSync(path.join(dest,'private/data',name)).size,0);
const meta=JSON.parse(fs.readFileSync(path.join(dest,'private/weig-install.json'),'utf8'));
const evidence={
  schemaVersion:1,
  kind:'isolated-linux-installer-lifecycle',
  gitSha:process.env.REPO_SHA,
  target:'REDACTED',
  fixture:{
    versions:[process.env.VERSION_ONE,process.env.VERSION_TWO],
    sourceShas:[process.env.SHA_ONE,process.env.SHA_TWO],
    releaseFormats:['bounded-legacy-zip','canonical-manifest-tar-gz']
  },
  checks:{
    initialInstall:true,
    releaseChecksum:true,
    packedCatalog:true,
    installMetadata:true,
    qbConfigWrite:true,
    upgradeBackup:true,
    upgrade:true,
    plainUpdatePreservesEnabledConfig:true,
    plainUpdatePreservesDisabledConfig:true,
    rollbackWebui:true,
    rollbackQbConfig:true,
    uninstall:true,
    uninstallConfigDisable:true,
    uninstallRollback:true,
    uninstallPurge:true,
    purgeClearsRollbackState:true,
    rollbackUnavailableAfterPurge:true
  },
  rollbackState:{
    version:meta.version,
    gitSha:meta.gitSha,
    compactRuntimeFiles:compact.length,
    compactRuntimeBytes:compactBytes
  }
};
fs.writeFileSync(path.join(root,'artifacts/install-lifecycle/linux.json'),JSON.stringify(evidence,null,2)+'\n');
NODE

printf 'Linux installer lifecycle (%s) passed: install %s -> upgrade %s -> rollback %s -> uninstall -> rollback -> purge uninstall -> clean reinstall -> disabled-state plain update\n' \
  "$INSTALLER_PROFILE" "$VERSION_ONE" "$VERSION_TWO" "$VERSION_ONE"

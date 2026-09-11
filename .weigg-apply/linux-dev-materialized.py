from pathlib import Path

ROOT=Path('.')

def replace_exact(path, old, new, count=1):
    p=ROOT/path
    text=p.read_text(encoding='utf-8')
    found=text.count(old)
    if found != count:
        raise SystemExit(f'{path}: expected {count} matches, found {found}')
    p.write_text(text.replace(old,new,count),encoding='utf-8',newline='\n')

# Linux installer: make Dev consume the same exact-SHA materialized Pages distribution as Windows.
replace_exact('installers/install.sh',
'''REPO="weigefenxiang/WeiG-qB-WebUI"
DEFAULT_DEST="${HOME}/.local/share/weigg-qb-webui"''',
'''REPO="weigefenxiang/WeiG-qB-WebUI"
DEV_DIST_BASE="https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev"
DEFAULT_DEST="${HOME}/.local/share/weigg-qb-webui"''')

replace_exact('installers/install.sh',
'''inject_build_sha() {''',
'''assert_materialized_webui() {
  root=$1
  catalog="$root/private/data/qb-releases.json"
  registry="$root/private/data/qb-settings-native.txt"
  translations="$root/translations"
  [ -s "$catalog" ] || { echo "Materialized WebUI is missing qb-releases.json." >&2; return 1; }
  grep -Eq '"qbVersion"[[:space:]]*:' "$catalog" || { echo "Materialized WebUI release catalog is empty or invalid." >&2; return 1; }
  [ -s "$registry" ] || { echo "Materialized WebUI is missing the native Settings QBT_TR registry." >&2; return 1; }
  [ -d "$translations" ] || { echo "Materialized WebUI is missing the translations directory." >&2; return 1; }
  find "$translations" -maxdepth 1 -type f -name 'webui_*.qm' -print -quit | grep -q . || { echo "Materialized WebUI is missing official qB WebUI translation QM assets." >&2; return 1; }
}

inject_build_sha() {''')

old_dev='''else
  DEV_META="$TMP/dev-commit.json"
  download_file "https://api.github.com/repos/$REPO/commits/dev" "$DEV_META" || { echo "Unable to resolve the current dev commit." >&2; exit 1; }
  SOURCE_SHA=$(sed -n 's/^[[:space:]]*"sha":[[:space:]]*"\\([0-9a-fA-F]\\{40\\}\\)".*/\\1/p' "$DEV_META" | head -n1)
  valid_sha "$SOURCE_SHA" || { echo "GitHub did not return a valid dev commit SHA." >&2; exit 1; }
  DEV_URL="https://github.com/$REPO/archive/$SOURCE_SHA.zip"
  download_file "$DEV_URL" "$PACKAGE" || { echo "Unable to download dev exact SHA $SOURCE_SHA." >&2; exit 1; }
  extract_zip "$PACKAGE" "$TMP/dev"
  entry=$(find "$TMP/dev" -type f -path '*/webui/public/index.html' -print 2>/dev/null | head -n1 || true)
  [ -n "$entry" ] || { echo "dev source archive does not contain webui/public/index.html." >&2; exit 1; }
  SRC=$(dirname "$(dirname "$entry")")
  echo "Source: dev exact SHA $SOURCE_SHA (development channel; no Release checksum)"
fi'''
new_dev='''else
  DEV_META="$TMP/dev-commit.json"
  download_file "https://api.github.com/repos/$REPO/commits/dev" "$DEV_META" || { echo "Unable to resolve the current dev commit." >&2; exit 1; }
  SOURCE_SHA=$(sed -n 's/^[[:space:]]*"sha":[[:space:]]*"\\([0-9a-fA-F]\\{40\\}\\)".*/\\1/p' "$DEV_META" | head -n1)
  valid_sha "$SOURCE_SHA" || { echo "GitHub did not return a valid dev commit SHA." >&2; exit 1; }

  PUBLISHED_SHA_FILE="$TMP/DEV_GIT_SHA"
  download_file "$DEV_DIST_BASE/GIT_SHA" "$PUBLISHED_SHA_FILE" || {
    echo "The materialized dev WebUI payload is not published yet. Wait for Virtual qB Pages to finish and retry." >&2
    exit 1
  }
  PUBLISHED_SHA=$(tr -d '\\r\\n' < "$PUBLISHED_SHA_FILE")
  [ "$PUBLISHED_SHA" = "$SOURCE_SHA" ] || {
    echo "The materialized dev payload is still at $PUBLISHED_SHA while dev is $SOURCE_SHA. Wait for the exact-SHA Pages build and retry; refusing raw-source fallback." >&2
    exit 1
  }

  download_file "$DEV_DIST_BASE/WeiG-qB-WebUI.zip" "$PACKAGE" || { echo "Unable to download the materialized dev payload for exact SHA $SOURCE_SHA." >&2; exit 1; }
  download_file "$DEV_DIST_BASE/SHA256SUMS" "$TMP/SHA256SUMS" || { echo "Materialized dev payload is missing SHA256SUMS; refusing installation." >&2; exit 1; }
  [ -s "$TMP/SHA256SUMS" ] || { echo "Materialized dev SHA256SUMS is empty; refusing installation." >&2; exit 1; }
  verify_release_checksum "$TMP/SHA256SUMS" "$PACKAGE"
  extract_zip "$PACKAGE" "$TMP/dev"
  SRC="$TMP/dev/WeiG-qB-WebUI"
  [ -d "$SRC" ] || { echo "Materialized dev payload does not contain WeiG-qB-WebUI." >&2; exit 1; }
  PACKAGE_SHA=$(tr -d '\\r\\n' < "$SRC/GIT_SHA" 2>/dev/null || true)
  [ "$PACKAGE_SHA" = "$SOURCE_SHA" ] || { echo "Dev package Git SHA $PACKAGE_SHA does not match requested dev SHA $SOURCE_SHA." >&2; exit 1; }
  assert_materialized_webui "$SRC" || exit 1
  echo "Source: dev exact SHA $SOURCE_SHA (materialized Pages payload; checksum verified)"
fi'''
replace_exact('installers/install.sh',old_dev,new_dev)

# Dev distribution publishes both exact source-tree installers beside one materialized payload.
replace_exact('tools/build-webui-dist.mjs',
'''  // Dev users must not bootstrap through the stable main installer while main is
  // intentionally behind dev. Publish the exact dev Windows installer beside the
  // exact-SHA materialized payload. The installer itself still resolves dev HEAD
  // and refuses installation unless this Pages distribution has caught up to it.
  const windowsInstallerSource=path.join(projectRoot,'installers/install.ps1');
  const windowsInstallerTarget=path.join(outDir,'install.ps1');
  assert(fs.existsSync(windowsInstallerSource),'Canonical Windows installer is missing.');
  fs.copyFileSync(windowsInstallerSource,windowsInstallerTarget);

  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({schemaVersion:2,kind:'materialized-webui-dist',gitSha:sha,version,profiles:runtimeCatalog.length,qmAssets:qms.length,nativeRegistry:true,packedCatalogBytes:packed.packedBytes,windowsInstaller:'install.ps1'},null,2)+'\\n','utf8');
  fs.rmSync(stage,{recursive:true,force:true});
  return{zipPath,digest,profiles:runtimeCatalog.length,qmAssets:qms.length,windowsInstaller:windowsInstallerTarget};''',
'''  // Dev users must not bootstrap through a stable branch installer while main is
  // intentionally behind dev. Publish both exact dev installers beside the exact-SHA
  // materialized payload. Each installer resolves dev HEAD and refuses installation
  // unless this Pages distribution has caught up to it.
  const linuxInstallerSource=path.join(projectRoot,'installers/install.sh');
  const linuxInstallerTarget=path.join(outDir,'install.sh');
  const windowsInstallerSource=path.join(projectRoot,'installers/install.ps1');
  const windowsInstallerTarget=path.join(outDir,'install.ps1');
  assert(fs.existsSync(linuxInstallerSource),'Canonical Linux installer is missing.');
  assert(fs.existsSync(windowsInstallerSource),'Canonical Windows installer is missing.');
  fs.copyFileSync(linuxInstallerSource,linuxInstallerTarget);
  fs.chmodSync(linuxInstallerTarget,0o755);
  fs.copyFileSync(windowsInstallerSource,windowsInstallerTarget);

  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({schemaVersion:2,kind:'materialized-webui-dist',gitSha:sha,version,profiles:runtimeCatalog.length,qmAssets:qms.length,nativeRegistry:true,packedCatalogBytes:packed.packedBytes,linuxInstaller:'install.sh',windowsInstaller:'install.ps1'},null,2)+'\\n','utf8');
  fs.rmSync(stage,{recursive:true,force:true});
  return{zipPath,digest,profiles:runtimeCatalog.length,qmAssets:qms.length,linuxInstaller:linuxInstallerTarget,windowsInstaller:windowsInstallerTarget};''')
replace_exact('tools/build-webui-dist.mjs',
'''    console.log(`Built materialized WebUI distribution: ${result.profiles} profiles, ${result.qmAssets} QM assets, exact dev Windows installer, sha256 ${result.digest}`);''',
'''    console.log(`Built materialized WebUI distribution: ${result.profiles} profiles, ${result.qmAssets} QM assets, exact dev Linux/Windows installers, sha256 ${result.digest}`);''')

# Update focused distribution contract.
p=ROOT/'tests/dev-distribution-contract.mjs'
t=p.read_text(encoding='utf-8')
t=t.replace("const install=fs.readFileSync(new URL('../installers/install.ps1',import.meta.url),'utf8');", "const linuxInstall=fs.readFileSync(new URL('../installers/install.sh',import.meta.url),'utf8');\nconst windowsInstall=fs.readFileSync(new URL('../installers/install.ps1',import.meta.url),'utf8');")
t=t.replace("assert.ok(install.includes(\"$DevDistBase='https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev'\"),'Windows dev installer must consume the public exact-SHA materialized distribution');\nassert.ok(install.includes('Assert-MaterializedWebUI'),'Windows installer must validate runtime catalog/native registry/QM assets before installation');\nassert.ok(install.includes('refusing raw-source fallback'),'Windows dev installer must refuse stale materialized payloads instead of silently installing raw source');\nassert.equal(install.includes('archive/$sourceSha.zip'),false,'Windows dev installer must not download the raw GitHub source archive');", "assert.ok(linuxInstall.includes('DEV_DIST_BASE=\"https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev\"'),'Linux dev installer must consume the public exact-SHA materialized distribution');\nassert.ok(linuxInstall.includes('assert_materialized_webui'),'Linux installer must validate runtime catalog/native registry/QM assets before installation');\nassert.ok(linuxInstall.includes('refusing raw-source fallback'),'Linux dev installer must refuse stale materialized payloads instead of silently installing raw source');\nassert.equal(linuxInstall.includes('archive/$SOURCE_SHA.zip'),false,'Linux dev installer must not download the raw GitHub source archive');\nassert.ok(windowsInstall.includes(\"$DevDistBase='https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev'\"),'Windows dev installer must consume the public exact-SHA materialized distribution');\nassert.ok(windowsInstall.includes('Assert-MaterializedWebUI'),'Windows installer must validate runtime catalog/native registry/QM assets before installation');\nassert.ok(windowsInstall.includes('refusing raw-source fallback'),'Windows dev installer must refuse stale materialized payloads instead of silently installing raw source');\nassert.equal(windowsInstall.includes('archive/$sourceSha.zip'),false,'Windows dev installer must not download the raw GitHub source archive');")
t=t.replace("assert.ok(distBuilder.includes(\"path.join(outDir,'install.ps1')\"),'Canonical dev distribution must publish the exact dev Windows installer beside the payload');\nassert.ok(distBuilder.includes(\"path.join(projectRoot,'installers/install.ps1')\"),'Published dev Windows installer must come from the exact source tree being materialized');", "assert.ok(distBuilder.includes(\"path.join(outDir,'install.sh')\"),'Canonical dev distribution must publish the exact dev Linux installer beside the payload');\nassert.ok(distBuilder.includes(\"path.join(projectRoot,'installers/install.sh')\"),'Published dev Linux installer must come from the exact source tree being materialized');\nassert.ok(distBuilder.includes(\"path.join(outDir,'install.ps1')\"),'Canonical dev distribution must publish the exact dev Windows installer beside the payload');\nassert.ok(distBuilder.includes(\"path.join(projectRoot,'installers/install.ps1')\"),'Published dev Windows installer must come from the exact source tree being materialized');")
t=t.replace("console.log('Dev distribution contract passed: Windows dev installs and its bootstrap installer are published together at one exact SHA; raw-source fallback is forbidden and every dev/main head is materialized without path-filter gaps.');", "console.log('Dev distribution contract passed: Linux/Windows dev installs and both bootstrap installers are published together at one exact SHA; raw-source fallback is forbidden and every dev/main head is materialized without path-filter gaps.');")
p.write_text(t,encoding='utf-8',newline='\n')

# Update platform contract: raw-source Linux Dev is now explicitly forbidden.
p=ROOT/'tests/platform-contract.mjs'
t=p.read_text(encoding='utf-8')
old="""assert.match(sh,/api\\.github\\.com\\/repos\\/\\$REPO\\/commits\\/dev/,'Linux dev channel must resolve the current dev exact SHA');
assert.match(sh,/archive\\/\\$SOURCE_SHA\\.zip/,'Linux dev channel currently downloads an exact-SHA source archive');"""
new="""assert.match(sh,/api\\.github\\.com\\/repos\\/\\$REPO\\/commits\\/dev/,'Linux dev channel must resolve the current dev exact SHA');
assert.match(sh,/DEV_DIST_BASE=\"https:\\/\\/weigefenxiang\\.github\\.io\\/WeiG-qB-WebUI\\/downloads\\/dev\"/,'Linux Dev channel must consume the canonical public materialized payload');
assert.match(sh,/PUBLISHED_SHA.*SOURCE_SHA|SOURCE_SHA.*PUBLISHED_SHA/s,'Linux Dev channel must bind the public materialized payload to the current exact dev SHA');
assert.match(sh,/assert_materialized_webui/,'Linux installer must validate materialized catalog and qB translation runtime assets');
assert.doesNotMatch(sh,/archive\\/\\$SOURCE_SHA\\.zip/,'Linux Dev channel must not fall back to a raw source archive');"""
if t.count(old)!=1: raise SystemExit('platform-contract: Linux dev anchor mismatch')
t=t.replace(old,new)
t=t.replace("console.log('Platform contract passed: Windows Dev consumes an exact-SHA materialized qB-aware translation payload, Windows qB config mutation preserves original text encoding, Windows/Linux installers preserve simplified version/dev/output/configure/rollback semantics and legacy aliases, and LIVE rollback retention remains capped at three backups.');", "console.log('Platform contract passed: Linux/Windows Dev consume one exact-SHA materialized qB-aware translation payload with raw-source fallback forbidden, Windows qB config mutation preserves original text encoding, installers preserve simplified version/dev/output/configure/rollback semantics and legacy aliases, and LIVE rollback retention remains capped at three backups.');")
p.write_text(t,encoding='utf-8',newline='\n')

print('Linux Dev materialized distribution patch applied.')

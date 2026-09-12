import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const sh=fs.readFileSync(path.join(root,'installers/install.sh'),'utf8');
const ps=fs.readFileSync(path.join(root,'installers/install.ps1'),'utf8');
const live=fs.readFileSync(path.join(root,'tests/live.sh'),'utf8');
const candidateDeployment=fs.readFileSync(path.join(root,'tests/candidate-deployment.sh'),'utf8');
const publicIndex=fs.readFileSync(path.join(root,'webui/public/index.html'),'utf8');
const publicLogin=fs.readFileSync(path.join(root,'webui/public/login.html'),'utf8');
const privateIndex=fs.readFileSync(path.join(root,'webui/private/index.html'),'utf8');

for(const rel of ['webui/public/index.html','webui/public/login.html','webui/private/index.html']){
  assert.ok(fs.statSync(path.join(root,rel)).isFile(),`${rel} must be a regular file`);
}

assert.match(sh,/\$SRC\/public\/index\.html/,'Linux installer must validate public/index.html before install');
assert.match(sh,/\$DEST\.new\/public\/index\.html/,'Linux installer must validate staged public/index.html');
assert.match(sh,/QBT_ROOT_FOLDER="\/config\/\$rel"/,'Linux Docker install must map host paths to qB-visible /config paths');
assert.match(sh,/WebUI\\\\AlternativeUIEnabled=true/,'Linux installer must enable Alternative WebUI only when configured');
assert.match(sh,/WebUI\\\\RootFolder=/,'Linux installer must persist qB-visible RootFolder');
assert.match(sh,/--version VERSION/,'Linux installer must expose a specific Release version option');
assert.match(sh,/--dev\s+Install the current dev exact Git SHA/,'Linux installer must expose the simplified dev option');
assert.match(sh,/-o PATH, --output PATH/,'Linux installer must expose unified output-path options');
assert.match(sh,/--configure\s+Enable qBittorrent Alternative WebUI and set Root Folder/,'Linux configure help must explain the qB config mutation');
assert.match(sh,/--rollback\s+Restore the previous installation and qBittorrent config/,'Linux installer must expose rollback');
assert.match(sh,/--version and --dev\/--channel=dev cannot be used together/,'Linux installer must reject version/dev ambiguity');
assert.match(sh,/api\.github\.com\/repos\/\$REPO\/releases\/latest/,'Linux latest install must resolve one concrete GitHub Release tag before downloading assets');
assert.match(sh,/api\.github\.com\/repos\/\$REPO\/releases\/tags\/\$REQUESTED_RELEASE_TAG/,'Linux exact version install must resolve Release metadata for the requested tag');
assert.match(sh,/releases\/download\/\$RELEASE_TAG/,'Linux installer must pin asset downloads to the resolved exact Release tag');
assert.match(sh,/api\.github\.com\/repos\/\$REPO\/commits\/\$RESOLVED_RELEASE_TAG/,'Linux Release install must resolve the tag to an exact commit SHA');
assert.match(sh,/PACKAGE_VERSION.*RELEASE_VERSION|RELEASE_VERSION.*PACKAGE_VERSION/s,'Linux Release install must bind package VERSION to the resolved tag version');
assert.match(sh,/SOURCE_SHA.*RELEASE_EXPECTED_SHA|RELEASE_EXPECTED_SHA.*SOURCE_SHA/s,'Linux Release install must bind package GIT_SHA to the resolved tag commit');
assert.match(sh,/SHA256SUMS/,'Linux Release installs must remain checksum-verified');
assert.match(sh,/--channel=release\|dev/,'Linux installer must keep the old channel syntax as a compatibility alias');
assert.match(sh,/--dir=\/path/,'Linux installer must keep the old path syntax as a compatibility alias');
assert.match(sh,/api\.github\.com\/repos\/\$REPO\/commits\/dev/,'Linux dev channel must resolve the current dev exact SHA');
assert.match(sh,/DEV_DIST_BASE="https:\/\/weigefenxiang\.github\.io\/WeiG-qB-WebUI\/downloads\/dev"/,'Linux Dev channel must consume the canonical public materialized payload');
assert.match(sh,/dev_payload_can_represent_head/,'Linux Dev channel must explicitly verify whether a materialized payload may represent a newer non-payload dev HEAD');
assert.match(sh,/compare\/\$published_sha\.\.\.\$dev_head_sha/,'Linux Dev payload reuse must compare the published payload SHA with the current dev HEAD');
assert.match(sh,/webui\/\*\|simulator\/\*\|installers\/\*\|VERSION\|tools\/data\/qb-stable-lkg\.json\|tools\/data\/qb-locale-lkg\.json\|tests\/fixtures\/qb-release-catalog\.lkg\.json/,'Linux Dev payload reuse must share the Pages public-payload allowlist');
assert.match(sh,/Pages-relevant change exists after published dev payload/,'Linux Dev payload reuse must fail closed when any public payload path changed');
assert.match(sh,/PACKAGE_SHA.*SOURCE_SHA|SOURCE_SHA.*PACKAGE_SHA/s,'Linux Dev package identity must remain bound to the published materialized SHA');
assert.match(sh,/assert_materialized_webui/,'Linux installer must validate materialized catalog and qB translation runtime assets');
assert.doesNotMatch(sh,/archive\/\$SOURCE_SHA\.zip/,'Linux Dev channel must not fall back to a raw source archive');
for(const token of ['download_file','extract_zip','sha256_file','busybox wget','busybox unzip','python3 -m zipfile','openssl dgst -sha256'])assert.ok(sh.includes(token),`Linux portable installer fallback missing ${token}`);
assert.doesNotMatch(sh,/archive\/refs\/heads\/main\.zip/,'Linux Release channel must fail closed instead of falling back to main');
assert.doesNotMatch(sh,/resolve_main_sha/,'Linux Release channel must not resolve main as a payload source');

assert.match(ps,/public\\index\.html/,'Windows installer must validate public/index.html');
assert.match(ps,/\$env:LOCALAPPDATA\\WeiG-qB-WebUI/,'Windows installer must use a user-writable default destination');
assert.match(ps,/APPDATA 'qBittorrent\\qBittorrent\.ini'/,'Windows installer must search the canonical roaming qBittorrent config path');
assert.match(ps,/WebUI\\AlternativeUIEnabled=true/,'Windows installer must persist Alternative WebUI enabled state');
assert.match(ps,/WebUI\\RootFolder=/,'Windows installer must persist the native Windows RootFolder');
assert.match(ps,/Alias\('o','output'\)/,'Windows installer must expose the same short output option');
assert.match(ps,/\[string\]\$Version=''/,'Windows installer must expose a specific Release version option');
assert.match(ps,/\[switch\]\$Dev/,'Windows installer must expose the simplified dev option');
assert.match(ps,/\[switch\]\$Configure/,'Windows installer must expose configure');
assert.match(ps,/\[switch\]\$Rollback/,'Windows installer must expose rollback');
assert.match(ps,/-version VERSION/,'Windows help must document lowercase version syntax');
assert.match(ps,/-configure\s+Enable qBittorrent Alternative WebUI and set Root Folder/,'Windows help must document lowercase configure syntax');
assert.match(ps,/-version and -dev\/-Channel Dev cannot be used together/,'Windows installer must reject version/dev ambiguity');
assert.match(ps,/api\.github\.com\/repos\/\$Repo\/releases\/latest/,'Windows latest install must resolve one concrete GitHub Release tag before downloading assets');
assert.match(ps,/api\.github\.com\/repos\/\$Repo\/releases\/tags\/\$requestedReleaseTag/,'Windows exact version install must resolve Release metadata for the requested tag');
assert.match(ps,/releases\/download\/\$releaseTag/,'Windows installer must pin asset downloads to the resolved exact Release tag');
assert.match(ps,/api\.github\.com\/repos\/\$Repo\/commits\/\$resolvedReleaseTag/,'Windows Release install must resolve the tag to an exact commit SHA');
assert.match(ps,/packageVersion.*releaseVersion|releaseVersion.*packageVersion/s,'Windows Release install must bind package VERSION to the resolved tag version');
assert.match(ps,/sourceSha.*releaseExpectedSha|releaseExpectedSha.*sourceSha/s,'Windows Release install must bind package GIT_SHA to the resolved tag commit');
assert.match(ps,/SHA256SUMS/,'Windows Release installs must remain checksum-verified');
assert.match(ps,/ValidateSet\('Release','Dev'\)/,'Windows installer must retain legacy Release/Dev channel compatibility');
assert.match(ps,/ValidateSet\('Install','Update','Rollback'\)/,'Windows installer must retain legacy mode compatibility');
assert.match(ps,/api\.github\.com\/repos\/\$Repo\/commits\/dev/,'Windows Dev channel must resolve the current dev exact SHA');
assert.match(ps,/DevDistBase='https:\/\/weigefenxiang\.github\.io\/WeiG-qB-WebUI\/downloads\/dev'/,'Windows Dev channel must consume the canonical public materialized payload');
assert.match(ps,/function Test-DevPayloadCanRepresentHead/,'Windows Dev channel must verify whether a materialized payload may represent a newer non-payload dev HEAD');
assert.match(ps,/compare\/\$PublishedSha\.\.\.\$DevHeadSha/,'Windows Dev payload reuse must compare the published payload SHA with the current dev HEAD');
assert.ok(ps.includes("if($Path.StartsWith('webui/'")&&ps.includes("'tests/fixtures/qb-release-catalog.lkg.json' { return $false }")&&ps.includes('default { return $true }'),'Windows Dev payload reuse must share the Pages public-payload allowlist');
assert.match(ps,/Pages-relevant change exists after published dev payload/,'Windows Dev payload reuse must fail closed when any public payload path changed');
assert.match(ps,/packageSha.*sourceSha|sourceSha.*packageSha/s,'Windows Dev package identity must remain bound to the published materialized SHA');
assert.match(ps,/Verify-PackageChecksum \$archive \$sumFile/,'Windows Dev materialized payload must remain checksum-verified');
assert.match(ps,/function Assert-MaterializedWebUI/,'Windows installer must validate materialized catalog and qB translation runtime assets');
assert.match(ps,/qb-settings-native\.txt/,'Windows materialized payload must require the native qB Settings translation registry');
assert.match(ps,/webui_\*\.qm/,'Windows materialized payload must require qB WebUI QM assets');
assert.doesNotMatch(ps,/archive\/\$sourceSha\.zip/,'Windows Dev channel must not fall back to a raw source archive');
assert.match(ps,/function Restore-Last/,'Windows rollback must restore the remembered previous state');
assert.match(ps,/last-dest/,'Windows rollback must remember the prior install destination');
assert.doesNotMatch(ps,/archive\/refs\/heads\/main\.zip/,'Windows Release channel must fail closed instead of falling back to main');
assert.doesNotMatch(ps,/Resolve-MainSha/,'Windows Release channel must not resolve main as a payload source');

assert.match(candidateDeployment,/releases\/tags\/v"\$WEIG_CANDIDATE_VERSION"/,'Candidate deployment must mock the exact Release tag metadata used by the artifact installer');
assert.match(candidateDeployment,/commits\/v"\$WEIG_CANDIDATE_VERSION"/,'Candidate deployment must mock the exact Release tag commit identity');
assert.match(candidateDeployment,/WEIG_CANDIDATE_SHA="\$EXPECTED_SHA"/,'Candidate deployment must bind mocked Release commit identity to the candidate SHA');
assert.match(ps,/function Read-QBConfigText/,'Windows configure path must own explicit qB config decoding instead of PowerShell defaults');
assert.match(ps,/UTF8Encoding\(\$false,\$true\)/,'Windows qB config reader must validate BOM-less UTF-8 strictly');
assert.match(ps,/\[Text\.Encoding\]::Default/,'Windows qB config reader may fall back to the native code page only when bytes are not valid UTF-8');
assert.match(ps,/function Write-QBConfigText/,'Windows qB config writer must preserve the detected source encoding');
assert.match(ps,/WriteAllBytes/,'Windows qB config writer must operate on explicit encoded bytes');
assert.match(ps,/function Configure-QBWebUI/,'Windows qB config mutation must pass through the encoding-preserving path');
assert.match(ps,/qBittorrent config encoding preserved/,'Windows installer must report the preserved config encoding for diagnostics');
assert.doesNotMatch(ps,/\$text=Get-Content \$cfg -Raw/,'Windows configure must never decode qBittorrent.ini through the locale-dependent PowerShell default');
assert.doesNotMatch(ps,/Set-Content -Path \$cfg -Value \$text -Encoding UTF8/,'Windows configure must never transcode the entire qBittorrent config through Set-Content UTF8');

assert.match(live,/BACKUP_RETENTION=3/,'LIVE deploy must retain exactly three rollback backups');
assert.match(live,/prune_target_backups/,'LIVE deploy must prune old sibling rollback backups');
assert.match(live,/\.before-\*/,'LIVE deploy must include historical before-* backups in retention cleanup');
assert.match(live,/\.ui-backup-\*/,'LIVE deploy must include historical ui-backup-* backups in retention cleanup');

for(const [name,html] of [['public/index.html',publicIndex],['public/login.html',publicLogin]]){
  assert.match(html,/api\/v2\/auth\/login/,`${name} must use relative same-origin WebAPI login`);
  assert.match(html,/status===204/,`${name} must accept modern qB 5.x 204 login`);
  assert.match(html,/status===401/,`${name} must handle modern bad credentials`);
  assert.match(html,/text==='Ok\.'/ ,`${name} must accept legacy qB 4.x Ok. login`);
  assert.doesNotMatch(html,/[A-Za-z]:\\|\/config\/weigg-qb-webui/,`${name} must not embed OS/deployment-specific paths`);
}
assert.match(privateIndex,/scripts\/qb-client\.js/,'private WebUI must load the shared API compatibility client');

console.log('Platform contract passed: Linux/Windows Release installs pin one concrete tag and require tag/VERSION/GIT_SHA identity; Dev consumes one materialized qB-aware payload, permits newer docs-only heads only after compare verification, fails closed on Pages-relevant lag, and forbids raw-source fallback; Windows qB config mutation preserves original text encoding; installer compatibility and LIVE rollback retention remain guarded.');
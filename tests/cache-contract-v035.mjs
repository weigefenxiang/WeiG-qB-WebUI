import fs from 'node:fs';

const read = p => fs.readFileSync(p, 'utf8');
const index = read('webui/private/index.html');
const login = read('webui/public/login.html');
const components = read('webui/private/scripts/components.js');
const linux = read('installers/install.sh');
const windows = read('installers/install.ps1');
const ci = read('.github/workflows/ci.yml');
const upstream = read('.github/workflows/upstream-compat.yml');
const promote = read('.github/workflows/promote.yml');
const release = read('.github/workflows/release.yml');
const metadata = read('webui/private/weigg-install.json');
const marker = read('webui/GIT_SHA').trim();
const PLACEHOLDER='__WEIGG_GIT_SHA__';
const SHA_A='1111111111111111111111111111111111111111';
const SHA_B='2222222222222222222222222222222222222222';

function assert(condition, message){ if(!condition) throw new Error(message); }
function localAssets(html){
  return [...html.matchAll(/(?:href|src)="((?:css|scripts)\/[^"?#]+\.(?:css|js))([^\"]*)"/g)].map(m=>m[1]+m[2]);
}

for (const html of [index, login]) {
  assert(html.includes('http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate"'), 'HTML no-store meta contract missing');
  assert(html.includes('http-equiv="Pragma" content="no-cache"'), 'HTML pragma no-cache contract missing');
  assert(html.includes('http-equiv="Expires" content="0"'), 'HTML expires=0 contract missing');
  assert(html.includes(`name="weigg-build-sha" content="${PLACEHOLDER}"`), 'HTML build SHA meta missing');
}

const assets=localAssets(index);
assert(assets.length >= 10, 'Expected canonical local CSS/JS assets in private index');
for(const asset of assets){
  assert(asset.endsWith(`?v=${PLACEHOLDER}`), `Local asset is not Git-SHA versioned: ${asset}`);
  assert(!/\?v=\d+\.\d+\.\d+/.test(asset), `Semver cache buster is forbidden: ${asset}`);
}
assert(!index.includes('settings-v034.css'), 'Standalone Alternative WebUI CSS must not be loaded');
assert(!components.match(/\?v=\d+\.\d+\.\d+/), 'Dynamic runtime loader must not use semver cache busters');
for(const token of ['currentBuildToken','buildAssetUrl','weigg-build-sha','css(\'css/v022.css\'','css(\'css/v030.css\'','buildAssetUrl(\'scripts/v030.js\')']){
  assert(components.includes(token), `Git-SHA lazy asset loader token missing: ${token}`);
}

assert(marker===PLACEHOLDER, 'Source GIT_SHA must remain a deploy-time placeholder');
assert(metadata.includes(`"gitSha": "${PLACEHOLDER}"`), 'Source metadata must expose the deploy-time Git SHA');
for(const token of ['SOURCE_SHA','inject_build_sha','GIT_SHA','gitSha','__WEIGG_GIT_SHA__','releases/latest/download/WeiG-qB-WebUI.zip','releases/latest/download/SHA256SUMS']) assert(linux.includes(token), `Linux Release/Git-SHA installer token missing: ${token}`);
for(const token of ['Inject-BuildSha','GIT_SHA','gitSha','__WEIGG_GIT_SHA__','releases/latest/download/WeiG-qB-WebUI.zip','releases/latest/download/SHA256SUMS']) assert(windows.includes(token), `Windows Release/Git-SHA installer token missing: ${token}`);
assert(!linux.includes('archive/refs/heads/main.zip') && !linux.includes('resolve_main_sha'),'Linux stable installer must not use main as a payload source');
assert(!windows.includes('archive/refs/heads/main.zip') && !windows.includes('Resolve-MainSha'),'Windows stable installer must not use main as a payload source');
for(const token of ['GITHUB_SHA','__WEIGG_GIT_SHA__','GIT_SHA','CANDIDATE_SHA']) assert(ci.includes(token), `Dev candidate Git-SHA stamping token missing: ${token}`);
for(const token of ['qbittorrent/qBittorrent','fetch-depth: 0','upstream-release-audit-v037.mjs']) assert(upstream.includes(token), `Upstream audit workflow token missing: ${token}`);
for(const [name,workflow] of [['promotion',promote],['release',release]]){
  for(const token of ['workflow_id: \'ci.yml\'','workflow_id: \'upstream-compat.yml\'','run.head_sha.toLowerCase() === sha','conclusion === \'success\'']){
    assert(workflow.includes(token), `${name} exact-SHA dual-gate token missing: ${token}`);
  }
}
for(const token of ['GITHUB_SHA','CANDIDATE_SHA','SHA256SUMS','unzip -p release/WeiG-qB-WebUI.zip WeiG-qB-WebUI/GIT_SHA']) assert(release.includes(token), `Release Git-SHA verification token missing: ${token}`);
assert(!release.includes('__WEIGG_GIT_SHA__'),'Tag release must verify the prebuilt candidate instead of stamping source again');

const injectedA=index.replaceAll(PLACEHOLDER,SHA_A);
const injectedB=index.replaceAll(PLACEHOLDER,SHA_B);
assert(injectedA!==injectedB, 'Changing build SHA must change HTML asset identities');
assert(injectedA.includes(`css/app.css?v=${SHA_A}`), 'SHA A was not injected into asset URL');
assert(injectedB.includes(`scripts/app.js?v=${SHA_B}`), 'SHA B was not injected into asset URL');
assert(!injectedA.includes(PLACEHOLDER) && !injectedB.includes(PLACEHOLDER), 'Deploy-time SHA replacement must remove placeholders');

console.log('v0.3.7 Release-only Git SHA + exact-SHA CI/upstream dual-gate contract passed.');

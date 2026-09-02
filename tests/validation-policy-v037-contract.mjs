import fs from 'node:fs';
function read(p){return fs.readFileSync(p,'utf8');}
function assert(ok,msg){if(!ok)throw new Error(msg);}

const pkg=JSON.parse(read('package.json'));
const ci=read('.github/workflows/ci.yml');
const upstream=read('.github/workflows/upstream-compat.yml');
const audit=read('tests/upstream-release-audit-v037.mjs');
const matrix=JSON.parse(read('tests/fixtures/qb-compat-matrix.json'));
const testScript=String(pkg.scripts&&pkg.scripts.test||'');

assert(JSON.stringify(matrix.fastGate)===JSON.stringify(['4.1.9.1','5.2.0']),'daily compatibility must be pinned to qB 4.1.9.1 + 5.2.0');
assert(Array.isArray(matrix.releaseGate)&&matrix.releaseGate.length>=20,'Release compatibility must retain the broad version matrix');
assert(testScript.includes('node tests/compat-v030.mjs'),'daily npm test must exercise the representative compatibility gate');
assert(!/(^|&&\s*)node tests\/release-compat-v037\.mjs(?:\s*&&|$)/.test(testScript),'daily npm test must not execute the full Release compatibility matrix');
assert(testScript.includes('node --check tests/release-compat-v037.mjs'),'Release compatibility source must still receive daily syntax validation');

for(const token of ['qB 4.1.9.1 + 5.2.0 compatibility','release-4.1.9.1','release-5.2.0','--refs=release-4.1.9.1,release-5.2.0'])assert(upstream.includes(token),`representative upstream workflow missing ${token}`);
assert(!upstream.includes('fetch-depth: 0'),'dev upstream workflow must not fetch all qB history/tags');
assert(audit.includes("const fullAudit=requestedRefs.length===0"),'upstream audit must support representative and full Release modes through one owner');
assert(audit.includes("['4.1.9.1','5.2.0']"),'representative upstream audit must pin the two daily baselines');

for(const token of ['release_compatibility:','Full qB Release compatibility audit',"inputs.validation_mode == 'candidate'","github.ref == 'refs/heads/main'",'node tests/release-compat-v037.mjs','Checkout qBittorrent upstream with all release tags','fetch-depth: 0','node tests/upstream-release-audit-v037.mjs upstream-qb'])assert(ci.includes(token),`main Release compatibility job missing ${token}`);
assert(ci.includes('      - release_compatibility\n      - browser\n      - windows_browser')||ci.includes('      - release_compatibility\r\n      - browser\r\n      - windows_browser'),'release candidate package must depend on full qB compatibility + Linux + Windows matrices');
assert(!ci.includes('name: Release compatibility contract\n        run: node tests/release-compat-v037.mjs'),'ordinary smoke must not execute full Release compatibility');

console.log('Validation cost policy passed: daily qB 4.1.9.1 + 5.2.0 only; full qB/platform matrix is main Release-candidate only.');

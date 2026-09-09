import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const workflow=read('.github/workflows/real-qb-full.yml');
const runner=read('tests/real-qb-full-runner-v3.sh');
const provider=read('tests/real-qb-full-provider-lib.sh');
const indexer=read('tests/real-qb-full-runtime-index.mjs');
const matrix=read('tests/real-qb-full-matrix.mjs');

assert(workflow.includes('workflow_dispatch:'),'G-FM must remain explicitly dispatchable.');
assert(workflow.includes("branches: [dev]")&&workflow.includes("'tests/real-qb-full-*.mjs'")&&workflow.includes("'tests/real-qb-full-*.sh'"),'G-FM implementation changes must self-trigger on dev.');
assert(workflow.includes('versions: ${{ steps.matrix.outputs.versions }}')&&workflow.includes('node tests/real-qb-full-matrix.mjs --matrix'),'G-FM must derive its matrix from Frozen LKG.');
assert(workflow.includes('Build paginated historical runtime index')&&workflow.includes('gfm-runtime-index-${{ github.sha }}')&&workflow.includes('WEIG_GFM_RUNTIME_INDEX: runtime-index/linuxserver-tags.json'),'All matrix jobs must consume the same-run exact-SHA historical runtime index.');
assert(workflow.includes('fail-fast: false')&&workflow.includes('max-parallel: 16'),'G-FM must use independent jobs with fail-fast false and max-parallel 16.');
assert(workflow.includes('qb: ${{ fromJson(needs.plan.outputs.versions) }}'),'G-FM matrix must consume the dynamic Frozen version list.');
assert(workflow.includes('real-qb-full-runner-v3.sh --version "$QB_VERSION" --allow-writes'),'G-FM must execute the v3 isolated exact-version runtime runner.');
assert(workflow.includes('if: always()')&&workflow.includes('real-qb-full-${{ matrix.qb }}-${{ github.sha }}')&&workflow.includes('if-no-files-found: error'),'Every version must upload exact-SHA evidence and missing evidence must fail closed.');
assert(workflow.includes('needs: [plan, real]')&&workflow.includes('--aggregate full-evidence')&&workflow.includes('real-qb-full-aggregate-${{ github.sha }}'),'G-FM must have a final exact-SHA aggregate gate.');

for(const status of ['BLOCKED','FAIL','PASS'])assert(runner.includes(`finalize ${status}`),`Runtime runner missing ${status} finalization.`);
for(const name of ['qbittorrentofficial/qbittorrent-nox','linuxserver/qbittorrent','crazymax/qbittorrent','wernight/qbittorrent@sha256:'])assert(runner.includes(name),`G-FM resolver missing approved provider ${name}`);
assert(!runner.includes('justmiles/qbittorrent')&&!provider.includes('justmiles/qbittorrent'),'Unverified justmiles startup contract must not be used by G-FM.');
assert(runner.includes('runtime_index_sha256')&&runner.includes('sha256sum "$INDEX_FILE"'),'Every runtime result must bind the same-run historical index by digest.');
assert(provider.includes('if establish_identity; then identity_rc=0; else identity_rc=$?; fi'),'Identity probing must run in conditional context so expected auth retries cannot be stolen by ERR trap.');
assert(provider.includes('for _ in $(seq 1 30)')&&provider.includes('temporary password is provided for this session'),'Modern qB temporary admin password must be polled like the certified representative runner.');
assert(runner.includes('docker network create --internal')&&!runner.includes('-p 8080:8080'),'G-FM real qB targets must remain private and must not publish WebUI ports.');
assert(provider.includes("resolved=\"$(docker image inspect")&&provider.includes('!= *@sha256:*'),'Mutable provider tags must be locked to immutable RepoDigests before execution.');
assert(provider.includes('[[ "$numeric" == "$VERSION" ]]'),'Resolved runtime must self-report the exact expected qB version.');
assert(runner.includes("CLEANUP_RESULT='PASS'")&&runner.includes('isolated Docker cleanup failed'),'G-FM must fail closed when isolated cleanup fails.');
assert(runner.includes('RUNTIME_ESTABLISHED')&&runner.includes('run_semantics'),'Semantic evidence may run only after exact runtime identity is established.');

assert(indexer.includes('url=data.next||null'),'Historical tag discovery must follow Docker Hub pagination rather than inspect one page.');
assert(indexer.includes('pages>250'),'Historical tag pagination must fail closed if an unexpected unbounded page chain appears.');
assert(indexer.includes("hostname!=='hub.docker.com'")&&indexer.includes("pathname.startsWith('/v2/repositories/linuxserver/qbittorrent/tags')"),'Pagination must remain scoped to the approved LinuxServer Docker Hub endpoint.');
assert(indexer.includes('frozenCatalogSha256:manifest.catalogSha256')&&indexer.includes('frozenProfileCount:manifest.profileCount'),'Historical runtime index must bind Frozen catalog identity.');
assert(indexer.includes('(?=$|[_-]|\\\\d{8})'),'Historical tag matching must preserve exact-version boundaries while admitting legacy timestamp suffixes.');

assert(matrix.includes('manifest.catalogSha256')&&matrix.includes('manifest.profileCount')&&matrix.includes('duplicate qB versions'),'G-FM planner must verify Frozen identity, count and uniqueness.');
assert(matrix.includes("runtime.cleanup_result!=='PASS'")&&matrix.includes('expected one core semantic evidence')&&matrix.includes('expected one Search evidence'),'G-FM aggregate must require cleanup plus core/search semantic evidence for every PASS runtime.');
assert(matrix.includes('pass===f.manifest.profileCount')&&matrix.includes('blocked===0')&&matrix.includes('missing.length===0')&&matrix.includes('duplicates.length===0'),'G-FM aggregate must fail unless every Frozen profile passes with zero missing/duplicate/BLOCKED results.');
console.log('Real-qB Full Frozen Matrix contract passed: same-run paginated runtime index, temp-password-safe exact identity, immutable images, complete evidence and strict 65/65 aggregate are enforced.');

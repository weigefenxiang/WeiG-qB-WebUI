import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const workflow=read('.github/workflows/real-qb-full.yml');
const runner=read('tests/real-qb-full-runner.sh');
const provider=read('tests/real-qb-full-provider-lib.sh');
const indexer=read('tests/real-qb-full-runtime-index.mjs');
const matrix=read('tests/real-qb-full-matrix.mjs');

assert(workflow.includes('workflow_dispatch:'),'G-FM must remain explicitly dispatchable.');
assert(workflow.includes("branches: [dev]")&&workflow.includes("'tests/real-qb-full-*.mjs'")&&workflow.includes("'tests/real-qb-full-*.sh'"),'G-FM implementation changes must self-trigger on dev.');
assert(workflow.includes('versions: ${{ steps.matrix.outputs.versions }}')&&workflow.includes('node tests/real-qb-full-matrix.mjs --matrix'),'G-FM must derive its matrix from Frozen LKG.');
assert(workflow.includes('Build source-backed historical runtime index')&&workflow.includes('gfm-runtime-index-${{ github.sha }}')&&workflow.includes('WEIG_GFM_RUNTIME_INDEX: runtime-index/linuxserver-tags.json'),'All matrix jobs must consume the same-run exact-SHA historical runtime index.');
assert(workflow.includes('fail-fast: false')&&workflow.includes('max-parallel: 16'),'G-FM must use independent jobs with fail-fast false and max-parallel 16.');
assert(workflow.includes('qb: ${{ fromJson(needs.plan.outputs.versions) }}'),'G-FM matrix must consume the dynamic Frozen version list.');
assert(workflow.includes('real-qb-full-runner.sh --version "$QB_VERSION" --allow-writes'),'G-FM must execute the stable-responsibility isolated exact-version runtime runner.');
assert(!workflow.includes('real-qb-full-runner-v'),'G-FM workflow must not use revision-labelled first-party runner filenames.');
assert(workflow.includes('if: always()')&&workflow.includes('real-qb-full-${{ matrix.qb }}-${{ github.sha }}')&&workflow.includes('if-no-files-found: error'),'Every version must upload exact-SHA evidence and missing evidence must fail closed.');
assert(workflow.includes('needs: [plan, real]')&&workflow.includes('--aggregate full-evidence')&&workflow.includes('real-qb-full-aggregate-${{ github.sha }}'),'G-FM must have a final exact-SHA aggregate gate.');

for(const status of ['BLOCKED','FAIL','PASS'])assert(runner.includes(`finalize ${status}`),`Runtime runner missing ${status} finalization.`);
for(const name of ['qbittorrentofficial/qbittorrent-nox','linuxserver/qbittorrent','crazymax/qbittorrent','wernight/qbittorrent@sha256:'])assert(runner.includes(name),`G-FM resolver missing approved provider ${name}`);
assert(!runner.includes('justmiles/qbittorrent')&&!provider.includes('justmiles/qbittorrent'),'Unverified justmiles startup contract must not be used by G-FM.');
assert(runner.includes('runtime_index_sha256')&&runner.includes('sha256sum "$INDEX_FILE"'),'Every runtime result must bind the same-run historical index by digest.');
assert(provider.includes('if establish_identity; then identity_rc=0; else identity_rc=$?; fi'),'Identity probing must run in conditional context so expected auth retries cannot be stolen by ERR trap.');
assert(provider.includes('for _ in $(seq 1 30)')&&provider.includes('temporary password is provided for this session'),'Modern qB temporary admin password must be polled like the certified representative runner.');
assert(provider.includes('[[ -n "$temp" ]] && break')&&provider.includes('reported="$(runtime_version_with_auth \'adminadmin\')" || return 1')&&!provider.includes('if reported="$(runtime_version_with_auth \'adminadmin\')"'),'Temporary-password polling must not send repeated wrong legacy logins before the password appears.');
assert(provider.includes("--write-out '%{http_code}'")&&provider.includes('^(200|204)$')&&provider.includes('QBT_SID_'),'Login success must follow the certified harness contract: HTTP 200/204 plus a qB session cookie.');
assert(provider.includes('--output /dev/null')&&!provider.includes("== 'Ok.'"),'G-FM auth must not require a legacy login response body; current qB can return 204 with no body.');
assert(provider.includes('[[ "$reported" != "$VERSION" && "$reported" != "v$VERSION" ]]')&&provider.includes('RUNTIME_VERSION="$reported"')&&!provider.includes('grep -oE \'[0-9]+(\\.[0-9]+){2,3}\''),'Runtime identity must require an exact stable API version string and reject prerelease/suffix normalization.');
assert(provider.includes('expected stable qB ${VERSION}')&&provider.includes('exact stable qB ${VERSION} identity established'),'Runtime evidence must distinguish exact stable identity from prerelease or mismatched candidates.');
assert(runner.includes('docker network create --internal')&&!runner.includes('-p 8080:8080'),'G-FM real qB targets must remain private and must not publish WebUI ports.');
assert(provider.includes("resolved=\"$(docker image inspect")&&provider.includes('!= *@sha256:*'),'Mutable provider tags must be locked to immutable RepoDigests before execution.');
assert(runner.includes("CLEANUP_RESULT='PASS'")&&runner.includes('isolated Docker cleanup failed'),'G-FM must fail closed when isolated cleanup fails.');
assert(runner.includes('RUNTIME_ESTABLISHED')&&runner.includes('run_semantics'),'Semantic evidence may run only after exact runtime identity is established.');

assert(indexer.includes("execFileSync('git',['ls-remote','--tags','--refs',sourceRepository]"),'Historical candidate discovery must use one source-backed Git tag listing, not anonymous Docker Hub deep pagination.');
assert(indexer.includes("sourceRepository='https://github.com/linuxserver/docker-qbittorrent.git'"),'Historical candidate discovery must use the official LinuxServer qBittorrent source repository.');
assert(indexer.includes("sourceRefPattern:'refs/tags/*'")&&indexer.includes('sourceTagListSha256'),'Historical candidate discovery must bind the exact source tag listing used for candidate discovery.');
assert(!indexer.includes('hub.docker.com/v2/repositories'),'Historical tag discovery must not depend on Docker Hub anonymous deep-pagination REST.');
assert(indexer.includes('frozenCatalogSha256:manifest.catalogSha256')&&indexer.includes('frozenProfileCount:manifest.profileCount'),'Historical runtime index must bind Frozen catalog identity.');
assert(indexer.includes('(?=$|[_-]|\\\\d{8})'),'Historical tag matching must preserve exact-version boundaries while admitting legacy timestamp suffixes.');
assert(indexer.includes("discoveryRole:'candidate-tag-discovery-only; runtime truth still requires immutable image digest and exact qB identity'"),'Source tags must be explicitly scoped to candidate discovery rather than compatibility truth.');

assert(matrix.includes('manifest.catalogSha256')&&matrix.includes('manifest.profileCount')&&matrix.includes('duplicate qB versions'),'G-FM planner must verify Frozen identity, count and uniqueness.');
assert(matrix.includes("runtime.cleanup_result!=='PASS'")&&matrix.includes('expected one core semantic evidence')&&matrix.includes('expected one Search evidence'),'G-FM aggregate must require cleanup plus core/search semantic evidence for every PASS runtime.');
assert(matrix.includes('pass===f.manifest.profileCount')&&matrix.includes('blocked===0')&&matrix.includes('missing.length===0')&&matrix.includes('duplicates.length===0'),'G-FM aggregate must fail unless every Frozen profile passes with zero missing/duplicate/BLOCKED results.');
console.log('Real-qB Full Frozen Matrix contract passed: source-backed candidate index, 200/204 session-cookie auth, ban-safe temp-password polling, exact stable identity, immutable images, complete evidence and strict 65/65 aggregate are enforced.');

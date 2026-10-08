import './real-qb-capability-smoke-contract.mjs';
import '../tests/real-qb-fast-aggregate-contract.mjs';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n?/g,'\n');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const workflow=read('.github/workflows/real-qb-full.yml');
const runner=read('tests/real-qb-full-runner.sh');
const provider=read('tests/real-qb-full-provider-lib.sh');
const indexer=read('tests/real-qb-full-runtime-index.mjs');
const matrix=read('tests/real-qb-full-matrix.mjs');
const binder=read('tests/real-qb-gfm-bind-runtime.mjs');
const preload=read('tests/real-qb-gfm-mode-preload.mjs');
const productBrowser=read('tests/real-qb-browser.mjs');
const representativeDocker=read('tests/real-qb-docker.sh');
assert(representativeDocker.includes('qb-runtime-copy-product.mjs validate "$STAGE/private/data"')&&!representativeDocker.includes('qb-webui-catalog.mjs'),'Real qB browser must stage the exact committed product materialization, never attempt an uncertified Frozen-only catalog repack');
const browserWorkflow=read('.github/workflows/real-qb-weig-product-add.yml');
assert(representativeDocker.includes('elif ((BROWSER_SMOKE)); then')&&representativeDocker.includes('evidence_dir="${WEIG_REAL_QB_EVIDENCE_DIR:-artifacts/real-qb}"'),'Isolated qB browser proof must honor the same evidence directory as upload owner');
assert(browserWorkflow.includes('WEIG_REAL_QB_EVIDENCE_DIR: artifacts/real-qb-weig-add')&&browserWorkflow.includes('path: artifacts/real-qb-weig-add/')&&browserWorkflow.includes('if-no-files-found: error'),'Real qB exact-SHA browser evidence must be uploaded and cannot report PASS without files');
assert(representativeDocker.includes('CERTIFIED_LATEST=')&&representativeDocker.includes('latestAdmittedStable')&&!representativeDocker.includes('latest stable qB 5.2.3'),'Real browser Add Torrent test must target manifest-owned newest admitted version rather than hard-coded prior release');
assert(representativeDocker.includes('if ! resolve_full_matrix_image; then')&&!representativeDocker.includes('Unsupported Phase G representative version'),'Real Add Torrent must inherit the exact-version immutable image resolver for newly admitted Frozen stable releases, never a static Phase G allowlist.');
assert(representativeDocker.includes('ghcr.io/qbittorrent/docker-qbittorrent-nox:${VERSION}')&&representativeDocker.includes("docker image inspect \"$ref\""),'Official DockerHub/GHCR exact tags must resolve to an audited immutable RepoDigest before execution.');

const admissionWorkflow=read('.github/workflows/qb-stable-admit-to-dev.yml');
assert(admissionWorkflow.includes('workflow_dispatch:')&&!admissionWorkflow.includes('\n  push:'),'Already-completed one-use stable source admission must be strictly manual on exact dev SHA');
assert(admissionWorkflow.includes("github.event_name == 'workflow_dispatch'")&&admissionWorkflow.includes('TARGET_SHA: ${{ inputs.target_sha }}')&&admissionWorkflow.includes('SOURCE_RUN_ID: ${{ inputs.source_run_id }}'),'Stable admission must require explicit source evidence and source SHA; no stale default source run');
assert(!admissionWorkflow.includes('37717659549'),'Retired initial source-admission run must not be implicitly replayed');

assert(admissionWorkflow.includes('GH_TOKEN: ${{ github.token }}')&&admissionWorkflow.includes('gh api "/repos/$GITHUB_REPOSITORY/actions/runs?head_sha=$TARGET_SHA&per_page=100"'),'Stable admission final SAFE-REF must authenticate GH CLI status checks with workflow-scoped action-read token.');

const realProductWorkflow=read('.github/workflows/real-qb-weig-product-add.yml');
for(const runtimePath of ['webui/private/data/capabilities.json','webui/private/data/torrent-compat.json','webui/private/data/source-actions.json','webui/private/data/settings-compat.json','webui/private/data/detail-compat.json','webui/private/data/qb-copy-routes/**','webui/private/data/qb-copy-fallback/**','webui/private/data/qb-copy-bindings/**','webui/translations/webui_*.qm','webui/private/scripts/capabilities.js','webui/private/scripts/qb-client.js','webui/private/scripts/app.js','webui/private/scripts/torrent-semantics.js','webui/private/scripts/transfer.js','webui/private/scripts/rss.js','webui/private/scripts/logs.js','tests/real-qb-browser.mjs','VERSION']){
  assert(realProductWorkflow.includes('      - '+runtimePath),'Real qB browser gate must follow actual product capability, source transport, browser witness and version identity changes: '+runtimePath);
}

for(const [name,body] of [['stable-admission',admissionWorkflow],['real-product',realProductWorkflow]]){
  assert(body.includes('npm ci --no-audit --no-fund --prefer-offline')&&body.includes("require('playwright/package.json')")&&body.indexOf('npm ci --no-audit --no-fund --prefer-offline')<body.indexOf('bash tests/real-qb-docker.sh'),'Real-qB '+name+' must install locked Playwright dependencies before headless browser smoke.');
}
assert(representativeDocker.includes('s/__WEIG_GIT_SHA__/${WEIG_SHA}/g')&&representativeDocker.includes("'__WEIG_GIT_SHA__'")&&!representativeDocker.includes('__WEIGG_GIT_SHA__'),'Staged real qB must replace and audit canonical WeiG exact-SHA token.');
assert(productBrowser.includes('name="weig-build-sha"')&&productBrowser.includes('meta[name="weig-build-sha"]')&&!productBrowser.includes('weigg-build-sha'),'Real qB browser must use canonical public/private SHA metadata.');
assert(productBrowser.includes('ephemeral real-qB Docker; outbound network denied')&&representativeDocker.includes('WEIG_REAL_QB_REQUIRE_ADD_TORRENT:-0')&&representativeDocker.includes('! ALLOW_WRITES'),'Synthetic magnet write gate must require a disposable, network-isolated qB and explicit runner write authorization');
assert(productBrowser.includes("WEIG_REAL_QB_REQUIRE_ADD_TORRENT==='1'")&&productBrowser.includes("'#add-btn'")&&productBrowser.includes("'#torrent-urls'")&&productBrowser.includes("'/api/v2/torrents/add'")&&productBrowser.includes("real_qb_torrent_visible:true"),'Real-qB WeiG Add Torrent smoke must be opt-in, use WeiG UI and require daemon confirmation.');
assert(workflow.startsWith('name: Compatibility Audit · Full Frozen\n'),'G-FM workflow name must identify the Full Frozen Matrix owner.');
assert(workflow.includes('workflow_dispatch:'),'G-FM must remain explicitly dispatchable for release-grade Exhaustive evidence.');
assert(!/\n\s*push:\s*/.test(workflow),'Full Frozen Matrix must not fan out on ordinary dev pushes.');
assert(workflow.includes('candidate_sha:')&&workflow.includes('Exact dev SHA (40 hex)'),'G-FM manual dispatch must require the operator to name the final dev exact SHA.');
assert(workflow.includes('confirmation:')&&workflow.includes('RUN-FULL-FROZEN-EXHAUSTIVE'),'G-FM manual dispatch must require an explicit high-cost confirmation token.');
assert(workflow.includes("test \"$GITHUB_EVENT_NAME\" = 'workflow_dispatch'")&&workflow.includes("test \"$GITHUB_REF\" = 'refs/heads/dev'")&&workflow.includes('[[ "$CANDIDATE_SHA" =~ ^[0-9a-fA-F]{40}$ ]]')&&workflow.includes('test "${CANDIDATE_SHA,,}" = "${GITHUB_SHA,,}"'),'G-FM must stay manual-only on dev and bind the exact candidate SHA.');
assert(workflow.includes("test \"$FULL_MATRIX_CONFIRMATION\" = 'RUN-FULL-FROZEN-EXHAUSTIVE'"),'Manual Exhaustive G-FM must require the explicit cost confirmation.');
assert(workflow.indexOf('Verify G-FM execution intent')<workflow.indexOf('Resolve Exhaustive mode and all Frozen stable versions'),'Execution-intent guard must run before the manifest-defined Frozen matrix is resolved.');
assert(workflow.includes('mode: ${{ steps.matrix.outputs.mode }}')&&workflow.includes('matrix: ${{ steps.matrix.outputs.matrix }}')&&workflow.includes('evidence_prefix: ${{ steps.matrix.outputs.evidence_prefix }}'),'G-FM plan must export explicit mode, dynamic matrix and evidence class prefix.');
assert(workflow.includes('mode=exhaustive')&&workflow.includes('evidence_prefix=real-qb-full'),'Manual Compatibility Audit G-FM must select Exhaustive evidence only.');
assert(!workflow.includes('mode=fast')&&!workflow.includes('real-qb-fast-aggregate-${{ github.sha }}'),'Ordinary Fast Frozen evidence must not be wired into the final-only workflow.');
assert(workflow.includes('node tests/real-qb-capability-plan.mjs --matrix "$mode"')&&workflow.includes('= "$EXPECTED_COUNT"')&&workflow.includes('m.profileCount'),'Exhaustive G-FM must derive its exact runtime count from the canonical Frozen manifest.');
assert(workflow.includes('Build source-backed historical runtime index')&&workflow.includes('gfm-runtime-index-${{ github.sha }}')&&workflow.includes('WEIG_GFM_RUNTIME_INDEX: runtime-index/linuxserver-tags.json'),'All matrix jobs must consume the same-run exact-SHA historical runtime index.');
assert(workflow.includes('fail-fast: false')&&workflow.includes('max-parallel: 16'),'G-FM must use independent jobs with fail-fast false and max-parallel 16.');
assert(workflow.includes('include: ${{ fromJson(needs.plan.outputs.matrix) }}'),'G-FM matrix must consume qB/core/search assignments from the capability planner.');
assert(workflow.includes('WEIG_GFM_CORE_MODE: ${{ matrix.coreMode }}')&&workflow.includes('WEIG_GFM_SEARCH_MODE: ${{ matrix.searchMode }}'),'Each runtime job must receive its explicit semantic assignment.');
assert(workflow.includes('real-qb-full-runner.sh --version "$QB_VERSION" --allow-writes'),'G-FM must execute the stable-responsibility isolated exact-version runtime runner.');
assert(!workflow.includes('real-qb-full-runner-v'),'G-FM workflow must not use revision-labelled first-party runner filenames.');
assert(workflow.includes('real-qb-gfm-mode-preload.mjs')&&preload.includes('runCapabilitySmoke'),'Every real runtime must execute the capability witness before semantics.');
assert(workflow.includes('runner_rc=0')&&workflow.includes('binder_rc=0')&&workflow.includes('(( binder_rc == 0 )) || exit "$binder_rc"')&&workflow.includes('(( runner_rc == 0 )) || exit "$runner_rc"'),'G-FM must preserve runtime/smoke evidence through binder finalization and then fail closed.');
assert(workflow.includes('real-qb-gfm-bind-runtime.mjs')&&workflow.includes('--smoke-file "$smoke_file"')&&binder.includes('actual_capability_fingerprint'),'Every runtime must bind actual capability witness evidence to family assignments.');
assert(workflow.includes('if: always()')&&workflow.includes('name: ${{ needs.plan.outputs.evidence_prefix }}-${{ matrix.qb }}-${{ github.sha }}')&&workflow.includes('if-no-files-found: error'),'Every version must upload exact-SHA Exhaustive evidence and missing evidence must fail closed.');
assert(workflow.includes('node tests/real-qb-full-matrix.mjs --aggregate full-evidence')&&workflow.includes('real-qb-full-aggregate-${{ github.sha }}'),'Manual Exhaustive runs must preserve the strict release-grade aggregate artifact.');

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

assert(matrix.includes('manifest.catalogSha256')&&matrix.includes('manifest.profileCount')&&matrix.includes('duplicate qB versions'),'Exhaustive G-FM aggregate must verify Frozen identity, count and uniqueness.');
assert(matrix.includes("runtime.cleanup_result!=='PASS'")&&matrix.includes('expected one core semantic evidence')&&matrix.includes('expected one Search evidence'),'Exhaustive G-FM aggregate must require cleanup plus core/search semantic evidence for every PASS runtime.');
assert(matrix.includes('pass===f.manifest.profileCount')&&matrix.includes('blocked===0')&&matrix.includes('missing.length===0')&&matrix.includes('duplicates.length===0'),'Exhaustive G-FM must fail unless every Frozen profile passes with zero missing/duplicate/BLOCKED results.');
console.log('Real-qB Full Frozen Matrix contract passed: ordinary dev pushes do not start the full manifest-defined matrix; manual exact-SHA RUN-FULL-FROZEN-EXHAUSTIVE remains the explicit exhaustive compatibility audit path.');

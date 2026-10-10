import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8').replace(/\r\n?/g,'\n');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const commands=s=>String(s||'').split('&&').map(x=>x.trim()).filter(Boolean);
const scriptsOf=s=>commands(s).map(x=>x.match(/node\s+(?:tests|audits)\/([^\s]+)/)?.[1]).filter(Boolean);
const jobSection=(src,name,next)=>{
  const marker=`\n  ${name}:\n`;
  const start=src.indexOf(marker);
  assert(start>=0,`Missing job ${name}`);
  const end=next?src.indexOf(`\n  ${next}:\n`,start+marker.length):src.length;
  assert(end>start,`Unable to bound job ${name}`);
  return src.slice(start,end);
};

const pagesPlan=read('tools/pages-verify-plan.mjs');
assert(pagesPlan.includes("baseLane('torrent-scroll-stress','audits/pages-live-torrent-scroll-stress.mjs')")&&pagesPlan.includes("case'ui': return pick(['core','startup-performance','torrent-scroll-stress','mobile-layout'])"),'A68-21: existing Pages verifier owner must execute F5/prefetch browser stress in both UI and full lanes');
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
const version=read('VERSION').trim();
assert(version===pkg.version&&version===lock.version&&version===lock.packages?.['']?.version,'Version sources diverged');
assert(pkg.scripts.test==='npm run test:core','npm test must delegate only to test:core');
assert(pkg.scripts['test:core'].includes('node tests/runtime-asset-contracts.mjs'),'Core must invoke the grouped Runtime Asset owner instead of flattening milestone-era contracts.');
const runtimeAssetGroup=read('tests/runtime-asset-contracts.mjs');
for(const name of ["runtime-asset-plan-contract.mjs","route-module-loading-contract.mjs","runtime-asset-budget-contract.mjs","qb-weig-locale-sharding-contract.mjs","qb-copy-semantic-fingerprint-contract.mjs","qb-qm-first-routing-contract.mjs","bootstrap-inventory-contract.mjs","css-bundle-materializer-contract.mjs","js-bundle-materializer-contract.mjs","bootstrap-topology-contract.mjs","private-bootstrap-contract.mjs"])assert(runtimeAssetGroup.includes(name),'Runtime Asset grouped owner missing '+name);

const core=scriptsOf(pkg.scripts['test:core']);
const compat=scriptsOf(pkg.scripts['test:compat']);
const simulator=scriptsOf(pkg.scripts['test:simulator']);
assert(core.length>=30&&core.length<=40,`test:core must stay in the 30-40 command budget, got ${core.length}`);
assert(core.includes('audit-integrity-contract.mjs'),'Core must prove audits remain executable after moving them out of the routine surface');
assert(simulator.length>=6&&simulator.length<=10,`test:simulator must stay in the 6-10 owner budget, got ${simulator.length}`);
for(const name of core){
  assert(!/^a\d+-/.test(name),`milestone test leaked into core: ${name}`);
  assert(!/^full-stable-/.test(name),`Full Frozen test leaked into core: ${name}`);
  assert(!/^simulator-/.test(name),`simulator suite leaked into core: ${name}`);
  assert(!/^browser-/.test(name),`browser suite leaked into core: ${name}`);
}
assert(compat.includes('full-stable-product-compat.mjs')&&compat.includes('real-qb-full-matrix-contract.mjs'),'Compatibility Audit script must retain Frozen/real-qB compatibility contracts');
assert(simulator.every(name=>/^simulator-/.test(name)),'test:simulator must contain only simulator owner tests');

const driver=read('tests/browser-driver.mjs');
assert(/from\s*['"]playwright['"]/.test(driver)&&driver.includes("DEFAULT_CHANNEL='chrome'"),'browser-driver must remain the sole hosted Chrome owner');
const playwrightFiles=[
  ...fs.readdirSync(path.join(root,'tests')).filter(n=>n.endsWith('.mjs')).map(n=>`tests/${n}`),
  ...fs.readdirSync(path.join(root,'audits')).filter(n=>n.endsWith('.mjs')).map(n=>`audits/${n}`)
];
const direct=playwrightFiles.filter(rel=>rel!=='tests/browser-driver.mjs'&&/from\s*['"]playwright['"]/.test(read(rel)));
assert(direct.length===0,`Playwright ownership duplicated: ${direct.join(', ')}`);

const ci=read('.github/workflows/ci.yml');
assert(ci.includes("github.ref == 'refs/heads/test/A72' && github.run_id || 'shared'")&&ci.includes("cancel-in-progress: ${{ github.ref != 'refs/heads/test/A72' }}"),'A72 unique per-run CI concurrency must preserve queued test runs without changing dev cancellation');
for(const [name,next] of [['ui_browser','settings_browser_matrix'],['settings_browser_matrix','settings_browser_matrix_aggregate'],['settings_browser_matrix_aggregate','release_catalog_extract']]){
  const job=jobSection(ci,name,next);
  assert(job.includes("github.ref == 'refs/heads/test/A72'")&&job.includes("github.ref == 'refs/heads/dev'"),'A72 must be able to run the existing read-only '+name+' validation without changing dev support');
}
for(const [name,next] of [['torrent_runtime_materialize','settings_runtime_materialize'],['settings_runtime_materialize','smoke'],['release_catalog_extract','release_catalog_base'],['release_candidate','native_surface_source_base']]){
  const job=jobSection(ci,name,next);
  assert(job.includes("github.ref == 'refs/heads/dev'")&&!job.includes("github.ref == 'refs/heads/test/A72'"),'Writable/materializing '+name+' must remain dev-only during isolated A72');
}

for(const [jobName,next] of [['installer_lifecycle_linux','installer_lifecycle_busybox'],['installer_lifecycle_busybox','installer_lifecycle_windows'],['installer_lifecycle_windows','ui_browser'],['windows_browser','release_candidate']]){
  const job=jobSection(ci,jobName,next);
  assert(job.includes("[A72-platform]")&&job.includes("github.ref == 'refs/heads/test/A72'"),'Read-only A72 platform gate missing '+jobName);
  assert(!job.includes('gh release')&&!job.includes('contents: write'),'A72 platform validation must never publish from '+jobName);
}
const oldCandidate=jobSection(ci,'release_candidate','native_surface_source_base');
assert(oldCandidate.includes("github.ref == 'refs/heads/dev'")&&!oldCandidate.includes("refs/heads/test/A72"),'dev candidate publication/deployment dispatch must remain inaccessible from A72');
const a72TestRelease=read('.github/workflows/a72-test-release.yml');
const prerelease=jobSection(ci,'a72_prerelease_source_audit','a72_real_qb');
assert(prerelease.includes('[A72-source]')&&prerelease.includes('repository: qbittorrent/qBittorrent')&&prerelease.includes('audits/qb-prerelease-source-audit.mjs')&&prerelease.includes('persist-credentials: false'),'A72 Beta/RC audit must use original upstream exact tags and must not mutate public stable assets');
assert(prerelease.includes('contents: read')&&!prerelease.includes('contents: write')&&!prerelease.includes('gh release'),'A72 prerelease source observation is never a publication owner');
const prereleaseAudit=read('audits/qb-prerelease-source-audit.mjs');
assert(prereleaseAudit.includes('extractPreferenceDescriptors')&&prereleaseAudit.includes('preferenceSourceDelta')&&prereleaseAudit.includes('writeCertified:false'),'Official qB prerelease Settings source drift must be observable and unadmitted through canonical parser, not silently treated as approved writes');

assert(prereleaseAudit.includes('sourceBlobWitnesses')&&prereleaseAudit.includes('sourceActionDelta')&&prereleaseAudit.includes('getFreeSpaceAtPathAction')&&prereleaseAudit.includes('downloadFileAction')&&prereleaseAudit.includes('cloneRuleAction')&&prereleaseAudit.includes('exportRulesAction'),'A72 pinned Beta/RC official source deltas must be audited by the existing sole audits owner rather than a parallel test source loader');

assert(a72TestRelease.includes('[A72-source]')&&a72TestRelease.includes('A72 official Beta/RC source drift (read-only)'),'Final A72 publish requires upstream prerelease source drift evidence on the same exact SHA');
const a72RealQb=jobSection(ci,'a72_real_qb','a72_distribution_integrity');
assert(a72RealQb.includes("github.ref == 'refs/heads/test/A72'")&&a72RealQb.includes('[A72-real-qb]')&&a72RealQb.includes("needs.smoke.result == 'success'"),'A72 real qB evidence must be explicit, exact-SHA and isolated from stable dev');
assert(a72RealQb.includes('tests/real-qb-docker.sh --version "$qb_version" --full-matrix')&&a72RealQb.includes('latestAdmittedStable')&&!a72RealQb.includes('--allow-writes'),'Real-qB A72 must reuse its exact-version Docker owner without enabling destructive product writes');
assert(!a72RealQb.includes('gh release')&&!a72RealQb.includes('contents: write'),'Real-qB A72 evidence must not publish any release artifact');
assert(a72RealQb.includes("qb: ['4.6.7', '5.2.4']")&&a72RealQb.includes('test -s "$evidence"')&&a72RealQb.includes('.status == "PASS"')&&a72RealQb.includes('.cleanup_result == "PASS"')&&a72RealQb.includes('if-no-files-found: error'),'Exact-SHA isolated real-qB evidence must exist and confirm completed Docker cleanup');
const a72Distribution=jobSection(ci,'a72_distribution_integrity','installer_lifecycle_linux');
assert(a72Distribution.includes("github.ref == 'refs/heads/test/A72'")&&a72Distribution.includes("needs.smoke.result == 'success'"),'A72 distribution integrity must be scoped to the isolated test branch and its successful smoke');
assert(a72Distribution.includes('tools/build-webui-dist.mjs')&&a72Distribution.includes('sha256sum -c SHA256SUMS')&&a72Distribution.includes('weig-qb-webui/GIT_SHA')&&a72Distribution.includes('A72.zip'),'A72 must prove the self-contained builder identity and alias before publishing anything');
assert(!a72Distribution.includes('gh release')&&!a72Distribution.includes('upload-artifact')&&!a72Distribution.includes('contents: write'),'A72 distribution verification must not publish a Tag, Release, or intermediate ZIP');
assert(a72TestRelease.includes("for marker in '[ui]' '[settings-matrix]' '[A72-platform]' '[A72-real-qb]' '[A72-source]'")&&a72TestRelease.includes('actions/runs/$run_id/jobs?per_page=100')&&a72TestRelease.includes('qB admitted Settings browser shard')&&a72TestRelease.includes('A72 isolated real qB 4.6.7 source and WebAPI smoke')&&a72TestRelease.includes('A72 isolated real qB 5.2.4 source and WebAPI smoke')&&a72TestRelease.includes('($required | all(. as $name | $passed | index($name) != null))'),'A72 must fail closed on skipped or missing exact-SHA Chrome, Windows, Settings and real-qB jobs before Tag creation');
assert(a72TestRelease.includes('actions: read')&&a72TestRelease.includes('actions/workflows/ci.yml/runs?branch=test%2FA72')&&a72TestRelease.includes('.head_sha == $sha')&&a72TestRelease.includes('No successful completed CI for exact A72 publish SHA'),'A72 publication must fail closed until a matching exact-SHA push CI finishes successfully');
assert(a72TestRelease.includes("contains(github.event.head_commit.message, '[A72-publish]')")&&a72TestRelease.includes('test "$actual" = "$GITHUB_SHA"'),'A72 must never publish without the final explicit marker and fresh target ref');
assert(a72TestRelease.includes('git/ref/tags/test-A72')&&a72TestRelease.includes("gh api --method POST \"repos/$GITHUB_REPOSITORY/git/refs\"")&&a72TestRelease.includes("-f sha=\"$GITHUB_SHA\"")&&a72TestRelease.includes('--verify-tag'),'A72 one-time prerelease must reserve a previously unused Tag at exact Git SHA rather than silently reusing or moving an existing tag');
assert(a72TestRelease.includes('release/A72.zip')&&a72TestRelease.includes('release/SHA256SUMS')&&a72TestRelease.includes('unzip -p release/A72.zip')&&a72TestRelease.includes('gh release create test-A72'),'A72 publication must use a materialized ZIP with exact-SHA and checksummed distribution identity');
assert(ci.includes('node tests/qb-torrent-native-source-contract.mjs'),'Canonical Torrent/Action materializer must gate old qB native UI and locale facts');
assert(!ci.includes('[candidate]'),'Candidate must be workflow_dispatch-only; retired commit-message marker must not return');
const pages=read('.github/workflows/pages.yml'),pagesBuild=read('simulator/build/build-site.mjs');
assert(pages.includes('Probe deployed exact-SHA Pages identity')&&pages.includes('reuse_deployed:')&&pages.includes("needs.build.outputs.reuse_deployed != 'true'"),'Pages must skip repeat deployment only when the same exact SHA is already live');
assert(pages.includes("steps.deployed_identity.outputs.reuse != 'true' && inputs.validation_profile == 'full'")&&pages.includes("steps.deployed_identity.outputs.reuse != 'true' && inputs.validation_profile != 'full'"),'Pages exact-SHA reuse must skip duplicate contract work without duplicating YAML if keys');
assert(pages.includes("needs.deploy.result == 'success' || needs.build.outputs.reuse_deployed == 'true'")&&pages.includes('SITE_BYTES')&&pages.includes('950000000'),'Pages verification must preserve exact-SHA ownership while enforcing a bounded deployment footprint');
assert(pagesBuild.includes("mainProfileRoot")&&pagesBuild.includes("'catalog.source.json'")&&pagesBuild.includes("'catalog.generated.json'"),'Pages site builder must prune source-only catalogs and duplicate main full-catalog evidence only after proving all main runtime profile shards');
const smoke=jobSection(ci,'smoke','installer_lifecycle_linux');
assert(smoke.includes('run: npm test'),'ordinary CI must run Core');
assert(!smoke.includes('full-stable-product-compat'),'ordinary CI must not run Full Frozen compatibility');

const focused=jobSection(ci,'ui_browser','settings_browser_matrix');
for(const name of ['browser-route-module-loading.mjs','browser-runtime.mjs','browser-settings-fidelity.mjs','browser-feature-parity.mjs','browser-torrent-workspace.mjs','browser-adaptive-ui.mjs']) {
  assert(focused.includes(name),`focused Linux UI owner missing ${name}`);
}
for(const retired of ['browser-theme.mjs','browser-feedback.mjs','browser-torrent-detail.mjs','browser-torrent-field-provenance.mjs','browser-sidebar-capability-visual.mjs']) {
  assert(!focused.includes(retired),`duplicate focused browser gate remains: ${retired}`);
}

const linux=jobSection(ci,'browser','windows_browser');
const windows=jobSection(ci,'windows_browser','release_candidate');
for(const name of ['browser-route-module-loading.mjs','browser-runtime.mjs','browser-settings-fidelity.mjs','browser-feature-parity.mjs','browser-torrent-workspace.mjs','browser-adaptive-ui.mjs']) {
  assert(linux.includes(name),`Linux Candidate missing owner scenario ${name}`);
}
for(const retired of ['browser-theme.mjs','browser-feedback.mjs','browser-torrent-detail.mjs','browser-torrent-field-provenance.mjs','browser-sidebar-capability-visual.mjs']) {
  assert(!linux.includes(retired),`Linux Candidate duplicate scenario remains: ${retired}`);
}
assert(windows.includes('node tests/platform-contract.mjs')&&windows.includes('tests/windows-config-encoding.ps1'),'Windows Candidate must own platform/encoding checks');
assert(!windows.includes('npm test'),'Windows Candidate must not duplicate the full Core suite');
const winList=(windows.match(/'tests\/browser-[^']+\.mjs'/g)||[]).map(x=>x.slice(7,-1));
assert(JSON.stringify(winList)===JSON.stringify(['browser-runtime.mjs','browser-settings-fidelity.mjs']),`Windows Candidate browser smoke must be exactly runtime + settings, got ${winList.join(', ')}`);

const candidate=jobSection(ci,'release_candidate','native_surface_source_base');
for(const need of ['smoke','browser','windows_browser','installer_lifecycle_linux','installer_lifecycle_busybox','installer_lifecycle_windows']) {
  assert(candidate.includes(`- ${need}`),`release candidate must wait for ${need}`);
}
assert(candidate.includes('release-candidate-${{ github.sha }}')&&candidate.includes('candidate-deployment-only.yml'),'Candidate must produce exact-SHA artifact and dispatch isolated deployment acceptance');
assert(candidate.includes("github.event_name == 'workflow_dispatch'")&&candidate.includes("inputs.validation_mode == 'candidate'"),'Candidate packaging must have one explicit manual validation-mode trigger');

const deployment=read('.github/workflows/candidate-deployment-only.yml');
assert(deployment.includes('tests/candidate-deployment.sh candidate-artifact'),'Candidate Deployment must retain real qB + Chrome behavior owner');
assert(deployment.includes('candidate-deployment-${{ steps.resolve.outputs.candidate_sha }}'),'Candidate Deployment must publish exact-SHA evidence');

const promote=read('.github/workflows/promote.yml');
assert(!promote.includes('compat_evidence_sha')&&!promote.includes('real-qb-full.yml')&&!promote.includes('real-qb-locale.yml'),'Promotion must not require Compatibility Audit evidence');
assert(promote.includes('release-candidate-${sha}')&&promote.includes('candidate-deployment-${sha}'),'Promotion must require Candidate + Candidate Deployment exact-SHA evidence');
assert(promote.includes('devSha !== sha')&&promote.includes('compare.data.behind_by !== 0'),'Promotion must fresh-check current dev and safe fast-forward ancestry');
assert(promote.includes('default: false')&&promote.includes('publish_after'),'Tag/Release must remain opt-in after Promotion');

for(const rel of ['.github/workflows/real-qb-full.yml','.github/workflows/real-qb-locale.yml']){
  const src=read(rel);
  assert(src.includes('workflow_dispatch:')&&!src.includes('\n  push:'),`${rel} must be manual Compatibility Audit only`);
  assert(src.startsWith('name: Compatibility Audit'),`${rel} must be labeled Compatibility Audit`);
}

const stableReview=read('.github/workflows/qb-stable-source-review.yml');
assert(stableReview.includes('workflow_dispatch:')&&!stableReview.includes('\n  push:'),'New stable source review must be explicit/manual only');
assert(stableReview.includes('candidate_run_id:')&&stableReview.includes('candidate_artifact:')&&!stableReview.includes('qb-5.2.4-source-candidate-')&&!stableReview.includes('37708522138'),'Source review must require fresh exact candidate evidence instead of replaying A64 defaults');

const localeWorkflow=read('.github/workflows/real-qb-locale.yml');
const localeRunner=read('tests/real-qb-locale-runner.sh');
const imageResolver=read('tests/real-qb-docker.sh');
const localeAggregate=read('tests/real-qb-locale-aggregate.mjs');
assert(localeWorkflow.includes('tools/data/qb-stable-lkg.json')&&localeWorkflow.includes('tools/data/qb-locale-lkg.json')&&!localeWorkflow.includes('profileCount!==65')&&!localeWorkflow.includes("latestAdmittedStable!=='5.2.3'"),'Locale plan must derive exact current stable from both certified LKGs');
assert(localeWorkflow.includes('--resolve-image-only')&&localeWorkflow.includes('WEIG_QB_RUNTIME_DIGEST=$pin')&&!localeWorkflow.includes('case "$QB_VERSION" in'),'Locale workflow must reuse canonical exact-version Docker resolver, not own a second version/pin table');
assert(localeWorkflow.includes('Verify checkout before invoking the shared resolver')&&localeWorkflow.includes('ref: ${{ github.sha }}'),'Locale runtime resolver job must checkout exact source SHA before executing the shared provider script');
assert(localeRunner.includes('WEIG_QB_RUNTIME_DIGEST')&&localeRunner.includes('--resolve-image-only')&&!localeRunner.includes('IMAGE_PIN='),'Locale runner must consume immutable runtime provenance instead of hardcoding an earlier stable');
assert(imageResolver.includes('--resolve-image-only')&&localeAggregate.includes('imageDigests'),'Locale evidence must share one exact immutable runtime across all locales');

const realProductAdd=read('.github/workflows/real-qb-weig-product-add.yml');
// The real product smoke runs on certified Frozen changes, not on merely editing the workflow or tests.

assert(realProductAdd.startsWith('name: Real qB WeiG Product Add Torrent\n'),'Real qB Add Torrent product verification must have an independent CI workflow owner');
assert(realProductAdd.includes('contents: read')&&!realProductAdd.includes('contents: write'),'Real product Add Torrent workflow must be read-only');
assert(realProductAdd.includes("WEIG_REAL_QB_REQUIRE_ADD_TORRENT: '1'")&&realProductAdd.includes('--browser-smoke --allow-writes'),'Product Add Torrent must use explicit disposable Docker write consent and actual WeiG browser dialog');
const automaticPaths=realProductAdd.match(/\n    paths:\n([\s\S]*?)\n  workflow_dispatch:/);
assert(automaticPaths,'Real qB workflow must retain a bounded dev push path filter and manual re-run');
const realProductPathSet=new Set([...automaticPaths[1].matchAll(/^      - (.+)$/gm)].map(match=>match[1].trim().replace(/^['"]|['"]$/g,'')));
for(const requiredPath of ['tools/data/qb-stable-lkg.json','tests/fixtures/qb-release-catalog.lkg.json','.github/workflows/real-qb-weig-product-add.yml','tests/real-qb-docker.sh','tests/real-qb-browser.mjs','audits/real-qb-full-matrix-contract.mjs','tests/real-qb-fast-aggregate-contract.mjs','webui/private/data/capabilities.json','webui/private/data/torrent-compat.json','webui/private/data/source-actions.json','webui/private/data/settings-compat.json','webui/private/data/detail-compat.json','webui/private/data/qb-copy-routes/**','webui/private/data/qb-copy-fallback/**','webui/private/data/qb-copy-bindings/**','webui/translations/webui_*.qm','webui/private/scripts/app.js','webui/private/scripts/qb-client.js','webui/private/scripts/capabilities.js','webui/private/scripts/settings.js','webui/private/scripts/i18n.js','webui/private/scripts/transfer.js','webui/private/scripts/rss.js','webui/private/scripts/logs.js','webui/private/scripts/torrent-semantics.js','VERSION','webui/VERSION']){
  assert(realProductPathSet.has(requiredPath),'Real qB exact-product gate must react to certified source, Copy/QM, product UI and test changes: '+requiredPath);
}
assert(!realProductPathSet.has('.github/workflows/real-qb-full.yml')&&!realProductPathSet.has('main')&&realProductAdd.includes('branches: [dev]'),'Real qB product smoke must remain dev-only and must not fan out full Frozen audits');
assert(realProductAdd.includes('qb-stable-lkg.json')&&realProductAdd.includes('latestAdmittedStable'),'Real product acceptance must track newest source-admitted Frozen version automatically');
assert(realProductAdd.includes('github.sha')&&realProductAdd.includes('persist-credentials: false'),'Product real-qB evidence must be exact-SHA isolated without repo write credentials');
const stableSourceReview=read('.github/workflows/qb-stable-source-review.yml');
assert(stableSourceReview.startsWith('name: qB Stable Source Admission Review\n'),'Official source staging must have one independently auditable workflow owner');
assert(stableSourceReview.includes('contents: read')&&stableSourceReview.includes('actions: read'),'Source staging must have read-only GitHub permissions');
for(const forbidden of ['contents: write','actions: write','git push','git commit','update-ref','refs/heads/main'])assert(!stableSourceReview.includes(forbidden),'Source-only admission workflow must not contain ref-write capability: '+forbidden);
assert(stableSourceReview.includes('persist-credentials: false'),'Official source checkout must not keep write credentials');
assert(stableSourceReview.includes('qb-stable-admission.mjs verify-candidate-source')&&stableSourceReview.includes('qb-stable-admission.mjs stage-candidate'),'Staging must prove official SHA and Frozen append-only identity before generation');
assert(stableSourceReview.includes('node tools/qb-locale-source.mjs')&&stableSourceReview.includes('--merge source-stage/qb-release-catalog.lkg.json'),'Staging must consume existing qB Locale/Settings/QM generators');
assert(stableSourceReview.includes('max-parallel: 8')&&stableSourceReview.includes('shard: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]'),'Canonical source enrichment may use 16 shards but only eight parallel workers');
assert(stableSourceReview.includes('node audits/qb-translator-behavior-append-contract.mjs'),'Source review must execute translator append positive/negative regression before all-source materialization');
assert(stableSourceReview.includes('node tools/qb-translator-behavior-append.mjs upstream-qb')&&stableSourceReview.includes('--behavior=source-stage/qb-translator-behavior.json'),'Candidate translator semantics must append only exact new tag evidence onto the unchanged certified historical prefix.');
assert(stableSourceReview.includes('Translator behavior exact-source proof')&&stableSourceReview.includes('row.sourceSha!==behavior.sourceSha'),'Source-staged translator families must be matched to every exact profile before Copy/QM materialization.');
assert(stableSourceReview.includes('node audits/full-stable-taxonomy-compat.mjs source-stage/qb-release-catalog.lkg.json')&&stableSourceReview.includes('node audits/full-stable-core-write-compat.mjs source-stage/qb-release-catalog.lkg.json'),'Full 66 source candidate must audit taxonomy and source-owned Torrent writes; 66 product runtime check follows materialization');
assert(stableSourceReview.includes('full_preferences_shard:')&&stableSourceReview.includes('full_preferences_census:')&&stableSourceReview.includes('max-parallel: 8'),'Full native Settings source admission must use the shared bounded shard extraction architecture');
assert(stableSourceReview.includes('qb-preferences-surface-source.mjs --merge source-stage/qb-release-catalog.lkg.json')&&stableSourceReview.includes('full-stable-preferences-source-contract.mjs preferences-full/source.json'),'66-profile Preferences native Settings must be independently enumerated and proven from official source');
assert(stableSourceReview.includes('qb-preferences-compact.mjs preferences-full/source.json preferences-full/settings-compact.json'),'Admitted native Settings compact must consume the identical 66-profile Frozen source identity');
assert(stableSourceReview.includes('node audits/full-stable-qbt-entity-source-contract.mjs source-stage/latest-source-only.json'),'Latest qB WebUI copy source entities must undergo independent QBT_TR census before admission');
assert(stableSourceReview.includes('node audits/full-stable-core-write-compat.mjs source-stage/qb-release-catalog.lkg.json')&&stableSourceReview.includes('node audits/full-stable-detail-compat.mjs source-stage/qb-release-catalog.lkg.json'),'Candidate Torrent writes and Detail must pass product-compatible source-proven compact audits before admission');
assert(stableSourceReview.includes('node tools/qb-stable-stage-compact.mjs')&&stableSourceReview.includes('qb-stable-canonical-source-evidence-'),'Compact staged domains and source artifact must use the same exact run identity');
assert(!stableSourceReview.includes('node audits/full-stable-product-compat.mjs source-stage/qb-release-catalog.lkg.json'),'Never execute product runtime identity tests against a source-only 66 candidate while committed product runtime is not yet the same admitted release-set');
assert(stableSourceReview.includes('PENDING')&&!stableSourceReview.includes('PRODUCT_CERTIFIED'),'Source staging cannot silently admit new versions as product-verified');

console.log(`A61 CI contract passed: core=${core.length}, simulator=${simulator.length}, compatibility=${compat.length}; Candidate and Promotion are risk-tiered.`);

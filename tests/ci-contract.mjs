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

const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
const version=read('VERSION').trim();
assert(version===pkg.version&&version===lock.version&&version===lock.packages?.['']?.version,'Version sources diverged');
assert(pkg.scripts.test==='npm run test:core','npm test must delegate only to test:core');
assert(pkg.scripts['test:core'].includes('node tests/runtime-asset-contracts.mjs'),'Core must invoke the grouped Runtime Asset owner instead of flattening milestone-era contracts.');
const runtimeAssetGroup=read('tests/runtime-asset-contracts.mjs');
for(const name of ["runtime-asset-plan-contract.mjs","route-module-loading-contract.mjs","runtime-asset-budget-contract.mjs","qb-weig-locale-sharding-contract.mjs","qb-copy-semantic-fingerprint-contract.mjs","qb-qm-first-routing-contract.mjs","bootstrap-inventory-contract.mjs","bootstrap-topology-contract.mjs","private-bootstrap-contract.mjs"])assert(runtimeAssetGroup.includes(name),'Runtime Asset grouped owner missing '+name);

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
assert(!ci.includes('[candidate]'),'Candidate must be workflow_dispatch-only; retired commit-message marker must not return');
const pages=read('.github/workflows/pages.yml'),pagesBuild=read('simulator/build/build-site.mjs');
assert(pages.includes('Probe deployed exact-SHA Pages identity')&&pages.includes('reuse_deployed:')&&pages.includes("needs.build.outputs.reuse_deployed != 'true'"),'Pages must skip repeat deployment only when the same exact SHA is already live');
assert((pages.match(/steps\.deployed_identity\.outputs\.reuse != 'true'/g)||[]).length>=8,'Pages exact-SHA reuse must skip duplicate contracts, materialization and deployment work while preserving live verification');
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

console.log(`A61 CI contract passed: core=${core.length}, simulator=${simulator.length}, compatibility=${compat.length}; Candidate and Promotion are risk-tiered.`);

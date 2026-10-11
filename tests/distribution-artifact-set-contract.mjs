import assert from 'node:assert/strict';
import fs from 'node:fs';
const builder=fs.readFileSync(new URL('../tools/build-webui-dist.mjs',import.meta.url),'utf8');
const sh=fs.readFileSync(new URL('../installers/install.sh',import.meta.url),'utf8');
const site=fs.readFileSync(new URL('../simulator/build/build-site.mjs',import.meta.url),'utf8');
assert.ok(builder.includes("rootFolder='weig-qb-webui'"));
assert.ok(builder.includes("${rootFolder}.zip")&&builder.includes("${rootFolder}.tar.gz"));
assert.ok(builder.includes("schemaVersion:6")&&builder.includes("unixArchive:")&&builder.includes("zipArchive:")&&builder.includes("preferred:{unix:'tar.gz',windows:'zip'}"));
assert.ok(builder.includes("artifacts:{tarGz:")&&builder.includes("manifest.json")&&builder.includes("SHA256SUMS"));
assert.ok(builder.includes("weigLocaleLayout:'private/data/weig-i18n/<locale>.json'")&&builder.includes('weigLocaleFiles:runtime.weigLocaleFiles')&&builder.includes('weigLocaleBytes:runtime.weigLocaleBytes'),'distribution manifest must carry WeiG locale shard identity/count/bytes');
assert.ok(sh.includes("prepare_manifest_dist()")&&sh.includes('dist_root" = "weig-qb-webui"')&&sh.includes('dist_tar" = "weig-qb-webui.tar.gz"')&&sh.includes('dist_zip" = "weig-qb-webui.zip"'));
assert.ok(sh.includes("command -v tar")&&sh.includes("has_busybox_applet tar"));
assert.ok(sh.includes('PACKAGE_NAME="WeiG-qB-WebUI.zip"'),'historical stable Releases keep one bounded legacy ZIP reader');
assert.ok(sh.includes("missing manifest.json; refusing legacy/raw fallback"),'dev must require the canonical artifact manifest');
assert.ok(sh.includes("package_name=$3"),'checksum owner must verify the selected artifact by filename');
assert.equal((sh.match(/verify_release_checksum "\$TMP\/SHA256SUMS" "\$TMP\/manifest\.json" "manifest\.json"/g)||[]).length,3,'test Prerelease, stable canonical and dev manifest consumers must verify manifest.json against SHA256SUMS before parsing/selection');
assert.ok(site.includes("downloads/dev/manifest.json")&&site.includes("downloads/dev/weig-qb-webui.tar.gz")&&site.includes("downloads/dev/weig-qb-webui.zip"));
console.log('Distribution artifact-set contract passed.');

// Rolling Dev A73 uses the canonical Pages owner, not the retired Test release job.
const pagesWorkflow=fs.readFileSync(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
const publishJob=pagesWorkflow.split('  publish_dev_a73:')[1]||'';
const gateBegin=publishJob.indexOf('jq -e --arg sha "$GITHUB_SHA"');
const expressionStart=publishJob.indexOf("'",gateBegin)+1;
const expressionEnd=publishJob.indexOf("' >/dev/null",expressionStart);
assert.ok(gateBegin>=0&&expressionStart>gateBegin&&expressionEnd>expressionStart,
  'A73 Dev release must validate every actual CI job against the source SHA');
const gateExpr=publishJob.slice(expressionStart,expressionEnd);
const lookupMarker='jq -c --arg sha "$GITHUB_SHA" ';
const lookupBegin=publishJob.indexOf(lookupMarker);
const lookupExpressionStart=publishJob.indexOf("'",lookupBegin)+1;
const lookupExpressionEnd=publishJob.indexOf("')\"",lookupExpressionStart);
assert.ok(lookupBegin>=0&&lookupExpressionStart>lookupBegin&&lookupExpressionEnd>lookupExpressionStart,
  'A73 Dev exact CI selection must be a valid jq query');
const lookupExpr=publishJob.slice(lookupExpressionStart,lookupExpressionEnd);

if(process.platform==='linux'){
  const {spawnSync}=await import('node:child_process');
  const required=['smoke','Linux semantic UI · adaptive-ui','Linux semantic UI · runtime'];
  const success={total_count:required.length,jobs:required.map(name=>({name,head_sha:'a73-exact',conclusion:'success'}))};
  const check=fixture=>spawnSync('jq',['-e','--arg','sha','a73-exact',gateExpr],{
    input:JSON.stringify(fixture),encoding:'utf8',timeout:3000});
  const lookups={workflow_runs:[
    {id:1,head_sha:'a73-exact',event:'push',status:'completed',conclusion:'success'},
    {id:2,head_sha:'a73-exact',event:'workflow_dispatch',status:'completed',conclusion:'success'},
    {id:3,head_sha:'other',event:'push',status:'completed',conclusion:'success'}]};
  const chosen=spawnSync('jq',['-c','--arg','sha','a73-exact',lookupExpr],{
    input:JSON.stringify(lookups),encoding:'utf8',timeout:3000});
  assert.equal(chosen.status,0,'Dev CI selection jq must compile: '+chosen.stderr);
  assert.equal(JSON.parse(chosen.stdout).id,1,'Dev CI selection must reject another event/SHA');
  const green=check(success);
  assert.equal(green.status,0,'A73 Dev gate must accept complete exact-SHA CI jobs: '+green.stderr);
  assert.equal(check({...success,jobs:success.jobs.slice(0,-1)}).status,1,
    'A73 Dev release gate must reject missing Runtime browser verification');
  assert.equal(check({...success,jobs:success.jobs.map(job=>({...job,head_sha:'wrong'}))}).status,1,
    'A73 Dev release gate must reject different job SHA');
}

// A73 Pages preview uses the canonical distribution archive and must satisfy its own
// exact-SHA/sha256 contract without consuming an extra CI smoke command.
await import('./pages-plan-download-alias-contract.mjs');

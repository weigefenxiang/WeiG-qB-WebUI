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

// A73 immutable test publication must reject missing exact-SHA shards, not fail
// on jq syntax once a release-only workflow is finally authorized.
const a73Workflow=fs.readFileSync(new URL('../.github/workflows/a73-test-release.yml',import.meta.url),'utf8');
const gateMatch=a73Workflow.match(/jq -e --arg sha "\$GITHUB_SHA" '\r?\n([\s\S]*?)\r?\n\s*' <<<"\$jobs"/);
assert.ok(gateMatch,'A73 release must have a real exact-SHA jq job matrix gate');
if(process.platform==='linux'){
  const {spawnSync}=await import('node:child_process');
  const required=['smoke','Linux semantic UI · route-modules','Linux semantic UI · runtime',
    'Linux semantic UI · settings-fidelity','Linux semantic UI · feature-parity',
    'Linux semantic UI · torrent-workspace','Linux semantic UI · adaptive-ui',
    'qB admitted Settings browser aggregate',
    ...Array.from({length:16},(_,i)=>'qB admitted Settings browser shard '+i)];
  const success={total_count:required.length,jobs:required.map(name=>({name,head_sha:'a73-exact',conclusion:'success'}))};
  const check=fixture=>spawnSync('jq',['-e','--arg','sha','a73-exact',gateMatch[1]],{
    input:JSON.stringify(fixture),encoding:'utf8',timeout:3000});
  const green=check(success);
  assert.equal(green.status,0,'A73 complete gate must compile and accept every required exact-SHA job: '+green.stderr);
  assert.equal(check({...success,total_count:success.total_count-1,jobs:success.jobs.slice(0,-1)}).status,1,
    'A73 release gate must reject one missing Settings shard');
  assert.equal(check({...success,jobs:success.jobs.map(job=>({...job,head_sha:'wrong-sha'}))}).status,1,
    'A73 release gate must reject incorrect job SHA');
}

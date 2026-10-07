import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {copyRouteDescriptor,copyRouteId} from '../tools/qb-runtime-copy-shards.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=path.join(root,'webui/private/data');
const capabilities=JSON.parse(fs.readFileSync(path.join(dataDir,'capabilities.json'),'utf8'));
const releases=new Map((capabilities.releases||[]).map(row=>[String(row.qbVersion),row]));
function profile(version){
  const release=releases.get(version);assert.ok(release,'missing admitted release '+version);
  const file=path.join(dataDir,'qb-copy-profiles',release.sourceSha+'.json');
  return{release,profile:JSON.parse(fs.readFileSync(file,'utf8'))};
}
const p465=profile('4.6.5'),p466=profile('4.6.6'),p467=profile('4.6.7');
for(const item of [p465,p466,p467])assert.equal(item.release.webApiVersion,'2.9.3','qB 4.6.5/6/7 must remain one WebAPI 2.9.3 family');
assert.equal(p465.profile.bindingId,p466.profile.bindingId);
assert.equal(p466.profile.bindingId,p467.profile.bindingId,'same WebAPI family may and should reuse identical source/context binding');
const r465=copyRouteId(p465.profile),r466=copyRouteId(p466.profile),r467=copyRouteId(p467.profile);
assert.notEqual(r466,r467,'copy equivalence must split when official locale ownership/translation facts change even if WebAPI is unchanged');
const sameSemantics={...p466.profile,sourceSha:'f'.repeat(40),qbVersion:'9.9.9'};
assert.equal(copyRouteId(sameSemantics),r466,'exact release/source identity is provenance and must not force a second semantic copy route');
const changedBinding={...p466.profile,bindingId:'b'+'0'.repeat(20)};
assert.notEqual(copyRouteId(changedBinding),r466,'binding semantics must participate in the copy route fingerprint');
const changedFallback={...p466.profile,fallbackSets:{...p466.profile.fallbackSets,zh_CN:'t'+'0'.repeat(20)}};
assert.notEqual(copyRouteId(changedFallback),r466,'official fallback-set identity must participate in the copy route fingerprint');
const descriptor=copyRouteDescriptor(p466.profile);
assert.equal(Object.hasOwn(descriptor,'sourceSha'),false);
assert.equal(Object.hasOwn(descriptor,'qbVersion'),false);
assert.equal(Object.hasOwn(descriptor,'webApiVersion'),false);
console.log(JSON.stringify({kind:'A62_7_COPY_SEMANTIC_FINGERPRINT',webApiFamily:'2.9.3',releases:['4.6.5','4.6.6','4.6.7'],bindingId:p466.profile.bindingId,routeIds:{'4.6.5':r465,'4.6.6':r466,'4.6.7':r467}},null,2));

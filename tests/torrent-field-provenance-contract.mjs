import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const source=fs.readFileSync(path.join(root,'webui/private/scripts/torrent-fields.js'),'utf8');
let saved={mobileFields:['status','progress','dl','up','future_metric']};
const W={
  util:{formatBytes:v=>String(v),percent:v=>Number(v)*100,formatSpeed:v=>String(v),formatEta:v=>String(v),formatRatio:v=>String(v),trackerLabel:v=>String(v)},
  Config:{load:()=>JSON.parse(JSON.stringify(saved)),save:value=>{saved=JSON.parse(JSON.stringify(value));}},
  Components:{state:code=>[String(code),'']},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:{current:()=>null}
};
const window={WeiG:W};window.window=window;
vm.runInNewContext(source,{window,console,Date,Number},{filename:'torrent-fields.js'});
const F=W.TorrentFieldRegistry;
assert.ok(F,'TorrentFieldRegistry must load');
const expected=['name','size','progress','dlspeed','upspeed','eta','state','ratio','tracker','category','tags','num_seeds','num_leechs','save_path','added_on','completion_on','priority'];
assert.deepEqual(Array.from(F.fields,x=>x.key),expected,'Phase E must formalize exactly the current 17 product fields');
assert.equal(new Set(F.fields.map(x=>x.key)).size,17,'field keys must remain unique');
assert.equal(F.canonical('status'),'state');assert.equal(F.canonical('dl'),'dlspeed');assert.equal(F.canonical('up'),'upspeed');
for(const field of F.fields){assert.ok(!field.sourceAliases,'current real field descriptors must not invent historical source aliases');assert.ok(!field.derivedFrom,'current real field descriptors must not invent derivation provenance');}
const certified={fallback:false,officialWeiGSupport:true,torrentInfoFields:['name','legacy_name','size','progress']};
assert.equal(F.resolveProvenance({key:'name'},certified).mode,'NATIVE');
const normalized=F.resolveProvenance({key:'canonical_name',source:'canonical_name',sourceAliases:['legacy_name']},certified);assert.equal(normalized.mode,'NORMALIZED');assert.equal(normalized.sourceField,'legacy_name');
const derived=F.resolveProvenance({key:'display_metric',derivedFrom:['size','progress']},certified);assert.equal(derived.mode,'DERIVED');assert.deepEqual(Array.from(derived.derivedFrom),['size','progress']);
assert.equal(F.resolveProvenance({key:'missing'},certified).mode,'UNAVAILABLE');
assert.equal(F.resolveProvenance({key:'name'},{fallback:true,torrentInfoFields:['name']}).mode,'UNKNOWN');
assert.equal(F.resolveProvenance({key:'name'},{fallback:false,officialWeiGSupport:true}).mode,'UNKNOWN');
assert.equal(F.provenance('not-a-field',certified).mode,'UNKNOWN');
assert.deepEqual(Array.from(F.mobileFields()),['state','progress','dlspeed','upspeed'],'legacy WeiG preference aliases must canonicalize without becoming source aliases');
const profile={fallback:false,officialWeiGSupport:true,torrentInfoFields:['state','progress','dlspeed']};
assert.deepEqual(Array.from(F.effectiveMobileFields(profile)),['state','progress','dlspeed'],'effective fields must hide source-unavailable saved metrics');
F.saveEffectiveMobileFields(['progress','state'],profile);
assert.deepEqual(saved.mobileFields,['progress','state','upspeed'],'temporarily unavailable saved fields must survive effective preference edits');
console.log('Torrent field provenance contract passed: one 17-field owner resolves native/normalized/derived/unavailable/unknown semantics and preserves hidden mobile preferences.');

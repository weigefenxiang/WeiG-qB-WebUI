import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const source=fs.readFileSync(path.join(root,'webui/private/scripts/torrent-fields.js'),'utf8');
const appSource=fs.readFileSync(path.join(root,'webui/private/scripts/app.js'),'utf8');
let saved={mobileFields:['status','progress','dl','up','future_metric'],columns:[{key:'name',width:500},{key:'ratio',width:130},{key:'future_metric',width:90},{key:'size',width:120}]};
const W={
  util:{formatBytes:v=>String(v),percent:v=>Number(v)*100,formatSpeed:v=>String(v),formatEta:v=>String(v),formatRatio:v=>String(v),trackerLabel:v=>String(v)},
  Config:{load:()=>JSON.parse(JSON.stringify(saved)),save:value=>{saved=JSON.parse(JSON.stringify(value));}},
  Components:{state:code=>[String(code),'']},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:{current:()=>null},
  DataGrid:{defaults:[]}
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
const certified={fallback:false,officialWeiGSupport:true,torrentInfoFields:['name','legacy_name','size','progress','added_on']};
assert.equal(F.resolveProvenance({key:'name'},certified).mode,'NATIVE');
const normalized=F.resolveProvenance({key:'canonical_name',source:'canonical_name',sourceAliases:['legacy_name']},certified);assert.equal(normalized.mode,'NORMALIZED');assert.equal(normalized.sourceField,'legacy_name');
const derived=F.resolveProvenance({key:'display_metric',derivedFrom:['size','progress']},certified);assert.equal(derived.mode,'DERIVED');assert.deepEqual(Array.from(derived.derivedFrom),['size','progress']);
assert.equal(F.resolveProvenance({key:'missing'},certified).mode,'UNAVAILABLE');
assert.equal(F.resolveProvenance({key:'name'},{fallback:true,torrentInfoFields:['name']}).mode,'UNKNOWN');
assert.equal(F.resolveProvenance({key:'name'},{fallback:false,officialWeiGSupport:true}).mode,'UNKNOWN');
assert.equal(F.provenance('not-a-field',certified).mode,'UNKNOWN');
assert.deepEqual(Array.from(F.mobileFields()),['state','progress','dlspeed','upspeed'],'legacy WeiG preference aliases must canonicalize without becoming source aliases');
const profile={fallback:false,officialWeiGSupport:true,torrentInfoFields:['name','state','progress','dlspeed','size','added_on']};
assert.deepEqual(Array.from(F.effectiveMobileFields(profile)),['state','progress','dlspeed'],'effective fields must hide source-unavailable saved metrics');
F.saveEffectiveMobileFields(['progress','state'],profile);
assert.deepEqual(saved.mobileFields,['progress','state','upspeed'],'temporarily unavailable saved fields must survive effective mobile preference edits');
saved.columns=[{key:'name',width:500},{key:'ratio',width:130},{key:'size',width:120}];
assert.deepEqual(Array.from(F.effectiveDesktopColumns(saved,profile),x=>[x.key,x.width]),[['name',500],['size',120]],'desktop effective columns must filter unavailable saved fields without mutating stored intent');
assert.deepEqual(saved.columns,[{key:'name',width:500},{key:'ratio',width:130},{key:'size',width:120}],'reading effective desktop columns must not rewrite saved preferences');
F.saveEffectiveDesktopColumns(saved,[{key:'size',width:140},{key:'name',width:520}],profile);
assert.deepEqual(saved.columns,[{key:'size',width:140},{key:'ratio',width:130},{key:'name',width:520}],'editing available desktop columns must retain hidden unavailable preferences');
const richer={fallback:false,officialWeiGSupport:true,torrentInfoFields:['name','ratio','size','added_on']};
assert.deepEqual(Array.from(F.effectiveDesktopColumns(saved,richer),x=>x.key),['size','ratio','name'],'restored source capability must reactivate preserved desktop preferences');
assert.equal(F.fields.some(field=>'serverSort' in field||'sortable' in field),false,'field provenance must not invent server-side sort support');
assert.ok(appSource.includes('R.effectiveDesktopColumns(cfg)'),'app runtime must derive active desktop columns from the field registry after release detection');
assert.ok(appSource.includes('R.saveEffectiveDesktopColumns(cfg,cols)'),'desktop column edits/resizes must preserve hidden saved preferences through the field registry');
const releaseBind=appSource.indexOf('await W.CapabilityRegistry.bind(app.client)');
const columnRebind=appSource.indexOf('applyEffectiveColumns();',releaseBind);
assert.ok(releaseBind>=0&&columnRebind>releaseBind&&appSource.slice(0,releaseBind).indexOf('applyEffectiveColumns();')<0,'desktop effective columns must be rebound only after the exact ReleaseProfile is available');
console.log('Torrent field provenance contract passed: one 17-field owner resolves provenance, preserves hidden mobile/desktop preferences, and does not infer server sort support from field presence.');

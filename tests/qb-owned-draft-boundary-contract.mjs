import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

// Prove the qB column-label owner; these draft claims are not full runtime QA.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const mapping={
  'torrent.size':'size','torrent.progress':'progress',
  'torrent.download':'dlspeed','torrent.upload':'upspeed',
  'torrent.status':'state','torrent.categoryColumn':'category'
};
const file='webui/private/scripts/torrent-fields.js';
const calls=[];
const W={util:{},Config:{load:()=>({}),save:()=>{}},
  I18n:{qbText:(key,fallback)=>{calls.push(key);return key.startsWith('column.')?'QB:'+key:fallback;},
    t:key=>{throw new Error('WeiG copy used for qB column: '+key);}},
  DataGrid:{defaults:[]}};
const window={WeiG:W};window.window=window;
vm.runInNewContext(read(file),{window,console,Date,Number,Set},{filename:file});
const R=W.TorrentFieldRegistry;
assert.ok(R,'TorrentFieldRegistry did not initialize');
calls.length=0;
for(const [weiGKey,field] of Object.entries(mapping)){
  assert.equal(R.label(field),'QB:column.'+field,'Wrong column owner: '+weiGKey);
  assert.equal(R.column(field).label,'QB:column.'+field,'Wrong table heading owner: '+weiGKey);
}
const columns=Object.values(mapping).map(key=>({key,caption:'SOURCE '+key,
  defaultWidth:100,defaultVisible:true,dataProperties:[key]}));
const profile={fallback:false,officialWeiGSupport:true,
  torrentInfoFields:Object.values(mapping),torrentTableColumns:columns};
const native=R.sourceOrderedColumnDefinitions(profile);
assert.deepEqual(Array.from(native,c=>c.key),Object.values(mapping));
for(const col of native){
  assert.equal(col.label,'QB:column.'+col.key,'Native qB column label bypassed official copy');
  assert.equal(col.configLabel,'QB:column.'+col.key,'Native column checkbox bypassed official copy');
}
assert.equal(calls.length,24,'Every tested column surface must use the qB copy owner');
W.I18n.qbText=(_key,fallback)=>fallback;
for(const field of Object.values(mapping)){
  assert.equal(R.label(field),R.get(field).en,'Missing qB copy must preserve source field label');
}
for(const col of R.sourceOrderedColumnDefinitions(profile)){
  assert.equal(col.label,'SOURCE '+col.key,'Missing native qB translation must preserve source caption');
}

// Static literal coverage cannot prove the absence of dynamic or runtime callers.
// A future direct use must force a fresh ownership audit, as torrent.name did.
const literal=/(['"])torrent\.(?:size|progress|download|upload|status|categoryColumn)\1/u;
const dir=path.join(root,'webui/private/scripts');
const scriptNames=fs.readdirSync(dir).filter(name=>name.endsWith('.js')&&name!=='i18n.js');
for(const name of scriptNames){
  const jsFile='webui/private/scripts/'+name;
  assert.doesNotMatch(read(jsFile),literal,'Possible new WeiG UI caller in '+jsFile);
}
for(const htmlFile of ['webui/private/index.html','webui/private/views/preferences.html',
  'webui/public/index.html','webui/public/login.html']){
  assert.doesNotMatch(read(htmlFile),literal,'Possible HTML caller in '+htmlFile);
}

const localeDir=path.join(root,'language-packs/weig-i18n');
const locales=fs.readdirSync(localeDir).filter(name=>name.endsWith('.json'));
assert.equal(locales.length,48,'Review inventory lost a draft language');
let claims=0;
const fallbackOverlaps=[];
for(const filename of locales){
  const locale=filename.slice(0,-5);
  const overlay=JSON.parse(read('language-packs/weig-i18n/'+filename));
  const scope=JSON.parse(read('language-packs/weig-i18n-scopes/'+filename));
  assert.equal(overlay.translationStatus,'draft','Source QA cannot auto-approve '+locale);
  assert.equal(scope.locale,locale);
  assert.ok(overlay.messages['torrent.name'],'WeiG selection ARIA label missing in '+locale);
  for(const [key,decision] of Object.entries(scope.decisions)){
    if(decision.classification!=='qb_owned')continue;
    claims++;
    assert.ok(Object.hasOwn(mapping,key),'Unknown qB-owned candidate: '+locale+'/'+key);
    assert.equal(decision.ownerFile,file,'Wrong qB source owner: '+locale+'/'+key);
    assert.equal(Object.hasOwn(overlay.messages,key),false,'Claim overlaps localized value: '+locale+'/'+key);
    // Historical fully-accounted drafts may already mark this unused
    // WeiG key as an English fallback while also claiming a qB-owned label.
    // Surface the conflict as pending review, never misreport it as QA PASS.
    if((overlay.reviewedEnglishFallbackKeys||[]).includes(key))fallbackOverlaps.push(locale+'/'+key);
  }
}
assert.ok(claims>0,'No qB-owned scope candidates audited');
console.log('qB Copy owner PASS: '+claims+' draft claims / 48 locales; six source-bound column labels; '+
  scriptNames.length+' JS + 4 HTML static-caller checks; '+fallbackOverlaps.length+
  ' historical qB-claim/formal-English-fallback overlaps require source-bound review. '+
  'Dynamic/runtime semantic QA remains pending.');

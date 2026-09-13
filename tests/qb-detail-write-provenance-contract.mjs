import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [source,capabilitySource,registry]=await Promise.all([
  fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8'),
  fs.readFile(new URL('../webui/private/scripts/capabilities.js',import.meta.url),'utf8'),
  fs.readFile(new URL('../webui/private/data/capabilities.json',import.meta.url),'utf8').then(JSON.parse)
]);
let profile=null;
const calls=[];
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  const item=profile.apiActionParameters?.[action]||{};
  return{sourceAction:action,endpoint:(action.split(':')[1]||'').replace(/Action$/,''),parameters:item.parameters||[],required:item.required||[],optional:item.optional||[]};
}
const WeiG={
  util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:{current:()=>profile,actionDescriptor:descriptor,hasAction:action=>!!descriptor(action),isCertified:()=>!!(profile&&profile.fallback!==true&&['EXACT','EQUIVALENT'].includes(profile.resolutionMode||'EXACT'))}
};
const window={WeiG};
const context={window,URLSearchParams,FormData,Blob,console,fetch:async(url,init={})=>{calls.push({url:String(url),init});return new Response('',{status:200});},Response};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const client=new window.WeiG.QBClient();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;

const FILE_PRIO='torrentscontroller.h:filePrioAction';
const ADD_TRACKERS='torrentscontroller.h:addTrackersAction';
const priorityFeature=registry.features.filePriorityWrite;
assert.equal(priorityFeature.sourceRequired,true,'File Priority UI must fail closed without exact source evidence');
assert.equal(priorityFeature.writeRequired,true,'File Priority UI must require current-release write provenance');
assert.equal(priorityFeature.upstream.action,FILE_PRIO,'File Priority UI and transport must share filePrioAction ownership');
assert.deepEqual(priorityFeature.selectors,['.ui-select__trigger[aria-label$=" priority"]'],'dynamic file-priority select triggers must be registry-owned');
assert.match(capabilitySource,/MutationObserver/,'CapabilityRegistry must watch for dynamically mounted capability controls');
assert.match(capabilitySource,/containsCapabilitySelector/,'dynamic capability observation must filter added subtrees before scheduling a sync');
assert.match(capabilitySource,/addEventListener\('keydown',interceptKey,true\)/,'disabled dynamic controls must block keyboard activation in capture phase');
assert.match(capabilitySource,/\['Enter',' ','ArrowDown','ArrowUp'\]/,'custom select activation keys must be fail-closed when capability is unavailable');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,resolutionMode:'EXACT',apiActions:[FILE_PRIO,ADD_TRACKERS],apiActionParameters:{}};
let before=calls.length;
await client.setFilePriority('abc',3,7);
await client.addTrackers('abc','https://tracker.invalid/announce');
assert.equal(calls.length,before+2,'source-proven detail writes must emit exactly their own HTTP requests');
assert.equal(calls[before].url,'api/v2/torrents/filePrio');
let form=new URLSearchParams(String(calls[before].init.body||''));
assert.equal(form.get('hash'),'abc');assert.equal(form.get('id'),'3');assert.equal(form.get('priority'),'7');
assert.equal(calls[before+1].url,'api/v2/torrents/addTrackers');
form=new URLSearchParams(String(calls[before+1].init.body||''));
assert.equal(form.get('hash'),'abc');assert.equal(form.get('urls'),'https://tracker.invalid/announce');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,resolutionMode:'EXACT',apiActions:[],apiActionParameters:{}};
before=calls.length;
for(const action of [()=>client.setFilePriority('abc',3,7),()=>client.addTrackers('abc','https://tracker.invalid/announce')]){
  await assert.rejects(Promise.resolve().then(action),/source-proven/,'missing detail write action must fail closed');
  assert.equal(calls.length,before,'missing detail write action must make zero HTTP requests');
}

profile={qbVersion:'6.0.1',webApiVersion:'3.0.0',fallback:false,resolutionMode:'INHERITED',apiActions:[FILE_PRIO,ADD_TRACKERS],apiActionParameters:{}};
before=calls.length;
for(const action of [()=>client.setFilePriority('abc',3,7),()=>client.addTrackers('abc','https://tracker.invalid/announce')]){
  await assert.rejects(Promise.resolve().then(action),/source-proven/,'inherited detail writes must fail without current-release certification');
  assert.equal(calls.length,before,'inherited detail writes must make zero HTTP requests');
}

profile={qbVersion:'6.9.0',webApiVersion:'99.0.0',fallback:true,resolutionMode:'FALLBACK',apiActions:[FILE_PRIO,ADD_TRACKERS],apiActionParameters:{}};
before=calls.length;
for(const action of [()=>client.setFilePriority('abc',3,7),()=>client.addTrackers('abc','https://tracker.invalid/announce')]){
  await assert.rejects(Promise.resolve().then(action),/source-proven/,'future fallback must not trust guessed detail write support');
  assert.equal(calls.length,before,'future fallback detail write must make zero HTTP requests');
}

console.log(`QBClient Torrent detail write provenance passed: File Priority dynamic UI and transport share exact filePrioAction ownership; ${calls.length} allowed HTTP calls; inherited/fallback or source-absent writes make zero HTTP requests.`);

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let profile=null,calls=[];
const ACTIONS={
  delete:['torrentscontroller.h:deleteAction','delete'],
  recheck:['torrentscontroller.h:recheckAction','recheck'],
  force:['torrentscontroller.h:setForceStartAction','setForceStart'],
  autotmm:['torrentscontroller.h:setAutoManagementAction','setAutoManagement'],
  sequential:['torrentscontroller.h:toggleSequentialDownloadAction','toggleSequentialDownload'],
  firstlast:['torrentscontroller.h:toggleFirstLastPiecePrioAction','toggleFirstLastPiecePrio'],
  top:['torrentscontroller.h:topPrioAction','topPrio'],
  bottom:['torrentscontroller.h:bottomPrioAction','bottomPrio'],
  location:['torrentscontroller.h:setLocationAction','setLocation'],
  rename:['torrentscontroller.h:renameAction','rename'],
  dllimit:['torrentscontroller.h:setDownloadLimitAction','setDownloadLimit'],
  uplimit:['torrentscontroller.h:setUploadLimitAction','setUploadLimit']
};
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  const item=profile.apiActionParameters?.[action]||{};
  return{sourceAction:action,endpoint:(action.split(':')[1]||'').replace(/Action$/,''),parameters:item.parameters||[],required:item.required||[],optional:item.optional||[]};
}
function resolve(kind){
  const spec=ACTIONS[kind];if(!spec||!profile||profile.fallback===true)return null;
  if(!profile.apiActions.includes(spec[0]))return null;
  const desc=descriptor(spec[0]);return desc?{...desc,kind,endpoint:spec[1]}:null;
}
const WeiG={
  util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:{current:()=>profile,actionDescriptor:descriptor,hasAction:action=>!!descriptor(action),resolveTorrentActionDescriptor:resolve,resolveTorrentAction:kind=>resolve(kind)?.endpoint||null,isCertified:()=>!!(profile&&profile.fallback!==true)}
};
const window={WeiG};
const context={window,URLSearchParams,FormData,Blob,Response,console,fetch:async(url,init={})=>{calls.push({url:String(url),init});return new Response('',{status:200});}};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const client=new window.WeiG.QBClient();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;
const operations={
  delete:()=>client.delete('hash-a',true),
  recheck:()=>client.recheck('hash-a'),
  force:()=>client.forceStart('hash-a',true),
  autotmm:()=>client.setAutoManagement('hash-a',true),
  sequential:()=>client.toggleSequential('hash-a'),
  firstlast:()=>client.toggleFirstLast('hash-a'),
  top:()=>client.topPriority('hash-a'),
  bottom:()=>client.bottomPriority('hash-a'),
  location:()=>client.setLocation('hash-a','/downloads/new'),
  rename:()=>client.renameTorrent('hash-a','Renamed'),
  dllimit:()=>client.setDownloadLimit('hash-a',1024),
  uplimit:()=>client.setUploadLimit('hash-a',2048)
};
const allActions=Object.values(ACTIONS).map(x=>x[0]);
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:allActions,apiActionParameters:{}};
let before=calls.length;
for(const [kind,operation] of Object.entries(operations)){
  await operation();
  const call=calls.at(-1),expected=ACTIONS[kind][1];
  assert.equal(call.url,`api/v2/torrents/${expected}`,`${kind} must dispatch to its source-owned endpoint`);
}
assert.equal(calls.length,before+Object.keys(operations).length,'all source-proven core writes must emit exactly one HTTP request each');
let form=new URLSearchParams(String(calls[before].init.body||''));assert.equal(form.get('deleteFiles'),'true','delete must preserve deleteFiles form semantics');
form=new URLSearchParams(String(calls[before+2].init.body||''));assert.equal(form.get('value'),'true','force-start must preserve value form semantics');
form=new URLSearchParams(String(calls[before+3].init.body||''));assert.equal(form.get('enable'),'true','auto-management must preserve enable form semantics');

for(const [kind,[action]] of Object.entries(ACTIONS)){
  profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:allActions.filter(x=>x!==action),apiActionParameters:{}};
  before=calls.length;
  await assert.rejects(Promise.resolve().then(operations[kind]),/not supported/,`${kind} must require its own exact source action`);
  assert.equal(calls.length,before,`${kind} without its exact source action must make zero HTTP requests`);
}

profile={qbVersion:'6.9.0',webApiVersion:'99.0.0',fallback:true,apiActions:allActions,apiActionParameters:{}};
before=calls.length;
for(const [kind,operation] of Object.entries(operations))await assert.rejects(Promise.resolve().then(operation),/not supported/,`future fallback must not guess ${kind} support`);
assert.equal(calls.length,before,'future fallback core writes must make zero HTTP requests');
console.log(`QBClient core write provenance passed: ${calls.length} allowed HTTP calls; 12 core Torrent writes use independent source-owned actions and fallback profiles fail closed before HTTP.`);

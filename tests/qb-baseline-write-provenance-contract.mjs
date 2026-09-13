import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
const registry=JSON.parse(await fs.readFile(new URL('../webui/private/data/capabilities.json',import.meta.url),'utf8'));
let profile=null;
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  const item=profile.apiActionParameters?.[action]||{};
  return{sourceAction:action,endpoint:(action.split(':')[1]||'').replace(/Action$/,''),parameters:Array.isArray(item.parameters)?item.parameters:[],required:Array.isArray(item.required)?item.required:[],optional:Array.isArray(item.optional)?item.optional:[]};
}
const WeiG={util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},I18n:{getLocale:()=> 'en-US'},ReleaseProfile:{current:()=>profile,actionDescriptor:descriptor,hasAction:action=>!!descriptor(action),isCertified:()=>!!(profile&&profile.fallback!==true&&['EXACT','EQUIVALENT'].includes(profile.resolutionMode||'EXACT'))}};
const calls=[];
const window={WeiG};
const context={window,URLSearchParams,FormData,Blob,Response,console,fetch:async(url,init={})=>{calls.push({url:String(url),init});return new Response(String(url).endsWith('/torrents/add')?'Ok.':'',{status:200});}};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const client=new window.WeiG.QBClient();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;
const TOGGLE='transfercontroller.h:toggleSpeedLimitsModeAction';
const SET_DL='transfercontroller.h:setDownloadLimitAction';
const SET_UL='transfercontroller.h:setUploadLimitAction';
const ADD='torrentscontroller.h:addAction';
const ALL=[TOGGLE,SET_DL,SET_UL,ADD];
const addFeature=registry.features.torrentAdd;
assert.equal(addFeature.sourceRequired,true,'Torrent Add UI capability must fail closed without source provenance');
assert.equal(addFeature.writeRequired,true,'Torrent Add UI capability must require current-release write provenance');
assert.equal(addFeature.upstream.action,ADD,'Torrent Add UI capability must bind the exact addAction source owner');
assert.deepEqual(addFeature.selectors,['#add-btn','#empty-add-btn','#add-submit'],'all visible Torrent Add entry points must share one source-proven write capability');
const operations={
  toggle:()=>client.toggleAltSpeedMode(),
  download:()=>client.setGlobalDownloadLimit(1234.6),
  upload:()=>client.setGlobalUploadLimit(-5),
  add:()=>client.add('  magnet:?xt=urn:btih:abc  ',[],' /downloads ',{paused:'true'})
};
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,resolutionMode:'EXACT',apiActions:ALL,apiActionParameters:{[SET_DL]:{parameters:['limit'],required:['limit'],optional:[]},[SET_UL]:{parameters:['limit'],required:['limit'],optional:[]}}};
let before=calls.length;await operations.toggle();assert.equal(calls.length,before+1);assert.equal(calls.at(-1).url,'api/v2/transfer/toggleSpeedLimitsMode');assert.equal(calls.at(-1).init.method,'POST');
before=calls.length;await operations.download();assert.equal(calls.length,before+1);assert.equal(calls.at(-1).url,'api/v2/transfer/setDownloadLimit');let form=new URLSearchParams(String(calls.at(-1).init.body||''));assert.equal(form.get('limit'),'1235','download limit must preserve existing numeric normalization');
before=calls.length;await operations.upload();assert.equal(calls.length,before+1);assert.equal(calls.at(-1).url,'api/v2/transfer/setUploadLimit');form=new URLSearchParams(String(calls.at(-1).init.body||''));assert.equal(form.get('limit'),'0','upload limit must preserve non-negative normalization');
before=calls.length;const added=await operations.add();assert.equal(added,'Ok.');assert.equal(calls.length,before+1);assert.equal(calls.at(-1).url,'api/v2/torrents/add');assert.equal(calls.at(-1).init.method,'POST');assert.equal(calls.at(-1).init.body.get('urls'),'magnet:?xt=urn:btih:abc');assert.equal(calls.at(-1).init.body.get('savepath'),'/downloads');assert.equal(calls.at(-1).init.body.get('paused'),'true');
for(const [name,action] of [['toggle',TOGGLE],['download',SET_DL],['upload',SET_UL],['add',ADD]]){
  profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,resolutionMode:'EXACT',apiActions:ALL.filter(item=>item!==action),apiActionParameters:{}};
  before=calls.length;
  await assert.rejects(Promise.resolve().then(operations[name]),/source-proven/,`${name} must require its own exact source action`);
  assert.equal(calls.length,before,`${name} without exact source action must make zero requests`);
}
profile={qbVersion:'6.0.1',webApiVersion:'3.0.0',fallback:false,resolutionMode:'INHERITED',apiActions:ALL,apiActionParameters:{[SET_DL]:{parameters:['limit'],required:['limit'],optional:[]},[SET_UL]:{parameters:['limit'],required:['limit'],optional:[]}}};
before=calls.length;
for(const [name,operation] of Object.entries(operations))await assert.rejects(Promise.resolve().then(operation),/source-proven/,`inherited future release must not dispatch ${name} without write provenance`);
assert.equal(calls.length,before,'inherited future release baseline state writes must make zero HTTP requests');
profile={qbVersion:'6.9.0',webApiVersion:'99.0.0',fallback:true,resolutionMode:'FALLBACK',apiActions:ALL,apiActionParameters:{}};
before=calls.length;
for(const [name,operation] of Object.entries(operations))await assert.rejects(Promise.resolve().then(operation),/source-proven/,`future fallback must not guess ${name} write support`);
assert.equal(calls.length,before,'future fallback baseline state writes must make zero HTTP requests');
console.log('QBClient baseline state write provenance passed: Torrent Add UI entry points and transport share exact addAction ownership; exact/equivalent releases may dispatch source-proven state writes, while inherited/fallback future releases make zero write HTTP requests.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let profile=null;
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  const item=profile.apiActionParameters?.[action]||{};
  return{sourceAction:action,endpoint:(action.split(':')[1]||'').replace(/Action$/,''),parameters:Array.isArray(item.parameters)?item.parameters:[],required:Array.isArray(item.required)?item.required:[],optional:Array.isArray(item.optional)?item.optional:[]};
}
const WeiG={util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},I18n:{getLocale:()=> 'en-US'},ReleaseProfile:{current:()=>profile,actionDescriptor:descriptor,hasAction:action=>!!descriptor(action),isCertified:()=>!!(profile&&profile.fallback!==true)}};
const window={WeiG};
const context={window,URLSearchParams,FormData,Blob,Response,console,fetch:async()=>new Response('',{status:200})};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const client=new window.WeiG.QBClient();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;
const TOGGLE='transfercontroller.h:toggleSpeedLimitsModeAction';
const SET_DL='transfercontroller.h:setDownloadLimitAction';
const SET_UL='transfercontroller.h:setUploadLimitAction';
const ADD='torrentscontroller.h:addAction';
const ALL=[TOGGLE,SET_DL,SET_UL,ADD];
const calls=[];
client.request=async(path,options={})=>{calls.push({path,options});return path==='torrents/add'?'Ok.':null;};
const operations={
  toggle:()=>client.toggleAltSpeedMode(),
  download:()=>client.setGlobalDownloadLimit(1234.6),
  upload:()=>client.setGlobalUploadLimit(-5),
  add:()=>client.add('  magnet:?xt=urn:btih:abc  ',[],' /downloads ',{paused:'true'})
};
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:ALL,apiActionParameters:{[SET_DL]:{parameters:['limit'],required:['limit'],optional:[]},[SET_UL]:{parameters:['limit'],required:['limit'],optional:[]}}};
let before=calls.length;await operations.toggle();assert.equal(calls.length,before+1);assert.equal(calls.at(-1).path,'transfer/toggleSpeedLimitsMode');assert.equal(calls.at(-1).options.method,'POST');assert.equal(calls.at(-1).options.type,'void');
before=calls.length;await operations.download();assert.equal(calls.length,before+1);assert.equal(calls.at(-1).path,'transfer/setDownloadLimit');assert.equal(calls.at(-1).options.form.limit,1235,'download limit must preserve existing numeric normalization');
before=calls.length;await operations.upload();assert.equal(calls.length,before+1);assert.equal(calls.at(-1).path,'transfer/setUploadLimit');assert.equal(calls.at(-1).options.form.limit,0,'upload limit must preserve non-negative normalization');
before=calls.length;const added=await operations.add();assert.equal(added,'Ok.');assert.equal(calls.length,before+1);assert.equal(calls.at(-1).path,'torrents/add');assert.equal(calls.at(-1).options.method,'POST');assert.equal(calls.at(-1).options.type,'text');assert.equal(calls.at(-1).options.body.get('urls'),'magnet:?xt=urn:btih:abc');assert.equal(calls.at(-1).options.body.get('savepath'),'/downloads');assert.equal(calls.at(-1).options.body.get('paused'),'true');
for(const [name,action] of [['toggle',TOGGLE],['download',SET_DL],['upload',SET_UL],['add',ADD]]){
  profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:ALL.filter(item=>item!==action),apiActionParameters:{}};
  before=calls.length;
  await assert.rejects(Promise.resolve().then(operations[name]),/source-proven/,`${name} must require its own exact source action`);
  assert.equal(calls.length,before,`${name} without exact source action must make zero requests`);
}
profile={qbVersion:'6.9.0',webApiVersion:'99.0.0',fallback:true,apiActions:ALL,apiActionParameters:{}};
before=calls.length;for(const [name,operation] of Object.entries(operations))await assert.rejects(Promise.resolve().then(operation),/source-proven/,`future fallback must not guess ${name} write support`);assert.equal(calls.length,before,'future fallback baseline state writes must make zero requests');
console.log('QBClient baseline state write provenance passed: alt-speed toggle, global rate setters and Torrent add are independently source-guarded; future fallback writes are zero-request fail-closed.');

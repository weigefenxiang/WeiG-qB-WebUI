import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let profile=null;
const calls=[];
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  const item=profile.apiActionParameters?.[action]||{};
  return{
    sourceAction:action,
    endpoint:(action.split(':')[1]||'').replace(/Action$/,''),
    parameters:Array.isArray(item.parameters)?item.parameters:[],
    required:Array.isArray(item.required)?item.required:[],
    optional:Array.isArray(item.optional)?item.optional:[]
  };
}
const releaseProfile={
  current:()=>profile,
  actionDescriptor:descriptor,
  hasAction:action=>!!descriptor(action),
  isCertified:()=>!!(profile&&profile.fallback!==true)
};
const WeiG={
  util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:releaseProfile
};
const window={WeiG};
const fetchMock=async(url,init={})=>{
  calls.push({url:String(url),init});
  if(String(url).endsWith('api/v2/app/preferences'))return new Response(JSON.stringify({save_path:'/downloads'}),{status:200,headers:{'content-type':'application/json'}});
  return new Response('',{status:200});
};
const context={window,fetch:fetchMock,URLSearchParams,FormData,Response,Blob,console};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const Client=window.WeiG.QBClient;
const client=new Client();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;

const PREF_READ='appcontroller.h:preferencesAction';
const PREF_WRITE='appcontroller.h:setPreferencesAction';
const EDIT='torrentscontroller.h:editTrackerAction';
profile={
  qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,
  apiActions:[PREF_READ,PREF_WRITE,EDIT],
  apiActionParameters:{
    [PREF_READ]:{parameters:[],required:[],optional:[]},
    [PREF_WRITE]:{parameters:['json'],required:['json'],optional:[]},
    [EDIT]:{parameters:['hash','url','newUrl','tier'],required:['hash','url'],optional:['newUrl','tier']}
  }
};
let value=await client.getPreferences();
assert.equal(value.save_path,'/downloads','source-proven future-major preference read must remain usable');
assert.equal(calls.at(-1).url,'api/v2/app/preferences');
await client.setPreferences({save_path:'/future'});
assert.equal(calls.at(-1).url,'api/v2/app/setPreferences');
assert.match(String(calls.at(-1).init.body),/(^|&)json=/,'setPreferences must preserve the canonical JSON form field');
await client.editTracker('abc','https://old.invalid/announce','https://new.invalid/announce');
let editCall=calls.at(-1),editForm=new URLSearchParams(String(editCall.init.body||''));
assert.equal(editCall.url,'api/v2/torrents/editTracker');
assert.equal(editForm.get('hash'),'abc');
assert.equal(editForm.get('url'),'https://old.invalid/announce','modern exact descriptor must select url from source parameters');
assert.equal(editForm.get('newUrl'),'https://new.invalid/announce');
assert.equal(editForm.has('origUrl'),false,'modern exact descriptor must not leak the legacy origUrl parameter');

let before=calls.length;
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[PREF_READ],apiActionParameters:{}};
await assert.rejects(client.setPreferences({save_path:'/blocked'}),/source-proven/,'missing future setPreferences action must fail closed');
assert.equal(calls.length,before,'unknown dangerous Settings write must fail before HTTP');

before=calls.length;
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[],apiActionParameters:{}};
await assert.rejects(client.getPreferences(),/source-proven/,'exact source profile without preferences action must not invent read support');
assert.equal(calls.length,before,'source-unproven Settings read must fail before HTTP');

before=calls.length;
profile={qbVersion:'6.0.0',webApiVersion:'99.0.0',fallback:true,apiActions:[],apiActionParameters:{}};
await assert.rejects(client.setPreferences({save_path:'/blocked-by-fallback'}),/source-proven/,'high future version alone must not inherit the latest known write semantics');
assert.equal(calls.length,before,'future fallback dangerous Settings write must make zero HTTP requests');

profile={
  qbVersion:'5.1.4',webApiVersion:'2.11.4',fallback:false,apiActions:[EDIT],
  apiActionParameters:{[EDIT]:{parameters:['hash','origUrl','newUrl'],required:['hash','origUrl','newUrl'],optional:[]}}
};
await client.editTracker('legacy','https://legacy-old.invalid/announce','https://legacy-new.invalid/announce');
editCall=calls.at(-1);editForm=new URLSearchParams(String(editCall.init.body||''));
assert.equal(editForm.get('origUrl'),'https://legacy-old.invalid/announce','legacy exact descriptor must select origUrl from source parameters');
assert.equal(editForm.has('url'),false,'legacy exact descriptor must not send the modern url parameter');

before=calls.length;
profile={
  qbVersion:'6.1.0',webApiVersion:'3.1.0',fallback:false,apiActions:[EDIT],
  apiActionParameters:{[EDIT]:{parameters:['hash','url','tier'],required:['hash','url'],optional:['tier']}}
};
await assert.rejects(client.editTracker('future','https://old.invalid/announce','https://new.invalid/announce'),/cannot prove URL editing/,'unknown future editTracker form must fail closed when newUrl is not source-proven');
assert.equal(calls.length,before,'unknown future editTracker form must fail before HTTP');

console.log(`QBClient provenance contract passed: ${calls.length} allowed HTTP calls; future-major source facts survive, while unproven Settings writes and editTracker forms make zero HTTP requests.`);

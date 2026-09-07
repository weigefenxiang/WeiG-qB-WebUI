import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let profile=null,calls=[];
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  const item=profile.apiActionParameters?.[action]||{};
  return{sourceAction:action,endpoint:(action.split(':')[1]||'').replace(/Action$/,''),parameters:item.parameters||[],required:item.required||[],optional:item.optional||[]};
}
const WeiG={
  util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:{current:()=>profile,actionDescriptor:descriptor,hasAction:action=>!!descriptor(action),isCertified:()=>!!(profile&&profile.fallback!==true)}
};
const window={WeiG};
const context={window,URLSearchParams,FormData,Blob,Response,console,fetch:async(url,init={})=>{
  calls.push({url:String(url),init});
  if(String(url)==='api/v2/app/buildInfo')return new Response(JSON.stringify({qt:'6.8.0',libtorrent:'2.0.11'}),{status:200});
  if(String(url)==='api/v2/app/cookies')return new Response(JSON.stringify([{name:'sid',value:'abc',domain:'example.com',path:'/'}]),{status:200});
  return new Response('',{status:200});
}};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const client=new window.WeiG.QBClient();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;
const BUILD='appcontroller.h:buildInfoAction';
const COOKIES='appcontroller.h:cookiesAction';
const SET_COOKIES='appcontroller.h:setCookiesAction';
const ALL=[BUILD,COOKIES,SET_COOKIES];
const sample=[{name:'sid',value:'abc',domain:'example.com',path:'/'}];
const operations={build:()=>client.getBuildInfo(),cookies:()=>client.getCookies(),setCookies:()=>client.setCookies(sample)};

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:ALL,apiActionParameters:{[SET_COOKIES]:{parameters:['cookies'],required:['cookies'],optional:[]}}};
let before=calls.length;
const build=await operations.build();
assert.equal(calls.length,before+1,'source-proven buildInfo must emit exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/app/buildInfo');
assert.equal(build.qt,'6.8.0');
before=calls.length;
const cookies=await operations.cookies();
assert.equal(calls.length,before+1,'source-proven cookies read must emit exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/app/cookies');
assert.equal(Array.isArray(cookies)&&cookies.length===1,true);
before=calls.length;
await operations.setCookies();
assert.equal(calls.length,before+1,'source-proven setCookies must emit exactly one HTTP request');
const setCall=calls.at(-1);
assert.equal(setCall.url,'api/v2/app/setCookies');
assert.equal(setCall.init.method,'POST');
assert.match(String(setCall.init.headers?.['Content-Type']||''),/^application\/x-www-form-urlencoded/,'setCookies must use qB form encoding');
const encoded=new URLSearchParams(String(setCall.init.body||''));
assert.equal(encoded.has('cookies'),true,'setCookies must send canonical cookies form parameter');
assert.deepEqual(JSON.parse(encoded.get('cookies')),sample,'setCookies cookies form parameter must preserve the JSON array payload');
assert.equal(encoded.has('json'),false,'setCookies must not reuse setPreferences json parameter');

for(const [name,action] of [['build',BUILD],['cookies',COOKIES],['setCookies',SET_COOKIES]]){
  profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:ALL.filter(item=>item!==action),apiActionParameters:{}};
  before=calls.length;
  await assert.rejects(Promise.resolve().then(operations[name]),/source-proven/,`${name} must require its own exact source action`);
  assert.equal(calls.length,before,`${name} without exact source action must make zero HTTP requests`);
}

profile={qbVersion:'6.9.0',webApiVersion:'99.0.0',fallback:true,apiActions:ALL,apiActionParameters:{}};
before=calls.length;
for(const [name,operation] of Object.entries(operations))await assert.rejects(Promise.resolve().then(operation),/source-proven/,`future fallback must not guess ${name} support`);
assert.equal(calls.length,before,'future fallback App auxiliary APIs must make zero HTTP requests');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[SET_COOKIES],apiActionParameters:{}};
before=calls.length;
await client.setCookies({not:'an array'});
assert.equal(calls.length,before+1);
const normalized=new URLSearchParams(String(calls.at(-1).init.body||''));
assert.deepEqual(JSON.parse(normalized.get('cookies')),[],'setCookies must preserve current non-array normalization as an empty cookie list');
console.log(`QBClient App auxiliary provenance passed: ${calls.length} allowed HTTP calls; buildInfo/cookies/setCookies are independently source-guarded and setCookies uses canonical cookies=<JSON> form encoding.`);

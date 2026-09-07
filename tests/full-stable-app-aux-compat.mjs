import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalogPath=path.resolve(process.argv[2]||'');
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-app-aux-compat.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'frozen App auxiliary matrix requires a non-empty release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','frozen App auxiliary matrix floor must remain qB 4.1.0');

const releaseSource=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const clientSource=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const W={buildAssetUrl:x=>x,util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
const window={WeiG:W,window:null,dispatchEvent(){}};window.window=window;
const context={window,console,URLSearchParams,FormData,Blob,CustomEvent:class{},fetch:async url=>{if(String(url).includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};throw new Error(`Unexpected fetch ${url}`);}};
vm.runInNewContext(releaseSource,context,{filename:'release-profile.js'});
vm.runInNewContext(clientSource,context,{filename:'qb-client.js'});
const R=W.ReleaseProfile,Client=W.QBClient;
assert.ok(R&&Client,'ReleaseProfile and QBClient must load');

const BUILD='appcontroller.h:buildInfoAction';
const COOKIES='appcontroller.h:cookiesAction';
const SET_COOKIES='appcontroller.h:setCookiesAction';
const sample=[{name:'sid',value:'abc',domain:'example.com',path:'/'}];
let firstBuild=null,firstCookies=null,buildCount=0,cookieCount=0,dispatchChecks=0;
async function expectNoHttp(client,method,args,label){
  const seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};
  let rejected=false;try{await client[method](...args);}catch{rejected=true;}
  assert.equal(rejected,true,`${label}: unsupported App auxiliary action must reject before HTTP`);
  assert.equal(seen.length,0,`${label}: unsupported App auxiliary action must make zero HTTP requests`);
}
for(const profile of catalog){
  assert.equal(profile.stable,true,`${profile.qbVersion}: stable profile required`);
  assert.notEqual(profile.officialWeiGSupport,false,`${profile.qbVersion}: official support required`);
  assert.ok(Array.isArray(profile.apiActions),`${profile.qbVersion}: apiActions source facts missing`);
  await R.bind({qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion});
  assert.equal(R.isCertified(),true,`${profile.qbVersion}: frozen profile must bind certified`);
  const client=new Client();client.qbVersion=profile.qbVersion;client.webApiVersion=profile.webApiVersion;
  const hasBuild=profile.apiActions.includes(BUILD),hasCookies=profile.apiActions.includes(COOKIES),hasSetCookies=profile.apiActions.includes(SET_COOKIES);
  assert.equal(hasCookies,hasSetCookies,`${profile.qbVersion}: cookiesAction and setCookiesAction must move atomically`);
  if(hasBuild){
    buildCount++;if(!firstBuild)firstBuild=profile.qbVersion;
    const seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return{qt:'test'};};
    await client.getBuildInfo();assert.equal(seen.length,1,`${profile.qbVersion}: buildInfo must emit exactly one request`);assert.equal(seen[0].path,'app/buildInfo');dispatchChecks++;
  }else await expectNoHttp(client,'getBuildInfo',[],`${profile.qbVersion} buildInfo`);
  if(hasCookies){
    cookieCount++;if(!firstCookies)firstCookies=profile.qbVersion;
    let seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return[];};
    await client.getCookies();assert.equal(seen.length,1,`${profile.qbVersion}: cookies read must emit exactly one request`);assert.equal(seen[0].path,'app/cookies');dispatchChecks++;
    seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};
    await client.setCookies(sample);assert.equal(seen.length,1,`${profile.qbVersion}: setCookies must emit exactly one request`);assert.equal(seen[0].path,'app/setCookies');assert.equal(seen[0].options.method,'POST');
    const form=seen[0].options.form;assert.ok(form&&typeof form.cookies==='string',`${profile.qbVersion}: setCookies must use canonical cookies form parameter`);assert.deepEqual(JSON.parse(form.cookies),sample,`${profile.qbVersion}: setCookies form JSON payload drift`);assert.equal(Object.prototype.hasOwnProperty.call(form,'json'),false,`${profile.qbVersion}: setCookies must not use setPreferences json field`);
    const sourceParams=profile.apiActionParameters?.[SET_COOKIES];assert.ok(sourceParams,`${profile.qbVersion}: setCookies source parameter descriptor missing`);assert.ok(sourceParams.parameters?.includes('cookies'),`${profile.qbVersion}: setCookies source descriptor must expose cookies parameter`);assert.ok(sourceParams.required?.includes('cookies'),`${profile.qbVersion}: setCookies source descriptor must require cookies parameter`);dispatchChecks++;
  }else{
    await expectNoHttp(client,'getCookies',[],`${profile.qbVersion} cookies`);
    await expectNoHttp(client,'setCookies',[sample],`${profile.qbVersion} setCookies`);
  }
}
assert.ok(buildCount>0&&buildCount<catalog.length,'Frozen profiles must preserve both pre-buildInfo and buildInfo-capable eras');
assert.ok(cookieCount>0&&cookieCount<catalog.length,'Frozen profiles must preserve both pre-Cookies and Cookies-capable eras');
assert.equal(firstBuild,'4.2.0','buildInfoAction must first appear at qB 4.2.0 in the frozen stable catalog');
assert.equal(firstCookies,'5.1.0','cookiesAction/setCookiesAction must first appear at qB 5.1.0 in the frozen stable catalog');
console.log(`Frozen App auxiliary compatibility passed: ${catalog.length} official stable releases; buildInfo starts at ${firstBuild}, Cookies read/write starts atomically at ${firstCookies}, and ${dispatchChecks} source-owned dispatch/parameter checks passed.`);

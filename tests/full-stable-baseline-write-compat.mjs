import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createCompactRuntime} from '../tools/qb-compact-runtime.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalogPath=path.resolve(process.argv[2]||'');
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-baseline-write-compat.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'frozen baseline write matrix requires a non-empty release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','frozen baseline write matrix floor must remain qB 4.1.0');
const {W}=createCompactRuntime(catalog,{owners:['capabilities.js','qb-client.js']});
const R=W.CapabilityRegistry,Client=W.QBClient;
const TOGGLE='transfercontroller.h:toggleSpeedLimitsModeAction',SET_DL='transfercontroller.h:setDownloadLimitAction',SET_UL='transfercontroller.h:setUploadLimitAction',ADD='torrentscontroller.h:addAction',ALL=[TOGGLE,SET_DL,SET_UL,ADD];
let dispatchChecks=0;
for(const profile of catalog){
  assert.equal(profile.stable,true,`${profile.qbVersion}: stable profile required`);assert.notEqual(profile.officialWeiGSupport,false,`${profile.qbVersion}: official support required`);
  for(const action of ALL)assert.ok(profile.apiActions.includes(action),`${profile.qbVersion}: baseline source action missing ${action}`);
  for(const action of [SET_DL,SET_UL]){const desc=profile.apiActionParameters?.[action];assert.ok(desc,`${profile.qbVersion}: ${action} parameter descriptor missing`);assert.ok(desc.parameters.includes('limit'),`${profile.qbVersion}: ${action} must source-prove limit parameter`);assert.ok(desc.required.includes('limit'),`${profile.qbVersion}: ${action} must source-prove required limit parameter`);}
  await R.bind({qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion});assert.equal(R.isCertified(),true,`${profile.qbVersion}: frozen profile must bind certified`);
  const client=new Client();client.qbVersion=profile.qbVersion;client.webApiVersion=profile.webApiVersion;
  let seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};await client.toggleAltSpeedMode();assert.equal(seen.length,1);assert.equal(seen[0].path,'transfer/toggleSpeedLimitsMode');assert.equal(seen[0].options.method,'POST');dispatchChecks++;
  seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};await client.setGlobalDownloadLimit(2048);assert.equal(seen.length,1);assert.equal(seen[0].path,'transfer/setDownloadLimit');assert.equal(seen[0].options.form?.limit,2048);dispatchChecks++;
  seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};await client.setGlobalUploadLimit(4096);assert.equal(seen.length,1);assert.equal(seen[0].path,'transfer/setUploadLimit');assert.equal(seen[0].options.form?.limit,4096);dispatchChecks++;
  seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return 'Ok.';};const result=await client.add('magnet:?xt=urn:btih:abc',[],'/downloads',{paused:'false'});assert.equal(result,'Ok.');assert.equal(seen.length,1);assert.equal(seen[0].path,'torrents/add');assert.equal(seen[0].options.method,'POST');assert.equal(seen[0].options.body.get('urls'),'magnet:?xt=urn:btih:abc');assert.equal(seen[0].options.body.get('savepath'),'/downloads');dispatchChecks++;
}
assert.equal(dispatchChecks,catalog.length*4,'every frozen stable release must execute all four baseline state writes through source-owned dispatch');
console.log(`Frozen baseline state write compatibility passed: ${catalog.length} official stable releases from ${catalog[0].qbVersion} -> ${catalog.at(-1).qbVersion}; ${dispatchChecks} source-owned write dispatch checks passed and global limit parameters remain required source facts.`);

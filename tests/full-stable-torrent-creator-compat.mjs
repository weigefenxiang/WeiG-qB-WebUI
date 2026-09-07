import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalogPath=path.resolve(process.argv[2]||'');
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-torrent-creator-compat.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'frozen Torrent Creator matrix requires a non-empty release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','frozen Torrent Creator matrix floor must remain qB 4.1.0');

const releaseSource=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const clientSource=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const W={buildAssetUrl:x=>x,util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
const window={WeiG:W,window:null,dispatchEvent(){}};window.window=window;
const context={window,console,URLSearchParams,FormData,Blob,CustomEvent:class{},fetch:async url=>{if(String(url).includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};throw new Error(`Unexpected fetch ${url}`);}};
vm.runInNewContext(releaseSource,context,{filename:'release-profile.js'});
vm.runInNewContext(clientSource,context,{filename:'qb-client.js'});
const R=W.ReleaseProfile,Client=W.QBClient;
assert.ok(R&&Client,'ReleaseProfile and QBClient must load');

const ADD='torrentcreatorcontroller.h:addTaskAction';
const STATUS='torrentcreatorcontroller.h:statusAction';
const FILE='torrentcreatorcontroller.h:torrentFileAction';
const DELETE='torrentcreatorcontroller.h:deleteTaskAction';
const ALL=[ADD,STATUS,FILE,DELETE];
let firstCreator=null,creatorCount=0,dispatchChecks=0;
async function expectNoHttp(client,method,args,label){
  const seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};
  let rejected=false;try{await client[method](...args);}catch{rejected=true;}
  assert.equal(rejected,true,`${label}: unsupported Torrent Creator action must reject before HTTP`);
  assert.equal(seen.length,0,`${label}: unsupported Torrent Creator action must make zero HTTP requests`);
}
for(const profile of catalog){
  assert.equal(profile.stable,true,`${profile.qbVersion}: stable profile required`);
  assert.notEqual(profile.officialWeiGSupport,false,`${profile.qbVersion}: official support required`);
  assert.ok(Array.isArray(profile.apiActions),`${profile.qbVersion}: apiActions source facts missing`);
  await R.bind({qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion});
  assert.equal(R.isCertified(),true,`${profile.qbVersion}: frozen profile must bind certified`);
  const present=ALL.filter(action=>profile.apiActions.includes(action));
  assert.ok(present.length===0||present.length===ALL.length,`${profile.qbVersion}: Torrent Creator actions must appear atomically, got ${present.length}/${ALL.length}`);
  const client=new Client();client.qbVersion=profile.qbVersion;client.webApiVersion=profile.webApiVersion;
  if(present.length===ALL.length){
    creatorCount++;if(!firstCreator)firstCreator=profile.qbVersion;
    let seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return{taskID:'task-1'};};
    await client.torrentCreatorAdd({sourcePath:'/data/source'});assert.equal(seen.length,1,`${profile.qbVersion}: Torrent Creator add must emit exactly one request`);assert.equal(seen[0].path,'torrentcreator/addTask');assert.equal(seen[0].options.method,'POST');assert.equal(seen[0].options.form?.sourcePath,'/data/source');dispatchChecks++;
    seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return[];};
    await client.torrentCreatorStatus('task 1');assert.equal(seen.length,1,`${profile.qbVersion}: Torrent Creator status must emit exactly one request`);assert.equal(seen[0].path,'torrentcreator/status?taskID=task%201');dispatchChecks++;
    seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};
    await client.torrentCreatorDelete('task 1');assert.equal(seen.length,1,`${profile.qbVersion}: Torrent Creator delete must emit exactly one request`);assert.equal(seen[0].path,'torrentcreator/deleteTask');assert.equal(seen[0].options.form?.taskID,'task 1');dispatchChecks++;
    seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};
    await client.torrentCreatorFile('task 1');assert.equal(seen.length,1,`${profile.qbVersion}: Torrent Creator file must emit exactly one request`);assert.equal(seen[0].path,'torrentcreator/torrentFile?taskID=task%201');assert.equal(seen[0].options.type,'blob');dispatchChecks++;
  }else{
    await expectNoHttp(client,'torrentCreatorAdd',[{sourcePath:'/data/source'}],`${profile.qbVersion} Torrent Creator add`);
    await expectNoHttp(client,'torrentCreatorStatus',['task-1'],`${profile.qbVersion} Torrent Creator status`);
    await expectNoHttp(client,'torrentCreatorDelete',['task-1'],`${profile.qbVersion} Torrent Creator delete`);
    await expectNoHttp(client,'torrentCreatorFile',['task-1'],`${profile.qbVersion} Torrent Creator file`);
  }
}
assert.ok(creatorCount>0&&creatorCount<catalog.length,'Frozen profiles must preserve both pre-Torrent-Creator and Torrent-Creator-capable eras');
assert.equal(firstCreator,'5.0.0','Torrent Creator actions must first appear at qB 5.0.0 in the frozen stable catalog');
console.log(`Frozen Torrent Creator compatibility passed: ${catalog.length} official stable releases; all four actions start atomically at ${firstCreator}, and ${dispatchChecks} source-owned QBClient dispatch checks passed.`);

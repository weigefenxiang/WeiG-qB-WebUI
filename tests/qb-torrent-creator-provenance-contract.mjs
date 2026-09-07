import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let profile=null,calls=[];
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  return{sourceAction:action,endpoint:(action.split(':')[1]||'').replace(/Action$/,''),parameters:[],required:[],optional:[]};
}
const WeiG={
  util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:{current:()=>profile,actionDescriptor:descriptor,hasAction:action=>!!descriptor(action),isCertified:()=>!!(profile&&profile.fallback!==true)}
};
const window={WeiG};
const context={window,URLSearchParams,FormData,Blob,Response,console,fetch:async(url,init={})=>{
  calls.push({url:String(url),init});
  if(String(url).startsWith('api/v2/torrentcreator/addTask'))return new Response(JSON.stringify({taskID:'task-1'}),{status:200});
  if(String(url).startsWith('api/v2/torrentcreator/status'))return new Response(JSON.stringify([]),{status:200});
  if(String(url).startsWith('api/v2/torrentcreator/torrentFile'))return new Response('torrent-bytes',{status:200});
  return new Response('',{status:200});
}};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const client=new window.WeiG.QBClient();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;

const ADD='torrentcreatorcontroller.h:addTaskAction';
const STATUS='torrentcreatorcontroller.h:statusAction';
const FILE='torrentcreatorcontroller.h:torrentFileAction';
const DELETE='torrentcreatorcontroller.h:deleteTaskAction';
const ALL=[ADD,STATUS,FILE,DELETE];
const params={sourcePath:'/data/source',private:'true',pieceSize:'0'};
const operations={
  add:()=>client.torrentCreatorAdd(params),
  status:()=>client.torrentCreatorStatus('task 1'),
  file:()=>client.torrentCreatorFile('task 1'),
  delete:()=>client.torrentCreatorDelete('task 1')
};

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:ALL,apiActionParameters:{}};
let before=calls.length;
const added=await operations.add();
assert.equal(calls.length,before+1,'source-proven Torrent Creator add must emit exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/torrentcreator/addTask');
assert.equal(calls.at(-1).init.method,'POST');
let form=new URLSearchParams(String(calls.at(-1).init.body||''));
assert.equal(form.get('sourcePath'),'/data/source','Torrent Creator add must preserve the caller sourcePath form field');
assert.equal(added.taskID,'task-1');

before=calls.length;
await operations.status();
assert.equal(calls.length,before+1,'source-proven Torrent Creator status must emit exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/torrentcreator/status?taskID=task%201');
before=calls.length;
await client.torrentCreatorStatus();
assert.equal(calls.length,before+1,'Torrent Creator status must support the source-defined all-task query');
assert.equal(calls.at(-1).url,'api/v2/torrentcreator/status');

before=calls.length;
await operations.file();
assert.equal(calls.length,before+1,'source-proven Torrent Creator file must emit exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/torrentcreator/torrentFile?taskID=task%201');

before=calls.length;
await operations.delete();
assert.equal(calls.length,before+1,'source-proven Torrent Creator delete must emit exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/torrentcreator/deleteTask');
assert.equal(calls.at(-1).init.method,'POST');
form=new URLSearchParams(String(calls.at(-1).init.body||''));
assert.equal(form.get('taskID'),'task 1','Torrent Creator delete must preserve taskID form encoding');

for(const [name,action] of [['add',ADD],['status',STATUS],['file',FILE],['delete',DELETE]]){
  profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:ALL.filter(item=>item!==action),apiActionParameters:{}};
  before=calls.length;
  await assert.rejects(Promise.resolve().then(operations[name]),/source-proven/,`${name} must require its own exact Torrent Creator source action`);
  assert.equal(calls.length,before,`${name} without exact source action must make zero HTTP requests`);
}

profile={qbVersion:'6.9.0',webApiVersion:'99.0.0',fallback:true,apiActions:ALL,apiActionParameters:{}};
before=calls.length;
for(const [name,operation] of Object.entries(operations))await assert.rejects(Promise.resolve().then(operation),/source-proven/,`future fallback must not guess Torrent Creator ${name} support`);
assert.equal(calls.length,before,'future fallback Torrent Creator APIs must make zero HTTP requests');
console.log(`QBClient Torrent Creator provenance passed: ${calls.length} allowed HTTP calls; all four actions are independently source-guarded and future fallback is fail-closed.`);

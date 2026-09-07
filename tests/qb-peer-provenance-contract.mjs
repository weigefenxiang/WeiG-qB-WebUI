import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let profile=null,responseBody={peers:{}},calls=[];
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
const context={window,URLSearchParams,FormData,Blob,Response,console,fetch:async(url,init={})=>{calls.push({url:String(url),init});return new Response(JSON.stringify(responseBody),{status:200});}};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const client=new window.WeiG.QBClient();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;
client.capabilities.peerBan=true;

const PEERS='synccontroller.h:torrentPeersAction';
const BAN='transfercontroller.h:banPeersAction';
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[PEERS,BAN],apiActionParameters:{}};
responseBody={peers:{'203.0.113.7:51413':{ip:'203.0.113.7',port:51413,client:'qBittorrent',progress:0.5,dl_speed:1024,up_speed:512}}};
let before=calls.length,items=await client.peers('abc');
assert.equal(calls.length,before+1,'source-proven torrentPeers must emit exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/sync/torrentPeers?rid=0&hash=abc');
assert.equal(items.length,1);assert.equal(items[0].__key,'203.0.113.7:51413');
await client.banPeers('203.0.113.7:51413');
assert.equal(calls.length,before+2,'source-proven banPeers must emit exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/transfer/banPeers');
assert.equal(new URLSearchParams(String(calls.at(-1).init.body||'')).get('peers'),'203.0.113.7:51413');

responseBody={peers:{}};before=calls.length;items=await client.peers('empty');
assert.equal(Array.isArray(items)&&items.length===0,true,'a real source-proven empty peers object must remain a real empty list');
assert.equal(calls.length,before+1,'real empty peers still requires one successful HTTP response');

responseBody={};before=calls.length;
await assert.rejects(client.peers('malformed'),/unexpected response/,'malformed peer payload must remain an error rather than fake-empty');
assert.equal(calls.length,before+1,'malformed peer payload is a post-HTTP response error, not an unsupported state');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[PEERS],apiActionParameters:{}};
before=calls.length;
await assert.rejects(Promise.resolve().then(()=>client.banPeers('203.0.113.7:51413')),/source-proven/,'banPeers must not inherit from Peers read support');
assert.equal(calls.length,before,'missing banPeers source action must fail before HTTP');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[BAN],apiActionParameters:{}};
before=calls.length;
await assert.rejects(Promise.resolve().then(()=>client.peers('abc')),/source-proven/,'torrentPeers must not inherit from banPeers support');
assert.equal(calls.length,before,'missing torrentPeers source action must fail before HTTP');

profile={qbVersion:'6.9.0',webApiVersion:'99.0.0',fallback:true,apiActions:[PEERS,BAN],apiActionParameters:{}};
before=calls.length;
await assert.rejects(Promise.resolve().then(()=>client.peers('future')),/source-proven/,'future fallback must not guess torrentPeers support');
await assert.rejects(Promise.resolve().then(()=>client.banPeers('203.0.113.7:51413')),/source-proven/,'future fallback must not guess banPeers support');
assert.equal(calls.length,before,'future fallback Peers operations must make zero HTTP requests');

profile={qbVersion:'5.2.3',webApiVersion:'2.15.1',fallback:false,apiActions:[PEERS,BAN],apiActionParameters:{}};
client.capabilities.peerBan=true;
client.applyCapabilityRegistry({supports:id=>id==='peerBan'?false:true});
assert.equal(client.capabilities.peerBan,false,'exact CapabilityRegistry result must override legacy WebAPI peerBan guess');
client.applyCapabilityRegistry({supports:id=>id==='peerBan'});
assert.equal(client.capabilities.peerBan,true,'source-proven peerBan capability must remain enabled');

console.log(`QBClient Peer provenance passed: ${calls.length} allowed HTTP calls; torrentPeers/banPeers are independently source-guarded, exact capability truth overrides version guessing, and unsupported/empty/malformed states stay distinct.`);

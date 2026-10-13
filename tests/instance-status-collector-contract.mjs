import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {collectStatus,readConfig,publishStatus,readSessions,publishSessions,validateConfig} from '../tools/instance-status-collector.mjs';

const config={schemaVersion:1,instances:[
  {url:'https://first.example/',username:'admin',password:'password-one'},
  {url:'https://second.example/',username:'operator',password:'password-two'},
  {url:'https://offline.example/',username:'operator',password:'password-three'}
]};
const items=validateConfig(config);
assert.equal(items.length,3);
assert.throws(()=>validateConfig({schemaVersion:1,instances:[config.instances[0],config.instances[0]]}),/Duplicate/);
assert.throws(()=>validateConfig({schemaVersion:1,instances:[{...config.instances[0],url:'javascript:alert(1)'}]}),/Unsafe/);
assert.throws(()=>validateConfig({schemaVersion:1,instances:[{...config.instances[0],url:'https://u:p@first.example/'}]}),/Unsafe/);
const calls=[];
async function fakeFetch(input,options){
  const url=new URL(input),host=url.hostname,pathname=url.pathname;
  calls.push({host,pathname,options});
  assert.equal(options.redirect,'manual');
  assert(options.signal instanceof AbortSignal);
  if(host==='offline.example')throw new Error('unreachable');
  if(pathname.endsWith('/auth/login')){
    assert.equal(options.method,'POST');
    assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded');
    assert(options.body instanceof URLSearchParams);
    return new Response('Ok.',{status:200,headers:{'set-cookie':'SID=secret-session; Path=/; HttpOnly'}});
  }
  assert.equal(options.headers.Cookie,'SID=secret-session');
  if(pathname.endsWith('/app/version'))return new Response(host==='first.example'?'v5.2.4':'4.1.9');
  if(pathname.endsWith('/torrents/count'))
    return host==='first.example'?new Response('0'):new Response('Missing',{status:404});
  if(pathname.endsWith('/torrents/info'))return new Response(JSON.stringify([{hash:'a'},{hash:'b'}]));
  throw new Error('Unexpected endpoint: '+pathname);
}
const sessions=new Map();
const payload=await collectStatus(items,{fetcher:fakeFetch,now:()=>1720000000000,sessions});
assert.equal(payload.schemaVersion,1);
assert.equal(payload.maxAgeMs,90000);
assert.equal(payload.instances.length,3);
assert.deepEqual(payload.instances.map(x=>x.status),['online','online','unverified']);
assert.deepEqual(payload.instances.map(x=>x.count),[0,2,null]);
assert(!JSON.stringify(payload).includes('password-one')&&!JSON.stringify(payload).includes('secret-session'));
assert.equal(calls.filter(x=>x.pathname.endsWith('/torrents/info')).length,1,'Only unsupported count gets full-list fallback');
assert.equal(sessions.size,2,'Only authenticated targets get reusable sessions');
await collectStatus(items,{fetcher:fakeFetch,now:()=>1720000005000,sessions});
assert.equal(calls.filter(x=>x.pathname.endsWith('/auth/login')&&x.host!=='offline.example').length,2,
  'A second host collector run must reuse existing valid qB sessions');
const alternate=validateConfig({schemaVersion:1,instances:[{...config.instances[0],probeUrl:'http://127.0.0.1:18080/'}]});
assert.equal(alternate[0].url,'https://first.example/','Public browser identity is unchanged by local probing');
assert.equal(alternate[0].probeUrl,'http://127.0.0.1:18080/');
const probeRequests=[];
const proxyFetch=async(input,options)=>{
  const url=new URL(input);
  probeRequests.push(url.hostname);
  if(url.hostname==='127.0.0.1')
    return fakeFetch(new URL(url.pathname,'https://first.example/'),options);
  return fakeFetch(input,options);
};
const localProbe=await collectStatus(alternate,{fetcher:proxyFetch,now:()=>1720000006000,sessions});
assert.equal(localProbe.instances[0].status,'online');
assert.equal(localProbe.instances[0].url,'https://first.example/','Published identity is always the browser URL');
assert.ok(probeRequests.every(host=>host==='127.0.0.1'),'All requests must use the configured host-local probe address');


const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weig-collector-'));
try{
  const priv=path.join(temp,'private');fs.mkdirSync(priv);
  const conf=path.join(temp,'secret.json');fs.writeFileSync(conf,JSON.stringify(config),{mode:0o600});
  assert.equal(readConfig(conf).length,3);
  fs.chmodSync(conf,0o644);
  assert.throws(()=>readConfig(conf),/chmod 600/,'Credentials cannot be read from group/world-accessible configuration');
  fs.chmodSync(conf,0o600);
  const file=path.join(priv,'weig-instance-status.json');
  publishStatus(file,payload);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),payload);
  assert.equal(fs.readdirSync(priv).length,1,'No transient file must remain');
  const authCache=path.join(temp,'sessions.json');
  publishSessions(authCache,sessions);
  assert.equal(fs.statSync(authCache).mode&0o077,0,'Host SID cache must be mode 600');
  assert.equal(readSessions(authCache).size,2,'Root-only cache survives process restart');
  assert.ok(!fs.readFileSync(authCache,'utf8').includes('password-one'),'Credential password must not leak into reusable SID cache');
  fs.chmodSync(authCache,0o644);
  assert.throws(()=>readSessions(authCache),/chmod 600/,'World-readable SID cache must fail closed');
  fs.chmodSync(authCache,0o600);
  const next={...payload,generatedAt:payload.generatedAt+30000};
  publishStatus(file,next);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),next,'Atomic publish must replace previous snapshot');
  assert.throws(()=>publishStatus(path.join(temp,'public','weig-instance-status.json'),payload),/Status output must/);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('A76 host collector validates credentials, count API/fallback, zero, offline, and atomic private status.');

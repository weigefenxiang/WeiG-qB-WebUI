import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {collectStatus,readConfig,publishStatus,validateConfig} from '../tools/instance-status-collector.mjs';

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
const payload=await collectStatus(items,{fetcher:fakeFetch,now:()=>1720000000000});
assert.equal(payload.schemaVersion,1);
assert.equal(payload.maxAgeMs,90000);
assert.equal(payload.instances.length,3);
assert.deepEqual(payload.instances.map(x=>x.status),['online','online','unverified']);
assert.deepEqual(payload.instances.map(x=>x.count),[0,2,null]);
assert(!JSON.stringify(payload).includes('password-one')&&!JSON.stringify(payload).includes('secret-session'));
assert.equal(calls.filter(x=>x.pathname.endsWith('/torrents/info')).length,1,'Only unsupported count gets full-list fallback');

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
  const next={...payload,generatedAt:payload.generatedAt+30000};
  publishStatus(file,next);
  assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),next,'Atomic publish must replace previous snapshot');
  assert.throws(()=>publishStatus(path.join(temp,'public','weig-instance-status.json'),payload),/Status output must/);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('A76 host collector validates credentials, count API/fallback, zero, offline, and atomic private status.');

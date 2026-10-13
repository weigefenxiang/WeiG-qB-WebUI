#!/usr/bin/env node
// A76: one-shot host collector. No gateway or background web server is started.
// Credentials stay in a root-readable config; only bounded counts reach WebUI.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const MAX_INSTANCES=16, MAX_RESPONSE=12*1024*1024, TIMEOUT_MS=7000;
function ensure(ok,message){if(!ok)throw new Error(message);}
function canonicalAddress(value){
  ensure(typeof value==='string'&&value.length>0&&value.length<=2048,'Invalid qB address');
  const u=new URL(value);
  ensure((u.protocol==='http:'||u.protocol==='https:')&&!u.username&&!u.password&&!u.search&&!u.hash,'Unsafe qB address');
  ensure(!/\/api\/v2(?:\/|$)/i.test(u.pathname),'Expected qB WebUI root, not an API endpoint');
  if(!u.pathname.endsWith('/'))u.pathname+='/';
  return u.href;
}
export function validateConfig(config){
  ensure(config&&config.schemaVersion===1&&Array.isArray(config.instances)&&config.instances.length>0&&config.instances.length<=MAX_INSTANCES,'Invalid collector schema');
  const seen=new Set();
  const instances=config.instances.map(item=>{
    ensure(item&&typeof item==='object'&&!Array.isArray(item),'Invalid collector instance');
    const url=canonicalAddress(item.url);
    ensure(!seen.has(url),'Duplicate collector instance');
    seen.add(url);
    ensure(typeof item.username==='string'&&item.username.length<=128,'Invalid qB username');
    ensure(typeof item.password==='string'&&item.password.length<=512,'Invalid qB password');
    return{url,username:item.username,password:item.password};
  });
  return instances;
}
export function readConfig(filename){
  const stats=fs.statSync(filename);
  ensure(stats.isFile()&&(stats.mode&0o077)===0,'Collector config must be a private regular file (chmod 600)');
  const bytes=fs.readFileSync(filename,'utf8');
  ensure(bytes.length<65536,'Collector config exceeds size limit');
  return validateConfig(JSON.parse(bytes));
}
async function readText(response,limit=MAX_RESPONSE){
  const reader=response.body?.getReader();
  if(!reader)return await response.text();
  let chunks=[],size=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      ensure(size<=limit,'qB response too large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks,size).toString('utf8');
  }finally{reader.releaseLock();}
}
async function request(fetcher,url,init={}){
  return fetcher(url,{...init,redirect:'manual',signal:AbortSignal.timeout(TIMEOUT_MS)});
}
async function pollOne(item,fetcher,now){
  const checkedAt=now();
  const row={url:item.url,status:'unverified',count:null,checkedAt};
  try{
    const login=await request(fetcher,new URL('api/v2/auth/login',item.url),{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({username:item.username,password:item.password})
    });
    const reply=await readText(login,256);
    if(!([200,204].includes(login.status)&&(login.status===204||reply.trim()==='Ok.')))return row;
    const cookie=(login.headers.get('set-cookie')||'').split(';')[0].trim();
    if(cookie&&!/^[A-Za-z0-9_]+=[^;\r\n]+$/.test(cookie))return row;
    const headers=cookie?{Cookie:cookie}:{};
    const version=await request(fetcher,new URL('api/v2/app/version',item.url),{headers});
    if(!version.ok)return row;
    const value=(await readText(version,128)).trim();
    if(!/^v?[1-9]\d*(?:\.\d+){1,3}(?:[-+._][A-Za-z0-9.-]+)?$/i.test(value))return row;
    row.status='online';
    const count=await request(fetcher,new URL('api/v2/torrents/count',item.url),{headers});
    if(count.ok){
      const text=(await readText(count,128)).trim();
      const n=Number(text);
      if(/^\d+$/.test(text)&&Number.isSafeInteger(n))row.count=n;
    }else if(count.status===404||count.status===405){
      // Older qB lacks torrents/count; one bounded full listing is required.
      const listing=await request(fetcher,new URL('api/v2/torrents/info',item.url),{headers});
      if(listing.ok){
        const torrents=JSON.parse(await readText(listing));
        if(Array.isArray(torrents))row.count=torrents.length;
      }
    }
  }catch(_error){/* A failed qB count is unknown; never synthesize zero/offline. */}
  return row;
}
export async function collectStatus(instances,{fetcher=fetch,now=Date.now}={}){
  const rows=await Promise.all(instances.map(item=>pollOne(item,fetcher,now)));
  return{schemaVersion:1,generatedAt:now(),maxAgeMs:90000,instances:rows};
}
export function publishStatus(output,data){
  ensure(path.basename(output)==='weig-instance-status.json'&&path.basename(path.dirname(output))==='private',
    'Status output must be <shared WebUI>/private/weig-instance-status.json');
  const dir=path.dirname(output);
  ensure(fs.realpathSync(dir)===path.resolve(dir),'Output directory must not be a symlink');
  const payload=JSON.stringify(data)+'\n';
  ensure(Buffer.byteLength(payload)<=16384,'Status snapshot exceeds size limit');
  const tmp=output+'.'+process.pid+'.tmp';
  let fd;
  try{
    fd=fs.openSync(tmp,'wx',0o644);
    fs.writeFileSync(fd,payload);
    fs.fsyncSync(fd);
    fs.closeSync(fd);fd=undefined;
    fs.renameSync(tmp,output);
  }finally{
    if(fd!==undefined)fs.closeSync(fd);
    try{fs.unlinkSync(tmp);}catch(_e){}
  }
}
async function main(){
  const args=new Map(process.argv.slice(2).map(arg=>{
    const index=arg.indexOf('=');
    ensure(index>2&&arg.startsWith('--'),'Use --config=... --output=...');
    return[arg.slice(2,index),arg.slice(index+1)];
  }));
  ensure(args.size===2&&args.has('config')&&args.has('output'),'Provide --config and --output');
  const instances=readConfig(args.get('config'));
  const snapshot=await collectStatus(instances);
  publishStatus(args.get('output'),snapshot);
  console.log('WeiG instance status updated: '+snapshot.instances.filter(x=>x.status==='online').length+'/'+instances.length+' verified');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error('WeiG collector:',error.message);process.exitCode=1;});

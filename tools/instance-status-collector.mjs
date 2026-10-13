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
    return{url,probeUrl:item.probeUrl?canonicalAddress(item.probeUrl):url,username:item.username,password:item.password};
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
async function pollOne(item,fetcher,now,sessions){
  const checkedAt=now(),base=item.probeUrl||item.url;
  const row={url:item.url,status:'unverified',count:null,checkedAt};
  try{
    let cookie='',value='',known=sessions?.get(item.url);
    // Session reuse is host-private. A stale cookie is never exposed to WebUI;
    // an invalid qB response forces one fresh login.
    if(known?.probeUrl===base&&/^[A-Za-z0-9_]+=[^;\r\n]+$/.test(known.cookie)){
      const response=await request(fetcher,new URL('api/v2/app/version',base),{headers:{Cookie:known.cookie}});
      if(response.ok){
        value=(await readText(response,128)).trim();
        if(/^v?[1-9]\d*(?:\.\d+){1,3}(?:[-+._][A-Za-z0-9.-]+)?$/i.test(value))cookie=known.cookie;
      }
    }
    if(!cookie){
      sessions?.delete(item.url);
      const login=await request(fetcher,new URL('api/v2/auth/login',base),{
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:new URLSearchParams({username:item.username,password:item.password})
      });
      const reply=await readText(login,256);
      if(!([200,204].includes(login.status)&&(login.status===204||reply.trim()==='Ok.')))return row;
      cookie=(login.headers.get('set-cookie')||'').split(';')[0].trim();
      if(cookie&&!/^[A-Za-z0-9_]+=[^;\r\n]+$/.test(cookie))return row;
      const response=await request(fetcher,new URL('api/v2/app/version',base),{headers:cookie?{Cookie:cookie}:{}});
      if(!response.ok)return row;
      value=(await readText(response,128)).trim();
      if(!/^v?[1-9]\d*(?:\.\d+){1,3}(?:[-+._][A-Za-z0-9.-]+)?$/i.test(value))return row;
      if(cookie)sessions?.set(item.url,{probeUrl:base,cookie});
    }
    row.status='online';
    const headers=cookie?{Cookie:cookie}:{};
    const count=await request(fetcher,new URL('api/v2/torrents/count',base),{headers});
    if(count.ok){
      const text=(await readText(count,128)).trim(),n=Number(text);
      if(/^\d+$/.test(text)&&Number.isSafeInteger(n))row.count=n;
    }else if(count.status===404||count.status===405){
      const listing=await request(fetcher,new URL('api/v2/torrents/info',base),{headers});
      if(listing.ok){
        const torrents=JSON.parse(await readText(listing));
        if(Array.isArray(torrents))row.count=torrents.length;
      }
    }
  }catch(_error){/* Network or count failure cannot be confused with a verified zero. */}
  return row;
}
export async function collectStatus(instances,{fetcher=fetch,now=Date.now,sessions}={}){
  const rows=await Promise.all(instances.map(item=>pollOne(item,fetcher,now,sessions)));
  return{schemaVersion:1,generatedAt:now(),maxAgeMs:90000,instances:rows};
}
export function readSessions(filename){
  try{
    const stat=fs.statSync(filename);
    ensure(stat.isFile()&&(stat.mode&0o077)===0,'Session cache must be a private regular file (chmod 600)');
    ensure(stat.size<=8192,'Session cache exceeds size limit');
    const data=JSON.parse(fs.readFileSync(filename,'utf8'));
    ensure(data?.schemaVersion===1&&Array.isArray(data.items)&&data.items.length<=MAX_INSTANCES,'Invalid session cache schema');
    const sessions=new Map();
    for(const item of data.items){
      ensure(typeof item.url==='string'&&typeof item.probeUrl==='string'
        &&typeof item.cookie==='string'&&/^[A-Za-z0-9_]+=[^;\r\n]+$/.test(item.cookie),'Invalid session cache record');
      sessions.set(canonicalAddress(item.url),{probeUrl:canonicalAddress(item.probeUrl),cookie:item.cookie});
    }
    return sessions;
  }catch(error){
    if(error?.code==='ENOENT')return new Map();
    throw error;
  }
}
export function publishSessions(filename,sessions){
  const data={schemaVersion:1,items:Array.from(sessions.entries()).slice(0,MAX_INSTANCES)
    .map(([url,item])=>({url,probeUrl:item.probeUrl,cookie:item.cookie}))};
  const payload=JSON.stringify(data)+'\n';
  ensure(Buffer.byteLength(payload)<=8192,'Session cache too large');
  const tmp=filename+'.'+process.pid+'.tmp';
  try{
    fs.writeFileSync(tmp,payload,{flag:'wx',mode:0o600});
    fs.renameSync(tmp,filename);
  }finally{try{fs.unlinkSync(tmp);}catch(_e){}}
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
  ensure((args.size===2||args.size===3)&&args.has('config')&&args.has('output')
    &&(args.size===2||args.has('sessions')),'Provide --config, --output, optional --sessions');
  const instances=readConfig(args.get('config'));
  const sessionFile=args.get('sessions'),output=args.get('output');
  if(sessionFile){
    const webuiRoot=path.resolve(path.dirname(path.dirname(output)));
    const relative=path.relative(webuiRoot,path.resolve(sessionFile));
    ensure(relative.startsWith('..'+path.sep)||relative==='..',
      'Session cache must live outside the publicly served WebUI directory');
    // Resolve real parent directories too: a symlinked private cache folder
    // must not redirect SID writes into the public WebUI static tree.
    const realWebui=fs.realpathSync(webuiRoot),realParent=fs.realpathSync(path.dirname(path.resolve(sessionFile)));
    const realRelative=path.relative(realWebui,realParent);
    ensure(realRelative.startsWith('..'+path.sep)||realRelative==='..',
      'Session cache parent resolves inside the public WebUI directory');
  }
  const sessions=sessionFile?readSessions(sessionFile):undefined;
  const snapshot=await collectStatus(instances,{sessions});
  if(sessionFile)publishSessions(sessionFile,sessions);
  publishStatus(output,snapshot);
  console.log('WeiG instance status updated: '+snapshot.instances.filter(x=>x.status==='online').length+'/'+instances.length+' verified');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error('WeiG collector:',error.message);process.exitCode=1;});

#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowWrites=new Set(process.argv.slice(2)).has('--allow-writes');
const norm=v=>String(v||'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const sameNumericVersion=(a,b)=>{const aa=norm(a).split('.'),bb=norm(b).split('.');if(!aa.every(x=>/^\d+$/.test(x))||!bb.every(x=>/^\d+$/.test(x)))return norm(a)===norm(b);const n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++)if(Number(aa[i]||0)!==Number(bb[i]||0))return false;return true;};
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const sha1=b=>crypto.createHash('sha1').update(b).digest();
const redact=v=>String(v??'').replace(/https?:\/\/[^\s'"<>]+/gi,'[REDACTED_URL]');
const die=m=>{throw new Error(redact(m));};
const actions={
  add:'torrentscontroller.h:addAction',
  files:'torrentscontroller.h:filesAction',
  filePrio:'torrentscontroller.h:filePrioAction',
  del:'torrentscontroller.h:deleteAction'
};
const actionNames=Object.values(actions);
const endpoint=a=>`/api/v2/torrents/${a.split(':')[1].slice(0,-6)}`;

function frozen(){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
  const bytes=fs.readFileSync(path.join(root,manifest.catalogPath));
  const digest=sha256(bytes);
  if(digest!==manifest.catalogSha256)die(`Frozen LKG digest mismatch: ${digest}`);
  const catalog=JSON.parse(bytes);
  if(!Array.isArray(catalog)||catalog.length!==manifest.profileCount)die('Frozen LKG profile count mismatch.');
  return {manifest,catalog,digest};
}

class Evidence{
  constructor(meta){this.data={schemaVersion:1,phase:'G',module:'file-priority-lifecycle',...meta,scenarios:[],summary:{PASS:0,FAIL:0,SKIP:0}};}
  push(result,id,extra={}){this.data.scenarios.push({id,result,...extra});this.data.summary[result]++;}
}

function torrentFixture(seed){
  const token=crypto.createHash('sha256').update(seed).digest('hex').slice(0,12);
  const name=`weig-phase-g-file-priority-${token}.bin`;
  const payload=Buffer.from(`WeiG Phase G file priority fixture ${token}\n`,'utf8');
  const piece=sha1(payload);
  const info=Buffer.concat([
    Buffer.from(`d6:lengthi${payload.length}e4:name${Buffer.byteLength(name)}:${name}12:piece lengthi16384e6:pieces20:`,'utf8'),
    piece,
    Buffer.from('e','utf8')
  ]);
  const bytes=Buffer.concat([Buffer.from('d4:info','utf8'),info,Buffer.from('e','utf8')]);
  return {bytes,hash:sha1(info).toString('hex'),name};
}

async function main(){
  const f=frozen();
  const target=process.env.WEIG_QB_URL||'',user=process.env.WEIG_QB_USER||'',pass=process.env.WEIG_QB_PASS||'';
  const weigSha=process.env.WEIG_GIT_SHA||process.env.GITHUB_SHA||'',binary=process.env.WEIG_QB_BINARY_IDENTITY||'';
  if(!target||!user||!pass)die('WEIG_QB_URL, WEIG_QB_USER and WEIG_QB_PASS are required.');
  if(!/^[0-9a-f]{40}$/i.test(weigSha))die('WEIG_GIT_SHA/GITHUB_SHA must be an exact 40-char SHA.');
  if(!binary)die('WEIG_QB_BINARY_IDENTITY is required.');

  const base=new URL(target.endsWith('/')?target:`${target}/`);
  let sessionCookie='',sessionCookieName='',ev=null,qb='unknown',fixtureHash='',fixtureDeleted=false,priorityRestored=false;
  async function http(method,ep,{query,form,auth=true}={}){
    const url=new URL(ep.replace(/^\/+/,''),base);
    for(const [k,v] of Object.entries(query||{}))url.searchParams.set(k,String(v));
    const headers={Accept:'application/json, text/plain, */*'};
    if(auth&&sessionCookie)headers.Cookie=sessionCookie;
    let body;
    if(form){headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';body=new URLSearchParams(Object.entries(form).map(([k,v])=>[k,String(v)]));}
    return fetch(url,{method,headers,body,redirect:'manual'});
  }
  async function uploadTorrent(bytes,filename,extra={}){
    const url=new URL(endpoint(actions.add).replace(/^\/+/,''),base);
    const headers={Accept:'application/json, text/plain, */*',Cookie:sessionCookie};
    const body=new FormData();
    body.append('file',new Blob([bytes],{type:'application/x-bittorrent'}),filename);
    for(const [k,v] of Object.entries(extra))body.append(k,String(v));
    return fetch(url,{method:'POST',headers,body,redirect:'manual'});
  }
  const readJson=async r=>{const t=await r.text();try{return JSON.parse(t);}catch{die(`Expected JSON, HTTP ${r.status}`);}};
  const writeEvidence=()=>{
    if(!ev)return;
    const dir=path.join(root,'artifacts/real-qb');fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,`${weigSha}-${qb}-file-priority.json`);fs.writeFileSync(file,`${JSON.stringify(ev.data,null,2)}\n`);
    console.log(`Real-qB File Priority evidence: ${path.relative(root,file)}`);
    console.log(JSON.stringify(ev.data.summary));
  };
  async function deleteFixture(){
    if(!fixtureHash||fixtureDeleted||!sessionCookie)return;
    try{
      const r=await http('POST',endpoint(actions.del),{form:{hashes:fixtureHash,deleteFiles:'false'}});
      await r.text();
      if([200,204].includes(r.status))fixtureDeleted=true;
    }catch{}
  }

  try{
    const login=await http('POST','/api/v2/auth/login',{form:{username:user,password:pass},auth:false});
    if(![200,204].includes(login.status))die(`login: HTTP ${login.status}`);
    const cookies=typeof login.headers.getSetCookie==='function'?login.headers.getSetCookie():[login.headers.get('set-cookie')].filter(Boolean);
    for(const raw of cookies){const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);if(m){sessionCookieName=m[1];sessionCookie=`${m[1]}=${m[2]}`;break;}}
    await login.text();
    if(!sessionCookie)die('Login returned no session cookie; File Priority evidence cannot continue.');

    const vr=await http('GET','/api/v2/app/version');if(vr.status!==200)die(`app/version: HTTP ${vr.status}`);qb=norm(await vr.text());
    const ar=await http('GET','/api/v2/app/webapiVersion');if(ar.status!==200)die(`app/webapiVersion: HTTP ${ar.status}`);const api=norm(await ar.text());
    const profile=f.catalog.find(x=>norm(x.qbVersion)===qb);if(!profile)die(`qB ${qb} is outside Frozen LKG; fail closed.`);
    if(!sameNumericVersion(profile.webApiVersion,api))die(`WebAPI mismatch for qB ${qb}: expected ${norm(profile.webApiVersion)}, actual ${api}.`);

    ev=new Evidence({
      weig_sha:weigSha,
      webui_version:fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),
      test_time:new Date().toISOString(),
      qb_version:qb,
      webapi_version:api,
      qb_binary_or_source_identity:binary,
      platform:process.env.WEIG_QB_PLATFORM||`${os.platform()} ${os.release()}`,
      architecture:process.env.WEIG_QB_ARCH||os.arch(),
      deployment_mode:process.env.WEIG_QB_DEPLOYMENT_MODE||'unknown',
      install_mode:process.env.WEIG_QB_INSTALL_MODE||'unknown',
      reverse_proxy:process.env.WEIG_QB_REVERSE_PROXY||'unknown',
      https:base.protocol==='https:',
      base_path:base.pathname,
      target_host:'REDACTED',
      frozen_catalog_sha256:f.digest,
      writes_allowed:allowWrites
    });
    ev.push('PASS','auth-session',{response:{status:login.status,session_cookie_name:sessionCookieName}});
    ev.push('PASS','identity',{response:{qbVersion:qb,webApiVersion:api}});

    const available=Array.isArray(profile.apiActions)?profile.apiActions:[];
    const missing=actionNames.filter(a=>!available.includes(a));
    if(missing.length){ev.push('SKIP','file-priority-lifecycle',{reason:'source action unavailable',missing_source_actions:missing});writeEvidence();return;}
    if(!allowWrites){ev.push('SKIP','file-priority-lifecycle',{reason:'writes disabled; use --allow-writes only on isolated test target',source_provenance:actionNames});writeEvidence();return;}

    const fixture=torrentFixture(`${weigSha}:${qb}:file-priority`);fixtureHash=fixture.hash;
    const addParamNames=profile.apiActionParameters?.[actions.add]?.parameters||[];
    const addExtra={};
    if(addParamNames.includes('savepath'))addExtra.savepath='/downloads';
    if(addParamNames.includes('stopped'))addExtra.stopped='true';
    else if(addParamNames.includes('paused'))addExtra.paused='true';

    const add=await uploadTorrent(fixture.bytes,`${fixture.name}.torrent`,addExtra);
    if(![200,202,204].includes(add.status)){await add.text();die(`torrent fixture add: HTTP ${add.status}`);}
    await add.text();

    const filesEp=endpoint(actions.files);
    let files=null,filesStatus=0;
    for(let i=0;i<20;i++){
      const r=await http('GET',filesEp,{query:{hash:fixtureHash}});filesStatus=r.status;
      if(r.status===200){const value=await readJson(r);if(Array.isArray(value)&&value.length>0){files=value;break;}}
      else await r.text();
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!files)die(`uploaded torrent files unavailable; last HTTP ${filesStatus}`);
    const first=files[0];
    const fileId=Number.isInteger(first?.index)?first.index:0;
    const originalPriority=Number(first?.priority);
    if(!Number.isInteger(originalPriority))die('files response returned no integer priority.');
    const changedPriority=(originalPriority===0)?1:0;

    const prioEp=endpoint(actions.filePrio);
    const change=await http('POST',prioEp,{form:{hash:fixtureHash,id:fileId,priority:changedPriority}});
    if(![200,204].includes(change.status)){await change.text();die(`file priority change: HTTP ${change.status}`);}await change.text();

    let changedSeen=false;
    for(let i=0;i<10;i++){
      const r=await http('GET',filesEp,{query:{hash:fixtureHash}});if(r.status!==200){await r.text();die(`files reread after priority change: HTTP ${r.status}`);}
      const value=await readJson(r);const row=Array.isArray(value)?value.find((x,j)=>(Number.isInteger(x?.index)?x.index:j)===fileId):null;
      if(row&&Number(row.priority)===changedPriority){changedSeen=true;break;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!changedSeen)die('file priority change was not observable on reread.');

    const restore=await http('POST',prioEp,{form:{hash:fixtureHash,id:fileId,priority:originalPriority}});
    if(![200,204].includes(restore.status)){await restore.text();die(`file priority restore: HTTP ${restore.status}`);}await restore.text();
    for(let i=0;i<10;i++){
      const r=await http('GET',filesEp,{query:{hash:fixtureHash}});if(r.status!==200){await r.text();die(`files reread after priority restore: HTTP ${r.status}`);}
      const value=await readJson(r);const row=Array.isArray(value)?value.find((x,j)=>(Number.isInteger(x?.index)?x.index:j)===fileId):null;
      if(row&&Number(row.priority)===originalPriority){priorityRestored=true;break;}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!priorityRestored)die('file priority restore was not observable on reread.');

    const del=await http('POST',endpoint(actions.del),{form:{hashes:fixtureHash,deleteFiles:'false'}});
    if(![200,204].includes(del.status)){await del.text();die(`torrent fixture delete: HTTP ${del.status}`);}await del.text();fixtureDeleted=true;

    ev.push('PASS','file-priority-lifecycle',{
      source_provenance:actionNames,
      fixture:{kind:'generated in-memory single-file v1 torrent',info_hash_v1:fixtureHash,network_dependency:'none'},
      request_sequence:[
        {method:'POST',endpoint:endpoint(actions.add),multipart_file:true,paramNames:Object.keys(addExtra).sort()},
        {method:'GET',endpoint:filesEp,paramNames:['hash']},
        {method:'POST',endpoint:prioEp,paramNames:['hash','id','priority']},
        {method:'GET',endpoint:filesEp,paramNames:['hash']},
        {method:'POST',endpoint:prioEp,paramNames:['hash','id','priority']},
        {method:'GET',endpoint:filesEp,paramNames:['hash']},
        {method:'POST',endpoint:endpoint(actions.del),paramNames:['deleteFiles','hashes']}
      ],
      response:{add_status:add.status,files_status:filesStatus,change_status:change.status,restore_status:restore.status,delete_status:del.status,original_priority:originalPriority,changed_priority:changedPriority},
      cleanup_result:'original priority restored and generated torrent deleted'
    });
    writeEvidence();
  }catch(e){
    await deleteFixture();
    if(ev){ev.push('FAIL','file-priority-lifecycle',{reason:redact(e?.message||e),cleanup_result:{priority_restored:priorityRestored,torrent_deleted:fixtureDeleted}});writeEvidence();}
    throw e;
  }finally{
    await deleteFixture();
    if(sessionCookie){try{await http('POST','/api/v2/auth/logout');}catch{}}
  }
}

main().catch(e=>{console.error(redact(e?.stack||e));process.exitCode=1;});

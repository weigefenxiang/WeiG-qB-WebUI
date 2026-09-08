#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptName=path.basename(process.argv[1]||'');
if(scriptName==='real-qb-file-priority.mjs'){
  let started=false;
  process.on('beforeExit',()=>{
    if(started||process.exitCode)return;
    started=true;
    run().catch(e=>{
      console.error(redact(e?.stack||e));
      process.exitCode=1;
    });
  });
}

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const allowWrites=new Set(process.argv.slice(2)).has('--allow-writes');
const norm=v=>String(v||'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const sameNumericVersion=(a,b)=>{const aa=norm(a).split('.'),bb=norm(b).split('.');if(!aa.every(x=>/^\d+$/.test(x))||!bb.every(x=>/^\d+$/.test(x)))return norm(a)===norm(b);const n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++)if(Number(aa[i]||0)!==Number(bb[i]||0))return false;return true;};
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const redact=v=>String(v??'').replace(/https?:\/\/[^\s'"<>]+/gi,'[REDACTED_URL]');
const die=m=>{throw new Error(redact(m));};
const actions={
  add:'torrentcreatorcontroller.h:addTaskAction',
  status:'torrentcreatorcontroller.h:statusAction',
  file:'torrentcreatorcontroller.h:torrentFileAction',
  del:'torrentcreatorcontroller.h:deleteTaskAction'
};
const actionNames=Object.values(actions);
const endpoint=a=>`/api/v2/torrentcreator/${a.split(':')[1].slice(0,-6)}`;

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
  constructor(meta){this.data={schemaVersion:1,phase:'G',module:'torrent-creator-lifecycle',...meta,scenarios:[],summary:{PASS:0,FAIL:0,SKIP:0}};}
  push(result,id,extra={}){this.data.scenarios.push({id,result,...extra});this.data.summary[result]++;}
}

async function run(){
  const f=frozen();
  const target=process.env.WEIG_QB_URL||'',user=process.env.WEIG_QB_USER||'',pass=process.env.WEIG_QB_PASS||'';
  const weigSha=process.env.WEIG_GIT_SHA||process.env.GITHUB_SHA||'',binary=process.env.WEIG_QB_BINARY_IDENTITY||'';
  if(!target||!user||!pass)die('WEIG_QB_URL, WEIG_QB_USER and WEIG_QB_PASS are required.');
  if(!/^[0-9a-f]{40}$/i.test(weigSha))die('WEIG_GIT_SHA/GITHUB_SHA must be an exact 40-char SHA.');
  if(!binary)die('WEIG_QB_BINARY_IDENTITY is required.');

  const base=new URL(target.endsWith('/')?target:`${target}/`);
  let sessionCookie='',sessionCookieName='',ev=null,qb='unknown',taskID='',taskDeleted=false;
  async function http(method,ep,{query,form,auth=true}={}){
    const url=new URL(ep.replace(/^\/+/,''),base);
    for(const [k,v] of Object.entries(query||{}))url.searchParams.set(k,String(v));
    const headers={Accept:'application/json, text/plain, */*'};
    if(auth&&sessionCookie)headers.Cookie=sessionCookie;
    let body;
    if(form){headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';body=new URLSearchParams(Object.entries(form).map(([k,v])=>[k,String(v)]));}
    return fetch(url,{method,headers,body,redirect:'manual'});
  }
  const readJson=async r=>{const t=await r.text();try{return JSON.parse(t);}catch{die(`Expected JSON, HTTP ${r.status}`);}};
  const writeEvidence=()=>{
    if(!ev)return;
    const dir=path.join(root,'artifacts/real-qb');fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,`${weigSha}-${qb}-torrent-creator.json`);
    fs.writeFileSync(file,`${JSON.stringify(ev.data,null,2)}\n`);
    console.log(`Real-qB Torrent Creator evidence: ${path.relative(root,file)}`);
    console.log(JSON.stringify(ev.data.summary));
  };
  async function cleanupTask(){
    if(!taskID||taskDeleted||!sessionCookie)return;
    try{
      const r=await http('POST',endpoint(actions.del),{form:{taskID}});
      await r.text();
      if([200,204,404].includes(r.status))taskDeleted=true;
    }catch{}
  }

  try{
    const login=await http('POST','/api/v2/auth/login',{form:{username:user,password:pass},auth:false});
    if(![200,204].includes(login.status))die(`login: HTTP ${login.status}`);
    const cookies=typeof login.headers.getSetCookie==='function'?login.headers.getSetCookie():[login.headers.get('set-cookie')].filter(Boolean);
    for(const raw of cookies){const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);if(m){sessionCookieName=m[1];sessionCookie=`${m[1]}=${m[2]}`;break;}}
    await login.text();
    if(!sessionCookie)die('Login returned no session cookie; Torrent Creator evidence cannot continue.');

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
    if(missing.length){
      ev.push('SKIP','torrent-creator-lifecycle',{reason:'complete source-proven add/status/torrentFile/delete Creator lifecycle unavailable',missing_source_actions:missing});
      writeEvidence();return;
    }
    if(!allowWrites){
      ev.push('SKIP','torrent-creator-lifecycle',{reason:'writes disabled; use --allow-writes only on isolated test target',source_provenance:actionNames});
      writeEvidence();return;
    }

    const addParams=profile.apiActionParameters?.[actions.add]?.parameters||[];
    const statusParams=profile.apiActionParameters?.[actions.status]?.parameters||[];
    const fileParams=profile.apiActionParameters?.[actions.file]?.parameters||[];
    const deleteParams=profile.apiActionParameters?.[actions.del]?.parameters||[];
    if(!addParams.includes('sourcePath')||!addParams.includes('startSeeding')||!statusParams.includes('taskID')||!fileParams.includes('taskID')||!deleteParams.includes('taskID')){
      ev.push('SKIP','torrent-creator-lifecycle',{
        reason:'Frozen source parameter facts are incomplete for safe Creator lifecycle',
        source_provenance:actionNames,
        required_parameter_facts:{add:['sourcePath','startSeeding'],status:['taskID'],torrentFile:['taskID'],deleteTask:['taskID']}
      });
      writeEvidence();return;
    }

    const add=await http('POST',endpoint(actions.add),{form:{sourcePath:'/etc/hostname',startSeeding:'false'}});
    if(add.status!==200)die(`torrent creator addTask: HTTP ${add.status}`);
    const added=await readJson(add);
    taskID=String(added?.taskID||'').trim();
    if(!taskID)die('torrent creator addTask returned no taskID.');

    let finalTask=null,statusHTTP=0;
    for(let i=0;i<50;i++){
      const status=await http('GET',endpoint(actions.status),{query:{taskID}});
      statusHTTP=status.status;
      if(status.status!==200){await status.text();die(`torrent creator status: HTTP ${status.status}`);}
      const statuses=await readJson(status);
      const task=Array.isArray(statuses)?statuses.find(x=>String(x?.taskID||'')===taskID):null;
      if(!task)die('torrent creator task missing from status response.');
      const state=String(task.status||'');
      if(state==='Failed')die('torrent creator task reported Failed.');
      if(state==='Finished'){finalTask=task;break;}
      if(!['Queued','Running'].includes(state))die(`torrent creator returned unknown task state: ${state||'<empty>'}`);
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!finalTask)die('torrent creator task did not reach Finished state.');

    const torrentFile=await http('GET',endpoint(actions.file),{query:{taskID}});
    if(torrentFile.status!==200){await torrentFile.text();die(`torrent creator torrentFile: HTTP ${torrentFile.status}`);}
    const torrentBytes=Buffer.from(await torrentFile.arrayBuffer());
    if(torrentBytes.length<16||torrentBytes[0]!==0x64||torrentBytes.indexOf(Buffer.from('4:info'))<0)die('torrent creator returned invalid or implausible bencoded torrent data.');
    const torrentDigest=sha256(torrentBytes);

    const del=await http('POST',endpoint(actions.del),{form:{taskID}});
    if(![200,204].includes(del.status)){await del.text();die(`torrent creator deleteTask: HTTP ${del.status}`);}
    await del.text();taskDeleted=true;

    const deletedStatus=await http('GET',endpoint(actions.status),{query:{taskID}});
    const deletedStatusCode=deletedStatus.status;await deletedStatus.text();
    if(deletedStatusCode!==404)die(`torrent creator deleted task still queryable: HTTP ${deletedStatusCode}`);

    ev.push('PASS','torrent-creator-lifecycle',{
      source_provenance:actionNames,
      fixture:{kind:'container-local read-only metadata file',source_path:'/etc/hostname',source_content_recorded:false,network_dependency:'none',start_seeding:false},
      request_sequence:[
        {method:'POST',endpoint:endpoint(actions.add),paramNames:['sourcePath','startSeeding']},
        {method:'GET',endpoint:endpoint(actions.status),paramNames:['taskID']},
        {method:'GET',endpoint:endpoint(actions.file),paramNames:['taskID']},
        {method:'POST',endpoint:endpoint(actions.del),paramNames:['taskID']},
        {method:'GET',endpoint:endpoint(actions.status),paramNames:['taskID']}
      ],
      response:{add_status:add.status,status_status:statusHTTP,final_state:'Finished',torrent_file_status:torrentFile.status,torrent_file_size:torrentBytes.length,torrent_file_sha256:torrentDigest,delete_status:del.status,post_delete_status:deletedStatusCode},
      cleanup_result:'creator task deleted; qB temporary torrent file is confined to the ephemeral isolated container'
    });
    taskID='';
    writeEvidence();
  }catch(e){
    await cleanupTask();
    if(ev){ev.push('FAIL','torrent-creator-lifecycle',{reason:redact(e?.message||e),cleanup_result:{creator_task_deleted:taskDeleted}});writeEvidence();}
    throw e;
  }finally{
    await cleanupTask();
    if(sessionCookie){try{await http('POST','/api/v2/auth/logout');}catch{}}
  }
}

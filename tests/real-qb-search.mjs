#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const norm=v=>String(v||'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const redact=v=>String(v??'').replace(/https?:\/\/[^\s'"<>]+/gi,'[REDACTED_URL]');
const die=m=>{throw new Error(redact(m));};
const actionNames=[
  'searchcontroller.h:startAction',
  'searchcontroller.h:statusAction',
  'searchcontroller.h:resultsAction',
  'searchcontroller.h:stopAction',
  'searchcontroller.h:deleteAction'
];
const endpoint=a=>`/api/v2/search/${a.split(':')[1].slice(0,-6)}`;

function frozen(){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
  const bytes=fs.readFileSync(path.join(root,manifest.catalogPath));
  const digest=hash(bytes);
  if(digest!==manifest.catalogSha256)die(`Frozen LKG digest mismatch: ${digest}`);
  const catalog=JSON.parse(bytes);
  if(!Array.isArray(catalog)||catalog.length!==manifest.profileCount)die('Frozen LKG profile count mismatch.');
  return {manifest,catalog,digest};
}

class Evidence{
  constructor(meta){this.data={schemaVersion:1,phase:'G',module:'search-lifecycle',...meta,scenarios:[],summary:{PASS:0,FAIL:0,SKIP:0}};}
  push(result,id,extra={}){this.data.scenarios.push({id,result,...extra});this.data.summary[result]++;}
}

async function main(){
  const f=frozen();
  const target=process.env.WEIG_QB_URL||'',user=process.env.WEIG_QB_USER||'',pass=process.env.WEIG_QB_PASS||'';
  const weigSha=process.env.WEIG_GIT_SHA||process.env.GITHUB_SHA||'',binary=process.env.WEIG_QB_BINARY_IDENTITY||'';
  if(!target||!user||!pass)die('WEIG_QB_URL, WEIG_QB_USER and WEIG_QB_PASS are required.');
  if(!/^[0-9a-f]{40}$/i.test(weigSha))die('WEIG_GIT_SHA/GITHUB_SHA must be an exact 40-char SHA.');
  if(!binary)die('WEIG_QB_BINARY_IDENTITY is required.');

  const base=new URL(target.endsWith('/')?target:`${target}/`);
  let sessionCookie='',sessionCookieName='',searchId=null,deleted=false,ev=null,qb='unknown';
  async function http(method,ep,{query,form,auth=true}={}){
    const url=new URL(ep.replace(/^\/+/,''),base);
    for(const [k,v] of Object.entries(query||{}))url.searchParams.set(k,String(v));
    const headers={Accept:'application/json, text/plain, */*'};
    if(auth&&sessionCookie)headers.Cookie=sessionCookie;
    let body;
    if(form){headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';body=new URLSearchParams(Object.entries(form).map(([k,v])=>[k,String(v)]));}
    return fetch(url,{method,headers,body,redirect:'manual'});
  }
  const parseJson=async r=>{const t=await r.text();try{return JSON.parse(t);}catch{die(`Expected JSON, HTTP ${r.status}`);}};
  const writeEvidence=()=>{
    if(!ev)return;
    const dir=path.join(root,'artifacts/real-qb');fs.mkdirSync(dir,{recursive:true});
    const file=path.join(dir,`${weigSha}-${qb}-search.json`);fs.writeFileSync(file,`${JSON.stringify(ev.data,null,2)}\n`);
    console.log(`Real-qB Search evidence: ${path.relative(root,file)}`);
    console.log(JSON.stringify(ev.data.summary));
  };

  try{
    const login=await http('POST','/api/v2/auth/login',{form:{username:user,password:pass},auth:false});
    if(![200,204].includes(login.status))die(`login: HTTP ${login.status}`);
    const cookies=typeof login.headers.getSetCookie==='function'?login.headers.getSetCookie():[login.headers.get('set-cookie')].filter(Boolean);
    for(const raw of cookies){const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);if(m){sessionCookieName=m[1];sessionCookie=`${m[1]}=${m[2]}`;break;}}
    await login.text();
    if(!sessionCookie)die('Login returned no session cookie; Search evidence cannot continue.');

    const vr=await http('GET','/api/v2/app/version');if(vr.status!==200)die(`app/version: HTTP ${vr.status}`);qb=norm(await vr.text());
    const ar=await http('GET','/api/v2/app/webapiVersion');if(ar.status!==200)die(`app/webapiVersion: HTTP ${ar.status}`);const api=norm(await ar.text());
    const profile=f.catalog.find(x=>norm(x.qbVersion)===qb);if(!profile)die(`qB ${qb} is outside Frozen LKG; fail closed.`);
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
      frozen_catalog_sha256:f.digest
    });
    ev.push('PASS','auth-session',{response:{status:login.status,session_cookie_name:sessionCookieName}});
    ev.push('PASS','identity',{response:{qbVersion:qb,webApiVersion:api}});

    const available=Array.isArray(profile.apiActions)?profile.apiActions:[];
    const missing=actionNames.filter(a=>!available.includes(a));
    if(missing.length){
      ev.push('SKIP','search-lifecycle',{reason:'source action unavailable',missing_source_actions:missing});
      writeEvidence();return;
    }

    const startEp=endpoint(actionNames[0]);
    const pattern=`weig-phase-g-${weigSha.slice(0,12)}`;
    const start=await http('POST',startEp,{form:{pattern,category:'all',plugins:'all'}});
    if(start.status===409){
      await start.text();
      ev.push('SKIP','search-lifecycle',{reason:'runtime prerequisite unavailable on fresh isolated qB target',source_provenance:actionNames,response:{status:409}});
      writeEvidence();return;
    }
    if(start.status!==200){
      await start.text();
      ev.push('FAIL','search-lifecycle',{reason:'unexpected search start response',source_provenance:actionNames,response:{status:start.status}});
      writeEvidence();process.exitCode=1;return;
    }
    const started=await parseJson(start);
    if(!Number.isInteger(started?.id)){
      ev.push('FAIL','search-lifecycle',{reason:'search start returned no integer id',source_provenance:actionNames,response:{status:200}});
      writeEvidence();process.exitCode=1;return;
    }
    searchId=started.id;

    const statusEp=endpoint(actionNames[1]),resultsEp=endpoint(actionNames[2]),stopEp=endpoint(actionNames[3]),deleteEp=endpoint(actionNames[4]);
    const sr=await http('GET',statusEp,{query:{id:searchId}});if(sr.status!==200)die(`search/status: HTTP ${sr.status}`);const status=await parseJson(sr);
    if(!Array.isArray(status)||!status.some(x=>x?.id===searchId))die('search/status did not return the created search id.');
    const rr=await http('GET',resultsEp,{query:{id:searchId}});if(rr.status!==200)die(`search/results: HTTP ${rr.status}`);const results=await parseJson(rr);
    if(!results||typeof results!=='object'||Array.isArray(results))die('search/results returned an unexpected shape.');
    const stop=await http('POST',stopEp,{form:{id:searchId}});if(![200,204].includes(stop.status))die(`search/stop: HTTP ${stop.status}`);await stop.text();
    const afterStop=await http('GET',statusEp,{query:{id:searchId}});if(afterStop.status!==200)die(`search/status after stop: HTTP ${afterStop.status}`);const stopped=await parseJson(afterStop);
    if(!Array.isArray(stopped)||!stopped.some(x=>x?.id===searchId))die('search/status lost the search before delete.');
    const del=await http('POST',deleteEp,{form:{id:searchId}});if(![200,204].includes(del.status))die(`search/delete: HTTP ${del.status}`);await del.text();deleted=true;
    const afterDelete=await http('GET',statusEp,{query:{id:searchId}});await afterDelete.text();
    if(afterDelete.status!==404)die(`search/status after delete: expected 404, got ${afterDelete.status}`);

    ev.push('PASS','search-lifecycle',{
      source_provenance:actionNames,
      request_sequence:[
        {method:'POST',endpoint:startEp,paramNames:['category','pattern','plugins']},
        {method:'GET',endpoint:statusEp,paramNames:['id']},
        {method:'GET',endpoint:resultsEp,paramNames:['id']},
        {method:'POST',endpoint:stopEp,paramNames:['id']},
        {method:'POST',endpoint:deleteEp,paramNames:['id']},
        {method:'GET',endpoint:statusEp,paramNames:['id']}
      ],
      response:{start:200,status:200,results:200,stop:stop.status,delete:del.status,post_delete_status:404},
      cleanup_result:'search object deleted; post-delete status returned 404'
    });
    writeEvidence();
  }catch(e){
    if(ev){ev.push('FAIL','search-lifecycle',{reason:redact(e?.message||e)});writeEvidence();}
    throw e;
  }finally{
    if(searchId!==null&&!deleted&&sessionCookie){
      try{await http('POST','/api/v2/search/delete',{form:{id:searchId}});}catch{}
    }
    if(sessionCookie){try{await http('POST','/api/v2/auth/logout');}catch{}}
  }
}

main().catch(e=>{console.error(redact(e?.stack||e));process.exitCode=1;});

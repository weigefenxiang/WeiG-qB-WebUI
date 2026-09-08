#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const argv=new Set(process.argv.slice(2));
const planOnly=argv.has('--plan');
const allowWrites=argv.has('--allow-writes');
const norm=v=>String(v||'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const sameNumericVersion=(a,b)=>{const aa=norm(a).split('.'),bb=norm(b).split('.');if(!aa.every(x=>/^\d+$/.test(x))||!bb.every(x=>/^\d+$/.test(x)))return norm(a)===norm(b);const n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++)if(Number(aa[i]||0)!==Number(bb[i]||0))return false;return true;};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const redact=v=>String(v??'').replace(/https?:\/\/[^\s'"<>]+/gi,'[REDACTED_URL]');
const die=m=>{throw new Error(redact(m));};

function frozen(){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
  const file=path.join(root,manifest.catalogPath);
  const bytes=fs.readFileSync(file),digest=hash(bytes);
  if(digest!==manifest.catalogSha256)die(`Frozen LKG digest mismatch: ${digest}`);
  const catalog=JSON.parse(bytes);
  if(!Array.isArray(catalog)||catalog.length!==manifest.profileCount)die('Frozen LKG profile count mismatch.');
  if(norm(catalog[0]?.qbVersion)!==norm(manifest.supportFloor)||norm(catalog.at(-1)?.qbVersion)!==norm(manifest.latestAdmittedStable))die('Frozen LKG boundary mismatch.');
  return {manifest,catalog,digest};
}
const has=(p,a)=>Array.isArray(p?.apiActions)&&p.apiActions.includes(a);
const params=(p,a)=>p?.apiActionParameters?.[a]||{parameters:[],required:[],optional:[]};
function endpoint(action){
  const [controller,name]=String(action||'').split(':');
  const ns={'appcontroller.h':'app','logcontroller.h':'log','rsscontroller.h':'rss','searchcontroller.h':'search','synccontroller.h':'sync','torrentscontroller.h':'torrents','transfercontroller.h':'transfer','torrentcreatorcontroller.h':'torrentcreator'}[controller];
  return ns&&name?.endsWith('Action')?`/api/v2/${ns}/${name.slice(0,-6)}`:null;
}
const first=(p,list)=>list.find(a=>has(p,a))||null;
function scenarios(p){
  const out=[],add=(id,a,mode='read')=>{if(has(p,a))out.push({id,mode,sourceAction:a,endpoint:endpoint(a),parameters:params(p,a)});};
  const lifecycle=(id,actions)=>{if(actions.every(a=>a&&has(p,a)))out.push({id,mode:'safe-write',sourceActions:actions,endpoints:actions.map(endpoint),parameters:Object.fromEntries(actions.map(a=>[a,params(p,a)]))});};
  for(const [id,a] of [
    ['torrent-list','torrentscontroller.h:infoAction'],['settings-read','appcontroller.h:preferencesAction'],
    ['transfer-info','transfercontroller.h:infoAction'],['logs-main','logcontroller.h:mainAction'],
    ['logs-peers','logcontroller.h:peersAction'],['rss-items','rsscontroller.h:itemsAction'],
    ['search-plugins','searchcontroller.h:pluginsAction'],['search-status','searchcontroller.h:statusAction']
  ])add(id,a);
  if(has(p,'appcontroller.h:setPreferencesAction')&&(p.preferenceDescriptors||[]).some(x=>x?.writable===true))add('settings-noop-write','appcontroller.h:setPreferencesAction','safe-write');
  if(has(p,'torrentscontroller.h:addAction')&&has(p,'torrentscontroller.h:deleteAction')){
    add('isolated-torrent-add','torrentscontroller.h:addAction','safe-write');
    const stop=first(p,['torrentscontroller.h:stopAction','torrentscontroller.h:pauseAction']);
    const start=first(p,['torrentscontroller.h:startAction','torrentscontroller.h:resumeAction']);
    if(stop)add('isolated-torrent-stop',stop,'safe-write');if(start)add('isolated-torrent-start',start,'safe-write');
    for(const [id,a] of [['details-properties','torrentscontroller.h:propertiesAction'],['details-files','torrentscontroller.h:filesAction'],['details-trackers','torrentscontroller.h:trackersAction'],['details-webseeds','torrentscontroller.h:webseedsAction'],['details-peers','synccontroller.h:torrentPeersAction']])add(id,a);
    add('isolated-torrent-delete','torrentscontroller.h:deleteAction','cleanup');
  }
  const categoryRead=first(p,['torrentscontroller.h:categoriesAction','synccontroller.h:maindataAction']);
  lifecycle('category-lifecycle',['torrentscontroller.h:createCategoryAction',categoryRead,'torrentscontroller.h:removeCategoriesAction']);
  lifecycle('tag-lifecycle',['torrentscontroller.h:createTagsAction','torrentscontroller.h:tagsAction','torrentscontroller.h:deleteTagsAction']);
  lifecycle('rss-lifecycle',['rsscontroller.h:addFeedAction','rsscontroller.h:itemsAction','rsscontroller.h:removeItemAction']);
  add('torrent-creator-add','torrentcreatorcontroller.h:addTaskAction','fixture-write');
  return out;
}
function plan(f){
  const matrix=[
    ['support-floor',f.manifest.supportFloor],['mature-qb4','4.6.7'],
    ['qb5-generation','5.0.0'],['latest-admitted-stable',f.manifest.latestAdmittedStable]
  ].map(([role,version])=>{
    const p=f.catalog.find(x=>norm(x.qbVersion)===norm(version));if(!p)die(`Frozen profile missing: ${version}`);
    return {role,version,webApiVersion:p.webApiVersion,scenarios:scenarios(p)};
  });
  return {schemaVersion:1,phase:'G',catalogSha256:f.digest,writeDefault:'DENY',writeOptIn:'--allow-writes',matrix};
}
class Evidence{
  constructor(meta){this.data={schemaVersion:1,phase:'G',...meta,scenarios:[],summary:{PASS:0,FAIL:0,SKIP:0}};}
  push(result,id,extra={}){this.data.scenarios.push({id,result,...extra});this.data.summary[result]++;}
}
const req=(method,ep,names=[])=>({method,endpoint:ep,paramNames:[...names].sort()});
const shape=v=>Array.isArray(v)?{type:'array',items:v.length}:v&&typeof v==='object'?{type:'object',keys:Object.keys(v).sort().slice(0,40)}:{type:typeof v};

async function run(){
  const f=frozen();
  if(planOnly){console.log(JSON.stringify(plan(f),null,2));return;}
  const target=process.env.WEIG_QB_URL||'',user=process.env.WEIG_QB_USER||'',pass=process.env.WEIG_QB_PASS||'';
  const weigSha=process.env.WEIG_GIT_SHA||process.env.GITHUB_SHA||'',binary=process.env.WEIG_QB_BINARY_IDENTITY||'';
  if(!target||!user||!pass)die('WEIG_QB_URL, WEIG_QB_USER and WEIG_QB_PASS are required.');
  if(!/^[0-9a-f]{40}$/i.test(weigSha))die('WEIG_GIT_SHA/GITHUB_SHA must be an exact 40-char SHA.');
  if(!binary)die('WEIG_QB_BINARY_IDENTITY is required.');
  const base=new URL(target.endsWith('/')?target:`${target}/`);let sessionCookie='',sessionCookieName='',profile=null,testHash='',testCategory='',testTag='',testRssPath='';
  async function http(method,ep,{query,form,multipart,auth=true}={}){
    const url=new URL(ep.replace(/^\/+/,''),base);for(const [k,v] of Object.entries(query||{}))url.searchParams.set(k,String(v));
    const headers={Accept:'application/json, text/plain, */*'};if(auth&&sessionCookie)headers.Cookie=sessionCookie;
    let body;if(multipart){body=new FormData();for(const [k,v] of Object.entries(multipart))body.append(k,String(v));}
    else if(form){headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';body=new URLSearchParams(Object.entries(form).map(([k,v])=>[k,String(v)]));}
    return fetch(url,{method,headers,body,redirect:'manual'});
  }
  const ok=(r,label,codes=[200,204])=>{if(!codes.includes(r.status))die(`${label}: HTTP ${r.status}`);};
  const json=async r=>{const t=await r.text();try{return JSON.parse(t);}catch{die(`Expected JSON, HTTP ${r.status}`);}};
  const cleanup=[];
  async function removeTest(){
    if(testHash&&profile&&has(profile,'torrentscontroller.h:deleteAction')){
      try{const r=await http('POST',endpoint('torrentscontroller.h:deleteAction'),{form:{hashes:testHash,deleteFiles:'false'}});cleanup.push(`torrent-delete:${r.status}`);}catch(e){cleanup.push(`cleanup-error:${redact(e.message)}`);}
      testHash='';
    }
    if(testRssPath&&profile&&has(profile,'rsscontroller.h:removeItemAction')){
      try{const r=await http('POST',endpoint('rsscontroller.h:removeItemAction'),{form:{path:testRssPath}});cleanup.push(`rss-delete:${r.status}`);}catch(e){cleanup.push(`cleanup-error:${redact(e.message)}`);}
      testRssPath='';
    }
    if(testTag&&profile&&has(profile,'torrentscontroller.h:deleteTagsAction')){
      try{const r=await http('POST',endpoint('torrentscontroller.h:deleteTagsAction'),{form:{tags:testTag}});cleanup.push(`tag-delete:${r.status}`);}catch(e){cleanup.push(`cleanup-error:${redact(e.message)}`);}
      testTag='';
    }
    if(testCategory&&profile&&has(profile,'torrentscontroller.h:removeCategoriesAction')){
      try{const r=await http('POST',endpoint('torrentscontroller.h:removeCategoriesAction'),{form:{categories:testCategory}});cleanup.push(`category-delete:${r.status}`);}catch(e){cleanup.push(`cleanup-error:${redact(e.message)}`);}
      testCategory='';
    }
    try{if(sessionCookie)await http('POST','/api/v2/auth/logout');}catch{}
  }

  const login=await http('POST','/api/v2/auth/login',{form:{username:user,password:pass},auth:false});ok(login,'login');
  const cookies=typeof login.headers.getSetCookie==='function'?login.headers.getSetCookie():[login.headers.get('set-cookie')].filter(Boolean);
  for(const raw of cookies){const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);if(m){sessionCookieName=m[1];sessionCookie=`${m[1]}=${m[2]}`;break;}}
  await login.text();if(!sessionCookie)die('Login returned no session cookie; formal session evidence cannot continue.');

  let ev,fatal=null;
  try{
    const vr=await http('GET','/api/v2/app/version');ok(vr,'app/version',[200]);const qb=norm(await vr.text());
    const ar=await http('GET','/api/v2/app/webapiVersion');ok(ar,'app/webapiVersion',[200]);const api=norm(await ar.text());
    profile=f.catalog.find(x=>norm(x.qbVersion)===qb);if(!profile)die(`qB ${qb} is outside Frozen LKG; fail closed.`);
    if(!sameNumericVersion(profile.webApiVersion,api))die(`WebAPI mismatch for qB ${qb}: expected ${norm(profile.webApiVersion)}, actual ${api}.`);
    ev=new Evidence({weig_sha:weigSha,webui_version:fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),test_time:new Date().toISOString(),qb_version:qb,webapi_version:api,qb_binary_or_source_identity:binary,platform:process.env.WEIG_QB_PLATFORM||`${os.platform()} ${os.release()}`,architecture:process.env.WEIG_QB_ARCH||os.arch(),deployment_mode:process.env.WEIG_QB_DEPLOYMENT_MODE||'unknown',install_mode:process.env.WEIG_QB_INSTALL_MODE||'unknown',reverse_proxy:process.env.WEIG_QB_REVERSE_PROXY||'unknown',https:base.protocol==='https:',base_path:base.pathname,target_host:'REDACTED',frozen_catalog_sha256:f.digest,writes_allowed:allowWrites});
    ev.push('PASS','auth-session',{request:req('POST','/api/v2/auth/login',['username','password']),response:{status:login.status,body:'REDACTED',session_cookie_name:sessionCookieName}});
    ev.push('PASS','identity',{response:{qbVersion:qb,webApiVersion:api}});
    let preferences=null;
    async function read(id,action,query={}){
      if(!has(profile,action)){ev.push('SKIP',id,{reason:'source action unavailable',source_provenance:action});return null;}
      const missing=(params(profile,action).required||[]).filter(k=>!(k in query));
      if(missing.length){ev.push('SKIP',id,{reason:'fixture parameters required',source_provenance:action,required_parameters:missing});return null;}
      const ep=endpoint(action),r=await http('GET',ep,{query});
      if(r.status!==200){ev.push('FAIL',id,{source_provenance:action,response:{status:r.status}});return null;}
      const v=await json(r);ev.push('PASS',id,{source_provenance:action,request:req('GET',ep,Object.keys(query)),response:{status:r.status,...shape(v)}});return v;
    }
    async function categoryNames(action){
      const ep=endpoint(action),query=action==='synccontroller.h:maindataAction'?{rid:0}:{};const r=await http('GET',ep,{query});ok(r,'category read',[200]);const v=await json(r);
      if(action==='torrentscontroller.h:categoriesAction'&&v&&typeof v==='object'&&!Array.isArray(v))return {names:Object.keys(v),status:r.status,request:req('GET',ep)};
      if(action==='synccontroller.h:maindataAction'&&Array.isArray(v?.categories))return {names:v.categories.map(String),status:r.status,request:req('GET',ep,['rid'])};
      die(`Unexpected category read shape from ${action}`);
    }
    await read('torrent-list','torrentscontroller.h:infoAction',{limit:1});
    preferences=await read('settings-read','appcontroller.h:preferencesAction');
    await read('transfer-info','transfercontroller.h:infoAction');
    await read('logs-main','logcontroller.h:mainAction');
    await read('logs-peers','logcontroller.h:peersAction');
    await read('rss-items','rsscontroller.h:itemsAction');
    await read('search-plugins','searchcontroller.h:pluginsAction');
    await read('search-status','searchcontroller.h:statusAction');

    if(!allowWrites){
      for(const s of scenarios(profile).filter(x=>x.mode!=='read'))ev.push('SKIP',s.id,{reason:'writes disabled; use --allow-writes only on isolated test target',source_provenance:s.sourceAction||s.sourceActions});
    }else{
      const set='appcontroller.h:setPreferencesAction';
      if(has(profile,set)&&preferences&&typeof preferences==='object'){
        const safeNoopKeys=['dl_limit','up_limit','alt_dl_limit','alt_up_limit','max_connec','max_uploads','queueing_enabled'];const d=safeNoopKeys.map(key=>(profile.preferenceDescriptors||[]).find(x=>x?.key===key&&x?.writable===true)).find(x=>x&&Object.hasOwn(preferences,x.key)&&['string','number','boolean'].includes(typeof preferences[x.key]));
        if(d){const ep=endpoint(set),r=await http('POST',ep,{form:{json:JSON.stringify({[d.key]:preferences[d.key]})}});ok(r,'settings no-op');await r.text();const rr=await http('GET',endpoint('appcontroller.h:preferencesAction'));ok(rr,'settings reread',[200]);const after=await json(rr);if(after[d.key]!==preferences[d.key])die(`No-op Preference changed: ${d.key}`);ev.push('PASS','settings-noop-write',{source_provenance:set,request:req('POST',ep,['json']),response:{status:r.status,body:'REDACTED'},cleanup_result:'no state delta'});}
        else ev.push('SKIP','settings-noop-write',{reason:'no pre-approved source-proven writable no-op Preference in response'});
      }
      if(has(profile,'torrentscontroller.h:addAction')&&has(profile,'torrentscontroller.h:deleteAction')){
        testHash=crypto.randomBytes(20).toString('hex');const ep=endpoint('torrentscontroller.h:addAction');
        const r=await http('POST',ep,{multipart:{urls:`magnet:?xt=urn:btih:${testHash}&dn=WeiG-PhaseG-${testHash.slice(0,8)}`}});ok(r,'isolated torrent add',[200,202]);await r.text();
        let seen=false;for(let i=0;i<10;i++){const q=await http('GET',endpoint('torrentscontroller.h:infoAction'),{query:{hashes:testHash}});if(q.status===200){const list=await json(q);if(Array.isArray(list)&&list.some(x=>String(x?.hash||'').toLowerCase()===testHash)){seen=true;break;}}await new Promise(r=>setTimeout(r,300));}
        if(!seen)die('Isolated torrent not visible after add.');ev.push('PASS','isolated-torrent-add',{source_provenance:'torrentscontroller.h:addAction',request:req('POST',ep,['urls']),response:{status:r.status,body:'REDACTED'}});
        for(const [id,a] of [['isolated-torrent-stop',first(profile,['torrentscontroller.h:stopAction','torrentscontroller.h:pauseAction'])],['isolated-torrent-start',first(profile,['torrentscontroller.h:startAction','torrentscontroller.h:resumeAction'])]]){
          if(!a){ev.push('SKIP',id,{reason:'source action unavailable'});continue;}const p=endpoint(a),x=await http('POST',p,{form:{hashes:testHash}});ok(x,id);await x.text();ev.push('PASS',id,{source_provenance:a,request:req('POST',p,['hashes']),response:{status:x.status}});
        }
        for(const [id,a,q] of [['details-properties','torrentscontroller.h:propertiesAction',{hash:testHash}],['details-files','torrentscontroller.h:filesAction',{hash:testHash}],['details-trackers','torrentscontroller.h:trackersAction',{hash:testHash}],['details-webseeds','torrentscontroller.h:webseedsAction',{hash:testHash}],['details-peers','synccontroller.h:torrentPeersAction',{hash:testHash,rid:0}]])await read(id,a,q);
        const de=endpoint('torrentscontroller.h:deleteAction'),dr=await http('POST',de,{form:{hashes:testHash,deleteFiles:'false'}});ok(dr,'isolated torrent delete');await dr.text();ev.push('PASS','isolated-torrent-delete',{source_provenance:'torrentscontroller.h:deleteAction',request:req('POST',de,['hashes','deleteFiles']),response:{status:dr.status},cleanup_result:'test torrent deleted'});testHash='';
      }

      const catCreate='torrentscontroller.h:createCategoryAction',catRead=first(profile,['torrentscontroller.h:categoriesAction','synccontroller.h:maindataAction']),catDelete='torrentscontroller.h:removeCategoriesAction';
      if(catRead&&[catCreate,catRead,catDelete].every(a=>has(profile,a))){
        testCategory=`WeiG-PhaseG-cat-${crypto.randomBytes(4).toString('hex')}`;
        const cr=await http('POST',endpoint(catCreate),{form:{category:testCategory}});ok(cr,'category create');await cr.text();
        const before=await categoryNames(catRead);if(!before.names.includes(testCategory))die('Created test category not visible.');
        const dr=await http('POST',endpoint(catDelete),{form:{categories:testCategory}});ok(dr,'category delete');await dr.text();
        const after=await categoryNames(catRead);if(after.names.includes(testCategory))die('Deleted test category still visible.');
        ev.push('PASS','category-lifecycle',{source_provenance:[catCreate,catRead,catDelete],request:[req('POST',endpoint(catCreate),['category']),before.request,req('POST',endpoint(catDelete),['categories']),after.request],response:{create_status:cr.status,read_status:before.status,delete_status:dr.status,reread_status:after.status},cleanup_result:'generated test category absent after delete'});testCategory='';
      }else ev.push('SKIP','category-lifecycle',{reason:'complete source-proven create/read/delete category lifecycle unavailable'});

      const tagCreate='torrentscontroller.h:createTagsAction',tagRead='torrentscontroller.h:tagsAction',tagDelete='torrentscontroller.h:deleteTagsAction';
      if([tagCreate,tagRead,tagDelete].every(a=>has(profile,a))){
        testTag=`WeiG-PhaseG-tag-${crypto.randomBytes(4).toString('hex')}`;
        const cr=await http('POST',endpoint(tagCreate),{form:{tags:testTag}});ok(cr,'tag create');await cr.text();
        const rr=await http('GET',endpoint(tagRead));ok(rr,'tag read',[200]);const before=await json(rr);if(!Array.isArray(before)||!before.map(String).includes(testTag))die('Created test tag not visible.');
        const dr=await http('POST',endpoint(tagDelete),{form:{tags:testTag}});ok(dr,'tag delete');await dr.text();
        const ar=await http('GET',endpoint(tagRead));ok(ar,'tag reread',[200]);const after=await json(ar);if(!Array.isArray(after)||after.map(String).includes(testTag))die('Deleted test tag still visible.');
        ev.push('PASS','tag-lifecycle',{source_provenance:[tagCreate,tagRead,tagDelete],request:[req('POST',endpoint(tagCreate),['tags']),req('GET',endpoint(tagRead)),req('POST',endpoint(tagDelete),['tags']),req('GET',endpoint(tagRead))],response:{create_status:cr.status,read_status:rr.status,delete_status:dr.status,reread_status:ar.status},cleanup_result:'generated test tag absent after delete'});testTag='';
      }else ev.push('SKIP','tag-lifecycle',{reason:'complete source-proven create/read/delete tag lifecycle unavailable'});

      const rssAdd='rsscontroller.h:addFeedAction',rssRead='rsscontroller.h:itemsAction',rssDelete='rsscontroller.h:removeItemAction';
      if([rssAdd,rssRead,rssDelete].every(a=>has(profile,a))){
        const token=crypto.randomBytes(4).toString('hex');testRssPath=`WeiG-PhaseG-rss-${token}`;const testRssUrl=`http://127.0.0.1:1/${token}.rss`;
        const cr=await http('POST',endpoint(rssAdd),{form:{url:testRssUrl,path:testRssPath}});ok(cr,'rss add feed');await cr.text();
        const rr=await http('GET',endpoint(rssRead),{query:{withData:'false'}});ok(rr,'rss items',[200]);const before=await json(rr);if(!before||typeof before!=='object'||Array.isArray(before)||!Object.hasOwn(before,testRssPath))die('Created test RSS feed not visible.');
        const dr=await http('POST',endpoint(rssDelete),{form:{path:testRssPath}});ok(dr,'rss remove item');await dr.text();
        const ar=await http('GET',endpoint(rssRead),{query:{withData:'false'}});ok(ar,'rss items reread',[200]);const after=await json(ar);if(!after||typeof after!=='object'||Array.isArray(after)||Object.hasOwn(after,testRssPath))die('Deleted test RSS feed still visible.');
        ev.push('PASS','rss-lifecycle',{source_provenance:[rssAdd,rssRead,rssDelete],request:[req('POST',endpoint(rssAdd),['url','path']),req('GET',endpoint(rssRead),['withData']),req('POST',endpoint(rssDelete),['path']),req('GET',endpoint(rssRead),['withData'])],response:{create_status:cr.status,read_status:rr.status,delete_status:dr.status,reread_status:ar.status},cleanup_result:'generated test RSS feed absent after delete; feed URL loopback-only and unreachable'});testRssPath='';
      }else ev.push('SKIP','rss-lifecycle',{reason:'complete source-proven add/read/remove RSS lifecycle unavailable'});

      for(const s of scenarios(profile).filter(x=>x.mode==='fixture-write'))ev.push('SKIP',s.id,{reason:'requires dedicated server-side fixture; not faked',source_provenance:s.sourceAction});
    }
  }catch(e){fatal=e;if(ev)ev.push('FAIL','fatal',{error:redact(e.message)});}
  finally{
    await removeTest();
    if(ev){ev.data.cleanup_result=cleanup;const dir=path.resolve(process.env.WEIG_REAL_QB_EVIDENCE_DIR||path.join(root,'artifacts/real-qb'));fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`${weigSha}-${ev.data.qb_version}.json`);fs.writeFileSync(file,JSON.stringify(ev.data,null,2)+'\n');console.log(`Real-qB evidence: ${path.relative(root,file)}`);console.log(JSON.stringify(ev.data.summary));}
  }
  if(fatal)throw fatal;if(ev?.data.summary.FAIL)process.exitCode=1;
}
async function entry(){
  await run();
  if(planOnly)return;
  const args=[path.join(root,'tests/real-qb-file-priority.mjs')];
  if(allowWrites)args.push('--allow-writes');
  const child=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
  if(child.error)throw child.error;
  if(child.status!==0)process.exitCode=child.status??1;
}
entry().catch(e=>{console.error(`FAIL: ${redact(e.message||e)}`);process.exitCode=1;});

#!/usr/bin/env node
// Two REAL isolated qB versions; one canonical materialized read-only WebUI.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {launchBrowser} from './browser-driver.mjs';
const sha=process.env.GITHUB_SHA||'',versions=['4.6.7','5.2.4'];
const id='weig-a72-shared-'+process.pid+'-'+Date.now();
const stage=fs.mkdtempSync(path.join(os.tmpdir(),'weig-a72-'));
const containers=[];let browser;
const sh=(bin,args)=>execFileSync(bin,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(base){
 for(let i=0;i<120;i++){try{const r=await fetch(base+'api/v2/app/version',{signal:AbortSignal.timeout(1500)});if(r.status===200||r.status===403)return;}catch{}await sleep(1000);}
 throw Error('Real qB listener unavailable');
}
async function getPassword(name){
 for(let i=0;i<30;i++){const logs=spawnSync('docker',['logs',name],{encoding:'utf8'});assert(logs.status===0,'Cannot inspect disposable qB startup logs');const found=Array.from((String(logs.stdout||'')+'\n'+String(logs.stderr||'')).matchAll(/temporary password is provided for this session:\s*(\S+)/gi));if(found.length)return found[found.length-1][1];await sleep(1000);}
 return 'adminadmin';
}
async function configure(q){
 const login=await fetch(q.url+'api/v2/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password:q.password})});
 assert(login.status===200||login.status===204,'Real qB '+q.version+' login HTTP '+login.status);
 const loginReply=(await login.text()).trim();
 assert(login.status===204||loginReply==='Ok.','Real qB '+q.version+' login did not accept disposable credentials');
 q.sid=(login.headers.get('set-cookie')||'').split(';')[0];
 const cookieMatch=q.sid.match(/^([A-Za-z0-9_]+)=([^;]+)$/);
 const expected=q.version==='5.2.4'?/^QBT_SID_[0-9]+$/:/^SID$/;
 assert(cookieMatch&&expected.test(cookieMatch[1]),'Real qB '+q.version+' successful login returned unexpected cookie identity');
 q.sessionCookieName=cookieMatch[1];
 const set=await fetch(q.url+'api/v2/app/setPreferences',{method:'POST',headers:{Cookie:q.sid,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({json:JSON.stringify({alternative_webui_enabled:true,alternative_webui_path:'/weig-webui'})})});
 assert(set.ok,'Real qB Alternative WebUI setting failed');await set.text();
}
async function awaitRealApp(page,q,stage){
 try{await page.locator('#app').waitFor({timeout:20000});}
 catch(error){
   let diagnosis={};
   try{diagnosis=await page.evaluate(async()=>{
     let apiStatus=0;
     try{apiStatus=(await fetch('/api/v2/app/preferences',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(3500)})).status;}catch(_e){}
     const app=document.querySelector('#app'),login=document.querySelector('#login-form');
     return{path:location.pathname,hash:location.hash,apiStatus,loginVisible:!!(login&&login.getClientRects().length),appPresent:!!app,appHidden:!!(app&&(app.hidden||app.getAttribute('aria-hidden')==='true')),sessionLocked:document.documentElement.dataset.sessionLocked||'',sessionState:window.WeiG?.SessionController?.state?.()||'unknown',buildSha:document.querySelector('meta[name="weig-build-sha"]')?.content||'',qbLabel:document.querySelector('#qb-version')?.textContent?.trim()||''};
   });}catch(_e){diagnosis={inspection:'unavailable'};}
   const cookies=await page.context().cookies(q.url).catch(()=>[]);
   diagnosis.browserSessionCookiePresent=cookies.some(c=>c.name===q.sessionCookieName);
   throw new Error('Real qB '+q.version+' '+stage+' app invisible: '+JSON.stringify(diagnosis));
 }
}
async function enter(context,q){
 const page=await context.newPage();await page.goto(q.url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#login-form').waitFor({timeout:20000});
 assert(await page.locator('meta[name="weig-build-sha"]').getAttribute('content')===sha,'Public WebUI SHA mismatch');
 await page.locator('#username').fill('admin');await page.locator('#password').fill(q.password);await page.locator('#login-btn').click();
 await awaitRealApp(page,q,'first-login');
 await page.waitForFunction(()=>document.querySelector('#qb-version')?.textContent?.includes('.'),null,{timeout:20000});
 assert((await page.locator('#qb-version').innerText()).includes(q.version),'Browser qB version mismatch');
 return page;
}
// Fetch private materialized bytes in the authenticated browser, never with
// a pre-Alternative-WebUI bootstrap SID that qB 4.x may have invalidated.
async function browserPrivateAssetDigests(page,q){
 const paths=['bootstrap-plan.json','scripts/runtime-assets.js','scripts/capabilities.js'];
 const responses=await page.evaluate(async assets=>{
   const out=[];
   for(const asset of assets){
     const response=await fetch(asset,{credentials:'same-origin',cache:'no-store'});
     out.push({path:asset,status:response.status,body:response.status===200?await response.text():''});
   }
   return out;
 },paths);
 const result={};
 for(const row of responses){
   assert(row.status===200,'Authenticated real qB '+q.version+' private asset '+row.path+' HTTP '+row.status);
   assert(row.body.length>100,'Real qB '+q.version+' private asset truncated: '+row.path);
   result[row.path]=crypto.createHash('sha256').update(Buffer.from(row.body)).digest('hex');
 }
 return result;
}
async function verifyInstanceSettings(page,q){
 await page.locator('#app-nav [data-route="settings"]').click();
 await page.waitForFunction(()=>location.hash.includes('settings'),null,{timeout:20000});
 await page.locator('#settings-content[data-settings-renderer="canonical"]').waitFor({timeout:20000});
 const snapshot=await page.evaluate(async origin=>{
   const registry=window.WeiG?.CapabilityRegistry;
   const identity=registry?.releaseIdentity?.(),settingsDomain=registry?.domainResolution?.('settings');
   const [res,webApi]=await Promise.all([
     fetch(new URL('api/v2/app/preferences',origin),{credentials:'same-origin',cache:'no-store'}),
     fetch(new URL('api/v2/app/webapiVersion',origin),{credentials:'same-origin',cache:'no-store'})
   ]);
   if(res.status!==200||webApi.status!==200)return{identity,settingsDomain,status:res.status,apiStatus:webApi.status,keys:0};
   const prefs=await res.json(),apiVersion=(await webApi.text()).trim();
   return{identity,settingsDomain,status:res.status,apiStatus:webApi.status,apiVersion,keys:Object.keys(prefs||{}).length,hasAltPath:Object.prototype.hasOwnProperty.call(prefs||{},'alternative_webui_path')};
 },q.url);
 assert(snapshot.status===200&&snapshot.keys>0&&snapshot.hasAltPath,'Real qB '+q.version+' authenticated Settings GET unavailable');
 assert(snapshot.apiStatus===200&&/^\d+\.\d+/.test(snapshot.apiVersion),'Real qB '+q.version+' WebAPI version GET unavailable');
 assert(snapshot.identity&&snapshot.identity.detectedQbVersion===q.version,'Real qB '+q.version+' Settings retained wrong CapabilityRegistry identity');
 assert(snapshot.identity.detectedWebApiVersion===snapshot.apiVersion,'Real qB '+q.version+' registry used another server WebAPI identity');
 assert(snapshot.settingsDomain&&snapshot.settingsDomain.fallback===false&&snapshot.settingsDomain.detectedWebApiVersion===snapshot.apiVersion,'Real qB '+q.version+' Settings mapped to unproven source domain');
 return{qb_version:q.version,webapi_version:snapshot.apiVersion,settings_get:'PASS',settings_source_identity:'PASS',settings_domain_source:'PASS'};
}
async function test(){
 assert(/^[a-f0-9]{40}$/i.test(sha)&&sh('git',['rev-parse','HEAD'])===sha,'Exact SHA identity missing');
 assert(fs.readFileSync('VERSION','utf8').trim()==='1.2.1','A72 VERSION drift');
 assert(JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8')).latestAdmittedStable==='5.2.4','Frozen boundary drift');
 const shared=path.join(stage,'shared'),dist=path.join(stage,'dist');fs.mkdirSync(shared);fs.chmodSync(stage,0o755);fs.chmodSync(shared,0o755);
 sh('node',['tools/build-webui-dist.mjs','--webui-root=webui','--out='+dist,'--sha='+sha,'--version=1.2.1']);
 sh('tar',['-xzf',path.join(dist,'weig-qb-webui.tar.gz'),'-C',shared,'--strip-components=1']);
 assert(fs.readFileSync(path.join(shared,'GIT_SHA'),'utf8').trim()===sha,'Archive SHA drift');
 assert(fs.readFileSync(path.join(shared,'VERSION'),'utf8').trim()==='1.2.1','Archive VERSION drift');
 sh('node',['tools/qb-runtime-copy-product.mjs','validate',path.join(shared,'private/data')]);
 sh('docker',['network','create','--internal',id]);
 const qbs=[];
 for(const version of versions){
   const image=sh('bash',['tests/real-qb-docker.sh','--version',version,'--resolve-image-only']);
   assert(/@sha256:[a-f0-9]{64}$/.test(image),'qB resolver did not provide immutable digest');
   const name=id+'-'+version.replace(/\./g,'-');
   sh('docker',['run','-d','-t','--name',name,'--network',id,
     '--tmpfs','/config:rw,exec,nosuid,nodev,mode=1777','--tmpfs','/downloads:rw,nosuid,nodev,mode=1777',
     '--mount','type=bind,source='+shared+',target=/weig-webui,readonly',
     '-e','QBT_LEGAL_NOTICE=confirm','-e','QBT_WEBUI_PORT=8080','-e','QBT_TORRENTING_PORT=6881',image]);
   containers.push(name);
   const ip=sh('docker',['inspect',name,'--format','{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}']);
   assert(/^\d+(?:\.\d+){3}$/.test(ip),'Isolated Docker IP missing');
   qbs.push({name,version,url:'http://'+ip+':8080/'});
 }
 const checks=[];
 await Promise.all(qbs.map(async q=>{
   await ready(q.url);q.password=await getPassword(q.name);await configure(q);await ready(q.url);
   const identityResponse=await fetch(q.url+'api/v2/app/version',{headers:{Cookie:q.sid}});
   assert(identityResponse.status===200,'Real qB runtime version HTTP '+identityResponse.status+' for '+q.version);
   const version=String(await identityResponse.text()).trim().replace(/^v/i,'').split(/[+-]/)[0];
   assert(version===q.version,'Real qB runtime version mismatch: expected '+q.version+', observed '+version);
   const mounts=JSON.parse(sh('docker',['inspect',q.name,'--format','{{json .Mounts}}']));
   assert(mounts.some(m=>m.Source===shared&&m.Destination==='/weig-webui'&&m.RW===false),'qB must mount the SAME read-only host directory');
   assert(sh('docker',['exec',q.name,'cat','/weig-webui/GIT_SHA'])===sha,'Container-mounted SHA drift');
   const response=await fetch(q.url);assert(response.ok,'Real Alternative WebUI hosting failed');
   const html=await response.text();assert(html.includes('name="weig-build-sha" content="'+sha+'"'),'Real qB served wrong build');
   checks.push({qb_version:q.version,sha256:crypto.createHash('sha256').update(html).digest('hex'),readonly_mount:true});
 }));
 assert(checks.length===2&&checks[0].sha256===checks[1].sha256,'Different static HTML served');

 browser=await launchBrowser();const context=await browser.newContext({viewport:{width:1280,height:800},locale:'en-US'});
 const first=await enter(context,qbs[0]);
 assert((await context.cookies(qbs[1].url)).every(c=>c.name!==qbs[0].sessionCookieName),'First instance session cookie leaked to second qB host');
 const second=await enter(context,qbs[1]);
 for(const [i,q] of qbs.entries()){
   const row=checks.find(item=>item.qb_version===q.version);
   assert(!!row,'Missing real qB distribution fact for '+q.version);
   row.private_asset_sha256=await browserPrivateAssetDigests(i===0?first:second,q);
 }
 assert(JSON.stringify(checks[0].private_asset_sha256)===JSON.stringify(checks[1].private_asset_sha256),'Real authenticated browsers served nonidentical private bootstrap/capability bytes');
 const settingsChecks=await Promise.all([verifyInstanceSettings(first,qbs[0]),verifyInstanceSettings(second,qbs[1])]);
 const sidA=(await context.cookies(qbs[0].url)).find(c=>c.name===qbs[0].sessionCookieName)?.value;
 const sidB=(await context.cookies(qbs[1].url)).find(c=>c.name===qbs[1].sessionCookieName)?.value;
 assert(sidA&&sidB&&sidA!==sidB,'SID identities overlap');
 await first.reload({waitUntil:'domcontentloaded'});await awaitRealApp(first,qbs[0],'after-other-instance-login-reload');
 await first.waitForFunction(expected=>document.querySelector('#qb-version')?.textContent?.includes(expected),qbs[0].version,{timeout:20000});
 assert((await first.locator('#qb-version').innerText()).includes(qbs[0].version),'First instance identity failed to stabilize after second login');
 await first.evaluate(url=>window.WeiG.InstanceRegistry.add('Other qB',url),qbs[1].url);
 assert(await second.evaluate(()=>window.WeiG.InstanceRegistry.list().length)===0,'Cross-origin localStorage leaked');
 // Real browser network proof: qB rejects cross-instance top-level GET with
 // a foreign Referer, even if the destination's session Cookie is valid.
 const targetOrigin=new URL(qbs[1].url).origin;
 const targetDocumentTask=first.waitForResponse(response=>{
   try{return new URL(response.url()).origin===targetOrigin&&response.request().isNavigationRequest()&&response.request().resourceType()==='document';}catch{return false;}
 },{timeout:20000});
 await Promise.all([first.waitForURL(qbs[1].url,{timeout:20000}),first.evaluate(url=>window.WeiG.InstanceRegistry.switchTo(url),qbs[1].url)]);
 const targetDocument=await targetDocumentTask;
 assert(targetDocument.status()===200,'Cross-instance qB root navigation HTTP '+targetDocument.status());
 const navigationHeaders=await targetDocument.request().allHeaders();
 assert(!Object.prototype.hasOwnProperty.call(navigationHeaders,'referer'),'Cross-instance navigation leaked foreign Referer to real qB');
 await awaitRealApp(first,qbs[1],'after-full-document-switch');
 await first.waitForFunction(expected=>document.querySelector('#qb-version')?.textContent?.includes(expected),qbs[1].version,{timeout:20000});
 assert((await first.locator('#qb-version').innerText()).includes(qbs[1].version),'Instance navigation lost destination identity');
 // The destination has its own registry, Settings state and qB session. A
 // return trip must preserve both independent sessions without carrying SID.
 assert(await first.evaluate(()=>window.WeiG.InstanceRegistry.list().length)===0,'Destination origin unexpectedly inherited the source registry');
 await first.evaluate(url=>window.WeiG.InstanceRegistry.add('Previous qB',url),qbs[0].url);
 const returnDocumentTask=first.waitForResponse(response=>{
   try{return new URL(response.url()).origin===new URL(qbs[0].url).origin&&response.request().isNavigationRequest()&&response.request().resourceType()==='document';}catch{return false;}
 },{timeout:20000});
 await Promise.all([first.waitForURL(qbs[0].url,{timeout:20000}),first.evaluate(url=>window.WeiG.InstanceRegistry.switchTo(url),qbs[0].url)]);
 const returnDocument=await returnDocumentTask;
 assert(returnDocument.status()===200,'Return to original real qB HTTP '+returnDocument.status());
 const strictPublicLanding=(await returnDocument.text()).includes('id="login-form"');
 assert(strictPublicLanding,'qB 4.6.7 Strict cross-site return must visit public login before the protected same-origin session handoff');
 const returnHeaders=await returnDocument.request().allHeaders();
 assert(!Object.prototype.hasOwnProperty.call(returnHeaders,'referer'),'Return navigation leaked destination qB Referer');
 await awaitRealApp(first,qbs[0],'after-return-to-original-instance');
 await first.waitForFunction(expected=>document.querySelector('#qb-version')?.textContent?.includes(expected),qbs[0].version,{timeout:20000});
 assert((await first.locator('#qb-version').innerText()).includes(qbs[0].version),'Returning to first qB lost the original version identity');
 assert((await context.cookies(qbs[0].url)).find(c=>c.name===qbs[0].sessionCookieName)?.value===sidA,'Original qB session changed during round trip');
 assert((await context.cookies(qbs[1].url)).find(c=>c.name===qbs[1].sessionCookieName)?.value===sidB,'Destination qB session changed during round trip');
 assert(await first.evaluate(()=>window.WeiG.InstanceRegistry.list().length)===1,'Original origin lost its local instance registry');
 assert(await second.evaluate(()=>window.WeiG.InstanceRegistry.list().length)===1,'Destination origin lost its distinct local registry');
 const roundTripSettings=await Promise.all([verifyInstanceSettings(first,qbs[0]),verifyInstanceSettings(second,qbs[1])]);
 assert(roundTripSettings.every(row=>row.settings_get==='PASS'&&row.settings_source_identity==='PASS'),'Post-round-trip Settings identity lost');
 await context.close();
 fs.mkdirSync('artifacts/real-qb-full',{recursive:true});
 fs.writeFileSync('artifacts/real-qb-full/'+sha+'-shared-static.json',JSON.stringify({status:'PASS',weig_sha:sha,qb_versions:versions,scenario:'two-real-qb-one-shared-static-root',sid_isolation:'PASS',cross_origin_registry:'PASS',whole_page_switch:'PASS',return_navigation:'PASS',strict_cookie_handoff:'PASS',sessions_preserved:'PASS',settings_after_return:'PASS',shared_private_assets:'PASS',navigation_http_200:'PASS',navigation_referer_suppressed:'PASS',settings_per_origin:'PASS',private_docker_network:'internal',static_sha256:checks[0].sha256,checks,settingsChecks,roundTripSettings},null,2)+'\n');
 console.log('A72 real shared static and cross-instance session PASS');
}
try{await test();}catch(e){console.error('A72 real shared static failed: '+String(e?.message||e));process.exitCode=1;}
finally{
 if(browser)try{await browser.close();}catch{process.exitCode=1;}
 for(const name of containers.reverse())try{sh('docker',['rm','-f',name]);}catch{process.exitCode=1;}
 try{sh('docker',['network','rm',id]);}catch{}
 try{fs.rmSync(stage,{recursive:true,force:true});}catch{process.exitCode=1;}
}
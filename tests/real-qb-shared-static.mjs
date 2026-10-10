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
 for(let i=0;i<30;i++){const logs=spawnSync('docker',['logs',name],{encoding:'utf8'});assert(logs.status===0,'Cannot inspect disposable qB startup logs');const m=(String(logs.stdout||'')+'\n'+String(logs.stderr||'')).match(/temporary password is provided for this session:\s*(\S+)/i);if(m)return m[1];await sleep(1000);}
 return 'adminadmin';
}
async function configure(q){
 const login=await fetch(q.url+'api/v2/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password:q.password})});
 assert(login.ok,'Real qB login rejected');
 q.sid=(login.headers.get('set-cookie')||'').split(';')[0];
 assert(/^SID=[^;]+/.test(q.sid),'Real qB SID missing');
 const set=await fetch(q.url+'api/v2/app/setPreferences',{method:'POST',headers:{Cookie:q.sid,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({json:JSON.stringify({alternative_webui_enabled:true,alternative_webui_path:'/weig-webui'})})});
 assert(set.ok,'Real qB Alternative WebUI setting failed');await set.text();
}
async function enter(context,q){
 const page=await context.newPage();await page.goto(q.url,{waitUntil:'domcontentloaded',timeout:30000});
 await page.locator('#login-form').waitFor({timeout:20000});
 assert(await page.locator('meta[name="weig-build-sha"]').getAttribute('content')===sha,'Public WebUI SHA mismatch');
 await page.locator('#username').fill('admin');await page.locator('#password').fill(q.password);await page.locator('#login-btn').click();
 await page.locator('#app').waitFor({timeout:20000});
 await page.waitForFunction(()=>document.querySelector('#qb-version')?.textContent?.includes('.'),null,{timeout:20000});
 assert((await page.locator('#qb-version').innerText()).includes(q.version),'Browser qB version mismatch');
 return page;
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
   const version=await fetch(q.url+'api/v2/app/version',{headers:{Cookie:q.sid}}).then(r=>r.text());
   assert(version.trim()===q.version,'qB runtime version mismatch');
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
 assert((await context.cookies(qbs[1].url)).every(c=>c.name!=='SID'),'SID leaked across host');
 const second=await enter(context,qbs[1]);
 const sidA=(await context.cookies(qbs[0].url)).find(c=>c.name==='SID')?.value;
 const sidB=(await context.cookies(qbs[1].url)).find(c=>c.name==='SID')?.value;
 assert(sidA&&sidB&&sidA!==sidB,'SID identities overlap');
 await first.reload({waitUntil:'domcontentloaded'});await first.locator('#app').waitFor({timeout:20000});
 assert((await first.locator('#qb-version').innerText()).includes(qbs[0].version),'First login session changed after second login');
 await first.evaluate(url=>window.WeiG.InstanceRegistry.add('Other qB',url),qbs[1].url);
 assert(await second.evaluate(()=>window.WeiG.InstanceRegistry.list().length)===0,'Cross-origin localStorage leaked');
 await Promise.all([first.waitForURL(qbs[1].url,{timeout:20000}),first.evaluate(url=>window.WeiG.InstanceRegistry.switchTo(url),qbs[1].url)]);
 await first.locator('#app').waitFor({timeout:20000});
 assert((await first.locator('#qb-version').innerText()).includes(qbs[1].version),'Instance navigation lost destination identity');
 await context.close();
 fs.mkdirSync('artifacts/real-qb-full',{recursive:true});
 fs.writeFileSync('artifacts/real-qb-full/'+sha+'-shared-static.json',JSON.stringify({status:'PASS',weig_sha:sha,qb_versions:versions,scenario:'two-real-qb-one-shared-static-root',sid_isolation:'PASS',cross_origin_registry:'PASS',whole_page_switch:'PASS',private_docker_network:'internal',static_sha256:checks[0].sha256,checks},null,2)+'\n');
 console.log('A72 real shared static and cross-instance session PASS');
}
try{await test();}catch(e){console.error('A72 real shared static failed: '+String(e?.message||e));process.exitCode=1;}
finally{
 if(browser)try{await browser.close();}catch{process.exitCode=1;}
 for(const name of containers.reverse())try{sh('docker',['rm','-f',name]);}catch{process.exitCode=1;}
 try{sh('docker',['network','rm',id]);}catch{}
 try{fs.rmSync(stage,{recursive:true,force:true});}catch{process.exitCode=1;}
}
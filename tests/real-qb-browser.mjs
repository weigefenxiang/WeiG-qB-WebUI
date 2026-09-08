#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchBrowser} from './browser-driver.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const norm=v=>String(v||'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
const redact=v=>String(v??'')
  .replace(/https?:\/\/[^\s'"<>]+/gi,'[REDACTED_URL]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g,'[REDACTED_HOST]');
const assert=(ok,msg)=>{if(!ok)throw new Error(redact(msg));};

function frozen(){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
  const bytes=fs.readFileSync(path.join(root,manifest.catalogPath));
  const digest=sha256(bytes);
  assert(digest===manifest.catalogSha256,`Frozen LKG digest mismatch: ${digest}`);
  const catalog=JSON.parse(bytes);
  assert(Array.isArray(catalog)&&catalog.length===manifest.profileCount,'Frozen LKG profile count mismatch.');
  return {manifest,catalog,digest};
}

class Evidence{
  constructor(meta){
    this.data={schemaVersion:1,phase:'G',module:'real-qb-alternative-webui-browser',...meta,scenarios:[],summary:{PASS:0,FAIL:0,SKIP:0}};
  }
  push(result,id,extra={}){this.data.scenarios.push({id,result,...extra});this.data.summary[result]++;}
}

async function main(){
  const target=process.env.WEIG_QB_URL||'';
  const user=process.env.WEIG_QB_USER||'';
  const pass=process.env.WEIG_QB_PASS||'';
  const weigSha=process.env.WEIG_GIT_SHA||process.env.GITHUB_SHA||'';
  const binary=process.env.WEIG_QB_BINARY_IDENTITY||'';
  const altPath=process.env.WEIG_QB_ALT_WEBUI_PATH||'/weig-webui';
  assert(target&&user&&pass,'WEIG_QB_URL, WEIG_QB_USER and WEIG_QB_PASS are required.');
  assert(/^[0-9a-f]{40}$/i.test(weigSha),'WEIG_GIT_SHA/GITHUB_SHA must be an exact 40-char SHA.');
  assert(binary,'WEIG_QB_BINARY_IDENTITY is required.');
  assert(altPath.startsWith('/'),'WEIG_QB_ALT_WEBUI_PATH must be an absolute container path.');

  const f=frozen();
  const base=new URL(target.endsWith('/')?target:`${target}/`);
  let sessionCookie='',cookieName='',qb='unknown',api='unknown',browser=null,ev=null;
  const requestFacts=new Map();

  async function http(method,ep,{form,auth=true}={}){
    const url=new URL(ep.replace(/^\/+/,''),base);
    const headers={Accept:'application/json, text/plain, */*'};
    if(auth&&sessionCookie)headers.Cookie=sessionCookie;
    let body;
    if(form){
      headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';
      body=new URLSearchParams(Object.entries(form).map(([k,v])=>[k,String(v)]));
    }
    return fetch(url,{method,headers,body,redirect:'manual'});
  }

  async function login(){
    const r=await http('POST','/api/v2/auth/login',{form:{username:user,password:pass},auth:false});
    assert([200,204].includes(r.status),`auth/login: HTTP ${r.status}`);
    const cookies=typeof r.headers.getSetCookie==='function'?r.headers.getSetCookie():[r.headers.get('set-cookie')].filter(Boolean);
    for(const raw of cookies){
      const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);
      if(m){cookieName=m[1];sessionCookie=`${m[1]}=${m[2]}`;break;}
    }
    await r.text();
    assert(sessionCookie,'Login returned no session cookie.');
    return r.status;
  }

  function evidenceFile(){
    const dir=path.join(root,'artifacts/real-qb');
    fs.mkdirSync(dir,{recursive:true});
    return path.join(dir,`${weigSha}-${qb}-alt-webui-browser.json`);
  }
  function writeEvidence(){
    if(!ev)return;
    const file=evidenceFile();
    fs.writeFileSync(file,`${JSON.stringify(ev.data,null,2)}\n`);
    console.log(`Real-qB Alternative WebUI browser evidence: ${path.relative(root,file)}`);
    console.log(JSON.stringify(ev.data.summary));
  }

  try{
    const loginStatus=await login();
    const vr=await http('GET','/api/v2/app/version');
    assert(vr.status===200,`app/version: HTTP ${vr.status}`);
    qb=norm(await vr.text());
    const ar=await http('GET','/api/v2/app/webapiVersion');
    assert(ar.status===200,`app/webapiVersion: HTTP ${ar.status}`);
    api=norm(await ar.text());
    const profile=f.catalog.find(x=>norm(x.qbVersion)===qb);
    assert(profile,`qB ${qb} is outside Frozen LKG; fail closed.`);
    assert(norm(profile.webApiVersion)===api,`WebAPI mismatch for qB ${qb}: expected ${norm(profile.webApiVersion)}, actual ${api}.`);

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
      reverse_proxy:process.env.WEIG_QB_REVERSE_PROXY||'none',
      https:base.protocol==='https:',
      base_path:base.pathname,
      target_host:'REDACTED',
      frozen_catalog_sha256:f.digest,
      alternative_webui_path:altPath,
      staged_release_transform:{
        source_tree:'webui/** at exact weig_sha',
        sha_placeholder_replaced:true,
        installer_metadata_generated:true,
        bundled_catalog_source:'webui/private/data/qb-releases.json',
        mount_read_only:true
      }
    });
    ev.push('PASS','auth-and-identity',{response:{login_status:loginStatus,session_cookie_name:cookieName,qbVersion:qb,webApiVersion:api}});

    const set=await http('POST','/api/v2/app/setPreferences',{
      form:{json:JSON.stringify({alternative_webui_enabled:true,alternative_webui_path:altPath})}
    });
    assert([200,204].includes(set.status),`setPreferences Alternative WebUI: HTTP ${set.status}`);
    await set.text();
    const prefs=await http('GET','/api/v2/app/preferences');
    assert(prefs.status===200,`app/preferences after Alternative WebUI enable: HTTP ${prefs.status}`);
    const prefJson=await prefs.json();
    assert(prefJson?.alternative_webui_enabled===true,'qB did not persist alternative_webui_enabled=true.');
    assert(String(prefJson?.alternative_webui_path||'')===altPath,'qB did not persist expected alternative_webui_path.');
    ev.push('PASS','alternative-webui-enabled',{
      source_contract:'qB release source: Preferences::changed -> WebApplication::configure()',
      request:{endpoint:'/api/v2/app/setPreferences',paramNames:['json'],jsonKeys:['alternative_webui_enabled','alternative_webui_path']},
      response:{set_status:set.status,preferences_status:prefs.status,enabled:true,path:altPath}
    });

    const logout=await http('POST','/api/v2/auth/logout');
    assert([200,204].includes(logout.status),`auth/logout before public smoke: HTTP ${logout.status}`);
    await logout.text();
    sessionCookie='';

    const publicRoot=await http('GET','/',{auth:false});
    assert(publicRoot.status===200,`Alternative WebUI public root: HTTP ${publicRoot.status}`);
    const publicHtml=await publicRoot.text();
    assert(publicHtml.includes('id="login-form"'),'Alternative WebUI public root is not WeiG login UI.');
    assert(publicHtml.includes(`name="weigg-build-sha" content="${weigSha}"`),'Public Alternative WebUI build SHA is not exact current SHA.');
    ev.push('PASS','public-root-served-by-real-qb',{
      response:{status:publicRoot.status,login_form:true,build_sha:weigSha},
      qB_static_owner:'real qBittorrent WebApplication'
    });

    browser=await launchBrowser();
    const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'});
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(redact(e?.message||e)));
    page.on('console',msg=>{
      if(msg.type()==='error'){
        const t=redact(msg.text());
        if(!/favicon|Wei\.G\.ico|ERR_FAILED/i.test(t))pageErrors.push(t);
      }
    });
    page.on('response',response=>{
      try{
        const u=new URL(response.url());
        if(u.origin===base.origin&&u.pathname.startsWith('/api/v2/')){
          requestFacts.set(u.pathname,response.status());
        }
      }catch{}
    });
    await page.route('**/*',route=>{
      try{
        const u=new URL(route.request().url());
        if(u.origin!==base.origin)return route.abort();
      }catch{return route.abort();}
      return route.continue();
    });

    await page.goto(base.href,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#login-form');
    const publicSha=await page.locator('meta[name="weigg-build-sha"]').getAttribute('content');
    assert(publicSha===weigSha,`Chrome public build SHA mismatch: ${publicSha}`);

    await page.locator('#username').fill(user);
    await page.locator('#password').fill(pass);
    await page.locator('#login-btn').click();
    await page.waitForSelector('#app',{timeout:10000});
    await page.waitForSelector('#torrent-list',{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#qb-version')?.textContent?.trim()&&!['—','Detecting…'].includes(document.querySelector('#qb-version').textContent.trim()),null,{timeout:10000});
    await page.waitForFunction(()=>document.querySelector('#api-version')?.textContent?.trim()&&!['—','Detecting…'].includes(document.querySelector('#api-version').textContent.trim()),null,{timeout:10000});

    const privateSha=await page.locator('meta[name="weigg-build-sha"]').getAttribute('content');
    const uiQb=norm(await page.locator('#qb-version').textContent());
    const uiApi=norm(await page.locator('#api-version').textContent());
    assert(privateSha===weigSha,`Chrome private build SHA mismatch: ${privateSha}`);
    assert(uiQb===qb,`Chrome qB identity mismatch: expected ${qb}, actual ${uiQb}`);
    assert(uiApi===api,`Chrome WebAPI identity mismatch: expected ${api}, actual ${uiApi}`);

    await page.locator('#app-nav [data-route="settings"]').click();
    await page.waitForFunction(()=>location.hash.includes('settings'));
    await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]',{timeout:10000});
    const altPathControl=page.locator('[data-setting-key="alternative_webui_path"]');
    assert(await altPathControl.count()===1,'Canonical Settings lost alternative_webui_path control on real qB.');
    const altValue=await altPathControl.locator('input,textarea').first().inputValue().catch(()=>null);
    assert(altValue===altPath,`Canonical Settings Alternative WebUI path mismatch: ${altValue}`);

    for(const required of ['/api/v2/app/version','/api/v2/app/webapiVersion','/api/v2/app/preferences']){
      assert((requestFacts.get(required)||0)>=200&&(requestFacts.get(required)||0)<300,`Chrome did not complete required real qB API request ${required}.`);
    }
    assert(pageErrors.length===0,`Chrome page errors: ${pageErrors.join(' | ')}`);

    ev.push('PASS','authenticated-chrome-shell',{
      browser:{channel:'Google Chrome Stable',headless:true,external_requests_blocked:true},
      response:{build_sha:privateSha,qb_version:uiQb,webapi_version:uiApi,app_shell:true,torrent_list:true,canonical_settings:true,alternative_webui_path:altValue},
      required_real_api_statuses:Object.fromEntries([...requestFacts.entries()].filter(([k])=>['/api/v2/app/version','/api/v2/app/webapiVersion','/api/v2/app/preferences'].includes(k))),
      page_errors:[]
    });
    await context.close();
    writeEvidence();
  }catch(e){
    if(ev){
      ev.push('FAIL','real-qb-alternative-webui-browser',{reason:redact(e?.message||e)});
      writeEvidence();
    }
    throw e;
  }finally{
    if(browser)await browser.close().catch(()=>{});
  }
}

main().catch(e=>{
  console.error(redact(e?.stack||e));
  process.exitCode=1;
});

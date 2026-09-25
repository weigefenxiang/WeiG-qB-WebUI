#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {launchBrowser} from './browser-driver.mjs';

const target=String(process.env.WEIG_QB_URL||'').trim();
const username=String(process.env.WEIG_QB_USER||'').trim();
const password=String(process.env.WEIG_QB_PASS||'');
const expectedVersion=String(process.env.WEIG_QB_VERSION||'').trim().replace(/^v/i,'');
const weigSha=String(process.env.WEIG_GIT_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase();
const evidenceDir=String(process.env.WEIG_REAL_QB_EVIDENCE_DIR||'artifacts/session-handshake');
const altPath=String(process.env.WEIG_QB_ALT_WEBUI_PATH||'/weig-webui');
const containerName=String(process.env.WEIG_QB_CONTAINER_NAME||'').trim();
const deploymentMode=String(process.env.WEIG_QB_DEPLOYMENT_MODE||'unknown');
const reverseProxy=String(process.env.WEIG_QB_REVERSE_PROXY||'unknown');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const accepted=status=>status>=200&&status<300;
const base=new URL(target.endsWith('/')?target:`${target}/`);
const endpointPath=url=>{try{return new URL(url).pathname;}catch{return '';}};
const secretValues=[password].filter(Boolean);

function redact(value){
  let text=String(value??'');
  for(const secret of secretValues)text=text.split(secret).join('[REDACTED_SECRET]');
  return text
    .replace(/\b(?:SID|QBT_SID_[A-Za-z0-9_-]+)=([^;\s]+)/gi,'$1=[REDACTED_COOKIE]')
    .replace(/https?:\/\/[^\s'"<>]+/gi,'[REDACTED_URL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g,'[REDACTED_HOST]');
}

function cookieNames(header){
  return String(header||'').split(';').map(part=>part.trim().split('=',1)[0]).filter(Boolean);
}

function safeRequestHeaders(headers={}){
  return {
    host: headers.host||null,
    origin: headers.origin||null,
    referer: headers.referer||null,
    sec_fetch_site: headers['sec-fetch-site']||null,
    sec_fetch_mode: headers['sec-fetch-mode']||null,
    cookie_names: cookieNames(headers.cookie)
  };
}

function cookieMetadata(cookies){
  return (cookies||[]).map(cookie=>({
    name:cookie.name,
    domain:cookie.domain,
    path:cookie.path,
    httpOnly:cookie.httpOnly,
    secure:cookie.secure,
    sameSite:cookie.sameSite||null,
    session:Number(cookie.expires||-1)<0
  }));
}

function responseCookieNames(response){
  const values=typeof response.headers.getSetCookie==='function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map(raw=>String(raw).match(/^\s*([^=;\s]+)=/)?.[1]).filter(Boolean);
}

async function nodeRequest(method,endpoint,{cookie='',form=null}={}){
  const headers={Accept:'application/json, text/plain, */*'};
  if(cookie)headers.Cookie=cookie;
  let body;
  if(form){
    headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';
    body=new URLSearchParams(Object.entries(form).map(([key,value])=>[key,String(value)]));
  }
  return fetch(new URL(endpoint.replace(/^\/+/,''),base),{method,headers,body,redirect:'manual'});
}

async function setupAlternativeWebUI(){
  const login=await nodeRequest('POST','/api/v2/auth/login',{form:{username,password}});
  const loginBody=(await login.text()).trim();
  assert(accepted(login.status),`setup auth/login returned HTTP ${login.status}`);
  assert(loginBody==='Ok.'||login.status===204,`setup auth/login returned unexpected body ${JSON.stringify(loginBody)}`);
  const values=typeof login.headers.getSetCookie==='function'
    ? login.headers.getSetCookie()
    : [login.headers.get('set-cookie')].filter(Boolean);
  let cookie='';
  for(const raw of values){
    const match=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);
    if(match){cookie=`${match[1]}=${match[2]}`;break;}
  }
  assert(cookie,'setup auth/login produced no session cookie');
  const version=await nodeRequest('GET','/api/v2/app/version',{cookie});
  assert(version.status===200,`setup app/version returned HTTP ${version.status}`);
  const observed=(await version.text()).trim().replace(/^v/i,'');
  assert(observed===expectedVersion,`expected qB ${expectedVersion}, observed ${observed}`);
  const set=await nodeRequest('POST','/api/v2/app/setPreferences',{
    cookie,
    form:{json:JSON.stringify({alternative_webui_enabled:true,alternative_webui_path:altPath})}
  });
  const setStatus=set.status; await set.text();
  assert(accepted(setStatus),`setup app/setPreferences returned HTTP ${setStatus}`);
  const prefs=await nodeRequest('GET','/api/v2/app/preferences',{cookie});
  assert(prefs.status===200,`setup app/preferences returned HTTP ${prefs.status}`);
  const prefJson=await prefs.json();
  assert(prefJson?.alternative_webui_enabled===true,'qB did not enable Alternative WebUI');
  assert(String(prefJson?.alternative_webui_path||'')===altPath,`Alternative WebUI path mismatch: ${String(prefJson?.alternative_webui_path||'')}`);
  const logout=await nodeRequest('POST','/api/v2/auth/logout',{cookie});
  const logoutStatus=logout.status; await logout.text();
  assert(accepted(logoutStatus),`setup auth/logout returned HTTP ${logoutStatus}`);
  return {login_status:login.status,login_body:loginBody||null,set_preferences_status:setStatus,logout_status:logoutStatus,set_cookie_names:responseCookieNames(login)};
}

function attachNetworkCapture(page,store){
  page.on('request',async request=>{
    const pathname=endpointPath(request.url());
    if(!pathname.startsWith('/api/v2/'))return;
    let headers={};try{headers=await request.allHeaders();}catch{}
    store.push({phase:'request',method:request.method(),path:pathname,headers:safeRequestHeaders(headers)});
  });
  page.on('response',response=>{
    const pathname=endpointPath(response.url());
    if(!pathname.startsWith('/api/v2/'))return;
    store.push({phase:'response',method:response.request().method(),path:pathname,status:response.status()});
  });
}

async function directHandshake(browser){
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'});
  const page=await context.newPage();
  const network=[]; attachNetworkCapture(page,network);
  await page.route('**/*',route=>{
    try{const url=new URL(route.request().url());if(url.origin!==base.origin)return route.abort();}
    catch{return route.abort();}
    return route.continue();
  });
  await page.goto(base.href,{waitUntil:'domcontentloaded'});
  assert(await page.locator('#login-form').count()===1,'Alternative WebUI public root did not show WeiG login form');
  const first=await page.evaluate(async ({username,password})=>{
    const body=new URLSearchParams({username,password});
    const login=await fetch('api/v2/auth/login',{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,
      credentials:'same-origin',cache:'no-store'
    });
    const loginText=String(await login.text()).trim();
    const probe=await fetch('api/v2/app/preferences',{credentials:'same-origin',cache:'no-store'});
    return {loginStatus:login.status,loginText,probeStatus:probe.status};
  },{username,password});
  const cookiesBeforeReload=cookieMetadata(await context.cookies(base.href));
  await page.reload({waitUntil:'domcontentloaded'});
  const surfaceAfterReload={
    app:(await page.locator('#app').count())>0,
    login:(await page.locator('#login-form').count())>0,
    fatalVisible:await page.locator('#fatal:not(.is-hidden)').count().catch(()=>0)>0
  };
  const reloadProbe=await page.evaluate(async ()=>{
    const response=await fetch('api/v2/app/preferences',{credentials:'same-origin',cache:'no-store'});
    return {status:response.status};
  }).catch(error=>({status:0,error:String(error?.message||error)}));
  const cookiesAfterReload=cookieMetadata(await context.cookies(base.href));
  const fatalMessage=surfaceAfterReload.fatalVisible
    ? redact(await page.locator('#fatal-message').textContent().catch(()=>''))
    : null;
  await context.close();
  return {
    login_status:first.loginStatus,
    login_body:first.loginText,
    immediate_protected_probe_status:first.probeStatus,
    cookies_before_reload:cookiesBeforeReload,
    reload_surface:surfaceAfterReload,
    reload_protected_probe_status:reloadProbe.status,
    reload_probe_error:reloadProbe.error?redact(reloadProbe.error):null,
    cookies_after_reload:cookiesAfterReload,
    fatal_message:fatalMessage,
    network
  };
}

async function productFormFlow(browser){
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'});
  const page=await context.newPage();
  const network=[]; attachNetworkCapture(page,network);
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(redact(error?.message||error)));
  page.on('console',msg=>{if(msg.type()==='error')pageErrors.push(redact(msg.text()));});
  await page.route('**/*',route=>{
    try{const url=new URL(route.request().url());if(url.origin!==base.origin)return route.abort();}
    catch{return route.abort();}
    return route.continue();
  });
  const loginEntry=new URL('login.html',base);
  await page.goto(loginEntry.href,{waitUntil:'domcontentloaded'});
  assert(await page.locator('#login-form').count()===1,'Form-flow explicit public login path did not show WeiG login form');
  await page.waitForFunction(expected=>String(document.querySelector('#login-qb-version')?.textContent||'').trim().replace(/^v/i,'')===expected,expectedVersion);
  const publicIdentity=await page.evaluate(()=>({qb:String(document.querySelector('#login-qb-version')?.textContent||'').trim().replace(/^v/i,''),api:String(document.querySelector('#login-api-version')?.textContent||'').trim(),weig:String(document.querySelector('#login-weig-version')?.textContent||'').trim()}));
  assert(publicIdentity.qb===expectedVersion,`public login must display the real legacy qB version before authentication: ${JSON.stringify(publicIdentity)}`);
  assert(publicIdentity.api==='—',`legacy /version/api is a compatibility API integer and must never be displayed as WebAPI: ${JSON.stringify(publicIdentity)}`);
  assert(publicIdentity.weig&&publicIdentity.weig!=='—'&&!publicIdentity.weig.includes('__WEIG_'),`materialized public login must display the Wei.G product version: ${JSON.stringify(publicIdentity)}`);
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  const loginResponsePromise=page.waitForResponse(response=>endpointPath(response.url())==='/api/v2/auth/login'&&response.request().method()==='POST',{timeout:10000});
  const navigationPromise=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:15000}).catch(()=>null);
  await page.locator('#login-btn').click();
  const loginResponse=await loginResponsePromise;
  let loginBody='';try{loginBody=String(await loginResponse.text()).trim();}catch{}
  await navigationPromise;
  await page.waitForSelector('#app',{state:'attached',timeout:10000}).catch(()=>{});
  let sessionContractState={present:false,handoffPending:null,sessionLocked:null,qbVersionText:'',error:'post-reload session state not observed'};
  const sessionStateDeadline=Date.now()+15000;
  while(Date.now()<sessionStateDeadline){
    try{
      const observed=await page.evaluate(expected=>{
        const W=window.WeiG||{},contract=W.SessionContract;
        return{
          present:!!contract,
          handoffPending:contract&&typeof contract.pendingHandoff==='function'?contract.pendingHandoff():null,
          sessionLocked:!!document.documentElement.dataset.sessionLocked,
          qbVersionText:String(document.querySelector('#qb-version')?.textContent||'').trim(),
          expectedVersion:expected
        };
      },expectedVersion);
      sessionContractState=observed;
      if(observed.present===true&&observed.handoffPending===false&&observed.sessionLocked===false&&String(observed.qbVersionText||'').includes(expectedVersion))break;
    }catch(error){
      sessionContractState={present:false,handoffPending:null,sessionLocked:null,qbVersionText:'',error:String(error?.message||error)};
    }
    await page.waitForTimeout(200).catch(()=>{});
  }
  const surface={
    app:(await page.locator('#app').count())>0,
    login:(await page.locator('#login-form').count())>0,
    fatalVisible:await page.locator('#fatal:not(.is-hidden)').count().catch(()=>0)>0
  };
  const probe=await page.evaluate(async ()=>{
    const response=await fetch('api/v2/app/preferences',{credentials:'same-origin',cache:'no-store'});
    return {status:response.status};
  }).catch(error=>({status:0,error:String(error?.message||error)}));
  const cookies=cookieMetadata(await context.cookies(base.href));
  const fatalMessage=surface.fatalVisible
    ? redact(await page.locator('#fatal-message').textContent().catch(()=>''))
    : null;
  await context.close();
  return {
    login_status:loginResponse.status(),login_body:loginBody,
    login_body_capture_status:loginResponse.status(),
    login_body_source:loginBody?'playwright-response-before-navigation':'unavailable',
    login_entry_path:new URL('login.html',base).pathname,
    landing_path:new URL(page.url()).pathname,
    session_contract_state:sessionContractState,
    landing_surface:surface,protected_probe_status:probe.status,
    probe_error:probe.error?redact(probe.error):null,
    cookies,fatal_message:fatalMessage,
    page_errors:[...new Set(pageErrors)].slice(0,20),network
  };
}

function relevantQbLogs(){
  if(!containerName)return [];
  const result=spawnSync('docker',['logs',containerName],{encoding:'utf8'});
  const raw=String(result.stdout||'')+'\n'+String(result.stderr||'');
  return raw.split(/\r?\n/)
    .filter(line=>/webui|login|auth|origin|referer|host|ban|forbidden|unauthor|403/i.test(line))
    .map(redact).filter(Boolean).slice(-80);
}

async function main(){
  assert(target&&username&&password,'WEIG_QB_URL, WEIG_QB_USER and WEIG_QB_PASS are required');
  assert(/^4\.1\.9(?:\.1)?$/.test(expectedVersion),`Session handshake harness only admits qB 4.1.9/4.1.9.1, got ${expectedVersion||'unknown'}`);
  assert(/^[0-9a-f]{40}$/.test(weigSha),'Exact WeiG Git SHA is required');
  assert(altPath.startsWith('/'),'WEIG_QB_ALT_WEBUI_PATH must be absolute');
  fs.mkdirSync(evidenceDir,{recursive:true});
  const evidence={
    schemaVersion:1,phase:'session-handshake',module:'real-linux-session-handshake',capture_status:'IN_PROGRESS',session_contract_status:'UNKNOWN',
    weig_sha:weigSha,qb_version:expectedVersion,test_time:new Date().toISOString(),
    deployment:{mode:deploymentMode,reverse_proxy:reverseProxy,base_path:base.pathname,origin:base.origin.replace(base.hostname,'[REDACTED_HOST]')},
    setup:null,direct_handshake:null,product_form_flow:null,qb_log_excerpt:[],error:null
  };
  let browser;
  try{
    evidence.setup=await setupAlternativeWebUI();
    browser=await launchBrowser();
    evidence.direct_handshake=await directHandshake(browser);
    evidence.product_form_flow=await productFormFlow(browser);
    evidence.qb_log_excerpt=relevantQbLogs();
    const direct=evidence.direct_handshake,form=evidence.product_form_flow;
    const directPass=accepted(direct.login_status)&&direct.login_body==='Ok.'&&accepted(direct.immediate_protected_probe_status)&&accepted(direct.reload_protected_probe_status);
    const sessionState=form.session_contract_state||{};
    const formPass=accepted(form.login_status)&&form.login_body==='Ok.'&&accepted(form.protected_probe_status)&&form.landing_surface.app===true&&form.landing_path===new URL('index.html',base).pathname&&sessionState.present===true&&sessionState.handoffPending===false&&sessionState.sessionLocked===false&&String(sessionState.qbVersionText||'').includes(expectedVersion);
    evidence.capture_status='CAPTURED';
    evidence.session_contract_status=directPass&&formPass?'PASS':'FAIL';
  }catch(error){
    evidence.capture_status='ERROR';evidence.session_contract_status='UNKNOWN';evidence.error=redact(error?.stack||error);
  }finally{
    if(browser)await browser.close().catch(()=>{});
    if(!evidence.qb_log_excerpt.length)evidence.qb_log_excerpt=relevantQbLogs();
    const out=path.join(evidenceDir,`${weigSha}-${expectedVersion}-session-handshake.json`);
    fs.writeFileSync(out,`${JSON.stringify(evidence,null,2)}\n`);
    console.log(`Session handshake evidence: ${out}`);
    console.log(JSON.stringify({
      capture_status:evidence.capture_status,
      session_contract_status:evidence.session_contract_status,
      qb_version:expectedVersion,
      direct_login:evidence.direct_handshake?.login_status??null,
      immediate_probe:evidence.direct_handshake?.immediate_protected_probe_status??null,
      reload_probe:evidence.direct_handshake?.reload_protected_probe_status??null,
      form_login:evidence.product_form_flow?.login_status??null,
      form_probe:evidence.product_form_flow?.protected_probe_status??null,
      form_app:evidence.product_form_flow?.landing_surface?.app??null
    }));
  }
  if(evidence.capture_status!=='CAPTURED')process.exitCode=2;
  else if(evidence.session_contract_status!=='PASS')process.exitCode=1;
}

main().catch(error=>{console.error(redact(error?.stack||error));process.exitCode=2;});

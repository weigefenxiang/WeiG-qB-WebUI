#!/usr/bin/env node
import {launchBrowser} from './browser-driver.mjs';

const target=String(process.env.WEIG_QB_URL||'').trim();
const user=String(process.env.WEIG_QB_USER||'').trim();
const pass=String(process.env.WEIG_QB_PASS||'');
const marker=String(process.env.WEIG_LIFECYCLE_MARKER||'').trim();
const expectedSha=String(process.env.WEIG_LIFECYCLE_SHA||'').trim();
const expectedQb=String(process.env.WEIG_QB_EXPECTED_VERSION||'5.2.3').trim();
const altPath=String(process.env.WEIG_QB_ALT_WEBUI_PATH||'').trim();
const norm=v=>String(v||'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const redact=v=>String(v??'')
  .replace(/https?:\/\/[^\s'"<>]+/gi,'[REDACTED_URL]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g,'[REDACTED_HOST]');
const assert=(ok,msg)=>{if(!ok)throw new Error(redact(msg));};

assert(target&&user&&pass,'WEIG_QB_URL, WEIG_QB_USER and WEIG_QB_PASS are required.');
assert(marker,'WEIG_LIFECYCLE_MARKER is required.');
assert(/^[0-9a-f]{40}$/i.test(expectedSha),'WEIG_LIFECYCLE_SHA must be an exact 40-char SHA.');
assert(altPath.startsWith('/'),'WEIG_QB_ALT_WEBUI_PATH must be an absolute qB path.');

const base=new URL(target.endsWith('/')?target:`${target}/`);
let browser=null;
try{
  browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'});
  const page=await context.newPage();
  const pageErrors=[];
  const requestFacts=new Map();
  page.on('pageerror',e=>pageErrors.push(redact(e?.message||e)));
  page.on('console',msg=>{
    if(msg.type()==='error'){
      const text=redact(msg.text());
      if(!/favicon|Wei\.G\.ico|ERR_FAILED/i.test(text))pageErrors.push(text);
    }
  });
  page.on('response',response=>{
    try{
      const url=new URL(response.url());
      if(url.origin===base.origin&&url.pathname.startsWith('/api/v2/'))requestFacts.set(url.pathname,response.status());
    }catch{}
  });
  await page.route('**/*',route=>{
    try{
      const url=new URL(route.request().url());
      if(url.origin!==base.origin)return route.abort();
    }catch{return route.abort();}
    return route.continue();
  });

  await page.goto(base.href,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#login-form',{timeout:10000});
  const publicSha=await page.locator('meta[name="weigg-build-sha"]').getAttribute('content');
  assert(publicSha===expectedSha,`Chrome public build SHA mismatch: ${publicSha}`);

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
  assert(privateSha===expectedSha,`Chrome private build SHA mismatch: ${privateSha}`);
  assert(uiQb===norm(expectedQb),`Chrome qB identity mismatch: expected ${expectedQb}, actual ${uiQb}`);
  assert(uiApi,'Chrome WebAPI identity is empty.');

  await page.locator('#app-nav [data-route="settings"]').click();
  await page.waitForFunction(()=>location.hash.includes('settings'));
  await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]',{timeout:10000});
  const webUiTab=page.locator('#settings-tabs [data-settings-tab="webui"]');
  assert(await webUiTab.count()===1,'Canonical Settings lost the Web UI tab.');
  await webUiTab.click();
  await page.waitForSelector('#settings-tabs [data-settings-tab="webui"].is-active',{timeout:10000});
  const altPathControl=page.locator('[data-setting-key="alternative_webui_path"]');
  await altPathControl.waitFor({state:'attached',timeout:10000});
  const altValue=await altPathControl.locator('input,textarea').first().inputValue().catch(()=>null);
  assert(altValue===altPath,`Canonical Settings Alternative WebUI path mismatch: ${altValue}`);

  for(const required of ['/api/v2/app/version','/api/v2/app/webapiVersion','/api/v2/app/preferences']){
    const status=requestFacts.get(required)||0;
    assert(status>=200&&status<300,`Chrome did not complete required real qB API request ${required}.`);
  }
  assert(pageErrors.length===0,`Chrome page errors: ${pageErrors.join(' | ')}`);

  console.log(JSON.stringify({
    lifecycleBrowserSmoke:'PASS',
    marker,
    buildSha:expectedSha,
    qbVersion:uiQb,
    webApiVersion:uiApi,
    canonicalSettings:true,
    alternativeWebuiPath:altValue,
    externalRequestsBlocked:true
  }));
  await context.close();
}finally{
  if(browser)await browser.close().catch(()=>{});
}

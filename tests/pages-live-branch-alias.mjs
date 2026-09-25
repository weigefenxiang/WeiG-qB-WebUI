import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';
import {recoverPageSession} from './pages-live-session.mjs';

const rawBase=(process.env.WEIG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const DOC_LOAD_KEY='__weigg_locale_doc_loads';
const sessionTimeoutMs=Math.max(5000,Number(process.env.WEIG_PAGES_SESSION_TIMEOUT_MS||20000)||20000);

async function fetchJson(relative){
  const url=new URL(String(relative).replace(/^\/+/,''),base);
  url.searchParams.set('__live_sha',expectedSha);
  const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}
async function waitForDeployedSite(){
  let last='not fetched';
  for(let attempt=1;attempt<=40;attempt++){
    try{const site=await fetchJson('metadata/site.json');last=site?.simulatorSha||'missing simulatorSha';if(last===expectedSha)return site;}catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages did not expose simulator SHA ${expectedSha}; last observation: ${last}`);
}
function observeBrowserErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  page.on('console',message=>{if(message.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(message.text())&&!/Failed to load resource:\s*the server responded with a status of 404/i.test(message.text()))errors.push(message.text());});
  return errors;
}
async function readLandedBuild(url){
  const build=new URL('virtual-qb-build.json',url);
  build.searchParams.set('__live_sha',expectedSha);
  const response=await fetch(build,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  assert.equal(response.status,200,`${build} must expose virtual-qb-build.json`);
  return response.json();
}
async function openSettings(page){
  await page.evaluate(()=>{
    if(!window.WeiG?.Router?.go)throw new Error('WeiG Router is unavailable');
    if(!window.WeiG?.SettingsRenderer?.open)throw new Error('WeiG SettingsRenderer is unavailable');
    window.WeiG.Router.go('settings');
  });
  await page.waitForFunction(()=>window.WeiG?.Router?.route?.().name==='settings',null,{timeout:30000});
  await page.evaluate(async()=>{await window.WeiG.SettingsRenderer.open('weigg');});
  await page.waitForSelector('#settings-view.is-active [data-setting-key="weig_language"] .ui-select__trigger',{state:'visible',timeout:30000});
}
async function setVerifiedLocale(page,target){
  const current=await page.evaluate(()=>window.WeiG?.I18n?.getQbLocale?.()||'');
  if(current===target)return false;
  await openSettings(page);
  const before=await page.evaluate(()=>{
    const row=document.querySelector('[data-setting-key="weig_language"]'),control=row?.querySelector('.ui-select'),trigger=row?.querySelector('.ui-select__trigger'),draft=window.WeiG?.SettingsState?.draft||{},prefs=window.WeiG?.SettingsState?.prefs||{},value=Object.prototype.hasOwnProperty.call(draft,'locale')?draft.locale:prefs.locale;
    return{value:control?.getValue?.()||'',disabled:!!trigger?.disabled,writable:window.WeiG?.SettingsSchema?.isWritable?.('locale',value,prefs,{...prefs,...draft})===true};
  });
  assert.equal(before.disabled,false,`${target}: Language UI control must be enabled`);
  assert.equal(before.writable,true,`${target}: Locale must be writable through SettingsSchema before user interaction`);
  const trigger=page.locator('[data-setting-key="weig_language"] .ui-select__trigger');
  await trigger.click();
  const option=page.locator(`.ui-select__menu:not([hidden]) .ui-select__option[data-value="${target}"]`);
  await option.waitFor({state:'visible',timeout:30000});
  await option.click();
  const drafted=await page.evaluate(()=>{const row=document.querySelector('[data-setting-key="weig_language"]'),control=row?.querySelector('.ui-select');return{value:control?.getValue?.()||'',draft:window.WeiG?.SettingsState?.draft?.locale||''};});
  assert.equal(drafted.value,target,`${target}: user-selected Language control value must update before save`);
  assert.equal(drafted.draft,target,`${target}: user-selected Language control must update the qB locale draft`);
  const documentLoads=await page.evaluate(key=>Number(sessionStorage.getItem(key)||0),DOC_LOAD_KEY);
  const writePromise=page.waitForResponse(response=>{const request=response.request();return request.method()==='POST'&&new URL(response.url()).pathname.endsWith('/api/v2/app/setPreferences');},{timeout:30000});
  const verifyReadPromise=page.waitForResponse(response=>{const request=response.request();return request.method()==='GET'&&new URL(response.url()).pathname.endsWith('/api/v2/app/preferences');},{timeout:30000});
  await page.locator('#save-settings-btn').click();
  const writeResponse=await writePromise;
  assert.ok(writeResponse.ok(),`${target}: app/setPreferences must return success, got HTTP ${writeResponse.status()}`);
  const postData=new URLSearchParams(writeResponse.request().postData()||''),posted=JSON.parse(postData.get('json')||'{}');
  assert.equal(posted.locale,target,`${target}: app/setPreferences POST must contain the selected locale`);
  const verifyReadResponse=await verifyReadPromise;
  assert.ok(verifyReadResponse.ok(),`${target}: verification GET app/preferences must succeed, got HTTP ${verifyReadResponse.status()}`);
  const verifiedPrefs=await verifyReadResponse.json();
  assert.equal(verifiedPrefs.locale,target,`${target}: verification GET app/preferences must return the locale written by the real Save transaction`);
  try{await page.waitForFunction(({key,before})=>Number(sessionStorage.getItem(key)||0)>before,{key:DOC_LOAD_KEY,before:documentLoads},{timeout:30000});}
  catch(error){const observed=await page.evaluate(async key=>{const response=await fetch('api/v2/app/preferences',{cache:'no-store'}),prefs=response.ok?await response.json():{};return{status:response.status,locale:prefs.locale||'',qbLocale:window.WeiG?.I18n?.getQbLocale?.()||'',lang:document.documentElement.lang,documentLoads:Number(sessionStorage.getItem(key)||0)};},DOC_LOAD_KEY).catch(()=>null);throw new Error(`${target}: verified qB locale was saved, but automatic locale reload did not replace the document; observed=${JSON.stringify(observed)}; ${error?.message||error}`);}
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(locale=>window.WeiG?.I18n?.getQbLocale?.()===locale,target,{timeout:30000});
  const persisted=await page.evaluate(async()=>{const response=await fetch('api/v2/app/preferences',{cache:'no-store'}),prefs=await response.json();return{status:response.status,locale:prefs.locale,qbLocale:window.WeiG?.I18n?.getQbLocale?.(),lang:document.documentElement.lang};});
  assert.equal(persisted.status,200,`${target}: preferences reread must succeed after automatic locale reload`);
  assert.equal(persisted.locale,target,`${target}: qB preferences.locale must persist after automatic locale reload`);
  assert.equal(persisted.qbLocale,target,`${target}: runtime qB locale must match the persisted locale after reload`);
  await openSettings(page);
  const reopened=await page.evaluate(()=>{const row=document.querySelector('[data-setting-key="weig_language"]'),control=row?.querySelector('.ui-select'),trigger=row?.querySelector('.ui-select__trigger');return{value:control?.getValue?.()||'',disabled:!!trigger?.disabled};});
  assert.equal(reopened.disabled,false,`${target}: Language UI control must remain enabled after reload`);
  assert.equal(reopened.value,target,`${target}: reopening Settings must show the persisted qB locale selection`);
  console.log(`Locale UI transition ${current||'(unset)'} -> ${target} persisted through app/setPreferences, verified app/preferences reread and automatic document reload.`);
  return true;
}
async function verifyDevLocale(browserPage){
  await openSettings(browserPage);
  const options=await browserPage.evaluate(()=>window.WeiG?.I18n?.localeOptions?.()||[]);
  const chinese=options.filter(item=>['zh_CN','zh_HK','zh_TW'].includes(String(item.value))).sort((a,b)=>String(a.value).localeCompare(String(b.value)));
  assert.deepEqual(chinese.map(item=>item.value),['zh_CN','zh_HK','zh_TW'],'modern qB locale evidence must expose the exact three Chinese locale codes');
  assert.equal(new Set(chinese.map(item=>item.label)).size,3,'zh_CN / zh_HK / zh_TW must have distinct visible labels');
  for(const item of chinese)assert.ok(String(item.label).includes(item.value),`${item.value} label must expose its exact qB locale code`);
  const initial=await browserPage.evaluate(async()=>{const response=await fetch('api/v2/app/preferences',{cache:'no-store'}),prefs=await response.json();return{status:response.status,locale:prefs.locale,qbLocale:window.WeiG?.I18n?.getQbLocale?.(),lang:document.documentElement.lang,browser:[...(navigator.languages||[])]};});
  assert.equal(initial.status,200,'dev alias initial preferences must be readable');
  assert.equal(initial.locale,'en','en-US browser bootstrap must preserve the Virtual qB English locale before manual selection');
  assert.equal(initial.qbLocale,'en','runtime qB locale must initially remain English in the en-US manual-selection gate');
  await setVerifiedLocale(browserPage,'zh_CN');
  await browserPage.waitForFunction(()=>window.WeiG?.I18n?.getQbLocale?.()==='zh_CN'&&document.documentElement.lang==='zh-CN',null,{timeout:30000});
  const verified=await browserPage.evaluate(async()=>{const response=await fetch('api/v2/app/preferences',{cache:'no-store'}),prefs=await response.json();return{status:response.status,locale:prefs.locale,qbLocale:window.WeiG?.I18n?.getQbLocale?.(),lang:document.documentElement.lang};});
  assert.deepEqual(verified,{status:200,locale:'zh_CN',qbLocale:'zh_CN',lang:'zh-CN'},'English-to-Simplified-Chinese manual locale transition must persist through qB preferences, automatic reload, runtime projection, and a reopened Settings control');
}
async function verifyBranchEntry(browser,{branch,entryPath,branchSha,label}){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:branch==='dev'?'en-US':'zh-CN'});
  try{
    const page=await context.newPage();
    await page.addInitScript(()=>{const key='__weigg_locale_doc_loads',next=(Number(sessionStorage.getItem(key))||0)+1;sessionStorage.setItem(key,String(next));});
    const errors=observeBrowserErrors(page);
    const params=new URLSearchParams({sim:`pages-${branch}-root-${Date.now()}`,qb:'5.2.3',count:'80',scenario:'mixed',seed:`${branch}-root-alias`});
    const entry=new URL(entryPath,base);entry.search=params.toString();entry.hash='#branch-root';
    const recovered=await recoverPageSession(page,{
      label:`${label} branch alias`,
      qbVersion:'5.2.3',
      timeoutMs:sessionTimeoutMs,
      navigate:async attempt=>{
        const attemptEntry=new URL(entry);attemptEntry.searchParams.set('__weig_session_attempt',String(attempt));
        await page.goto(attemptEntry.toString(),{waitUntil:'domcontentloaded',timeout:sessionTimeoutMs});
        await page.waitForURL(url=>url.pathname.endsWith('/lab/')&&url.searchParams.get('branch')===branch&&url.hash==='#branch-root',{timeout:sessionTimeoutMs});
        await page.waitForSelector('#launch-form',{state:'visible',timeout:sessionTimeoutMs});
        await page.waitForFunction(()=>document.querySelectorAll('#qb-version option').length>=65,null,{timeout:sessionTimeoutMs});
        assert.equal(await page.locator('#branch').inputValue(),branch,`${label} launcher must default to ${branch}`);
        const launcher=new URL(page.url());
        for(const [key,value] of params)assert.equal(launcher.searchParams.get(key),value,`${label} launcher must preserve ${key}`);
        assert.equal(launcher.hash,'#branch-root',`${label} launcher must preserve hash`);
        await page.locator('#launch-form button[type="submit"]').click();
        await page.waitForURL(url=>url.pathname.endsWith(`/${branch}/app/`)&&url.hash==='#branch-root',{timeout:sessionTimeoutMs});
        const landed=new URL(page.url());
        for(const [key,value] of params)assert.equal(landed.searchParams.get(key),value,`${label} launch must preserve ${key}`);
        assert.equal(landed.hash,'#branch-root',`${label} launch must preserve hash`);
      },
      onLogin:async()=>{
        assert.equal(await page.locator('#username').inputValue(),'weigshare',`${label} must land in the Lab-enabled ${branch} app`);
        assert.equal(await page.locator('#password').inputValue(),'weigshare',`${label} must retain the Lab credential preset`);
        await page.locator('#login-btn').click();
      }
    });
    if(recovered.attempt>1)console.log(`Recovered ${label} branch alias on bootstrap attempt ${recovered.attempt}.`);
    if(branch==='dev')await verifyDevLocale(page);
    const build=await readLandedBuild(new URL(page.url()));
    assert.equal(build.branch,branch,`${label} must resolve to the ${branch} app snapshot`);
    assert.equal(build.exactSha,branchSha,`${label} must resolve to the exact ${branch} source SHA`);
    assert.equal(build.simulatorSha,expectedSha,`${label} must use the exact deployed simulator SHA`);
    assert.deepEqual(errors,[],`${label} produced browser errors: ${errors.join('\n')}`);
  }finally{await context.close();}
}
async function openLabLauncher(page,entry){
  await page.goto(entry.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#launch-form',{state:'visible',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#qb-version option').length>=65,null,{timeout:60000});
}
async function verifyLabEntry(browser,site){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'});
  try{
    const page=await context.newPage(),errors=observeBrowserErrors(page),entry=new URL('',base);
    await openLabLauncher(page,entry);
    assert.equal(await page.locator('#branch').inputValue(),'dev','Pages root launcher must default to dev');
    assert.deepEqual(await page.locator('#branch option').allTextContents(),['dev','main'],'Pages launcher must expose dev and main launch targets');
    assert.equal(await page.locator('#open-dev,#open-main').count(),0,'Pages launcher must not duplicate branch selection with direct dev/main snapshot buttons');
    assert.equal(await page.locator('#launch-form button[type="submit"]').count(),1,'Pages launcher must use one launch button for the selected branch');
    assert.equal(await page.locator('#qb-version option').count(),65,'Pages launcher must expose all 65 frozen stable qB profiles');
    assert.ok((await page.locator('#catalog-status').textContent())?.includes('65 个 stable profiles'),'Pages launcher must load the published release catalog instead of bootstrap fallback');
    assert.equal(await page.locator('.language-nav [data-lab-locale]').count(),10,'Pages launcher must expose the required ten Lab languages');
    assert.equal(await page.locator('.lab-select').count(),4,'Pages launcher must replace all four native select surfaces with themed Lab controls');
    const widths=await page.evaluate(()=>{const a=document.getElementById('launch-panel').getBoundingClientRect(),b=document.getElementById('auth-panel').getBoundingClientRect();return{launch:a.width,auth:b.width}});assert.ok(Math.abs(widths.launch-widths.auth)<=1,`AUTH and Launch panels must have equal width: ${JSON.stringify(widths)}`);
    const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(overflow.scroll<=overflow.client,`Pages launcher must fit a 390px viewport: ${overflow.scroll}px > ${overflow.client}px`);
    await page.locator('#qb-version').selectOption('5.2.3');await page.locator('#torrent-count').fill('30');await page.locator('#seed').fill('lab-dev-entry');await page.locator('#launch-form button[type="submit"]').click();
    await page.waitForURL(url=>url.pathname.endsWith('/dev/app/')&&url.searchParams.get('qb')==='5.2.3',{timeout:60000});
    const devLanded=new URL(page.url());assert.equal(devLanded.searchParams.get('count'),'30','/lab/ must preserve requested torrent count when launching dev');assert.equal(devLanded.searchParams.get('seed'),'lab-dev-entry','/lab/ must preserve requested seed when launching dev');await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    const devBuild=await readLandedBuild(devLanded);assert.equal(devBuild.branch,'dev','/lab/ dev selection must reach the dev snapshot');assert.equal(devBuild.exactSha,site.branches?.dev?.exactSha,'/lab/ dev selection must reach the published exact dev SHA');assert.equal(devBuild.simulatorSha,expectedSha,'/lab/ dev selection must keep the exact deployed simulator SHA');
    await openLabLauncher(page,entry);await page.locator('.language-nav [data-lab-locale="en"]').click();assert.ok((await page.locator('h1').textContent())?.includes('qBittorrent'),'Lab language switch must update launcher copy');await page.locator('#branch').selectOption('main');await page.locator('#qb-version').selectOption('5.2.3');await page.locator('#torrent-count').fill('40');await page.locator('#seed').fill('lab-main-entry');await page.locator('#launch-form button[type="submit"]').click();
    await page.waitForURL(url=>url.pathname.endsWith('/main/app/')&&url.searchParams.get('qb')==='5.2.3',{timeout:60000});
    const mainLanded=new URL(page.url());assert.equal(mainLanded.searchParams.get('count'),'40','/lab/ must preserve requested torrent count when launching main');assert.equal(mainLanded.searchParams.get('seed'),'lab-main-entry','/lab/ must preserve requested seed when launching main');await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    const mainBuild=await readLandedBuild(mainLanded);assert.equal(mainBuild.branch,'main','/lab/ main selection must reach the main snapshot');assert.equal(mainBuild.exactSha,site.branches?.main?.exactSha,'/lab/ main selection must reach the published exact main SHA');assert.equal(mainBuild.simulatorSha,expectedSha,'/lab/ main selection must keep the exact deployed simulator SHA');assert.deepEqual(errors,[],`/lab/ produced browser errors: ${errors.join('\n')}`);
  }finally{await context.close();}
}
const site=await waitForDeployedSite();
assert.equal(site?.branches?.dev?.exactSha,expectedSha,'Published dev branch identity must equal the deployed simulator SHA');
assert.ok(site?.branches?.main?.exactSha,'Published site metadata must identify the exact main snapshot');
const browser=await launchBrowser();
try{
  await verifyBranchEntry(browser,{branch:'dev',entryPath:'dev/',branchSha:site.branches.dev.exactSha,label:'/dev/'});
  await verifyBranchEntry(browser,{branch:'main',entryPath:'main',branchSha:site.branches.main.exactSha,label:'/main'});
  await verifyLabEntry(browser,site);
  console.log(`Virtual qB Pages entry acceptance passed for ${expectedSha}: root/dev/main all enter the shared themed Lab launcher with branch-aware defaults and ten Lab languages; launch then resolves to exact dev/main app snapshots, while the real WebUI Language dropdown retains its independent qB locale contract.`);
}finally{await browser.close();}

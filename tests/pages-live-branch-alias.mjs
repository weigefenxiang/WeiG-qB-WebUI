import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForDeployedSite(){
  let last='not fetched';
  for(let attempt=0;attempt<40;attempt++){
    try{
      const url=new URL('metadata/site.json',base);
      url.searchParams.set('__live_sha',expectedSha);
      const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
      const site=response.ok?await response.json():null;
      last=site?.simulatorSha||`HTTP ${response.status}`;
      if(last===expectedSha)return site;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages did not expose simulator SHA ${expectedSha}; last observation: ${last}`);
}

function observeBrowserErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    const text=message.text();
    const source=String(message.location()?.url||'');
    if(/favicon(?:\.ico)?|Wei\.G\.ico/i.test(`${source} ${text}`))return;
    errors.push(source?`${text} (${source})`:text);
  });
  return errors;
}

async function readLandedBuild(landed){
  const buildUrl=new URL('virtual-qb-build.json',landed);
  buildUrl.search='';
  buildUrl.hash='';
  const response=await fetch(buildUrl,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  assert.equal(response.status,200,`landed app build metadata must be published at ${buildUrl}`);
  return response.json();
}

async function openSettings(page){
  await page.evaluate(async()=>{
    if(!window.WeiG?.SettingsRenderer?.open)throw new Error('WeiG SettingsRenderer is unavailable');
    await window.WeiG.SettingsRenderer.open('weigg');
  });
  await page.waitForSelector('[data-setting-key="weigg_language"]',{state:'attached',timeout:30000});
}

async function setVerifiedLocale(page,target){
  const current=await page.evaluate(()=>window.WeiG?.I18n?.getQbLocale?.()||'');
  if(current===target)return false;
  await openSettings(page);

  const before=await page.evaluate(()=>{
    const row=document.querySelector('[data-setting-key="weigg_language"]');
    const control=row?.querySelector('.ui-select');
    const trigger=row?.querySelector('.ui-select__trigger');
    const draft=window.WeiG?.SettingsState?.draft||{};
    const prefs=window.WeiG?.SettingsState?.prefs||{};
    const value=Object.prototype.hasOwnProperty.call(draft,'locale')?draft.locale:prefs.locale;
    return{
      value:control?.getValue?.()||'',
      disabled:!!trigger?.disabled,
      writable:window.WeiG?.SettingsSchema?.isWritable?.('locale',value)===true
    };
  });
  assert.equal(before.disabled,false,`${target}: Language UI control must be enabled`);
  assert.equal(before.writable,true,`${target}: Locale must be writable through SettingsSchema before user interaction`);

  const trigger=page.locator('[data-setting-key="weigg_language"] .ui-select__trigger');
  await trigger.click();
  const option=page.locator(`.ui-select__menu:not([hidden]) .ui-select__option[data-value="${target}"]`);
  await option.waitFor({state:'visible',timeout:30000});
  await option.click();

  const drafted=await page.evaluate(()=>{
    const row=document.querySelector('[data-setting-key="weigg_language"]');
    const control=row?.querySelector('.ui-select');
    return{value:control?.getValue?.()||'',draft:window.WeiG?.SettingsState?.draft?.locale||''};
  });
  assert.equal(drafted.value,target,`${target}: user-selected Language control value must update before save`);
  assert.equal(drafted.draft,target,`${target}: user-selected Language control must update the qB locale draft`);

  const navigation=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#save-settings-btn').click();
  await navigation;
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(locale=>window.WeiG?.I18n?.getQbLocale?.()===locale,target,{timeout:30000});

  const persisted=await page.evaluate(async()=>{
    const response=await fetch('api/v2/app/preferences',{cache:'no-store'});
    const prefs=await response.json();
    return{status:response.status,locale:prefs.locale,qbLocale:window.WeiG?.I18n?.getQbLocale?.(),lang:document.documentElement.lang};
  });
  assert.equal(persisted.status,200,`${target} preferences reread must succeed after reload`);
  assert.equal(persisted.locale,target,`${target} must persist in qB preferences.locale`);
  assert.equal(persisted.qbLocale,target,`${target} must become the runtime qB locale after reload`);

  await openSettings(page);
  const reopened=await page.evaluate(()=>{
    const row=document.querySelector('[data-setting-key="weigg_language"]');
    const control=row?.querySelector('.ui-select');
    const trigger=row?.querySelector('.ui-select__trigger');
    return{value:control?.getValue?.()||'',disabled:!!trigger?.disabled};
  });
  assert.equal(reopened.disabled,false,`${target}: Language UI control must remain enabled after reload`);
  assert.equal(reopened.value,target,`${target}: reopening Settings must show the persisted qB locale selection`);
  return true;
}

async function verifyDevLocale(browserPage){
  await openSettings(browserPage);
  const options=await browserPage.evaluate(()=>window.WeiG?.I18n?.localeOptions?.()||[]);
  const chinese=options.filter(item=>['zh_CN','zh_HK','zh_TW'].includes(String(item.value))).sort((a,b)=>String(a.value).localeCompare(String(b.value)));
  assert.deepEqual(chinese.map(item=>item.value),['zh_CN','zh_HK','zh_TW'],'modern qB locale evidence must expose the exact three Chinese locale codes');
  assert.equal(new Set(chinese.map(item=>item.label)).size,3,'zh_CN / zh_HK / zh_TW must have distinct visible labels');
  for(const item of chinese)assert.ok(String(item.label).includes(item.value),`${item.value} label must expose its exact qB locale code`);

  const initial=await browserPage.evaluate(()=>window.WeiG?.I18n?.getQbLocale?.()||'');
  if(initial==='zh_CN')await setVerifiedLocale(browserPage,'en');
  await setVerifiedLocale(browserPage,'zh_CN');
  await browserPage.waitForFunction(()=>window.WeiG?.I18n?.getQbLocale?.()==='zh_CN'&&document.documentElement.lang==='zh-CN',null,{timeout:30000});
  const verified=await browserPage.evaluate(async()=>{
    const response=await fetch('api/v2/app/preferences',{cache:'no-store'});
    const prefs=await response.json();
    return{status:response.status,locale:prefs.locale,qbLocale:window.WeiG?.I18n?.getQbLocale?.(),lang:document.documentElement.lang};
  });
  assert.deepEqual(verified,{status:200,locale:'zh_CN',qbLocale:'zh_CN',lang:'zh-CN'},'English-to-Simplified-Chinese locale transition must persist through qB preferences, reload, runtime projection, and a reopened Settings control');
}

async function verifyBranchEntry(browser,{branch,entryPath,branchSha,label}){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'});
  try{
    const page=await context.newPage();
    const errors=observeBrowserErrors(page);
    const params=new URLSearchParams({
      sim:`pages-${branch}-root-${Date.now()}`,
      qb:'5.2.3',
      count:'80',
      scenario:'mixed',
      seed:`${branch}-root-alias`
    });
    const entry=new URL(entryPath,base);
    entry.search=params.toString();
    entry.hash='#branch-root';

    await page.goto(entry.toString(),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForURL(url=>url.pathname.endsWith(`/${branch}/app/`)&&url.hash==='#branch-root',{timeout:60000});
    const landed=new URL(page.url());
    for(const [key,value] of params)assert.equal(landed.searchParams.get(key),value,`${label} must preserve ${key}`);
    assert.equal(landed.hash,'#branch-root',`${label} must preserve hash`);

    await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    assert.equal(await page.locator('#username').inputValue(),'weigshare',`${label} must land in the Lab-enabled ${branch} app`);
    assert.equal(await page.locator('#password').inputValue(),'weigshare',`${label} must retain the Lab credential preset`);
    await page.locator('#login-btn').click();
    await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
    await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});

    if(branch==='dev')await verifyDevLocale(page);

    const build=await readLandedBuild(new URL(page.url()));
    assert.equal(build.branch,branch,`${label} must resolve to the ${branch} app snapshot`);
    assert.equal(build.exactSha,branchSha,`${label} must resolve to the exact ${branch} source SHA`);
    assert.equal(build.simulatorSha,expectedSha,`${label} must use the exact deployed simulator SHA`);
    assert.deepEqual(errors,[],`${label} produced browser errors: ${errors.join('\n')}`);
  }finally{
    await context.close();
  }
}

async function openLabLauncher(page,entry){
  await page.goto(entry.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#launch-form',{state:'visible',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#qb-version option').length>=65,null,{timeout:60000});
}

async function verifyLabEntry(browser,site){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'});
  try{
    const page=await context.newPage();
    const errors=observeBrowserErrors(page);
    const entry=new URL('lab/',base);
    await openLabLauncher(page,entry);

    assert.equal(await page.locator('#branch').inputValue(),'dev','/lab/ must default to dev');
    assert.deepEqual(await page.locator('#branch option').allTextContents(),['dev','main'],'/lab/ must expose dev and main launch targets');
    assert.equal(await page.locator('#open-dev,#open-main').count(),0,'/lab/ must not duplicate branch selection with direct dev/main snapshot buttons');
    assert.equal(await page.locator('#launch-form button[type="submit"]').count(),1,'/lab/ must use one launch button for the selected branch');
    assert.equal(await page.locator('#qb-version option').count(),65,'/lab/ must expose all 65 frozen stable qB profiles');
    assert.ok((await page.locator('#catalog-status').textContent())?.includes('65 个 stable profiles'),'/lab/ must load the published release catalog instead of bootstrap fallback');
    const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(overflow.scroll<=overflow.client,`/lab/ must fit a 390px viewport: ${overflow.scroll}px > ${overflow.client}px`);

    await page.locator('#qb-version').selectOption('5.2.3');
    await page.locator('#torrent-count').fill('30');
    await page.locator('#seed').fill('lab-dev-entry');
    await page.locator('#launch-form button[type="submit"]').click();
    await page.waitForURL(url=>url.pathname.endsWith('/dev/app/')&&url.searchParams.get('qb')==='5.2.3',{timeout:60000});
    const devLanded=new URL(page.url());
    assert.equal(devLanded.searchParams.get('count'),'30','/lab/ must preserve requested torrent count when launching dev');
    assert.equal(devLanded.searchParams.get('seed'),'lab-dev-entry','/lab/ must preserve requested seed when launching dev');
    await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    const devBuild=await readLandedBuild(devLanded);
    assert.equal(devBuild.branch,'dev','/lab/ dev selection must reach the dev snapshot');
    assert.equal(devBuild.exactSha,site.branches?.dev?.exactSha,'/lab/ dev selection must reach the published exact dev SHA');
    assert.equal(devBuild.simulatorSha,expectedSha,'/lab/ dev selection must keep the exact deployed simulator SHA');

    await openLabLauncher(page,entry);
    await page.locator('#branch').selectOption('main');
    await page.locator('#qb-version').selectOption('5.2.3');
    await page.locator('#torrent-count').fill('40');
    await page.locator('#seed').fill('lab-main-entry');
    await page.locator('#launch-form button[type="submit"]').click();
    await page.waitForURL(url=>url.pathname.endsWith('/main/app/')&&url.searchParams.get('qb')==='5.2.3',{timeout:60000});
    const mainLanded=new URL(page.url());
    assert.equal(mainLanded.searchParams.get('count'),'40','/lab/ must preserve requested torrent count when launching main');
    assert.equal(mainLanded.searchParams.get('seed'),'lab-main-entry','/lab/ must preserve requested seed when launching main');
    await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    const mainBuild=await readLandedBuild(mainLanded);
    assert.equal(mainBuild.branch,'main','/lab/ main selection must reach the main snapshot');
    assert.equal(mainBuild.exactSha,site.branches?.main?.exactSha,'/lab/ main selection must reach the published exact main SHA');
    assert.equal(mainBuild.simulatorSha,expectedSha,'/lab/ main selection must keep the exact deployed simulator SHA');
    assert.deepEqual(errors,[],`/lab/ produced browser errors: ${errors.join('\n')}`);
  }finally{
    await context.close();
  }
}

const site=await waitForDeployedSite();
assert.equal(site?.branches?.dev?.exactSha,expectedSha,'Published dev branch identity must equal the deployed simulator SHA');
assert.ok(site?.branches?.main?.exactSha,'Published site metadata must identify the exact main snapshot');

const browser=await launchBrowser();
try{
  await verifyBranchEntry(browser,{branch:'dev',entryPath:'dev/',branchSha:site.branches.dev.exactSha,label:'/dev/'});
  await verifyBranchEntry(browser,{branch:'main',entryPath:'main',branchSha:site.branches.main.exactSha,label:'/main'});
  await verifyLabEntry(browser,site);
  console.log(`Virtual qB Pages entry acceptance passed for ${expectedSha}: /dev/, /main and /lab/ render cleanly, the real Language dropdown and Save button persist Simplified Chinese through reload and reopened Settings, locale variants remain distinct, the Lab branch selector routes dev and main through one launcher to their exact app snapshots, routing semantics are preserved, and each entry resolves to its exact published snapshot.`);
}finally{
  await browser.close();
}

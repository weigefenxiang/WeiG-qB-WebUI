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

async function verifyDevLocale(browserPage){
  await browserPage.evaluate(async()=>{
    if(!window.WeiG?.SettingsRenderer?.open)throw new Error('WeiG SettingsRenderer is unavailable');
    await window.WeiG.SettingsRenderer.open('weigg');
  });
  await browserPage.waitForSelector('[data-setting-key="weigg_language"]',{state:'attached',timeout:30000});
  const options=await browserPage.evaluate(()=>window.WeiG?.I18n?.localeOptions?.()||[]);
  const chinese=options.filter(item=>['zh_CN','zh_HK','zh_TW'].includes(String(item.value))).sort((a,b)=>String(a.value).localeCompare(String(b.value)));
  assert.deepEqual(chinese.map(item=>item.value),['zh_CN','zh_HK','zh_TW'],'modern qB locale evidence must expose the exact three Chinese locale codes');
  assert.equal(new Set(chinese.map(item=>item.label)).size,3,'zh_CN / zh_HK / zh_TW must have distinct visible labels');
  for(const item of chinese)assert.ok(String(item.label).includes(item.value),`${item.value} label must expose its exact qB locale code`);

  const navigation=browserPage.waitForNavigation({waitUntil:'domcontentloaded',timeout:30000});
  await browserPage.evaluate(()=>{
    window.WeiG.SettingsState.draft.locale='zh_CN';
    void window.WeiG.SettingsRenderer.save();
  });
  await navigation;
  await browserPage.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await browserPage.waitForFunction(()=>window.WeiG?.I18n?.getQbLocale?.()==='zh_CN'&&document.documentElement.lang==='zh-CN',null,{timeout:30000});
  const verified=await browserPage.evaluate(async()=>{
    const response=await fetch('api/v2/app/preferences',{cache:'no-store'});
    const prefs=await response.json();
    return{status:response.status,locale:prefs.locale,qbLocale:window.WeiG?.I18n?.getQbLocale?.(),lang:document.documentElement.lang};
  });
  assert.deepEqual(verified,{status:200,locale:'zh_CN',qbLocale:'zh_CN',lang:'zh-CN'},'Chinese locale must persist through qB preferences, reload, and runtime projection');
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

async function verifyLabEntry(browser,site){
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'});
  try{
    const page=await context.newPage();
    const errors=observeBrowserErrors(page);
    const entry=new URL('lab/',base);
    await page.goto(entry.toString(),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#launch-form',{state:'visible',timeout:60000});
    await page.waitForFunction(()=>document.querySelectorAll('#qb-version option').length>=65,null,{timeout:60000});

    assert.equal(await page.locator('#branch').inputValue(),'dev','/lab/ must default to dev');
    assert.deepEqual(await page.locator('#branch option').allTextContents(),['dev','main'],'/lab/ must expose dev and main launch targets');
    const directTargets=await page.evaluate(()=>Object.fromEntries(['open-dev','open-main'].map(id=>{const node=document.getElementById(id);return[id,node?new URL(node.getAttribute('href'),location.href).pathname:null];})));
    assert.ok(directTargets['open-dev']?.endsWith('/WeiG-qB-WebUI/dev/'),'/lab/ must expose a direct dev snapshot entry');
    assert.ok(directTargets['open-main']?.endsWith('/WeiG-qB-WebUI/main/'),'/lab/ must expose a direct main snapshot entry');
    assert.equal(await page.locator('#qb-version option').count(),65,'/lab/ must expose all 65 frozen stable qB profiles');
    assert.ok((await page.locator('#catalog-status').textContent())?.includes('65 个 stable profiles'),'/lab/ must load the published release catalog instead of bootstrap fallback');
    const overflow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    assert.ok(overflow.scroll<=overflow.client,`/lab/ must fit a 390px viewport: ${overflow.scroll}px > ${overflow.client}px`);

    await page.locator('#branch').selectOption('main');
    await page.locator('#qb-version').selectOption('5.2.3');
    await page.locator('#torrent-count').fill('40');
    await page.locator('#seed').fill('lab-main-entry');
    await page.locator('#launch-form button[type="submit"]').click();
    await page.waitForURL(url=>url.pathname.endsWith('/main/app/')&&url.searchParams.get('qb')==='5.2.3',{timeout:60000});
    const landed=new URL(page.url());
    assert.equal(landed.searchParams.get('count'),'40','/lab/ must preserve requested torrent count when launching main');
    assert.equal(landed.searchParams.get('seed'),'lab-main-entry','/lab/ must preserve requested seed when launching main');
    await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    const build=await readLandedBuild(landed);
    assert.equal(build.branch,'main','/lab/ main launch must reach the main snapshot');
    assert.equal(build.exactSha,site.branches?.main?.exactSha,'/lab/ main launch must reach the published exact main SHA');
    assert.equal(build.simulatorSha,expectedSha,'/lab/ main launch must keep the exact deployed simulator SHA');
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
  console.log(`Virtual qB Pages entry acceptance passed for ${expectedSha}: /dev/, /main and /lab/ render cleanly, locale variants remain distinct and persist through verified reload, direct snapshot entries resolve correctly, routing semantics are preserved, and each entry resolves to its exact published snapshot.`);
}finally{
  await browser.close();
}

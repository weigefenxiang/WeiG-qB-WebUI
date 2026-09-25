import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchJson(relative){
  const url=new URL(String(relative).replace(/^\/+/,''),base);
  url.searchParams.set('__live_sha',expectedSha);
  const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}
async function waitForDeployedSha(){
  let last='not fetched';
  for(let attempt=1;attempt<=40;attempt++){
    try{const site=await fetchJson('metadata/site.json');last=site?.simulatorSha||'missing simulatorSha';if(last===expectedSha)return site;}catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages did not expose simulator SHA ${expectedSha}; last observation: ${last}`);
}
async function api(page,path){
  return page.evaluate(async path=>{
    const response=await fetch(`api/v2/${path}`,{cache:'no-store'});
    const text=await response.text();
    let json=null;try{json=text?JSON.parse(text):null;}catch{}
    return{status:response.status,text:text.trim(),json};
  },path);
}

await waitForDeployedSha();
const browser=await launchBrowser();
try{
  const context=await browser.newContext({locale:'zh-CN'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));

  async function launchLabSession(ordinal){
    await page.goto(new URL('lab/',base).toString(),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>document.querySelectorAll('#qb-version option').length>1,null,{timeout:30000});
    await page.selectOption('#branch','dev');
    await page.selectOption('#qb-version','5.2.3');
    await page.fill('#torrent-count','12');
    await page.selectOption('#clean','0');
    await page.locator('#launch-form button[type="submit"]').click();
    await page.waitForURL(url=>url.pathname.includes('/dev/app/'),{timeout:30000});
    const sessionUrl=new URL(page.url());
    const sim=sessionUrl.searchParams.get('sim');
    assert.ok(sim,`session ${ordinal}: Lab must allocate a unique sim id`);
    await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    assert.equal(await page.locator('#username').inputValue(),'weigshare',`session ${ordinal}: Lab username must be prefilled`);
    assert.equal(await page.locator('#password').inputValue(),'weigshare',`session ${ordinal}: Lab password must be prefilled`);
    await page.locator('#login-btn').click();
    await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});
    await page.waitForFunction(()=>window.WeiG?.SessionController?.readLocaleBootstrap?.()?.initialized===true,null,{timeout:30000});
    await page.waitForTimeout(1800);
    await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});

    const prefs=await api(page,'app/preferences');
    assert.equal(prefs.status,200,`session ${ordinal}: app/preferences must be readable`);
    assert.equal(prefs.json?.locale,'zh_CN',`session ${ordinal}: zh-CN browser must persist qB locale zh_CN`);
    const state=await page.evaluate(()=>({
      locale:String(window.WeiG?.I18n?.getLocale?.()||''),
      record:window.WeiG?.SessionController?.readLocaleBootstrap?.()||null,
      browserLanguages:[...(navigator.languages||[])],
      htmlLang:document.documentElement.lang
    }));
    assert.equal(state.locale,'zh-CN',`session ${ordinal}: WeiG runtime locale must follow persisted qB zh_CN`);
    assert.equal(state.record?.initialized,true,`session ${ordinal}: locale bootstrap must complete`);
    assert.equal(state.record?.selectedLocale,'zh_CN',`session ${ordinal}: bootstrap record must bind qB zh_CN`);
    assert.ok(state.browserLanguages.some(value=>/^zh(?:-|$)/i.test(value)),`session ${ordinal}: browser language must expose zh-CN context`);
    return{sim,state};
  }

  const first=await launchLabSession(1);
  const firstRecord=await page.evaluate(()=>{
    const key=window.WeiG?.StorageKeys?.localeBootstrap||'';
    return{key,value:key?localStorage.getItem(key):null,legacy:localStorage.getItem('weigg.localeBootstrap.v2')};
  });
  assert.equal(firstRecord.key,'weig.localeBootstrap','locale bootstrap acceptance must consume the canonical StorageKeys owner');
  assert.ok(firstRecord.value,'first Lab session must leave a completed bootstrap record on the shared Pages origin');
  assert.equal(firstRecord.legacy,null,'legacy weigg.localeBootstrap.v2 must remain retired after storage migration');
  // Pages multiplexes independent Virtual qB daemons behind one browser origin.
  // Reset only the canonical one-time browser-bootstrap record between sims so
  // this verifier models a fresh qB origin without teaching product runtime about sim.
  await page.evaluate(key=>localStorage.removeItem(key),firstRecord.key);
  const second=await launchLabSession(2);
  assert.notEqual(second.sim,first.sim,'second Lab launch must use a fresh Virtual qB sim');
  assert.equal(second.state.locale,'zh-CN','fresh sim must not inherit an old initialized record that skips browser matching');

  const entryLanguageRoots=new Set(['en','zh','ja','ko','de','fr','es','pt','ru']);
  const nativeLocaleOptions=await page.evaluate(()=>window.WeiG?.I18n?.localeOptions?.()||[]);
  const dynamicTarget=nativeLocaleOptions.map(item=>{
    const qbLocale=String(item?.value||'').trim();
    const browserLocale=qbLocale.replace(/@(?:latin|latn)$/i,'-Latn').replace(/_/g,'-');
    let language='';try{language=new Intl.Locale(browserLocale).language.toLowerCase();}catch{}
    return{qbLocale,browserLocale,language};
  }).find(item=>item.qbLocale&&item.language&&!entryLanguageRoots.has(item.language));
  assert.ok(dynamicTarget,`qB 5.2.3 locale inventory must expose at least one native locale outside the entry-page dictionary: ${JSON.stringify(nativeLocaleOptions)}`);
  assert.deepEqual(errors,[],`locale bootstrap browser errors before dynamic native-locale case:\n${errors.join('\n')}`);
  await context.close();

  const dynamicContext=await browser.newContext({locale:dynamicTarget.browserLocale});
  const dynamicPage=await dynamicContext.newPage();
  const dynamicErrors=[];
  dynamicPage.on('pageerror',error=>dynamicErrors.push(error?.stack||error?.message||String(error)));
  try{
    await dynamicPage.goto(new URL('lab/',base).toString(),{waitUntil:'domcontentloaded',timeout:60000});
    await dynamicPage.waitForFunction(()=>document.querySelectorAll('#qb-version option').length>1,null,{timeout:30000});
    await dynamicPage.selectOption('#branch','dev');
    await dynamicPage.selectOption('#qb-version','5.2.3');
    await dynamicPage.fill('#torrent-count','12');
    await dynamicPage.selectOption('#clean','0');
    await dynamicPage.locator('#launch-form button[type="submit"]').click();
    await dynamicPage.waitForURL(url=>url.pathname.includes('/dev/app/'),{timeout:30000});
    await dynamicPage.waitForSelector('#login-form',{state:'visible',timeout:60000});
    const entryState=await dynamicPage.evaluate(()=>({lang:document.documentElement.lang,title:String(document.querySelector('#login-title')?.textContent||'').trim(),selected:String(document.querySelector('#login-language')?.value||'')}));
    assert.equal(entryState.lang,'en',`unsupported entry locale ${dynamicTarget.browserLocale} must fall back to English before authentication: ${JSON.stringify(entryState)}`);
    assert.equal(entryState.title,'Welcome back',`unsupported entry locale ${dynamicTarget.browserLocale} must use English login copy before authentication`);
    assert.equal(entryState.selected,'en',`unsupported entry locale ${dynamicTarget.browserLocale} must select English on the public login page`);
    assert.equal(await dynamicPage.locator('#username').inputValue(),'weigshare','dynamic locale Lab username must be prefilled');
    assert.equal(await dynamicPage.locator('#password').inputValue(),'weigshare','dynamic locale Lab password must be prefilled');
    await dynamicPage.locator('#login-btn').click();
    await dynamicPage.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});
    await dynamicPage.waitForFunction(()=>window.WeiG?.SessionController?.readLocaleBootstrap?.()?.initialized===true,null,{timeout:30000});
    await dynamicPage.waitForTimeout(1800);
    await dynamicPage.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});
    const dynamicPrefs=await api(dynamicPage,'app/preferences');
    assert.equal(dynamicPrefs.status,200,'dynamic locale app/preferences must be readable');
    assert.equal(dynamicPrefs.json?.locale,dynamicTarget.qbLocale,`authenticated bootstrap must persist the qB-native browser locale ${dynamicTarget.qbLocale}`);
    const dynamicState=await dynamicPage.evaluate(()=>({
      qbLocale:String(window.WeiG?.I18n?.getQbLocale?.()||''),
      locale:String(window.WeiG?.I18n?.getLocale?.()||''),
      record:window.WeiG?.SessionController?.readLocaleBootstrap?.()||null,
      saveCopy:String(window.WeiG?.I18n?.t?.('settings.save')||''),
      englishSave:String(window.WeiG?.I18n?.english?.['settings.save']||''),
      browserLanguages:[...(navigator.languages||[])]
    }));
    assert.equal(dynamicState.qbLocale,dynamicTarget.qbLocale,`WeiG must retain the exact persisted qB locale identity ${dynamicTarget.qbLocale}`);
    assert.equal(dynamicState.record?.initialized,true,'dynamic qB-native locale bootstrap must complete');
    assert.equal(dynamicState.record?.selectedLocale,dynamicTarget.qbLocale,'dynamic bootstrap record must bind the qB-native locale');
    assert.equal(dynamicState.saveCopy,dynamicState.englishSave,`WeiG-owned copy without a local dictionary must safely fall back to English while qB locale remains ${dynamicTarget.qbLocale}`);
    assert.ok(dynamicState.browserLanguages.some(value=>String(value).toLowerCase().startsWith(dynamicTarget.language)),`dynamic browser context must expose the selected native language ${dynamicTarget.browserLocale}`);
    assert.deepEqual(dynamicErrors,[],`dynamic native-locale bootstrap browser errors:\n${dynamicErrors.join('\n')}`);
  }finally{
    await dynamicContext.close();
  }
}finally{
  await browser.close();
}

console.log(`Virtual qB Pages locale-bootstrap acceptance passed for ${expectedSha}: fresh zh-CN sims persist qB zh_CN, while a dynamically selected qB-native locale outside the public login dictionary falls back to English before auth and is persisted after auth with WeiG-owned copy safely falling back to English.`);

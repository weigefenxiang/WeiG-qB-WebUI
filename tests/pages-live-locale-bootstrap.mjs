import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
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
  const firstRecord=await page.evaluate(()=>localStorage.getItem('weigg.localeBootstrap.v2'));
  assert.ok(firstRecord,'first Lab session must leave a completed bootstrap record on the shared Pages origin');
  const second=await launchLabSession(2);
  assert.notEqual(second.sim,first.sim,'second Lab launch must use a fresh Virtual qB sim');
  assert.equal(second.state.locale,'zh-CN','fresh sim must not inherit an old initialized record that skips browser matching');
  assert.deepEqual(errors,[],`locale bootstrap browser errors:\n${errors.join('\n')}`);
  await context.close();
}finally{
  await browser.close();
}

console.log(`Virtual qB Pages locale-bootstrap acceptance passed for ${expectedSha}: two fresh Lab sims in one zh-CN browser both persist qB zh_CN and render WeiG zh-CN without cross-sim localStorage pollution.`);

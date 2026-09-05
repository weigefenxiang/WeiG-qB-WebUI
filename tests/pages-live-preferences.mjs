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
    try{
      const site=await fetchJson('metadata/site.json');
      last=site?.simulatorSha||'missing simulatorSha';
      if(last===expectedSha)return site;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages did not expose simulator SHA ${expectedSha}; last observation: ${last}`);
}

async function api(page,path){
  return page.evaluate(async path=>{
    const response=await fetch(`api/v2/${path}`,{cache:'no-store'});
    const text=await response.text();
    return{status:response.status,json:text?JSON.parse(text):null};
  },path);
}

await waitForDeployedSha();
const catalog=await fetchJson('metadata/qb-releases.json');
const profile=catalog.find(item=>item.qbVersion==='5.2.3');
assert.ok(profile,'published upstream catalog must contain qB 5.2.3');
assert.ok(Array.isArray(profile.preferenceKeys),'qB 5.2.3 profile must publish upstream preferenceKeys');
assert.ok(profile.preferenceKeys.length>100,`qB 5.2.3 upstream preference surface unexpectedly small: ${profile.preferenceKeys.length}`);

const browser=await launchBrowser();
try{
  const context=await browser.newContext({locale:'zh-CN'});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error?.stack||error?.message||String(error)));

  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({
    sim:`pages-live-preferences-${Date.now()}`,
    qb:'5.2.3',count:'96',scenario:'mixed',seed:'pages-live-preferences',clean:'0'
  }).toString();
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
  await page.locator('#login-btn').click();
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});

  const response=await api(page,'app/preferences');
  assert.equal(response.status,200,'Virtual qB app/preferences must be readable');
  const actualKeys=Object.keys(response.json||{}).sort();
  const upstreamKeys=[...profile.preferenceKeys].sort();
  assert.deepEqual(actualKeys,upstreamKeys,'Virtual qB 5.2.3 app/preferences must exactly match the official upstream key surface');

  const advancedExamples=[
    'limit_utp_rate','scheduler_enabled','schedule_from_hour','schedule_to_hour','scheduler_days',
    'checking_memory_use','disk_cache_ttl','disk_io_read_mode','disk_io_write_mode','enable_coalesce_read_write',
    'file_pool_size','memory_working_set_limit'
  ];
  for(const key of advancedExamples){
    assert.ok(Object.prototype.hasOwnProperty.call(response.json,key),`Virtual qB 5.2.3 must expose advanced preference ${key}`);
  }

  await page.evaluate(async()=>{
    if(!window.WeiG?.SettingsRenderer?.open)throw new Error('WeiG SettingsRenderer is unavailable');
    await window.WeiG.SettingsRenderer.open('advanced');
  });
  await page.waitForFunction(()=>document.querySelectorAll('#settings-content [data-setting-key]').length>=20,null,{timeout:30000});
  const renderedKeys=await page.locator('#settings-content [data-setting-key]').evaluateAll(rows=>rows.map(row=>row.dataset.settingKey));
  for(const key of advancedExamples){
    assert.ok(renderedKeys.includes(key),`WeiG Advanced settings must render upstream preference ${key}`);
  }
  assert.ok(renderedKeys.length>=20,`WeiG Advanced settings surface unexpectedly small: ${renderedKeys.length}`);
  assert.deepEqual(pageErrors,[],`Preference surface session emitted page errors:\n${pageErrors.join('\n')}`);
  await context.close();
}finally{
  await browser.close();
}

console.log(`Virtual qB Pages preference acceptance passed for ${expectedSha}: qB 5.2.3 app/preferences exactly matches the official upstream key surface and WeiG renders representative Advanced settings.`);

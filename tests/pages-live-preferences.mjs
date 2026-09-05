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

async function api(page,path,{method='GET',form}={}){
  return page.evaluate(async({path,method,form})=>{
    const init={method,cache:'no-store'};
    if(form){
      const body=new URLSearchParams();
      for(const [key,value] of Object.entries(form))body.set(key,String(value));
      init.headers={'content-type':'application/x-www-form-urlencoded'};
      init.body=body.toString();
    }
    const response=await fetch(`api/v2/${path}`,init);
    const text=await response.text();
    let json=null;
    try{json=text?JSON.parse(text):null;}catch{}
    return{status:response.status,text:text.trim(),json};
  },{path,method,form});
}

function valueMatchesType(value,type){
  if(type==='boolean')return typeof value==='boolean';
  if(type==='number')return typeof value==='number'&&Number.isFinite(value);
  if(type==='string')return typeof value==='string';
  if(type==='array')return Array.isArray(value);
  if(type==='object')return !!value&&typeof value==='object'&&!Array.isArray(value);
  return true;
}

function difference(left,right){
  const rhs=new Set(Array.isArray(right)?right.map(String):[]);
  return [...new Set(Array.isArray(left)?left.map(String):[])].filter(value=>!rhs.has(value)).sort();
}

const site=await waitForDeployedSha();
const catalog=await fetchJson('metadata/qb-releases.json');
const matrix=catalog.filter(item=>item?.stable!==false&&/^(?:4|5)\.\d+\.\d+(?:\.\d+)?$/.test(String(item?.qbVersion||'')));
assert.ok(matrix.length>=30,`published stable qB 4.x/5.x matrix unexpectedly small: ${matrix.length}`);
assert.equal(matrix[0].qbVersion,'4.1.0','Virtual qB stable preference matrix must start at qB 4.1.0');
assert.equal(site?.preferenceCatalog?.profiles,matrix.length,'site metadata must publish the same stable preference profile count as qb-releases.json');
assert.ok(Number(site?.preferenceCatalog?.typed)>0,'site metadata must expose source-derived typed preference coverage');

for(let index=0;index<matrix.length;index++){
  const profile=matrix[index];
  const previous=index>0?matrix[index-1]:null;
  assert.ok(Array.isArray(profile.preferenceKeys)&&profile.preferenceKeys.length>0,`${profile.qbVersion}: upstream preferenceKeys must be published`);
  assert.ok(Array.isArray(profile.preferenceDescriptors),`${profile.qbVersion}: preferenceDescriptors must be published`);
  assert.equal(profile.preferenceDescriptors.length,profile.preferenceKeys.length,`${profile.qbVersion}: descriptor count must exactly match preference key surface`);
  assert.equal(profile.preferenceDescriptorStats?.total,profile.preferenceKeys.length,`${profile.qbVersion}: descriptor stats must match preference surface`);
  assert.equal(profile.releaseOrdinal,index,`${profile.qbVersion}: release ordinal must preserve catalog order`);
  assert.deepEqual(profile.preferenceChanges?.added,previous?difference(profile.preferenceKeys,previous.preferenceKeys):[...profile.preferenceKeys].sort(),`${profile.qbVersion}: published added preference diff is stale`);
  assert.deepEqual(profile.preferenceChanges?.removed,previous?difference(previous.preferenceKeys,profile.preferenceKeys):[],`${profile.qbVersion}: published removed preference diff is stale`);
  for(const descriptor of profile.preferenceDescriptors){
    assert.ok(profile.preferenceKeys.includes(descriptor.key),`${profile.qbVersion}: descriptor ${descriptor.key} escaped upstream surface`);
    assert.ok(descriptor.firstSeenInLabCatalog,`${profile.qbVersion}/${descriptor.key}: first-seen provenance missing`);
    assert.ok(descriptor.schemaLastChangedInLabCatalog,`${profile.qbVersion}/${descriptor.key}: schema-change provenance missing`);
    if(descriptor.writable)assert.ok(descriptor.type,`${profile.qbVersion}/${descriptor.key}: writable upstream descriptor must have a high-confidence type`);
  }
}

const anchor=catalog.find(item=>item.qbVersion==='5.2.3')||matrix.filter(item=>String(item.qbVersion).startsWith('5.')).at(-1);
assert.ok(anchor,'published upstream catalog must contain a qB 5.x anchor');
assert.ok(anchor.preferenceKeys.length>100,`${anchor.qbVersion} upstream preference surface unexpectedly small: ${anchor.preferenceKeys.length}`);

const browser=await launchBrowser();
try{
  const context=await browser.newContext({locale:'zh-CN'});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error?.stack||error?.message||String(error)));

  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({
    sim:`pages-live-preferences-${Date.now()}`,
    qb:anchor.qbVersion,count:'96',scenario:'mixed',seed:'pages-live-preferences',clean:'0'
  }).toString();
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
  await page.locator('#login-btn').click();
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),anchor.qbVersion,{timeout:60000});

  const anchorResponse=await api(page,'app/preferences');
  assert.equal(anchorResponse.status,200,'Virtual qB app/preferences must be readable');
  assert.deepEqual(Object.keys(anchorResponse.json||{}).sort(),[...anchor.preferenceKeys].sort(),`Virtual qB ${anchor.qbVersion} app/preferences must exactly match the official upstream key surface`);

  const advancedExamples=[
    'limit_utp_rate','scheduler_enabled','schedule_from_hour','schedule_to_hour','scheduler_days',
    'checking_memory_use','disk_cache_ttl','disk_io_read_mode','disk_io_write_mode','enable_coalesce_read_write',
    'file_pool_size','memory_working_set_limit'
  ].filter(key=>anchor.preferenceKeys.includes(key));
  for(const key of advancedExamples){
    assert.ok(Object.prototype.hasOwnProperty.call(anchorResponse.json,key),`Virtual qB ${anchor.qbVersion} must expose advanced preference ${key}`);
  }

  const expectedAdvancedKeys=await page.evaluate(prefs=>{
    if(!window.WeiG?.SettingsSchema?.group)throw new Error('WeiG SettingsSchema is unavailable');
    return window.WeiG.SettingsSchema.group('advanced',prefs).flatMap(group=>group.keys).sort();
  },anchorResponse.json);
  assert.ok(expectedAdvancedKeys.length>=20,`WeiG ${anchor.qbVersion} Advanced route unexpectedly small: ${expectedAdvancedKeys.length}`);

  await page.evaluate(async()=>{
    if(!window.WeiG?.SettingsRenderer?.open)throw new Error('WeiG SettingsRenderer is unavailable');
    await window.WeiG.SettingsRenderer.open('advanced');
  });
  await page.waitForFunction(expected=>document.querySelectorAll('#settings-content [data-setting-key]').length>=expected,expectedAdvancedKeys.length,{timeout:30000});
  const renderedKeys=(await page.locator('#settings-content [data-setting-key]').evaluateAll(rows=>rows.map(row=>row.dataset.settingKey))).sort();
  assert.deepEqual(renderedKeys,expectedAdvancedKeys,`WeiG ${anchor.qbVersion} Advanced settings must render every preference routed to Advanced and no stale extras`);
  for(const key of advancedExamples)assert.ok(renderedKeys.includes(key),`WeiG Advanced settings must render upstream preference ${key}`);

  let audited=0;
  let typedAudited=0;
  for(const profile of matrix){
    const sim=`pref-matrix-${profile.qbVersion.replace(/\./g,'-')}-${Date.now()}-${audited}`;
    const query=`sim=${encodeURIComponent(sim)}&qb=${encodeURIComponent(profile.qbVersion)}&count=1&scenario=mixed&seed=pages-live-pref-matrix`;
    let response=await api(page,`auth/login?${query}`,{method:'POST',form:{username:'demo',password:'demo'}});
    assert.equal(response.status,200,`${profile.qbVersion}: virtual daemon login must succeed`);
    response=await api(page,`app/version?sim=${encodeURIComponent(sim)}`);
    assert.equal(response.status,200,`${profile.qbVersion}: app/version must be readable`);
    assert.equal(response.text,`v${profile.qbVersion}`,`${profile.qbVersion}: Service Worker must bind the exact requested qB release`);
    response=await api(page,`app/preferences?sim=${encodeURIComponent(sim)}`);
    assert.equal(response.status,200,`${profile.qbVersion}: app/preferences must be readable`);
    assert.deepEqual(
      Object.keys(response.json||{}).sort(),
      [...profile.preferenceKeys].sort(),
      `${profile.qbVersion}: deployed Virtual qB preference surface must exactly match official upstream`
    );
    for(const descriptor of profile.preferenceDescriptors){
      if(descriptor.sourceConfidence!=='HIGH'||!descriptor.type)continue;
      assert.ok(valueMatchesType(response.json?.[descriptor.key],descriptor.type),`${profile.qbVersion}/${descriptor.key}: deployed preference value type must match upstream setter-derived ${descriptor.type}`);
      typedAudited++;
    }
    audited++;
  }

  assert.equal(audited,matrix.length,'every published qB 4.x/5.x stable release must be live-audited');
  assert.ok(typedAudited>100,'live descriptor type audit unexpectedly small');
  assert.deepEqual(pageErrors,[],`Preference surface session emitted page errors:\n${pageErrors.join('\n')}`);
  await context.close();
}finally{
  await browser.close();
}

console.log(`Virtual qB Pages preference acceptance passed for ${expectedSha}: exact Advanced rendering, ${matrix.length} official stable qB 4.x/5.x preference surfaces, source-derived runtime types and release-evolution metadata.`);

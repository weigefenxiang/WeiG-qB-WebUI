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
assert.equal(site?.preferenceCatalog?.schemaVersion,3,'site metadata must expose Preference Descriptor quality schema v3');
assert.equal(site?.preferenceCatalog?.profiles,matrix.length,'site metadata must publish the same stable preference profile count as qb-releases.json');
assert.ok(Number(site?.preferenceCatalog?.readTyped)>0,'site metadata must expose source-derived getter/read type coverage');
assert.ok(Number(site?.preferenceCatalog?.writeTyped)>0,'site metadata must expose source-derived setter/write type coverage');
assert.ok(Number(site?.preferenceCatalog?.exactAgreement)>0,'site metadata must expose exact getter/setter type agreement coverage');
assert.ok(Number(site?.preferenceCatalog?.semanticGetterEnriched)>0,'site metadata must expose semantic C++ getter enrichment coverage');
assert.equal(Number(site?.preferenceCatalog?.readTyped)+Number(site?.preferenceCatalog?.unresolvedRead),Number(site?.preferenceCatalog?.preferences),'site read type coverage must partition all published Preferences');
assert.equal(Number(site?.preferenceCatalog?.writeTyped)+Number(site?.preferenceCatalog?.unresolvedWrite),Number(site?.preferenceCatalog?.preferences),'site write type coverage must partition all published Preferences');

for(let index=0;index<matrix.length;index++){
  const profile=matrix[index];
  const previous=index>0?matrix[index-1]:null;
  assert.ok(Array.isArray(profile.preferenceKeys)&&profile.preferenceKeys.length>0,`${profile.qbVersion}: upstream preferenceKeys must be published`);
  assert.ok(Array.isArray(profile.preferenceDescriptors),`${profile.qbVersion}: preferenceDescriptors must be published`);
  assert.equal(profile.preferenceDescriptors.length,profile.preferenceKeys.length,`${profile.qbVersion}: descriptor count must exactly match preference key surface`);
  assert.equal(profile.preferenceDescriptorStats?.total,profile.preferenceKeys.length,`${profile.qbVersion}: descriptor stats must match preference surface`);
  assert.equal(profile.preferenceDescriptorStats?.getterPresent,profile.preferenceKeys.length,`${profile.qbVersion}: every app/preferences key must carry getter provenance`);
  assert.equal(profile.preferenceDescriptorStats?.readTyped+profile.preferenceDescriptorStats?.unresolvedRead,profile.preferenceKeys.length,`${profile.qbVersion}: read coverage stats must partition the preference surface`);
  assert.equal(profile.preferenceDescriptorStats?.writeTyped+profile.preferenceDescriptorStats?.unresolvedWrite,profile.preferenceKeys.length,`${profile.qbVersion}: write coverage stats must partition the preference surface`);
  assert.equal(profile.preferenceDescriptorStats?.semanticGetterEnriched,profile.preferenceDescriptors.filter(item=>item.semanticGetterEnriched===true).length,`${profile.qbVersion}: semantic getter coverage count is stale`);
  assert.equal(profile.releaseOrdinal,index,`${profile.qbVersion}: release ordinal must preserve catalog order`);
  assert.deepEqual(profile.preferenceChanges?.added,previous?difference(profile.preferenceKeys,previous.preferenceKeys):[...profile.preferenceKeys].sort(),`${profile.qbVersion}: published added preference diff is stale`);
  assert.deepEqual(profile.preferenceChanges?.removed,previous?difference(previous.preferenceKeys,profile.preferenceKeys):[],`${profile.qbVersion}: published removed preference diff is stale`);
  for(const field of ['readTypeChanged','writeTypeChanged','agreementChanged','fallbackChanged','getterKindChanged','setterKindChanged','semanticGetterChanged']){
    assert.ok(Array.isArray(profile.preferenceChanges?.[field]),`${profile.qbVersion}: published ${field} evolution metadata is missing`);
  }
  for(const descriptor of profile.preferenceDescriptors){
    assert.ok(profile.preferenceKeys.includes(descriptor.key),`${profile.qbVersion}: descriptor ${descriptor.key} escaped upstream surface`);
    assert.equal(descriptor.getterPresent,true,`${profile.qbVersion}/${descriptor.key}: app/preferences key must carry getter provenance`);
    assert.ok(Object.prototype.hasOwnProperty.call(descriptor,'readType'),`${profile.qbVersion}/${descriptor.key}: readType field missing`);
    assert.ok(Object.prototype.hasOwnProperty.call(descriptor,'writeType'),`${profile.qbVersion}/${descriptor.key}: writeType field missing`);
    assert.ok(descriptor.typeAgreement,`${profile.qbVersion}/${descriptor.key}: typeAgreement missing`);
    assert.ok(descriptor.firstSeenInLabCatalog,`${profile.qbVersion}/${descriptor.key}: first-seen provenance missing`);
    assert.ok(descriptor.schemaLastChangedInLabCatalog,`${profile.qbVersion}/${descriptor.key}: schema-change provenance missing`);
    assert.ok(descriptor.readTypeLastChangedInLabCatalog,`${profile.qbVersion}/${descriptor.key}: read-type evolution provenance missing`);
    assert.ok(descriptor.writeTypeLastChangedInLabCatalog,`${profile.qbVersion}/${descriptor.key}: write-type evolution provenance missing`);
    if(descriptor.readType)assert.ok(descriptor.firstReadTypedInLabCatalog,`${profile.qbVersion}/${descriptor.key}: first typed getter version missing`);
    if(descriptor.writeType)assert.ok(descriptor.firstWriteTypedInLabCatalog,`${profile.qbVersion}/${descriptor.key}: first typed setter version missing`);
    if(descriptor.semanticGetterEnriched===true){
      assert.ok(descriptor.readType,`${profile.qbVersion}/${descriptor.key}: semantic getter enrichment must resolve readType`);
      assert.equal(descriptor.getterConfidence,'HIGH',`${profile.qbVersion}/${descriptor.key}: semantic getter enrichment must remain high confidence`);
    }
    if(descriptor.writable){
      assert.ok(descriptor.writeType,`${profile.qbVersion}/${descriptor.key}: writable upstream descriptor must have a high-confidence writeType`);
      assert.ok(descriptor.firstWritableInLabCatalog,`${profile.qbVersion}/${descriptor.key}: writable descriptor first version missing`);
      assert.notEqual(descriptor.typeAgreement,'MISMATCH',`${profile.qbVersion}/${descriptor.key}: getter/setter conflict cannot remain writable`);
    }
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

  const routeExamples={
    speed:[
      'limit_utp_rate','scheduler_enabled','schedule_from_hour','schedule_to_hour','scheduler_days'
    ].filter(key=>anchor.preferenceKeys.includes(key)),
    advanced:[
      'checking_memory_use','disk_cache_ttl','disk_io_read_mode','disk_io_write_mode','enable_coalesce_read_write',
      'file_pool_size','memory_working_set_limit'
    ].filter(key=>anchor.preferenceKeys.includes(key))
  };
  for(const [surface,keys] of Object.entries(routeExamples)){
    for(const key of keys){
      assert.ok(Object.prototype.hasOwnProperty.call(anchorResponse.json,key),`Virtual qB ${anchor.qbVersion} must expose ${surface} preference ${key}`);
    }
  }

  const expectedRouteKeys=await page.evaluate(prefs=>{
    if(!window.WeiG?.SettingsSchema?.group)throw new Error('WeiG SettingsSchema is unavailable');
    return Object.fromEntries(['speed','advanced'].map(surface=>[
      surface,
      window.WeiG.SettingsSchema.group(surface,prefs).flatMap(group=>group.keys).sort()
    ]));
  },anchorResponse.json);
  assert.ok(expectedRouteKeys.advanced.length>=20,`WeiG ${anchor.qbVersion} Advanced route unexpectedly small: ${expectedRouteKeys.advanced.length}`);

  async function assertSettingsSurface(surface,expectedKeys,examples){
    await page.evaluate(async target=>{
      if(!window.WeiG?.SettingsRenderer?.open)throw new Error('WeiG SettingsRenderer is unavailable');
      await window.WeiG.SettingsRenderer.open(target);
    },surface);
    await page.waitForFunction(expected=>{
      const actual=[...document.querySelectorAll('#settings-content [data-setting-key]')]
        .map(row=>row.dataset.settingKey)
        .sort();
      return actual.length===expected.length&&actual.every((key,index)=>key===expected[index]);
    },expectedKeys,{timeout:30000});
    const renderedKeys=(await page.locator('#settings-content [data-setting-key]').evaluateAll(rows=>rows.map(row=>row.dataset.settingKey))).sort();
    assert.deepEqual(renderedKeys,expectedKeys,`WeiG ${anchor.qbVersion} ${surface} settings must render every routed preference and no stale extras`);
    for(const key of examples)assert.ok(renderedKeys.includes(key),`WeiG ${surface} settings must render upstream preference ${key}`);
  }

  await assertSettingsSurface('advanced',expectedRouteKeys.advanced,routeExamples.advanced);
  await assertSettingsSurface('speed',expectedRouteKeys.speed,routeExamples.speed);

  let audited=0;
  let readTypedAudited=0;
  let semanticGetterAudited=0;
  let writeRoundTrips=0;
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
      if(descriptor.getterConfidence!=='HIGH'||!descriptor.readType)continue;
      assert.ok(valueMatchesType(response.json?.[descriptor.key],descriptor.readType),`${profile.qbVersion}/${descriptor.key}: deployed GET value type must match upstream getter-derived ${descriptor.readType}`);
      readTypedAudited++;
      if(descriptor.semanticGetterEnriched===true)semanticGetterAudited++;
    }
    const dlDescriptor=profile.preferenceDescriptors.find(item=>item.key==='dl_limit'&&item.writable&&item.writeType==='number');
    if(dlDescriptor&&typeof response.json?.dl_limit==='number'){
      const before=response.json.dl_limit;
      const written=await api(page,`app/setPreferences?sim=${encodeURIComponent(sim)}`,{method:'POST',form:{json:JSON.stringify({dl_limit:before})}});
      assert.equal(written.status,200,`${profile.qbVersion}: same-value dl_limit write must be accepted through setter-derived number schema`);
      const reread=await api(page,`app/preferences?sim=${encodeURIComponent(sim)}`);
      assert.equal(reread.status,200);
      assert.equal(reread.json?.dl_limit,before,`${profile.qbVersion}: same-value dl_limit round-trip must preserve getter representation`);
      writeRoundTrips++;
    }
    audited++;
  }

  assert.equal(audited,matrix.length,'every published qB 4.x/5.x stable release must be live-audited');
  assert.ok(readTypedAudited>30,'live getter-derived read type audit unexpectedly small');
  assert.ok(semanticGetterAudited>0,'live semantic getter enrichment audit unexpectedly empty');
  assert.ok(writeRoundTrips>30,'live setter-derived write round-trip audit unexpectedly small');
  assert.deepEqual(pageErrors,[],`Preference surface session emitted page errors:\n${pageErrors.join('\n')}`);
  await context.close();
}finally{
  await browser.close();
}

console.log(`Virtual qB Pages preference acceptance passed for ${expectedSha}: exact Speed/Advanced rendering, ${matrix.length} official stable qB 4.x/5.x surfaces, structural + semantic getter read types, setter-derived safe round-trips and schema-evolution metadata.`);

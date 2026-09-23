import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';
import {atLeast} from '../simulator/core/profiles.js';

const rawBase=(process.env.WEIG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
const mode=String(process.env.WEIG_PAGES_PREF_MODE||'all').trim().toLowerCase();
const shardTotal=Math.max(1,Number(process.env.WEIG_PAGES_PREF_SHARD_TOTAL)||1);
const shardIndex=Math.max(0,Number(process.env.WEIG_PAGES_PREF_SHARD_INDEX)||0);
const profileTimeoutMs=Math.max(10000,Number(process.env.WEIG_PAGES_PROFILE_TIMEOUT_MS)||45000);
assert.ok(rawBase,'WEIG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
assert.ok(['all','anchor','shard'].includes(mode),`Unsupported WEIG_PAGES_PREF_MODE ${mode}`);
if(mode==='shard')assert.ok(shardIndex<shardTotal,`Preference shard index ${shardIndex} must be < shard total ${shardTotal}`);

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
    let json=null;try{json=text?JSON.parse(text):null;}catch{}
    return{status:response.status,text:text.trim(),json};
  },{path,method,form});
}
function withTimeout(label,ms,task){
  let timer=null;
  return Promise.race([
    Promise.resolve().then(task),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${ms} ms`)),ms);})
  ]).finally(()=>{if(timer)clearTimeout(timer);});
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
async function setTimeControl(page,control,value){
  const parts=String(value).split(':');assert.equal(parts.length,2,'invalid HH:mm test value');
  for(const [selector,part] of [['.ui-time-control__hour',parts[0]],['.ui-time-control__minute',parts[1]]]){
    const input=control.locator(selector);await input.fill(part);await input.press('Enter');
  }
}

const site=await waitForDeployedSha();
const catalog=await fetchJson('metadata/qb-releases.json');
const matrix=catalog.filter(item=>item?.stable!==false&&/^(?:4|5)\.\d+\.\d+(?:\.\d+)?$/.test(String(item?.qbVersion||'')));
assert.equal(matrix.length,65,`published stable qB 4.x/5.x matrix must contain 65 profiles, got ${matrix.length}`);
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
  const profile=matrix[index],previous=index>0?matrix[index-1]:null;
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
  for(const field of ['readTypeChanged','writeTypeChanged','agreementChanged','fallbackChanged','getterKindChanged','setterKindChanged','semanticGetterChanged'])assert.ok(Array.isArray(profile.preferenceChanges?.[field]),`${profile.qbVersion}: published ${field} evolution metadata is missing`);
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
    if(descriptor.semanticGetterEnriched===true){assert.ok(descriptor.readType,`${profile.qbVersion}/${descriptor.key}: semantic getter enrichment must resolve readType`);assert.equal(descriptor.getterConfidence,'HIGH',`${profile.qbVersion}/${descriptor.key}: semantic getter enrichment must remain high confidence`);}
    if(descriptor.writable){assert.ok(descriptor.writeType,`${profile.qbVersion}/${descriptor.key}: writable upstream descriptor must have a high-confidence writeType`);assert.ok(descriptor.firstWritableInLabCatalog,`${profile.qbVersion}/${descriptor.key}: writable descriptor first version missing`);assert.notEqual(descriptor.typeAgreement,'MISMATCH',`${profile.qbVersion}/${descriptor.key}: getter/setter conflict cannot remain writable`);}
  }
}

const anchor=catalog.find(item=>item.qbVersion==='5.2.3')||matrix.filter(item=>String(item.qbVersion).startsWith('5.')).at(-1);
assert.ok(anchor,'published upstream catalog must contain a qB 5.x anchor');
assert.ok(anchor.preferenceKeys.length>100,`${anchor.qbVersion} upstream preference surface unexpectedly small: ${anchor.preferenceKeys.length}`);

const browser=await launchBrowser();
try{
  // Dedicated preference shards validate WebAPI/source fidelity, not browser-locale bootstrap.
  // Keep anchor/all on zh-CN for qB-owned copy coverage; isolate shard mode on canonical English.
  const bootstrapLocale=mode==='shard'?'en-US':'zh-CN',expectedBootstrapQbLocale=mode==='shard'?'en':'zh_CN';
  const context=await browser.newContext({locale:bootstrapLocale});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error?.stack||error?.message||String(error)));

  async function openBootstrapSession(){
    const url=new URL('dev/app/',base);
    url.search=new URLSearchParams({sim:`pages-live-preferences-${mode}-${shardIndex}-${Date.now()}`,qb:anchor.qbVersion,count:'24',scenario:'mixed',seed:'pages-live-preferences',clean:'0'}).toString();
    await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    await page.locator('#login-btn').click();
    await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),anchor.qbVersion,{timeout:60000});
    await page.waitForFunction(()=>window.WeiG?.SessionController?.readLocaleBootstrap?.()?.initialized===true,null,{timeout:30000});
    await page.waitForTimeout(1800);
    await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),anchor.qbVersion,{timeout:60000});
    await page.waitForFunction(locale=>window.WeiG?.I18n?.getQbLocale?.()===locale,expectedBootstrapQbLocale,{timeout:30000});
  }
  await openBootstrapSession();
  async function openEntitySession(qbVersion,lane,{requireZh=true}={}){
    // This verifier switches between independent Virtual qB sims directly instead
    // of going through Lab. Do not let the previous sim's browser-locale bootstrap
    // record suppress initialization for the next daemon world.
    await page.evaluate(()=>{
      const key=window.WeiG?.StorageKeys?.localeBootstrap||'weig.localeBootstrap';
      localStorage.removeItem(key);
    });
    const url=new URL('dev/app/',base);
    url.search=new URLSearchParams({sim:`pages-live-preferences-${lane}-${shardIndex}-${Date.now()}`,qb:qbVersion,count:'24',scenario:'mixed',seed:'pages-live-preferences-entity',clean:'0'}).toString();
    await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
    await page.locator('#login-btn').click();
    await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),qbVersion,{timeout:60000});
    await page.waitForFunction(version=>window.WeiG?.CapabilityRegistry?.releaseIdentity?.()?.qbVersion===version,qbVersion,{timeout:60000});
    await page.waitForFunction(()=>window.WeiG?.SessionController?.readLocaleBootstrap?.()?.initialized===true,null,{timeout:30000});
    await page.waitForTimeout(1800);
    await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),qbVersion,{timeout:60000});
    if(requireZh)await page.waitForFunction(()=>window.WeiG?.I18n?.getQbLocale?.()==='zh_CN',null,{timeout:30000});
  }
  async function inspectZhOwnedCopy(expectedSource){
    await page.waitForFunction(()=>window.WeiG?.SessionController?.readLocaleBootstrap?.()?.initialized===true,null,{timeout:30000});
    await page.waitForFunction(()=>window.WeiG?.I18n?.getQbLocale?.()==='zh_CN',null,{timeout:30000});
    return page.evaluate(async source=>{
      const I=window.WeiG.I18n,S=window.WeiG.SettingsSchema;
      if(S.loadCompatibility)await S.loadCompatibility();
      await I.ready();
      const refs=[],add=ref=>{if(ref&&ref.source&&ref.context)refs.push(ref);};
      for(const tab of S.nativeSurfaces()){
        const graph=S.controlGraph(tab);
        for(const field of graph?.fieldsets||[]){
          add(field.title);
          for(const item of field.legendControls||[]){add(item.label);add(item.adornment);add(item.suffix);}
        }
        for(const row of graph?.rows||[]){
          add(row.family?.from?.label);add(row.family?.to?.label);
          for(const item of row.items||[]){
            add(item.label);add(item.adornment);add(item.suffix);
            for(const value of item.items||[])add(value);
          }
        }
      }
      const ref=refs.find(item=>String(item.source||'')===String(source));
      return{locale:I.getQbLocale(),options:I.localeOptions().map(item=>item.value),evidence:I.localeInventoryEvidence(),source:ref?.source||null,context:ref?.context||null,resolved:ref?I.qbSourceText(ref,ref.source):null,refCount:refs.length};
    },expectedSource);
  }
  function assertOfficialZhCopy(facts,expectedSource,label){
    assert.equal(facts.locale,'zh_CN',`${label}: qB persisted/runtime locale must be zh_CN`);
    assert.equal(facts.source,expectedSource,`${label}: canonical entity-bearing source ref missing: ${JSON.stringify(facts)}`);
    assert.ok(facts.resolved&&facts.resolved!==facts.source,`${label}: official zh_CN qB-owned copy fell back to English source: ${JSON.stringify(facts)}`);
    assert.doesNotMatch(facts.resolved,/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/i,`${label}: resolved qB-owned copy leaked encoded entity text: ${facts.resolved}`);
  }

  if(mode==='all'||mode==='anchor'){
    const anchorResponse=await api(page,'app/preferences');
    assert.equal(anchorResponse.status,200,'Virtual qB app/preferences must be readable');
    assert.deepEqual(Object.keys(anchorResponse.json||{}).sort(),[...anchor.preferenceKeys].sort(),`Virtual qB ${anchor.qbVersion} app/preferences must exactly match the official upstream key surface`);
    const routeExamples={
      speed:['limit_utp_rate','scheduler_enabled','schedule_from_hour','schedule_to_hour','scheduler_days'].filter(key=>anchor.preferenceKeys.includes(key)),
      advanced:['checking_memory_use','disk_cache_ttl','disk_io_read_mode','disk_io_write_mode','enable_coalesce_read_write','file_pool_size','memory_working_set_limit'].filter(key=>anchor.preferenceKeys.includes(key))
    };
    for(const [surface,keys] of Object.entries(routeExamples))for(const key of keys)assert.ok(Object.prototype.hasOwnProperty.call(anchorResponse.json,key),`Virtual qB ${anchor.qbVersion} must expose ${surface} preference ${key}`);
    const expectedSurfaces=await page.evaluate(async prefs=>{
      const schema=window.WeiG.SettingsSchema;
      if(schema.loadCompatibility)await schema.loadCompatibility();
      function project(surface){const sourceKeys=schema.group(surface,prefs).flatMap(group=>group.keys).sort();return{sourceKeys,controlKeys:[...sourceKeys]};}
      return Object.fromEntries(['speed','advanced'].map(surface=>[surface,project(surface)]));
    },anchorResponse.json);
    assert.ok(expectedSurfaces.advanced.sourceKeys.length>=20,`WeiG ${anchor.qbVersion} Advanced route unexpectedly small: ${expectedSurfaces.advanced.sourceKeys.length}`);
    async function assertSettingsSurface(surface,expected,examples){
      await page.evaluate(async target=>window.WeiG.SettingsRenderer.open(target),surface);
      const renderedKeys=await page.locator('#settings-content').evaluate(root=>{const keys=new Set();root.querySelectorAll('[data-preference-key]').forEach(node=>{const key=String(node.dataset.preferenceKey||'').trim();if(key)keys.add(key);});root.querySelectorAll('[data-setting-key]').forEach(node=>{String(node.dataset.settingKey||'').split(',').map(key=>key.trim()).filter(Boolean).forEach(key=>keys.add(key));});return[...keys].sort();});
      assert.deepEqual(renderedKeys,expected.controlKeys,`WeiG ${anchor.qbVersion} ${surface} settings must render every exact source-native preference control with no stale extras`);
      for(const key of examples){assert.ok(expected.sourceKeys.includes(key),`WeiG ${surface} route must include upstream preference ${key}`);assert.ok(renderedKeys.includes(key),`WeiG ${surface} route must render upstream preference ${key}`);}
    }
    const settingsNav=page.locator('#app-nav [data-route="settings"]');
    assert.equal(await settingsNav.count(),1,'Pages anchor must expose the user-visible Settings navigation target before pointer interaction');
    await settingsNav.click();
    await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active'),null,{timeout:30000});
    await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]',{state:'visible',timeout:30000});
    await assertSettingsSurface('advanced',expectedSurfaces.advanced,routeExamples.advanced);
    await assertSettingsSurface('speed',expectedSurfaces.speed,routeExamples.speed);
    const timeKeys=['schedule_from_hour','schedule_from_min','schedule_to_hour','schedule_to_min'];
    if(timeKeys.every(key=>expectedSurfaces.speed.sourceKeys.includes(key))){
      const row=page.locator('#settings-content .setting-row--time-range[data-native-family="time-range"]');
      assert.equal(await row.count(),1,'canonical scheduler family must render once');
      const inputs=row.locator('[data-ui-time-control="1"]');
      assert.equal(await inputs.count(),2,'canonical scheduler family must render exactly two HH:mm controls');
      const settingKeys=String(await row.getAttribute('data-setting-key')||'').split(',').filter(Boolean).sort();
      assert.deepEqual(settingKeys,[...timeKeys].sort(),'time-range row must retain all four raw Preferences keys for audit/writeback');
      const pad=value=>String(Number(value)).padStart(2,'0');
      const expectedTimes=[pad(anchorResponse.json.schedule_from_hour)+':'+pad(anchorResponse.json.schedule_from_min),pad(anchorResponse.json.schedule_to_hour)+':'+pad(anchorResponse.json.schedule_to_min)];
      const observedTimes=await inputs.evaluateAll(nodes=>nodes.map(node=>node.getValue?node.getValue():''));
      assert.deepEqual(observedTimes,expectedTimes,'HH:mm controls must reconstruct exact raw hour/minute Preferences');
      assert.ok(observedTimes.every(value=>/^\d{2}:\d{2}$/.test(value)),'time controls must expose canonical zero-padded HH:mm values');
      const schedulerControl=page.locator('#settings-content [data-preference-key="scheduler_enabled"] .switch-control');
      const schedulerToggle=schedulerControl.locator('input[type="checkbox"]');
      assert.equal(await schedulerControl.count(),1,'Scheduler visible Switch control must be present for live HH:mm writeback');
      assert.equal(await schedulerToggle.count(),1,'Scheduler native checkbox owner must remain inside the canonical Switch control');
      if(!await schedulerToggle.isChecked()){
        await schedulerControl.click();
        await page.waitForFunction(()=>window.WeiG.SettingsState.draft.scheduler_enabled===true,null,{timeout:30000});
      }
      await page.waitForFunction(()=>[...document.querySelectorAll('#settings-content [data-native-family="time-range"] [data-ui-time-control="1"]')].every(control=>control.getAttribute('aria-disabled')!=='true'&&control.getAttribute('aria-readonly')!=='true'),null,{timeout:30000});
      await setTimeControl(page,inputs.nth(0),'09:15');
      await setTimeControl(page,inputs.nth(1),'21:45');
      await page.waitForFunction(()=>{const d=window.WeiG.SettingsState.draft||{};return d.schedule_from_hour===9&&d.schedule_from_min===15&&d.schedule_to_hour===21&&d.schedule_to_min===45;},null,{timeout:30000});
      await page.locator('#save-settings-btn').click();
      await page.waitForFunction(()=>Object.keys(window.WeiG.SettingsState.draft||{}).length===0,null,{timeout:30000});
      const scheduleReread=await api(page,'app/preferences');
      assert.equal(scheduleReread.status,200,'Scheduler HH:mm writeback must be followed by readable app/preferences');
      assert.equal(scheduleReread.json?.scheduler_enabled,true,'Scheduler enable state must persist with HH:mm writeback');
      assert.deepEqual(timeKeys.map(key=>scheduleReread.json?.[key]),[9,15,21,45],'Scheduler HH:mm save must round-trip all four raw Preferences through Virtual qB');
    }

    const latestCopy=await inspectZhOwnedCopy('Coalesce reads & writes:');
    assert.ok(latestCopy.options.length>1&&latestCopy.options.includes('en')&&latestCopy.options.includes('zh_CN'),`Locale option owner collapsed to current-only: ${JSON.stringify(latestCopy)}`);
    assert.ok(Number(latestCopy.evidence?.sourceCount)>1&&latestCopy.evidence?.selectedOwner!=='current-only',`Locale inventory trust resolver did not preserve source baseline: ${JSON.stringify(latestCopy.evidence)}`);
    assertOfficialZhCopy(latestCopy,'Coalesce reads & writes:','qB 5.2.3 entity copy');

    // Real 0.3.156 human regression: qB 4.6.7 Behavior Locale visibly collapsed to zh_CN.
    // Validate the actual rendered Select menu, not only the internal provider array.
    assert.ok(matrix.some(profile=>profile.qbVersion==='4.6.7'),'qB 4.6.7 locale regression seed must remain admitted');
    await openEntitySession('4.6.7','locale-options-4-6-7');
    await page.evaluate(()=>window.WeiG.Router.go('settings'));
    await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active'),null,{timeout:30000});
    await page.evaluate(async()=>window.WeiG.SettingsRenderer.open('behavior'));
    const behaviorLocale=page.locator('#settings-content [data-preference-key="locale"] .ui-select__trigger').first();
    await behaviorLocale.waitFor({state:'visible',timeout:30000});
    const localeProvider=await page.evaluate(()=>({
      state:window.WeiG.SettingsOptionProviders?.state?.('locale')||null,
      values:(window.WeiG.SettingsOptionProviders?.get?.('locale')||[]).map(item=>String(item.value))
    }));
    assert.equal(localeProvider.state?.ready,true,`qB 4.6.7 locale provider must be READY before Behavior renders: ${JSON.stringify(localeProvider.state)}`);
    assert.ok(localeProvider.values.length>1&&localeProvider.values.includes('en')&&localeProvider.values.includes('zh_CN'),`qB 4.6.7 canonical locale provider collapsed to current-only: ${JSON.stringify(localeProvider)}`);
    await behaviorLocale.click();
    const visibleLocaleOptions=page.locator('#weig-floating-layer .ui-select__menu:not([hidden]) .ui-select__option');
    await visibleLocaleOptions.first().waitFor({state:'visible',timeout:30000});
    const renderedLocaleValues=await visibleLocaleOptions.evaluateAll(nodes=>nodes.map(node=>String(node.dataset.value||'')));
    assert.deepEqual(renderedLocaleValues,localeProvider.values,'qB 4.6.7 Behavior Locale menu must render the complete canonical provider inventory in source order');
    assert.ok(renderedLocaleValues.length>1,'qB 4.6.7 Behavior Locale must never render only zh_CN');
    assert.ok(renderedLocaleValues.includes('zh_TW'),'qB 4.6.7 canonical locale inventory must include Traditional Chinese');
    const zhTwOption=page.locator('#weig-floating-layer .ui-select__menu:not([hidden]) .ui-select__option[data-value="zh_TW"]');
    await zhTwOption.waitFor({state:'visible',timeout:30000});
    await zhTwOption.click();
    await page.waitForFunction(()=>window.WeiG?.SettingsState?.draft?.locale==='zh_TW',null,{timeout:30000});
    const localeReload=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
    await page.locator('#save-settings-btn').click();
    await localeReload;
    await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),'4.6.7',{timeout:60000});
    await page.waitForFunction(()=>window.WeiG?.I18n?.getQbLocale?.()==='zh_TW',null,{timeout:30000});
    const zhTwPrefs=await api(page,'app/preferences');
    assert.equal(zhTwPrefs.status,200,'qB 4.6.7 zh_TW Settings transition must keep app/preferences readable');
    assert.equal(zhTwPrefs.json?.locale,'zh_TW','qB 4.6.7 Traditional Chinese must persist through the canonical Settings transaction');
    await page.evaluate(()=>window.WeiG.Router.go('settings'));
    await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active'),null,{timeout:30000});
    await page.evaluate(async()=>window.WeiG.SettingsRenderer.open('speed'));
    const zhTwSidebar=await page.evaluate(()=>{
      const S=window.WeiG.SettingsSchema,I=window.WeiG.I18n;
      return [...document.querySelectorAll('#settings-qb-tabs [data-settings-tab]')].map(node=>{
        const tab=String(node.dataset.settingsTab||''),ref=S.tabTitleRef?.(tab)||null;
        return{tab,dom:String(node.textContent||'').trim(),source:String(ref?.source||''),context:String(ref?.context||''),resolved:String(I.qbText('settings.tab.'+tab,ref?I.qbSourceText(ref,ref.source||tab):''))};
      });
    });
    assert.ok(zhTwSidebar.length>1,'qB 4.6.7 zh_TW native Settings sidebar must render the exact source-native tab set');
    for(const item of zhTwSidebar){
      assert.equal(item.dom,item.resolved,`qB 4.6.7 zh_TW sidebar ${item.tab} must render canonical exact source/native copy: ${JSON.stringify(item)}`);
      assert.doesNotMatch(item.dom,/^settings\./i,`qB 4.6.7 zh_TW sidebar leaked internal key: ${JSON.stringify(item)}`);
    }
    const speedSidebar=zhTwSidebar.find(item=>item.tab==='speed');
    assert.equal(speedSidebar?.source,'Speed','qB 4.6.7 Speed sidebar source identity must remain upstream-native');
    assert.equal(speedSidebar?.context,'OptionsDialog','qB 4.6.7 Speed sidebar context identity must remain upstream-native');
    assert.ok(speedSidebar?.dom&&speedSidebar.dom!=='Speed'&&speedSidebar.dom!=='settings.speed',`qB 4.6.7 zh_TW Speed sidebar must resolve an official Traditional Chinese native label: ${JSON.stringify(speedSidebar)}`);
    await page.evaluate(async()=>window.WeiG.SettingsRenderer.open('behavior'));
    const hkLocale=page.locator('#settings-content [data-preference-key="locale"] .ui-select__trigger').first();
    await hkLocale.click();
    const hkOption=page.locator('#weig-floating-layer .ui-select__menu:not([hidden]) .ui-select__option[data-value="zh_HK"]');
    await hkOption.waitFor({state:'visible',timeout:30000});
    await hkOption.click();
    await page.waitForFunction(()=>window.WeiG?.SettingsState?.draft?.locale==='zh_HK',null,{timeout:30000});
    const hkReload=page.waitForNavigation({waitUntil:'domcontentloaded',timeout:30000}).catch(()=>null);
    await page.locator('#save-settings-btn').click();
    await hkReload;
    await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),'4.6.7',{timeout:60000});
    await page.waitForFunction(()=>window.WeiG?.I18n?.getQbLocale?.()==='zh_HK'&&window.WeiG?.I18n?.getLocale?.()==='zh-HK',null,{timeout:30000});
    const hkPrefs=await api(page,'app/preferences');
    assert.equal(hkPrefs.json?.locale,'zh_HK','qB 4.6.7 Hong Kong Traditional Chinese must persist as zh_HK, not collapse to zh_TW');
    await page.evaluate(()=>window.WeiG.Router.go('settings'));
    await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active'),null,{timeout:30000});
    await page.evaluate(async()=>window.WeiG.SettingsRenderer.open('speed'));
    const hkSidebar=await page.evaluate(()=>{
      const S=window.WeiG.SettingsSchema,I=window.WeiG.I18n;
      return [...document.querySelectorAll('#settings-qb-tabs [data-settings-tab]')].map(node=>{
        const tab=String(node.dataset.settingsTab||''),ref=S.tabTitleRef?.(tab)||null;
        return{tab,dom:String(node.textContent||'').trim(),source:String(ref?.source||''),context:String(ref?.context||''),resolved:String(I.qbText('settings.tab.'+tab,ref?I.qbSourceText(ref,ref.source||tab):''))};
      });
    });
    assert.ok(hkSidebar.length>1,'qB 4.6.7 zh_HK native Settings sidebar must render the exact source-native tab set');
    for(const item of hkSidebar){
      assert.equal(item.dom,item.resolved,`qB 4.6.7 zh_HK sidebar ${item.tab} must remain canonical exact source/native copy: ${JSON.stringify(item)}`);
      assert.doesNotMatch(item.dom,/^settings\./i,`qB 4.6.7 zh_HK sidebar leaked internal key: ${JSON.stringify(item)}`);
    }
    const hkSpeed=hkSidebar.find(item=>item.tab==='speed');
    assert.equal(hkSpeed?.source,'Speed','qB 4.6.7 zh_HK Speed source identity must remain upstream-native');
    assert.equal(hkSpeed?.context,'OptionsDialog','qB 4.6.7 zh_HK Speed context identity must remain upstream-native');
    assert.ok(hkSpeed?.dom&&hkSpeed.dom!=='Speed'&&hkSpeed.dom!=='settings.speed',`qB 4.6.7 zh_HK Speed must resolve official Hong Kong native copy: ${JSON.stringify(hkSpeed)}`);
    await page.evaluate(async()=>window.WeiG.SettingsRenderer.open('weigg'));
    const weigHeadings=await page.locator('#settings-content .settings-section__header h2').allTextContents();
    assert.ok(weigHeadings.includes('介面')&&weigHeadings.includes('效能'),`qB 4.6.7 zh_HK WeiG Interface/Performance must be localized: ${JSON.stringify(weigHeadings)}`);

    // Real 0.3.158 human regression: qB 4.1.9.1 Alternate WebUI was visibly ON
    // but could not be toggled OFF. Exercise the rendered Switch, draft, Save
    // transaction and qB preference reread instead of asserting implementation text.
    assert.ok(matrix.some(profile=>profile.qbVersion==='4.1.9.1'),'qB 4.1.9.1 Alternate WebUI regression seed must remain admitted');
    await openEntitySession('4.1.9.1','alternate-webui-off-4-1-9-1',{requireZh:false});
    await page.evaluate(()=>window.WeiG.Router.go('settings'));
    await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active'),null,{timeout:30000});
    await page.evaluate(async()=>window.WeiG.SettingsRenderer.open('webui'));
    const alternateRow=page.locator('#settings-content [data-preference-key="alternative_webui_enabled"]').first();
    await alternateRow.waitFor({state:'visible',timeout:30000});
    const alternateToggle=alternateRow.locator('input.switch-input');
    assert.equal(await alternateToggle.count(),1,'qB 4.1.9.1 Alternate WebUI must render one canonical Switch input');
    assert.equal(await alternateToggle.isChecked(),true,'qB 4.1.9.1 Alternate WebUI regression must begin ON');
    assert.equal(await alternateToggle.isDisabled(),false,'self-affecting Alternate WebUI transition must remain interactable before the OFF draft exists');
    await alternateToggle.click();
    await page.waitForFunction(()=>window.WeiG.SettingsState?.draft?.alternative_webui_enabled===false,null,{timeout:30000});
    assert.equal(await alternateToggle.isChecked(),false,'Alternate WebUI Switch must visibly stay OFF after forming the draft');
    page.once('dialog',dialog=>dialog.accept());
    await page.locator('#save-settings-btn').click();
    await page.waitForTimeout(1200);
    await page.waitForSelector('#torrent-list',{state:'attached',timeout:30000});
    const alternateReread=await api(page,'app/preferences');
    assert.equal(alternateReread.status,200,'Alternate WebUI OFF must leave app/preferences readable after the handoff');
    assert.equal(alternateReread.json?.alternative_webui_enabled,false,'qB 4.1.9.1 Alternate WebUI OFF must persist through the real Settings transaction');

    for(const seed of [
      {version:'4.6.0',source:'Coalesce reads & writes (requires libtorrent < 2.0):'},
      {version:'4.6.1',source:'I2P inbound quantity (requires libtorrent >= 2.0):'}
    ]){
      assert.ok(matrix.some(profile=>profile.qbVersion===seed.version),`Historical entity seed ${seed.version} is not admitted`);
      await openEntitySession(seed.version,`entity-${seed.version.replace(/\./g,'-')}`);
      const facts=await inspectZhOwnedCopy(seed.source);
      assertOfficialZhCopy(facts,seed.source,`qB ${seed.version} historical entity copy`);
    }
    console.log(`Preference anchor PASS: qB ${anchor.qbVersion} exact preference surface + source-native rendering + live HH:mm four-key writeback + complete Locale owner + current/historical zh_CN entity-bearing qB copy.`);
  }

  if(mode==='all'||mode==='shard'){
    const selected=mode==='all'?matrix:matrix.filter((_profile,index)=>index%shardTotal===shardIndex);
    assert.ok(selected.length>0,`Preference shard ${shardIndex}/${shardTotal} selected no profiles`);
    let audited=0,readTypedAudited=0,semanticGetterAudited=0,writeRoundTrips=0;
    for(const profile of selected){
      await withTimeout(`qB ${profile.qbVersion} preference audit`,profileTimeoutMs,async()=>{
        console.log(`START qB ${profile.qbVersion} preference audit (shard ${shardIndex}/${shardTotal})`);
        const sim=`pref-matrix-${profile.qbVersion.replace(/\./g,'-')}-${shardIndex}-${Date.now()}-${audited}`;
        const query=`sim=${encodeURIComponent(sim)}&qb=${encodeURIComponent(profile.qbVersion)}&count=1&scenario=mixed&seed=pages-live-pref-matrix`;
        let response=await api(page,`auth/login?${query}`,{method:'POST',form:{username:'weigshare',password:'weigshare'}});
        const expectedLoginStatus=atLeast(profile.webApiVersion,'2.14.0')?204:200;
        assert.equal(response.status,expectedLoginStatus,`${profile.qbVersion}: virtual daemon login must match WebAPI ${profile.webApiVersion} success status`);
        response=await api(page,`app/version?sim=${encodeURIComponent(sim)}`);
        assert.equal(response.status,200,`${profile.qbVersion}: app/version must be readable`);
        assert.equal(response.text,`v${profile.qbVersion}`,`${profile.qbVersion}: Service Worker must bind the exact requested qB release`);
        response=await api(page,`app/preferences?sim=${encodeURIComponent(sim)}`);
        assert.equal(response.status,200,`${profile.qbVersion}: app/preferences must be readable`);
        assert.deepEqual(Object.keys(response.json||{}).sort(),[...profile.preferenceKeys].sort(),`${profile.qbVersion}: deployed Virtual qB preference surface must exactly match official upstream`);
        for(const descriptor of profile.preferenceDescriptors){
          if(descriptor.getterConfidence!=='HIGH'||!descriptor.readType)continue;
          assert.ok(valueMatchesType(response.json?.[descriptor.key],descriptor.readType),`${profile.qbVersion}/${descriptor.key}: deployed GET value type must match upstream getter-derived ${descriptor.readType}`);
          readTypedAudited++;if(descriptor.semanticGetterEnriched===true)semanticGetterAudited++;
        }
        const dlDescriptor=profile.preferenceDescriptors.find(item=>item.key==='dl_limit'&&item.writable&&item.writeType==='number');
        if(dlDescriptor&&typeof response.json?.dl_limit==='number'){
          const before=response.json.dl_limit;
          const written=await api(page,`app/setPreferences?sim=${encodeURIComponent(sim)}`,{method:'POST',form:{json:JSON.stringify({dl_limit:before})}});
          assert.equal(written.status,200,`${profile.qbVersion}: same-value dl_limit write must be accepted through setter-derived number schema`);
          const reread=await api(page,`app/preferences?sim=${encodeURIComponent(sim)}`);
          assert.equal(reread.status,200);assert.equal(reread.json?.dl_limit,before,`${profile.qbVersion}: same-value dl_limit round-trip must preserve getter representation`);writeRoundTrips++;
        }
        audited++;
        console.log(`PASS qB ${profile.qbVersion} preference audit`);
      });
    }
    assert.equal(audited,selected.length,`preference shard ${shardIndex}/${shardTotal} must audit every assigned profile`);
    assert.ok(readTypedAudited>0,'live getter-derived read type audit unexpectedly empty');
    if(mode==='all'){
      assert.ok(readTypedAudited>30,'live getter-derived read type audit unexpectedly small');
      assert.ok(semanticGetterAudited>0,'live semantic getter enrichment audit unexpectedly empty');
      assert.ok(writeRoundTrips>30,'live setter-derived write round-trip audit unexpectedly small');
    }
    console.log(`Preference shard ${shardIndex}/${shardTotal} PASS: ${audited} profiles, ${readTypedAudited} typed reads, ${semanticGetterAudited} semantic getters, ${writeRoundTrips} safe write round-trips.`);
  }

  assert.deepEqual(pageErrors,[],`Preference surface session emitted page errors:\n${pageErrors.join('\n')}`);
  await context.close();
}finally{
  await browser.close();
}

console.log(`Virtual qB Pages preference acceptance passed for ${expectedSha}: mode=${mode}, shard=${shardIndex}/${shardTotal}.`);

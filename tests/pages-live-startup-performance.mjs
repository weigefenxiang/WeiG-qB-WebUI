import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';
import {recoverPageSession} from './pages-live-session.mjs';

const rawBase=(process.env.WEIG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIG_EXPECTED_SIMULATOR_SHA or argv[3] is required');

const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeoutMs=Math.max(5000,Number(process.env.WEIG_PAGES_SESSION_TIMEOUT_MS||20000)||20000);

async function fetchText(relative){
  const url=new URL(String(relative).replace(/^\/+/,''),base);
  url.searchParams.set('__startup_sha',expectedSha);
  const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}
async function fetchJson(relative){return JSON.parse(await fetchText(relative));}
async function waitForSha(){
  let last='';
  for(let attempt=0;attempt<40;attempt++){
    try{
      const site=await fetchJson('metadata/site.json');
      last=String(site?.simulatorSha||'');
      if(last===expectedSha)return site;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages startup-performance verifier could not observe ${expectedSha}; last=${last}`);
}

const site=await waitForSha();
assert.equal(site.branches?.dev?.exactSha,expectedSha,'startup-performance gate must run against the exact deployed dev snapshot');

const [catalog,manifest,profile]=await Promise.all([
  fetchJson('dev/app/__simulator/versions/catalog.generated.json'),
  fetchJson('dev/app/__simulator/runtime/manifest.json'),
  fetchJson('dev/app/__simulator/runtime/profiles/5.2.3.json')
]);
const catalogProfile=catalog.find(item=>String(item?.qbVersion||'')==='5.2.3');
const copyProfile=await fetchJson('dev/app/__source/private/data/qb-copy-profiles/'+catalogProfile.sourceSha+'.json');
const copyBinding=await fetchText('dev/app/__source/private/data/qb-copy-bindings/'+copyProfile.bindingId+'.txt');
assert.ok(catalogProfile,'deployed full evidence catalog must retain qB 5.2.3');
assert.equal(profile.qbVersion,'5.2.3');
assert.equal(profile.sourceSha,catalogProfile.sourceSha,'profile shard must preserve exact qB source identity');
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.profiles?.length,catalog.length,'runtime profile shard manifest must cover every admitted simulator profile');
assert.equal(manifest.copyRuntime,'product-source/qb-copy-profiles+bindings+fallback');assert.equal(copyProfile.sourceSha,catalogProfile.sourceSha);assert.ok(/^b[0-9a-f]{20}$/.test(copyProfile.bindingId));assert.ok(copyBinding.includes('@@BINDING\\t'+copyProfile.bindingId));
assert.ok(Buffer.byteLength(copyBinding,'utf8')<512*1024,'deduplicated qB binding shard must stay bounded');
assert.equal(copyProfile.sourceSha,catalogProfile.sourceSha,'copy profile must preserve exact qB source identity');

const browser=await launchBrowser();
try{
  const context=await browser.newContext({locale:'zh-CN'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  const session=`a38-startup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({sim:session,qb:'5.2.3',count:'120',scenario:'mixed',seed:'a38-startup',clean:'0'}).toString();

  await recoverPageSession(page,{
    label:'A38 Virtual startup performance',
    qbVersion:'5.2.3',
    timeoutMs,
    navigate:async attempt=>{
      const target=new URL(url);target.searchParams.set('__weig_session_attempt',String(attempt));
      await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs});
    },
    onLogin:async()=>{await page.locator('#login-btn').click();}
  });

  const runtimeCopy=await page.evaluate(async()=>{const value=await window.WeiG?.I18n?.loadQbOwnedCopy?.();return value?{sourceSha:value.sourceSha,qbVersion:value.qbVersion,mode:value.mode}:null;});
  assert.ok(runtimeCopy&&runtimeCopy.sourceSha===catalogProfile.sourceSha&&runtimeCopy.qbVersion==='5.2.3');
  assert.equal(runtimeCopy.mode,'fallback','5.2.3 zh-CN must use the exact official fallback shard when the shared root QM is not exact-source compatible');

  const firstCache=await page.evaluate(async sha=>{
    const name='weig-virtual-static-'+sha,keys=await caches.keys(),cache=await caches.open(name),urls=(await cache.keys()).map(request=>request.url);
    return{keys,urls};
  },expectedSha);
  assert.deepEqual(firstCache.keys.filter(key=>key.startsWith('weig-virtual-static-')),[`weig-virtual-static-${expectedSha}`],'fresh browser context must keep only the exact-SHA immutable Virtual cache');
  assert.ok(firstCache.urls.every(url=>new URL(url).searchParams.get('v')===expectedSha),'every immutable Virtual cache entry must be exact-SHA keyed');
  assert.equal(firstCache.urls.some(url=>url.includes('/__simulator/versions/catalog.generated.json')),false,'normal qB 5.2.3 startup must not cache/fetch the full multi-release catalog fallback');
  assert.equal(firstCache.urls.some(url=>url.includes('/__source/private/data/qb-copy-fallback/4/')),false,'normal qB 5.2.3 startup must not cache/fetch qB 4.x fallback payload');
  const firstFallback=firstCache.urls.filter(url=>url.includes('/__source/private/data/qb-copy-fallback/5/'));
  assert.deepEqual(firstFallback.map(url=>new URL(url).pathname).filter(path=>path.endsWith('/zh_CN.json')).length,[1].length,'qB 5.2.3 zh-CN must fetch its one exact current-major/current-locale fallback shard');
  assert.equal(firstFallback.length,1,'qB 5.2.3 zh-CN startup must not fetch other qB 5.x locale fallback shards');
  const firstWeiGLocales=firstCache.urls.filter(url=>url.includes('/__source/private/data/weig-i18n/'));
  assert.equal(firstWeiGLocales.length,1,'startup must fetch exactly one non-English WeiG locale shard');
  assert.ok(firstWeiGLocales[0].includes('/weig-i18n/zh-CN.json'),'qB persisted zh-CN must select the matching WeiG zh-CN overlay only');
  assert.equal(firstCache.urls.some(url=>url.includes('/__source/private/data/qb-settings-native.txt')),false,'startup must never fetch the retired all-version qB copy registry');
  assert.equal(firstCache.urls.some(url=>/\/__source\/translations\/webui_.+\.qm(?:\?|$)/i.test(url)),false,'browser startup must not download or parse qB QM assets');
  for(const module of ['settings','rss','logs'])assert.equal(firstCache.urls.some(url=>url.includes('/__source/private/scripts/'+module+'.js')),false,'home startup must not fetch route-only '+module+'.js');

  const firstCount=firstCache.urls.length;
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});
  const secondCache=await page.evaluate(async sha=>{
    const name='weig-virtual-static-'+sha,keys=await caches.keys(),cache=await caches.open(name),urls=(await cache.keys()).map(request=>request.url);
    return{keys,urls};
  },expectedSha);
  assert.ok(secondCache.urls.length>=firstCount,'reload must reuse the existing exact-SHA cache rather than replacing it with a new build cache');
  assert.deepEqual(secondCache.keys.filter(key=>key.startsWith('weig-virtual-static-')),[`weig-virtual-static-${expectedSha}`],'reload must preserve one exact-SHA Virtual cache owner');
  assert.equal(secondCache.urls.some(url=>url.includes('/__simulator/versions/catalog.generated.json')),false,'reload must not fall back to the full catalog');
  assert.equal(secondCache.urls.some(url=>url.includes('/__source/private/data/qb-copy-fallback/4/')),false,'reload must not fetch qB 4.x fallback payload');
  assert.equal(secondCache.urls.filter(url=>url.includes('/__source/private/data/qb-copy-fallback/5/')).length,1,'reload must retain only the one current qB 5.x locale fallback shard');
  assert.equal(secondCache.urls.filter(url=>url.includes('/__source/private/data/weig-i18n/')).length,1,'reload must retain only the one current WeiG locale shard');
  for(const module of ['settings','rss','logs'])assert.equal(secondCache.urls.some(url=>url.includes('/__source/private/scripts/'+module+'.js')),false,'warm home reload must not prefetch route-only '+module+'.js');
  assert.deepEqual(errors,[],`startup-performance session emitted page errors:\n${errors.join('\n')}`);
  await context.close();

  console.log(`A62 Pages startup performance passed for ${expectedSha}: exact qB profile ${copyProfile.sourceSha}, binding ${copyProfile.bindingId}, current qB fallback locale and current WeiG locale are bounded and reused without 4.x/non-current locale payloads.`);
}finally{
  await browser.close();
}

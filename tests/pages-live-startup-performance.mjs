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

const [catalog,manifest,profile,fullRegistry,copyShard]=await Promise.all([
  fetchJson('dev/app/__simulator/versions/catalog.generated.json'),
  fetchJson('dev/app/__simulator/runtime/manifest.json'),
  fetchJson('dev/app/__simulator/runtime/profiles/5.2.3.json'),
  fetchText('dev/app/__source/private/data/qb-settings-native.txt'),
  fetchText('dev/app/__simulator/runtime/copy/5.2.3.txt')
]);
const catalogProfile=catalog.find(item=>String(item?.qbVersion||'')==='5.2.3');
assert.ok(catalogProfile,'deployed full evidence catalog must retain qB 5.2.3');
assert.equal(profile.qbVersion,'5.2.3');
assert.equal(profile.sourceSha,catalogProfile.sourceSha,'profile shard must preserve exact qB source identity');
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.profiles?.length,catalog.length,'runtime profile shard manifest must cover every admitted simulator profile');
assert.equal(manifest.copyProfiles?.length,catalog.length,'runtime copy shard manifest must cover every admitted simulator profile');
assert.ok(Buffer.byteLength(copyShard,'utf8')<2*1024*1024,'qB 5.2.3 runtime copy shard must stay below 2 MiB');
assert.ok(Buffer.byteLength(copyShard,'utf8')<Buffer.byteLength(fullRegistry,'utf8')*.45,'selected qB copy shard must materially reduce the full registry payload');
assert.equal((copyShard.match(/^@@PROFILE\t/gm)||[]).length,1,'selected runtime copy shard must contain exactly one qB profile');
assert.ok(copyShard.includes(`@@PROFILE\t${catalogProfile.sourceSha}\t5.2.3\t`),'selected runtime copy shard must bind to exact source SHA');

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

  const runtimeCopy=await page.evaluate(async()=>{
    const response=await fetch('data/qb-settings-native.txt',{cache:'no-store'});
    return{status:response.status,text:await response.text()};
  });
  assert.equal(runtimeCopy.status,200,'app-level qB copy request must succeed through the Service Worker');
  assert.equal((runtimeCopy.text.match(/^@@PROFILE\t/gm)||[]).length,1,'app-level qB copy request must receive the selected profile shard, not the full registry');
  assert.ok(runtimeCopy.text.includes(`@@PROFILE\t${catalogProfile.sourceSha}\t5.2.3\t`),'app-level qB copy request must receive the exact qB 5.2.3 shard');
  assert.ok(Buffer.byteLength(runtimeCopy.text,'utf8')<Buffer.byteLength(fullRegistry,'utf8')*.45,'app-level qB copy response must remain materially smaller than the deployed full evidence registry');

  await page.waitForFunction(async sha=>{
    const name='weig-virtual-static-'+sha,keys=await caches.keys();
    if(!keys.includes(name))return false;
    const cache=await caches.open(name),urls=(await cache.keys()).map(request=>request.url);
    return urls.some(url=>url.includes('/__simulator/runtime/profiles/5.2.3.json'))&&
      urls.some(url=>url.includes('/__simulator/runtime/copy/5.2.3.txt'))&&
      urls.some(url=>url.includes('/__source/private/scripts/app.js'))&&
      urls.some(url=>url.includes('/__source/private/scripts/i18n.js'));
  },expectedSha,{timeout:20000});

  const firstCache=await page.evaluate(async sha=>{
    const name='weig-virtual-static-'+sha,keys=await caches.keys(),cache=await caches.open(name),urls=(await cache.keys()).map(request=>request.url);
    return{keys,urls};
  },expectedSha);
  assert.deepEqual(firstCache.keys.filter(key=>key.startsWith('weig-virtual-static-')),[`weig-virtual-static-${expectedSha}`],'fresh browser context must keep only the exact-SHA immutable Virtual cache');
  assert.ok(firstCache.urls.every(url=>new URL(url).searchParams.get('v')===expectedSha),'every immutable Virtual cache entry must be exact-SHA keyed');
  assert.equal(firstCache.urls.some(url=>url.includes('/__simulator/versions/catalog.generated.json')),false,'normal qB 5.2.3 startup must not cache/fetch the full multi-release catalog fallback');
  assert.equal(firstCache.urls.some(url=>url.includes('/__source/private/data/qb-settings-native.txt')),false,'normal qB 5.2.3 startup must not cache/fetch the full multi-profile qB copy registry');

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
  assert.equal(secondCache.urls.some(url=>url.includes('/__source/private/data/qb-settings-native.txt')),false,'reload must not fall back to the full registry');
  assert.deepEqual(errors,[],`startup-performance session emitted page errors:\n${errors.join('\n')}`);
  await context.close();

  console.log(`A38 Pages startup performance passed for ${expectedSha}: full copy registry ${Buffer.byteLength(fullRegistry,'utf8')} bytes -> qB 5.2.3 shard ${Buffer.byteLength(copyShard,'utf8')} bytes; exact-SHA cache reused across reload without full catalog/registry cold-path fallback.`);
}finally{
  await browser.close();
}

import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {launchBrowser} from './browser-driver.mjs';
import {recoverPageSession} from './pages-live-session.mjs';

const rawBase=(process.env.WEIG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIG_EXPECTED_SIMULATOR_SHA or argv[3] is required');

const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeoutMs=Math.max(5000,Number(process.env.WEIG_PAGES_SESSION_TIMEOUT_MS||20000)||20000);
const retiredCopyRegistry=['qb-settings','native.txt'].join('-');

async function fetchBytes(relative){
  const url=new URL(String(relative).replace(/^\/+/,''),base);
  url.searchParams.set('__startup_sha',expectedSha);
  const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function fetchText(relative){return (await fetchBytes(relative)).toString('utf8');}
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

const [catalog,manifest,profile,capabilities,bootstrapPlan]=await Promise.all([
  fetchJson('dev/app/__simulator/versions/catalog.generated.json'),
  fetchJson('dev/app/__simulator/runtime/manifest.json'),
  fetchJson('dev/app/__simulator/runtime/profiles/5.2.3.json'),
  fetchJson('dev/app/__source/private/data/capabilities.json'),
  fetchJson('dev/app/__source/private/bootstrap-plan.json')
]);
const catalogProfile=catalog.find(item=>String(item?.qbVersion||'')==='5.2.3');
assert.ok(catalogProfile,'deployed full evidence catalog must retain qB 5.2.3');
const copyRelease=(capabilities.releases||[]).find(item=>String(item?.sourceSha||'')===String(catalogProfile.sourceSha||''));
assert.ok(copyRelease&&copyRelease.qbVersion==='5.2.3'&&/^r[0-9a-f]{20}$/.test(String(copyRelease.copyRouteId||'')),'deployed capabilities must bind exact qB 5.2.3 provenance to one semantic copy route');
const copyRoute=JSON.parse(gunzipSync(await fetchBytes('dev/app/__source/private/data/qb-copy-routes/'+copyRelease.copyRouteId+'.json.gz')).toString('utf8'));
const copyBinding=await fetchText('dev/app/__source/private/data/qb-copy-bindings/'+copyRoute.bindingId+'.txt');
assert.equal(profile.qbVersion,'5.2.3');
assert.equal(profile.sourceSha,catalogProfile.sourceSha,'profile shard must preserve exact qB source identity');
assert.equal(manifest.schemaVersion,1);
assert.equal(manifest.profiles?.length,catalog.length,'runtime profile shard manifest must cover every admitted simulator profile');
assert.equal(manifest.copyRuntime,'product-source/qb-copy-routes+bindings+fallback');assert.equal(copyRoute.routeId,copyRelease.copyRouteId);assert.equal(copyRoute.schemaVersion,2);assert.ok(/^b[0-9a-f]{20}$/.test(copyRoute.bindingId));assert.ok(copyBinding.includes('@@BINDING\t'+copyRoute.bindingId));
assert.ok(Buffer.byteLength(copyBinding,'utf8')<512*1024,'deduplicated qB binding shard must stay bounded');
assert.equal(bootstrapPlan.schemaVersion,1,'deployed private bootstrap plan schema drifted');
assert.ok(bootstrapPlan.styles.length>=2&&bootstrapPlan.styles.length<=5,'deployed bootstrap plan must use bounded CSS bundles');
assert.ok(bootstrapPlan.styles.every(name=>/^css\/startup-[0-9]+\.css$/.test(name)),'deployed CSS must come from the canonical materializer');
const bootstrapScripts=bootstrapPlan.phases.flatMap(phase=>phase.scripts);
assert.ok(bootstrapScripts.length>=14&&bootstrapScripts.length<=28,'deployed bootstrap must use bounded JS groups while preserving independent phase owners');
const requestBudget=1+bootstrapPlan.styles.length+bootstrapScripts.length;
assert.ok(requestBudget<=26,'A67 deployed source must not regress to an excessive number of startup CSS/JS requests');
console.log(JSON.stringify({kind:'A67_BUNDLE_REQUEST_BUDGET',exactSha:expectedSha,baseline:{styles:19,scripts:41,total:60},deployed:{styles:bootstrapPlan.styles.length,scripts:bootstrapScripts.length+1,total:requestBudget},savedRequests:60-requestBudget}));

assert.equal(new Set(bootstrapScripts).size,bootstrapScripts.length,'deployed bootstrap plan contains duplicate startup scripts');
for(const module of ['scripts/settings.js','scripts/rss.js','scripts/logs.js'])assert.equal(bootstrapScripts.includes(module),false,'route-only module leaked into deployed bootstrap plan: '+module);
assert.deepEqual(bootstrapPlan.phases.at(-1),{name:'application',scripts:['scripts/app.js']},'deployed App must remain the final dependency phase');

const browser=await launchBrowser();
try{
  const context=await browser.newContext({locale:'zh-CN'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  const session=`a38-startup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({sim:session,qb:'5.2.3',count:'120',scenario:'mixed',seed:'a38-startup',clean:'0'}).toString();

  const recovery=await recoverPageSession(page,{
    label:'A63 Virtual startup performance',
    qbVersion:'5.2.3',
    timeoutMs,
    navigate:async attempt=>{
      const target=new URL(url);target.searchParams.set('__weig_session_attempt',String(attempt));
      await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs});
    },
    onLogin:async()=>{await page.locator('#login-btn').click();}
  });

  // Session recovery may span multiple private navigations. RuntimeAssets persists the
  // bootstrap descriptor in IndexedDB, while Resource Timing is scoped to one document.
  // Measure request topology on one deliberate authenticated navigation with only the
  // descriptor cache entry invalidated. A DOM transport probe proves scheduler concurrency
  // independently from Service Worker/cache response duration.
  await page.addInitScript(()=>{
    const transport={styles:[],scripts:[]},tracked=new WeakMap();
    Object.defineProperty(window,'__weigStartupTransportProbe',{value:transport,configurable:false});

    // RuntimeAssets assigns node.onload before appendChild(). Install the probe listener at
    // createElement() time so it is registered first. Otherwise resolving RuntimeAssets'
    // onload promise may run the next-wave microtask before a later probe listener records
    // loadTime, which would make a correct bounded scheduler look like it crossed waves.
    const createElement=Document.prototype.createElement;
    Document.prototype.createElement=function(name,...args){
      const node=createElement.call(this,name,...args),tag=String(name||'').toLowerCase();
      if(tag==='link'||tag==='script')node.addEventListener('load',()=>{
        const item=tracked.get(node);
        if(item&&item.loadTime===null)item.loadTime=performance.now();
      },{once:true});
      return node;
    };

    const appendChild=Node.prototype.appendChild;
    Node.prototype.appendChild=function(node){
      const dataset=node&&node.dataset;
      const style=dataset&&dataset.weigRuntimeStyle||'';
      const script=dataset&&dataset.weigRuntimeModule||'';
      const bucket=style?transport.styles:script?transport.scripts:null;
      if(bucket){
        const item={path:style||script,appendTime:performance.now(),loadTime:null};
        bucket.push(item);
        tracked.set(node,item);
      }
      return appendChild.call(this,node);
    };
  });
  await page.evaluate(async()=>{
    const runtime=window.WeiG?.RuntimeAssets;
    if(!runtime)throw new Error('RuntimeAssets is unavailable before topology sampling');
    await runtime.invalidate('bootstrap-plan.json',{namespace:'bootstrap-plan',identity:'startup'});
  });
  const topologyUrl=new URL(url);
  topologyUrl.searchParams.set('__weig_topology_sample','1');
  await page.goto(topologyUrl.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs});
  await page.waitForFunction(()=>document.documentElement.dataset.weigBootstrap==='ready',null,{timeout:timeoutMs});
  await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:timeoutMs});
  console.log(`A63 topology sample prepared after session recovery attempt ${recovery.attempt}.`);

  const bootstrapEvidence=await page.evaluate(()=>({
    state:document.documentElement.dataset.weigBootstrap||'',
    seeds:[...document.querySelectorAll('script[data-weig-bootstrap-seed]')].map(node=>node.dataset.weigBootstrapSeed||''),
    scripts:[...document.querySelectorAll('script[data-weig-runtime-module]')].map(node=>node.dataset.weigRuntimeModule||''),
    styles:[...document.querySelectorAll('link[data-weig-runtime-style]')].map(node=>node.dataset.weigRuntimeStyle||''),
    transport:window.__weigStartupTransportProbe||{styles:[],scripts:[]},
    resources:performance.getEntriesByType('resource').map(entry=>({name:entry.name,startTime:entry.startTime,responseEnd:entry.responseEnd,initiatorType:entry.initiatorType}))
  }));
  assert.equal(bootstrapEvidence.state,'ready','deployed private bootstrap must reach ready before product acceptance');
  assert.deepEqual(bootstrapEvidence.seeds,['scripts/runtime-assets.js'],'private index must own exactly one RuntimeAssets seed');
  assert.deepEqual([...bootstrapEvidence.scripts].sort(),[...bootstrapScripts].sort(),'RuntimeAssets DOM script ownership must exactly match the deployed bootstrap plan');
  assert.deepEqual([...bootstrapEvidence.styles].sort(),[...bootstrapPlan.styles].sort(),'RuntimeAssets DOM stylesheet ownership must exactly match the deployed bootstrap plan');

  const resourceFor=relative=>bootstrapEvidence.resources.find(entry=>{try{return new URL(entry.name).pathname.endsWith('/dev/app/'+relative);}catch{return false;}});
  const seedTiming=resourceFor('scripts/runtime-assets.js'),planTiming=resourceFor('bootstrap-plan.json');
  assert.ok(seedTiming&&planTiming,'Resource Timing must expose both RuntimeAssets seed and bootstrap-plan descriptor');
  assert.ok(planTiming.startTime>=seedTiming.responseEnd,'bootstrap-plan request must begin only after the RuntimeAssets seed is available');
  const styleTimings=bootstrapPlan.styles.map(resourceFor);assert.ok(styleTimings.every(Boolean),'every planned stylesheet must have one browser resource timing entry');
  assert.ok(Math.min(...styleTimings.map(entry=>entry.startTime))>=planTiming.responseEnd,'stylesheet transport must begin after the canonical plan descriptor is available');

  const assertWaveScheduling=(wave,label)=>{
    assert.ok(wave.length&&wave.every(entry=>Number.isFinite(entry.appendTime)&&Number.isFinite(entry.loadTime)),label+' must expose append/load timing for every member');
    assert.ok(Math.max(...wave.map(entry=>entry.appendTime))<=Math.min(...wave.map(entry=>entry.loadTime)),label+' must enqueue every member before any member finishes loading');
  };
  const styleTransport=bootstrapEvidence.transport.styles;
  assert.deepEqual(styleTransport.map(entry=>entry.path),bootstrapPlan.styles,'RuntimeAssets must enqueue styles in canonical plan order');
  let previousStyleWave=null;
  for(let start=0;start<styleTransport.length;start+=bootstrapPlan.styleConcurrency){
    const wave=styleTransport.slice(start,start+bootstrapPlan.styleConcurrency),label='stylesheet wave '+(Math.floor(start/bootstrapPlan.styleConcurrency)+1);
    assertWaveScheduling(wave,label);
    if(previousStyleWave)assert.ok(Math.min(...wave.map(entry=>entry.appendTime))>=Math.max(...previousStyleWave.map(entry=>entry.loadTime)),label+' must wait for the previous bounded wave to finish');
    previousStyleWave=wave;
  }

  const scriptTiming=new Map(bootstrapScripts.map(path=>[path,resourceFor(path)]));assert.ok([...scriptTiming.values()].every(Boolean),'every startup script must have one browser resource timing entry');
  const scriptTransport=bootstrapEvidence.transport.scripts;
  assert.deepEqual(scriptTransport.map(entry=>entry.path),bootstrapScripts,'RuntimeAssets must enqueue startup scripts in canonical phase order');
  let scriptOffset=0,previousScriptPhase=null;
  for(let i=0;i<bootstrapPlan.phases.length;i++){
    const phase=bootstrapPlan.phases[i],entries=phase.scripts.map(path=>scriptTiming.get(path)),transport=scriptTransport.slice(scriptOffset,scriptOffset+phase.scripts.length);
    assert.deepEqual(transport.map(entry=>entry.path),phase.scripts,'transport probe drifted from script phase '+phase.name);
    assertWaveScheduling(transport,'script phase '+phase.name);
    if(previousScriptPhase)assert.ok(Math.min(...transport.map(entry=>entry.appendTime))>=Math.max(...previousScriptPhase.map(entry=>entry.loadTime)),'script phase '+phase.name+' must wait for the previous dependency phase to finish');
    if(i>0){
      const previous=bootstrapPlan.phases[i-1].scripts.map(path=>scriptTiming.get(path));
      assert.ok(Math.min(...entries.map(entry=>entry.startTime))>=Math.max(...previous.map(entry=>entry.responseEnd)),'phase '+phase.name+' started before the previous dependency phase completed');
    }
    previousScriptPhase=transport;scriptOffset+=phase.scripts.length;
  }

  // A67 B0: emit measured transport evidence; do not infer elapsed time from asset count.
  // The authenticated navigation intentionally uses existing service-worker caches.
  // This is a Virtual-qB topology sample, NOT a real-qB cold-start benchmark.
  const roundMs=value=>Number.isFinite(value)?Math.round(value*10)/10:null;
  const spanMs=(items,start,end)=>items.length?roundMs(Math.max(...items.map(item=>item[end]))-Math.min(...items.map(item=>item[start]))):null;
  const waveTimings=bootstrapPlan.phases.map(phase=>{
    const values=scriptTransport.filter(item=>phase.scripts.includes(item.path));
    return{name:phase.name,assets:values.length,elapsedMs:spanMs(values,'appendTime','loadTime')};
  });
  const responseDurations=bootstrapEvidence.resources.filter(entry=>bootstrapPlan.styles.some(p=>entry.name.includes('/'+p+'?'))||bootstrapScripts.some(p=>entry.name.includes('/'+p+'?')))
    .map(entry=>({path:new URL(entry.name).pathname.split('/').slice(-2).join('/'),responseMs:roundMs(entry.responseEnd-entry.startTime)}))
    .sort((a,b)=>b.responseMs-a.responseMs);
  const timingReport={
    kind:'A67_BOOTSTRAP_TIMINGS',source:'Virtual-qB/authenticated-navigation',exactSha:expectedSha,
    css:{assets:styleTransport.length,loadingWaves:Math.ceil(styleTransport.length/bootstrapPlan.styleConcurrency),elapsedMs:spanMs(styleTransport,'appendTime','loadTime')},
    js:{assets:scriptTransport.length,dependencyPhases:bootstrapPlan.phases.length,elapsedMs:spanMs(scriptTransport,'appendTime','loadTime'),phases:waveTimings},
    slowestResponses:responseDurations.slice(0,8),
    note:'Descriptive transport timing only; not a production qB p50/p95 or JavaScript CPU benchmark'
  };
  assert.equal(timingReport.js.phases.reduce((n,phase)=>n+phase.assets,0),bootstrapScripts.length,'every JS asset must be represented in A67 timing evidence');
  assert.ok(timingReport.css.elapsedMs>=0&&timingReport.js.elapsedMs>=0,'A67 transport timing evidence must be monotonic');
  console.log(JSON.stringify(timingReport));

  const styleGateIndex=bootstrapPlan.phases.findIndex(phase=>phase.requiresStyles===true);
  assert.equal(styleGateIndex,6,'the shared UI phase must remain the sole CSS dependency gate');
  const gatedPhase=bootstrapPlan.phases[styleGateIndex];
  const gatedScripts=scriptTransport.filter(item=>gatedPhase.scripts.includes(item.path));
  assert.ok(gatedScripts.length>0&&Math.min(...gatedScripts.map(item=>item.appendTime))>=Math.max(...styleTransport.map(item=>item.loadTime)),
    'shared UI must not begin until every stylesheet has completed');

  const runtimeCopy=await page.evaluate(async()=>{const value=await window.WeiG?.I18n?.loadQbOwnedCopy?.();return value?{sourceSha:value.sourceSha,qbVersion:value.qbVersion,routeId:value.routeId,mode:value.mode}:null;});
  assert.ok(runtimeCopy&&runtimeCopy.sourceSha===catalogProfile.sourceSha&&runtimeCopy.qbVersion==='5.2.3');
  assert.equal(runtimeCopy.routeId,copyRelease.copyRouteId,'browser copy runtime must use the route already selected by the exact capabilities control plane');
  assert.equal(runtimeCopy.mode,'fallback','5.2.3 zh-CN must use the exact official fallback shard when the shared root QM is not exact-source compatible');

  const firstCache=await page.evaluate(async sha=>{
    const name='weig-virtual-static-'+sha,keys=await caches.keys(),cache=await caches.open(name),urls=(await cache.keys()).map(request=>request.url);
    return{keys,urls};
  },expectedSha);
  assert.deepEqual(firstCache.keys.filter(key=>key.startsWith('weig-virtual-static-')),[`weig-virtual-static-${expectedSha}`],'fresh browser context must keep only the exact-SHA immutable Virtual cache');
  assert.ok(firstCache.urls.every(url=>new URL(url).searchParams.get('v')===expectedSha),'every immutable Virtual cache entry must be exact-SHA keyed');
  assert.equal(firstCache.urls.some(url=>url.includes('/__simulator/versions/catalog.generated.json')),false,'normal qB 5.2.3 startup must not cache/fetch the full multi-release catalog fallback');
  assert.equal(firstCache.urls.some(url=>url.includes('/__source/private/data/qb-copy-profiles/')),false,'normal startup must not fetch the retired sourceSha copy-profile pointer');
  const firstRoutes=firstCache.urls.filter(url=>url.includes('/__source/private/data/qb-copy-routes/')),firstBindings=firstCache.urls.filter(url=>url.includes('/__source/private/data/qb-copy-bindings/')),firstFallback=firstCache.urls.filter(url=>url.includes('/__source/private/data/qb-copy-fallback/'));
  assert.equal(firstRoutes.length,1,'qB 5.2.3 startup must fetch exactly one semantic copy route');assert.match(new URL(firstRoutes[0]).pathname,/\/__source\/private\/data\/qb-copy-routes\/r[0-9a-f]{20}\.json\.gz$/);
  assert.equal(firstBindings.length,1,'qB 5.2.3 startup must fetch exactly one deduplicated copy binding');assert.match(new URL(firstBindings[0]).pathname,/\/__source\/private\/data\/qb-copy-bindings\/b[0-9a-f]{20}\.txt$/);
  assert.equal(firstFallback.length,1,'qB 5.2.3 zh-CN startup must fetch exactly one current-locale fallback pack');assert.match(new URL(firstFallback[0]).pathname,/\/__source\/private\/data\/qb-copy-fallback\/p[0-9a-f]{20}\.json\.gz$/);
  assert.equal(firstFallback.some(url=>url.includes('/qb-copy-fallback/4/')||url.includes('/qb-copy-fallback/5/')),false,'physical qB major fallback ownership must stay retired');
  const firstWeiGLocales=firstCache.urls.filter(url=>url.includes('/__source/private/data/weig-i18n/'));
  assert.equal(firstWeiGLocales.length,1,'startup must fetch exactly one non-English WeiG locale shard');
  assert.ok(firstWeiGLocales[0].includes('/weig-i18n/zh-CN.json'),'qB persisted zh-CN must select the matching WeiG zh-CN overlay only');
  assert.equal(firstCache.urls.some(url=>url.includes('/__source/private/data/'+retiredCopyRegistry)),false,'startup must never fetch the retired all-version qB copy registry');
  assert.equal(firstCache.urls.some(url=>/\/__source\/translations\/webui_.+\.qm(?:\?|$)/i.test(url)),false,'browser startup must not download or parse qB QM assets');
  assert.equal(await page.evaluate(()=>['settings','rss','logs'].some(name=>document.querySelector('script[data-weig-runtime-module="scripts/'+name+'.js"]'))),false,'Home prefetch must not execute route modules');

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
  assert.equal(secondCache.urls.some(url=>url.includes('/__source/private/data/qb-copy-profiles/')),false,'reload must not restore the retired sourceSha copy-profile pointer');
  const secondFallback=secondCache.urls.filter(url=>url.includes('/__source/private/data/qb-copy-fallback/'));assert.equal(secondFallback.length,1,'reload must retain only one current-locale content-addressed fallback pack');assert.match(new URL(secondFallback[0]).pathname,/\/__source\/private\/data\/qb-copy-fallback\/p[0-9a-f]{20}\.json\.gz$/);
  assert.equal(secondCache.urls.filter(url=>url.includes('/__source/private/data/weig-i18n/')).length,1,'reload must retain only the one current WeiG locale shard');
  assert.equal(await page.evaluate(()=>['settings','rss','logs'].some(name=>document.querySelector('script[data-weig-runtime-module="scripts/'+name+'.js"]'))),false,'warm Home prefetch must not execute route modules');
  assert.deepEqual(errors,[],`startup-performance session emitted page errors:\n${errors.join('\n')}`);
  await context.close();

  console.log(`A63 Pages startup performance passed for ${expectedSha}: exact qB provenance ${catalogProfile.sourceSha} -> route ${copyRelease.copyRouteId} -> binding ${copyRoute.bindingId}, with one current-locale content-addressed fallback pack and one WeiG locale shard.`);
}finally{
  await browser.close();
}

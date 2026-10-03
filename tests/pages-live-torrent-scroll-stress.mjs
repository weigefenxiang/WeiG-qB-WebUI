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

async function waitForSha(){
  let last='';
  for(let attempt=0;attempt<40;attempt++){
    try{
      const url=new URL('metadata/site.json',base);url.searchParams.set('__a52_scroll_sha',expectedSha);
      const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
      const site=response.ok?await response.json():null;last=site?.simulatorSha||`HTTP ${response.status}`;
      if(last===expectedSha)return site;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages Torrent scroll stress could not observe ${expectedSha}; last=${last}`);
}

await waitForSha();
const browser=await launchBrowser();
try{
  const context=await browser.newContext({viewport:{width:1180,height:820},locale:'zh-CN'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  page.on('response',response=>{if(response.status()<400)return;const value=response.url();if(/favicon(?:\.ico)?|Wei\.G\.ico/i.test(value))return;errors.push(`HTTP ${response.status()} ${value}`);});
  page.on('console',message=>{if(message.type()!=='error')return;const value=message.text(),source=String(message.location()?.url||'');if(/^Failed to load resource:/i.test(value))return;if(/favicon(?:\.ico)?|Wei\.G\.ico/i.test(`${source} ${value}`))return;errors.push(source?`${value} (${source})`:value);});

  const sessionId=`a52-scroll-${Date.now()}`;
  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({sim:sessionId,qb:'5.2.3',count:'1600',scenario:'mixed',seed:'a52-scroll-stress'}).toString();
  await recoverPageSession(page,{
    label:`A52 Torrent scroll stress ${sessionId}`,
    qbVersion:'5.2.3',
    timeoutMs,
    navigate:async attempt=>{
      const target=new URL(url);target.searchParams.set('__weig_session_attempt',String(attempt));
      await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs});
    },
    onLogin:async()=>{await page.locator('#login-btn').click();}
  });
  await page.waitForSelector('#torrent-list [data-hash]',{state:'visible',timeout:60000});
  await page.waitForFunction(()=>window.WeiG?.AppState?.libraryData&&window.WeiG?.AppState?.viewport,null,{timeout:30000});

  const startup=await page.evaluate(()=>{const stats=WeiG.AppState.libraryData.stats();return{
    catalogReady:WeiG.AppState.catalogReady===true,
    catalogBusy:!!WeiG.AppState.catalogTask,
    pageSize:WeiG.LibraryController.state().pageSize,
    prefetch50:stats.prefetchRadius(50),
    stats:{cacheEntries:stats.cacheEntries,cacheRows:stats.cacheRows,inflightPages:stats.inflightPages,pageTraffic:stats.pageTraffic,prefetchDemand:stats.prefetchDemand,catalogBusy:stats.catalogBusy,catalogPriority:stats.catalogPriority}
  };});
  assert.equal(startup.catalogReady,false,`1600-Torrent startup must not materialize a full catalog: ${JSON.stringify(startup)}`);
  assert.equal(startup.catalogBusy,false,`1600-Torrent startup must not leave full-catalog background work running: ${JSON.stringify(startup)}`);
  assert.equal(startup.pageSize,50,'stress fixture must exercise the canonical 50-row page');
  assert.equal(startup.prefetch50,3,'50/page must retain the bounded ±3 neighbor window');

  const baseline=await page.evaluate(()=>{
    const list=document.getElementById('torrent-list'),viewport=WeiG.AppState.viewport;
    window.__a52Pool=viewport._rowPool.map(slot=>slot.node);
    viewport.resetMetrics();
    return{clientHeight:list.clientHeight,scrollHeight:list.scrollHeight,clientWidth:list.clientWidth,scrollWidth:list.scrollWidth,pool:window.__a52Pool.length};
  });
  assert.ok(baseline.pool>0&&baseline.scrollHeight>baseline.clientHeight,'stress page must own a real virtualized vertical scroll range');

  for(const ratio of [.08,.72,.24,.94,.41,.63,.02,.88]){
    await page.evaluate(value=>new Promise(resolve=>{
      const list=document.getElementById('torrent-list'),max=Math.max(0,list.scrollHeight-list.clientHeight);
      list.scrollTop=Math.round(max*value);list.dispatchEvent(new Event('scroll'));
      requestAnimationFrame(()=>requestAnimationFrame(resolve));
    }),ratio);
    const frame=await page.evaluate(()=>{
      const list=document.getElementById('torrent-list'),head=document.getElementById('torrent-table-head'),viewport=WeiG.AppState.viewport;
      const lr=list.getBoundingClientRect(),headBottom=head?.getBoundingClientRect().bottom||lr.top,rowHeight=Math.max(1,Number(viewport.rowHeight)||1);
      const rows=[...list.querySelectorAll('.data-viewport__row:not([hidden])')].map(node=>node.getBoundingClientRect()).filter(r=>r.bottom>headBottom&&r.top<lr.bottom).sort((a,b)=>a.top-b.top);
      let maxGap=0;for(let i=1;i<rows.length;i++)maxGap=Math.max(maxGap,rows[i].top-rows[i-1].bottom);
      return{rows:rows.length,maxGap,top:rows[0]?.top??null,bottom:rows.at(-1)?.bottom??null,headBottom,listBottom:lr.bottom,rowHeight,metrics:viewport.metrics(),same:window.__a52Pool.every((node,index)=>viewport._rowPool[index]?.node===node)};
    });
    assert.ok(frame.rows>=Math.max(2,Math.floor((frame.listBottom-frame.headBottom)/frame.rowHeight)-1),`thumb-like vertical jump exposed too few rows: ${JSON.stringify(frame)}`);
    assert.ok(frame.maxGap<=2,`thumb-like vertical jump exposed a visible row hole: ${JSON.stringify(frame)}`);
    assert.ok(frame.same,`thumb-like vertical jump replaced the warmed recycler pool: ${JSON.stringify(frame)}`);
  }
  const verticalMetrics=await page.evaluate(()=>WeiG.AppState.viewport.metrics());
  assert.equal(verticalMetrics.created,0,`warmed 50-row recycler allocated during distant jumps: ${JSON.stringify(verticalMetrics)}`);
  assert.equal(verticalMetrics.removed,0,`warmed 50-row recycler removed shells during distant jumps: ${JSON.stringify(verticalMetrics)}`);

  const horizontal=await page.evaluate(async()=>{
    const list=document.getElementById('torrent-list'),viewport=WeiG.AppState.viewport,max=Math.max(0,list.scrollWidth-list.clientWidth);
    viewport.resetMetrics();
    if(max<=0)return{max,metrics:viewport.metrics()};
    for(const ratio of [.15,.85,.35,1,.1,.65]){
      list.scrollLeft=Math.round(max*ratio);list.dispatchEvent(new Event('scroll'));
      await new Promise(resolve=>requestAnimationFrame(resolve));
    }
    return{max,metrics:viewport.metrics(),left:list.scrollLeft};
  });
  assert.ok(horizontal.max>0,`desktop stress fixture must expose a horizontal scroll range: ${JSON.stringify(horizontal)}`);
  assert.equal(horizontal.metrics.renders,0,`pure horizontal scrollbar motion must remain compositor-only: ${JSON.stringify(horizontal)}`);

  const blocked=await page.evaluate(async()=>{
    const list=document.getElementById('torrent-list'),client=WeiG.AppState.client,original=client.getTorrents.bind(client);
    let catalogCalls=0;
    client.getTorrents=async function(opts){if(Number(opts?.limit)===200){catalogCalls++;await new Promise(resolve=>setTimeout(resolve,12));}return original(opts);};
    list.scrollTop=Math.max(1,list.scrollTop+1);list.dispatchEvent(new Event('scroll'));
    window.__a52CatalogPromise=WeiG.LibraryController.ensureFacetOptions('tracker');
    await new Promise(resolve=>setTimeout(resolve,80));
    return{catalogCalls,interacting:WeiG.AppState.viewport.isInteracting(),stats:WeiG.AppState.libraryData.stats()};
  });
  assert.equal(blocked.interacting,true,`scroll owner must remain active during the bounded quiet period: ${JSON.stringify(blocked)}`);
  assert.equal(blocked.catalogCalls,0,`demand-driven full catalog must not start a batch while native scroll is active: ${JSON.stringify(blocked)}`);

  await page.waitForTimeout(180);
  await page.evaluate(()=>window.__a52CatalogPromise);
  const catalogDone=await page.evaluate(()=>({ready:WeiG.AppState.catalogReady===true,busy:!!WeiG.AppState.catalogTask,stats:WeiG.AppState.libraryData.stats()}));
  assert.equal(catalogDone.ready,true,`facet demand must eventually materialize the 1600-Torrent catalog after interaction becomes idle: ${JSON.stringify(catalogDone)}`);
  assert.equal(catalogDone.busy,false,`catalog task must settle after the stress scan: ${JSON.stringify(catalogDone)}`);
  assert.deepEqual(errors,[],`A52 scroll stress emitted browser errors: ${errors.join('\n')}`);
  console.log('A52 Pages Torrent scroll stress passed: 1600-Torrent startup stays page-bounded, distant virtual jumps remain hole-free, horizontal motion stays compositor-only, and demand catalog yields to active scrolling.');
  await context.close();
} finally {
  await browser.close();
}

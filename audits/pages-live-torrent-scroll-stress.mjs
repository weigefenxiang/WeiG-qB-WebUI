import assert from 'node:assert/strict';
import {launchBrowser} from '../tests/browser-driver.mjs';
import {recoverPageSession} from '../tests/pages-live-session.mjs';

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
  assert.equal(startup.prefetch50,6,'50/page must retain the bounded ±6 neighbor window');

  await page.evaluate(()=>{const client=WeiG.AppState.client;window.__a53OriginalGetTorrents=client.getTorrents;window.__a53TotalCalls=[];client.getTorrents=async function(opts){window.__a53TotalCalls.push({...opts});return window.__a53OriginalGetTorrents.call(client,opts);};});
  await page.locator('#filter-nav [data-filter="inactive"]').click();
  await page.waitForFunction(()=>WeiG.LibraryController.state().filter==='inactive'&&Number.isSafeInteger(WeiG.LibraryController.total()),null,{timeout:30000});
  const nativeTotal=await page.evaluate(()=>{const total=WeiG.LibraryController.total(),size=WeiG.LibraryController.state().pageSize,calls=window.__a53TotalCalls||[],probes=calls.filter(call=>Number(call.limit)===1),catalog=calls.filter(call=>Number(call.limit)===200);return{total,pages:Math.max(1,Math.ceil(total/size)),probes:probes.length,catalog:catalog.length,catalogReady:WeiG.AppState.catalogReady===true,totalSignature:WeiG.AppState.knownTotalSignature,stats:WeiG.AppState.libraryData.stats()};});
  assert.ok(nativeTotal.total>=0&&nativeTotal.probes>0&&nativeTotal.probes<32,`native filtered total must converge through bounded sparse probes: ${JSON.stringify(nativeTotal)}`);assert.equal(nativeTotal.catalog,0,`native filtered total must not launch a sequential full catalog: ${JSON.stringify(nativeTotal)}`);assert.equal(nativeTotal.catalogReady,false,`native filtered total must not materialize catalog state: ${JSON.stringify(nativeTotal)}`);assert.ok(nativeTotal.totalSignature,`native filtered total must publish a predicate-scoped signature: ${JSON.stringify(nativeTotal)}`);
  if(nativeTotal.pages>1){const beforeProbes=nativeTotal.probes;await page.locator('#next-btn').click();await page.waitForFunction(()=>WeiG.LibraryController.state().page===1,null,{timeout:10000});await page.waitForTimeout(220);const afterProbes=await page.evaluate(()=>(window.__a53TotalCalls||[]).filter(call=>Number(call.limit)===1).length);assert.equal(afterProbes,beforeProbes,'Next page must reuse the resolved total extent instead of restarting sparse probes');}
  await page.locator('#filter-nav [data-filter="all"]').click();await page.waitForFunction(()=>WeiG.LibraryController.state().filter==='all'&&WeiG.LibraryController.state().page===0,null,{timeout:10000});await page.evaluate(()=>{const client=WeiG.AppState.client;if(window.__a53OriginalGetTorrents)client.getTorrents=window.__a53OriginalGetTorrents;delete window.__a53OriginalGetTorrents;delete window.__a53TotalCalls;});

  // A68-20: authenticated F5 must restore a bounded session-scoped exact total.
  await page.waitForFunction(()=>Number.isSafeInteger(WeiG.LibraryController.total())&&WeiG.LibraryController.total()>50,null,{timeout:30000});
  const beforeF5=await page.evaluate(()=>{
    const total=WeiG.LibraryController.total(),saved=JSON.parse(sessionStorage.getItem('weig.torrentTotalCache')||'null');
    return{total,saved,expectedPages:Math.ceil(total/WeiG.LibraryController.state().pageSize)};
  });
  assert.ok(beforeF5.saved?.schemaVersion===1&&beforeF5.saved.entries.some(item=>item[1]===beforeF5.total),`F5 requires a trusted session total snapshot: ${JSON.stringify(beforeF5)}`);
  await page.reload({waitUntil:'domcontentloaded',timeout:timeoutMs});
  await page.waitForSelector('#torrent-list [data-hash]',{state:'visible',timeout:60000});
  await page.waitForFunction(expected=>WeiG.LibraryController.total()===expected,beforeF5.total,{timeout:30000});
  const afterF5=await page.evaluate(()=>{
    const state=WeiG.LibraryController.state(),total=WeiG.LibraryController.total(),view=document.querySelector('#page-label');
    return{total,pages:Number(view?.querySelector('[data-pager-total]')?.textContent||-1),spinner:!!view?.querySelector('.pager-index-spinner'),cachedTotal:WeiG.AppState.libraryData.cachedTotal({filter:'all'})};
  });
  assert.equal(afterF5.total,beforeF5.total,`F5 must preserve total instead of losing it: ${JSON.stringify(afterF5)}`);
  assert.equal(afterF5.pages,beforeF5.expectedPages,`F5 must render the restored total page count: ${JSON.stringify(afterF5)}`);
  assert.equal(afterF5.spinner,false,'Known F5 total must not show a pending spinner');
  await page.waitForFunction(()=>{
    const app=WeiG.AppState,state=WeiG.LibraryController.state(),q={filter:'all',sort:state.sort,reverse:String(state.reverse)};
    return !!app.libraryData?.cachedPage(q,1,state.pageSize);
  },null,{timeout:30000});
  await page.evaluate(()=>{const client=WeiG.AppState.client,original=client.getTorrents.bind(client);window.__a68ForegroundRequests=[];client.getTorrents=async function(opts){window.__a68ForegroundRequests.push({...opts});return original(opts);};});
  await page.locator('#next-btn').click();
  await page.waitForFunction(()=>WeiG.LibraryController.state().page===1&&WeiG.AppState.torrents.length>0,null,{timeout:10000});
  const nextPageRequests=await page.evaluate(()=>(window.__a68ForegroundRequests||[]).filter(q=>Number(q.offset)===50&&Number(q.limit)===51).length);
  assert.equal(nextPageRequests,0,'Clicking an already-warmed next page must not duplicate the foreground page fetch');
  await page.locator('#prev-btn').click();
  await page.waitForFunction(()=>WeiG.LibraryController.state().page===0,null,{timeout:10000});
  console.log('A68-20 real Pages F5 exact-total and cached next-page navigation passed: '+JSON.stringify({total:afterF5.total,pages:afterF5.pages,nextPageRequests}));
  
  const baseline=await page.evaluate(()=>{
    const list=document.getElementById('torrent-list'),viewport=WeiG.AppState.viewport;
    window.__a52Pool=viewport._rowPool.map(slot=>slot.node);
    viewport.resetMetrics();
    return{clientHeight:list.clientHeight,scrollHeight:list.scrollHeight,clientWidth:list.clientWidth,scrollWidth:list.scrollWidth,pool:window.__a52Pool.length};
  });
  assert.ok(baseline.pool>0&&baseline.scrollHeight>baseline.clientHeight,'stress page must own a real virtualized vertical scroll range');

  // A68-2: physical page mouse-wheel input, NOT the browser-chrome native thumb.
  // Programmatic thumb-like jumps below retain their separate coverage contract.
  const scrollBox=await page.locator('#torrent-list').boundingBox();
  assert.ok(scrollBox&&scrollBox.width>200&&scrollBox.height>200,'physical wheel target must be visible');
  await page.mouse.move(scrollBox.x+scrollBox.width/2,scrollBox.y+scrollBox.height/2);
  const wheelBefore=await page.evaluate(()=>document.getElementById('torrent-list').scrollTop);
  await page.mouse.wheel(0,420);
  await page.waitForFunction(before=>document.getElementById('torrent-list').scrollTop>before,wheelBefore,{timeout:5000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const wheelFrame=await page.evaluate(()=>{
    const list=document.getElementById('torrent-list'),head=document.getElementById('torrent-table-head'),viewport=WeiG.AppState.viewport;
    const lr=list.getBoundingClientRect(),top=head.getBoundingClientRect().bottom,visible=[...list.querySelectorAll('.data-viewport__row:not([hidden])')].map(node=>node.getBoundingClientRect()).filter(rect=>rect.bottom>top&&rect.top<lr.bottom).sort((a,b)=>a.top-b.top);
    const gaps=visible.slice(1).map((rect,i)=>rect.top-visible[i].bottom);
    return{scrollTop:list.scrollTop,top,first:visible[0]?.top,last:visible.at(-1)?.bottom,bottom:lr.bottom,maxGap:Math.max(0,...gaps),visible:visible.length,metrics:viewport.metrics()};
  });
  assert.ok(wheelFrame.scrollTop>wheelBefore&&wheelFrame.visible>2&&wheelFrame.first<=wheelFrame.top+2&&wheelFrame.last>=wheelFrame.bottom-2&&wheelFrame.maxGap<=2,`physical vertical wheel left a visible row hole: ${JSON.stringify(wheelFrame)}`);
  assert.equal(wheelFrame.metrics.created,0,`physical vertical wheel allocated new recycler shells: ${JSON.stringify(wheelFrame)}`);
  assert.equal(wheelFrame.metrics.removed,0,`physical vertical wheel dropped recycler shells: ${JSON.stringify(wheelFrame)}`);
  console.log('A68-2 physical vertical wheel frame (not native thumb): '+JSON.stringify(wheelFrame));
  await page.evaluate(()=>WeiG.AppState.viewport.resetMetrics());

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

  // Horizontal browser input uses the native scroll pipeline; no scripted scrollLeft writes.
  const xBefore=await page.evaluate(()=>document.getElementById('torrent-list').scrollLeft);
  await page.mouse.move(scrollBox.x+scrollBox.width/2,scrollBox.y+scrollBox.height/2);
  await page.evaluate(()=>WeiG.AppState.viewport.resetMetrics());
  await page.mouse.wheel(xBefore>horizontal.max/2?-420:420,0);
  await page.waitForFunction(before=>document.getElementById('torrent-list').scrollLeft!==before,xBefore,{timeout:5000});
  const wheelHorizontal=await page.evaluate(()=>({left:document.getElementById('torrent-list').scrollLeft,metrics:WeiG.AppState.viewport.metrics()}));
  assert.equal(wheelHorizontal.metrics.renders,0,`physical horizontal wheel must not repaint the DataViewport: ${JSON.stringify(wheelHorizontal)}`);
  console.log('A68-2 physical horizontal wheel (not native thumb): '+JSON.stringify(wheelHorizontal));

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
  await context.close();

  const legacyContext=await browser.newContext({viewport:{width:1180,height:820},locale:'zh-CN'}),legacyPage=await legacyContext.newPage(),legacyErrors=[];
  legacyPage.on('pageerror',error=>legacyErrors.push(error?.stack||error?.message||String(error)));
  const legacySessionId=`a53-total-qb4-${Date.now()}`,legacyUrl=new URL('dev/app/',base);legacyUrl.search=new URLSearchParams({sim:legacySessionId,qb:'4.1.9.1',count:'320',scenario:'mixed',seed:'a53-total-qb4'}).toString();
  await recoverPageSession(legacyPage,{label:`A53 legacy total ${legacySessionId}`,qbVersion:'4.1.9.1',timeoutMs,navigate:async attempt=>{const target=new URL(legacyUrl);target.searchParams.set('__weig_session_attempt',String(attempt));await legacyPage.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs});},onLogin:async()=>{await legacyPage.locator('#login-btn').click();}});
  await legacyPage.waitForSelector('#torrent-list [data-hash]',{state:'visible',timeout:60000});
  await legacyPage.evaluate(()=>{const client=WeiG.AppState.client;window.__a53LegacyTotalCalls=[];const original=client.getTorrents.bind(client);client.getTorrents=async function(opts){window.__a53LegacyTotalCalls.push({...opts});return original(opts);};});
  await legacyPage.locator('#filter-nav [data-filter="inactive"]').click();
  await legacyPage.waitForFunction(()=>WeiG.LibraryController.state().filter==='inactive'&&Number.isSafeInteger(WeiG.LibraryController.total()),null,{timeout:20000});
  const legacyTotal=await legacyPage.evaluate(()=>{const calls=window.__a53LegacyTotalCalls||[],probes=calls.filter(call=>Number(call.limit)===1);return{total:WeiG.LibraryController.total(),probes:probes.length,maxOffset:Math.max(0,...probes.map(call=>Number(call.offset)||0)),catalogReady:WeiG.AppState.catalogReady===true};});
  assert.ok(legacyTotal.total>=0&&legacyTotal.probes>0&&legacyTotal.probes<32&&legacyTotal.maxOffset>=legacyTotal.total,`qB4 legacy offset-wrap total must converge through bounded sparse probes: ${JSON.stringify(legacyTotal)}`);assert.equal(legacyTotal.catalogReady,false,`qB4 exact total must not fall back to full catalog: ${JSON.stringify(legacyTotal)}`);assert.deepEqual(legacyErrors,[],`A53 qB4 total regression emitted browser errors: ${legacyErrors.join('\n')}`);await legacyContext.close();
  console.log('A68 Pages Torrent wheel/scroll/total stress passed: qB5 native totals and qB4 legacy offset-wrap totals converge without full catalog scans; scroll recycler behavior remains bounded.');
} finally {
  await browser.close();
}

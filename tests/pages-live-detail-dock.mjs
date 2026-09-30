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
      const url=new URL('metadata/site.json',base);url.searchParams.set('__detail_dock_sha',expectedSha);
      const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
      const site=response.ok?await response.json():null;last=site?.simulatorSha||`HTTP ${response.status}`;
      if(last===expectedSha)return site;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages Detail Dock acceptance could not observe ${expectedSha}; last=${last}`);
}

async function openSession(page,{qb='5.2.3',count=80,seed='a35-detail-dock'}={}){
  const sessionId=`detail-dock-${qb.replaceAll('.','-')}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({sim:sessionId,qb,count:String(count),scenario:'mixed',seed,clean:'0'}).toString();
  await recoverPageSession(page,{
    label:`A35 Detail Dock qB ${qb}`,
    qbVersion:qb,
    timeoutMs,
    navigate:async attempt=>{
      const target=new URL(url);target.searchParams.set('__weig_session_attempt',String(attempt));
      await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:timeoutMs});
    },
    onLogin:async()=>{await page.locator('#login-btn').click();}
  });
  await page.waitForSelector('#torrent-list [data-hash]',{state:'visible',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#torrent-detail-tabs .tab').length===5,null,{timeout:30000});
  return{sessionId,url:url.toString()};
}

async function selectOnlyByRow(page,index){
  const row=page.locator('#torrent-list [data-hash]').nth(index);
  await row.waitFor({state:'visible',timeout:30000});
  const hash=await row.getAttribute('data-hash');
  const box=await row.boundingBox();
  assert.ok(box&&box.width>80&&box.height>10,'Torrent row must have a clickable body');
  await row.click({position:{x:Math.min(box.width-12,Math.max(70,box.width*.72)),y:Math.min(box.height-4,Math.max(8,box.height*.5))}});
  await page.waitForFunction(expected=>window.WeiG?.Selection?.count?.()===1&&window.WeiG.Selection.hashes()[0]===expected,hash,{timeout:10000});
  return hash;
}

async function verifyModern(){
  const context=await browser.newContext({viewport:{width:1200,height:850},locale:'zh-CN'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  await openSession(page);

  const initial=await page.evaluate(()=>({
    keys:[...document.querySelectorAll('#torrent-detail-tabs .tab')].map(node=>node.dataset.tab),
    disabled:[...document.querySelectorAll('#torrent-detail-tabs .tab')].every(node=>node.disabled),
    dockHidden:document.getElementById('torrent-detail-dock')?.hidden,
    splitterHidden:document.getElementById('torrent-detail-splitter')?.hidden,
    route:window.WeiG?.Router?.route?.().name
  }));
  assert.deepEqual(initial.keys,['overview','trackers','peers','webseeds','files'],'Dock tabs must preserve qB source order');
  assert.equal(initial.disabled,false,'zero-selection Dock tabs must remain usable when the Torrent viewport has a visible subject');
  assert.equal(initial.dockHidden,true);assert.equal(initial.splitterHidden,true);assert.equal(initial.route,'home');

  const zeroSubject=await page.evaluate(()=>{const viewport=document.getElementById('torrent-list')?.__weigTorrentDataViewport,item=viewport?.firstVisibleItem?.();return{selection:window.WeiG.Selection.count(),hash:item?.hash||''};});
  assert.equal(zeroSubject.selection,0);assert.ok(zeroSubject.hash,'zero-selection regression needs a visible Torrent subject');
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForSelector('#torrent-detail-dock:not([hidden]) .general-detail',{state:'visible',timeout:30000});
  const zeroOpened=await page.evaluate(()=>({hash:window.WeiG.AppState.detailDockHash,open:window.WeiG.AppState.detailDockOpen,selection:window.WeiG.Selection.count(),active:[...document.querySelectorAll('#torrent-detail-tabs .tab.is-active')].map(node=>node.dataset.tab),preview:[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject')].map(node=>node.dataset.hash),previewChecked:[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject .torrent-select')].map(node=>node.checked)}));
  assert.equal(zeroOpened.selection,0,'Detail preview must not mutate the explicit Selection owner');assert.equal(zeroOpened.hash,zeroSubject.hash);assert.equal(zeroOpened.open,true);assert.deepEqual(zeroOpened.active,['overview']);assert.deepEqual(zeroOpened.preview,[zeroSubject.hash],'zero-selection Detail subject must receive a presentation-only selected treatment');assert.ok(zeroOpened.previewChecked.every(value=>value===false),'presentation-only Detail subject must not check the real Selection input');
  await page.evaluate(()=>{const list=document.getElementById('torrent-list');list.scrollTop=Math.min(list.scrollHeight-list.clientHeight,list.scrollTop+Math.max(180,list.clientHeight*.55));list.dispatchEvent(new Event('scroll'));});await page.waitForTimeout(2400);
  const zeroAfterScroll=await page.evaluate(()=>({hash:window.WeiG.AppState.detailDockHash,selection:window.WeiG.Selection.count()}));
  assert.equal(zeroAfterScroll.selection,0);assert.equal(zeroAfterScroll.hash,zeroSubject.hash,'zero-selection Detail subject must stay captured while the Torrent list scrolls');
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForFunction(()=>!window.WeiG.AppState.detailDockOpen,null,{timeout:10000});

  const firstHash=await selectOnlyByRow(page,0);
  await page.waitForFunction(()=>[...document.querySelectorAll('#torrent-detail-tabs .tab')].every(node=>!node.disabled),null,{timeout:10000});

  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForSelector('#torrent-detail-dock:not([hidden]) .general-detail',{state:'visible',timeout:30000});
  const opened=await page.evaluate(expected=>({
    route:window.WeiG.Router.route().name,
    hash:window.WeiG.AppState.detailDockHash,
    tab:window.WeiG.AppState.detailDockTab,
    open:window.WeiG.AppState.detailDockOpen,
    topBackHidden:document.getElementById('back-btn')?.classList.contains('is-hidden'),
    dockBack:document.querySelectorAll('#torrent-detail-dock [data-detail-back],#torrent-detail-dock #back-btn').length,
    sharedRuntime:!!window.WeiG.DetailRuntime,
    active:[...document.querySelectorAll('#torrent-detail-tabs .tab.is-active')].map(node=>node.dataset.tab)
  }),firstHash);
  assert.equal(opened.route,'home','inline Detail must not navigate away from the Torrent Library');
  assert.equal(opened.hash,firstHash);assert.equal(opened.tab,'overview');assert.equal(opened.open,true);
  assert.equal(opened.topBackHidden,true,'home header Back must stay hidden for inline Detail');
  assert.equal(opened.dockBack,0,'inline Detail must not create a Back-to-torrents control');
  assert.equal(opened.sharedRuntime,true);assert.deepEqual(opened.active,['overview']);
  const activeTone=await page.evaluate(()=>{const active=document.querySelector('#torrent-detail-tabs .tab.is-active'),inactive=document.querySelector('#torrent-detail-tabs .tab:not(.is-active)'),style=node=>{const s=getComputedStyle(node);return{background:s.backgroundImage+'|'+s.backgroundColor,border:s.borderColor,color:s.color,shadow:s.boxShadow};};return{active:style(active),inactive:style(inactive)};});
  assert.notDeepEqual(activeTone.active,activeTone.inactive,`active Detail tab must have a visible selected treatment distinct from inactive tabs: ${JSON.stringify(activeTone)}`);

  const geometry=await page.evaluate(()=>{
    const rect=node=>{const r=node.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    const list=document.getElementById('torrent-list'),separator=document.getElementById('torrent-detail-splitter'),dock=document.getElementById('torrent-detail-dock'),pager=document.querySelector('#list-view .torrent-pager'),nav=pager.querySelector('.pager__nav'),rail=document.getElementById('torrent-detail-tabs');
    return{list:rect(list),separator:rect(separator),dock:rect(dock),pager:rect(pager),nav:rect(nav),rail:rect(rail),railScroll:rail.scrollWidth,railClient:rail.clientWidth,listScrollWidth:list.scrollWidth,listClientWidth:list.clientWidth};
  });
  assert.ok(geometry.separator.top>=geometry.list.bottom-1.5,`splitter must sit below the Torrent viewport/scrollbar: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.dock.top>=geometry.separator.bottom-1.5,`Detail Dock must sit below the splitter: ${JSON.stringify(geometry)}`);
  const pagerCenter=(geometry.pager.left+geometry.pager.right)/2,navCenter=(geometry.nav.left+geometry.nav.right)/2;
  assert.ok(navCenter>=pagerCenter-3,`desktop pager may stay centered or shift right only to avoid the Detail rail: ${JSON.stringify(geometry)}`);
  assert.ok(Math.abs(navCenter-pagerCenter)<=4||geometry.nav.left>=geometry.rail.right+7,`desktop pager must remain centered whenever possible and otherwise clear the left Detail rail: ${JSON.stringify(geometry)}`);

  // Main and Detail scroll owners must stay independent after the Dock is inserted.
  const scrollState=await page.evaluate(()=>{
    const list=document.getElementById('torrent-list'),max=Math.max(0,list.scrollWidth-list.clientWidth);
    list.scrollLeft=Math.min(120,max);
    return{left:list.scrollLeft,max};
  });
  if(scrollState.max>0)assert.ok(scrollState.left>0,'Main Torrent horizontal scroll must remain writable with the Dock open');

  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForSelector('#torrent-detail-dock-content .shared-table__viewport',{state:'visible',timeout:30000});
  const trackerState=await page.evaluate(()=>({
    route:window.WeiG.Router.route().name,
    tab:window.WeiG.AppState.detailDockTab,
    active:[...document.querySelectorAll('#torrent-detail-tabs .tab.is-active')].map(node=>node.dataset.tab),
    mainLeft:document.getElementById('torrent-list').scrollLeft,
    detailViewport:!!document.querySelector('#torrent-detail-dock-content .shared-table__viewport'),
    toolbarCount:document.querySelectorAll('#torrent-detail-dock-content>.shared-table__toolbar').length,
    summaryCount:document.querySelectorAll('#torrent-detail-dock-content>.section-note').length
  }));
  assert.equal(trackerState.route,'home');assert.equal(trackerState.tab,'trackers');assert.deepEqual(trackerState.active,['trackers']);assert.equal(trackerState.detailViewport,true);assert.equal(trackerState.toolbarCount,0,'inline Detail tables must hide the Column settings toolbar row');assert.equal(trackerState.summaryCount,0,'inline Detail tables must hide the toolbar summary row with the Column settings control');
  if(scrollState.max>0)assert.equal(trackerState.mainLeft,scrollState.left,'switching Detail tabs must not reset Main Torrent horizontal scroll');

  const sourceTabKeys=await page.locator('#torrent-detail-tabs .tab').evaluateAll(nodes=>nodes.map(node=>node.dataset.tab));
  assert.deepEqual(sourceTabKeys,['overview','trackers','peers','webseeds','files'],'inline Dock must expose the complete source-driven qB Detail tab family in source order');
  for(const tab of ['webseeds','files']){
    await page.locator(`#torrent-detail-tabs .tab[data-tab="${tab}"]`).click();
    await page.waitForSelector('#torrent-detail-dock-content .shared-table__viewport',{state:'visible',timeout:30000});
    const state=await page.evaluate(()=>({route:window.WeiG.Router.route().name,tab:window.WeiG.AppState.detailDockTab,active:[...document.querySelectorAll('#torrent-detail-tabs .tab.is-active')].map(node=>node.dataset.tab)}));
    assert.equal(state.route,'home',`${tab} Dock switch must stay on the Torrent Library route`);
    assert.equal(state.tab,tab);assert.deepEqual(state.active,[tab]);
  }
  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForFunction(()=>window.WeiG.AppState.detailDockOpen&&window.WeiG.AppState.detailDockTab==='trackers',null,{timeout:10000});

  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForFunction(()=>!window.WeiG.AppState.detailDockOpen&&document.getElementById('torrent-detail-dock').hidden&&document.getElementById('torrent-detail-splitter').hidden,null,{timeout:10000});
  assert.equal(await page.locator('#torrent-detail-tabs .tab.is-active').count(),0,'clicking the active tab must collapse and clear active presentation');

  await page.locator('#torrent-detail-tabs .tab[data-tab="peers"]').click();
  await page.waitForSelector('#torrent-detail-dock-content .shared-table__viewport',{state:'visible',timeout:30000});
  const secondHash=await selectOnlyByRow(page,1);
  await page.waitForFunction(expected=>window.WeiG.AppState.detailDockOpen&&window.WeiG.AppState.detailDockHash===expected&&window.WeiG.AppState.detailDockTab==='peers',secondHash,{timeout:30000});
  assert.notEqual(secondHash,firstHash,'selection rebind gate needs a second Torrent');

  // Ctrl-select one more Torrent: multi-selection keeps the Dock usable and follows the last interacted Torrent.
  const third=page.locator('#torrent-list [data-hash]').nth(2),thirdHash=await third.getAttribute('data-hash'),thirdBox=await third.boundingBox();
  assert.ok(thirdBox&&thirdHash);
  await third.click({modifiers:['Control'],position:{x:Math.min(thirdBox.width-12,Math.max(70,thirdBox.width*.72)),y:Math.min(thirdBox.height-4,Math.max(8,thirdBox.height*.5))}});
  await page.waitForFunction(expected=>window.WeiG.Selection.count()===2&&window.WeiG.Selection.primary()===expected&&window.WeiG.AppState.detailDockOpen&&window.WeiG.AppState.detailDockHash===expected&&[...document.querySelectorAll('#torrent-detail-tabs .tab')].every(node=>!node.disabled),thirdHash,{timeout:30000});

  // Return to one selected Torrent, open General, exercise full-rail splitter drag/reset/persistence.
  const persistHash=await selectOnlyByRow(page,1);
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForSelector('#torrent-detail-dock:not([hidden]) .general-detail',{state:'visible',timeout:30000});
  const splitter=page.locator('#torrent-detail-splitter'),dock=page.locator('#torrent-detail-dock');
  let sepBox=await splitter.boundingBox(),dockBox=await dock.boundingBox();
  assert.ok(sepBox&&dockBox);
  const beforeHeight=dockBox.height;
  await page.mouse.move(sepBox.x+sepBox.width/2,sepBox.y+sepBox.height/2);
  await page.mouse.down();
  await page.mouse.move(sepBox.x+sepBox.width/2,Math.max(2,sepBox.y-80),{steps:6});
  await page.mouse.up();
  await page.waitForTimeout(80);
  dockBox=await dock.boundingBox();
  assert.ok(dockBox.height>=beforeHeight+30,`dragging the splitter upward must increase Detail height: before=${beforeHeight}, after=${dockBox.height}`);
  const persistedAfterDrag=await page.evaluate(()=>Number(localStorage.getItem(window.WeiG.StorageKeys.torrentDetailDockHeight)));
  assert.ok(Number.isFinite(persistedAfterDrag)&&persistedAfterDrag>=dockBox.height-3,'pointer release must persist the shared Detail height');

  await splitter.dblclick();
  await page.waitForTimeout(60);
  dockBox=await dock.boundingBox();
  assert.ok(Math.abs(dockBox.height-280)<=4,`double-click must restore the default Detail height: ${dockBox.height}`);

  await splitter.focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(60);
  const persistedHeight=(await dock.boundingBox()).height;
  assert.ok(persistedHeight>=315&&persistedHeight<=325,`keyboard resize must use the shared 20px step: ${persistedHeight}`);
  assert.ok(Math.abs(await page.evaluate(()=>Number(localStorage.getItem(window.WeiG.StorageKeys.torrentDetailDockHeight)))-persistedHeight)<=3,'keyboard resize must persist height');

  // Extreme upward drag must preserve the primary Torrent pane min-height.
  sepBox=await splitter.boundingBox();
  await page.mouse.move(sepBox.x+sepBox.width/2,sepBox.y+sepBox.height/2);await page.mouse.down();await page.mouse.move(sepBox.x+sepBox.width/2,1,{steps:8});await page.mouse.up();
  const clamped=await page.evaluate(()=>({list:document.getElementById('torrent-list').clientHeight,dock:document.getElementById('torrent-detail-dock').clientHeight}));
  assert.ok(clamped.list>=175,`SplitPane max clamp must preserve the Torrent list minimum: ${JSON.stringify(clamped)}`);
  await splitter.dblclick();await splitter.focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');

  // Reload keeps geometry but not ephemeral Selection; reopening the Dock restores the persisted size.
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#torrent-list [data-hash]',{state:'visible',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#torrent-detail-tabs .tab').length===5,null,{timeout:30000});
  assert.equal(await page.evaluate(()=>window.WeiG.Selection.count()),0,'Torrent Selection must remain ephemeral across reload');
  await selectOnlyByRow(page,0);
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForSelector('#torrent-detail-dock:not([hidden]) .general-detail',{state:'visible',timeout:30000});
  const restoredHeight=(await page.locator('#torrent-detail-dock').boundingBox()).height;
  assert.ok(Math.abs(restoredHeight-320)<=5,`Dock must restore the one persisted geometry value after reload: ${restoredHeight}`);

  // Pager adapts by its own available width: compact navigation first, then a one-line horizontally scrollable tab rail.
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.setViewportSize({width:360,height:760});await page.waitForTimeout(180);
  const responsive=await page.evaluate(()=>{const pager=document.querySelector('#list-view .torrent-pager'),rail=document.getElementById('torrent-detail-tabs'),nav=pager.querySelector('.pager__nav'),tabs=[...rail.querySelectorAll('.tab')],full=document.querySelector('.pager-index-copy--full'),compact=document.querySelector('.pager-index-copy--compact'),rect=node=>node.getBoundingClientRect(),railStyle=getComputedStyle(rail);return{pager:rect(pager),nav:rect(nav),tops:[...new Set(tabs.map(node=>Math.round(rect(node).top)))],railClient:rail.clientWidth,railScroll:rail.scrollWidth,railOverflowX:railStyle.overflowX,full:getComputedStyle(full).display,compact:getComputedStyle(compact).display,prevCopy:getComputedStyle(nav.querySelector('.pager__copy')).display};});
  assert.equal(responsive.tops.length,1,`Detail tabs must never wrap into multiple rows: ${JSON.stringify(responsive)}`);
  assert.equal(responsive.full,'none');assert.notEqual(responsive.compact,'none');assert.equal(responsive.prevCopy,'none');
  assert.equal(responsive.railOverflowX,'auto',`Detail tab rail must own horizontal scrolling whenever translated tab copy actually exceeds available width: ${JSON.stringify(responsive)}`);
  assert.ok(responsive.railScroll>=responsive.railClient,`Detail tab rail geometry must remain scroll-safe without forcing synthetic overflow when all tabs fit: ${JSON.stringify(responsive)}`);
  assert.ok(responsive.nav.right<=responsive.pager.right+1&&responsive.nav.right>=responsive.pager.right-8,`compact pager must stay right-anchored: ${JSON.stringify(responsive)}`);
  await page.setViewportSize({width:1200,height:850});await page.waitForTimeout(180);

  // Full Detail route remains available and owns its own Back affordance.
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.locator('#torrent-list .torrent-title').first().click();
  await page.waitForFunction(()=>window.WeiG.Router.route().name==='torrent'&&document.getElementById('detail-view')?.classList.contains('is-active'),null,{timeout:30000});
  assert.equal(await page.locator('#detail-view [data-detail-back]').count(),1,'full Detail route must retain Back to torrents');
  assert.equal(await page.locator('#torrent-detail-dock:not([hidden])').count(),0,'full Detail route must not leave the inline Dock open');
  await page.locator('#detail-view .detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForSelector('#detail-content>.shared-table__toolbar [data-detail-columns]',{state:'visible',timeout:30000});
  assert.equal(await page.locator('#detail-content>.shared-table__toolbar [data-detail-columns]').count(),1,'full Detail route must retain Column settings chrome');

  assert.deepEqual(errors,[],`A35 modern Detail Dock emitted page errors:\n${errors.join('\n')}`);
  await context.close();
  return persistHash;
}

async function verifyLegacy(){
  const context=await browser.newContext({viewport:{width:1100,height:760},locale:'zh-CN'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  await openSession(page,{qb:'4.1.9.1',count:28,seed:'a35-detail-dock-legacy'});
  await selectOnlyByRow(page,0);
  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForSelector('#torrent-detail-dock-content .shared-table__viewport',{state:'visible',timeout:30000});
  const state=await page.evaluate(()=>({route:window.WeiG.Router.route().name,tab:window.WeiG.AppState.detailDockTab,profile:document.getElementById('qb-version')?.textContent||''}));
  assert.equal(state.route,'home');assert.equal(state.tab,'trackers');assert.ok(state.profile.includes('4.1.9.1'),'legacy gate must run against qB 4.1.9.1');
  assert.deepEqual(errors,[],`A35 legacy Detail Dock emitted page errors:\n${errors.join('\n')}`);
  await context.close();
}

await waitForSha();
const browser=await launchBrowser();
try{
  await verifyModern();
  await verifyLegacy();
}finally{await browser.close();}

console.log(`A35 Pages Detail Dock acceptance passed for ${expectedSha}: shared source-driven tabs, inline route isolation, selection rebinding, full-width persisted SplitPane geometry, collision-aware centered adaptive pager, no-wrap tab rail, reload persistence, full Detail route preservation, and qB 4.1.9.1 compatibility.`);

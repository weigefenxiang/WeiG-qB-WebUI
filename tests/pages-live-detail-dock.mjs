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

async function waitForDockSettled(page){
  await page.waitForFunction(()=>!document.getElementById('torrent-detail-dock')?.dataset.surfaceTransition,null,{timeout:5000});
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
async function installMotionProbe(page){
  await page.evaluate(()=>{
    const S=window.WeiG?.SurfaceTransition;if(!S||window.__weigMotionProbeInstalled)return;
    const facts=node=>node&&typeof node.getAnimations==='function'?node.getAnimations().map(animation=>({duration:Number(animation.effect?.getTiming?.().duration)||0,playState:String(animation.playState||'')})):[];
    const log=[];window.__weigMotionProbe=log;window.__weigMotionProbeInstalled=true;
    for(const method of ['enter','exitSnapshot','morph']){
      const original=S[method];if(typeof original!=='function')continue;
      S[method]=function(...args){
        const kind=String(method==='morph'?args[2]:args[1]||'surface'),result=original.apply(this,args),target=method==='enter'?args[0]:(method==='morph'?args[1]:null);
        log.push({method,kind,policy:S.policy(kind),targetAnimations:facts(target),ghosts:[...document.querySelectorAll('.surface-transition-ghost')].map(node=>({className:node.className,animations:facts(node)}))});
        return result;
      };
    }
  });
}
async function setMotion(page,value){
  await page.evaluate(next=>{const cfg=window.WeiG.Config.load();cfg.motion=next;window.WeiG.Config.save(cfg);window.WeiG.Config.apply(cfg);},value);
  await page.waitForFunction(next=>document.documentElement.dataset.motion===next,value,{timeout:5000});
}
async function clearMotionProbe(page){await page.evaluate(()=>{if(Array.isArray(window.__weigMotionProbe))window.__weigMotionProbe.length=0;});}
async function lastMotionProbe(page,method){return page.evaluate(name=>[...(window.__weigMotionProbe||[])].reverse().find(item=>item.method===name)||null,method);}
async function forceOverflowPreviewTarget(page,selector,width){
  await page.waitForFunction(({selector,width})=>{
    const node=document.querySelector(selector);if(!node)return false;
    node.style.width=width+'px';node.style.maxWidth=width+'px';
    return node.dataset.uiOverflowPreview==='1'&&node.clientWidth>0&&node.scrollWidth>node.clientWidth+1;
  },{selector,width},{timeout:5000});
  const node=page.locator(selector).first();
  await node.hover();
  await page.waitForSelector('.ui-floating-preview',{state:'visible',timeout:5000});
  return node;
}

async function verifyModern(){
  const context=await browser.newContext({viewport:{width:1200,height:850},locale:'zh-CN'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  await openSession(page);
  await installMotionProbe(page);
  await setMotion(page,'system');

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

  const listTitle=page.locator('#torrent-list .torrent-title').first();
  const listTitleText=String(await listTitle.textContent()||'').trim();
  await forceOverflowPreviewTarget(page,'#torrent-list .torrent-title',96);
  assert.equal(String(await page.locator('.ui-floating-preview').textContent()||'').trim(),listTitleText,'clipped Torrent list title hover must reuse the bounded floating preview owner');
  await page.mouse.move(4,4);await page.waitForTimeout(180);

  const zeroSubject=await page.evaluate(()=>{const viewport=document.getElementById('torrent-list')?.__weigTorrentDataViewport,item=viewport?.firstUnobscuredItem?.();return{selection:window.WeiG.Selection.count(),hash:item?.hash||''};});
  assert.equal(zeroSubject.selection,0);assert.ok(zeroSubject.hash,'zero-selection regression needs a visible Torrent subject');
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForSelector('#torrent-detail-dock:not([hidden]) .general-detail',{state:'visible',timeout:30000});
  const zeroOpened=await page.evaluate(()=>({hash:window.WeiG.AppState.detailDockHash,open:window.WeiG.AppState.detailDockOpen,selection:window.WeiG.Selection.count(),active:[...document.querySelectorAll('#torrent-detail-tabs .tab.is-active')].map(node=>node.dataset.tab),preview:[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject')].map(node=>node.dataset.hash),previewChecked:[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject .torrent-select')].map(node=>node.checked)}));
  assert.equal(zeroOpened.selection,0,'Detail preview must not mutate the explicit Selection owner');assert.equal(zeroOpened.hash,zeroSubject.hash);assert.equal(zeroOpened.open,true);assert.deepEqual(zeroOpened.active,['overview']);assert.deepEqual(zeroOpened.preview,[zeroSubject.hash],'zero-selection Detail subject must receive a presentation-only selected treatment');assert.ok(zeroOpened.previewChecked.every(value=>value===false),'presentation-only Detail subject must not check the real Selection input');
  const osReduced=await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),systemEnter=await lastMotionProbe(page,'enter');
  assert.equal(systemEnter?.kind,'dock','system motion must enter the inline Dock through the canonical SurfaceTransition owner');
  assert.equal(systemEnter?.policy?.mode,osReduced?'reduced':'system','system motion must follow the browser reduced-motion preference');
  if(osReduced)assert.equal(systemEnter.policy.duration,0,'system motion must reduce to zero when the OS requests reduced motion');
  else assert.ok(systemEnter.policy.duration>0&&systemEnter.targetAnimations.some(item=>item.duration>=systemEnter.policy.duration-1),`system Dock entry must own a real bounded WAAPI animation: ${JSON.stringify(systemEnter)}`);
  await waitForDockSettled(page);
  await page.evaluate(()=>{const list=document.getElementById('torrent-list');list.scrollTop=Math.min(list.scrollHeight-list.clientHeight,list.scrollTop+Math.max(180,list.clientHeight*.55));list.dispatchEvent(new Event('scroll'));});await page.waitForTimeout(2400);
  const zeroAfterScroll=await page.evaluate(()=>({hash:window.WeiG.AppState.detailDockHash,selection:window.WeiG.Selection.count(),visiblePreview:[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject')].map(node=>node.dataset.hash)}));
  assert.equal(zeroAfterScroll.selection,0);assert.equal(zeroAfterScroll.hash,zeroSubject.hash,'zero-selection Detail subject must stay captured while the Torrent list scrolls');assert.ok(zeroAfterScroll.visiblePreview.every(hash=>hash===zeroSubject.hash),'recycled row shells must never leak Detail preview styling onto a different Torrent');
  await page.evaluate(()=>{const list=document.getElementById('torrent-list');list.scrollTop=0;list.dispatchEvent(new Event('scroll'));});await page.waitForTimeout(220);
  await page.waitForFunction(expected=>[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject')].some(node=>node.dataset.hash===expected),zeroSubject.hash,{timeout:10000});
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForFunction(()=>!window.WeiG.AppState.detailDockOpen,null,{timeout:10000});

  const firstHash=await selectOnlyByRow(page,0);
  await page.waitForFunction(()=>[...document.querySelectorAll('#torrent-detail-tabs .tab')].every(node=>!node.disabled),null,{timeout:10000});
  await setMotion(page,'full');await clearMotionProbe(page);

  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForSelector('#torrent-detail-dock:not([hidden]) .general-detail',{state:'visible',timeout:30000});
  const opened=await page.evaluate(expected=>({
    route:window.WeiG.Router.route().name,
    hash:window.WeiG.AppState.detailDockHash,
    tab:window.WeiG.AppState.detailTab,
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
  const fullEnter=await lastMotionProbe(page,'enter');
  assert.equal(fullEnter?.kind,'dock');assert.equal(fullEnter?.policy?.mode,'full','explicit full motion must not be downgraded by the OS preference');
  assert.ok(fullEnter.policy.duration>Number(systemEnter?.policy?.duration||0)&&fullEnter.policy.offset>Number(systemEnter?.policy?.offset||0)&&fullEnter.policy.blur>Number(systemEnter?.policy?.blur||0),`full motion must be visibly richer than system/reduced motion: system=${JSON.stringify(systemEnter?.policy)} full=${JSON.stringify(fullEnter?.policy)}`);
  assert.ok(fullEnter.targetAnimations.some(item=>item.duration>=fullEnter.policy.duration-1),`full Dock entry must execute the canonical WAAPI animation: ${JSON.stringify(fullEnter)}`);
  await waitForDockSettled(page);
  await setMotion(page,'system');
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
    tab:window.WeiG.AppState.detailTab,
    active:[...document.querySelectorAll('#torrent-detail-tabs .tab.is-active')].map(node=>node.dataset.tab),
    mainLeft:document.getElementById('torrent-list').scrollLeft,
    detailViewport:!!document.querySelector('#torrent-detail-dock-content .shared-table__viewport'),
    toolbarCount:document.querySelectorAll('#torrent-detail-dock-content>.shared-table__toolbar').length,
    summaryCount:document.querySelectorAll('#torrent-detail-dock-content>.section-note').length
  }));
  assert.equal(trackerState.route,'home');assert.equal(trackerState.tab,'trackers');assert.deepEqual(trackerState.active,['trackers']);assert.equal(trackerState.detailViewport,true);assert.equal(trackerState.toolbarCount,0,'inline Detail tables must hide the Column settings toolbar row');assert.equal(trackerState.summaryCount,0,'inline Detail tables must hide the toolbar summary row with the Column settings control');
  if(scrollState.max>0)assert.equal(trackerState.mainLeft,scrollState.left,'switching Detail tabs must not reset Main Torrent horizontal scroll');

  const fallbackCopied=await page.evaluate(async()=>{
    const own=Object.getOwnPropertyDescriptor(navigator,'clipboard'),originalExec=document.execCommand;let copied='';
    try{
      Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});
      document.execCommand=function(command){if(command!=='copy')return false;var node=document.activeElement;copied=node&&typeof node.value==='string'?node.value:'';return true;};
      await window.WeiG.Clipboard.writeText('https://tracker.example/announce');
      return copied;
    }finally{
      document.execCommand=originalExec;
      if(own)Object.defineProperty(navigator,'clipboard',own);else delete navigator.clipboard;
    }
  });
  assert.equal(fallbackCopied,'https://tracker.example/announce','shared Clipboard owner must fall back when Async Clipboard is unavailable, including insecure LAN-style browser contexts');

  const sourceTabKeys=await page.locator('#torrent-detail-tabs .tab').evaluateAll(nodes=>nodes.map(node=>node.dataset.tab));
  assert.deepEqual(sourceTabKeys,['overview','trackers','peers','webseeds','files'],'inline Dock must expose the complete source-driven qB Detail tab family in source order');
  for(const tab of ['webseeds','files']){
    await page.locator(`#torrent-detail-tabs .tab[data-tab="${tab}"]`).click();
    await page.waitForSelector('#torrent-detail-dock-content .shared-table__viewport',{state:'visible',timeout:30000});
    const state=await page.evaluate(()=>({route:window.WeiG.Router.route().name,tab:window.WeiG.AppState.detailTab,active:[...document.querySelectorAll('#torrent-detail-tabs .tab.is-active')].map(node=>node.dataset.tab)}));
    assert.equal(state.route,'home',`${tab} Dock switch must stay on the Torrent Library route`);
    assert.equal(state.tab,tab);assert.deepEqual(state.active,[tab]);
  }
  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForFunction(()=>window.WeiG.AppState.detailDockOpen&&window.WeiG.AppState.detailTab==='trackers',null,{timeout:10000});
  const rememberedPreviewHash=await selectOnlyByRow(page,4);
  await page.locator(`#torrent-list [data-hash="${rememberedPreviewHash}"] .torrent-select`).click();
  await page.waitForFunction(expected=>window.WeiG.Selection.count()===0&&window.WeiG.AppState.detailDockHash===expected,rememberedPreviewHash,{timeout:10000});

  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForFunction(()=>!window.WeiG.AppState.detailDockOpen&&document.getElementById('torrent-detail-dock').hidden&&document.getElementById('torrent-detail-splitter').hidden,null,{timeout:10000});
  assert.equal(await page.locator('#torrent-detail-tabs .tab.is-active').count(),0,'clicking the active tab must collapse and clear active presentation');
  await page.waitForFunction(()=>document.querySelectorAll('.surface-transition-ghost').length===0,null,{timeout:5000});

  await setMotion(page,'reduced');await clearMotionProbe(page);
  await page.locator('#torrent-detail-tabs .tab[data-tab="peers"]').click();
  await page.waitForSelector('#torrent-detail-dock-content .shared-table__viewport',{state:'visible',timeout:30000});
  const reopenedPreview=await page.evaluate(()=>({selection:window.WeiG.Selection.count(),hash:window.WeiG.AppState.detailDockHash,preview:[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject')].map(node=>node.dataset.hash)}));
  assert.equal(reopenedPreview.selection,0,'reopening a Detail tab must not convert remembered preview into Selection');assert.equal(reopenedPreview.hash,rememberedPreviewHash,'reopening a Detail tab must preserve the prior zero-selection shared subject instead of recapturing the first visible Torrent');assert.deepEqual(reopenedPreview.preview,[rememberedPreviewHash]);
  const reducedEnter=await lastMotionProbe(page,'enter');
  assert.equal(reducedEnter?.policy?.mode,'reduced');assert.equal(reducedEnter?.policy?.duration,0,'explicit reduced motion must suppress shared surface animation');
  assert.equal(reducedEnter?.targetAnimations?.length,0,`reduced Dock entry must not create a WAAPI animation: ${JSON.stringify(reducedEnter)}`);
  assert.equal(reducedEnter?.ghosts?.length,0,'reduced Dock entry must not create a transition ghost');
  await setMotion(page,'system');
  const zeroRouteTarget=firstHash;
  await page.locator(`#torrent-list [data-hash="${zeroRouteTarget}"] .torrent-title`).click();
  await page.waitForFunction(expected=>window.WeiG.Router.route().name==='torrent'&&window.WeiG.AppState.detailHash===expected&&window.WeiG.AppState.detailDockHash===expected&&window.WeiG.Selection.count()===0,zeroRouteTarget,{timeout:30000});
  await page.locator('#detail-view [data-detail-back]').click();
  await page.waitForFunction(expected=>window.WeiG.Router.route().name==='home'&&window.WeiG.AppState.detailDockOpen&&window.WeiG.AppState.detailHash===expected&&window.WeiG.AppState.detailDockHash===expected&&window.WeiG.Selection.count()===0&&[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject')].some(node=>node.dataset.hash===expected),zeroRouteTarget,{timeout:30000});
  const zeroRouteReturn=await page.evaluate(()=>({selection:window.WeiG.Selection.count(),detailHash:window.WeiG.AppState.detailHash,dockHash:window.WeiG.AppState.detailDockHash,preview:[...document.querySelectorAll('#torrent-list [data-hash].is-detail-subject')].map(node=>node.dataset.hash),checked:[...document.querySelectorAll('#torrent-list .torrent-select:checked')].map(node=>node.closest('[data-hash]')?.dataset.hash||'')}));
  assert.equal(zeroRouteReturn.selection,0,'zero-selection Full Detail navigation must not mutate Selection');assert.equal(zeroRouteReturn.detailHash,zeroRouteTarget);assert.equal(zeroRouteReturn.dockHash,zeroRouteTarget);assert.deepEqual(zeroRouteReturn.preview,[zeroRouteTarget],'Back must keep the explicitly opened Torrent as the zero-selection preview subject');assert.deepEqual(zeroRouteReturn.checked,[],'zero-selection route return must not check a Torrent');
  const secondHash=await selectOnlyByRow(page,1);
  await page.waitForFunction(expected=>window.WeiG.AppState.detailDockOpen&&window.WeiG.AppState.detailDockHash===expected&&window.WeiG.AppState.detailTab==='peers',secondHash,{timeout:30000});
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

  // Extreme upward/downward drags must expose the full semantic track: sticky Torrent header <-> Detail tabs/pager.
  sepBox=await splitter.boundingBox();
  await page.mouse.move(sepBox.x+sepBox.width/2,sepBox.y+sepBox.height/2);await page.mouse.down();await page.mouse.move(sepBox.x+sepBox.width/2,1,{steps:8});await page.mouse.up();
  const clamped=await page.evaluate(()=>{const list=document.getElementById('torrent-list'),head=document.getElementById('torrent-table-head'),split=document.getElementById('torrent-detail-splitter'),dock=document.getElementById('torrent-detail-dock'),pager=document.querySelector('#list-view .torrent-pager'),rect=node=>{const r=node.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height};};return{list:rect(list),head:rect(head),split:rect(split),dock:rect(dock),pager:rect(pager),now:Number(split.getAttribute('aria-valuenow')),max:Number(split.getAttribute('aria-valuemax'))};});
  assert.ok(clamped.list.height>=clamped.head.height-1&&Math.abs(clamped.split.top-clamped.head.bottom)<=3&&Math.abs(clamped.dock.bottom-clamped.pager.top)<=3&&Math.abs(clamped.now-clamped.max)<=1,`SplitPane max clamp must stop at the bottom of the runtime-mounted Torrent header while retaining only the real header minimum: ${JSON.stringify(clamped)}`);
  sepBox=await splitter.boundingBox();
  await page.mouse.move(sepBox.x+sepBox.width/2,sepBox.y+sepBox.height/2);await page.mouse.down();await page.mouse.move(sepBox.x+sepBox.width/2,2000,{steps:8});await page.mouse.up();
  const collapsed=await page.evaluate(()=>{const split=document.getElementById('torrent-detail-splitter'),dock=document.getElementById('torrent-detail-dock'),pager=document.querySelector('#list-view .torrent-pager'),sr=split.getBoundingClientRect(),dr=dock.getBoundingClientRect(),pr=pager.getBoundingClientRect();return{dockHeight:dr.height,splitBottom:sr.bottom,pagerTop:pr.top,now:Number(split.getAttribute('aria-valuenow')),min:Number(split.getAttribute('aria-valuemin'))};});
  assert.ok(collapsed.min===0&&collapsed.now===0&&collapsed.dockHeight<=3&&Math.abs(collapsed.splitBottom-collapsed.pagerTop)<=3,`SplitPane minimum must collapse to the Detail tabs/pager boundary: ${JSON.stringify(collapsed)}`);
  await splitter.dblclick();await splitter.focus();await page.keyboard.press('ArrowUp');await page.keyboard.press('ArrowUp');

  // Reload keeps geometry but not ephemeral Selection; reopening the Dock restores the persisted size.
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#torrent-list [data-hash]',{state:'visible',timeout:60000});
  await page.waitForFunction(()=>document.querySelectorAll('#torrent-detail-tabs .tab').length===5,null,{timeout:30000});
  await installMotionProbe(page);await setMotion(page,'system');
  assert.equal(await page.evaluate(()=>window.WeiG.Selection.count()),0,'Torrent Selection must remain ephemeral across reload');
  await selectOnlyByRow(page,0);
  await page.locator('#torrent-detail-tabs .tab[data-tab="overview"]').click();
  await page.waitForSelector('#torrent-detail-dock:not([hidden]) .general-detail',{state:'visible',timeout:30000});
  await waitForDockSettled(page);
  const restoredGeometry=await page.evaluate(()=>{const dock=document.getElementById('torrent-detail-dock'),split=document.getElementById('torrent-detail-splitter'),stored=Number(localStorage.getItem(window.WeiG.StorageKeys.torrentDetailDockHeight)),min=Number(split?.getAttribute('aria-valuemin')),max=Number(split?.getAttribute('aria-valuemax')),height=dock?.getBoundingClientRect().height||0;return{stored,min,max,height,expected:Math.min(max,Math.max(min,stored))};});
  assert.ok(Number.isFinite(restoredGeometry.stored)&&Number.isFinite(restoredGeometry.max),'reload geometry gate requires persisted size and live SplitPane bounds');
  assert.ok(Math.abs(restoredGeometry.height-restoredGeometry.expected)<=5,`Dock reload must restore the persisted preferred size clamped by the live semantic track: ${JSON.stringify(restoredGeometry)}`);

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
  // The responsive probe above intentionally toggled Overview closed; reopen a real
  // inline surface first, then snapshot its effective height for the route-return proof.
  await setMotion(page,'full');await clearMotionProbe(page);
  await page.locator('#torrent-detail-tabs .tab[data-tab="peers"]').click();
  await page.waitForSelector('#torrent-detail-dock-content .shared-table__viewport',{state:'visible',timeout:30000});
  await waitForDockSettled(page);
  const preRouteDockBox=await page.locator('#torrent-detail-dock').boundingBox();
  assert.ok(preRouteDockBox&&preRouteDockBox.height>0,'route-return height proof requires the settled inline Detail Dock, not an in-flight shared transition frame');
  const preRouteDockHeight=preRouteDockBox.height;
  await clearMotionProbe(page);
  const routeTargetHash=await page.locator('#torrent-list [data-hash]').first().getAttribute('data-hash');
  assert.ok(routeTargetHash&&routeTargetHash!==persistHash,'single-selection route-return gate requires opening a Torrent different from the currently selected subject');
  await page.locator('#torrent-list .torrent-title').first().click();
  await page.waitForFunction(expected=>window.WeiG.Router.route().name==='torrent'&&window.WeiG.Router.route().tab==='peers'&&document.getElementById('detail-view')?.classList.contains('is-active')&&document.querySelector('#detail-view .detail-tabs .tab[data-tab="peers"]')?.classList.contains('is-active')&&window.WeiG.AppState.detailHash===expected&&window.WeiG.AppState.detailDockHash===expected&&window.WeiG.Selection.count()===1&&window.WeiG.Selection.primary()===expected,routeTargetHash,{timeout:30000});
  await page.waitForFunction(()=>Array.isArray(window.__weigMotionProbe)&&window.__weigMotionProbe.some(item=>item.method==='morph'),null,{timeout:10000});
  const detailMorph=await lastMotionProbe(page,'morph');
  assert.equal(detailMorph?.kind,'detail');assert.equal(detailMorph?.policy?.mode,'full');assert.ok(detailMorph.policy.duration>0,'Dock-to-full-Detail must execute a real shared-element morph in full motion');
  assert.ok(detailMorph.ghosts.some(item=>String(item.className).includes('surface-transition-ghost--morph')&&item.animations.some(animation=>animation.duration>=detailMorph.policy.duration-1)),`Dock-to-full-Detail morph must animate the canonical presentation ghost: ${JSON.stringify(detailMorph)}`);
  await page.waitForFunction(()=>document.querySelectorAll('.surface-transition-ghost--morph').length===0,null,{timeout:5000});
  await setMotion(page,'system');
  assert.equal(await page.locator('#detail-view [data-detail-back]').count(),1,'full Detail route must retain Back to torrents');
  const fullHostState=await page.evaluate(()=>({semanticOpen:WeiG.AppState?.detailDockOpen===true,tab:WeiG.AppState?.detailTab||'',hash:WeiG.AppState?.detailDockHash||'',detailHash:WeiG.AppState?.detailHash||'',selection:WeiG.Selection.count(),primary:WeiG.Selection.primary(),selected:WeiG.Selection.hashes(),listActive:document.getElementById('list-view')?.classList.contains('is-active')||false,dockChildren:document.getElementById('torrent-detail-dock-content')?.childElementCount??-1,routeChildren:document.getElementById('detail-content')?.childElementCount??-1}));
  assert.equal(fullHostState.semanticOpen,true,`full Detail must preserve the shared inline semantic session: ${JSON.stringify(fullHostState)}`);
  assert.equal(fullHostState.tab,'peers',`full Detail handoff must preserve the active tab: ${JSON.stringify(fullHostState)}`);
  assert.equal(fullHostState.hash,routeTargetHash,`Full Detail activation must rebind the shared Dock subject to the explicitly opened Torrent: ${JSON.stringify(fullHostState)}`);assert.equal(fullHostState.detailHash,routeTargetHash);assert.equal(fullHostState.selection,1);assert.equal(fullHostState.primary,routeTargetHash);assert.deepEqual(fullHostState.selected,[routeTargetHash],'opening another Torrent with one existing selection must transfer that single selection instead of retaining the stale row');
  assert.equal(fullHostState.listActive,false,`full Detail route must deactivate the Library presentation: ${JSON.stringify(fullHostState)}`);
  assert.equal(fullHostState.dockChildren,0,`inactive inline Detail host must release stale DOM while full Detail owns presentation: ${JSON.stringify(fullHostState)}`);
  assert.ok(fullHostState.routeChildren>0,`full Detail host must own the live presentation DOM: ${JSON.stringify(fullHostState)}`);
  const detailTitle=page.locator('#detail-title'),detailTitleText=String(await detailTitle.textContent()||'').trim();
  await forceOverflowPreviewTarget(page,'#detail-title',150);
  assert.equal(String(await page.locator('.ui-floating-preview').textContent()||'').trim(),detailTitleText,'clipped full Detail title hover must expose the complete Torrent name within the shared bounded preview');
  await page.mouse.move(4,4);await page.waitForTimeout(180);
  await page.locator('#detail-view .detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForSelector('#detail-content>.shared-table__toolbar [data-detail-columns]',{state:'visible',timeout:30000});
  assert.equal(await page.locator('#detail-content>.shared-table__toolbar [data-detail-columns]').count(),1,'full Detail route must retain Column settings chrome');
  await page.locator('#detail-view [data-detail-back]').click();
  await page.waitForFunction(expected=>window.WeiG.Router.route().name==='home'&&window.WeiG.AppState.detailDockOpen&&window.WeiG.AppState.detailTab==='trackers'&&!document.getElementById('torrent-detail-dock').hidden&&window.WeiG.AppState.detailHash===expected&&window.WeiG.AppState.detailDockHash===expected&&window.WeiG.Selection.count()===1&&window.WeiG.Selection.primary()===expected,routeTargetHash,{timeout:30000});
  const routeReturnSubject=await page.evaluate(()=>({detailHash:WeiG.AppState.detailHash,dockHash:WeiG.AppState.detailDockHash,selection:WeiG.Selection.count(),primary:WeiG.Selection.primary(),selected:[...document.querySelectorAll('#torrent-list [data-hash].is-selected')].map(node=>node.dataset.hash),checked:[...document.querySelectorAll('#torrent-list .torrent-select:checked')].map(node=>node.closest('[data-hash]')?.dataset.hash||'')}));
  assert.equal(routeReturnSubject.detailHash,routeTargetHash);assert.equal(routeReturnSubject.dockHash,routeTargetHash);assert.equal(routeReturnSubject.selection,1);assert.equal(routeReturnSubject.primary,routeTargetHash);assert.deepEqual(routeReturnSubject.selected,[routeTargetHash],'Back must highlight the explicitly opened Torrent, not the pre-route selected row');assert.deepEqual(routeReturnSubject.checked,[routeTargetHash],'Back must retain one checked Torrent and transfer it to the explicitly opened subject');
  const captureRouteReturnGeometry=()=>page.evaluate(()=>{
    const W=window.WeiG,split=W.AppState?.detailSplitPane,panel=document.querySelector('#list-view>.torrent-panel'),stage=document.getElementById('torrent-content-stage'),dock=document.getElementById('torrent-detail-dock'),separator=document.getElementById('torrent-detail-splitter'),pager=document.querySelector('#list-view .torrent-pager'),root=document.getElementById('torrent-detail-dock-content'),head=document.getElementById('torrent-table-head'),listView=document.getElementById('list-view'),rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};},style=node=>{if(!node)return null;const s=getComputedStyle(node);return{display:s.display,height:s.height,flex:s.flex,flexBasis:s.flexBasis,minHeight:s.minHeight,maxHeight:s.maxHeight};};
    const panelRect=rect(panel),stageRect=rect(stage),pagerRect=rect(pager),track=panel&&stage&&pager?Math.max(0,(panelRect.top+Math.max(0,Number(panel.clientTop)||0)+Math.max(0,Number(panel.clientHeight)||0))-pagerRect.height-stageRect.top):null;
    return{route:W.Router?.route?.(),semanticOpen:W.AppState?.detailDockOpen===true,tab:W.AppState?.detailTab||'',hash:W.AppState?.detailDockHash||'',split:{isOpen:split?.isOpen?.(),size:split?.size?.(),preferred:split?.preferredSize?.()},stored:Number(localStorage.getItem(W.StorageKeys.torrentDetailDockHeight)),aria:{now:Number(separator?.getAttribute('aria-valuenow')),min:Number(separator?.getAttribute('aria-valuemin')),max:Number(separator?.getAttribute('aria-valuemax'))},children:root?.childElementCount??-1,track,headerHeight:head?.getBoundingClientRect().height??null,rects:{listView:rect(listView),panel:panelRect,stage:stageRect,dock:rect(dock),separator:rect(separator),pager:pagerRect},styles:{listView:style(listView),panel:style(panel),stage:style(stage),dock:style(dock),separator:style(separator)}};});
  try{
    await page.waitForFunction(expected=>{const dock=document.getElementById('torrent-detail-dock'),root=document.getElementById('torrent-detail-dock-content');return !!dock&&!!root&&root.childElementCount>0&&Math.abs(dock.getBoundingClientRect().height-expected)<=4;},preRouteDockHeight,{timeout:5000});
  }catch(error){
    const beforeManualRefresh=await captureRouteReturnGeometry();
    await page.evaluate(()=>window.WeiG?.AppState?.detailSplitPane?.refresh?.());
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const afterManualRefresh=await captureRouteReturnGeometry();
    assert.fail(`Full Detail route-return geometry did not converge after canonical remount; expected=${preRouteDockHeight}; beforeManualRefresh=${JSON.stringify(beforeManualRefresh)}; afterManualRefresh=${JSON.stringify(afterManualRefresh)}; wait=${error.message}`);
  }
  const postRouteDockHeight=(await page.locator('#torrent-detail-dock').boundingBox()).height;
  assert.ok(Math.abs(postRouteDockHeight-preRouteDockHeight)<=4,`returning from Full Detail must restore the preferred inline Dock height through the shared post-layout reprojection: before=${preRouteDockHeight}, after=${postRouteDockHeight}`);

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
  const state=await page.evaluate(()=>({route:window.WeiG.Router.route().name,tab:window.WeiG.AppState.detailTab,profile:document.getElementById('qb-version')?.textContent||''}));
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

console.log(`A35 Pages Detail Dock acceptance passed for ${expectedSha}: shared source-driven tabs, inline route isolation, selection rebinding, full-width persisted SplitPane geometry, collision-aware centered adaptive pager, no-wrap tab rail, reload persistence, bounded Torrent-title previews, shared clipboard fallback, full Detail route preservation, and qB 4.1.9.1 compatibility.`);

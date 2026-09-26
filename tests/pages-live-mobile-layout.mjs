import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';
import {recoverPageSession} from './pages-live-session.mjs';

const rawBase=(process.env.WEIG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sessionTimeoutMs=Math.max(5000,Number(process.env.WEIG_PAGES_SESSION_TIMEOUT_MS||20000)||20000);

async function waitForDeployedSha(){
  let last='not fetched';
  for(let attempt=0;attempt<40;attempt++){
    try{
      const url=new URL('metadata/site.json',base);url.searchParams.set('__live_sha',expectedSha);
      const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
      const site=response.ok?await response.json():null;last=site?.simulatorSha||`HTTP ${response.status}`;
      if(last===expectedSha)return site;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages did not expose simulator SHA ${expectedSha}; last observation: ${last}`);
}

await waitForDeployedSha();
const browser=await launchBrowser();
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    const text=message.text();
    const source=String(message.location()?.url||'');
    if(/favicon(?:\.ico)?|Wei\.G\.ico/i.test(`${source} ${text}`))return;
    errors.push(source?`${text} (${source})`:text);
  });

  const sessionId=`pages-mobile-${Date.now()}`;
  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({sim:sessionId,qb:'5.2.3',count:'80',scenario:'mixed',seed:'mobile-layout-047'}).toString();
  const recovered=await recoverPageSession(page,{
    label:`Pages mobile layout ${sessionId}`,
    qbVersion:'5.2.3',
    timeoutMs:sessionTimeoutMs,
    navigate:async attempt=>{
      const target=new URL(url);
      target.searchParams.set('__weig_session_attempt',String(attempt));
      await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:sessionTimeoutMs});
    },
    onLogin:async()=>{await page.locator('#login-btn').click();}
  });
  if(recovered.attempt>1)console.log(`Recovered Pages mobile layout ${sessionId} on attempt ${recovered.attempt}.`);
  await page.waitForFunction(()=>window.WeiG?.SessionController?.readLocaleBootstrap?.()?.initialized===true,null,{timeout:30000});
  await page.waitForTimeout(1800);
  await page.waitForFunction(()=>window.WeiG?.I18n?.getQbLocale?.()==='zh_CN',null,{timeout:30000});
  await page.waitForSelector('.torrent-mobile-card--two-line',{state:'visible',timeout:60000});
  await page.evaluate(()=>{if(window.WeiG?.I18n?.setLocale)WeiG.I18n.setLocale('zh-CN');WeiG.TorrentFieldRegistry?.saveMobileFields?.(['state','size','dlspeed','upspeed','eta','progress']);WeiG.AppState?.viewport?.render?.();WeiG.UiSystem?.enforceMobileHeight?.();});
  await page.waitForTimeout(150);

  const card=await page.locator('.torrent-mobile-card--two-line').first().evaluate(node=>{
    const metrics=node.querySelector('.mobile-card-metrics'),progress=node.querySelector('.mobile-card-progress'),track=progress?.querySelector('.progress-track'),number=progress?.querySelector('.mobile-card-progress__number');
    if(!metrics||!progress||!track||!number)throw new Error('mobile torrent card canonical progress nodes are missing');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    return{metrics:rect(metrics),progress:rect(progress),track:rect(track),number:rect(number),tracks:node.querySelectorAll('.progress-track').length,numberText:(number.textContent||'').trim(),overflow:node.scrollHeight-node.clientHeight};
  });
  assert.equal(card.tracks,1,`mobile torrent card must render one canonical progress track: ${JSON.stringify(card)}`);
  assert.ok(card.progress.top>=card.metrics.bottom-1,`progress must be below metadata: ${JSON.stringify(card)}`);
  assert.ok(card.number.left>=card.track.right-1&&card.numberText.endsWith('%'),`percentage must sit immediately to the right of progress bar: ${JSON.stringify(card)}`);
  assert.ok(card.overflow<=1,`stacked progress must fit the mobile torrent card height: ${JSON.stringify(card)}`);

  const pager=await page.locator('#list-view .pager').evaluate(node=>{
    const nav=node.querySelector('.pager__nav'),actions=node.querySelector('#torrent-selection-toolbar');
    if(!nav||!actions)throw new Error('mobile pager canonical navigation/action nodes are missing');
    const buttons=[...actions.querySelectorAll('button')];
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    const br=buttons.map(b=>({...rect(b),font:parseFloat(getComputedStyle(b).fontSize),text:(b.textContent||'').trim()}));
    return{pager:rect(node),nav:rect(nav),actions:rect(actions),buttons:br,overflow:node.scrollWidth-node.clientWidth};
  });
  assert.equal(pager.buttons.length,4,`mobile action rail must keep Start/Pause/More/Delete: ${JSON.stringify(pager)}`);
  assert.ok(Math.abs(pager.nav.top-pager.actions.top)<=3&&pager.nav.bottom<=pager.pager.bottom+1&&pager.actions.bottom<=pager.pager.bottom+1,`pager and actions must stay on one physical row: ${JSON.stringify(pager)}`);
  assert.ok(pager.buttons.every(button=>button.font>=10.5),`mobile action labels must remain readable at 390px: ${JSON.stringify(pager.buttons)}`);
  assert.ok(pager.buttons.slice(1).every((button,index)=>button.left-pager.buttons[index].right>=2),`mobile action buttons must remain visually separated: ${JSON.stringify(pager.buttons)}`);
  assert.ok(pager.overflow<=1,`single-line pager/action rail must not overflow: ${JSON.stringify(pager)}`);

  await page.locator('#mobile-bottom-nav [data-route="rss"]').click();
  await page.waitForFunction(()=>document.getElementById('rss-view')?.classList.contains('is-active')&&document.querySelector('#rss-view .rss-header-actions')&&document.getElementById('rss-add-open-btn')&&document.getElementById('rss-refresh-btn'));
  const rss=await page.evaluate(()=>{
    const header=document.querySelector('#rss-view>.workspace__header'),actions=header?.querySelector('.rss-header-actions'),add=document.getElementById('rss-add-open-btn'),refresh=document.getElementById('rss-refresh-btn');
    if(!header||!actions||!add||!refresh)throw new Error('RSS mobile header controls are missing');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,display:getComputedStyle(n).display};};
    return{header:rect(header),actions:rect(actions),add:rect(add),refresh:rect(refresh),overflow:header.scrollWidth-header.clientWidth};
  });
  assert.ok(Math.abs(rss.add.top-rss.refresh.top)<=2,`RSS Add Feed and Refresh must share the mobile header row: ${JSON.stringify(rss)}`);
  assert.ok(rss.actions.right<=rss.header.right+1&&rss.actions.left>=rss.header.left-1,`RSS header actions must fit inside the mobile header: ${JSON.stringify(rss)}`);
  assert.ok(rss.overflow<=1,`RSS mobile header must not overflow: ${JSON.stringify(rss)}`);

  await page.locator('#rss-add-open-btn').click();
  await page.waitForSelector('#rss-add-dialog[open] #rss-url',{state:'visible',timeout:30000});
  const rssDialog=await page.evaluate(()=>{
    const dialog=document.getElementById('rss-add-dialog'),url=document.getElementById('rss-url'),add=document.getElementById('rss-add-btn');
    if(!dialog||!url||!add)throw new Error('RSS Add Feed dialog canonical controls are missing');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,display:getComputedStyle(n).display};};
    return{dialog:rect(dialog),url:rect(url),add:rect(add)};
  });
  assert.ok(rssDialog.url.width>200&&rssDialog.url.left>=rssDialog.dialog.left&&rssDialog.url.right<=rssDialog.dialog.right+1,`RSS Feed URL must remain usable inside the mobile Add Feed dialog: ${JSON.stringify(rssDialog)}`);
  assert.notEqual(rssDialog.add.display,'none','RSS Add action must remain visible in the Add Feed dialog');
  await page.locator('#rss-add-dialog .rss-add-dialog__close').click();

  await page.locator('#mobile-bottom-nav [data-route="logs"]').click();
  await page.waitForFunction(()=>document.getElementById('logs-view')?.classList.contains('is-active')&&document.querySelector('.logs-toolbar')&&document.getElementById('mobile-search-btn')&&document.getElementById('search-input'));
  const logs=await page.evaluate(()=>{
    const toolbar=document.querySelector('.logs-toolbar'),filters=document.querySelector('.logs-filters'),actions=document.querySelector('.logs-actions'),searchButton=document.getElementById('mobile-search-btn'),searchInput=document.getElementById('search-input'),chips=filters?[...filters.querySelectorAll('[data-log-type]')]:[];
    if(!toolbar||!filters||!actions||!searchButton||!searchInput)throw new Error('Logs canonical toolbar/Header Search controls are missing');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,display:getComputedStyle(n).display};};
    const pagerMeta=document.querySelector('.logs-pager [data-pager-meta]');
    return{toolbar:rect(toolbar),filters:rect(filters),actions:rect(actions),searchButton:rect(searchButton),chips:chips.length,sizeMode:!!document.getElementById('logs-size-mode'),refresh:!!document.querySelector('.logs-refresh'),searchOpen:document.querySelector('.topbar')?.classList.contains('search-open')||false,placeholder:searchInput.placeholder,overflow:toolbar.scrollWidth-toolbar.clientWidth,pagerMeta:String(pagerMeta?.textContent||'').trim()};
  });
  assert.equal(logs.chips,4,`Logs toolbar must keep Normal/Info/Warning/Critical filters: ${JSON.stringify(logs)}`);
  assert.ok(logs.sizeMode&&logs.refresh,`Logs toolbar must keep size mode and Refresh controls: ${JSON.stringify(logs)}`);
  assert.notEqual(logs.searchButton.display,'none','phone Logs must expose the canonical Header Search button');
  assert.equal(logs.searchOpen,false,'phone Logs Header Search must start collapsed');
  assert.match(logs.placeholder,/日志|logs/i,`Logs Header Search must expose the route-specific placeholder: ${JSON.stringify(logs)}`);
  assert.ok(logs.overflow<=1,`Logs mobile toolbar must not overflow: ${JSON.stringify(logs)}`);
  assert.match(logs.pagerMeta,/^\d+\s*\/\s*\d+$/,`phone Logs pager meta must expose only shown / filtered total: ${JSON.stringify(logs)}`);

  await page.locator('#mobile-search-btn').click();
  await page.waitForFunction(()=>document.querySelector('.topbar')?.classList.contains('search-open')&&getComputedStyle(document.getElementById('search-input')).display!=='none');
  const logSearch=await page.evaluate(()=>({open:document.querySelector('.topbar')?.classList.contains('search-open')||false,visible:getComputedStyle(document.getElementById('search-input')).display!=='none',placeholder:document.getElementById('search-input')?.placeholder||''}));
  assert.equal(logSearch.open,true,'Logs Header Search must open from the canonical mobile search button');
  assert.equal(logSearch.visible,true,'Logs Header Search input must be visible when opened');
  assert.match(logSearch.placeholder,/日志|logs/i,'opened Header Search must retain the Logs-specific placeholder');

  await page.locator('#mobile-bottom-nav [data-route="settings"]').click();
  await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active')&&document.querySelectorAll('#settings-tabs [data-settings-tab]').length>2&&window.WeiG?.SettingsSchema?.nativeSurfaces?.().length>0,null,{timeout:30000});
  const settingsWidths=[320,360,390,430];
  for(const width of settingsWidths){
    await page.setViewportSize({width,height:844});
    await page.waitForTimeout(180);
    const rail=await page.evaluate(()=>{
      const host=document.getElementById('settings-tabs'),buttons=[...host.querySelectorAll('[data-settings-tab]')],qb=[...document.querySelectorAll('#settings-qb-tabs [data-settings-tab]')],native=window.WeiG?.SettingsSchema?.nativeSurfaces?.()||[];
      if(!host||buttons.length<3)throw new Error('Settings mobile tab rail is missing');
      const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
      const br=buttons.map(button=>({...rect(button),tab:button.dataset.settingsTab,text:(button.textContent||'').trim(),whiteSpace:getComputedStyle(button).whiteSpace,flex:getComputedStyle(button).flexShrink}));
      const tops=br.map(item=>Math.round(item.top));
      return{host:rect(host),buttons:br,native,qbTabs:qb.map(button=>button.dataset.settingsTab),rows:[...new Set(tops)],hostOverflow:host.scrollWidth-host.clientWidth,documentOverflow:document.documentElement.scrollWidth-window.innerWidth,groupDisplay:getComputedStyle(document.querySelector('#settings-tabs .settings-nav-group')).display,qbDisplay:getComputedStyle(document.getElementById('settings-qb-tabs')).display,scrollLeft:host.scrollLeft};
    });
    assert.deepEqual(rail.qbTabs,rail.native,`mobile Settings qB tabs must exactly follow source-native surfaces at ${width}px: ${JSON.stringify(rail)}`);
    assert.equal(rail.rows.length,1,`all Settings tabs must stay on one physical row at ${width}px: ${JSON.stringify(rail)}`);
    assert.equal(rail.groupDisplay,'contents',`WeiG Settings group must flatten into the one mobile rail at ${width}px: ${JSON.stringify(rail)}`);
    assert.equal(rail.qbDisplay,'contents',`qB Settings group must flatten into the one mobile rail at ${width}px: ${JSON.stringify(rail)}`);
    assert.ok(rail.buttons.every(button=>button.whiteSpace==='nowrap'),`Settings labels must never wrap at ${width}px: ${JSON.stringify(rail.buttons)}`);
    assert.ok(rail.host.left>=-1&&rail.host.right<=width+1,`Settings rail itself must stay inside the viewport at ${width}px: ${JSON.stringify(rail)}`);
    assert.ok(rail.documentOverflow<=1,`Settings rail must not create page-level horizontal overflow at ${width}px: ${JSON.stringify(rail)}`);
    if(width===320)assert.ok(rail.hostOverflow>20,`narrow mobile Settings must overflow only inside its horizontal rail: ${JSON.stringify(rail)}`);
  }
  await page.setViewportSize({width:320,height:844});
  await page.evaluate(()=>{const buttons=[...document.querySelectorAll('#settings-tabs [data-settings-tab]')];buttons.at(-1)?.click();});
  await page.waitForTimeout(220);
  const activeSettingsTab=await page.evaluate(()=>{
    const host=document.getElementById('settings-tabs'),active=host?.querySelector('[data-settings-tab].is-active');
    if(!host||!active)throw new Error('active Settings tab is missing after selecting the last dynamic tab');
    const rr=host.getBoundingClientRect(),ar=active.getBoundingClientRect();
    return{tab:active.dataset.settingsTab,rail:{left:rr.left,right:rr.right},active:{left:ar.left,right:ar.right},ariaCurrent:active.getAttribute('aria-current'),scrollLeft:host.scrollLeft};
  });
  assert.equal(activeSettingsTab.ariaCurrent,'page',`active Settings tab must expose navigation state: ${JSON.stringify(activeSettingsTab)}`);
  assert.ok(activeSettingsTab.active.left>=activeSettingsTab.rail.left-1&&activeSettingsTab.active.right<=activeSettingsTab.rail.right+1,`last source-derived Settings tab must auto-scroll into view: ${JSON.stringify(activeSettingsTab)}`);
  await page.setViewportSize({width:390,height:844});

  await page.locator('#settings-tabs [data-settings-tab="behavior"]').click();
  await page.waitForFunction(()=>document.querySelector('#settings-tabs [data-settings-tab="behavior"]')?.classList.contains('is-active')&&document.querySelector('#settings-content .ui-select__trigger'),null,{timeout:30000});
  const behaviorSelect=page.locator('#settings-content .ui-select__trigger').first();
  await behaviorSelect.click();
  await page.locator('#weig-floating-layer .ui-select__menu:not([hidden])').waitFor({state:'visible',timeout:30000});
  await page.locator('#settings-tabs [data-settings-tab="speed"]').click();
  await page.waitForFunction(()=>document.querySelector('#settings-tabs [data-settings-tab="speed"]')?.classList.contains('is-active')&&!document.querySelector('#weig-floating-layer .ui-select__menu:not([hidden])'),null,{timeout:30000});

  await page.waitForFunction(()=>document.querySelector('#settings-tabs [data-settings-tab="speed"]')?.classList.contains('is-active')&&document.querySelector('[data-native-family="time-range"] [data-ui-time-control="1"]'),null,{timeout:30000});
  const schedule=page.locator('[data-native-family="time-range"][data-native-row]');
  const schedulerControl=page.locator('#settings-content [data-preference-key="scheduler_enabled"] .switch-control');
  const schedulerToggle=schedulerControl.locator('input[type="checkbox"]');
  if(!await schedulerToggle.isChecked()){
    await schedulerControl.click();
    await page.waitForFunction(()=>window.WeiG.SettingsState?.draft?.scheduler_enabled===true,null,{timeout:30000});
  }
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-native-family="time-range"] [data-ui-time-control="1"]')].every(control=>control.getAttribute('aria-disabled')!=='true'&&control.getAttribute('aria-readonly')!=='true'),null,{timeout:30000});
  const clockTrigger=schedule.locator('.ui-time-control__clock-trigger').first();
  assert.notEqual(await clockTrigger.evaluate(node=>getComputedStyle(node).display),'none','mobile Scheduler must expose the circular clock trigger');
  await clockTrigger.click();
  const clock=page.locator('dialog.ui-time-picker[open]');
  await clock.waitFor({state:'visible',timeout:30000});
  assert.equal(await clock.getAttribute('data-dialog-runtime'),'1','mobile circular clock must be owned by canonical DialogRuntime');
  assert.equal(await clock.getAttribute('data-time-mode'),'hour','mobile circular clock must open on the hour face');
  assert.equal(await clock.locator('.ui-time-picker__face-option').count(),24,'mobile circular hour face must expose all 24 hours');
  const compactClock=await clock.evaluate(node=>{const surface=node.querySelector('.ui-time-picker__surface'),face=node.querySelector('.ui-time-picker__face'),hand=node.querySelector('.ui-time-picker__hand');if(!surface||!face||!hand)throw new Error('compact time dial canonical nodes are missing');const sr=surface.getBoundingClientRect(),fr=face.getBoundingClientRect(),hs=getComputedStyle(hand);window.__weigClockHand=hand;return{surfaceWidth:sr.width,faceWidth:fr.width,handTransition:hs.transitionDuration};});
  assert.ok(compactClock.surfaceWidth<=304&&compactClock.faceWidth<=250,`mobile circular picker must use the compact dial geometry: ${JSON.stringify(compactClock)}`);
  assert.notEqual(compactClock.handTransition,'0s','mobile compact dial hand must retain motion feedback outside reduced-motion mode');
  await clock.locator('.ui-time-picker__face-option[data-time-value="9"]').click();
  await page.waitForFunction(()=>document.querySelector('dialog.ui-time-picker')?.dataset.timeMode==='minute',null,{timeout:30000});
  const stableHandAfterMode=await page.evaluate(()=>document.querySelector('dialog.ui-time-picker .ui-time-picker__hand')===window.__weigClockHand);
  assert.equal(stableHandAfterMode,true,'mobile compact dial must keep one hand DOM owner across Hour -> Minute transition');
  await clock.locator('.ui-time-picker__face-option[data-time-value="15"]').click();
  const stableHandAfterMinute=await page.evaluate(()=>document.querySelector('dialog.ui-time-picker .ui-time-picker__hand')===window.__weigClockHand);
  assert.equal(stableHandAfterMinute,true,'mobile compact dial must animate value changes without rebuilding the hand DOM');
  await clock.locator('[data-time-picker-ok]').click();
  await page.waitForFunction(()=>window.WeiG.SettingsState?.draft?.schedule_from_hour===9&&window.WeiG.SettingsState?.draft?.schedule_from_min===15,null,{timeout:30000});

  await page.evaluate(()=>window.WeiG.Router.go('rss'));
  await page.waitForFunction(()=>document.getElementById('rss-view')?.classList.contains('is-active')&&document.querySelectorAll('#rss-content .rss-workspace__pane-head').length===2,null,{timeout:30000});
  await page.setViewportSize({width:1100,height:844});
  await page.waitForTimeout(180);
  const rssDesktop=await page.evaluate(()=>{
    const root=document.getElementById('rss-content'),heads=[...document.querySelectorAll('#rss-content .rss-workspace__pane-head')],lists=[document.querySelector('#rss-content .rss-feed-list'),document.querySelector('#rss-content .rss-article-list')],horizontal=document.querySelector('#rss-content>.rss-workspace__divider--horizontal'),vertical=document.querySelector('#rss-content>.rss-workspace__divider--vertical');
    if(!root||heads.length!==2||lists.some(node=>!node)||!horizontal||!vertical)throw new Error('RSS desktop panes/divider owners are missing');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};},rr=rect(root),a=rect(heads[0]),b=rect(heads[1]),la=rect(lists[0]),lb=rect(lists[1]),hr=rect(horizontal),vr=rect(vertical),as=getComputedStyle(heads[0]),bs=getComputedStyle(heads[1]),ls=getComputedStyle(lists[1]);
    return{topDelta:Math.abs(a.top-b.top),bottomDelta:Math.abs(a.bottom-b.bottom),heightDelta:Math.abs(a.height-b.height),listTopDelta:Math.abs(la.top-lb.top),horizontal:{bottomDelta:Math.abs(hr.bottom-a.bottom),leftDelta:Math.abs(hr.left-rr.left),rightDelta:Math.abs(hr.right-rr.right),height:hr.height},vertical:{rightDelta:Math.abs(vr.right-b.left),topDelta:Math.abs(vr.top-rr.top),bottomDelta:Math.abs(vr.bottom-rr.bottom),width:vr.width},childBorders:[as.borderBottomWidth,bs.borderBottomWidth,ls.borderLeftWidth]};
  });
  assert.ok(rssDesktop.topDelta<=1&&rssDesktop.bottomDelta<=1&&rssDesktop.heightDelta<=1&&rssDesktop.listTopDelta<=1,'desktop RSS Subscriptions/Articles headers and content starts must align: '+JSON.stringify(rssDesktop));
  assert.ok(rssDesktop.horizontal.bottomDelta<=1&&rssDesktop.horizontal.leftDelta<=1&&rssDesktop.horizontal.rightDelta<=1&&rssDesktop.horizontal.height>=.5&&rssDesktop.horizontal.height<=1.5,'desktop RSS horizontal divider must be one full-width grid-owned border: '+JSON.stringify(rssDesktop));
  assert.ok(rssDesktop.vertical.rightDelta<=1&&rssDesktop.vertical.topDelta<=1&&rssDesktop.vertical.bottomDelta<=1&&rssDesktop.vertical.width>=.5&&rssDesktop.vertical.width<=1.5,'desktop RSS vertical divider must be one continuous grid-owned border: '+JSON.stringify(rssDesktop));
  assert.ok(rssDesktop.childBorders.every(value=>parseFloat(value)===0),'desktop RSS pane children must retire duplicate divider borders: '+JSON.stringify(rssDesktop));
  await page.setViewportSize({width:390,height:844});

  await page.locator('#mobile-bottom-nav [data-route=""]').click();
  await page.waitForFunction(()=>document.getElementById('list-view')?.classList.contains('is-active'));
  await page.locator('#menu-btn').click();
  await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));
  await page.waitForFunction(()=>{
    const host=document.getElementById('mobile-drawer-telemetry');
    return host&&host.querySelector('#status-torrents')&&host.querySelector('#status-free-space')&&host.querySelector('#transfer-capsule')&&host.querySelector('#status-connection')&&host.querySelector('.transfer-mini-chart');
  });
  await page.waitForTimeout(200);
  const drawer=await page.evaluate(()=>{
    const sidebar=document.getElementById('sidebar'),filters=sidebar?.querySelector(':scope > .sidebar__section:first-child'),telemetry=document.getElementById('mobile-drawer-telemetry'),meta=sidebar?.querySelector('.sidebar__meta'),chart=telemetry?.querySelector('.transfer-mini-chart'),legend=[...chart.querySelectorAll('.transfer-mini-chart__legend span')];
    if(!sidebar||!filters||!telemetry||!meta||!chart)throw new Error('mobile Drawer canonical zones are missing');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    const sidebarStyle=getComputedStyle(sidebar),filterStyle=getComputedStyle(filters),metaStyle=getComputedStyle(meta);
    return{sidebar:rect(sidebar),filters:rect(filters),telemetry:rect(telemetry),meta:rect(meta),chart:rect(chart),display:sidebarStyle.display,filterOverflow:filterStyle.overflowY,metaDisplay:metaStyle.display,hasTorrent:!!telemetry.querySelector('#status-torrents'),hasStorage:!!telemetry.querySelector('#status-free-space'),hasTransfer:!!telemetry.querySelector('#transfer-capsule'),hasConnection:!!telemetry.querySelector('#status-connection'),legendText:legend.map(node=>String(node.textContent||'').trim()),legendBefore:legend.map(node=>getComputedStyle(node,'::before').content)};
  });
  assert.ok(drawer.hasTorrent&&drawer.hasStorage&&drawer.hasTransfer&&drawer.hasConnection,`Drawer must contain the canonical status nodes: ${JSON.stringify(drawer)}`);
  assert.equal(drawer.display,'grid',`Mobile Drawer must resolve to the responsive grid: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.filterOverflow==='auto'||drawer.filterOverflow==='scroll',`Only the filter/facet zone must own Drawer scrolling: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.filters.top>=drawer.sidebar.top-1&&drawer.filters.bottom<=drawer.telemetry.top+1,`Filter/facet zone must end before fixed telemetry: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.chart.height>=90,`Drawer realtime transfer chart must be visibly rendered: ${JSON.stringify(drawer)}`);
  assert.equal(drawer.legendText.length,2,`Drawer mini chart must expose exactly download/upload totals: ${JSON.stringify(drawer)}`);
  assert.match(drawer.legendText[0],/^(?:已下载|Downloaded)\s/,`mini chart download total must use cumulative Downloaded semantics: ${JSON.stringify(drawer.legendText)}`);
  assert.match(drawer.legendText[1],/^(?:已上传|Uploaded)\s/,`mini chart upload total must use cumulative Uploaded semantics: ${JSON.stringify(drawer.legendText)}`);
  assert.ok(drawer.legendBefore.every(value=>value&&value!=='none'&&value!=='normal'),`mini-chart cumulative totals must expose the circular series pseudo marker: ${JSON.stringify(drawer.legendBefore)}`);
  assert.ok(drawer.metaDisplay==='none'||(drawer.meta.width===0&&drawer.meta.height===0),`mobile Drawer must hide qBittorrent/WebAPI/version metadata: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.telemetry.top>=drawer.sidebar.top&&drawer.telemetry.bottom<=drawer.sidebar.bottom+1&&drawer.sidebar.bottom-drawer.telemetry.bottom<=12,`Drawer telemetry/chart must use the released bottom space: ${JSON.stringify(drawer)}`);

  assert.deepEqual(errors,[],`deployed mobile layout produced browser errors: ${errors.join('\n')}`);
  await context.close();
  console.log(`Virtual qB Pages mobile layout acceptance passed for ${expectedSha}: stacked progress, single-line pager/actions, RSS header actions + Add Feed dialog, Header-owned Logs search layout, a single-row source-derived Settings rail, and a Drawer with fixed telemetry plus hidden mobile version metadata.`);
} finally {
  await browser.close();
}

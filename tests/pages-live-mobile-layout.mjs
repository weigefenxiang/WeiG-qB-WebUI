import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

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

  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({sim:`pages-mobile-${Date.now()}`,qb:'5.2.3',count:'80',scenario:'mixed',seed:'mobile-layout-047'}).toString();
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
  await page.locator('#login-btn').click();
  await page.waitForSelector('.torrent-mobile-card--two-line',{state:'visible',timeout:60000});
  await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});
  await page.evaluate(()=>{if(window.WeiG?.I18n?.setLocale)WeiG.I18n.setLocale('zh-CN');WeiG.TorrentFieldRegistry?.saveMobileFields?.(['state','size','dlspeed','upspeed','eta','progress']);WeiG.AppState?.virtual?.render?.();WeiG.UiSystem?.enforceMobileHeight?.();});
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
    return{toolbar:rect(toolbar),filters:rect(filters),actions:rect(actions),searchButton:rect(searchButton),chips:chips.length,sizeMode:!!document.getElementById('logs-size-mode'),refresh:!!document.querySelector('.logs-refresh'),searchOpen:document.querySelector('.topbar')?.classList.contains('search-open')||false,placeholder:searchInput.placeholder,overflow:toolbar.scrollWidth-toolbar.clientWidth};
  });
  assert.equal(logs.chips,4,`Logs toolbar must keep Normal/Info/Warning/Critical filters: ${JSON.stringify(logs)}`);
  assert.ok(logs.sizeMode&&logs.refresh,`Logs toolbar must keep size mode and Refresh controls: ${JSON.stringify(logs)}`);
  assert.notEqual(logs.searchButton.display,'none','phone Logs must expose the canonical Header Search button');
  assert.equal(logs.searchOpen,false,'phone Logs Header Search must start collapsed');
  assert.match(logs.placeholder,/日志|logs/i,`Logs Header Search must expose the route-specific placeholder: ${JSON.stringify(logs)}`);
  assert.ok(logs.overflow<=1,`Logs mobile toolbar must not overflow: ${JSON.stringify(logs)}`);

  await page.locator('#mobile-search-btn').click();
  await page.waitForFunction(()=>document.querySelector('.topbar')?.classList.contains('search-open')&&getComputedStyle(document.getElementById('search-input')).display!=='none');
  await page.locator('#search-input').fill('warning');
  await page.waitForFunction(()=>window.WeiG?.Logs?.query?.()==='warning');
  const logSearch=await page.evaluate(()=>({query:window.WeiG?.Logs?.query?.(),value:document.getElementById('search-input')?.value,open:document.querySelector('.topbar')?.classList.contains('search-open')||false}));
  assert.equal(logSearch.query,'warning','Header Search input must route into W.Logs query state');
  assert.equal(logSearch.value,'warning','Header Search input must preserve the typed Logs query');
  assert.equal(logSearch.open,true,'Logs Header Search must be visibly open while querying');
  await page.locator('#search-input').fill('');
  await page.waitForFunction(()=>window.WeiG?.Logs?.query?.()==='');

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
    const sidebar=document.getElementById('sidebar'),filters=sidebar?.querySelector(':scope > .sidebar__section:first-child'),telemetry=document.getElementById('mobile-drawer-telemetry'),meta=sidebar?.querySelector('.sidebar__meta'),chart=telemetry?.querySelector('.transfer-mini-chart');
    if(!sidebar||!filters||!telemetry||!meta||!chart)throw new Error('mobile Drawer canonical zones are missing');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    const sidebarStyle=getComputedStyle(sidebar),filterStyle=getComputedStyle(filters),metaStyle=getComputedStyle(meta);
    return{sidebar:rect(sidebar),filters:rect(filters),telemetry:rect(telemetry),meta:rect(meta),chart:rect(chart),display:sidebarStyle.display,filterOverflow:filterStyle.overflowY,metaDisplay:metaStyle.display,hasTorrent:!!telemetry.querySelector('#status-torrents'),hasStorage:!!telemetry.querySelector('#status-free-space'),hasTransfer:!!telemetry.querySelector('#transfer-capsule'),hasConnection:!!telemetry.querySelector('#status-connection')};
  });
  assert.ok(drawer.hasTorrent&&drawer.hasStorage&&drawer.hasTransfer&&drawer.hasConnection,`Drawer must contain the canonical status nodes: ${JSON.stringify(drawer)}`);
  assert.equal(drawer.display,'grid',`Mobile Drawer must resolve to the responsive grid: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.filterOverflow==='auto'||drawer.filterOverflow==='scroll',`Only the filter/facet zone must own Drawer scrolling: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.filters.top>=drawer.sidebar.top-1&&drawer.filters.bottom<=drawer.telemetry.top+1,`Filter/facet zone must end before fixed telemetry: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.chart.height>=90,`Drawer realtime transfer chart must be visibly rendered: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.metaDisplay==='none'||(drawer.meta.width===0&&drawer.meta.height===0),`mobile Drawer must hide qBittorrent/WebAPI/version metadata: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.telemetry.top>=drawer.sidebar.top&&drawer.telemetry.bottom<=drawer.sidebar.bottom+1&&drawer.sidebar.bottom-drawer.telemetry.bottom<=12,`Drawer telemetry/chart must use the released bottom space: ${JSON.stringify(drawer)}`);

  assert.deepEqual(errors,[],`deployed mobile layout produced browser errors: ${errors.join('\n')}`);
  await context.close();
  console.log(`Virtual qB Pages mobile layout acceptance passed for ${expectedSha}: stacked progress, single-line pager/actions, RSS header actions + Add Feed dialog, Header-owned Logs search, and a Drawer with fixed telemetry plus hidden mobile version metadata.`);
} finally {
  await browser.close();
}

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
  page.on('console',message=>{if(message.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(message.text()))errors.push(message.text());});

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
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    return{metrics:rect(metrics),progress:rect(progress),track:rect(track),number:rect(number),tracks:node.querySelectorAll('.progress-track').length,numberText:(number?.textContent||'').trim(),overflow:node.scrollHeight-node.clientHeight};
  });
  assert.equal(card.tracks,1,`mobile torrent card must render one canonical progress track: ${JSON.stringify(card)}`);
  assert.ok(card.progress.top>=card.metrics.bottom-1,`progress must be below metadata: ${JSON.stringify(card)}`);
  assert.ok(card.number.left>=card.track.right-1&&card.numberText.endsWith('%'),`percentage must sit immediately to the right of progress bar: ${JSON.stringify(card)}`);
  assert.ok(card.overflow<=1,`stacked progress must fit the mobile torrent card height: ${JSON.stringify(card)}`);

  const pager=await page.locator('#list-view .pager').evaluate(node=>{
    const nav=node.querySelector('.pager__nav'),actions=node.querySelector('#torrent-selection-toolbar'),buttons=[...actions.querySelectorAll('button')];
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
  await page.waitForFunction(()=>document.getElementById('rss-view')?.classList.contains('is-active'));
  const rss=await page.evaluate(()=>{
    const get=id=>document.getElementById(id),search=get('rss-search-input')?.closest('.rss-search-host'),add=get('rss-add-btn'),refresh=get('rss-refresh-btn'),url=get('rss-url');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,display:getComputedStyle(n).display};};
    return{search:rect(search),add:rect(add),refresh:rect(refresh),url:rect(url)};
  });
  assert.ok(rss.search.width>80&&rss.search.right<=rss.add.left+1,`RSS Search must be immediately left of Add Feed: ${JSON.stringify(rss)}`);
  assert.ok(Math.abs(rss.search.top-rss.add.top)<=2&&Math.abs(rss.add.top-rss.refresh.top)<=2,`RSS Search/Add/Refresh must share the first mobile row: ${JSON.stringify(rss)}`);
  assert.ok(rss.url.top>=Math.max(rss.search.bottom,rss.add.bottom,rss.refresh.bottom)+2,`RSS Feed URL must remain available on the next row: ${JSON.stringify(rss)}`);

  await page.locator('#mobile-bottom-nav [data-route="logs"]').click();
  await page.waitForFunction(()=>document.getElementById('logs-view')?.classList.contains('is-active')&&document.querySelector('.logs-toolbar'));
  const logsBefore=await page.evaluate(()=>{const toggle=document.querySelector('.logs-search-toggle'),search=document.querySelector('.logs-search'),filters=document.querySelector('.logs-filters'),rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,display:getComputedStyle(n).display};};return{toggle:rect(toggle),search:rect(search),filters:rect(filters)};});
  assert.notEqual(logsBefore.toggle.display,'none','phone Logs must show the search icon');
  assert.equal(logsBefore.search.display,'none','phone Logs full search must start collapsed');
  await page.locator('.logs-search-toggle').click();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.logs-search')).display!=='none');
  const logsAfter=await page.evaluate(()=>{const search=document.querySelector('.logs-search'),filters=document.querySelector('.logs-filters'),rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};return{search:rect(search),filters:rect(filters)};});
  assert.ok(logsAfter.search.top>=logsAfter.filters.bottom+2,`expanded Logs search must occupy the next row: ${JSON.stringify(logsAfter)}`);
  assert.ok(Math.abs(logsAfter.filters.top-logsBefore.filters.top)<=2,`Logs filters must not move when search expands: ${JSON.stringify({before:logsBefore.filters,after:logsAfter.filters})}`);

  await page.locator('#mobile-bottom-nav [data-route=""]').click();
  await page.waitForFunction(()=>document.getElementById('list-view')?.classList.contains('is-active'));
  await page.locator('#menu-btn').click();
  await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));
  await page.waitForFunction(()=>document.querySelector('#mobile-drawer-telemetry #status-torrents')&&document.querySelector('#mobile-drawer-telemetry #transfer-capsule')&&document.querySelector('#mobile-drawer-transfer-chart .transfer-mini-chart'));
  const drawer=await page.evaluate(()=>{
    const sidebar=document.getElementById('sidebar'),filters=sidebar.querySelector(':scope > .sidebar__section:first-child'),telemetry=document.getElementById('mobile-drawer-telemetry'),meta=sidebar.querySelector('.sidebar__meta'),chart=telemetry.querySelector('.transfer-mini-chart');
    const rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    const sidebarStyle=getComputedStyle(sidebar),filterStyle=getComputedStyle(filters),telemetryStyle=getComputedStyle(telemetry),metaStyle=getComputedStyle(meta);
    return{sidebar:rect(sidebar),filters:rect(filters),telemetry:rect(telemetry),meta:rect(meta),chart:rect(chart),display:sidebarStyle.display,rows:sidebarStyle.gridTemplateRows,filterOverflow:filterStyle.overflowY,telemetryGridRow:telemetryStyle.gridRowStart,metaGridRow:metaStyle.gridRowStart,hasTorrent:!!telemetry.querySelector('#status-torrents'),hasStorage:!!telemetry.querySelector('#status-free-space'),hasTransfer:!!telemetry.querySelector('#transfer-capsule'),hasConnection:!!telemetry.querySelector('#status-connection'),metaText:(meta.textContent||'').trim()};
  });
  assert.ok(drawer.hasTorrent&&drawer.hasStorage&&drawer.hasTransfer&&drawer.hasConnection,`Drawer must contain the canonical status nodes: ${JSON.stringify(drawer)}`);
  assert.equal(drawer.display,'grid',`Mobile Drawer must resolve to the three-zone grid: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.filterOverflow==='auto'||drawer.filterOverflow==='scroll',`Only the filter/facet zone must own Drawer scrolling: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.filters.top>=drawer.sidebar.top-1&&drawer.filters.bottom<=drawer.telemetry.top+1,`Filter/facet zone must end before fixed telemetry: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.chart.height>=90,`Drawer realtime transfer chart must be visibly rendered: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.telemetry.top>=drawer.sidebar.top&&drawer.telemetry.bottom<=drawer.meta.top+1,`Drawer telemetry must occupy the fixed middle zone above versions: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.meta.bottom<=drawer.sidebar.bottom+1&&drawer.sidebar.bottom-drawer.meta.bottom<=12,`qBittorrent/WebAPI metadata must be pinned to the physical bottom of the Drawer: ${JSON.stringify(drawer)}`);
  assert.ok(/qBittorrent/.test(drawer.metaText)&&/WebAPI/.test(drawer.metaText),`Drawer bottom must expose qBittorrent and WebAPI versions: ${drawer.metaText}`);

  assert.deepEqual(errors,[],`deployed mobile layout produced browser errors: ${errors.join('\n')}`);
  await context.close();
  console.log(`Virtual qB Pages mobile layout acceptance passed for ${expectedSha}: stacked progress, single-line pager/actions, RSS + Logs search, and a three-zone Drawer with fixed telemetry and versions pinned to the bottom.`);
} finally {
  await browser.close();
}

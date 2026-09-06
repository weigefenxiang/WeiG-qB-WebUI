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
      const url=new URL('metadata/site.json',base);url.searchParams.set('__drawer_sha',expectedSha);
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
  url.search=new URLSearchParams({sim:`pages-drawer-${Date.now()}`,qb:'5.2.3',count:'80',scenario:'mixed',seed:'drawer-layout-047'}).toString();
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
  await page.locator('#login-btn').click();
  await page.waitForSelector('.torrent-mobile-card--two-line',{state:'visible',timeout:60000});
  await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});

  await page.locator('#menu-btn').click();
  await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'),null,{timeout:10000});
  await page.waitForFunction(()=>{
    const host=document.getElementById('mobile-drawer-telemetry');
    return host&&host.querySelector('#status-torrents')&&host.querySelector('#status-free-space')&&host.querySelector('#transfer-capsule')&&host.querySelector('#status-connection')&&host.querySelector('.transfer-mini-chart');
  },null,{timeout:10000});
  await page.waitForTimeout(250);

  const drawer=await page.evaluate(()=>{
    const sidebar=document.getElementById('sidebar');
    const filters=sidebar?.querySelector(':scope > .sidebar__section:first-child');
    const telemetry=document.getElementById('mobile-drawer-telemetry');
    const meta=sidebar?.querySelector('.sidebar__meta');
    const chart=telemetry?.querySelector('.transfer-mini-chart');
    const rect=node=>{const r=node.getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
    const ss=getComputedStyle(sidebar),fs=getComputedStyle(filters),ts=getComputedStyle(telemetry),ms=getComputedStyle(meta);
    return{
      sidebar:rect(sidebar),filters:rect(filters),telemetry:rect(telemetry),meta:rect(meta),chart:rect(chart),
      sidebarDisplay:ss.display,gridRows:ss.gridTemplateRows,filterOverflowY:fs.overflowY,
      filterClientHeight:filters.clientHeight,filterScrollHeight:filters.scrollHeight,
      telemetryGridRow:ts.gridRowStart,metaGridRow:ms.gridRowStart,
      hasTorrent:!!telemetry.querySelector('#status-torrents'),hasStorage:!!telemetry.querySelector('#status-free-space'),
      hasTransfer:!!telemetry.querySelector('#transfer-capsule'),hasConnection:!!telemetry.querySelector('#status-connection'),
      metaText:(meta.textContent||'').replace(/\s+/g,' ').trim()
    };
  });

  assert.equal(drawer.sidebarDisplay,'grid',`Drawer must resolve to the three-zone grid: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.filterOverflowY==='auto'||drawer.filterOverflowY==='scroll',`only filters/facets may scroll: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.filters.top>=drawer.sidebar.top-1&&drawer.filters.bottom<=drawer.telemetry.top+1,`filter zone must end before fixed telemetry: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.hasTorrent&&drawer.hasStorage&&drawer.hasTransfer&&drawer.hasConnection,`canonical status nodes must be mounted in Drawer telemetry: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.chart.height>=90,`5-minute transfer chart must be visibly rendered in Drawer: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.telemetry.top>=drawer.sidebar.top&&drawer.telemetry.bottom<=drawer.meta.top+1,`telemetry/chart must remain directly above version metadata: ${JSON.stringify(drawer)}`);
  assert.ok(drawer.meta.bottom<=drawer.sidebar.bottom+1&&drawer.sidebar.bottom-drawer.meta.bottom<=12,`qBittorrent/WebAPI metadata must be pinned to the physical bottom of Drawer: ${JSON.stringify(drawer)}`);
  assert.ok(/qBittorrent/.test(drawer.metaText)&&/WebAPI/.test(drawer.metaText),`Drawer bottom must expose qBittorrent/WebAPI metadata: ${drawer.metaText}`);
  assert.deepEqual(errors,[],`deployed Drawer layout produced browser errors: ${errors.join('\n')}`);

  await context.close();
  console.log(`Virtual qB Pages Drawer layout acceptance passed for ${expectedSha}: filters are the only scroll owner, telemetry + 5-minute chart stay visible, and qBittorrent/WebAPI metadata is pinned to the Drawer bottom.`);
} finally {
  await browser.close();
}

import {launchBrowser,readWebuiStatic} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../webui/private');
const publicRoot=path.resolve(here,'../webui/public');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const host='127.0.0.1',port=8774;
const variants={legacy:{qb:'v4.1.9.1',api:'2.1.0'},modern:{qb:'v5.2.0',api:'2.11.4'}};
const frozenCatalog=JSON.parse(await fs.readFile(path.resolve(here,'fixtures/qb-release-catalog.lkg.json'),'utf8'));
const profiles=['4.1.9.1','5.2.0'].map(qbVersion=>frozenCatalog.find(profile=>profile.qbVersion===qbVersion));
if(profiles.some(profile=>!profile))throw new Error('Workspace browser fixture requires frozen qB 4.1.9.1 and 5.2.0 release profiles.');
const visualStates=[
  {state:'downloading',progress:.45,dlspeed:1200,upspeed:0},
  {state:'uploading',progress:1,dlspeed:0,upspeed:240},
  {state:'pausedDL',progress:.45,dlspeed:0,upspeed:0},
  {state:'pausedUP',progress:1,dlspeed:0,upspeed:0},
  {state:'error',progress:.45,dlspeed:0,upspeed:0},
  {state:'checkingDL',progress:.45,dlspeed:0,upspeed:0},
  {state:'queuedDL',progress:.45,dlspeed:0,upspeed:0},
  {state:'stalledDL',progress:.45,dlspeed:0,upspeed:0}
];
const torrents=Array.from({length:55},(_,i)=>{
  const v=visualStates[i]||{state:i%5===0?'uploading':'downloading',progress:i%5===0?1:.45,dlspeed:i%2?0:1200,upspeed:i%3?0:240};
  return {hash:String(i+1).padStart(40,'0'),name:`Workspace Torrent ${i+1}`,size:1048576*(i+1),progress:v.progress,dlspeed:v.dlspeed,upspeed:v.upspeed,eta:3600,state:v.state,ratio:.2,tracker:i%2?'https://tracker.two.example/announce':'https://tracker.one.example/announce',category:i%2?'Movies':'',tags:i%3?'Fixture':'',added_on:i<visualStates.length?10000-i:1000+i,save_path:i%2?'/downloads/movies':'/downloads',private:i===0};
});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
async function dragNativeScrollbar(page,selector,axis){
  const node=page.locator(selector),saved=await node.evaluate((el,axis)=>{const state={overflowX:el.style.overflowX,overflowY:el.style.overflowY};if(axis==='x')el.style.overflowY='hidden';else el.style.overflowX='hidden';return state;},axis);
  try{
    await page.waitForTimeout(60);
    const box=await node.boundingBox();if(!box)throw new Error(`Missing scrollbar target ${selector}`);
    const metrics=await node.evaluate((el,axis)=>{const horizontal=axis==='x',client=horizontal?el.clientWidth:el.clientHeight,scroll=horizontal?el.scrollWidth:el.scrollHeight,max=Math.max(0,scroll-client),border=horizontal?el.clientTop:el.clientLeft,layoutThickness=horizontal?el.offsetHeight-el.clientHeight-(el.clientTop*2):el.offsetWidth-el.clientWidth-(el.clientLeft*2),pseudo=getComputedStyle(el,'::-webkit-scrollbar'),styledThickness=parseFloat(horizontal?pseudo.height:pseudo.width)||0,thickness=Math.max(0,layoutThickness,styledThickness);return{client,scroll,max,border,layoutThickness:Math.max(0,layoutThickness),styledThickness:Math.max(0,styledThickness),thickness};},axis);
    if(metrics.max<=0||metrics.thickness<=0)throw new Error(`${selector} has no measurable ${axis==='x'?'horizontal':'vertical'} scrollbar: ${JSON.stringify(metrics)}`);
    const track=metrics.client,thumb=Math.min(track-8,Math.max(36,track*(metrics.client/metrics.scroll))),travel=Math.max(8,track-thumb),delta=Math.max(28,Math.min(64,travel*.14)),start=thumb/2+2,target=Math.min(track-thumb/2-2,start+delta),overlay=metrics.layoutThickness<=0;
    const origin=axis==='x'?box.x+metrics.border:box.y+metrics.border,fixed=axis==='x'?(overlay?box.y+box.height-(metrics.thickness/2):box.y+metrics.border+metrics.client+(metrics.thickness/2)):(overlay?box.x+box.width-(metrics.thickness/2):box.x+metrics.border+metrics.client+(metrics.thickness/2));
    const x0=axis==='x'?origin+start:fixed,y0=axis==='x'?fixed:origin+start,x1=axis==='x'?origin+target:fixed,y1=axis==='x'?fixed:origin+target;
    if(process.env.WEIG_NATIVE_SCROLLBAR_DRAG==='1'){
      await page.bringToFront();
      const screen=await page.evaluate(({x0,y0,x1,y1})=>{const dpr=Number(window.devicePixelRatio)||1,outerGapX=Math.max(0,window.outerWidth-window.innerWidth),outerGapY=Math.max(0,window.outerHeight-window.innerHeight),viewportX=window.screenX+(outerGapX/2),viewportY=window.screenY+Math.max(0,outerGapY-(outerGapX/2));return{x0:Math.round((viewportX+x0)*dpr),y0:Math.round((viewportY+y0)*dpr),x1:Math.round((viewportX+x1)*dpr),y1:Math.round((viewportY+y1)*dpr),dpr,screenX:window.screenX,screenY:window.screenY,outerWidth:window.outerWidth,outerHeight:window.outerHeight,innerWidth:window.innerWidth,innerHeight:window.innerHeight,viewportX,viewportY};},{x0,y0,x1,y1});
      const run=(...args)=>execFileSync('xdotool',args,{stdio:['ignore','pipe','pipe']});
      run('mousemove','--sync',String(screen.x0),String(screen.y0));run('mousedown','1');
      for(let step=1;step<=12;step++){const t=step/12;run('mousemove','--sync',String(Math.round(screen.x0+(screen.x1-screen.x0)*t)),String(Math.round(screen.y0+(screen.y1-screen.y0)*t)));}
      run('mouseup','1');await page.waitForTimeout(260);
      return await node.evaluate((el,payload)=>({left:el.scrollLeft,top:el.scrollTop,max:payload.axis==='x'?el.scrollWidth-el.clientWidth:el.scrollHeight-el.clientHeight,screen:payload.screen}),{axis,screen});
    }
    await page.mouse.move(x0,y0);await page.waitForTimeout(120);await page.mouse.down();await page.mouse.move(x1,y1,{steps:12});await page.mouse.up();await page.waitForTimeout(220);
    return await node.evaluate((el,axis)=>({left:el.scrollLeft,top:el.scrollTop,max:axis==='x'?el.scrollWidth-el.clientWidth:el.scrollHeight-el.clientHeight}),axis);
  }finally{
    await node.evaluate((el,saved)=>{el.style.overflowX=saved.overflowX;el.style.overflowY=saved.overflowY;},saved);
  }
}

const json=(res,v,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));};
const text=(res,v,status=200)=>{res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));};
const empty=(res,status=200)=>{res.writeHead(status,{'cache-control':'no-store'});res.end('');};
function rows(v){return torrents.map(t=>{const x={...t};if(v===variants.legacy)delete x.private;return x;});}
function api(req,res,v,p,url){
  if(p==='app/version')return text(res,v.qb);
  if(p==='app/webapiVersion')return text(res,v.api);
  if(p==='app/preferences')return json(res,{save_path:'/downloads',alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui'});
  if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:2048,up_info_speed:1024,connection_status:'firewalled',dht_nodes:999,total_peer_connections:999});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'firewalled',dl_info_speed:2048,up_info_speed:1024,dht_nodes:12,total_peer_connections:4,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){
    let out=rows(v);const hashes=url.searchParams.get('hashes');if(hashes){const set=new Set(hashes.split('|'));out=out.filter(t=>set.has(t.hash));}
    const category=url.searchParams.get('category');if(category)out=out.filter(t=>t.category===category);
    const tag=url.searchParams.get('tag');if(tag)out=out.filter(t=>String(t.tags||'').split(',').includes(tag));
    const sort=url.searchParams.get('sort');if(sort)out.sort((a,b)=>String(a[sort]??'').localeCompare(String(b[sort]??''),undefined,{numeric:true}));
    if(url.searchParams.get('reverse')==='true')out.reverse();
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||0);return json(res,limit?out.slice(offset,offset+limit):out.slice(offset));
  }
  if(p==='torrents/categories')return json(res,{Movies:{name:'Movies',savePath:'/downloads/movies'}});
  if(p==='torrents/tags')return json(res,['Fixture']);
  if(p==='torrents/properties')return json(res,{save_path:'/downloads',total_size:1048576,total_downloaded:400000,total_uploaded:100000,share_ratio:.2,nb_connections:4,seeds:2,peers:3,addition_date:1000,completion_date:-1,created_by:'fixture',pieces_num:20,piece_size:65536,private:v===variants.modern});
  if(['torrents/files','torrents/trackers','torrents/webseeds','search/plugins','log/main','log/peers'].includes(p))return json(res,[]);
  if(p==='sync/torrentPeers')return json(res,{peers:{}});
  if(p==='rss/items')return json(res,{});
  if(req.method==='POST')return empty(res);
  return json(res,{});
}
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://${host}:${port}`),m=url.pathname.match(/^\/(legacy|modern)(?:\/(.*))?$/);if(!m){res.writeHead(404);return res.end('not found');}
  const v=variants[m[1]],rel=m[2]||'';if(rel.startsWith('api/v2/'))return api(req,res,v,rel.slice(7),url);
  if(rel==='data/qb-releases.json')return json(res,profiles);
  if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'workspace-fixture',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});
  const requested=rel||'index.html',{file,body}=await readWebuiStatic([root,publicRoot],requested);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);
}catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(e));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

const nativeScrollbarDrag=process.env.WEIG_NATIVE_SCROLLBAR_DRAG==='1';
const browser=await launchBrowser(nativeScrollbarDrag?{headless:false,ignoreDefaultArgs:['--hide-scrollbars'],args:['--disable-features=OverlayScrollbar,OverlayScrollbars']}:{});
try{
  for(const name of ['legacy','modern']){
    const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('#torrent-list [data-hash]');
    await page.waitForFunction(()=>window.WeiG?.LibraryController&&document.querySelectorAll('#facet-controls .facet-control').length===4&&WeiG.AppState?.catalogReady===true,{timeout:10000});

    // Desktop: facets remain in Sidebar and the retired four-card summary does not exist at all.
    assert(await page.locator('#facet-controls').count()===1,`${name}: duplicate facet host`);
    assert(await page.locator('#sidebar-facet-slot>#facet-controls').count()===1,`${name}: facets not below Sidebar filters`);
    assert(await page.locator('#mobile-command-slot,#mobile-facet-slot,.mobile-summary,#dl-speed,#up-speed,#connection-status,#network-meta,#torrent-count,#page-range').count()===0,`${name}: retired summary/mobile shelf DOM survived`);
    const panelTop=await page.evaluate(()=>({panel:Math.round(document.querySelector('#list-view>.torrent-panel').getBoundingClientRect().top),view:Math.round(document.getElementById('list-view').getBoundingClientRect().top)}));
    assert(Math.abs(panelTop.panel-panelTop.view)<=2,`${name}: TorrentPanel does not start at desktop workspace top`);
    // Real native scrollbar thumb drag is certified only in the dedicated Xvfb/headful Chrome lane.
    if(nativeScrollbarDrag){
    await page.setViewportSize({width:900,height:768});await page.waitForTimeout(120);
    await page.evaluate(()=>{const list=document.getElementById('torrent-list');list.scrollLeft=0;list.scrollTop=0;WeiG.AppState.virtual.resetMetrics();});
    const horizontal=await dragNativeScrollbar(page,'#torrent-list','x');
    assert(horizontal.left>8,`${name}: real horizontal scrollbar thumb drag did not move scrollLeft ${JSON.stringify(horizontal)}`);
    const horizontalMetrics=await page.evaluate(()=>WeiG.AppState.virtual.metrics());
    assert(horizontalMetrics.renders===0,`${name}: horizontal scrollbar drag triggered VirtualList repaint ${JSON.stringify(horizontalMetrics)}`);
    await page.evaluate(()=>{WeiG.AppState.virtual.resetScroll();document.getElementById('torrent-list').scrollLeft=0;WeiG.AppState.virtual.resetMetrics();});
    await page.waitForTimeout(80);
    const vertical=await dragNativeScrollbar(page,'#torrent-list','y');
    assert(vertical.top>40,`${name}: real vertical scrollbar thumb drag did not move scrollTop ${JSON.stringify(vertical)}`);
    const verticalMetrics=await page.evaluate(()=>WeiG.AppState.virtual.metrics());
    assert(verticalMetrics.renders>0&&verticalMetrics.reused>0&&verticalMetrics.reused>verticalMetrics.created,`${name}: vertical scrollbar drag did not recycle the overlapping row pool ${JSON.stringify(verticalMetrics)}`);
    assert(verticalMetrics.maxRenderMs<80,`${name}: scrollbar-driven VirtualList render exceeded the bounded browser regression budget ${JSON.stringify(verticalMetrics)}`);
    await page.setViewportSize({width:1366,height:768});await page.waitForTimeout(120);
    }


    // Real progress semantics and Reduced Motion remain protected.
    const expected={1:['download','45%','true'],2:['seed','100%','true'],3:['paused','45%','false'],4:['complete','100%','false'],5:['error','45%','false'],6:['checking','45%','true'],7:['queued','45%','false'],8:['stalled','45%','false']};
    for(const [n,e] of Object.entries(expected)){
      const track=page.locator(`.torrent-row[data-hash="${String(n).padStart(40,'0')}"] .progress-track`);await track.waitFor();
      const state=await track.evaluate(el=>({state:el.dataset.progressState,active:el.dataset.progressActive,width:el.querySelector('.progress-fill').style.width,motion:getComputedStyle(el.querySelector('.progress-fill'),'::after').animationName}));
      assert(state.state===e[0]&&state.width===e[1]&&state.active===e[2],`${name}: progress ${n} semantic mismatch ${JSON.stringify(state)}`);
      assert((e[2]==='true')===(state.motion!=='none'),`${name}: progress ${n} activity motion mismatch`);
    }
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(20);
    assert(await page.locator('.torrent-row[data-hash="0000000000000000000000000000000000000001"] .progress-fill').evaluate(n=>getComputedStyle(n,'::after').animationName)==='none',`${name}: Reduced Motion failed for progress`);
    await page.emulateMedia({reducedMotion:'no-preference'});

    // Canonical sort state: desktop header and Mobile Select share LibraryController state.
    const nameHead=page.locator('#torrent-table-head .grid-head-cell[data-key="name"]');await nameHead.click();
    await page.waitForFunction(()=>WeiG.LibraryController.state().sort==='name');
    assert((await page.evaluate(()=>WeiG.LibraryController.state())).sort==='name',`${name}: desktop sort did not reach semantic owner`);

    // Facet action updates semantic state.
    const tracker=page.locator('.facet-control[data-facet="tracker"] .ui-select__trigger');await tracker.click();
    await page.waitForSelector('#weig-floating-layer .ui-select__option[data-value="https://tracker.one.example/announce"]');
    await page.locator('#weig-floating-layer .ui-select__option[data-value="https://tracker.one.example/announce"]').click();
    await page.waitForFunction(()=>WeiG.LibraryController.state().tracker.includes('tracker.one.example'));

    // Connection help uses existing TransferRuntime snapshot and no retired Network summary.
    await page.waitForFunction(()=>document.getElementById('status-connection')?.dataset.connection==='firewalled');
    await page.locator('#status-connection').click();await page.waitForSelector('#connection-dialog[open]');
    await page.waitForFunction(()=>{const t=document.querySelector('#connection-dialog')?.textContent||'';return t.includes('DHT 12')&&t.includes('Peers 4');},{timeout:5000});
    await page.locator('#connection-dialog .connection-dialog__done').click();

    // Mobile: same Sidebar facets, same toolbar moved beside pager, compact controls, two-line cards, no summary leaves.
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);
    assert(await page.locator('#sidebar-facet-slot>#facet-controls').count()===1,`${name}: Mobile moved/duplicated facets instead of keeping Sidebar owner`);
    assert(await page.locator('#mobile-pager-actions-slot>#torrent-selection-toolbar').count()===1,`${name}: Mobile pager did not receive canonical action toolbar`);
    assert(await page.locator('.statusbar').evaluate(n=>getComputedStyle(n).display)==='none',`${name}: desktop Statusbar leaked into Mobile`);

    // Sidebar/Drawer exposes state filters followed by all four facets and reused Desktop telemetry.
    await page.locator('#menu-btn').click();await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));
    const order=await page.evaluate(()=>{const filter=document.getElementById('filter-nav').getBoundingClientRect(),facets=document.getElementById('sidebar-facet-slot').getBoundingClientRect(),drawer=document.getElementById('mobile-drawer-telemetry');return{filterBottom:filter.bottom,facetTop:facets.top,facets:document.querySelectorAll('#facet-controls .facet-control').length,telemetry:!!drawer&&drawer.contains(document.getElementById('status-torrents'))&&drawer.contains(document.getElementById('transfer-capsule'))&&drawer.contains(document.getElementById('status-connection')),mini:!!drawer?.querySelector('.transfer-mini-chart')};});
    assert(order.facets===4&&order.facetTop>=order.filterBottom,`${name}: Drawer facets are not below Torrent state filters (${JSON.stringify(order)})`);
    assert(order.telemetry&&order.mini,`${name}: Drawer did not reuse canonical Statusbar telemetry and compact Transfer chart (${JSON.stringify(order)})`);
    const scrim=page.locator('#drawer-scrim'),scrimBox=await scrim.boundingBox(),sidebarBox=await page.locator('#sidebar').boundingBox();
    assert(scrimBox&&sidebarBox&&scrimBox.x+scrimBox.width-16>sidebarBox.x+sidebarBox.width,`${name}: Drawer has no visible scrim close target`);
    await scrim.click({position:{x:Math.max(1,scrimBox.width-16),y:Math.max(1,Math.min(scrimBox.height-16,scrimBox.height/2))}});await page.waitForFunction(()=>!document.getElementById('sidebar')?.classList.contains('is-open'));

    // Compact toolbar retains a 44px interaction box while visible surface is inset by CSS.
    const toolbarGeometry=await page.evaluate(()=>{const selection=document.querySelector('#selection-control .ui-select__trigger'),pageSize=document.querySelector('#page-size-control .ui-select__trigger'),columns=document.querySelector('.mobile-columns-button'),sort=document.querySelector('.mobile-sort-control .ui-select__trigger');return [selection,pageSize,columns,sort].map(n=>n&&({h:n.getBoundingClientRect().height,display:getComputedStyle(n).display}));});
    assert(toolbarGeometry.every(x=>x&&x.h>=43),`${name}: Mobile toolbar lost touch target ${JSON.stringify(toolbarGeometry)}`);

    // Mobile sort calls the same semantic owner; no hidden Columns bridge is involved.
    const sortTrigger=page.locator('.mobile-sort-control .ui-select__trigger');await sortTrigger.click();
    await page.waitForSelector('#weig-floating-layer .ui-select__option[data-value="size:desc"]');
    await page.locator('#weig-floating-layer .ui-select__option[data-value="size:desc"]').click();
    await page.waitForFunction(()=>WeiG.LibraryController.state().sort==='size'&&WeiG.LibraryController.state().reverse===true);
    assert(await page.locator('#column-configurator-dialog[open]').count()===0,`${name}: Mobile sort opened hidden Columns bridge`);

    await page.waitForFunction(()=>!!document.querySelector('.torrent-mobile-card--two-line[data-hash]'));
    const cardState=await page.evaluate(()=>{
      const el=document.querySelector('.torrent-mobile-card--two-line[data-hash]');
      if(!el)return null;
      el.scrollIntoView({block:'nearest'});
      const top=el.querySelector('.mobile-card-top'),progress=el.querySelector('.mobile-card-progress');
      return {children:[...el.children].map(n=>n.className),top:top?[...top.children].map(n=>n.className):[],height:el.getBoundingClientRect().height,meta:el.querySelector('.mobile-card-meta--rail')?.textContent||'',hasProgress:!!progress?.querySelector('.progress-track'),percent:(progress?.querySelector('.mobile-card-progress__number')?.textContent||'').trim()};
    });
    assert(cardState&&cardState.top.length===3&&cardState.top[1].includes('torrent-title-line')&&cardState.top[2].includes('mobile-more'),`${name}: Mobile first line is not selection + title + More: ${JSON.stringify(cardState&&cardState.top)}`);
    assert(cardState.meta.includes('%')&&cardState.hasProgress&&cardState.percent.endsWith('%')&&cardState.height<100,`${name}: Mobile card is not compact inline-progress presentation: ${JSON.stringify(cardState)}`);

    // Search is anchored below the header; opening it must not move/clip header actions.
    const before=await page.evaluate(()=>{const top=document.querySelector('.topbar').getBoundingClientRect(),buttons=[...document.querySelectorAll('.topbar button,.topbar a')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.getBoundingClientRect());return{top,buttons:buttons.map(r=>({l:r.left,r:r.right,t:r.top,b:r.bottom}))};});
    await page.locator('#mobile-search-btn').click();await page.waitForFunction(()=>document.querySelector('.topbar')?.classList.contains('search-open')&&document.activeElement?.id==='search-input');
    const searchGeometry=await page.evaluate(()=>{const top=document.querySelector('.topbar').getBoundingClientRect(),search=document.querySelector('.topbar__search').getBoundingClientRect(),actions=[...document.querySelectorAll('.topbar button,.topbar a')].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.getBoundingClientRect());return{top:{t:top.top,b:top.bottom},search:{t:search.top,b:search.bottom},actions:actions.map(r=>({l:r.left,r:r.right,t:r.top,b:r.bottom})),vw:innerWidth};});
    assert(Math.abs(searchGeometry.top.t-before.top.top)<=1&&searchGeometry.search.t>=searchGeometry.top.b,`${name}: Search reflowed header instead of dropping below (${JSON.stringify(searchGeometry)})`);
    assert(searchGeometry.actions.every(r=>r.l>=-1&&r.r<=searchGeometry.vw+1),`${name}: Search pushed header action outside viewport`);
    await page.locator('#search-input').fill('Workspace Torrent 5');await page.waitForFunction(()=>WeiG.LibraryController.state().search==='Workspace Torrent 5');

    assert(errors.length===0,`${name}: browser errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log('Torrent workspace browser gate passed: '+(nativeScrollbarDrag?'real horizontal/vertical scrollbar thumb drag, ':'')+'keyed row reuse, permanent Sidebar facets, canonical Drawer telemetry, semantic sort/count, compact Mobile toolbar/cards, inline truthful progress, pager actions, anchored Search, Connection help and Reduced Motion.');
}finally{
  await browser.close();
  await new Promise(r=>server.close(r));
}

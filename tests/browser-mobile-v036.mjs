import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.resolve(here,'../webui/private');
const host='127.0.0.1',port=8770;
const TiB=1024**4;
const FREE=Math.round(1.234*TiB);
const variants={qb4:{qb:'v4.1.9.1',api:'2.2.1',privateCount:1},qb5:{qb:'v5.2.3',api:'2.15.1',privateCount:2}};
const viewports=[
  {width:320,height:568,label:'small'},
  {width:360,height:800,label:'medium'},
  {width:390,height:844,label:'reference'},
  {width:430,height:932,label:'large'}
];
const stateCycle=['stalledUP','downloading','uploading','stoppedUP','stalledDL','queuedDL'];
const torrents=Array.from({length:60},(_,i)=>({
  hash:(i+1).toString(16).padStart(40,'0'),name:`Mobile Fixture Torrent ${String(i+1).padStart(3,'0')} with a realistically long title`,
  size:1024*1024*(29.8+i),progress:i%4===2?1:.42,dlspeed:i%3?0:245760,upspeed:i%4?0:32768,eta:3600+i*7,state:stateCycle[i%stateCycle.length],ratio:.25,
  tracker:i===1?'https://tracker.pt.example/announce':'https://tracker.example/announce',category:i%2?'Movies':'',added_on:100000+i,save_path:i%2?'/downloads/movies':'/downloads',private:i===0?1:0
}));
const advancedPrefs={
  slow_torrent_inactive_timer:60,slow_torrent_dl_rate_threshold:2,slow_torrent_ul_rate_threshold:2,send_buffer_watermark:500,send_buffer_low_watermark:10,
  socket_backlog_size:30,socket_receive_buffer_size:0,socket_send_buffer_size:0,stop_tracker_timeout:2,upnp_lease_duration:0,torrent_file_size_limit:104857600,
  save_resume_data_interval:60,disk_cache_ttl:60,checking_memory_use:32,async_io_threads:10,file_pool_size:40,upload_slots_behavior:0,upload_choking_algorithm:1,
  utp_tcp_mixed_mode:0,torrent_stop_condition:'None',torrent_content_remove_option:'Delete',hostname_cache_ttl:1200
};
function exposed(name,list){return list.map(item=>{const copy={...item};if(name==='qb4')delete copy.private;return copy;});}
function assert(condition,message){if(!condition)throw new Error(message);}
function json(res,value){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function text(res,value){res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
function api(req,res,name,apiPath,url){
  if(apiPath==='app/version')return text(res,variants[name].qb);
  if(apiPath==='app/webapiVersion')return text(res,variants[name].api);
  if(apiPath==='app/preferences')return json(res,{alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',web_ui_port:8080,...advancedPrefs});
  if(apiPath==='app/buildInfo')return json(res,{});
  if(apiPath==='transfer/info')return json(res,{dl_info_speed:0,up_info_speed:0,dl_info_data:0,up_info_data:0,dl_rate_limit:0,up_rate_limit:0,connection_status:'connected',dht_nodes:32,total_peer_connections:4});
  if(apiPath==='transfer/speedLimitsMode')return text(res,'0');
  if(apiPath==='sync/maindata'){
    const rid=Number(url.searchParams.get('rid')||0);
    if(rid>0)return json(res,{rid:rid+1,full_update:false,server_state:{}});
    return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{free_space_on_disk:FREE,connection_status:'connected',dl_info_speed:0,up_info_speed:0,dl_info_data:0,up_info_data:0,dl_rate_limit:0,up_rate_limit:0,dht_nodes:32,total_peer_connections:4}});
  }
  if(apiPath==='torrents/info'){
    const source=exposed(name,torrents),hashes=url.searchParams.get('hashes');
    if(hashes){const set=new Set(hashes.split('|'));return json(res,source.filter(t=>set.has(t.hash)));}
    const limit=Math.max(0,Number(url.searchParams.get('limit')||0)),offset=Math.max(0,Number(url.searchParams.get('offset')||0));
    return json(res,limit?source.slice(offset,offset+limit):source.slice(offset));
  }
  if(apiPath==='torrents/categories')return json(res,{Movies:{name:'Movies',savePath:'/downloads/movies'}});
  if(apiPath==='torrents/tags')return json(res,['Fixture']);
  if(apiPath==='torrents/properties')return json(res,{save_path:'/downloads',total_size:104857600,total_downloaded:52428800,total_uploaded:1048576,share_ratio:.2,nb_connections:4,seeds:2,peers:3,addition_date:1788140000,completion_date:-1,created_by:'fixture',pieces_num:20,piece_size:65536});
  if(apiPath==='torrents/files'||apiPath==='torrents/trackers'||apiPath==='torrents/webseeds')return json(res,[]);
  if(apiPath==='sync/torrentPeers')return json(res,{peers:{}});
  if(apiPath==='rss/items')return json(res,{});
  if(apiPath==='search/plugins')return json(res,[]);
  if(apiPath==='log/main'||apiPath==='log/peers')return json(res,[]);
  if(req.method==='POST'){res.writeHead(200,{'cache-control':'no-store'});return res.end('');}
  return json(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://${host}:${port}`),m=url.pathname.match(/^\/(qb4|qb5)(?:\/(.*))?$/);if(!m){res.writeHead(404);return res.end('not found');}
  const name=m[1],relative=m[2]||'';if(relative.startsWith('api/v2/'))return api(req,res,name,relative.slice(7),url);
  if(relative==='weigg-install.json')return json(res,{version:'0.3.6',gitSha:'1234567890abcdef1234567890abcdef12345678',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb-fixture/config/weigg-qb-webui'});
  const requested=relative||'index.html',file=path.resolve(webRoot,requested);if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}
  const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);
}catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function assertSingleScrollOwner(page,name,viewport,route){
  const state=await page.evaluate(route=>{const view=document.getElementById(route+'-view');return {owners:view?[...view.querySelectorAll('[data-primary-scroll="1"]')].map(n=>n.id):[],docH:document.documentElement.scrollHeight,innerH,viewBottom:view?.getBoundingClientRect().bottom,workspaceBottom:document.querySelector('.workspace')?.getBoundingClientRect().bottom};},route);
  assert(state.owners.length===1,`${name}/${viewport.label}/${route}: expected one primary scroll owner, got ${state.owners.join(',')}`);
  assert(state.docH<=state.innerH+1,`${name}/${viewport.label}/${route}: document gained an extra vertical page`);
  assert(Math.abs((state.viewBottom||0)-(state.workspaceBottom||0))<=3,`${name}/${viewport.label}/${route}: active route does not fill workspace`);
}

const browser=await chromium.launch({headless:true});
try{
  for(const name of Object.keys(variants))for(const viewport of viewports){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:'en-US'});
    await context.addInitScript(()=>localStorage.setItem('weigg-v020-settings',JSON.stringify({ptTrackers:['pt.example'],pageSize:50})));
    const page=await context.newPage(),errors=[];
    page.on('console',msg=>{if(msg.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(msg.text()))errors.push(msg.text());});page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'networkidle'});
    await page.waitForSelector('.torrent-mobile-card');
    await page.waitForFunction(()=>window.WeiG?.MobileAdaptive&&document.querySelector('#status-free-space:not([hidden]) strong')?.textContent!=='—');
    await page.waitForFunction(()=>document.documentElement.dataset.v036==='1'&&document.querySelector('#mobile-command-bar .ui-select__trigger')&&document.querySelector('#filter-shelf'));
    await page.waitForFunction(()=>document.querySelectorAll('#tracker-nav [data-tracker]').length>1&&document.querySelector('#torrent-count')?.textContent==='60',null,{timeout:3500});
    await page.waitForFunction(()=>{
      const meta=document.querySelector('.mobile-card-meta');if(!meta||!window.WeiG?.MobileAdaptive)return false;
      WeiG.MobileAdaptive.fitMobileMeta(meta);return meta.scrollWidth<=meta.clientWidth+2;
    },null,{timeout:1800});

    const state=await page.evaluate(()=>{
      const workspace=document.querySelector('.workspace'),panel=document.querySelector('.torrent-panel'),list=document.querySelector('#torrent-list'),meta=document.querySelector('.mobile-card-meta'),cells=[...meta.querySelectorAll('.cell')],storage=document.querySelector('#status-free-space strong'),tones=[...document.querySelectorAll('.torrent-mobile-card .status-pill')].map(n=>n.dataset.tone),rects=cells.map(n=>n.getBoundingClientRect());
      const bar=document.querySelector('#mobile-command-bar'),barChildren=[...bar.children].filter(n=>getComputedStyle(n).display!=='none').map(n=>n.getBoundingClientRect());
      const action=document.querySelector('#mobile-command-bar .toolbar .btn'),count=document.querySelector('.mobile-command-count');
      const stats=[...document.querySelectorAll('#list-view .stat-card')].filter(n=>getComputedStyle(n).display!=='none').map(card=>({label:parseFloat(getComputedStyle(card.querySelector('.text-label')).fontSize),value:parseFloat(getComputedStyle(card.querySelector('strong')).fontSize),meta:parseFloat(getComputedStyle(card.querySelector('small')).fontSize)}));
      const facet=id=>document.querySelector(`.facet-filter[data-facet="${id}"] .facet-trigger__value`)?.textContent.trim();
      return {
        free:storage?.textContent,
        formatted:[WeiG.MobileAdaptive.formatFreeSpace(1.234*(1024**4)),WeiG.MobileAdaptive.formatFreeSpace(12.34*(1024**3)),WeiG.MobileAdaptive.formatFreeSpace(987.6*(1024**2)),WeiG.MobileAdaptive.formatFreeSpace(9.876*(1024**3))],
        workspace:{bottom:workspace.getBoundingClientRect().bottom,height:workspace.clientHeight,scrollHeight:workspace.scrollHeight},panel:{bottom:panel.getBoundingClientRect().bottom,height:panel.getBoundingClientRect().height},list:{height:list.getBoundingClientRect().height,scrollHeight:list.scrollHeight},
        meta:{display:getComputedStyle(meta).display,clientWidth:meta.clientWidth,scrollWidth:meta.scrollWidth,tops:rects.map(r=>Math.round(r.top)),font:getComputedStyle(cells[0]).fontSize,gap:getComputedStyle(meta).gap,text:cells.map(n=>n.textContent)},tones,
        command:{clientWidth:bar.clientWidth,scrollWidth:bar.scrollWidth,tops:barChildren.map(r=>Math.round(r.top)),actionFont:action?parseFloat(getComputedStyle(action).fontSize):0,countFont:count?parseFloat(getComputedStyle(count).fontSize):0,text:bar.textContent.replace(/\s+/g,' ').trim()},
        stats,facets:{tracker:facet('tracker-section'),path:facet('savepath-section'),category:facet('category-section'),tag:facet('tag-section')},
        allTracker:document.querySelector('#tracker-nav [data-tracker=""]')?.textContent.trim(),allPath:document.querySelector('#savepath-nav [data-savepath=""]')?.textContent.trim(),allCategory:document.querySelector('#category-nav [data-category=""]')?.textContent.trim(),
        doc:{width:document.documentElement.scrollWidth,innerWidth,scrollHeight:document.documentElement.scrollHeight,innerHeight}
      };
    });
    assert(state.free==='1.23 TiB',`${name}/${viewport.label}: free-space display expected 1.23 TiB, got ${state.free}`);
    assert(JSON.stringify(state.formatted)===JSON.stringify(['1.23 TiB','12.3 GiB','988 MiB','9.88 GiB']),`${name}/${viewport.label}: adaptive IEC formatter contract failed`);
    assert(state.command.scrollWidth<=state.command.clientWidth+1,`${name}/${viewport.label}: compact command bar overflows ${state.command.scrollWidth}>${state.command.clientWidth}: ${state.command.text}`);
    assert(Math.max(...state.command.tops)-Math.min(...state.command.tops)<=3,`${name}/${viewport.label}: compact command bar wrapped`);
    assert(state.command.countFont<state.command.actionFont,`${name}/${viewport.label}: Torrent count must be visually quieter than actions (${state.command.countFont} >= ${state.command.actionFont})`);
    assert(state.facets.tracker==='Tracker',`${name}/${viewport.label}: all Tracker collapsed summary must be Tracker, got ${state.facets.tracker}`);
    assert(state.facets.path==='Path',`${name}/${viewport.label}: all Path collapsed summary must be Path, got ${state.facets.path}`);
    assert(state.facets.category==='Category',`${name}/${viewport.label}: all Category collapsed summary must be Category, got ${state.facets.category}`);
    if(name==='qb5')assert(state.facets.tag==='Tag',`${name}/${viewport.label}: all Tag collapsed summary must be Tag, got ${state.facets.tag}`);
    assert(/^All Trackers/.test(state.allTracker||''),`${name}/${viewport.label}: expanded Tracker source must still expose All Trackers`);
    assert(/^All Paths/.test(state.allPath||''),`${name}/${viewport.label}: expanded Path source must still expose All Paths`);
    assert(/^All Categories/.test(state.allCategory||''),`${name}/${viewport.label}: expanded Category source must still expose All Categories`);
    for(const metric of state.stats){assert(metric.value<=metric.label+0.1,`${name}/${viewport.label}: stat value ${metric.value}px exceeds label ${metric.label}px`);assert(metric.meta<=metric.value+0.1,`${name}/${viewport.label}: stat helper ${metric.meta}px exceeds value ${metric.value}px`);}
    assert(state.meta.display==='flex',`${name}/${viewport.label}: mobile Torrent meta is not one-line flex`);
    assert(Math.max(...state.meta.tops)-Math.min(...state.meta.tops)<=3,`${name}/${viewport.label}: Torrent meta wrapped to multiple lines`);
    assert(state.meta.scrollWidth<=state.meta.clientWidth+2,`${name}/${viewport.label}: Torrent meta overflows horizontally ${state.meta.scrollWidth}>${state.meta.clientWidth}`);
    assert(state.list.height>=100,`${name}/${viewport.label}: adaptive Torrent list collapsed (${state.list.height}px)`);
    assert(Math.abs(state.panel.bottom-state.workspace.bottom)<=7,`${name}/${viewport.label}: Torrent panel leaves unused bottom workspace (${state.workspace.bottom-state.panel.bottom}px)`);
    assert(state.doc.width<=state.doc.innerWidth+1,`${name}/${viewport.label}: document horizontal overflow`);
    assert(state.doc.scrollHeight<=state.doc.innerHeight+1,`${name}/${viewport.label}: document vertical overflow`);
    assert(state.tones.includes('stalled-up')&&state.tones.includes('download')&&state.tones.includes('seed')&&state.tones.includes('stopped'),`${name}/${viewport.label}: distinct semantic state tones missing`);
    await assertSingleScrollOwner(page,name,viewport,'list');

    await page.locator('#mobile-command-bar .ui-select__trigger').click();
    await page.waitForSelector('#weigg-floating-layer .ui-select__menu:not([hidden])');
    const floating=await page.evaluate(()=>document.querySelector('#weigg-floating-layer .ui-select__menu:not([hidden])')?.parentElement?.id);
    assert(floating==='weigg-floating-layer',`${name}/${viewport.label}: compact filter must use canonical FloatingLayer`);
    await page.keyboard.press('Escape');

    const focusBefore=await page.evaluate(()=>{const list=document.querySelector('#torrent-list');list.scrollTop=180;list.__weiggVirtualScrollTop=180;return {height:list.clientHeight,scroll:list.scrollTop};});
    await page.locator('.data-viewport-focus').click();await page.waitForTimeout(80);
    const focusOn=await page.evaluate(()=>({active:document.querySelector('#list-view').classList.contains('is-data-focus'),height:document.querySelector('#torrent-list').clientHeight,scroll:document.querySelector('#torrent-list').scrollTop,header:getComputedStyle(document.querySelector('#list-view>.workspace__header')).display}));
    assert(focusOn.active&&focusOn.header==='none',`${name}/${viewport.label}: data viewport focus did not collapse page chrome`);
    assert(focusOn.height>=focusBefore.height,`${name}/${viewport.label}: focus mode did not increase/retain Torrent viewport`);
    await page.locator('.data-viewport-focus').click();await page.waitForTimeout(80);
    const focusAfter=await page.evaluate(()=>({active:document.querySelector('#list-view').classList.contains('is-data-focus'),scroll:document.querySelector('#torrent-list').scrollTop}));
    assert(!focusAfter.active,`${name}/${viewport.label}: data viewport did not restore`);
    assert(Math.abs(focusAfter.scroll-focusBefore.scroll)<=4,`${name}/${viewport.label}: focus restore lost scroll ${focusBefore.scroll} -> ${focusAfter.scroll}`);

    await page.evaluate(()=>document.querySelector('#filter-nav [data-filter="private"]')?.click());
    await page.waitForFunction(expected=>document.querySelector('#torrent-count')?.textContent===String(expected),variants[name].privateCount,{timeout:3000});
    const privateState=await page.evaluate(()=>({count:document.querySelector('#torrent-count')?.textContent,names:[...document.querySelectorAll('.torrent-mobile-card .mobile-card-title')].map(n=>n.textContent)}));
    assert(Number(privateState.count)===variants[name].privateCount,`${name}/${viewport.label}: Private/PT union count mismatch`);
    if(name==='qb5')assert(privateState.names.some(x=>x.includes('001'))&&privateState.names.some(x=>x.includes('002')),`${name}/${viewport.label}: exact private + PT tracker union is incomplete`);
    else assert(privateState.names.some(x=>x.includes('002'))&&!privateState.names.some(x=>x.includes('001')),`${name}/${viewport.label}: legacy Private/PT must use PT fallback without fabricating exact private`);

    await page.evaluate(()=>document.querySelector('#filter-nav [data-filter="all"]')?.click());
    await page.waitForFunction(()=>document.querySelector('#torrent-count')?.textContent==='60');
    await page.evaluate(()=>WeiG.MobileAdaptive.refreshStorage());await page.waitForTimeout(40);
    assert((await page.locator('#status-free-space strong').textContent())==='1.23 TiB',`${name}/${viewport.label}: incremental maindata without free-space delta must retain last value`);

    await page.locator('#mobile-bottom-nav [data-route="settings"]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');
    await page.waitForSelector('#settings-content .setting-card,#settings-content .settings-control');await page.waitForTimeout(100);
    await assertSingleScrollOwner(page,name,viewport,'settings');
    const settings=await page.evaluate(()=>{const root=document.querySelector('#settings-content');root.scrollTop=root.scrollHeight;return {client:root.clientHeight,scrollHeight:root.scrollHeight,scrollTop:root.scrollTop,max:Math.max(0,root.scrollHeight-root.clientHeight),docH:document.documentElement.scrollHeight,innerH};});
    assert(settings.scrollHeight>settings.client,`${name}/${viewport.label}: Settings does not expose a scrollable content viewport`);
    assert(settings.scrollTop>=settings.max-3,`${name}/${viewport.label}: Settings cannot scroll to its final configuration`);
    assert(settings.docH<=settings.innerH+1,`${name}/${viewport.label}: Settings created document-level overflow`);

    for(const route of ['search','rss']){
      await page.locator(`#mobile-bottom-nav [data-route="${route}"]`).click();await page.waitForFunction(expected=>WeiG.Router.route().name===expected,route);await page.waitForTimeout(80);
      await assertSingleScrollOwner(page,name,viewport,route);
      const tool=await page.evaluate(expected=>{const workspace=document.querySelector('.workspace'),view=document.getElementById(expected+'-view'),pageBox=view.querySelector('.tool-page');return {viewH:view.getBoundingClientRect().height,pageBottom:pageBox.getBoundingClientRect().bottom,workspaceH:workspace.clientHeight,workspaceBottom:workspace.getBoundingClientRect().bottom};},route);
      assert(tool.viewH<=tool.workspaceH+2,`${name}/${viewport.label}/${route}: tool view exceeds workspace`);
      assert(Math.abs(tool.pageBottom-tool.workspaceBottom)<=7,`${name}/${viewport.label}/${route}: tool page does not consume remaining viewport`);
    }

    await page.evaluate(()=>WeiG.Router.go('logs'));await page.waitForFunction(()=>WeiG.Router.route().name==='logs');await page.waitForTimeout(80);await assertSingleScrollOwner(page,name,viewport,'logs');
    await page.evaluate(()=>WeiG.Router.home());await page.waitForFunction(()=>WeiG.Router.route().name==='home');await page.waitForSelector('.torrent-mobile-card');
    await page.locator('.torrent-mobile-card .mobile-card-title').first().click();await page.waitForFunction(()=>WeiG.Router.route().name==='torrent');await page.waitForSelector('#detail-content');await page.waitForTimeout(80);await assertSingleScrollOwner(page,name,viewport,'detail');

    assert(errors.length===0,`${name}/${viewport.label}: browser errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log('v0.3.6 Mobile Adaptive System 2.0 passed across Torrent, Settings, Search, RSS, Logs and Detail for qB 4.1.9.1 + 5.2.3 across 4 phone sizes.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

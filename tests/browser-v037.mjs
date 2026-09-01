import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.resolve(here,'../webui/private');
const host='127.0.0.1',port=8771;
const torrents=Array.from({length:60},(_,i)=>({
  hash:(i+1).toString(16).padStart(40,'0'),
  name:`v0.3.7 Fixture Torrent ${String(i+1).padStart(2,'0')}`,
  size:1048576*(20+i),progress:i%3?1:.55,dlspeed:i%3?0:1200+i,upspeed:i%3?600+i:0,
  eta:i%3?8640000:3600,state:i%3?'stalledUP':'downloading',ratio:1.25,
  tracker:i%2?'https://tracker.example/announce':'https://private.example/announce',
  category:i%2?'Movies':'Books',tags:i%2?'A':'B',save_path:i%2?'/downloads/a':'/downloads/b',
  added_on:1788220000+i,private:i%2
}));
const prefs={
  alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',
  save_path:'/downloads',temp_path:'/downloads/incomplete',temp_path_enabled:false,
  preallocate_all:false,create_subfolder_enabled:true,start_paused_enabled:false,auto_tmm_enabled:false,
  listen_port:6881,upnp:true,random_port:false,max_connec:500,max_connec_per_torrent:100,max_uploads:-1,max_uploads_per_torrent:4,
  proxy_type:0,proxy_ip:'',proxy_port:8080,proxy_username:'',
  dl_limit:2097152,up_limit:1048576,alt_dl_limit:524288,alt_up_limit:262144,scheduler_enabled:false,schedule_from_hour:8,schedule_to_hour:18,limit_utp_rate:true,limit_tcp_overhead:false,
  dht:true,pex:true,lsd:true,encryption:0,queueing_enabled:true,max_active_downloads:5,max_active_uploads:8,max_active_torrents:12,max_ratio:2,max_ratio_enabled:false,max_seeding_time:60,max_seeding_time_enabled:false,
  web_ui_address:'*',web_ui_port:8080,web_ui_upnp:false,web_ui_username:'admin',web_ui_csrf_protection_enabled:true,web_ui_clickjacking_protection_enabled:true,web_ui_host_header_validation_enabled:true,web_ui_localhost_auth_enabled:false,web_ui_max_auth_fail_count:5,web_ui_ban_duration:3600,
  slow_torrent_inactive_timer:60,slow_torrent_dl_rate_threshold:2,slow_torrent_ul_rate_threshold:2,
  socket_receive_buffer_size:0,socket_send_buffer_size:0,socket_backlog_size:30,
  torrent_file_size_limit:104857600,disk_queue_size:65536,memory_working_set_limit:512,checking_memory_use:32,
  stop_tracker_timeout:2,upnp_lease_duration:0,save_resume_data_interval:60,hostname_cache_ttl:1200,
  torrent_content_remove_option:'Delete'
};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,v){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));}
function text(res,v){res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks).toString('utf8');}
async function api(req,res,p,url){
  if(p==='app/version')return text(res,'v5.2.3');
  if(p==='app/webapiVersion')return text(res,'2.15.1');
  if(p==='app/buildInfo')return json(res,{});
  if(p==='app/preferences'&&req.method==='GET')return json(res,prefs);
  if(p==='app/setPreferences'&&req.method==='POST'){await body(req);res.writeHead(200);return res.end('');}
  if(p==='transfer/info')return json(res,{dl_info_speed:12345,up_info_speed:6789,connection_status:'connected',dht_nodes:10,total_peer_connections:24});
  if(p==='sync/maindata')return json(res,{rid:2,full_update:true,torrents:{},server_state:{connection_status:'connected',free_space_on_disk:123456789012,dl_info_speed:12345,up_info_speed:6789,dht_nodes:10,total_peer_connections:24}});
  if(p==='torrents/info'){
    const hashes=url.searchParams.get('hashes');
    if(hashes){const set=new Set(hashes.split('|'));return json(res,torrents.filter(t=>set.has(t.hash)));}
    const limit=Number(url.searchParams.get('limit')||0),offset=Number(url.searchParams.get('offset')||0);
    return json(res,limit?torrents.slice(offset,offset+limit):torrents.slice(offset));
  }
  if(p==='torrents/categories')return json(res,{Movies:{name:'Movies'},Books:{name:'Books'}});
  if(p==='torrents/tags')return json(res,['A','B']);
  if(p==='rss/items')return json(res,{});
  if(p==='search/plugins')return json(res,[]);
  if(p==='log/main'||p==='log/peers')return json(res,[]);
  if(p==='torrents/properties')return json(res,{save_path:'/downloads',total_size:1048576,total_downloaded:1048576,total_uploaded:1048576,share_ratio:1,nb_connections:1,seeds:1,peers:1,addition_date:1788220000,completion_date:1788220100,created_by:'fixture',pieces_num:10,piece_size:65536});
  if(p==='torrents/files'||p==='torrents/trackers'||p==='torrents/webseeds')return json(res,[]);
  if(p==='sync/torrentPeers')return json(res,{peers:{}});
  if(req.method==='POST'){await body(req);res.writeHead(200,{'cache-control':'no-store'});return res.end('');}
  return json(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\/+/, '');
    if(rel.startsWith('api/v2/'))return await api(req,res,rel.slice(7),url);
    if(rel==='weigg-install.json')return json(res,{version:'0.3.7',gitSha:'1234567890abcdef1234567890abcdef12345678',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/fixture/weigg-qb-webui',installedAt:'2026-09-01T03:00:00Z',installer:'fixture'});
    const file=path.resolve(webRoot,rel||'index.html');
    if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}
    const data=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(data);
  }catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain'});res.end(String(e));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

const browser=await chromium.launch({headless:true});
try{
  {
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/#/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!WeiG.V037&&document.querySelectorAll('.torrent-mobile-card').length>0,null,{timeout:5000});
    const shell=await page.evaluate(()=>{
      const w=document.querySelector('.workspace').getBoundingClientRect(),n=document.querySelector('#mobile-bottom-nav').getBoundingClientRect(),s=getComputedStyle(document.querySelector('.statusbar'));
      const item=document.querySelector('.mobile-bottom-nav__item'),icon=item.querySelector('span').getBoundingClientRect(),label=item.querySelector('small').getBoundingClientRect();
      return {gap:Math.round(n.top-w.bottom),status:s.display,iconRight:icon.right,labelLeft:label.left,itemHeight:item.getBoundingClientRect().height,labelHeight:label.height};
    });
    assert(shell.gap<=6,`mobile workspace must meet bottom nav, gap=${shell.gap}`);
    assert(shell.status==='none','mobile status row must collapse');
    assert(shell.labelLeft>=shell.iconRight-1,'bottom nav label must sit to the right of icon');
    assert(shell.labelHeight<shell.itemHeight,'bottom nav label must stay one line');

    const selection=page.locator('.selection-action-select');
    await selection.selectOption('page');await page.waitForFunction(()=>WeiG.SelectionModelV037.count()===50);
    await selection.selectOption('all');await page.waitForFunction(()=>WeiG.SelectionModelV037.count()===60,null,{timeout:4000});
    assert((await page.locator('.selection-count').textContent()).match(/60/),'selection count should expose all matching count');
    await selection.selectOption('clear');await page.waitForFunction(()=>WeiG.SelectionModelV037.count()===0);

    const card=page.locator('.torrent-mobile-card').first();
    await card.dispatchEvent('pointerdown',{pointerType:'touch',clientX:100,clientY:300,pointerId:9});
    await page.waitForTimeout(560);
    assert(await page.locator('#v037-actions-dialog').evaluate(el=>el.open),'mobile long press must open canonical torrent actions');
    await page.locator('#v037-actions-dialog .v037-close').click();

    await page.locator('#mobile-bottom-nav [data-route="settings"]').click();
    await page.waitForFunction(()=>WeiG.Router.route().name==='settings');
    await page.waitForSelector('#settings-content .settings-control, #settings-content .setting-card');
    const settings=await page.evaluate(()=>{
      const tabs=document.querySelector('#settings-tabs'),content=document.querySelector('#settings-content'),workspace=document.querySelector('.workspace'),nav=document.querySelector('#mobile-bottom-nav');
      return {tabs:getComputedStyle(tabs).display,drawer:!!document.querySelector('.v037-mobile-settings-nav'),contentH:content.getBoundingClientRect().height,space:nav.getBoundingClientRect().top-workspace.getBoundingClientRect().top,scrollH:content.scrollHeight,clientH:content.clientHeight};
    });
    assert(settings.tabs==='none','mobile Settings rail must be hidden from workspace');
    assert(settings.drawer,'mobile Settings categories must exist in hamburger drawer');
    assert(settings.contentH>settings.space*.55,'Settings content should consume the workspace');
    assert(settings.scrollH>settings.clientH,'fixture should make Settings content independently scrollable');
    await page.locator('#menu-btn').click();
    const about=page.locator('.v037-mobile-settings-nav [data-mobile-settings-tab="about"]');assert(await about.count()===1,'About must be in mobile drawer');
    await about.click();await page.waitForSelector('.about-grid');
    assert((await page.locator('.about-grid').textContent()).includes('WeiG qB WebUI'),'About content missing project identity');
    assert(errors.length===0,`mobile browser errors: ${errors.join(' | ')}`);
    await page.close();
  }
  {
    const page=await browser.newPage({viewport:{width:1366,height:768}});
    await page.addInitScript(()=>localStorage.setItem('weigg-v020-settings',JSON.stringify({refresh:60000})));
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/#/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!WeiG.V037&&document.querySelectorAll('.torrent-row').length>0,null,{timeout:5000});
    await page.waitForFunction(()=>String(document.querySelector('#catalog-state')?.textContent||'').startsWith('全库索引 60'),null,{timeout:5000});
    await page.locator('.torrent-row').first().click({button:'right'});
    assert(await page.locator('#v037-actions-dialog').evaluate(el=>el.open),'desktop right click must open canonical torrent actions');
    await page.locator('#v037-actions-dialog .v037-close').click();

    await page.evaluate(()=>{window.__v037FirstRow=document.querySelector('.torrent-row');});
    const handle=page.locator('#torrent-table-head .col-resize[data-v037-resize="1"]').first(),box=await handle.boundingBox();assert(box,'resize handle missing');
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+45,box.y+box.height/2,{steps:6});
    assert(await page.evaluate(()=>document.querySelector('.torrent-row')===window.__v037FirstRow),'column pointermove rebuilt VirtualList rows');
    await page.mouse.up();

    await page.locator('#add-btn').click();await page.waitForSelector('#add-dialog[open]');
    const dialog=await page.evaluate(()=>{const d=document.querySelector('#add-dialog'),b=d.querySelector('.dialog__body');return {scroll:b.scrollHeight,client:b.clientHeight,top:d.getBoundingClientRect().top,bottom:d.getBoundingClientRect().bottom,height:innerHeight};});
    assert(dialog.bottom<=dialog.height+1&&dialog.top>=0,'Add Torrent dialog must fit desktop viewport');
    assert(dialog.scroll<=dialog.client+2,`Add Torrent body should not scroll when space is available (${dialog.scroll}/${dialog.client})`);
    await page.locator('#add-dialog .icon-btn').click();

    await page.locator('[data-route="settings"]').first().click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');await page.waitForSelector('#settings-content .settings-control, #settings-content .setting-card');
    await page.locator('#settings-tabs [data-settings-tab="speed"]').click();await page.waitForSelector('[data-setting-key="dl_limit"]');
    const speed=await page.evaluate(()=>({title:document.querySelector('[data-setting-key="dl_limit"] strong')?.textContent,value:document.querySelector('[data-setting-key="dl_limit"] input')?.value}));
    assert(/\(KiB\/s\)/.test(speed.title||''),'normal Speed setting must show KiB/s unit');
    assert(speed.value==='2048',`2 MiB/s API rate should display 2048 KiB/s, got ${speed.value}`);

    await page.locator('#settings-tabs [data-settings-tab="advanced"]').click();await page.waitForSelector('[data-setting-key="socket_receive_buffer_size"]');
    await page.evaluate(()=>WeiG.I18n.setLocale('zh-CN'));await page.locator('#settings-tabs [data-settings-tab="advanced"]').click();await page.waitForTimeout(80);
    const adv=await page.evaluate(()=>({title:document.querySelector('[data-setting-key="socket_receive_buffer_size"] strong')?.textContent,help:!!document.querySelector('[data-setting-key="socket_receive_buffer_size"] .setting-help-button')}));
    assert(/套接字接收缓存大小/.test(adv.title||''),'verified qB official Chinese label should be visible');
    assert(adv.help,'Advanced setting must expose canonical help button');
    assert(errors.length===0,`desktop browser errors: ${errors.join(' | ')}`);
    await page.close();
  }
  console.log('v0.3.7 unified interaction/settings browser regression passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

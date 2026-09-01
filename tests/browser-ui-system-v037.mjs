import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.resolve(here,'../webui/private');
const host='127.0.0.1',port=8774;
const torrents=Array.from({length:55},(_,i)=>({
  hash:(i+1).toString(16).padStart(40,'0'),name:`Responsive UI Fixture Torrent ${String(i+1).padStart(2,'0')} with a deliberately long name`,
  size:1073741824+i*1048576,progress:i%4?1:.625,dlspeed:i%4?0:7340032+i*1000,upspeed:1048576+i*500,
  eta:i%4?8640000:2400,state:i%4?'stalledUP':'downloading',ratio:1.5+i/100,
  tracker:i%2?'https://tracker.example/announce':'https://private.example/announce',category:i%2?'Movies':'Books',tags:i%2?'A, B':'C',
  save_path:i%2?'/downloads/media':'/downloads/books',added_on:1788220000+i,completion_on:i%4?1788225000+i:0,
  priority:i%3,num_seeds:20+i,num_leechs:5+i,private:i%2
}));
const prefs={
  alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',save_path:'/downloads',temp_path:'/downloads/incomplete',
  temp_path_enabled:false,preallocate_all:false,create_subfolder_enabled:true,start_paused_enabled:false,auto_tmm_enabled:false,
  listen_port:6881,upnp:true,random_port:false,max_connec:500,max_connec_per_torrent:100,max_uploads:-1,max_uploads_per_torrent:4,
  proxy_type:0,proxy_ip:'',proxy_port:8080,proxy_username:'',dl_limit:2097152,up_limit:1048576,alt_dl_limit:524288,alt_up_limit:262144,
  scheduler_enabled:false,schedule_from_hour:8,schedule_to_hour:18,limit_utp_rate:true,limit_tcp_overhead:false,dht:true,pex:true,lsd:true,encryption:0,
  queueing_enabled:true,max_active_downloads:5,max_active_uploads:8,max_active_torrents:12,max_ratio:2,max_ratio_enabled:false,max_seeding_time:60,
  max_seeding_time_enabled:false,web_ui_address:'*',web_ui_port:8080,web_ui_upnp:false,web_ui_username:'admin',web_ui_csrf_protection_enabled:true,
  web_ui_clickjacking_protection_enabled:true,web_ui_host_header_validation_enabled:true,web_ui_localhost_auth_enabled:false,web_ui_max_auth_fail_count:5,
  web_ui_ban_duration:3600,slow_torrent_inactive_timer:60,slow_torrent_dl_rate_threshold:2,slow_torrent_ul_rate_threshold:2,
  socket_receive_buffer_size:0,socket_send_buffer_size:0,socket_backlog_size:30,torrent_file_size_limit:104857600,disk_queue_size:65536,
  memory_working_set_limit:512,checking_memory_use:32,stop_tracker_timeout:2,upnp_lease_duration:0,save_resume_data_interval:60,
  hostname_cache_ttl:1200,torrent_content_remove_option:'Delete'
};
let altMode=false,globalDown=3145728,globalUp=1572864;
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,v){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));}
function text(res,v){res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks).toString('utf8');}
async function api(req,res,p,url){
  if(p==='app/version')return text(res,'v5.2.3');
  if(p==='app/webapiVersion')return text(res,'2.15.1');
  if(p==='app/buildInfo')return json(res,{});
  if(p==='app/preferences'&&req.method==='GET')return json(res,prefs);
  if(p==='app/setPreferences'&&req.method==='POST'){const raw=await body(req);const q=new URLSearchParams(raw);try{Object.assign(prefs,JSON.parse(q.get('json')||'{}'));}catch{}res.writeHead(200);return res.end('');}
  if(p==='transfer/info')return json(res,{dl_info_speed:7340032,up_info_speed:1572864,connection_status:'connected',dht_nodes:18,total_peer_connections:33});
  if(p==='transfer/speedLimitsMode')return text(res,altMode?'1':'0');
  if(p==='transfer/downloadLimit')return text(res,globalDown);
  if(p==='transfer/uploadLimit')return text(res,globalUp);
  if(p==='transfer/toggleSpeedLimitsMode'&&req.method==='POST'){await body(req);altMode=!altMode;res.writeHead(200);return res.end('');}
  if(p==='transfer/setDownloadLimit'&&req.method==='POST'){const q=new URLSearchParams(await body(req));globalDown=Number(q.get('limit'))||0;res.writeHead(200);return res.end('');}
  if(p==='transfer/setUploadLimit'&&req.method==='POST'){const q=new URLSearchParams(await body(req));globalUp=Number(q.get('limit'))||0;res.writeHead(200);return res.end('');}
  if(p==='sync/maindata')return json(res,{rid:2,full_update:true,torrents:{},server_state:{connection_status:'connected',free_space_on_disk:98765432100,dl_info_speed:7340032,up_info_speed:1572864,dht_nodes:18,total_peer_connections:33}});
  if(p==='torrents/info'){
    const hashes=url.searchParams.get('hashes');if(hashes){const set=new Set(hashes.split('|'));return json(res,torrents.filter(t=>set.has(t.hash)));}
    const sort=url.searchParams.get('sort')||'added_on',reverse=url.searchParams.get('reverse')==='true',limit=Number(url.searchParams.get('limit')||0),offset=Number(url.searchParams.get('offset')||0);
    let out=torrents.slice().sort((a,b)=>{const av=a[sort],bv=b[sort];const c=typeof av==='string'||typeof bv==='string'?String(av||'').localeCompare(String(bv||'')):(Number(av)||0)-(Number(bv)||0);return reverse?-c:c;});
    return json(res,limit?out.slice(offset,offset+limit):out.slice(offset));
  }
  if(p==='torrents/categories')return json(res,{Movies:{name:'Movies'},Books:{name:'Books'}});
  if(p==='torrents/tags')return json(res,['A','B','C']);
  if(p==='rss/items')return json(res,{});if(p==='search/plugins')return json(res,[]);if(p==='log/main'||p==='log/peers')return json(res,[]);
  if(req.method==='POST'){await body(req);res.writeHead(200,{'cache-control':'no-store'});return res.end('');}
  return json(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\/+/, '');if(rel.startsWith('api/v2/'))return await api(req,res,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:'0.3.7',gitSha:'1234567890abcdef1234567890abcdef12345678',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qbittorrent/config/weigg-qb-webui',installer:'fixture'});const file=path.resolve(webRoot,rel||'index.html');if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}const data=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(data);}catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain'});res.end(String(e));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

const browser=await chromium.launch({headless:true});
try{
  {
    const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/#/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!WeiG.V037?.ui&&!!WeiG.V037?.polish&&document.querySelectorAll('.torrent-mobile-card--two-line').length>0,null,{timeout:7000});
    const mobileLayout=await page.evaluate(()=>{const card=document.querySelector('.torrent-mobile-card--two-line'),kids=Array.from(card.children).map(x=>x.className),v=document.querySelector('#torrent-list').__weiggTorrentVirtual,toolbar=document.querySelector('#list-view .grid-toolbar>div:first-child'),controls=document.querySelector('#v037-mobile-view-controls'),pageSelect=document.querySelector('#page-size + .ui-select .ui-select__trigger'),chev=document.querySelector('#page-size + .ui-select .ui-select__chevron'),nav=document.getElementById('mobile-bottom-nav'),shell=document.querySelector('.app-shell'),navRect=nav.getBoundingClientRect(),shellRect=shell.getBoundingClientRect(),navStyle=getComputedStyle(nav),shellStyle=getComputedStyle(shell),nodes=[document.querySelector('#v037-selection-control'),document.querySelector('#page-size').parentElement,controls].filter(Boolean).map(x=>x.getBoundingClientRect());return {kids,rowHeight:v&&v.rowHeight,cardHeight:card.getBoundingClientRect().height,toolbarOverflow:toolbar.scrollWidth-toolbar.clientWidth,ySpread:Math.max(...nodes.map(x=>x.top))-Math.min(...nodes.map(x=>x.top)),pageWidth:pageSelect&&pageSelect.getBoundingClientRect().width,chevron:chev&&getComputedStyle(chev).display,controls:!!controls,bottomGap:innerHeight-navRect.bottom,viewport:{innerHeight,visualHeight:visualViewport?.height||0,clientHeight:document.documentElement.clientHeight,dpr:devicePixelRatio},navGeom:{top:navRect.top,bottom:navRect.bottom,height:navRect.height,position:navStyle.position,transform:navStyle.transform,marginTop:navStyle.marginTop,marginBottom:navStyle.marginBottom,paddingTop:navStyle.paddingTop,paddingBottom:navStyle.paddingBottom,gridRow:navStyle.gridRow},shellGeom:{top:shellRect.top,bottom:shellRect.bottom,height:shellRect.height,computedHeight:shellStyle.height,minHeight:shellStyle.minHeight,maxHeight:shellStyle.maxHeight,paddingTop:shellStyle.paddingTop,paddingBottom:shellStyle.paddingBottom,gap:shellStyle.gap,gridRows:shellStyle.gridTemplateRows,transform:shellStyle.transform,boxSizing:shellStyle.boxSizing},bodyHeight:document.body.getBoundingClientRect().height,htmlHeight:document.documentElement.getBoundingClientRect().height};});
    assert(mobileLayout.kids.length===2&&mobileLayout.kids[0].includes('mobile-card-top--single')&&mobileLayout.kids[1].includes('mobile-card-meta--rail'),`mobile torrent must have two structural rows: ${mobileLayout.kids.join(' | ')}`);
    assert(mobileLayout.rowHeight<=80&&mobileLayout.cardHeight<=80,`mobile torrent row must stay <=80px (${mobileLayout.rowHeight}/${mobileLayout.cardHeight})`);
    assert(mobileLayout.controls,'mobile column/sort controls missing');assert(mobileLayout.toolbarOverflow<=2,`mobile toolbar overflowed by ${mobileLayout.toolbarOverflow}px`);assert(mobileLayout.ySpread<8,`mobile controls are not aligned on one row (${mobileLayout.ySpread}px)`);
    assert(mobileLayout.pageWidth<80,`page-size Select is not intrinsic (${mobileLayout.pageWidth}px)`);assert(mobileLayout.chevron==='none','Select chevron must be visually removed');assert(mobileLayout.bottomGap>=1,`mobile bottom navigation is visually clipped at viewport edge (${mobileLayout.bottomGap}px) · ${JSON.stringify({viewport:mobileLayout.viewport,nav:mobileLayout.navGeom,shell:mobileLayout.shellGeom,bodyHeight:mobileLayout.bodyHeight,htmlHeight:mobileLayout.htmlHeight})}`);

    await page.locator('#mobile-bottom-nav [data-route="settings"]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');await page.waitForSelector('#settings-content .settings-row--canonical');
    const settings=await page.evaluate(()=>{const rows=Array.from(document.querySelectorAll('#settings-content .settings-row--canonical')).slice(0,8),heights=rows.map(x=>x.getBoundingClientRect().height),tz=document.querySelector('[data-v036-timezone]');return {max:Math.max(...heights),min:Math.min(...heights),timezone:!!tz};});
    assert(settings.max<90,`mobile Settings rows are still oversized (${settings.max}px)`);assert(settings.timezone,'display timezone must remain in Settings');
    await page.evaluate(()=>document.querySelector('#settings-tabs [data-settings-tab="about"]')?.click());await page.waitForSelector('.about-surface .about-identity');
    const about=await page.evaluate(()=>{const facts=document.querySelector('.about-facts-grid'),rows=facts?Array.from(facts.children):[];return {one:document.querySelectorAll('#settings-content .about-surface').length,upstream:document.querySelector('.about-attribution')?.textContent||'',cards:document.querySelectorAll('#settings-content .about-surface .setting-card').length,facts:rows.length,singleColumn:rows.length<2||Math.abs(rows[0].getBoundingClientRect().left-rows[1].getBoundingClientRect().left)<2};});
    assert(about.one===1,'About must be one coherent surface');assert(/Christophe Dumez/.test(about.upstream),'About upstream attribution missing');assert(about.cards===0,'About must not remain a mosaic of setting cards');assert(about.facts>=4&&about.singleColumn,'mobile About facts must collapse to one compact column');
    assert(errors.length===0,`mobile UI system browser errors: ${errors.join(' | ')}`);await page.close();
  }
  {
    const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/#/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!WeiG.V037?.ui&&!!WeiG.V037?.polish&&!!document.querySelector('#transfer-capsule'),null,{timeout:7000});await page.waitForTimeout(1100);
    const status=await page.evaluate(()=>{const cap=document.querySelector('#transfer-capsule'),panel=document.querySelector('#list-view>.torrent-panel'),side=document.querySelector('#sidebar'),msg=document.querySelector('#status-message');return {timezone:document.querySelectorAll('[data-status-timezone]').length,capsule:!!cap?.querySelector('#status-dl')&&!!cap?.querySelector('#status-up'),mode:cap?.dataset.mode,tag:cap?.tagName,nestedButtons:cap?.querySelectorAll('button').length||0,statusMessage:String(msg?.textContent||'').trim(),bottomDelta:Math.abs((panel?.getBoundingClientRect().bottom||0)-(side?.getBoundingClientRect().bottom||0)),connection:document.querySelector('#status-connection')?.classList.contains('connection-indicator'),filterDot:!!document.querySelector('#filter-shelf .filter-shelf__summary')};});
    assert(status.timezone===0,'desktop statusbar timezone must be removed');assert(status.capsule,'Transfer Capsule must contain both download and upload rates');assert(status.mode==='normal','fixture should start in NORMAL transfer mode');assert(status.tag==='BUTTON'&&status.nestedButtons===0,'Transfer Capsule must be one button without legacy nested speed buttons');assert(status.statusMessage==='','routine successful refresh must not occupy the status dock');assert(status.bottomDelta<4,`Torrent panel and sidebar bottom edges must align (${status.bottomDelta}px)`);assert(status.connection&&status.filterDot,'connection indicators must be owned by the canonical polish layer');

    await page.locator('#refresh-btn').hover();await page.waitForSelector('#v037-tooltip.is-visible');assert(/Refresh data/i.test(await page.locator('#v037-tooltip').textContent()),'refresh icon tooltip missing');await page.locator('#theme-btn').hover();await page.waitForTimeout(80);assert(/Toggle theme/i.test(await page.locator('#v037-tooltip').textContent()),'theme icon tooltip missing');

    await page.locator('#transfer-capsule').click();await page.waitForSelector('#v037-transfer-dialog[open]');
    const transfer=await page.evaluate(()=>{const d=document.querySelector('#v037-transfer-dialog'),style=getComputedStyle(d);return {normal:document.querySelector('[data-transfer-mode="normal"]')?.classList.contains('is-active'),inputs:document.querySelectorAll('#v037-transfer-dialog [data-transfer-rate]').length,units:document.querySelectorAll('#v037-transfer-dialog .transfer-unit-select').length,scrubbers:document.querySelectorAll('#v037-transfer-dialog .rate-scrubber').length,dialogs:document.querySelectorAll('dialog[open]').length,legacy:!!document.querySelector('#global-speed-dialog'),normalBorder:style.borderColor};});
    assert(transfer.normal&&transfer.inputs===2&&transfer.units===2&&transfer.scrubbers===2,'Transfer editor must expose mode, both rates, units and scrubbers');assert(transfer.dialogs===1&&!transfer.legacy,'Transfer Capsule must open exactly one canonical editor and no legacy speed dialog');
    await page.locator('[data-transfer-mode="alt"]').click();
    const alt=await page.evaluate(()=>{const d=document.querySelector('#v037-transfer-dialog'),style=getComputedStyle(d);return {mode:d.dataset.mode,active:document.querySelector('[data-transfer-mode="alt"]')?.classList.contains('is-active'),border:style.borderColor,copy:Array.from(d.querySelectorAll('[data-rate-label]')).map(x=>x.textContent).join(' | '),modeCopy:document.querySelector('[data-transfer-mode="alt"]')?.textContent||''};});
    assert(alt.mode==='alt'&&alt.active,'Alternative rate mode must own the complete editor state');assert(alt.border!==transfer.normalBorder,'Alternative rate mode must visibly retint the complete editor');assert(/Alternative rate limits/i.test(alt.modeCopy)&&/Alternative download rate limit/i.test(alt.copy)&&/Alternative upload rate limit/i.test(alt.copy),'Alternative mode wording must be explicit');
    await page.locator('#v037-transfer-dialog').dispatchEvent('dblclick');await page.waitForFunction(()=>!document.querySelector('#v037-transfer-dialog').open);

    await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');await page.locator('#settings-tabs [data-settings-tab="advanced"]').click();await page.waitForSelector('#settings-content .settings-row--canonical');
    const rail=await page.evaluate(()=>{const rows=Array.from(document.querySelectorAll('#settings-content .settings-row--canonical')).filter(x=>x.offsetParent!==null).slice(0,6),samples=rows.map(row=>{const copy=row.querySelector('.settings-row__copy')||row.querySelector(':scope>strong'),control=row.querySelector('.switch-control,.field-input,.ui-select,select');return {width:row.getBoundingClientRect().width,copyLeft:copy?.getBoundingClientRect().left,controlLeft:control?.getBoundingClientRect().left,textAlign:copy?getComputedStyle(copy).textAlign:''};}).filter(x=>Number.isFinite(x.copyLeft)&&Number.isFinite(x.controlLeft));const spread=a=>a.length?Math.max(...a)-Math.min(...a):999;return {count:samples.length,maxWidth:Math.max(...samples.map(x=>x.width)),copySpread:spread(samples.map(x=>x.copyLeft)),controlSpread:spread(samples.map(x=>x.controlLeft)),leftAligned:samples.every(x=>x.textAlign==='left'||x.textAlign==='start'),order:samples.every(x=>x.copyLeft<x.controlLeft)};});
    assert(rail.count>=3&&rail.maxWidth<=825,`desktop Settings Form Rail is not compact (${rail.count}/${rail.maxWidth}px)`);assert(rail.copySpread<3&&rail.controlSpread<3&&rail.leftAligned&&rail.order,`desktop Settings Form Rail columns must be centered as a group and left aligned (${JSON.stringify(rail)})`);
    await page.locator('#settings-tabs [data-settings-tab="about"]').click();await page.waitForSelector('.about-facts-grid .about-fact');
    const aboutDesktop=await page.evaluate(()=>{const rows=Array.from(document.querySelectorAll('.about-facts-grid .about-fact'));if(rows.length<2)return {count:rows.length,two:false};const a=rows[0].getBoundingClientRect(),b=rows[1].getBoundingClientRect();return {count:rows.length,two:Math.abs(a.top-b.top)<2&&b.left>a.left+20};});
    assert(aboutDesktop.count>=4&&aboutDesktop.two,'desktop About facts must use a compact two-column grid');

    await page.locator('#app-nav [data-route=""]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='home');await page.waitForSelector('.torrent-row .torrent-select');
    const firstBox=page.locator('.torrent-row .torrent-select').first();await firstBox.check();await page.locator('#more-actions-btn').click();await page.waitForSelector('#v037-actions-dialog[open] .v037-action-grid .btn');await page.waitForTimeout(80);
    const actions=await page.evaluate(()=>{const buttons=Array.from(document.querySelectorAll('#v037-actions-dialog .v037-action-grid .btn'));const first=buttons[0],style=first&&getComputedStyle(first);return {polish:document.querySelector('#v037-actions-dialog')?.classList.contains('action-sheet-polish'),height:first?.getBoundingClientRect().height||0,font:parseFloat(style?.fontSize||'0'),tones:new Set(buttons.map(x=>x.dataset.actionTone).filter(Boolean)).size,firstTone:first?.dataset.actionTone||''};});
    assert(actions.polish&&actions.height>=43&&actions.font>=16&&actions.tones>=4,`Torrent Actions must use the larger canonical semantic ActionSheet (${JSON.stringify(actions)})`);assert(actions.firstTone==='run','first Torrent action must receive run semantic tone');
    const firstAction=page.locator('#v037-actions-dialog .v037-action-grid .btn').first();const beforeHover=await firstAction.evaluate(el=>getComputedStyle(el).backgroundImage+'|'+getComputedStyle(el).backgroundColor);await firstAction.hover();await page.waitForTimeout(80);const afterHover=await firstAction.evaluate(el=>getComputedStyle(el).backgroundImage+'|'+getComputedStyle(el).backgroundColor);assert(beforeHover!==afterHover,'Torrent action hover must use a distinct semantic treatment');await page.locator('#v037-actions-dialog .v037-close').click();

    await page.locator('#delete-btn').click();await page.waitForSelector('#v037-actions-dialog[open] .btn--danger');await page.locator('#v037-actions-dialog').dispatchEvent('dblclick');assert(await page.locator('#v037-actions-dialog').evaluate(el=>el.open),'destructive dialog must ignore backdrop double-click');await page.locator('#v037-actions-dialog .v037-close').click();
    assert(errors.length===0,`desktop UI system browser errors: ${errors.join(' | ')}`);await page.close();
  }
  console.log('v0.3.7 shared responsive UI system browser regression passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
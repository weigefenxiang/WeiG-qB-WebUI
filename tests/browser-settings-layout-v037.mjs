import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.resolve(here,'../webui/private');
const host='127.0.0.1',port=8775;
let fixture={version:'5.2.0',webApi:'2.15.1'},logoutCalls=0;
const prefs={
  alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',
  save_path:'/downloads',temp_path:'/downloads/incomplete',temp_path_enabled:true,preallocate_all:false,create_subfolder_enabled:true,start_paused_enabled:false,auto_tmm_enabled:false,torrent_content_layout:'Original',
  listen_port:26881,upnp:false,random_port:false,max_connec:-1,max_connec_per_torrent:1,max_uploads:-1,max_uploads_per_torrent:-1,proxy_type:0,proxy_ip:'0.0.0.0',proxy_port:8080,proxy_username:'',
  dl_limit:2097152,up_limit:1048576,alt_dl_limit:524288,alt_up_limit:262144,scheduler_enabled:false,schedule_from_hour:8,schedule_to_hour:18,limit_utp_rate:true,limit_tcp_overhead:false,
  dht:true,pex:true,lsd:true,encryption:0,queueing_enabled:true,max_active_downloads:5,max_active_uploads:8,max_active_torrents:12,max_ratio:2,max_ratio_enabled:false,max_seeding_time:60,max_seeding_time_enabled:false,
  web_ui_domain_list:'*',web_ui_address:'*',web_ui_port:8080,web_ui_upnp:false,web_ui_username:'admin',web_ui_csrf_protection_enabled:true,web_ui_clickjacking_protection_enabled:true,web_ui_host_header_validation_enabled:true,web_ui_localhost_auth_enabled:false,web_ui_max_auth_fail_count:5,web_ui_ban_duration:3600,
  slow_torrent_inactive_timer:60,slow_torrent_dl_rate_threshold:2,slow_torrent_ul_rate_threshold:2,socket_receive_buffer_size:0,socket_send_buffer_size:0,socket_backlog_size:30,torrent_file_size_limit:104857600,disk_queue_size:65536,memory_working_set_limit:512,checking_memory_use:32,stop_tracker_timeout:2,upnp_lease_duration:0,save_resume_data_interval:60,hostname_cache_ttl:1200,torrent_content_remove_option:'Delete'
};
const torrent={hash:'1'.padStart(40,'0'),name:'Settings Geometry Fixture',size:1073741824,progress:.5,dlspeed:0,upspeed:0,eta:3600,state:'downloading',ratio:.5,tracker:'https://tracker.example/announce',category:'',tags:'',save_path:'/downloads',added_on:1788220000,priority:0,num_seeds:1,num_leechs:1,private:0};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,v){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));}
function text(res,v){res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));}
async function drain(req){for await(const _ of req){} }
async function api(req,res,p,url){
  if(p==='app/version')return text(res,`v${fixture.version}`);
  if(p==='app/webapiVersion')return text(res,fixture.webApi);
  if(p==='app/buildInfo')return json(res,{});
  if(p==='app/preferences'&&req.method==='GET')return json(res,prefs);
  if(p==='auth/logout'&&req.method==='POST'){await drain(req);logoutCalls++;res.writeHead(200,{'cache-control':'no-store'});return res.end('');}
  if(p==='transfer/info')return json(res,{dl_info_speed:0,up_info_speed:0,connection_status:'connected',dht_nodes:1,total_peer_connections:1});
  if(p==='transfer/speedLimitsMode')return text(res,'0');
  if(p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:2,full_update:true,torrents:{},server_state:{connection_status:'connected',free_space_on_disk:98765432100,dl_info_speed:0,up_info_speed:0,dht_nodes:1,total_peer_connections:1}});
  if(p==='torrents/info')return json(res,[torrent]);
  if(p==='torrents/categories')return json(res,{});
  if(p==='torrents/tags'||p==='search/plugins'||p==='log/main'||p==='log/peers')return json(res,[]);
  if(p==='rss/items')return json(res,{});
  if(req.method==='POST'){await drain(req);res.writeHead(200,{'cache-control':'no-store'});return res.end('');}
  return json(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\/+/, '');if(rel.startsWith('api/v2/'))return await api(req,res,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:'0.3.7',gitSha:'1234567890abcdef1234567890abcdef12345678',qbPath:'/config/weigg-qb-webui',installer:'fixture'});const file=path.resolve(webRoot,rel||'index.html');if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}const data=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(data);}catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain'});res.end(String(e));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

function errorsFor(page){const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});return errors;}
async function openSettings(page){await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings'&&!!WeiG.V037?.settingsBrand);}
async function tabAudit(page,tab){
  await page.locator(`#settings-tabs [data-settings-tab="${tab}"]`).click();
  await page.waitForFunction(tab=>{const g=document.querySelector(`#settings-content .settings-section-panel[data-settings-owner="${tab}"] > .settings-grid-canonical[data-settings-owner="${tab}"]`);return Array.from(g?.querySelectorAll(':scope>.setting-row-grid')||[]).some(x=>x.offsetParent!==null);},tab,{timeout:5000});
  return page.evaluate(tab=>{
    const grid=document.querySelector(`#settings-content .settings-section-panel[data-settings-owner="${tab}"] > .settings-grid-canonical[data-settings-owner="${tab}"]`);
    const rows=Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null);
    const data=rows.map((row,index)=>{
      const copy=row.querySelector(':scope>.settings-row__copy'),slot=row.querySelector(':scope>.settings-row__control'),title=copy?.querySelector('strong');
      const rr=row.getBoundingClientRect(),cr=copy?.getBoundingClientRect(),sr=slot?.getBoundingClientRect();
      return {index,key:row.dataset.settingKey||row.dataset.key||'',span:row.dataset.settingSpan||'',rowLeft:rr.left,rowRight:rr.right,rowWidth:rr.width,copyLeft:cr?.left||0,slotRight:sr?.right||0,titleAlign:title?getComputedStyle(title).textAlign:'',copyAlign:copy?getComputedStyle(copy).textAlign:'',hasCopy:!!copy,hasSlot:!!slot};
    });
    return {cols:grid?getComputedStyle(grid).gridTemplateColumns:'',gridWidth:grid?.getBoundingClientRect().width||0,rows:data};
  },tab);
}
function auditWide(tab,snap){
  const cols=snap.cols.trim().split(/\s+/).filter(Boolean);assert(cols.length===2,`${tab}: expected two SettingsGrid columns, got ${snap.cols}`);
  assert(snap.rows.length>0,`${tab}: no visible SettingRows`);
  for(const row of snap.rows){
    assert(row.hasCopy&&row.hasSlot,`${tab}/${row.key||row.index}: canonical copy/control slot missing`);
    assert(row.span==='1',`${tab}/${row.key||row.index}: ordinary setting unexpectedly spans full width (${row.span})`);
    assert(row.titleAlign==='left'&&row.copyAlign==='left',`${tab}/${row.key||row.index}: setting copy must be left aligned (${row.titleAlign}/${row.copyAlign})`);
    assert(Math.abs(row.rowLeft-row.copyLeft)<20,`${tab}/${row.key||row.index}: copy left axis drifted (${row.copyLeft-row.rowLeft}px)`);
    assert(Math.abs(row.rowRight-row.slotRight)<20,`${tab}/${row.key||row.index}: control right axis drifted (${row.rowRight-row.slotRight}px)`);
    assert(row.rowWidth<snap.gridWidth*.72,`${tab}/${row.key||row.index}: ordinary row stretched across both columns (${row.rowWidth}/${snap.gridWidth})`);
  }
  if(snap.rows.length%2===1){const last=snap.rows.at(-1),first=snap.rows[0];assert(Math.abs(last.rowLeft-first.rowLeft)<4,`${tab}: odd final row must stay in the left grid cell`);}
}

const browser=await chromium.launch({headless:true});
try{
  fixture={version:'4.1.9.1',webApi:'2.2.1'};
  {
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=errorsFor(page);
    await page.goto(`http://${host}:${port}/#/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!WeiG.V037?.settingsBrand,null,{timeout:8000});
    const mobileHeader=await page.evaluate(()=>({headerVisible:['github-btn','blog-btn','logout-btn'].filter(id=>{const e=document.getElementById(id);return e&&e.offsetParent!==null;}),links:Array.from(document.querySelectorAll('[data-v037-utility-links] [data-header-utility]')).map(x=>x.dataset.headerUtility)}));
    assert(mobileHeader.headerVisible.length===0,`4.1.9.1 mobile: utility icons must not squeeze topbar (${mobileHeader.headerVisible})`);
    for(const key of ['github','blog','logout'])assert(mobileHeader.links.includes(key),`4.1.9.1 mobile Links missing ${key}`);
    await page.locator('#mobile-bottom-nav [data-route="settings"]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');await page.waitForTimeout(1800);
    const mobile=await page.evaluate(()=>{const grid=document.querySelector('#settings-content .settings-section-panel[data-settings-owner="weigg"] > .settings-grid-canonical[data-settings-owner="weigg"]'),rows=Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null);return {cols:grid?getComputedStyle(grid).gridTemplateColumns:'',rows:rows.map(row=>({copy:!!row.querySelector(':scope>.settings-row__copy'),slot:!!row.querySelector(':scope>.settings-row__control'),span:row.dataset.settingSpan,titleAlign:getComputedStyle(row.querySelector(':scope>.settings-row__copy strong')).textAlign}))};});
    assert(mobile.rows.length>=6,'4.1.9.1 mobile WeiG Settings rows missing');assert(mobile.cols.trim().split(/\s+/).filter(Boolean).length===1,`4.1.9.1 mobile SettingsGrid must be one column (${mobile.cols})`);for(const r of mobile.rows){assert(r.copy&&r.slot&&r.span==='1'&&r.titleAlign==='left','4.1.9.1 mobile SettingRow contract failed');}
    assert(errors.length===0,`4.1.9.1 mobile errors: ${errors.join(' | ')}`);await page.close();
  }

  fixture={version:'5.2.0',webApi:'2.15.1'};
  {
    const page=await browser.newPage({viewport:{width:1600,height:950}}),errors=errorsFor(page);
    await page.goto(`http://${host}:${port}/#/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>!!WeiG.V037?.settingsBrand&&!!document.getElementById('logout-btn'),null,{timeout:8000});
    const header=await page.evaluate(()=>{
      const ids=['github-btn','blog-btn','refresh-btn','theme-btn','logout-btn'],els=ids.map(id=>document.getElementById(id)),rects=els.map(e=>e?.getBoundingClientRect());
      const github=document.getElementById('github-btn'),blog=document.getElementById('blog-btn'),actions=document.querySelector('.topbar__actions');
      return {ids:els.map(e=>e?.id||''),sizes:rects.map(r=>[r?.width||0,r?.height||0]),classes:els.map(e=>e?.classList.contains('icon-btn')&&e?.classList.contains('header-utility-action')),github:{href:github?.href,target:github?.target,rel:github?.rel,aria:github?.getAttribute('aria-label')},blog:{href:blog?.href,target:blog?.target,rel:blog?.rel,aria:blog?.getAttribute('aria-label')},last:actions?.lastElementChild?.id,logoutAria:document.getElementById('logout-btn')?.getAttribute('aria-label')};
    });
    assert(header.classes.every(Boolean),`Header utilities must share icon-btn/HeaderUtilityAction geometry (${JSON.stringify(header)})`);
    const [w,h]=header.sizes[0];for(const [cw,ch] of header.sizes)assert(Math.abs(cw-w)<1.5&&Math.abs(ch-h)<1.5,`Header utility size mismatch ${JSON.stringify(header.sizes)}`);
    assert(header.github.href==='https://github.com/weigefenxiang/WeiG-qB-WebUI'&&header.github.target==='_blank'&&header.github.rel.includes('noopener')&&header.github.rel.includes('noreferrer')&&header.github.aria,'GitHub HeaderUtilityAction semantics failed');
    assert(header.blog.href==='https://www.weigshare.com/'&&header.blog.target==='_blank'&&header.blog.rel.includes('noopener')&&header.blog.rel.includes('noreferrer')&&header.blog.aria,'Blog HeaderUtilityAction semantics failed');
    assert(header.last==='logout-btn'&&header.logoutAria,'Logout must be the rightmost accessible desktop utility');
    const before=logoutCalls;await page.evaluate(()=>WeiG.SessionController.logout());await page.waitForTimeout(80);assert(logoutCalls===before+1,'SessionController must call qB auth/logout exactly once');

    await openSettings(page);await page.waitForTimeout(1800);
    for(const tab of ['weigg','downloads','connection','speed','bittorrent','webui','advanced']){
      const snap=await tabAudit(page,tab);auditWide(tab,snap);
      const forbidden=new Set(['save_path','temp_path','proxy_ip','proxy_username','web_ui_address','web_ui_username','web_ui_domain_list']);
      for(const row of snap.rows.filter(r=>forbidden.has(r.key)))assert(row.span==='1'&&row.rowWidth<snap.gridWidth*.72,`${tab}/${row.key}: key-name full-span heuristic returned`);
    }
    await page.locator('#settings-tabs [data-settings-tab="connection"]').click();
    const connection=await page.evaluate(()=>Object.fromEntries(['proxy_type','random_port','upnp'].map(key=>{const row=document.querySelector(`#settings-content [data-setting-key="${key}"],#settings-content [data-key="${key}"]`);const copy=row?.querySelector(':scope>.settings-row__copy'),slot=row?.querySelector(':scope>.settings-row__control');return [key,{align:copy?getComputedStyle(copy).textAlign:'',right:slot&&row?Math.abs(row.getBoundingClientRect().right-slot.getBoundingClientRect().right):999,span:row?.dataset.settingSpan||''}];})));
    for(const [key,v] of Object.entries(connection))assert(v.align==='left'&&v.right<20&&v.span==='1',`Connection ${key} alignment regressed ${JSON.stringify(v)}`);
    await page.locator('#settings-tabs [data-settings-tab="advanced"]').click();await page.waitForTimeout(100);const scroll=await page.evaluate(()=>{const scroller=document.getElementById('settings-content'),grid=scroller.querySelector('.settings-section-panel[data-settings-owner="advanced"]>.settings-grid-canonical'),rows=Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null);scroller.scrollTop=scroller.scrollHeight;const last=rows.at(-1),r=last?.getBoundingClientRect(),sr=scroller.getBoundingClientRect();return {top:scroller.scrollTop,bottom:r?.bottom||0,viewport:sr.bottom};});assert(scroll.top>0&&scroll.bottom<=scroll.viewport+3,`Advanced final row unreachable ${JSON.stringify(scroll)}`);
    assert(errors.length===0,`5.2.0 desktop errors: ${errors.join(' | ')}`);await page.close();
  }
  console.log('v0.3.7 Settings alignment + HeaderUtility + Logout browser contract passed for qB 4.1.9.1 and 5.2.0.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

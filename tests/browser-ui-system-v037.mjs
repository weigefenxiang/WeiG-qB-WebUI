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
let qbFixture={version:'4.1.9.1',webApi:'2.2.1'};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,v){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));}
function text(res,v){res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));}
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return Buffer.concat(chunks).toString('utf8');}
async function api(req,res,p,url){
  if(p==='app/version')return text(res,`v${qbFixture.version}`);
  if(p==='app/webapiVersion')return text(res,qbFixture.webApi);
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
  if(p==='rss/items')return json(res,{});
  if(p==='search/plugins')return json(res,[]);
  if(p==='log/main'||p==='log/peers')return json(res,[]);
  if(req.method==='POST'){await body(req);res.writeHead(200,{'cache-control':'no-store'});return res.end('');}
  return json(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\/+/, '');if(rel.startsWith('api/v2/'))return await api(req,res,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:'0.3.7',gitSha:'1234567890abcdef1234567890abcdef12345678',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qbittorrent/config/weigg-qb-webui',installer:'fixture'});const file=path.resolve(webRoot,rel||'index.html');if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}const data=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(data);}catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain'});res.end(String(e));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

function collectErrors(page){const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});return errors;}
async function settingsSnapshot(page,owner){
  return page.evaluate(owner=>{const root=document.getElementById('settings-content'),groups=Array.from(root?.querySelectorAll(':scope>.settings-group')||[]).map((g,index)=>({index,owner:g.dataset.settingsOwner||'',classes:g.className,visible:g.offsetParent!==null,direct:Array.from(g.children).map(x=>({tag:x.tagName,classes:x.className,owner:x.dataset?.settingsOwner||'',key:x.dataset?.settingKey||x.dataset?.key||'',tz:!!x.dataset?.v036Timezone,lang:!!x.dataset?.v021Language})),grids:Array.from(g.querySelectorAll(':scope>.settings-grid-canonical')).map(grid=>({owner:grid.dataset.settingsOwner||'',visible:grid.offsetParent!==null,rows:Array.from(grid.querySelectorAll(':scope>.setting-row-grid')).map(x=>({key:x.dataset.settingKey||x.dataset.key||'',visible:x.offsetParent!==null,tz:!!x.dataset.v036Timezone,lang:!!x.dataset.v021Language}))}))})),grid=root?.querySelector(`.settings-section-panel[data-settings-owner="${owner}"] > .settings-grid-canonical[data-settings-owner="${owner}"]`),rows=Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null),tz=root?.querySelector('[data-v036-timezone]');return {requestedOwner:owner,active:document.querySelector('#settings-tabs [data-settings-tab].is-active')?.dataset.settingsTab||'',rootChildren:Array.from(root?.children||[]).map(x=>({tag:x.tagName,classes:x.className,owner:x.dataset?.settingsOwner||''})),groups,grid:!!grid,gridOwner:grid?.dataset.settingsOwner||'',gridVisible:!!grid&&grid.offsetParent!==null,rows:rows.length,timezone:!!tz,timezoneParent:tz?.parentElement?.className||'',timezoneGridOwner:tz?.closest('.settings-grid-canonical')?.dataset.settingsOwner||''};},owner);
}
const browser=await chromium.launch({headless:true});
try{
  {
    qbFixture={version:'4.1.9.1',webApi:'2.2.1'};
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=collectErrors(page);
    await page.goto(`http://${host}:${port}/#/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!WeiG.V037?.ui&&!!WeiG.V037?.polish&&!!WeiG.V037?.settingsBrand&&document.querySelectorAll('.torrent-mobile-card--two-line').length>0,null,{timeout:8000});
    const mobile=await page.evaluate(()=>{const card=document.querySelector('.torrent-mobile-card--two-line'),v=document.querySelector('#torrent-list').__weiggTorrentVirtual,toolbar=document.querySelector('#list-view .grid-toolbar>div:first-child'),controls=document.querySelector('#v037-mobile-view-controls'),nav=document.getElementById('mobile-bottom-nav'),navRect=nav.getBoundingClientRect();return {kids:Array.from(card.children).map(x=>x.className),rowHeight:v?.rowHeight,cardHeight:card.getBoundingClientRect().height,toolbarOverflow:toolbar.scrollWidth-toolbar.clientWidth,controls:!!controls,bottomGap:innerHeight-navRect.bottom};});
    assert(mobile.kids.length===2&&mobile.kids[0].includes('mobile-card-top--single')&&mobile.kids[1].includes('mobile-card-meta--rail'),`mobile Torrent row must have two structural rows (${mobile.kids.join(' | ')})`);
    assert(mobile.rowHeight<=80&&mobile.cardHeight<=80,`mobile Torrent row must stay dense (${mobile.rowHeight}/${mobile.cardHeight})`);
    assert(mobile.controls&&mobile.toolbarOverflow<=2&&mobile.bottomGap>=1,`mobile shell/toolbar regression ${JSON.stringify(mobile)}`);

    await page.locator('#mobile-bottom-nav [data-route="settings"]').click();
    await page.waitForFunction(()=>WeiG.Router.route().name==='settings'&&document.querySelector('#settings-tabs [data-settings-tab="weigg"]')?.classList.contains('is-active'));
    await page.waitForTimeout(2200);
    const diagnostic=await settingsSnapshot(page,'weigg');
    const mobileSettings=await page.evaluate(()=>{const grid=document.querySelector('#settings-content .settings-section-panel[data-settings-owner="weigg"] > .settings-grid-canonical[data-settings-owner="weigg"]'),rows=Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null),tz=document.querySelector('#settings-content [data-v036-timezone]'),cols=grid?getComputedStyle(grid).gridTemplateColumns:'';return {rows:rows.length,cols,max:rows.length?Math.max(...rows.slice(0,8).map(x=>x.getBoundingClientRect().height)):999,timezone:!!tz,timezoneOwner:!!tz&&tz.closest('.settings-grid-canonical')===grid};});
    assert(mobileSettings.rows>=6&&mobileSettings.max<90&&mobileSettings.timezone&&mobileSettings.timezoneOwner,`mobile Settings mother template/timezone missing ${JSON.stringify(mobileSettings)} diagnostic=${JSON.stringify(diagnostic)}`);
    assert(!/\s/.test(mobileSettings.cols.trim())||mobileSettings.cols.split(/\s+/).length===1,`mobile SettingsGrid must collapse to one column (${mobileSettings.cols})`);

    await page.evaluate(()=>document.querySelector('#settings-tabs [data-settings-tab="about"]')?.click());await page.waitForSelector('.about-surface .brand-identity .brand-identity__mark-home .brand__mark.ambient-mark');await page.waitForFunction(()=>document.querySelectorAll('.about-facts-grid .about-fact').length>=4);
    const about=await page.evaluate(()=>{const rows=Array.from(document.querySelectorAll('.about-facts-grid .about-fact')),first=rows[0],label=first?.querySelector('.settings-row__copy>strong'),value=first?.querySelector('.settings-row__copy>small'),prefs=Array.from(document.querySelectorAll('.about-surface>.settings-row--canonical:not(.about-row):not(.about-fact),.about-surface>.settings-control:not(.about-row):not(.about-fact)')).filter(x=>x.offsetParent!==null);return {single:rows.length<2||Math.abs(rows[0].getBoundingClientRect().left-rows[1].getBoundingClientRect().left)<2,sameLine:!!label&&!!value&&Math.abs(label.getBoundingClientRect().top-value.getBoundingClientRect().top)<8,prefs:prefs.length,mark:document.querySelector('.brand-identity__mark-home .brand__mark')?.getBoundingClientRect().width||0,ambient:!!document.querySelector('.brand-identity__mark-home .ambient-mark')};});
    assert(about.single&&about.sameLine&&about.prefs===0,`mobile About metadata geometry failed ${JSON.stringify(about)}`);
    assert(about.ambient&&about.mark>=48,'About must reuse the animated WeiG BrandMark at identity size');
    assert(errors.length===0,`mobile UI errors: ${errors.join(' | ')}`);await page.close();
  }

  {
    qbFixture={version:'5.2.0',webApi:'2.15.1'};
    const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=collectErrors(page);
    await page.goto(`http://${host}:${port}/#/`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!WeiG.V037?.settingsBrand&&!!document.querySelector('#transfer-capsule')&&!!document.querySelector('#brand-btn.brand-cluster'),null,{timeout:8000});
    await page.waitForTimeout(800);

    const brand=await page.evaluate(()=>({cluster:document.querySelectorAll('#brand-btn.brand-cluster').length,markButtons:document.querySelectorAll('#brand-btn>.brand-mark-home').length,nameButtons:document.querySelectorAll('#brand-btn>.brand-name-home').length,mark:!!document.querySelector('#brand-btn>.brand-mark-home>.brand__mark.ambient-mark'),text:document.querySelector('#brand-btn>.brand-name-home')?.textContent?.trim()}));
    assert(brand.cluster===1&&brand.markButtons===1&&brand.nameButtons===1&&brand.mark&&brand.text==='WeiG qB',`Header brand targets must be separate and reuse AmbientMark (${JSON.stringify(brand)})`);
    await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');await page.locator('#brand-btn>.brand-name-home').click();await page.waitForFunction(()=>WeiG.Router.route().name==='home');
    await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');await page.locator('#brand-btn>.brand-mark-home').click();await page.waitForFunction(()=>WeiG.Router.route().name==='home');

    const status=await page.evaluate(()=>{const cap=document.querySelector('#transfer-capsule'),panel=document.querySelector('#list-view>.torrent-panel'),side=document.querySelector('#sidebar'),msg=document.querySelector('#status-message'),bar=document.querySelector('.statusbar'),cluster=[document.querySelector('.status-storage'),cap,document.querySelector('#status-connection')].filter(Boolean).map(x=>x.getBoundingClientRect()),barRect=bar?.getBoundingClientRect(),left=cluster.length?Math.min(...cluster.map(r=>r.left)):0,right=cluster.length?Math.max(...cluster.map(r=>r.right)):0;return {timezone:document.querySelectorAll('[data-status-timezone]').length,capsule:!!cap?.querySelector('#status-dl')&&!!cap?.querySelector('#status-up'),tag:cap?.tagName,nestedButtons:cap?.querySelectorAll('button').length||0,statusMessage:String(msg?.textContent||'').trim(),bottomDelta:Math.abs((panel?.getBoundingClientRect().bottom||0)-(side?.getBoundingClientRect().bottom||0)),connection:document.querySelector('#status-connection')?.classList.contains('connection-indicator'),centerDelta:barRect&&cluster.length?Math.abs((left+right)/2-(barRect.left+barRect.right)/2):999};});
    assert(status.timezone===0&&status.capsule&&status.tag==='BUTTON'&&status.nestedButtons===0,'desktop StatusDock canonical transfer ownership regressed');
    assert(status.statusMessage===''&&status.bottomDelta<4&&status.connection&&status.centerDelta<16,`desktop StatusDock geometry regressed ${JSON.stringify(status)}`);

    await page.locator('#transfer-capsule').click();await page.waitForSelector('#v037-transfer-dialog[open]');
    const transfer=await page.evaluate(()=>{const d=document.querySelector('#v037-transfer-dialog'),r=d.getBoundingClientRect(),style=getComputedStyle(d),mode=d.querySelector('.transfer-mode-switch')?.getBoundingClientRect();return {width:r.width,border:style.borderColor,left:mode?mode.left-r.left:0,right:mode?r.right-mode.right:0,inputs:d.querySelectorAll('[data-transfer-rate]').length,scrubbers:d.querySelectorAll('.rate-scrubber').length};});
    assert(transfer.width>=680&&transfer.left>=20&&transfer.right>=20&&transfer.inputs===2&&transfer.scrubbers===2,`Transfer editor geometry regressed ${JSON.stringify(transfer)}`);
    await page.locator('[data-transfer-mode="alt"]').click();const altBorder=await page.locator('#v037-transfer-dialog').evaluate(el=>getComputedStyle(el).borderColor);assert(altBorder!==transfer.border,'ALT mode must retint complete Transfer editor');await page.locator('#v037-transfer-dialog').dispatchEvent('dblclick');await page.waitForFunction(()=>!document.querySelector('#v037-transfer-dialog').open);

    await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');
    await page.waitForTimeout(2200);
    const desktopDiagnostic=await settingsSnapshot(page,'weigg');
    const weigg=await page.evaluate(()=>{const grid=document.querySelector('#settings-content .settings-section-panel[data-settings-owner="weigg"] > .settings-grid-canonical[data-settings-owner="weigg"]'),rows=Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null),rects=rows.slice(0,6).map(x=>x.getBoundingClientRect()),controls=rows.slice(0,6).map(row=>{const c=row.querySelector('.switch-control,.field-input,.ui-select,select'),r=row.getBoundingClientRect(),cr=c?.getBoundingClientRect();return cr?Math.abs(r.right-cr.right):999;});return {rows:rows.length,cols:grid?getComputedStyle(grid).gridTemplateColumns:'',tops:rects.map(r=>Math.round(r.top)),lefts:rects.map(r=>Math.round(r.left)),rightDelta:controls.length?Math.max(...controls):999};});
    assert(weigg.rows>=6&&weigg.lefts.length>=4,`WeiG Settings mother template missing rows diagnostic=${JSON.stringify(desktopDiagnostic)}`);
    assert(new Set(weigg.lefts).size>=2&&weigg.tops[0]===weigg.tops[1],`wide WeiG Settings must use two-column row pairing (${JSON.stringify(weigg)})`);
    assert(weigg.rightDelta<20,`Setting controls must align to each cell's right edge (${weigg.rightDelta}px)`);

    await page.locator('#settings-tabs [data-settings-tab="connection"]').click();
    await page.waitForFunction(()=>{const grid=document.querySelector('#settings-content .settings-section-panel[data-settings-owner="connection"] > .settings-grid-canonical[data-settings-owner="connection"]');return Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null).length>=4;});
    const qb=await page.evaluate(()=>{const grid=document.querySelector('#settings-content .settings-section-panel[data-settings-owner="connection"] > .settings-grid-canonical[data-settings-owner="connection"]'),rows=Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null),r=rows.slice(0,4).map(x=>x.getBoundingClientRect());return {rows:rows.length,panel:!!grid?.closest('.settings-section-panel'),two:r.length>=2&&Math.abs(r[0].top-r[1].top)<2&&r[1].left>r[0].left+20};});
    assert(qb.rows>=4&&qb.panel&&qb.two,`qB Connection must use the same two-column Settings mother template (${JSON.stringify(qb)})`);

    await page.locator('#settings-tabs [data-settings-tab="advanced"]').click();
    await page.waitForFunction(()=>{const grid=document.querySelector('#settings-content .settings-section-panel[data-settings-owner="advanced"] > .settings-grid-canonical[data-settings-owner="advanced"]');return Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).some(x=>x.offsetParent!==null);});
    const scroll=await page.evaluate(()=>{const scroller=document.getElementById('settings-content'),grid=scroller.querySelector('.settings-section-panel[data-settings-owner="advanced"] > .settings-grid-canonical[data-settings-owner="advanced"]');scroller.scrollTop=scroller.scrollHeight;const rows=Array.from(grid?.querySelectorAll(':scope>.setting-row-grid')||[]).filter(x=>x.offsetParent!==null),last=rows.at(-1);return {scrollHeight:scroller.scrollHeight,clientHeight:scroller.clientHeight,scrollTop:scroller.scrollTop,lastBottom:last?.getBoundingClientRect().bottom||0,viewportBottom:scroller.getBoundingClientRect().bottom};});
    assert(scroll.scrollHeight>scroll.clientHeight+20&&scroll.scrollTop>0&&scroll.lastBottom<=scroll.viewportBottom+3,`SettingsContentViewport must reach final Advanced row (${JSON.stringify(scroll)})`);

    await page.locator('#settings-tabs [data-settings-tab="about"]').click();await page.waitForSelector('.about-surface .brand-identity__mark-home .brand__mark.ambient-mark');await page.waitForSelector('.about-facts-grid .about-fact');
    const about=await page.evaluate(()=>{const rows=Array.from(document.querySelectorAll('.about-facts-grid .about-fact')),a=rows[0]?.getBoundingClientRect(),b=rows[1]?.getBoundingClientRect(),mark=document.querySelector('.brand-identity__mark-home .brand__mark'),header=document.querySelector('#brand-btn .brand__mark'),label=rows[0]?.querySelector('.settings-row__copy>strong'),value=rows[0]?.querySelector('.settings-row__copy>small'),prefs=Array.from(document.querySelectorAll('.about-surface>.settings-row--canonical:not(.about-row):not(.about-fact),.about-surface>.settings-control:not(.about-row):not(.about-fact)')).filter(x=>x.offsetParent!==null);return {two:rows.length>=2&&Math.abs(a.top-b.top)<2&&b.left>a.left+20,sameLine:!!label&&!!value&&Math.abs(label.getBoundingClientRect().top-value.getBoundingClientRect().top)<8,prefs:prefs.length,markWidth:mark?.getBoundingClientRect().width||0,sameImage:mark?.querySelector('img')?.src===header?.querySelector('img')?.src,homeMark:!!document.querySelector('.brand-identity__mark-home'),homeName:!!document.querySelector('.brand-identity__name-home')};});
    assert(about.two&&about.sameLine&&about.prefs===0,'desktop About must use two-column metadata facts only');
    assert(about.markWidth>=48&&about.sameImage&&about.homeMark&&about.homeName,`About BrandIdentity must reuse actual animated brand asset (${JSON.stringify(about)})`);
    await page.locator('.brand-identity__name-home').click();await page.waitForFunction(()=>WeiG.Router.route().name==='home');

    await page.waitForSelector('.torrent-row .torrent-select');await page.locator('.torrent-row .torrent-select').first().check();await page.locator('#more-actions-btn').click();await page.waitForSelector('#v037-actions-dialog[open] .v037-action-grid .btn');
    const actions=await page.evaluate(()=>{const buttons=Array.from(document.querySelectorAll('#v037-actions-dialog .v037-action-grid .btn')),first=buttons[0],style=first&&getComputedStyle(first);return {polish:document.querySelector('#v037-actions-dialog')?.classList.contains('action-sheet-polish'),height:first?.getBoundingClientRect().height||0,font:parseFloat(style?.fontSize||'0'),tones:new Set(buttons.map(x=>x.dataset.actionTone).filter(Boolean)).size};});
    assert(actions.polish&&actions.height>=43&&actions.font>=16&&actions.tones>=4,`Torrent ActionSheet semantic polish regressed (${JSON.stringify(actions)})`);await page.locator('#v037-actions-dialog .v037-close').click();

    assert(errors.length===0,`desktop UI errors: ${errors.join(' | ')}`);await page.close();
  }
  console.log('v0.3.7 shared responsive UI + Settings mother template + Brand identity browser regression passed for qB 4.1.9.1 and 5.2.0 baselines.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

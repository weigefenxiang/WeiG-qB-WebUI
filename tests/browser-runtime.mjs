import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const privateRoot=path.resolve(here,'../webui/private');
const publicRoot=path.resolve(here,'../webui/public');
const host='127.0.0.1',port=8771;
const variants={legacy:{qb:'v4.1.9.1',api:'2.1.0',session:true,logout:0,probeAfterLogout:0},modern:{qb:'v5.2.0',api:'2.11.4',session:true,logout:0,probeAfterLogout:0},bypass:{qb:'v5.2.0',api:'2.11.4',session:true,bypass:true,logout:0,probeAfterLogout:0}};
const prefs={save_path:'/downloads',temp_path:'/downloads/incomplete',temp_path_enabled:true,preallocate_all:false,create_subfolder_enabled:true,start_paused_enabled:false,auto_tmm_enabled:false,torrent_content_layout:'Original',listen_port:6881,upnp:false,random_port:false,max_connec:500,max_connec_per_torrent:100,max_uploads:20,max_uploads_per_torrent:4,proxy_type:0,proxy_ip:'',proxy_port:8080,proxy_username:'',dl_limit:1048576,up_limit:524288,alt_dl_limit:262144,alt_up_limit:131072,scheduler_enabled:false,schedule_from_hour:8,schedule_to_hour:20,limit_utp_rate:true,limit_tcp_overhead:false,dht:true,pex:true,lsd:true,encryption:0,queueing_enabled:true,max_active_downloads:5,max_active_uploads:5,max_active_torrents:10,max_ratio:2,max_ratio_enabled:false,max_seeding_time:1440,max_seeding_time_enabled:false,web_ui_domain_list:'*',web_ui_address:'*',web_ui_port:8080,web_ui_upnp:false,web_ui_username:'admin',web_ui_csrf_protection_enabled:true,web_ui_clickjacking_protection_enabled:true,web_ui_host_header_validation_enabled:true,web_ui_localhost_auth_enabled:false,web_ui_max_auth_fail_count:5,web_ui_ban_duration:3600,alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',socket_receive_buffer_size:0,torrent_file_size_limit:104857600,upload_choking_algorithm:1};
const torrent={hash:'1'.repeat(40),name:'Fixture Torrent',size:1048576,progress:.4,dlspeed:1000,upspeed:200,eta:3600,state:'downloading',ratio:.2,tracker:'https://tracker.example/announce',category:'fixture',added_on:1000,save_path:'/downloads'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,v,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));}
function text(res,v,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));}
function empty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
function api(req,res,v,p,url){
  if(p==='auth/logout'&&req.method==='POST'){v.logout++;if(!v.bypass)v.session=false;return empty(res);}
  if(p==='app/preferences'&&!v.session){v.probeAfterLogout++;return empty(res,403);}
  if(!v.session)return empty(res,403);
  if(p==='app/version')return text(res,v.qb);if(p==='app/webapiVersion')return text(res,v.api);if(p==='app/preferences')return json(res,prefs);if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:12345,up_info_speed:6789,connection_status:'connected',dht_nodes:12,total_peer_connections:4});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dl_info_speed:12345,up_info_speed:6789,dht_nodes:12,total_peer_connections:4,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){const hashes=url.searchParams.get('hashes');return json(res,!hashes||hashes.includes(torrent.hash)?[torrent]:[]);}
  if(p==='torrents/properties')return json(res,{save_path:'/downloads',total_size:1048576,total_downloaded:400000,total_uploaded:100000,share_ratio:.2,nb_connections:4,seeds:2,peers:3,addition_date:1000,completion_date:-1,created_by:'fixture',pieces_num:20,piece_size:65536});
  if(['torrents/files','torrents/trackers','torrents/webseeds','search/plugins','log/main','log/peers'].includes(p))return json(res,[]);
  if(p==='sync/torrentPeers')return json(res,{peers:{}});if(p==='torrents/categories')return json(res,{});if(p==='torrents/tags')return json(res,[]);if(p==='rss/items')return json(res,{});
  if(req.method==='POST')return empty(res);return json(res,{});
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),m=url.pathname.match(/^\/(legacy|modern|bypass)(?:\/(.*))?$/);if(!m){res.writeHead(404);return res.end('not found');}const v=variants[m[1]],rel=m[2]||'';if(rel.startsWith('api/v2/'))return api(req,res,v,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:'0.3.9',gitSha:'fixture-sha',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});const root=v.session?privateRoot:publicRoot,requested=rel||'index.html',file=path.resolve(root,requested);if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403);return res.end('forbidden');}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(e));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
async function openSettings(page){await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>location.hash.includes('settings'));await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]');}
async function selectTab(page,tab,expectRows=true){await page.locator(`#settings-tabs [data-settings-tab="${tab}"]`).click();await page.waitForFunction(t=>document.querySelector('#settings-tabs [data-settings-tab="'+t+'"]')?.classList.contains('is-active'),tab);if(expectRows)await page.waitForSelector('#settings-content .setting-row:not([hidden])');}
async function twoColumns(page){return page.evaluate(()=>{const rows=[...document.querySelectorAll('#settings-content .setting-row:not([hidden])')].slice(0,4);if(rows.length<2)return false;const a=rows[0].getBoundingClientRect(),b=rows[1].getBoundingClientRect();return Math.abs(a.left-b.left)>40&&Math.abs(a.top-b.top)<8;});}
async function alignment(page){return page.evaluate(()=>[...document.querySelectorAll('#settings-content .setting-row:not([hidden])')].slice(0,10).every(r=>{const box=r.getBoundingClientRect(),copyNode=r.querySelector('.setting-copy'),controlNode=r.querySelector('.setting-control-slot'),title=r.querySelector('.setting-title'),desc=r.querySelector('.setting-description');if(!copyNode||!controlNode||!title||!desc)return false;const copy=copyNode.getBoundingClientRect(),ctl=controlNode.getBoundingClientRect(),leftInset=copy.left-box.left,rightInset=box.right-ctl.right,aligns=[getComputedStyle(copyNode).textAlign,getComputedStyle(title).textAlign,getComputedStyle(desc).textAlign];return leftInset>=14&&leftInset<=18&&rightInset>=14&&rightInset<=18&&copy.left<ctl.left&&aligns.every(v=>v==='left'||v==='start');}));}
async function noLegacySettings(page){return page.evaluate(()=>document.querySelectorAll('#settings-content .settings-control,#settings-content .settings-row--canonical,#settings-content .settings-group,#settings-content .setting-card,#settings-content .settings-grid-canonical').length===0);}
const browser=await chromium.launch({headless:true});
try{
  for(const name of ['legacy','modern']){
    variants[name].session=true;
    const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'networkidle'});await page.waitForSelector('#torrent-list');await openSettings(page);
    for(const tab of ['downloads','connection','speed','bittorrent','webui','advanced']){await selectTab(page,tab);assert(await twoColumns(page),`${name}/${tab}: SettingsGrid is not two columns at 1366px`);assert(await alignment(page),`${name}/${tab}: SettingRow copy/control alignment failed`);assert(await noLegacySettings(page),`${name}/${tab}: legacy Settings DOM owner reappeared`);}
    for(const key of ['save_path','proxy_ip','proxy_username','web_ui_address','web_ui_username','alternative_webui_path']){const row=page.locator(`[data-setting-key="${key}"]`);if(await row.count())assert((await row.getAttribute('data-setting-span'))!=='full',`${name}: ${key} must not force full span`);}
    await selectTab(page,'about',false);assert(await page.locator('.brand-identity .brand__mark').count()===1,`${name}: About shared BrandMark missing`);assert(await page.locator('.about-surface .setting-row').count()===0,`${name}: About must use FactRow, not SettingRow`);
    assert(await page.locator('.brand-cluster>.brand-mark-home').count()===1&&await page.locator('.brand-cluster>.brand-name-home').count()===1,`${name}: Header brand targets not separated`);assert(await page.locator('#github-link').count()===1&&await page.locator('#blog-link').count()===1&&await page.locator('#logout-btn').count()===1,`${name}: Header utilities missing`);
    await page.setViewportSize({width:1000,height:768});await selectTab(page,'downloads');await page.waitForTimeout(60);assert(!(await twoColumns(page)),`${name}: SettingsGrid did not collapse at narrow width`);assert(await alignment(page),`${name}: narrow SettingRow alignment failed`);assert(errors.length===0,`${name}: browser errors: ${errors.join(' | ')}`);
    const deep=await context.newPage();await deep.goto(`http://${host}:${port}/${name}/#/settings`,{waitUntil:'networkidle'});await deep.waitForSelector('#settings-content[data-settings-renderer="canonical"]');assert(await noLegacySettings(deep),`${name}: direct #/settings deep link rendered a legacy Settings owner`);await deep.close();await context.close();
  }
  {
    variants.modern.session=true;variants.modern.logout=0;variants.modern.probeAfterLogout=0;
    const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();await page.goto(`http://${host}:${port}/modern/#/`,{waitUntil:'networkidle'});await page.waitForSelector('#logout-btn');await openSettings(page);await selectTab(page,'connection');await page.evaluate(()=>{location.hash='#/';});await page.waitForFunction(()=>location.hash==='#/');
    await page.locator('#logout-btn').click();await page.waitForSelector('#login-form',{timeout:4000});assert(variants.modern.logout===1,'Verified logout did not call auth/logout exactly once');assert(variants.modern.probeAfterLogout>=1,'Verified logout did not probe a protected endpoint after logout');await page.goBack({waitUntil:'domcontentloaded'}).catch(()=>null);await page.waitForSelector('#login-form',{timeout:4000});assert(await page.locator('#app').count()===0,'Browser Back restored the private application shell after logout');await context.close();
  }
  {
    variants.bypass.session=true;variants.bypass.logout=0;variants.bypass.probeAfterLogout=0;
    const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();await page.goto(`http://${host}:${port}/bypass/#/`,{waitUntil:'networkidle'});await page.waitForSelector('#logout-btn');await page.locator('#logout-btn').click();await page.waitForFunction(()=>!document.getElementById('fatal')?.classList.contains('is-hidden'));assert(variants.bypass.logout===1,'Auth-bypass case did not issue logout');assert(variants.bypass.session===true,'Auth-bypass fixture unexpectedly lost access');await context.close();
  }
  console.log('Semantic runtime browser regression passed: six Settings tabs + deep link, qB 4.1.9.1/5.2.0, verified logout, Back/BFCache guard and auth bypass.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

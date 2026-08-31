import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.resolve(here,'../webui/private');
const matrix=JSON.parse(await fs.readFile(path.join(here,'fixtures/qb-compat-matrix.json'),'utf8'));
const host='127.0.0.1',port=8768;
const variants={};
for(const [index,fixture] of matrix.fixtures.entries()){
  const key=`f${index}`;
  variants[key]={...fixture,qb:fixture.qbVersion==='master'?'v5.3.0alpha1':fixture.qbVersion.includes('synthetic')?'v6.0.0':`v${fixture.qbVersion}`,api:fixture.webApiVersion.replace('-synthetic','')};
}
const viewports=[{width:390,height:844,label:'mobile'},{width:1366,height:768,label:'desktop'},{width:1920,height:1080,label:'wide'}];
const torrents=Array.from({length:125},(_,i)=>({hash:(i+1).toString(16).padStart(40,'0'),name:`Fixture Torrent ${String(i+1).padStart(3,'0')}`,size:1024*1024*(i+1),progress:.45,dlspeed:1000+i,upspeed:200+i,eta:3600,state:'downloading',ratio:.25,tracker:'https://tracker.example/announce',category:'fixture',added_on:100000+i,save_path:'/downloads/fixture'}));
const advancedPrefs={
  slow_torrent_inactive_timer:60,slow_torrent_dl_rate_threshold:2,slow_torrent_ul_rate_threshold:2,
  send_buffer_watermark:500,send_buffer_low_watermark:10,send_buffer_watermark_factor:50,
  socket_backlog_size:30,socket_receive_buffer_size:0,socket_send_buffer_size:0,
  stop_tracker_timeout:2,upnp_lease_duration:0,torrent_file_size_limit:104857600,
  save_resume_data_interval:60,disk_cache_ttl:60,checking_memory_use:32,async_io_threads:10,file_pool_size:40,
  upload_slots_behavior:0,upload_choking_algorithm:1,utp_tcp_mixed_mode:0,torrent_stop_condition:'None',
  torrent_content_remove_option:'Delete',hostname_cache_ttl:1200
};
function assert(condition,message){if(!condition)throw new Error(message);}
function writeJson(res,value){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function writeText(res,value){res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
function handleApi(req,res,name,apiPath,url){
  const variant=variants[name];
  if(apiPath==='app/version')return writeText(res,variant.qb);
  if(apiPath==='app/webapiVersion')return writeText(res,variant.api);
  if(apiPath==='app/preferences')return writeJson(res,{web_ui_port:8080,web_ui_upnp:false,alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',...advancedPrefs});
  if(apiPath==='app/buildInfo')return writeJson(res,{});
  if(apiPath==='transfer/info')return writeJson(res,{dl_info_speed:12345,up_info_speed:6789,connection_status:'connected',dht_nodes:12,total_peer_connections:4});
  if(apiPath==='sync/maindata')return writeJson(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dl_info_speed:12345,up_info_speed:6789,dht_nodes:12,total_peer_connections:4}});
  if(apiPath==='torrents/info'){
    const hashes=url.searchParams.get('hashes');if(hashes){const set=new Set(hashes.split('|'));return writeJson(res,torrents.filter(t=>set.has(t.hash)));}
    const limit=Math.max(0,Number(url.searchParams.get('limit')||0)),offset=Math.max(0,Number(url.searchParams.get('offset')||0));return writeJson(res,limit?torrents.slice(offset,offset+limit):torrents.slice(offset));
  }
  if(apiPath==='torrents/properties')return writeJson(res,{save_path:'/downloads/fixture',total_size:1024*1024,total_downloaded:500000,total_uploaded:100000,share_ratio:.2,nb_connections:4,seeds:2,peers:3,addition_date:1788140000,completion_date:-1,created_by:'fixture',pieces_num:20,piece_size:65536});
  if(apiPath==='torrents/files'||apiPath==='torrents/trackers'||apiPath==='sync/torrentPeers'||apiPath==='torrents/webseeds')return writeJson(res,apiPath==='sync/torrentPeers'?{peers:{}}:[]);
  if(apiPath==='torrents/categories')return writeJson(res,{});if(apiPath==='torrents/tags')return writeJson(res,[]);if(apiPath==='rss/items')return writeJson(res,{});if(apiPath==='search/plugins')return writeJson(res,[]);if(apiPath==='log/main'||apiPath==='log/peers')return writeJson(res,[]);
  if(req.method==='POST'){res.writeHead(200,{'cache-control':'no-store'});return res.end('');}return writeJson(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://${host}:${port}`),match=url.pathname.match(/^\/(f\d+)(?:\/(.*))?$/);if(!match||!variants[match[1]]){res.writeHead(404);return res.end('not found');}
  const name=match[1],relative=match[2]||'';if(relative.startsWith('api/v2/'))return handleApi(req,res,name,relative.slice(7),url);
  if(relative==='weigg-install.json')return writeJson(res,{version:'0.3.6',gitSha:'1234567890abcdef1234567890abcdef12345678',container:'fixture',qbPath:'/config/weigg-qb-webui',hostPath:'/root/qbittorrent/config/weigg-qb-webui',installedAt:'2026-08-31T11:00:00Z',installer:'linux'});
  const requested=relative||'index.html',file=path.resolve(webRoot,requested);if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);
}catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function chooseNative(page,nativeId,value){const custom=page.locator(`#${nativeId} + .ui-select`);await custom.locator('.ui-select__trigger').click();const option=page.locator(`#weigg-floating-layer .ui-select__option[data-value="${value}"]`);await option.click();}
async function openNative(page,nativeId){const custom=page.locator(`#${nativeId} + .ui-select`);await custom.locator('.ui-select__trigger').click();return page.locator('#weigg-floating-layer .ui-select__menu');}
async function waitPageNumber(page,n){await page.waitForFunction(expected=>{const text=document.querySelector('#page-label')?.textContent||'';return new RegExp(`(?:Page|第)\\s*${expected}(?:\\s|\\/)`).test(text);},n,{timeout:3000});}
async function visibleTorrentHash(list){return await list.evaluate(node=>{const box=node.getBoundingClientRect(),rows=[...node.querySelectorAll('[data-hash]')];const visible=rows.find(row=>{const r=row.getBoundingClientRect();return r.top>=box.top+4&&r.bottom<=box.bottom-4;});return (visible||rows[0])?.dataset.hash||'';});}
function titleForHash(page,hash,mobile){return page.locator(`${mobile?'.torrent-mobile-card':'.torrent-row'}[data-hash="${hash}"] ${mobile?'.mobile-card-title':'.torrent-title'}`);}
async function assertFloatingBounds(page,label){const result=await page.evaluate(()=>{const menu=document.querySelector('#weigg-floating-layer .ui-select__menu:not([hidden])');if(!menu)return null;const r=menu.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,parent:menu.parentElement?.id||''};});assert(result,`${label}: floating menu missing`);assert(result.parent==='weigg-floating-layer',`${label}: menu is not portaled`);assert(result.left>=7,`${label}: floating menu clipped left ${result.left}`);assert(result.right<=result.width-7,`${label}: floating menu clipped right ${result.right}/${result.width}`);assert(result.top>=7,`${label}: floating menu clipped top ${result.top}`);assert(result.bottom<=result.height-7,`${label}: floating menu clipped bottom ${result.bottom}/${result.height}`);}

const browser=await chromium.launch({headless:true});
try{
  for(const [name,variant] of Object.entries(variants)){
    for(const viewport of viewports){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:'en-US',timezoneId:'UTC'}),page=await context.newPage(),errors=[];
      page.on('console',msg=>{if(msg.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(msg.text()))errors.push(msg.text());});page.on('pageerror',error=>errors.push(String(error)));
      await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'networkidle'});await page.waitForSelector('.torrent-title,.torrent-mobile-card');await page.waitForFunction(()=>document.documentElement.dataset.v036==='1');

      const primitive=await page.evaluate(()=>{const native=document.querySelector('#page-size'),custom=native?.nextElementSibling,mark=document.querySelector('.brand__mark');return {nativeHidden:native?.classList.contains('ui-native-select'),customSelect:custom?.classList.contains('ui-select'),ambient:mark?.classList.contains('ambient-mark'),orbit:!!mark?.querySelector('.ambient-mark__orbit'),sparks:mark?.querySelectorAll('.ambient-mark__spark').length||0,scrollWidth:document.documentElement.scrollWidth,innerWidth,globalTimezone:!!document.querySelector('[data-status-timezone]'),futureBlocked:/unsupported/i.test(document.querySelector('#compat-mode')?.textContent||'')};});
      const tag=`${variant.qbVersion}/${viewport.label}`;
      assert(primitive.nativeHidden,`${tag}: native select was not progressively hidden`);assert(primitive.customSelect,`${tag}: canonical select missing`);assert(primitive.ambient&&primitive.orbit&&primitive.sparks>=4,`${tag}: AmbientMark template missing`);assert(primitive.scrollWidth<=primitive.innerWidth+1,`${tag}: horizontal overflow`);assert(primitive.globalTimezone,`${tag}: global Display Time Zone missing`);if(variant.role==='forward-major-sentinel')assert(!primitive.futureBlocked,`${tag}: future major was hard-rejected`);
      const triggered=await page.evaluate(()=>WeiG.AmbientMark.trigger('.brand__mark','orbit-spark'));assert(triggered,`${tag}: AmbientMark deterministic trigger failed`);

      const menu=await openNative(page,'page-size');await menu.waitFor({state:'visible'});await assertFloatingBounds(page,`${tag}/page-size`);await page.keyboard.press('Escape');
      await chooseNative(page,'page-size','20');await page.waitForFunction(()=>document.querySelector('#page-size')?.value==='20');await page.locator('#next-btn').click();await waitPageNumber(page,2);
      const list=page.locator('#torrent-list');await list.evaluate(node=>{node.scrollTop=160;});await page.waitForTimeout(80);const before=await list.evaluate(node=>node.scrollTop);const visibleHash=await visibleTorrentHash(list);assert(visibleHash,`${tag}: no visible torrent row after scrolling`);
      const mobile=viewport.width<=820,title=titleForHash(page,visibleHash,mobile);await title.click();await page.waitForFunction(()=>WeiG.Router.route().name==='torrent');await page.waitForSelector('[data-v036-detail-back]');
      const saved=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('weigg.torrentListContext.v036')||'null'));assert(saved&&Math.abs(Number(saved.scrollTop)-before)<=2,`${tag}: entry context captured wrong scroll ${before} -> ${saved?.scrollTop}`);
      const backPlacement=await page.evaluate(()=>{const tabs=document.querySelector('.detail-tabs'),back=tabs?.querySelector('[data-v036-detail-back]');return !!back&&tabs.firstElementChild===back;});assert(backPlacement,`${tag}: detail Back is not left of Overview`);
      await page.locator('[data-v036-detail-back]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='home');await waitPageNumber(page,2);await page.waitForTimeout(180);const after=await list.evaluate(node=>node.scrollTop);assert(Math.abs(after-before)<=8,`${tag}: list scroll context not restored ${before} -> ${after}`);
      const titleAgain=titleForHash(page,visibleHash,mobile);await titleAgain.click();await page.waitForFunction(()=>WeiG.Router.route().name==='torrent');await page.keyboard.press('Escape');await page.waitForFunction(()=>WeiG.Router.route().name==='home');await waitPageNumber(page,2);

      if(viewport.label==='desktop'){
        await page.locator('[data-route="settings"]').first().click();await page.waitForFunction(()=>WeiG.Router.route().name==='settings');await page.locator('#settings-tabs [data-settings-tab="advanced"]').click();await page.waitForSelector('#settings-content [data-setting-key="slow_torrent_inactive_timer"]');
        const advanced=await page.evaluate(()=>({inactive:document.querySelector('[data-setting-key="slow_torrent_inactive_timer"] strong')?.textContent||'',dl:document.querySelector('[data-setting-key="slow_torrent_dl_rate_threshold"] strong')?.textContent||'',watermark:document.querySelector('[data-setting-key="send_buffer_watermark"] strong')?.textContent||'',socket:document.querySelector('[data-setting-key="socket_backlog_size"] strong')?.textContent||'',enumCount:document.querySelectorAll('[data-setting-key="upload_choking_algorithm"] .ui-select,[data-setting-key="upload_slots_behavior"] .ui-select,[data-setting-key="utp_tcp_mixed_mode"] .ui-select').length,timezoneText:document.querySelector('.status-timezone .ui-select__value')?.textContent||''}));
        assert(/\(s\)/.test(advanced.inactive),`${tag}: inactive timer unit missing: ${advanced.inactive}`);assert(/\(KiB\/s\)/.test(advanced.dl),`${tag}: slow rate unit missing: ${advanced.dl}`);assert(/\(KiB\)/.test(advanced.watermark),`${tag}: watermark unit missing: ${advanced.watermark}`);assert(/\(connections\)/.test(advanced.socket),`${tag}: socket backlog unit missing: ${advanced.socket}`);assert(advanced.enumCount===3,`${tag}: verified Advanced enum Selects missing (${advanced.enumCount})`);assert(/^UTC[+-]\d{2}:\d{2}\s*·/.test(advanced.timezoneText),`${tag}: canonical status timezone label missing: ${advanced.timezoneText}`);
      }
      assert(errors.length===0,`${tag}: browser errors: ${errors.join(' | ')}`);await context.close();
    }
  }

  const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'}),page=await context.newPage();await page.goto(`http://${host}:${port}/f8/#/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.v036==='1');const reduced=await page.evaluate(()=>WeiG.AmbientMark.trigger('.brand__mark','orbit-spark'));assert(reduced===false,'Reduced Motion must disable AmbientMark animation');await context.close();
  console.log(`v0.3.6 full representative browser regression passed for ${Object.keys(variants).length} compatibility nodes × ${viewports.length} viewports, including the synthetic future-major sentinel.`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

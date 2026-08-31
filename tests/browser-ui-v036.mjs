import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const webRoot=path.resolve(here,'../webui/private');
const host='127.0.0.1',port=8768;
const variants={qb4:{qb:'v4.1.9.1',api:'2.2.1'},qb46:{qb:'v4.6.7',api:'2.8.3'},qb5:{qb:'v5.2.0',api:'2.15.1'}};
const viewports=[{width:390,height:844,label:'mobile'},{width:1366,height:768,label:'desktop'},{width:1920,height:1080,label:'wide'}];
const torrents=Array.from({length:125},(_,i)=>({
  hash:(i+1).toString(16).padStart(40,'0'),name:`Fixture Torrent ${String(i+1).padStart(3,'0')}`,
  size:1024*1024*(i+1),progress:.45,dlspeed:1000+i,upspeed:200+i,eta:3600,state:'downloading',ratio:.25,
  tracker:'https://tracker.example/announce',category:'fixture',added_on:100000+i,save_path:'/downloads/fixture'
}));
function assert(condition,message){if(!condition)throw new Error(message);}
function writeJson(res,value){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function writeText(res,value){res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
function handleApi(req,res,name,apiPath,url){
  if(apiPath==='app/version')return writeText(res,variants[name].qb);
  if(apiPath==='app/webapiVersion')return writeText(res,variants[name].api);
  if(apiPath==='app/preferences')return writeJson(res,{web_ui_port:8080,web_ui_upnp:false,alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui'});
  if(apiPath==='app/buildInfo')return writeJson(res,{});
  if(apiPath==='transfer/info')return writeJson(res,{dl_info_speed:12345,up_info_speed:6789,connection_status:'connected',dht_nodes:12,total_peer_connections:4});
  if(apiPath==='sync/maindata')return writeJson(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dl_info_speed:12345,up_info_speed:6789,dht_nodes:12,total_peer_connections:4}});
  if(apiPath==='torrents/info'){
    const hashes=url.searchParams.get('hashes');if(hashes){const set=new Set(hashes.split('|'));return writeJson(res,torrents.filter(t=>set.has(t.hash)));}
    const limit=Math.max(0,Number(url.searchParams.get('limit')||0)),offset=Math.max(0,Number(url.searchParams.get('offset')||0));
    return writeJson(res,limit?torrents.slice(offset,offset+limit):torrents.slice(offset));
  }
  if(apiPath==='torrents/properties')return writeJson(res,{save_path:'/downloads/fixture',total_size:1024*1024,total_downloaded:500000,total_uploaded:100000,share_ratio:.2,nb_connections:4,seeds:2,peers:3,addition_date:1788140000,completion_date:-1,created_by:'fixture',pieces_num:20,piece_size:65536});
  if(apiPath==='torrents/files'||apiPath==='torrents/trackers'||apiPath==='sync/torrentPeers'||apiPath==='torrents/webseeds')return writeJson(res,apiPath==='sync/torrentPeers'?{peers:{}}:[]);
  if(apiPath==='torrents/categories')return writeJson(res,{});
  if(apiPath==='torrents/tags')return writeJson(res,[]);
  if(apiPath==='rss/items')return writeJson(res,{});
  if(apiPath==='search/plugins')return writeJson(res,[]);
  if(apiPath==='log/main'||apiPath==='log/peers')return writeJson(res,[]);
  if(req.method==='POST'){res.writeHead(200,{'cache-control':'no-store'});return res.end('');}
  return writeJson(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,`http://${host}:${port}`),match=url.pathname.match(/^\/(qb4|qb46|qb5)(?:\/(.*))?$/);if(!match){res.writeHead(404);return res.end('not found');}
  const name=match[1],relative=match[2]||'';if(relative.startsWith('api/v2/'))return handleApi(req,res,name,relative.slice(7),url);
  if(relative==='weigg-install.json')return writeJson(res,{version:'0.3.6',gitSha:'1234567890abcdef1234567890abcdef12345678',container:'fixture',qbPath:'/config/weigg-qb-webui',hostPath:'/root/qbittorrent/config/weigg-qb-webui',installedAt:'2026-08-31T11:00:00Z',installer:'linux'});
  const requested=relative||'index.html',file=path.resolve(webRoot,requested);if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}
  const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);
}catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function choose(page,nativeId,value){
  const custom=page.locator(`#${nativeId} + .ui-select`);await custom.locator('.ui-select__trigger').click();await custom.locator(`.ui-select__option[data-value="${value}"]`).click();
}
async function waitPageNumber(page,n){await page.waitForFunction(expected=>{const text=document.querySelector('#page-label')?.textContent||'';return new RegExp(`(?:Page|第)\\s*${expected}(?:\\s|\\/)`).test(text);},n,{timeout:2500});}

const browser=await chromium.launch({headless:true});
try{
  for(const name of Object.keys(variants)){
    for(const viewport of viewports){
      const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:'en-US',timezoneId:'UTC'}),page=await context.newPage(),errors=[];
      page.on('console',msg=>{if(msg.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(msg.text()))errors.push(msg.text());});page.on('pageerror',error=>errors.push(String(error)));
      await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'networkidle'});await page.waitForSelector('.torrent-title,.torrent-mobile-card');await page.waitForFunction(()=>document.documentElement.dataset.v036==='1');

      const primitive=await page.evaluate(()=>{const native=document.querySelector('#page-size'),custom=native?.nextElementSibling,mark=document.querySelector('.brand__mark');return {nativeHidden:native?.classList.contains('ui-native-select'),customSelect:custom?.classList.contains('ui-select'),ambient:mark?.classList.contains('ambient-mark'),orbit:!!mark?.querySelector('.ambient-mark__orbit'),sparks:mark?.querySelectorAll('.ambient-mark__spark').length||0,scrollWidth:document.documentElement.scrollWidth,innerWidth};});
      assert(primitive.nativeHidden,`${name}/${viewport.label}: native select was not progressively hidden`);assert(primitive.customSelect,`${name}/${viewport.label}: canonical select missing`);assert(primitive.ambient&&primitive.orbit&&primitive.sparks>=4,`${name}/${viewport.label}: AmbientMark template missing`);assert(primitive.scrollWidth<=primitive.innerWidth+1,`${name}/${viewport.label}: horizontal overflow`);
      const triggered=await page.evaluate(()=>WeiG.AmbientMark.trigger('.brand__mark','orbit-spark'));assert(triggered,`${name}/${viewport.label}: AmbientMark deterministic trigger failed`);assert(await page.locator('.brand__mark').evaluate(el=>el.classList.contains('is-ambient-orbit')&&el.classList.contains('is-ambient-spark')),`${name}/${viewport.label}: AmbientMark classes missing`);

      await choose(page,'page-size','20');await page.waitForFunction(()=>document.querySelector('#page-size')?.value==='20');await page.locator('#next-btn').click();await waitPageNumber(page,2);
      const list=page.locator('#torrent-list');await list.evaluate(node=>{node.scrollTop=160;});await page.waitForTimeout(80);const before=await list.evaluate(node=>node.scrollTop);
      const title=viewport.width<=820?page.locator('.mobile-card-title').first():page.locator('.torrent-title').first();await title.click();await page.waitForFunction(()=>WeiG.Router.route().name==='torrent');await page.waitForSelector('[data-v036-detail-back]');
      const backPlacement=await page.evaluate(()=>{const tabs=document.querySelector('.detail-tabs'),back=tabs?.querySelector('[data-v036-detail-back]');return !!back&&tabs.firstElementChild===back;});assert(backPlacement,`${name}/${viewport.label}: detail Back is not left of Overview`);
      await page.locator('[data-v036-detail-back]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='home');await waitPageNumber(page,2);await page.waitForTimeout(150);const after=await list.evaluate(node=>node.scrollTop);assert(Math.abs(after-before)<=8,`${name}/${viewport.label}: list scroll context not restored ${before} -> ${after}`);

      const titleAgain=viewport.width<=820?page.locator('.mobile-card-title').first():page.locator('.torrent-title').first();await titleAgain.click();await page.waitForFunction(()=>WeiG.Router.route().name==='torrent');await page.keyboard.press('Escape');await page.waitForFunction(()=>WeiG.Router.route().name==='home');await waitPageNumber(page,2);
      assert(errors.length===0,`${name}/${viewport.label}: browser errors: ${errors.join(' | ')}`);await context.close();
    }
  }

  const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'}),page=await context.newPage();await page.goto(`http://${host}:${port}/qb5/#/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>document.documentElement.dataset.v036==='1');const reduced=await page.evaluate(()=>WeiG.AmbientMark.trigger('.brand__mark','orbit-spark'));assert(reduced===false,'Reduced Motion must disable AmbientMark animation');await context.close();
  console.log('v0.3.6 canonical Select, AmbientMark, detail Back/Escape and list-context regression passed for qB 4.1.9.1, 4.6.7 and 5.2.0 across 3 viewports.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

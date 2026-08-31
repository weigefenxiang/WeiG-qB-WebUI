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
const variants={qb4:{qb:'v4.1.9.1',api:'2.2.1'},qb5:{qb:'v5.2.3',api:'2.15.1'}};
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
  tracker:'https://tracker.example/announce',category:'fixture',added_on:100000+i,save_path:'/downloads'
}));
function assert(condition,message){if(!condition)throw new Error(message);}
function json(res,value){res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function text(res,value){res.writeHead(200,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
function api(req,res,name,apiPath,url){
  if(apiPath==='app/version')return text(res,variants[name].qb);
  if(apiPath==='app/webapiVersion')return text(res,variants[name].api);
  if(apiPath==='app/preferences')return json(res,{alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',web_ui_port:8080});
  if(apiPath==='app/buildInfo')return json(res,{});
  if(apiPath==='transfer/info')return json(res,{dl_info_speed:0,up_info_speed:0,dl_info_data:0,up_info_data:0,dl_rate_limit:0,up_rate_limit:0,connection_status:'connected',dht_nodes:32,total_peer_connections:4});
  if(apiPath==='transfer/speedLimitsMode')return text(res,'0');
  if(apiPath==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{free_space_on_disk:FREE,connection_status:'connected',dl_info_speed:0,up_info_speed:0,dl_info_data:0,up_info_data:0,dl_rate_limit:0,up_rate_limit:0,dht_nodes:32,total_peer_connections:4}});
  if(apiPath==='torrents/info'){
    const hashes=url.searchParams.get('hashes');if(hashes){const set=new Set(hashes.split('|'));return json(res,torrents.filter(t=>set.has(t.hash)));}
    const limit=Math.max(0,Number(url.searchParams.get('limit')||0)),offset=Math.max(0,Number(url.searchParams.get('offset')||0));
    return json(res,limit?torrents.slice(offset,offset+limit):torrents.slice(offset));
  }
  if(apiPath==='torrents/categories')return json(res,{});
  if(apiPath==='torrents/tags')return json(res,[]);
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
  if(relative==='weigg-install.json')return json(res,{version:'0.3.6',gitSha:'1234567890abcdef1234567890abcdef12345678',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});
  const requested=relative||'index.html',file=path.resolve(webRoot,requested);if(!(file===webRoot||file.startsWith(webRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}
  const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);
}catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

const browser=await chromium.launch({headless:true});
try{
  for(const name of Object.keys(variants))for(const viewport of viewports){
    const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},locale:'en-US'}),page=await context.newPage(),errors=[];
    page.on('console',msg=>{if(msg.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(msg.text()))errors.push(msg.text());});page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'networkidle'});
    await page.waitForSelector('.torrent-mobile-card');
    await page.waitForFunction(()=>window.WeiG?.MobileAdaptive&&document.querySelector('#status-free-space:not([hidden]) strong')?.textContent!=='—');
    const state=await page.evaluate(()=>{
      const workspace=document.querySelector('.workspace'),panel=document.querySelector('.torrent-panel'),list=document.querySelector('#torrent-list'),pager=document.querySelector('.pager'),meta=document.querySelector('.mobile-card-meta'),cells=[...meta.querySelectorAll('.cell')],storage=document.querySelector('#status-free-space strong'),tones=[...document.querySelectorAll('.torrent-mobile-card .status-pill')].map(n=>n.dataset.tone),rects=cells.map(n=>n.getBoundingClientRect());
      return {
        free:storage?.textContent,
        formatted:[WeiG.MobileAdaptive.formatFreeSpace(1.234*(1024**4)),WeiG.MobileAdaptive.formatFreeSpace(12.34*(1024**3)),WeiG.MobileAdaptive.formatFreeSpace(987.6*(1024**2))],
        workspace:{top:workspace.getBoundingClientRect().top,bottom:workspace.getBoundingClientRect().bottom,height:workspace.clientHeight,scrollHeight:workspace.scrollHeight},
        panel:{bottom:panel.getBoundingClientRect().bottom,height:panel.getBoundingClientRect().height},
        list:{height:list.getBoundingClientRect().height,scrollHeight:list.scrollHeight},
        pager:{bottom:pager.getBoundingClientRect().bottom},
        meta:{display:getComputedStyle(meta).display,clientWidth:meta.clientWidth,scrollWidth:meta.scrollWidth,tops:rects.map(r=>Math.round(r.top))},
        tones,
        doc:{width:document.documentElement.scrollWidth,innerWidth,scrollHeight:document.documentElement.scrollHeight,innerHeight}
      };
    });
    assert(state.free==='1.23 TiB',`${name}/${viewport.label}: free-space display expected 1.23 TiB, got ${state.free}`);
    assert(JSON.stringify(state.formatted)===JSON.stringify(['1.23 TiB','12.3 GiB','988 MiB']),`${name}/${viewport.label}: 3-significant-digit formatter contract failed`);
    assert(state.meta.display==='flex',`${name}/${viewport.label}: mobile Torrent meta is not one-line flex`);
    assert(Math.max(...state.meta.tops)-Math.min(...state.meta.tops)<=3,`${name}/${viewport.label}: Torrent meta wrapped to multiple lines`);
    assert(state.meta.scrollWidth<=state.meta.clientWidth+2,`${name}/${viewport.label}: Torrent meta overflows horizontally`);
    assert(state.list.height>=100,`${name}/${viewport.label}: adaptive Torrent list collapsed (${state.list.height}px)`);
    assert(Math.abs(state.panel.bottom-state.workspace.bottom)<=10,`${name}/${viewport.label}: Torrent panel leaves unused bottom workspace (${state.workspace.bottom-state.panel.bottom}px)`);
    assert(state.doc.width<=state.doc.innerWidth+1,`${name}/${viewport.label}: document horizontal overflow`);
    assert(state.tones.includes('stalled-up')&&state.tones.includes('download')&&state.tones.includes('seed')&&state.tones.includes('stopped'),`${name}/${viewport.label}: distinct semantic state tones missing`);

    for(const route of ['search','rss']){
      await page.locator(`#mobile-bottom-nav [data-route="${route}"]`).click();await page.waitForFunction(expected=>WeiG.Router.route().name===expected,route);await page.waitForTimeout(80);
      const tool=await page.evaluate(expected=>{const workspace=document.querySelector('.workspace'),view=document.getElementById(expected+'-view'),pageBox=view.querySelector('.tool-page');return {workspaceH:workspace.clientHeight,workspaceScroll:workspace.scrollHeight,viewH:view.getBoundingClientRect().height,pageBottom:pageBox.getBoundingClientRect().bottom,workspaceBottom:workspace.getBoundingClientRect().bottom,docH:document.documentElement.scrollHeight,innerH:innerHeight};},route);
      assert(tool.viewH<=tool.workspaceH+2,`${name}/${viewport.label}/${route}: tool view exceeds one workspace viewport`);
      assert(Math.abs(tool.pageBottom-tool.workspaceBottom)<=10,`${name}/${viewport.label}/${route}: tool page does not consume the remaining viewport`);
      assert(tool.docH<=tool.innerH+1,`${name}/${viewport.label}/${route}: document gained an extra blank page`);
    }
    assert(errors.length===0,`${name}/${viewport.label}: browser errors: ${errors.join(' | ')}`);
    await context.close();
  }
  console.log('v0.3.6 mobile adaptive viewport, one-line Torrent metadata, semantic states, Search/RSS one-page layout and storage dock passed for qB 4.1.9.1 + 5.2.3 across 4 phone sizes.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

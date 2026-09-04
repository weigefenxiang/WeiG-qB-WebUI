import {launchBrowser} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../webui/private');
const host='127.0.0.1',port=8781;
const torrent={hash:'0000000000000000000000000000000000000001',name:'Sidebar capability visual fixture',size:1048576,progress:.5,dlspeed:1024,upspeed:0,eta:600,state:'downloading',ratio:.1,tracker:'https://tracker.example/announce',category:'',tags:'Fixture',added_on:1000,save_path:'/downloads',private:false,num_seeds:4,num_leechs:2,priority:1};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,value,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function text(res,value,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
function empty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
function api(req,res,p,url){
  if(p==='app/version')return text(res,'v4.1.9.1');
  if(p==='app/webapiVersion')return text(res,'2.2.1');
  if(p==='app/preferences')return json(res,{save_path:'/downloads',alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui'});
  if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:1024,up_info_speed:0,connection_status:'connected'});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dht_nodes:8,total_peer_connections:2,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||0),rows=[torrent];return json(res,limit?rows.slice(offset,offset+limit):rows.slice(offset));}
  if(p==='torrents/categories')return json(res,{});
  if(p==='torrents/tags')return json(res,['Fixture']);
  if(['search/plugins','log/main','log/peers','rss/items'].includes(p))return json(res,p==='rss/items'?{}:[]);
  if(req.method==='POST')return empty(res);
  return json(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\//,'');if(rel.startsWith('api/v2/'))return api(req,res,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:'fixture',gitSha:'sidebar-capability-visual',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});const requested=rel||'index.html',file=path.resolve(root,requested);if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403);return res.end('forbidden');}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function assertTheme(page,label,expectedSize){
  const geometry=await page.evaluate(()=>{const host=document.getElementById('theme-btn'),control=document.getElementById('theme-control'),button=control?.querySelector('.ui-select__trigger'),svg=button?.querySelector('svg'),github=document.querySelector('#github-link svg');if(!host||!control||!button||!svg||!github)return null;const center=n=>{const r=n.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};};return{host:center(host),control:center(control),button:center(button),svg:center(svg),github:center(github),svgCount:button.querySelectorAll('svg').length,text:(button.textContent||'').trim(),title:button.getAttribute('title'),prefixClass:button.firstElementChild?.className||''};});
  assert(geometry,`${label}: Theme geometry is unavailable`);
  assert(geometry.svgCount===1&&geometry.text==='',`${label}: Theme trigger must be SVG-only, not a Unicode glyph/placeholder ${JSON.stringify(geometry)}`);
  assert(geometry.title===null,`${label}: Theme trigger retained a native title tooltip ${JSON.stringify(geometry)}`);
  assert(String(geometry.prefixClass).includes('header-utility-icon'),`${label}: Theme prefix does not reuse the utility icon primitive ${JSON.stringify(geometry)}`);
  assert(Math.abs(geometry.button.w-expectedSize)<=1&&Math.abs(geometry.button.h-expectedSize)<=1,`${label}: Theme button size diverged ${JSON.stringify(geometry)}`);
  assert(Math.abs(geometry.host.w-geometry.button.w)<=1&&Math.abs(geometry.control.w-geometry.button.w)<=1,`${label}: Theme host/control retained phantom width ${JSON.stringify(geometry)}`);
  assert(Math.abs(geometry.svg.x-geometry.button.x)<=1&&Math.abs(geometry.svg.y-geometry.button.y)<=1,`${label}: Theme SVG is not optically centered ${JSON.stringify(geometry)}`);
  await page.locator('#theme-control .ui-select__trigger').click();
  await page.waitForSelector('#weigg-floating-layer .ui-select__menu');
  const openCenter=await page.locator('#theme-control .ui-select__trigger').evaluate(button=>{const svg=button.querySelector('svg'),br=button.getBoundingClientRect(),sr=svg.getBoundingClientRect();return{dx:(sr.left+sr.width/2)-(br.left+br.width/2),dy:(sr.top+sr.height/2)-(br.top+br.height/2),w:br.width,h:br.height};});
  assert(Math.abs(openCenter.dx)<=1&&Math.abs(openCenter.dy)<=1&&Math.abs(openCenter.w-expectedSize)<=1,`${label}: opening Theme changed icon/button geometry ${JSON.stringify(openCenter)}`);
  await page.keyboard.press('Escape');
}
async function assertTags(page,label){
  const facet=page.locator('[data-facet="tag"]');
  await facet.waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-facet="tag"] .ui-select__value')?.textContent==='全部标签');
  const g=await facet.evaluate(n=>{const trigger=n.querySelector('.ui-select__trigger'),value=n.querySelector('.ui-select__value'),badge=n.querySelector('.capability-badge'),tr=trigger.getBoundingClientRect(),vr=value.getBoundingClientRect(),br=badge.getBoundingClientRect(),nr=n.getBoundingClientRect();return{text:value.textContent,client:value.clientWidth,scroll:value.scrollWidth,triggerW:tr.width,valueW:vr.width,gap:br.left-tr.right,badge:badge.textContent.trim(),wrapperW:nr.width,overflow:n.scrollWidth-n.clientWidth,titleCount:n.querySelectorAll('[title]').length,wrapperTitle:n.hasAttribute('title')};});
  assert(g.text==='全部标签'&&g.client>=g.scroll-1,`${label}: 全部标签 is clipped/ellipsized ${JSON.stringify(g)}`);
  assert(g.triggerW>=104&&g.gap>=4&&g.gap<=10&&g.badge==='4.2.0+'&&g.overflow<=1,`${label}: Tags trigger/badge geometry is wrong ${JSON.stringify(g)}`);
  assert(g.titleCount===0&&!g.wrapperTitle,`${label}: native title tooltip survived inside capability control ${JSON.stringify(g)}`);
  await facet.locator('.ui-select__trigger').hover();
  await page.waitForSelector('#polish-tooltip.is-visible');
  const tips=await page.locator('#polish-tooltip.is-visible').count();
  const copy=(await page.locator('#polish-tooltip.is-visible').textContent())||'';
  assert(tips===1&&copy.includes('标签')&&copy.includes('4.2.0+'),`${label}: expected exactly one custom capability tooltip ${JSON.stringify({tips,copy})}`);
  await page.mouse.move(1,1);
  await page.waitForFunction(()=>!document.getElementById('polish-tooltip')?.classList.contains('is-visible'));
}

const browser=await launchBrowser();
let context=null;
try{
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#logout-btn');
  await page.waitForFunction(()=>document.querySelector('[data-facet="tag"]')?.getAttribute('aria-disabled')==='true'&&window.WeiG?.CapabilityRegistry?.state('tags')?.badge==='4.2.0+');

  await assertTheme(page,'Desktop',40);
  await assertTags(page,'Desktop zh-CN Sidebar');
  const capabilityNativeTitles=await page.locator('[data-capability-id][aria-disabled="true"]').evaluateAll(nodes=>nodes.reduce((count,n)=>count+(n.hasAttribute('title')?1:0)+n.querySelectorAll('[title]').length,0));
  assert(capabilityNativeTitles===0,`Desktop: disabled capabilities retained ${capabilityNativeTitles} native title tooltip owners`);

  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  await assertTheme(page,'Mobile',44);
  await page.locator('#menu-btn').click();
  await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));
  await assertTags(page,'Mobile zh-CN Drawer');
  await page.locator('#menu-btn').click();
  await page.waitForFunction(()=>!document.getElementById('sidebar')?.classList.contains('is-open'));
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`);
  console.log('Sidebar capability visual gate passed: Theme uses one centered SVG utility icon, Desktop/Mobile zh-CN 全部标签 is fully visible beside 4.2.0+, and capability hover has one custom tooltip with no native title owner.');
}finally{
  if(context)await context.close();
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

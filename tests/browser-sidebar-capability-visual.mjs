import {launchBrowser} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../webui/private');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
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
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\//,'');if(rel.startsWith('api/v2/'))return api(req,res,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'sidebar-capability-visual',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});const requested=rel||'index.html',file=path.resolve(root,requested);if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403);return res.end('forbidden');}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function assertTheme(page,label,expectedSize){
  const g=await page.evaluate(()=>{const host=document.getElementById('theme-btn'),control=document.getElementById('theme-control'),button=control?.querySelector('.ui-select__trigger'),svg=button?.querySelector('svg');if(!host||!control||!button||!svg)return null;const c=n=>{const r=n.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};};return{host:c(host),control:c(control),button:c(button),svg:c(svg),svgCount:button.querySelectorAll('svg').length,text:(button.textContent||'').trim(),title:button.getAttribute('title')};});
  assert(g&&g.svgCount===1&&g.text===''&&g.title===null,`${label}: Theme must remain SVG-only ${JSON.stringify(g)}`);
  assert(Math.abs(g.button.w-expectedSize)<=1&&Math.abs(g.button.h-expectedSize)<=1,`${label}: Theme size diverged ${JSON.stringify(g)}`);
  assert(Math.abs(g.host.w-g.button.w)<=1&&Math.abs(g.control.w-g.button.w)<=1,`${label}: Theme retained phantom width ${JSON.stringify(g)}`);
  assert(Math.abs(g.svg.x-g.button.x)<=1&&Math.abs(g.svg.y-g.button.y)<=1,`${label}: Theme SVG is not centered ${JSON.stringify(g)}`);
}

async function assertNoSidebarTooltip(page,selector,label){
  const node=page.locator(selector);await node.hover();await page.waitForTimeout(450);
  const state=await node.evaluate(n=>({data:n.hasAttribute('data-tooltip'),title:n.hasAttribute('title'),descTitles:n.querySelectorAll('[title]').length}));
  const visible=await page.locator('#polish-tooltip.is-visible').count();
  assert(!state.data&&!state.title&&state.descTitles===0&&visible===0,`${label}: Sidebar must have zero tooltip owners ${JSON.stringify({state,visible})}`);
}

async function assertInline(page,selector,badgeCopy,label){
  const g=await page.locator(selector).evaluate(n=>{const badge=n.querySelector(':scope > .capability-badge');if(!badge)return null;const text=Array.from(n.childNodes).find(x=>x.nodeType===Node.TEXT_NODE&&x.textContent.trim());if(!text)return null;const range=document.createRange();range.selectNodeContents(text);const tr=range.getBoundingClientRect(),br=badge.getBoundingClientRect(),style=getComputedStyle(n);return{gap:br.left-tr.right,badge:badge.textContent.trim(),cssGap:style.columnGap||style.gap};});
  assert(g&&g.badge===badgeCopy&&g.gap>=10&&g.gap<=14,`${label}: inline capability gap must be standardized near 12px ${JSON.stringify(g)}`);
  await assertNoSidebarTooltip(page,selector,label);
}

async function assertTags(page,label){
  const facet=page.locator('[data-facet="tag"]');await facet.waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-facet="tag"] .ui-select__value')?.textContent==='全部标签');
  const g=await facet.evaluate(n=>{const trigger=n.querySelector('.ui-select__trigger'),value=n.querySelector('.ui-select__value'),inside=trigger?.querySelector(':scope > .capability-badge'),outside=n.querySelector(':scope > .capability-badge');if(!trigger||!value||!inside)return null;const tr=trigger.getBoundingClientRect(),vr=value.getBoundingClientRect(),br=inside.getBoundingClientRect();return{text:value.textContent,client:value.clientWidth,scroll:value.scrollWidth,badge:inside.textContent.trim(),outside:!!outside,gap:br.left-vr.right,left:vr.left-tr.left,right:tr.right-br.right,triggerW:tr.width,overflow:n.scrollWidth-n.clientWidth,dataTooltip:n.hasAttribute('data-tooltip'),titles:n.querySelectorAll('[title]').length};});
  assert(g&&g.text==='全部标签'&&g.client>=g.scroll-1,`${label}: 全部标签 is clipped ${JSON.stringify(g)}`);
  assert(g.badge==='4.2.0+'&&!g.outside,`${label}: capability badge must live inside the canonical Select trigger ${JSON.stringify(g)}`);
  assert(g.gap>=10&&g.gap<=14&&g.left>=8&&g.left<=12&&g.right>=8&&g.right<=12,`${label}: label/badge/padding geometry is not compact and symmetric ${JSON.stringify(g)}`);
  assert(g.triggerW<150&&g.overflow<=1,`${label}: disabled Tags control retained artificial empty width ${JSON.stringify(g)}`);
  await assertNoSidebarTooltip(page,'[data-facet="tag"]',label);
  await facet.locator('.capability-badge').click();
  await page.waitForSelector('#capability-dialog[open]');
  const cap=await page.locator('#capability-dialog').getAttribute('data-dialog-capability');
  assert(cap==='tags',`${label}: badge and label must share the same capability action owner`);
  await page.locator('#capability-dialog .capability-dialog__done').click();
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
  await assertInline(page,'[data-filter="stalled"]','4.2.5+','Desktop Stalled');
  await assertInline(page,'[data-filter="private"]','5.0.0+','Desktop Private/PT');
  await assertTags(page,'Desktop zh-CN Sidebar');

  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
  await assertTheme(page,'Mobile',44);
  await page.locator('#menu-btn').click();await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));
  await assertInline(page,'[data-filter="stalled"]','4.2.5+','Mobile Stalled');
  await assertInline(page,'[data-filter="private"]','5.0.0+','Mobile Private/PT');
  await assertTags(page,'Mobile zh-CN Drawer');
  await page.locator('#menu-btn').click();await page.waitForFunction(()=>!document.getElementById('sidebar')?.classList.contains('is-open'));
  assert(errors.length===0,`Browser errors: ${errors.join(' | ')}`);
  console.log('Sidebar capability visual gate passed: inline capability gaps are standardized, Tags badge is inside one compact Select shell, Desktop/Mobile zh-CN geometry is complete, and Sidebar capability hover has zero tooltip owners.');
}finally{if(context)await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}

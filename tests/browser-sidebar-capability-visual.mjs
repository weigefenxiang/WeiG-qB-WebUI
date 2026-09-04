import {launchBrowser} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../webui/private');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const host='127.0.0.1',port=8781;
let fixtureMode='q4';
const torrent={hash:'0000000000000000000000000000000000000001',name:'Sidebar capability visual fixture',size:1048576,progress:.5,dlspeed:1024,upspeed:0,eta:600,state:'downloading',ratio:.1,tracker:'https://tracker.example/announce',category:'',tags:'Fixture',added_on:1000,save_path:'/downloads',private:false,num_seeds:4,num_leechs:2,priority:1};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function versions(){return fixtureMode==='q5'?{qb:'v5.2.0',api:'2.11.4'}:{qb:'v4.1.9.1',api:'2.2.1'};}
function json(res,value,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function text(res,value,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
function empty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
function api(req,res,p,url){
  const v=versions();
  if(p==='app/version')return text(res,v.qb);
  if(p==='app/webapiVersion')return text(res,v.api);
  if(p==='app/preferences')return json(res,{save_path:'/downloads',alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui'});
  if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:1024,up_info_speed:0,connection_status:'firewalled'});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:['Fixture'],server_state:{connection_status:'firewalled',dht_nodes:8,total_peer_connections:2,free_space_on_disk:10737418240}});
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

async function waitReady(page){await page.waitForSelector('#logout-btn');await page.waitForSelector('[data-facet="tag"]');await page.waitForFunction(()=>window.WeiG?.AppState?.client?.qbVersion&&window.WeiG.AppState.client.qbVersion!=='0.0.0');await page.waitForTimeout(120);}
async function assertTheme(page,label,expectedSize){
  const g=await page.evaluate(()=>{const host=document.getElementById('theme-btn'),control=document.getElementById('theme-control'),button=document.getElementById('theme-utility-btn'),svg=button?.querySelector('svg');if(!host||!control||!button||!svg)return null;const c=n=>{const r=n.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};};return{host:c(host),control:c(control),button:c(button),svg:c(svg),svgCount:button.querySelectorAll('svg').length,text:(button.textContent||'').trim(),title:button.getAttribute('title'),hint:button.dataset.headerTooltip||''};});
  assert(g&&g.svgCount===1&&g.text===''&&g.title===null&&g.hint,`${label}: Theme must remain SVG-only and use the header tooltip template ${JSON.stringify(g)}`);
  assert(Math.abs(g.button.w-expectedSize)<=1&&Math.abs(g.button.h-expectedSize)<=1,`${label}: Theme size diverged ${JSON.stringify(g)}`);
  assert(Math.abs(g.host.w-g.button.w)<=1&&Math.abs(g.control.w-g.button.w)<=1,`${label}: Theme retained phantom width ${JSON.stringify(g)}`);
  assert(Math.abs(g.svg.x-g.button.x)<=1&&Math.abs(g.svg.y-g.button.y)<=1,`${label}: Theme SVG is not centered ${JSON.stringify(g)}`);
}
async function assertNoTooltip(page,selector,label){
  const node=page.locator(selector);await node.waitFor();await node.hover();await page.waitForTimeout(80);
  const visible=await page.locator('#polish-tooltip.is-visible').count();
  const state=await node.evaluate(n=>({title:n.hasAttribute('title'),legacy:n.hasAttribute('data-tooltip'),descTitles:n.querySelectorAll('[title]').length,descLegacy:n.querySelectorAll('[data-tooltip]').length}));
  assert(visible===0&&!state.title&&!state.legacy&&state.descTitles===0&&state.descLegacy===0,`${label}: non-header surfaces must have zero hover tooltip owners ${JSON.stringify({state,visible})}`);
}
async function assertInline(page,selector,badgeCopy,label){
  const g=await page.locator(selector).evaluate(n=>{const badge=n.querySelector(':scope > .capability-badge');if(!badge)return null;const walker=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let text=null,current;while((current=walker.nextNode())){if(!badge.contains(current)&&current.textContent.trim()){text=current;break;}}if(!text)return null;const range=document.createRange();range.selectNodeContents(text);const tr=range.getBoundingClientRect(),br=badge.getBoundingClientRect();return{gap:br.left-tr.right,badge:badge.textContent.trim(),text:text.textContent.trim()};});
  assert(g&&g.badge===badgeCopy&&g.gap>=10&&g.gap<=14,`${label}: inline capability gap must be standardized near 12px ${JSON.stringify(g)}`);
  await assertNoTooltip(page,selector,label);
}
async function assertDisabledTags(page,label){
  const facet=page.locator('[data-facet="tag"]');await page.waitForFunction(()=>document.querySelector('[data-facet="tag"] .ui-select__value')?.textContent==='全部标签');
  const g=await facet.evaluate(n=>{const trigger=n.querySelector('.ui-select__trigger'),value=n.querySelector('.ui-select__value'),inside=trigger?.querySelector(':scope > .capability-badge'),outside=n.querySelector(':scope > .capability-badge');if(!trigger||!value||!inside)return null;const tr=trigger.getBoundingClientRect(),vr=value.getBoundingClientRect(),br=inside.getBoundingClientRect();return{text:value.textContent,client:value.clientWidth,scroll:value.scrollWidth,badge:inside.textContent.trim(),outside:!!outside,gap:br.left-vr.right,left:vr.left-tr.left,right:tr.right-br.right,triggerW:tr.width,overflow:n.scrollWidth-n.clientWidth};});
  assert(g&&g.text==='全部标签'&&g.client>=g.scroll-1,`${label}: 全部标签 is clipped ${JSON.stringify(g)}`);
  assert(g.badge==='4.2.0+'&&!g.outside,`${label}: capability badge must live inside the canonical Select trigger ${JSON.stringify(g)}`);
  assert(g.gap>=10&&g.gap<=14&&g.left>=8&&g.left<=12&&g.right>=8&&g.right<=12,`${label}: label/badge/padding geometry is not compact and symmetric ${JSON.stringify(g)}`);
  assert(g.triggerW<150&&g.overflow<=1,`${label}: disabled Tags control retained artificial empty width ${JSON.stringify(g)}`);
  await assertNoTooltip(page,'[data-facet="tag"]',label);
  await facet.locator('.capability-badge').click({force:true});await page.waitForSelector('#capability-dialog[open]');
  const cap=await page.locator('#capability-dialog').getAttribute('data-dialog-capability');assert(cap==='tags',`${label}: badge and label must share one capability click owner`);await page.locator('#capability-dialog .capability-dialog__done').click();
}
async function assertSupportedTags(page,label){
  const g=await page.evaluate(()=>{const tag=document.querySelector('[data-facet="tag"]'),category=document.querySelector('[data-facet="category"]'),tt=tag?.querySelector('.ui-select__trigger'),ct=category?.querySelector('.ui-select__trigger');if(!tag||!category||!tt||!ct)return null;const a=tt.getBoundingClientRect(),b=ct.getBoundingClientRect(),ts=getComputedStyle(tt),cs=getComputedStyle(ct);return{tagW:a.width,catW:b.width,tagH:a.height,catH:b.height,badge:tag.querySelectorAll('.capability-badge').length,disabled:tag.classList.contains('is-capability-disabled'),affordance:tag.classList.contains('capability-affordance')||tag.classList.contains('capability-affordance--control'),tagGrid:ts.gridTemplateColumns,catGrid:cs.gridTemplateColumns,chevron:getComputedStyle(tt.querySelector('.ui-select__chevron')).display,value:tt.querySelector('.ui-select__value')?.textContent};});
  assert(g&&g.value==='全部标签'&&g.badge===0&&!g.disabled&&!g.affordance,`${label}: supported Tags must completely exit capability presentation ${JSON.stringify(g)}`);
  assert(Math.abs(g.tagW-g.catW)<=1&&Math.abs(g.tagH-g.catH)<=1&&g.chevron!=='none',`${label}: supported Tags must match the canonical Category Select geometry ${JSON.stringify(g)}`);
  assert(g.tagGrid===g.catGrid,`${label}: supported Tags retained capability grid residue ${JSON.stringify(g)}`);
  await assertNoTooltip(page,'[data-facet="tag"]',label);
}
async function assertHeaderTooltip(page,selector,label){
  const node=page.locator(selector);await node.waitFor();await node.hover();await page.waitForSelector('#polish-tooltip.is-visible');await page.waitForTimeout(30);
  const g=await page.evaluate(sel=>{const target=document.querySelector(sel),tip=document.getElementById('polish-tooltip'),v=visualViewport||{offsetLeft:0,offsetTop:0,width:innerWidth,height:innerHeight};if(!target||!tip)return null;const a=target.getBoundingClientRect(),t=tip.getBoundingClientRect(),left=v.offsetLeft||0,top=v.offsetTop||0,right=left+v.width,bottom=top+v.height,intersects=!(t.right<=a.left||t.left>=a.right||t.bottom<=a.top||t.top>=a.bottom);return{text:tip.textContent.trim(),placement:tip.dataset.placement,left:t.left,right:t.right,top:t.top,bottom:t.bottom,vLeft:left,vRight:right,vTop:top,vBottom:bottom,intersects:intersects,title:target.getAttribute('title'),hint:target.dataset.headerTooltip||'',visibleCount:document.querySelectorAll('.tooltip.is-visible').length};},selector);
  assert(g&&g.text&&g.hint&&g.title===null&&g.visibleCount===1,`${label}: must use one custom Header Tooltip owner ${JSON.stringify(g)}`);
  assert(g.left>=g.vLeft+9&&g.right<=g.vRight-9&&g.top>=g.vTop+9&&g.bottom<=g.vBottom-9,`${label}: tooltip escaped the visual viewport ${JSON.stringify(g)}`);
  assert(!g.intersects&&(g.placement==='top'||g.placement==='bottom'),`${label}: tooltip must be above/below and must not cover its anchor ${JSON.stringify(g)}`);
  await page.mouse.move(400,300);await page.waitForTimeout(30);
}
async function assertOnlyHeaderHints(page,label){
  const g=await page.evaluate(()=>({header:Array.from(document.querySelectorAll('[data-header-tooltip]')).map(n=>n.id).sort(),titles:document.querySelectorAll('[title]').length,legacy:document.querySelectorAll('[data-tooltip]').length}));
  assert(g.header.length===4&&g.header.includes('theme-utility-btn')&&g.header.includes('github-link')&&g.header.includes('blog-link')&&g.header.includes('logout-btn'),`${label}: exactly four Header Tooltip opt-ins are required ${JSON.stringify(g)}`);
  assert(g.titles===0&&g.legacy===0,`${label}: native title/data-tooltip metadata must be scrubbed from the rendered page ${JSON.stringify(g)}`);
}

const browser=await launchBrowser();
let context=null;
try{
  fixtureMode='q4';
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});
  let page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});await waitReady(page);
  await page.waitForFunction(()=>document.querySelector('[data-facet="tag"]')?.getAttribute('aria-disabled')==='true'&&window.WeiG?.CapabilityRegistry?.state('tags')?.badge==='4.2.0+');
  await assertTheme(page,'Desktop',40);await assertInline(page,'[data-filter="stalled"]','4.2.5+','Desktop Stalled');await assertInline(page,'[data-filter="private"]','5.0.0+','Desktop Private/PT');await assertDisabledTags(page,'Desktop qB4 Tags');
  await assertNoTooltip(page,'#status-connection','Connection status');await page.locator('#status-connection').click();await page.waitForSelector('#connection-dialog[open]');await page.locator('#connection-dialog .connection-dialog__done').click();
  await assertNoTooltip(page,'.torrent-title','Torrent title');await assertOnlyHeaderHints(page,'Home qB4');
  for(const [selector,label] of [['#theme-utility-btn','Theme'],['#github-link','GitHub'],['#blog-link','Blog'],['#logout-btn','Logout']])await assertHeaderTooltip(page,selector,label);
  await page.goto(`http://${host}:${port}/#/settings`,{waitUntil:'domcontentloaded'});await waitReady(page);await page.waitForSelector('.setting-title');await assertNoTooltip(page,'.setting-title','Settings title');await assertOnlyHeaderHints(page,'Settings qB4');
  await page.setViewportSize({width:390,height:844});await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});await waitReady(page);await assertTheme(page,'Mobile',44);await page.locator('#menu-btn').click();await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));await assertInline(page,'[data-filter="stalled"]','4.2.5+','Mobile Stalled');await assertInline(page,'[data-filter="private"]','5.0.0+','Mobile Private/PT');await assertDisabledTags(page,'Mobile qB4 Tags');await page.locator('#menu-btn').click();
  assert(errors.length===0,`qB4 browser errors: ${errors.join(' | ')}`);
  await context.close();context=null;

  fixtureMode='q5';
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});page=await context.newPage();errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});await waitReady(page);await page.waitForFunction(()=>window.WeiG?.CapabilityRegistry?.supports('tags')===true&&document.querySelector('[data-facet="tag"]')?.getAttribute('aria-disabled')==='false');
  await assertSupportedTags(page,'Desktop qB5 Tags');await assertNoTooltip(page,'#status-connection','qB5 Connection status');await assertOnlyHeaderHints(page,'Home qB5');for(const [selector,label] of [['#theme-utility-btn','qB5 Theme'],['#github-link','qB5 GitHub'],['#blog-link','qB5 Blog'],['#logout-btn','qB5 Logout']])await assertHeaderTooltip(page,selector,label);
  assert(errors.length===0,`qB5 browser errors: ${errors.join(' | ')}`);
  console.log('Sidebar/hover policy browser gate passed: qB4 compact capability affordances, qB5 canonical supported Tags geometry, exactly four Header Tooltip opt-ins, viewport-safe above/below placement, and zero non-header hover tooltip owners.');
}finally{if(context)await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}

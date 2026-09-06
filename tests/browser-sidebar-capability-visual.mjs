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
function versions(){return fixtureMode==='q5'?{qb:'v5.2.0',api:'2.15.1'}:{qb:'v4.1.0',api:'2.0.0'};}
function releaseCatalog(){
  const q4={qbVersion:'4.1.0',webApiVersion:'2.0.0',officialWeiGSupport:true,apiActions:['appcontroller.h:preferencesAction','torrentscontroller.h:categoriesAction','torrentscontroller.h:resumeAction','torrentscontroller.h:pauseAction','torrentscontroller.h:webseedsAction'],torrentFilters:['all','downloading','seeding','completed','paused','resumed','active','inactive','errored'],torrentInfoParameters:['filter','category','sort','reverse','limit','offset','hashes'],preferenceDescriptors:[]};
  const q5={qbVersion:'5.2.0',webApiVersion:'2.15.1',officialWeiGSupport:true,apiActions:['appcontroller.h:preferencesAction','torrentscontroller.h:categoriesAction','torrentscontroller.h:tagsAction','torrentscontroller.h:startAction','torrentscontroller.h:stopAction','torrentscontroller.h:webseedsAction'],torrentFilters:['all','downloading','seeding','completed','stopped','running','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored'],torrentInfoParameters:['filter','category','tag','sort','reverse','limit','offset','hashes','private'],preferenceDescriptors:[]};
  return[q4,q5];
}
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
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\//,'');if(rel.startsWith('api/v2/'))return api(req,res,rel.slice(7),url);if(rel==='data/qb-releases.json')return json(res,releaseCatalog());if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'sidebar-capability-visual',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});const requested=rel||'index.html',file=path.resolve(root,requested);if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403);return res.end('forbidden');}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function waitReady(page){await page.waitForSelector('#logout-btn');await page.waitForFunction(()=>window.WeiG?.ReleaseProfile?.current()?.qbVersion&&window.WeiG?.CapabilityRegistry?.state('tags')?.feature&&window.WeiG?.AppState?.client?.qbVersion&&window.WeiG.AppState.client.qbVersion!=='0.0.0');await page.waitForTimeout(100);}
async function assertHiddenCapability(page,selector,label){const count=await page.locator(selector).count();if(count===0)return;const hidden=await page.locator(selector).first().evaluate(n=>n.hidden||getComputedStyle(n).display==='none');assert(hidden,`${label}: unsupported capability must be absent/hidden, not disabled and badged`);}
async function assertSupportedTags(page,label){
  const g=await page.evaluate(()=>{const tag=document.querySelector('[data-facet="tag"]'),category=document.querySelector('[data-facet="category"]'),tt=tag?.querySelector('.ui-select__trigger'),ct=category?.querySelector('.ui-select__trigger');if(!tag||!category||!tt||!ct)return null;const a=tt.getBoundingClientRect(),b=ct.getBoundingClientRect(),ts=getComputedStyle(tt),cs=getComputedStyle(ct);return{tagW:a.width,catW:b.width,tagH:a.height,catH:b.height,badge:tag.querySelectorAll('.capability-badge').length,hidden:tag.hidden,disabled:tt.disabled||tag.getAttribute('aria-disabled')==='true',affordance:tag.classList.contains('capability-affordance')||tag.classList.contains('capability-affordance--control'),tagGrid:ts.gridTemplateColumns,catGrid:cs.gridTemplateColumns,value:tt.querySelector('.ui-select__value')?.textContent};});
  assert(g&&g.value==='全部标签'&&!g.hidden&&g.badge===0&&!g.disabled&&!g.affordance,`${label}: supported Tags must use the plain canonical Select ${JSON.stringify(g)}`);
  assert(Math.abs(g.tagW-g.catW)<=1&&Math.abs(g.tagH-g.catH)<=1&&g.tagGrid===g.catGrid,`${label}: supported Tags geometry must match Category ${JSON.stringify(g)}`);
}
async function assertOnlyHeaderHints(page,label){const g=await page.evaluate(()=>({header:Array.from(document.querySelectorAll('[data-header-tooltip]')).map(n=>n.id).sort(),titles:document.querySelectorAll('[title]').length,legacy:document.querySelectorAll('[data-tooltip]').length}));assert(g.header.length===4&&g.header.includes('theme-utility-btn')&&g.header.includes('github-link')&&g.header.includes('blog-link')&&g.header.includes('logout-btn'),`${label}: exactly four Header Tooltip opt-ins are required ${JSON.stringify(g)}`);assert(g.titles===0&&g.legacy===0,`${label}: native title/data-tooltip metadata must be scrubbed ${JSON.stringify(g)}`);}

const browser=await launchBrowser();
let context=null;
try{
  fixtureMode='q4';
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});
  let page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});await waitReady(page);
  assert(await page.evaluate(()=>window.WeiG.ReleaseProfile.current().qbVersion)==='4.1.0','qB4 browser fixture must bind exact 4.1.0 release profile');
  assert(await page.evaluate(()=>window.WeiG.CapabilityRegistry.supports('tags'))===false,'qB4.1.0 must not expose Tags');
  await assertHiddenCapability(page,'[data-facet="tag"]','qB4 Tags');await assertHiddenCapability(page,'[data-filter="stalled"]','qB4 Stalled');await assertHiddenCapability(page,'[data-filter="private"]','qB4 Private/PT');
  const q4Filters=await page.locator('#filter-nav [data-filter]').evaluateAll(nodes=>nodes.map(n=>n.dataset.filter));
  assert(q4Filters.includes('stopped')&&q4Filters.includes('running')&&!q4Filters.includes('stalled')&&!q4Filters.includes('private'),`qB4 filter view must expose only source-derived canonical filters ${JSON.stringify(q4Filters)}`);
  await assertOnlyHeaderHints(page,'Home qB4');
  await page.setViewportSize({width:390,height:844});await page.locator('#menu-btn').click();await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));await assertHiddenCapability(page,'[data-facet="tag"]','Mobile qB4 Tags');await assertHiddenCapability(page,'[data-filter="stalled"]','Mobile qB4 Stalled');await assertHiddenCapability(page,'[data-filter="private"]','Mobile qB4 Private/PT');
  assert(errors.length===0,`qB4 browser errors: ${errors.join(' | ')}`);await context.close();context=null;

  fixtureMode='q5';
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});page=await context.newPage();errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});await waitReady(page);
  await page.waitForFunction(()=>window.WeiG?.CapabilityRegistry?.supports('tags')===true&&document.querySelector('[data-facet="tag"]')?.hidden===false);
  await assertSupportedTags(page,'Desktop qB5 Tags');
  const q5Filters=await page.locator('#filter-nav [data-filter]').evaluateAll(nodes=>nodes.map(n=>n.dataset.filter));
  assert(q5Filters.includes('stalled')&&q5Filters.includes('private')&&q5Filters.includes('stopped')&&q5Filters.includes('running'),`qB5 filter view must expose supported source-derived filters ${JSON.stringify(q5Filters)}`);
  assert(await page.evaluate(()=>window.WeiG.CapabilityRegistry.supports('privateFilter'))===true,'qB5 exact profile must expose authoritative Private filter');await assertOnlyHeaderHints(page,'Home qB5');
  assert(errors.length===0,`qB5 browser errors: ${errors.join(' | ')}`);
  console.log('Sidebar capability browser gate passed: qB 4.1.0 hides unsupported Tags/Stalled/Private, qB5 exposes source-derived capabilities with canonical geometry, and Desktop/Mobile consume one filter state.');
}finally{if(context)await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}

import {launchBrowser,readWebuiStatic} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../webui/private');
const publicRoot=path.resolve(here,'../webui/public');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const host='127.0.0.1',port=8781;
let fixtureMode='q4';
const torrent={hash:'0000000000000000000000000000000000000001',name:'Sidebar capability visual fixture',size:1048576,progress:.5,dlspeed:1024,upspeed:0,eta:600,state:'downloading',ratio:.1,tracker:'https://tracker.example/announce',category:'',tags:'Fixture',added_on:1000,save_path:'/downloads',private:false,num_seeds:4,num_leechs:2,priority:1};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function nativeQbtSource(value){return String(value||'').replace(/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/g,(_all,source)=>source);}
function versions(){return fixtureMode==='q5'?{qb:'v5.2.0',api:'2.15.1'}:{qb:'v4.1.0',api:'2.0.0'};}
function releaseCatalog(){
  const q4={qbVersion:'4.1.0',webApiVersion:'2.0.0',officialWeiGSupport:true,fallback:false,apiActions:['appcontroller.h:preferencesAction','torrentscontroller.h:resumeAction','torrentscontroller.h:pauseAction','torrentscontroller.h:webseedsAction'],torrentFilters:['all','downloading','seeding','completed','paused','resumed','active','inactive','errored'],torrentInfoParameters:['filter','category','sort','reverse','limit','offset'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','tracker','save_path'],torrentStates:['error','missingFiles','uploading','pausedUP','queuedUP','stalledUP','checkingUP','forcedUP','allocating','downloading','metaDL','pausedDL','queuedDL','stalledDL','checkingDL','forcedDL','checkingResumeData'],preferenceDescriptors:[]};
  const q5={qbVersion:'5.2.0',webApiVersion:'2.15.1',officialWeiGSupport:true,fallback:false,apiActions:['appcontroller.h:preferencesAction','torrentscontroller.h:categoriesAction','torrentscontroller.h:tagsAction','torrentscontroller.h:startAction','torrentscontroller.h:stopAction','torrentscontroller.h:webseedsAction'],torrentFilters:['all','downloading','seeding','completed','stopped','running','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored'],torrentInfoParameters:['filter','category','tag','sort','reverse','limit','offset','hashes','private'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','tracker','save_path','private'],torrentStates:['error','missingFiles','uploading','stoppedUP','queuedUP','stalledUP','checkingUP','forcedUP','allocating','downloading','metaDL','stoppedDL','queuedDL','stalledDL','checkingDL','forcedDL','checkingResumeData','moving'],preferenceDescriptors:[]};
  return[q4,q5];
}
function json(res,value,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function text(res,value,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
function empty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
function api(req,res,p,url){
  const v=versions();
  if(p==='app/version')return text(res,v.qb);
  if(p==='app/webapiVersion')return text(res,v.api);
  if(p==='app/preferences')return json(res,{locale:'zh_CN',save_path:'/downloads',alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui'});
  if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:1024,up_info_speed:0,connection_status:'firewalled'});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata'){const syncTorrents=fixtureMode==='q5'?{[torrent.hash]:{trackers_count:1,has_tracker_error:false,has_other_announce_error:false,has_tracker_warning:false}}:{};const trackers=fixtureMode==='q5'?{'https://tracker.example/announce':[torrent.hash]}:{};return json(res,{rid:1,full_update:true,torrents:syncTorrents,trackers:trackers,categories:{},tags:['Fixture'],server_state:{connection_status:'firewalled',dht_nodes:8,total_peer_connections:2,free_space_on_disk:10737418240}});}
  if(p==='torrents/info'){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||0),row={...torrent};if(fixtureMode==='q4')delete row.private;else row.private=true;const rows=[row];return json(res,limit?rows.slice(offset,offset+limit):rows.slice(offset));}
  if(p==='torrents/categories')return json(res,{});
  if(p==='torrents/tags')return json(res,['Fixture']);
  if(['search/plugins','log/main','log/peers','rss/items'].includes(p))return json(res,p==='rss/items'?{}:[]);
  if(req.method==='POST')return empty(res);
  return json(res,{});
}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\//,'');if(rel.startsWith('api/v2/'))return api(req,res,rel.slice(7),url);if(rel==='data/qb-releases.json')return json(res,releaseCatalog());if(rel==='data/qb-settings-native.txt'){const asset=await readWebuiStatic([root,publicRoot],rel);return text(res,nativeQbtSource(asset.body));}if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'sidebar-capability-visual',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});const requested=rel||'index.html',{file,body}=await readWebuiStatic([root,publicRoot],requested);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function waitReady(page){await page.waitForSelector('#logout-btn');await page.waitForFunction(()=>window.WeiG?.CapabilityRegistry?.releaseIdentity()?.qbVersion&&window.WeiG?.AppState?.client?.qbVersion&&window.WeiG.AppState.client.qbVersion!=='0.0.0'&&window.WeiG?.AppState?.catalogReady===true);const copy=await page.evaluate(async()=>{await window.WeiG?.I18n?.loadQbOwnedText?.();return window.WeiG?.I18n?.qbOwnedText?.()||{};});assert(Object.prototype.hasOwnProperty.call(copy,'sidebar.status'),'exact qB-owned Status surface copy must resolve before sidebar fidelity assertions');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForFunction(()=>document.querySelectorAll('[title],[data-tooltip]').length===0,{timeout:5000});}
async function assertPrivateTrackerOwnership(page,supported,label){
  const options=await page.evaluate(()=>window.WeiG.LibraryController.facetOptions('tracker'));
  const privateOptions=options.filter(x=>x.value==='__weig_private__');
  if(supported){const privateIndex=options.findIndex(x=>x.value==='__weig_private__');assert(options[0]?.value===''&&privateOptions.length===1&&privateIndex>0&&privateOptions[0]?.label==='Private / PT',`${label}: source-proven Private / PT must remain a single Tracker extension without displacing native Tracker specials ${JSON.stringify(options)}`);}
  else assert(privateOptions.length===0,`${label}: source-unproven Private / PT must be absent from Tracker facet ${JSON.stringify(options)}`);
}
async function assertSupportedTags(page,label){
  const g=await page.evaluate(()=>{const tag=document.querySelector('[data-facet="tag"]'),category=document.querySelector('[data-facet="category"]'),tt=tag?.querySelector('.ui-select__trigger'),ct=category?.querySelector('.ui-select__trigger'),select=tag?.querySelector('.ui-select'),options=window.WeiG?.LibraryController?.facetOptions?.('tag')||[];if(!tag||!category||!tt||!ct||!select)return null;const a=tt.getBoundingClientRect(),b=ct.getBoundingClientRect(),expectedPrefix=window.WeiG?.I18n?.qbText?.('sidebar.tags','Tags')||'Tags';return{tagW:a.width,catW:b.width,tagH:a.height,catH:b.height,badge:tag.querySelectorAll('.capability-badge').length,hidden:tag.hidden,disabled:tt.disabled||tag.getAttribute('aria-disabled')==='true',affordance:tag.classList.contains('capability-affordance')||tag.classList.contains('capability-affordance--control'),prefix:tt.querySelector('.ui-select__prefix')?.textContent,expectedPrefix,selected:select.getValue?.(),allOption:options[0]?.label};});
  assert(g&&g.prefix===g.expectedPrefix&&g.selected===''&&String(g.allOption||'').startsWith('全部')&&!g.hidden&&g.badge===0&&!g.disabled&&!g.affordance,`${label}: supported native Tags must use the plain prefix-trigger canonical Select with source-owned All retained as the menu value ${JSON.stringify(g)}`);
  assert(Math.abs(g.tagW-g.catW)<=1&&Math.abs(g.tagH-g.catH)<=1,`${label}: supported Tags outer geometry must match Category ${JSON.stringify(g)}`);
}
async function assertNativeFacetVisibility(page,expected,label){const got=await page.evaluate(()=>Object.fromEntries(['category','tag','tracker','savePath'].map(kind=>{const node=document.querySelector('[data-facet="'+kind+'"]');return[kind,!!node&&!node.hidden];})));for(const [kind,value] of Object.entries(expected))assert(got[kind]===value,`${label}: ${kind} native surface visibility drifted ${JSON.stringify(got)}`);}
async function assertSourceSpecialRows(page,label){const got=await page.evaluate(()=>({category:window.WeiG.LibraryController.facetOptions('category'),tag:window.WeiG.LibraryController.facetOptions('tag'),tracker:window.WeiG.LibraryController.facetOptions('tracker')}));assert(got.category.some(x=>x.value==='__weig_uncategorized__'),`${label}: native Uncategorized row missing ${JSON.stringify(got.category)}`);const untagged=got.tag.find(x=>x.value==='__weig_untagged__');assert(untagged&&/\(0\)$/.test(untagged.label),`${label}: zero-count native Untagged row missing ${JSON.stringify(got.tag)}`);for(const value of ['special:trackerless','special:tracker-error','special:other-error','special:warning']){const row=got.tracker.find(x=>x.value===value);assert(row&&/\(0\)$/.test(row.label),`${label}: zero-count native Tracker special row missing for ${value}: ${JSON.stringify(got.tracker)}`);}}
async function assertOnlyHeaderHints(page,label){const g=await page.evaluate(()=>({header:Array.from(document.querySelectorAll('[data-header-tooltip]')).map(n=>n.id).sort(),titles:document.querySelectorAll('[title]').length,legacy:document.querySelectorAll('[data-tooltip]').length}));assert(g.header.length===4&&g.header.includes('theme-utility-btn')&&g.header.includes('github-link')&&g.header.includes('blog-link')&&g.header.includes('logout-btn'),`${label}: exactly four Header Tooltip opt-ins are required ${JSON.stringify(g)}`);assert(g.titles===0&&g.legacy===0,`${label}: native title/data-tooltip metadata must be scrubbed ${JSON.stringify(g)}`);}

const browser=await launchBrowser();
let context=null;
try{
  fixtureMode='q4';
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});
  let page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});await waitReady(page);
  assert(await page.evaluate(()=>window.WeiG.CapabilityRegistry.releaseIdentity().qbVersion)==='4.1.0','qB4 browser fixture must bind exact 4.1.0 release profile');
  assert(await page.evaluate(()=>window.WeiG.CapabilityRegistry.supports('tags'))===false,'qB4.1.0 must not claim the native Tags taxonomy API');
  assert(await page.evaluate(()=>window.WeiG.CapabilityRegistry.supports('tagFacet'))===true,'qB4.1.0 may expose a locally usable tags field without owning a native Tags sidebar surface');
  await assertNativeFacetVisibility(page,{category:true,tag:false,tracker:false,savePath:true},'Desktop qB4');await assertPrivateTrackerOwnership(page,false,'Desktop qB4 Private/PT');
  const q4Filters=await page.locator('#filter-nav [data-filter]').evaluateAll(nodes=>nodes.map(n=>n.dataset.filter));
  assert(JSON.stringify(q4Filters)===JSON.stringify(['all','downloading','seeding','completed','stopped','running','active','inactive','errored']),`qB4 filter view must expose only the exact native source inventory, canonicalizing paused/resumed internally without inventing derived rows ${JSON.stringify(q4Filters)}`);
  await assertOnlyHeaderHints(page,'Home qB4');
  await page.setViewportSize({width:390,height:844});await page.locator('#menu-btn').click();await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));await assertNativeFacetVisibility(page,{category:true,tag:false,tracker:false,savePath:true},'Mobile qB4');await assertPrivateTrackerOwnership(page,false,'Mobile qB4 Private/PT');
  assert(errors.length===0,`qB4 browser errors: ${errors.join(' | ')}`);await context.close();context=null;

  fixtureMode='q5';
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});page=await context.newPage();errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});await waitReady(page);
  await page.waitForFunction(()=>window.WeiG?.CapabilityRegistry?.supports('tags')===true&&document.querySelector('[data-facet="tag"]')?.hidden===false);
  await assertNativeFacetVisibility(page,{category:true,tag:true,tracker:true,savePath:true},'Desktop qB5');await assertSupportedTags(page,'Desktop qB5 Tags');await assertPrivateTrackerOwnership(page,true,'Desktop qB5 Private/PT');await assertSourceSpecialRows(page,'Desktop qB5');
  const q5Filters=await page.locator('#filter-nav [data-filter]').evaluateAll(nodes=>nodes.map(n=>n.dataset.filter));
  assert(JSON.stringify(q5Filters)===JSON.stringify(['all','downloading','seeding','completed','stopped','running','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored'])&&!q5Filters.includes('private'),`qB5 status filter view must equal the exact native source inventory while keeping Private / PT in Tracker ${JSON.stringify(q5Filters)}`);
  assert(await page.evaluate(()=>window.WeiG.CapabilityRegistry.supports('privateFilter'))===true,'qB5 exact profile must expose authoritative Private metadata for the Tracker facet');await assertOnlyHeaderHints(page,'Home qB5');
  assert(errors.length===0,`qB5 browser errors: ${errors.join(' | ')}`);
  console.log('Sidebar native-fidelity browser gate passed: qB4.1 hides source-absent Tags/Trackers and derived statuses, while qB5 preserves source-owned special rows even at zero count.');
}finally{if(context)await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}

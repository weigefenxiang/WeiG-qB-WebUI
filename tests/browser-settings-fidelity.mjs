import {launchBrowser} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const privateRoot=path.resolve(here,'../webui/private');
const publicRoot=path.resolve(here,'../webui/public');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const frozenCatalog=JSON.parse(await fs.readFile(path.resolve(here,'fixtures/qb-release-catalog.lkg.json'),'utf8'));
const exactProfile=frozenCatalog.find(item=>String(item&&item.qbVersion||'')==='5.2.3');
if(!exactProfile||!exactProfile.webApiVersion)throw new Error('Settings fidelity browser gate requires frozen exact qB 5.2.3 with WebAPI identity.');

const host='127.0.0.1',port=8783;
const basePrefs={
  locale:'en',save_path:'/downloads',temp_path:'/downloads/incomplete',temp_path_enabled:true,export_dir:'/watch',export_dir_fin:'/watch/finished',banned_IPs:'192.0.2.10',
  preallocate_all:false,create_subfolder_enabled:true,start_paused_enabled:false,auto_tmm_enabled:false,torrent_content_layout:'Original',
  listen_port:6881,upnp:false,random_port:false,max_connec:500,max_connec_per_torrent:100,max_uploads:20,max_uploads_per_torrent:4,
  i2p_enabled:false,i2p_address:'127.0.0.1',i2p_port:7656,i2p_mixed_mode:false,
  proxy_type:'None',proxy_ip:'127.0.0.1',proxy_port:8080,proxy_auth_enabled:false,proxy_username:'',proxy_password:'',proxy_hostname_lookup:false,proxy_bittorrent:false,proxy_peer_connections:false,proxy_rss:false,proxy_misc:false,
  dl_limit:1048576,up_limit:524288,alt_dl_limit:262144,alt_up_limit:131072,scheduler_enabled:false,schedule_from_hour:8,schedule_from_min:30,schedule_to_hour:20,schedule_to_min:15,scheduler_days:0,
  limit_utp_rate:true,limit_tcp_overhead:false,limit_lan_peers:false,dht:true,pex:true,lsd:true,encryption:0,queueing_enabled:true,max_active_downloads:5,max_active_uploads:5,max_active_torrents:10,max_ratio:2,max_ratio_enabled:false,max_seeding_time:1440,max_seeding_time_enabled:false,
  web_ui_domain_list:'*',web_ui_address:'*',web_ui_port:8080,web_ui_upnp:false,web_ui_username:'admin',web_ui_csrf_protection_enabled:true,web_ui_clickjacking_protection_enabled:true,web_ui_host_header_validation_enabled:true,web_ui_localhost_auth_enabled:false,web_ui_max_auth_fail_count:5,web_ui_ban_duration:3600,alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',
  socket_receive_buffer_size:0,torrent_file_size_limit:104857600,upload_choking_algorithm:1,send_buffer_watermark:512,send_buffer_watermark_factor:50,checking_memory_use:32,refresh_interval:1500,web_ui_http3_enabled:true,
  file_log_enabled:false
};
const variants={
  en:{prefs:{...basePrefs},writes:[],preferenceReads:0},
  zh:{prefs:{...basePrefs,locale:'zh_CN'},writes:[],preferenceReads:0}
};
const torrent={hash:'1'.repeat(40),name:'Settings Fidelity Fixture',size:1048576,progress:.4,dlspeed:1000,upspeed:200,eta:3600,state:'downloading',ratio:.2,tracker:'https://tracker.example/announce',category:'fixture',added_on:1000,save_path:'/downloads'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8'};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,value,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function text(res,value,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));}
function empty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
async function body(req){let value='';for await(const chunk of req)value+=chunk;return value;}
async function api(req,res,variant,apiPath,url){
  if(apiPath==='app/version')return text(res,'v'+exactProfile.qbVersion);
  if(apiPath==='app/webapiVersion')return text(res,exactProfile.webApiVersion);
  if(apiPath==='app/preferences'&&req.method==='GET'){variant.preferenceReads++;return json(res,variant.prefs);}
  if(apiPath==='app/setPreferences'&&req.method==='POST'){
    const form=new URLSearchParams(await body(req)),raw=form.get('json');
    assert(raw!==null,'app/setPreferences did not receive json form field');
    const patch=JSON.parse(raw);Object.assign(variant.prefs,patch);variant.writes.push(patch);return empty(res);
  }
  if(apiPath==='app/buildInfo')return json(res,{});
  if(apiPath==='transfer/info')return json(res,{dl_info_speed:12345,up_info_speed:6789,connection_status:'connected',dht_nodes:12,total_peer_connections:4});
  if(apiPath==='transfer/speedLimitsMode'||apiPath==='transfer/downloadLimit'||apiPath==='transfer/uploadLimit')return text(res,'0');
  if(apiPath==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dl_info_speed:12345,up_info_speed:6789,dht_nodes:12,total_peer_connections:4,free_space_on_disk:10737418240}});
  if(apiPath==='torrents/info'){const hashes=url.searchParams.get('hashes');return json(res,!hashes||hashes.includes(torrent.hash)?[torrent]:[]);}
  if(apiPath==='torrents/properties')return json(res,{save_path:'/downloads',total_size:1048576,total_downloaded:400000,total_uploaded:100000,share_ratio:.2,nb_connections:4,seeds:2,peers:3,addition_date:1000,completion_date:-1,created_by:'fixture',pieces_num:20,piece_size:65536});
  if(['torrents/files','torrents/trackers','torrents/webseeds','search/plugins','log/main','log/peers'].includes(apiPath))return json(res,[]);
  if(apiPath==='sync/torrentPeers')return json(res,{peers:{}});
  if(apiPath==='torrents/categories')return json(res,{});
  if(apiPath==='torrents/tags')return json(res,[]);
  if(apiPath==='rss/items')return json(res,{});
  if(req.method==='POST')return empty(res);
  return json(res,{});
}
const server=http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://'+host+':'+port),match=url.pathname.match(/^\/(en|zh)(?:\/(.*))?$/);
  if(!match){res.writeHead(404);return res.end('not found');}
  const variant=variants[match[1]],rel=match[2]||'';
  if(rel.startsWith('api/v2/'))return await api(req,res,variant,rel.slice(7),url);
  if(rel==='data/qb-releases.json')return json(res,[exactProfile]);
  if(rel==='views/preferences.html')return text(res,'<!doctype html><select id="localeSelect"><option value="en">English</option><option value="zh_CN">简体中文</option></select>');
  if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'settings-fidelity-fixture',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});
  const root=privateRoot,requested=rel||'index.html',file=path.resolve(root,requested);
  if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403);return res.end('forbidden');}
  const payload=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(payload);
}catch(error){res.writeHead(error&&error.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error&&error.stack||error));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function openSettings(page){await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>location.hash.includes('settings'));await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]');}
async function selectTab(page,tab){await page.locator('#settings-tabs [data-settings-tab="'+tab+'"]').click();await page.waitForFunction(value=>document.querySelector('#settings-tabs [data-settings-tab="'+value+'"]')?.classList.contains('is-active'),tab);await page.waitForFunction(value=>window.WeiG&&WeiG.SettingsState&&WeiG.SettingsState.tab===value,tab);}
async function choose(page,root,value){const trigger=page.locator(root+' .ui-select__trigger');await trigger.click();const option=page.locator('#weigg-floating-layer .ui-select__option[data-value="'+String(value).replaceAll('"','\\"')+'"]');await option.waitFor();await option.click();}
async function rerender(page,tab){await page.evaluate(async value=>{WeiG.SettingsState.draft={};WeiG.SettingsState.auxDraft={};await WeiG.SettingsRenderer.open(value);},tab);await page.waitForFunction(value=>WeiG.SettingsState.tab===value&&document.querySelector('#settings-tabs [data-settings-tab="'+value+'"]')?.classList.contains('is-active'),tab);}
async function setPrefs(page,patch,tab){await page.evaluate(async({patch,tab})=>{Object.assign(WeiG.SettingsState.prefs,patch);if(WeiG.AppState)WeiG.AppState.preferences=WeiG.SettingsState.prefs;WeiG.SettingsState.draft={};WeiG.SettingsState.auxDraft={};await WeiG.SettingsRenderer.open(tab);},{patch,tab});}
async function seedAllPrefs(page){return page.evaluate(async()=>{
  const S=WeiG.SettingsSchema,state=WeiG.SettingsState,prefs={...(state.prefs||{})},own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
  const controls=[];
  for(const tab of S.nativeSurfaces()){
    const graph=S.controlGraph(tab);if(!graph)continue;
    for(const field of graph.fieldsets||[])controls.push(...(field.legendControls||[]));
    for(const row of graph.rows||[])for(const item of row.items||[])if(item&&item.kind==='control')controls.push(item);
  }
  for(const item of controls){const key=item&&item.preferenceKey;if(!key||own(prefs,key))continue;const source=S.sourcePreference(key)||{},type=String(source.descriptor&&source.descriptor.readType||source.descriptor&&source.descriptor.writeType||'').toLowerCase(),semantic=String(source.semantic||item.semantic||'').toLowerCase(),attrs=source.attributes||{};let value='';if(Array.isArray(source.options)&&source.options.length)value=source.options[0].value;else if(type.includes('bool')||semantic.includes('check')||semantic.includes('switch'))value=false;else if(type.includes('int')||type.includes('double')||type.includes('float')||type.includes('number')||semantic.includes('spin')||semantic.includes('number')){const min=Number(attrs.min);value=Number.isFinite(min)?min:0;}prefs[key]=value;}
  state.prefs=prefs;if(WeiG.AppState)WeiG.AppState.preferences=prefs;state.draft={};state.auxDraft={};await WeiG.SettingsRenderer.open(state.tab);return{tabs:S.nativeSurfaces(),keys:Object.keys(prefs).length};
});}
function sorted(values){return [...values].sort((a,b)=>String(a).localeCompare(String(b)));}
async function auditTab(page,tab){const result=await page.evaluate(value=>{
  const S=WeiG.SettingsSchema,prefs=WeiG.SettingsState.prefs||{},state=Object.assign({},prefs,WeiG.SettingsState.draft||{}),graph=S.controlGraph(value),own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
  if(!graph)return{error:'missing graph'};
  const helperTarget=item=>item&&item.action&&item.action.targetControlId&&S.preferenceKeyForControl?S.preferenceKeyForControl(item.action.targetControlId):null;
  const relevant=item=>{if(!item)return false;if(item.kind==='content')return true;if(item.kind==='helper'){const key=helperTarget(item);return !!(key&&own(prefs,key));}if(item.preferenceKey)return own(prefs,item.preferenceKey);if(item.kind==='control'&&S.gateForControl){const gate=S.gateForControl(item.id,state);return !!(gate&&own(prefs,gate.key));}return false;};
  const expectedRows=(graph.rows||[]).filter(row=>(row.items||[]).some(relevant)).map(row=>row.id).filter(Boolean);
  const rowByField=new Map();for(const row of graph.rows||[]){if((row.items||[]).some(relevant)){const key=row.parentFieldsetId||'';if(!rowByField.has(key))rowByField.set(key,[]);rowByField.get(key).push(row.id);}}
  const fieldMemo=new Map(),fieldsets=graph.fieldsets||[];
  const fieldRelevant=field=>{if(fieldMemo.has(field.id))return fieldMemo.get(field.id);const direct=(field.legendControls||[]).some(item=>relevant(Object.assign({kind:'control'},item)))||(rowByField.get(field.id)||[]).length>0;const child=fieldsets.some(candidate=>candidate.parentId===field.id&&fieldRelevant(candidate));const yes=direct||child;fieldMemo.set(field.id,yes);return yes;};
  const expectedFieldsets=fieldsets.filter(fieldRelevant).map(field=>field.id).filter(Boolean);
  const expectedControls=[];for(const field of fieldsets)for(const item of field.legendControls||[])if(relevant(Object.assign({kind:'control'},item))&&item.id)expectedControls.push(item.id);for(const row of graph.rows||[])for(const item of row.items||[])if(item.kind==='control'&&relevant(item)&&item.id)expectedControls.push(item.id);
  const expectedHelpers=[];for(const row of graph.rows||[])for(const item of row.items||[])if(item.kind==='helper'&&relevant(item)&&item.id)expectedHelpers.push(item.id);
  const actualRows=[...document.querySelectorAll('#settings-content [data-native-row]')].map(node=>node.dataset.nativeRow).filter(Boolean);
  const actualFieldsets=[...document.querySelectorAll('#settings-content [data-native-fieldset]')].map(node=>node.dataset.nativeFieldset).filter(Boolean);
  const actualControls=[...document.querySelectorAll('#settings-content [data-native-control]')].map(node=>node.dataset.nativeControl).filter(Boolean);
  const actualHelpers=[...document.querySelectorAll('#settings-content [data-native-helper]')].map(node=>node.dataset.nativeHelper).filter(Boolean);
  const titles=[...document.querySelectorAll('#settings-content [data-native-fieldset-title]')].map(node=>String(node.dataset.nativeFieldsetTitle||'').trim());
  const content=[...document.querySelectorAll('#settings-content .setting-source-content')].map(node=>String(node.textContent||'').trim());
  const duplicates=values=>values.filter((value,index)=>values.indexOf(value)!==index);
  return{expectedRows,expectedFieldsets,expectedControls,expectedHelpers,actualRows,actualFieldsets,actualControls,actualHelpers,titles,content,duplicateControls:duplicates(actualControls),duplicateHelpers:duplicates(actualHelpers),empty:document.querySelectorAll('#settings-content .settings-empty').length};
},tab);
  assert(!result.error,tab+': '+result.error);
  assert(JSON.stringify(sorted(result.actualRows))===JSON.stringify(sorted(result.expectedRows)),tab+': native row coverage drifted\nexpected='+JSON.stringify(sorted(result.expectedRows))+'\nactual='+JSON.stringify(sorted(result.actualRows)));
  assert(JSON.stringify(sorted(result.actualFieldsets))===JSON.stringify(sorted(result.expectedFieldsets)),tab+': native fieldset coverage drifted');
  assert(JSON.stringify(sorted(result.actualControls))===JSON.stringify(sorted(result.expectedControls)),tab+': native control coverage drifted');
  assert(JSON.stringify(sorted(result.actualHelpers))===JSON.stringify(sorted(result.expectedHelpers)),tab+': native helper coverage drifted');
  assert(result.duplicateControls.length===0,tab+': duplicate native controls '+result.duplicateControls.join(','));
  assert(result.duplicateHelpers.length===0,tab+': duplicate native helpers '+result.duplicateHelpers.join(','));
  assert(result.titles.every(Boolean),tab+': source fieldset title rendered blank');
  assert(result.content.every(Boolean),tab+': source note/list/hint rendered blank');
  assert(result.empty===0,tab+': source graph unexpectedly collapsed to an empty placeholder');
  return result;
}
async function assertInlineCluster(page,key,label){const geometry=await page.evaluate(pref=>{const control=document.querySelector('[data-preference-key="'+pref+'"]'),row=control&&control.closest('[data-native-row]');if(!row)return null;const nodes=[...row.querySelectorAll('.setting-inline-controls > *, .setting-control-slot--compound > *')].filter(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';});const tops=nodes.map(node=>node.getBoundingClientRect().top);return{count:nodes.length,delta:tops.length?Math.max(...tops)-Math.min(...tops):0,span:row.dataset.settingSpan||''};},key);assert(geometry&&geometry.count>=2,label+': expected a compact source row with multiple inline controls');assert(geometry.delta<=8,label+': controls wrapped vertically instead of remaining inline: '+JSON.stringify(geometry));}
async function graphFacts(page,tab){return page.evaluate(value=>{const S=WeiG.SettingsSchema,g=S.controlGraph(value),out={controls:[],helpers:[],content:[],fieldsets:[]};if(!g)return out;for(const f of g.fieldsets||[]){out.fieldsets.push({id:f.id,parentId:f.parentId,title:f.title&&f.title.source||'',legend:(f.legendControls||[]).map(x=>({id:x.id,key:x.preferenceKey,label:x.label&&x.label.source||'',condition:x.condition||null}))});}for(const r of g.rows||[])for(const i of r.items||[]){if(i.kind==='control')out.controls.push({row:r.id,id:i.id,key:i.preferenceKey,label:i.label&&i.label.source||'',adornment:i.adornment&&i.adornment.source||'',suffix:i.suffix&&i.suffix.source||'',condition:i.condition||null});else if(i.kind==='helper')out.helpers.push({row:r.id,id:i.id,label:i.label&&i.label.source||'',action:i.action||null,condition:i.condition||null});else if(i.kind==='content')out.content.push({row:r.id,id:i.id,kind:i.contentKind,label:i.label&&i.label.source||'',items:(i.items||[]).map(x=>x&&x.source||'')});}return out;},tab);}

const browser=await launchBrowser();
try{
  variants.en.prefs={...basePrefs};variants.en.writes=[];variants.en.preferenceReads=0;
  const context=await browser.newContext({viewport:{width:1366,height:900},locale:'en-US'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(message.text()))errors.push(message.text());});
  await page.goto('http://'+host+':'+port+'/en/#/',{waitUntil:'networkidle'});await page.waitForSelector('#torrent-list');await openSettings(page);
  const seeded=await seedAllPrefs(page);assert(seeded.tabs.length>=8,'Expected the full native qB Options tab set, got '+JSON.stringify(seeded.tabs));
  const domTabs=await page.locator('#settings-qb-tabs [data-settings-tab]').evaluateAll(nodes=>nodes.map(node=>node.dataset.settingsTab));assert(JSON.stringify(domTabs)===JSON.stringify(seeded.tabs),'Rendered qB tab order diverged from SettingsSchema.nativeSurfaces()');
  const allAudit={};for(const tab of seeded.tabs){await selectTab(page,tab);allAudit[tab]=await auditTab(page,tab);}
  for(const required of ['behavior','downloads','connection','speed','bittorrent','rss','webui','advanced'])assert(seeded.tabs.includes(required),'Native Options audit lost required tab '+required);

  await setPrefs(page,{file_log_enabled:false},'behavior');await selectTab(page,'behavior');
  const behaviorFacts=await graphFacts(page,'behavior');
  assert(behaviorFacts.fieldsets.filter(x=>x.parentId).length>=2,'Behavior: expected nested source fieldsets for file-log sub-gates');
  const backupDelete=behaviorFacts.fieldsets.filter(x=>/backup|delete/i.test(x.title));assert(backupDelete.length>=2,'Behavior: source graph lost nested backup/delete fieldsets: '+JSON.stringify(behaviorFacts.fieldsets));
  const logMaster=page.locator('[data-preference-key="file_log_enabled"] input[type="checkbox"]');assert(await logMaster.count()===1,'Behavior: file_log_enabled master switch missing');assert(!await logMaster.isChecked(),'Behavior: file log fixture must start disabled');
  const nestedGateIds=backupDelete.flatMap(x=>x.legend.map(y=>y.id)).filter(Boolean);assert(nestedGateIds.length>=2,'Behavior: backup/delete nested gates are missing');
  for(const id of nestedGateIds){const input=page.locator('[data-native-control="'+id+'"] input');assert(await input.count()===1,'Behavior: nested gate '+id+' missing from DOM');assert(await input.isDisabled(),'Behavior: nested gate '+id+' must be disabled while file logging is off');}
  await logMaster.click();await page.waitForFunction(()=>WeiG.SettingsState.draft.file_log_enabled===true);for(const id of nestedGateIds)assert(!await page.locator('[data-native-control="'+id+'"] input').isDisabled(),'Behavior: nested gate '+id+' did not unlock after file log master enabled');

  await setPrefs(page,{temp_path_enabled:false,temp_path:'/downloads/incomplete',export_dir:'/watch',export_dir_fin:'/watch/finished'},'downloads');await selectTab(page,'downloads');
  const downloadFacts=await graphFacts(page,'downloads'),selectKeys=downloadFacts.controls.filter(item=>item.key).map(item=>item.key).filter((key,index,values)=>values.indexOf(key)===index);
  const contentLayout=page.locator('[data-preference-key="torrent_content_layout"] .ui-select__trigger');assert(await contentLayout.count()===1,'Downloads: torrent_content_layout must render as canonical Select');
  const stopKey=await page.evaluate(()=>{const S=WeiG.SettingsSchema;for(const key of S.keysFor('downloads',WeiG.SettingsState.prefs)){const p=S.sourcePreference(key),title=String(p&&p.title&&p.title.source||'');if(/stop.*condition|condition.*stop/i.test(key+' '+title))return key;}return null;});
  assert(stopKey,'Downloads: source-derived torrent stop-condition preference is missing');assert(await page.locator('[data-preference-key="'+stopKey+'"] .ui-select__trigger').count()===1,'Downloads: stop-condition must render as canonical Select');
  assert(selectKeys.includes('torrent_content_layout')&&selectKeys.includes(stopKey),'Downloads: content-layout/stop-condition controls fell out of exact graph');
  const tempValue=page.locator('[data-preference-key="temp_path"] input');const tempGate=page.locator('[data-preference-key="temp_path_enabled"] input[type="checkbox"]');assert(await tempGate.count()===1&&await tempValue.count()===1,'Downloads: temporary path gate/value composition missing');assert(await tempValue.isDisabled(),'Downloads: temp path must be disabled when temp_path_enabled=false');await tempGate.click();await page.waitForFunction(()=>WeiG.SettingsState.draft.temp_path_enabled===true);assert(!await page.locator('[data-preference-key="temp_path"] input').isDisabled(),'Downloads: temp path did not unlock');
  for(const key of ['export_dir','export_dir_fin']){const gate=page.locator('[data-projection-gate-for="'+key+'"] input[type="checkbox"]'),value=page.locator('[data-preference-key="'+key+'"] input');assert(await gate.count()===1&&await value.count()===1,'Downloads: '+key+' presence gate/value missing');assert(await gate.isChecked()&&!await value.isDisabled(),'Downloads: '+key+' enabled projection state drifted');await gate.click();await page.waitForFunction(pref=>WeiG.SettingsState.draft[pref]==='',key);assert(await page.locator('[data-preference-key="'+key+'"] input').isDisabled(),'Downloads: '+key+' value did not disable after gate off');await setPrefs(page,{[key]:key==='export_dir'?'/watch':'/watch/finished'},'downloads');}
  const supported=downloadFacts.content.find(item=>/supported parameters/i.test(item.label)||item.items.some(value=>/supported parameters/i.test(value)));assert(supported,'Downloads: external-program Supported parameters source content missing from graph');const downloadsText=await page.locator('#settings-content').innerText();for(const source of [supported.label,...supported.items].filter(Boolean))assert(downloadsText.includes(source),'Downloads: source-owned external-program content missing: '+source);

  await setPrefs(page,{proxy_type:'None',proxy_bittorrent:false,proxy_peer_connections:false,i2p_enabled:true,i2p_address:'127.0.0.1',i2p_port:7656},'connection');await selectTab(page,'connection');
  await assertInlineCluster(page,'listen_port','Connection/Listening Port');await assertInlineCluster(page,'max_connec','Connection/Limits');
  const i2pRows=await page.evaluate(()=>[...document.querySelectorAll('#settings-content [data-native-row]')].filter(row=>[...row.querySelectorAll('[data-preference-key]')].some(node=>String(node.dataset.preferenceKey||'').startsWith('i2p_'))).map(row=>({id:row.dataset.nativeRow,count:row.querySelectorAll('.setting-inline-controls > *, .setting-control-slot--compound > *').length})).filter(x=>x.count>=2));assert(i2pRows.length>=1,'Connection: I2P source controls are no longer compactly grouped');
  const proxyHost=page.locator('[data-preference-key="proxy_ip"] input');assert(await proxyHost.isDisabled(),'Connection: proxy host must be disabled when Type=None');await choose(page,'[data-preference-key="proxy_type"]','SOCKS5');await page.waitForFunction(()=>document.querySelector('[data-preference-key="proxy_ip"] input')?.disabled===false);const bitProxy=page.locator('[data-preference-key="proxy_bittorrent"] input[type="checkbox"]'),peerProxy=page.locator('[data-preference-key="proxy_peer_connections"] input[type="checkbox"]');assert(await bitProxy.count()===1&&await peerProxy.count()===1,'Connection: BitTorrent/peer proxy dependency controls missing');assert(await peerProxy.isDisabled(),'Connection: peer proxy must remain disabled until BitTorrent proxy is enabled');await bitProxy.click();await page.waitForFunction(()=>document.querySelector('[data-preference-key="proxy_peer_connections"] input')?.disabled===false);const auth=page.locator('[data-native-control="peer_proxy_auth_checkbox"] input[type="checkbox"]');assert(await auth.count()===1&&!await auth.isDisabled(),'Connection: SOCKS5 must unlock Authentication');await choose(page,'[data-preference-key="proxy_type"]','SOCKS4');for(const selector of ['[data-native-control="peer_proxy_auth_checkbox"] input','[data-preference-key="proxy_hostname_lookup"] input','[data-preference-key="proxy_rss"] input','[data-preference-key="proxy_misc"] input']){const control=page.locator(selector);if(await control.count())assert(await control.isDisabled(),'Connection: SOCKS4 restriction drifted for '+selector);}
  const banned=page.locator('[data-setting-key="banned_IPs"]');assert(await banned.count()===1,'Connection: banned_IPs source textarea missing');const expand=banned.locator('[data-setting-expand="textarea"]');assert(await expand.count()===1&&!await expand.isDisabled(),'Connection: banned IP canonical expanded editor unavailable');await expand.click();const editor=page.locator('dialog.setting-textarea-dialog[open]');await editor.waitFor();await editor.locator('textarea.setting-textarea-dialog__input').fill('192.0.2.10\n198.51.100.20');await editor.locator('[data-setting-editor-apply]').click();await page.waitForFunction(()=>WeiG.SettingsState.draft.banned_IPs==='192.0.2.10\n198.51.100.20');

  await selectTab(page,'speed');assert(await page.locator('#settings-content .setting-row--content').count()>=1,'Speed: source-owned note/help content missing');const schedule=page.locator('[data-native-template="inline-multi-control"][data-native-row]').filter({has:page.locator('[data-preference-key="schedule_from_hour"]')});assert(await schedule.count()===1,'Speed: Scheduler time cluster missing');assert(await schedule.locator('[data-preference-key="schedule_from_hour"],[data-preference-key="schedule_from_min"],[data-preference-key="schedule_to_hour"],[data-preference-key="schedule_to_min"]').count()===4,'Speed: Scheduler source time cluster incomplete');
  const representative={textarea:0,helper:0,content:0,adornment:0};for(const tab of ['bittorrent','rss','webui','advanced']){await selectTab(page,tab);const facts=await graphFacts(page,tab);representative.textarea+=facts.controls.filter(item=>item.key&&page).length?await page.locator('#settings-content textarea').count():0;representative.helper+=facts.helpers.length;representative.content+=facts.content.length;representative.adornment+=facts.controls.filter(item=>item.adornment||item.suffix).length;await auditTab(page,tab);}assert(representative.textarea>0&&representative.helper>0&&representative.content>0&&representative.adornment>0,'BitTorrent/RSS/Web UI/Advanced representative textarea/action/note/adornment coverage incomplete: '+JSON.stringify(representative));
  await selectTab(page,'advanced');for(const [key,unit] of [['send_buffer_watermark','KiB'],['send_buffer_watermark_factor','%'],['checking_memory_use','MiB'],['refresh_interval','ms']]){const row=page.locator('[data-setting-key="'+key+'"]');assert(await row.count()===1&&String(await row.textContent()).includes(unit),'Advanced: source adornment '+key+' / '+unit+' missing');}

  await setPrefs(page,{save_path:'/downloads'},'downloads');await selectTab(page,'downloads');const savePath=page.locator('[data-preference-key="save_path"] input');assert(await savePath.count()===1&&!await savePath.isDisabled(),'Save verification: save_path is not writable');await savePath.fill('/verified-downloads');await savePath.press('Tab');await page.waitForFunction(()=>WeiG.SettingsState.draft.save_path==='/verified-downloads');const readsBefore=variants.en.preferenceReads,writesBefore=variants.en.writes.length;await page.locator('#save-settings-btn').click();await page.waitForFunction(()=>WeiG.SettingsState.prefs.save_path==='/verified-downloads'&&Object.keys(WeiG.SettingsState.draft||{}).length===0);assert(variants.en.writes.length===writesBefore+1,'Save verification: app/setPreferences was not called exactly once');assert(variants.en.writes.at(-1).save_path==='/verified-downloads','Save verification: POST payload lost save_path');assert(variants.en.preferenceReads>readsBefore,'Save verification: successful write was not followed by app/preferences reread');assert(variants.en.prefs.save_path==='/verified-downloads','Save verification: server-side Preferences state did not persist write');assert(errors.length===0,'Settings fidelity browser errors: '+errors.join(' | '));
  await context.close();

  variants.zh.prefs={...basePrefs,locale:'zh_CN'};variants.zh.writes=[];variants.zh.preferenceReads=0;
  const zhContext=await browser.newContext({viewport:{width:1366,height:900},locale:'zh-CN'}),zhPage=await zhContext.newPage(),zhErrors=[];zhPage.on('pageerror',error=>zhErrors.push(String(error)));zhPage.on('console',message=>{if(message.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(message.text()))zhErrors.push(message.text());});
  await zhPage.goto('http://'+host+':'+port+'/zh/#/',{waitUntil:'networkidle'});await zhPage.waitForSelector('#torrent-list');await openSettings(zhPage);await seedAllPrefs(zhPage);await selectTab(zhPage,'behavior');const behaviorTitle=await zhPage.locator('#settings-tabs [data-settings-tab="behavior"]').textContent();assert(String(behaviorTitle).trim()==='行为','zh_CN: Behavior tab must resolve to official 行为, got '+JSON.stringify(behaviorTitle));
  const zhFacts=await zhPage.evaluate(()=>{const S=WeiG.SettingsSchema,I=WeiG.I18n,all=[];for(const tab of S.nativeSurfaces()){const graph=S.controlGraph(tab);for(const field of graph&&graph.fieldsets||[])all.push(field.title,...(field.legendControls||[]).flatMap(item=>[item.label,item.adornment,item.suffix]));for(const row of graph&&graph.rows||[])for(const item of row.items||[])all.push(item.label,item.adornment,item.suffix,...(item.items||[]));}const refs=all.filter(ref=>ref&&ref.source),find=pattern=>refs.find(ref=>pattern.test(String(ref.source||'')));const resolve=ref=>ref?I.qbSourceText(ref,ref.source):null;const random=find(/^Random$/i),listening=find(/Listening Port/i),experimental=find(/I2P.*Experimental/i);return{locale:I.getQbLocale(),randomSource:random&&random.source,random:resolve(random),listeningSource:listening&&listening.source,listening:resolve(listening),experimentalSource:experimental&&experimental.source,experimental:resolve(experimental)};});assert(zhFacts.locale==='zh_CN','zh_CN: qB locale owner drifted: '+JSON.stringify(zhFacts));assert(zhFacts.random&&zhFacts.random!==zhFacts.randomSource,'zh_CN: Random helper fell back to English: '+JSON.stringify(zhFacts));assert(zhFacts.listening&&zhFacts.listening!==zhFacts.listeningSource,'zh_CN: Listening Port fell back to English: '+JSON.stringify(zhFacts));if(zhFacts.experimentalSource)assert(zhFacts.experimental&&!/Experimental/i.test(zhFacts.experimental),'zh_CN: I2P structural title retained raw Experimental text: '+JSON.stringify(zhFacts));
  await selectTab(zhPage,'connection');const leakedEnglish=await zhPage.evaluate(()=>{const exact=['Behavior','Random','Listening Port'];const nodes=[...document.querySelectorAll('#settings-tabs button,.setting-title,.setting-inline-label,.setting-inline-action,.settings-section__header h2,.ui-select__value')].filter(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';});return nodes.map(node=>String(node.textContent||'').trim()).filter(value=>exact.includes(value));});assert(leakedEnglish.length===0,'zh_CN: obvious source-owned English fallback remained visible: '+JSON.stringify(leakedEnglish));for(const tab of seeded.tabs){await selectTab(zhPage,tab);await auditTab(zhPage,tab);}assert(zhErrors.length===0,'zh_CN Settings browser errors: '+zhErrors.join(' | '));await zhContext.close();

  console.log('A2 Settings browser fidelity passed: focused Options interactions, real save/reread verification, official zh_CN source-owned copy, and exhaustive native-tab Control Graph DOM audit for qB 5.2.3.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

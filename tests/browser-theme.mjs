import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const privateRoot=path.resolve(here,'../webui/private');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const host='127.0.0.1',port=8782;
const variants={legacy:{qb:'v4.1.9.1',api:'2.1.0'},modern:{qb:'v5.2.0',api:'2.11.4'}};
const torrent={hash:'5'.repeat(40),name:'Theme Fixture',size:1048576,progress:.45,dlspeed:1200,upspeed:200,eta:3600,state:'downloading',ratio:.2,tracker:'https://tracker.example/announce',category:'',tags:'',added_on:1000,save_path:'/downloads'};
const prefs={save_path:'/downloads',listen_port:6881,upnp:false,max_connec:500,max_uploads:20,dl_limit:0,up_limit:0,alt_dl_limit:0,alt_up_limit:0,dht:true,pex:true,lsd:true,alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui'};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,v,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));}
function text(res,v,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));}
function empty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
function api(req,res,v,p,url){
  if(p==='app/version')return text(res,v.qb);if(p==='app/webapiVersion')return text(res,v.api);if(p==='app/preferences')return json(res,prefs);if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:2048,up_info_speed:1024,dl_info_data:7340032,up_info_data:3145728,connection_status:'connected',dht_nodes:12,total_peer_connections:4});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dl_info_speed:2048,up_info_speed:1024,dht_nodes:12,total_peer_connections:4,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||0),rows=offset>0?[]:[torrent];return json(res,limit?rows.slice(0,limit):rows);}
  if(p==='torrents/categories')return json(res,{});if(p==='torrents/tags')return json(res,[]);if(p==='rss/items')return json(res,{});if(['search/plugins','log/main','log/peers'].includes(p))return json(res,[]);if(req.method==='POST')return empty(res);return json(res,{});
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),m=url.pathname.match(/^\/(legacy|modern)(?:\/(.*))?$/);if(!m){res.writeHead(404);return res.end('not found');}const v=variants[m[1]],rel=m[2]||'';if(rel.startsWith('api/v2/'))return api(req,res,v,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'theme-fixture',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});const requested=rel||'index.html',file=path.resolve(privateRoot,requested);if(!(file===privateRoot||file.startsWith(privateRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(e));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function choose(page,root,value){const trigger=page.locator(`${root} .ui-select__trigger`);await trigger.click();const option=page.locator(`#weigg-floating-layer .ui-select__option[data-value="${value}"]`);await option.waitFor();await option.click();}
async function surface(page,selector){return page.locator(selector).first().evaluate(n=>{const s=getComputedStyle(n);return{image:s.backgroundImage,color:s.backgroundColor,text:s.color,display:s.display,opacity:s.opacity};});}
function whiteBased(s){return /rgb\((?:255|25[0-4]),\s*(?:255|25[0-4]),\s*(?:255|25[0-4])\)/.test(s.image)||/rgba?\((?:255|25[0-4]),\s*(?:255|25[0-4]),\s*(?:255|25[0-4])/.test(s.color);}
async function openSettings(page){await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active'));await page.waitForSelector('#settings-content[data-settings-renderer="canonical"]');}

const browser=await chromium.launch({headless:true});
try{
  for(const name of ['legacy','modern']){
    const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US',colorScheme:'dark'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#torrent-list [data-hash]');await page.waitForFunction(()=>window.WeiG?.Theme&&document.querySelector('#theme-control .ui-select__trigger'));
    const owner=await page.evaluate(()=>({modes:WeiG.Theme.modes,state:WeiG.Theme.state(),themeHosts:document.querySelectorAll('#theme-btn').length,controls:document.querySelectorAll('#theme-control').length}));
    assert(JSON.stringify(owner.modes)===JSON.stringify(['system','time','light','dark']),`${name}: canonical theme modes wrong`);assert(owner.themeHosts===1&&owner.controls===1,`${name}: duplicate/missing Header Theme presentation`);

    // Real Header Select interaction -> persisted mode + resolved visible Light state.
    await choose(page,'#theme-control','light');
    await page.waitForFunction(()=>WeiG.Theme.state().mode==='light'&&WeiG.Theme.state().resolved==='light'&&document.documentElement.dataset.theme==='light');
    assert(await page.evaluate(()=>WeiG.Config.load().theme)==='light',`${name}: Header Theme choice was not persisted`);
    const lightTop=await surface(page,'.topbar'),lightStatus=await surface(page,'.statusbar');
    assert(whiteBased(lightTop)&&whiteBased(lightStatus),`${name}: Light top/status surfaces are not white-based: ${JSON.stringify({lightTop,lightStatus})}`);

    // Open the canonical Header Select and inspect the real top-layer menu surface.
    await page.locator('#theme-control .ui-select__trigger').click();await page.waitForSelector('#weigg-floating-layer .ui-select__menu');
    const menuLight=await surface(page,'#weigg-floating-layer .ui-select__menu');assert(whiteBased(menuLight),`${name}: Light Select menu remained Dark: ${JSON.stringify(menuLight)}`);await page.keyboard.press('Escape');

    // Settings is a presentation caller of the same owner, not a second state machine.
    await openSettings(page);
    const settingsSurface=await surface(page,'#settings-content'),sectionSurface=await surface(page,'#settings-content .settings-section'),searchSurface=await surface(page,'.settings-search-box');
    assert(whiteBased(settingsSurface)&&whiteBased(sectionSurface)&&whiteBased(searchSurface),`${name}: Light Settings surfaces are not white-based`);
    const themeRow=page.locator('[data-setting-key="weigg_theme"]');await themeRow.waitFor();await choose(page,'[data-setting-key="weigg_theme"]','time');
    const sync=await page.evaluate(()=>({state:WeiG.Theme.state(),saved:WeiG.Config.load().theme,header:document.getElementById('theme-control')?.getValue?.(),expected:(new Date().getHours()>=20||new Date().getHours()<8)?'dark':'light'}));
    assert(sync.state.mode==='time'&&sync.saved==='time'&&sync.header==='time'&&sync.state.resolved===sync.expected,`${name}: Settings/Header Smart Auto synchronization failed: ${JSON.stringify(sync)}`);
    const boundaries=await page.evaluate(()=>({a:WeiG.Theme.resolveFor('time',new Date(2026,0,2,7,59)),b:WeiG.Theme.resolveFor('time',new Date(2026,0,2,8,0)),c:WeiG.Theme.resolveFor('time',new Date(2026,0,2,19,59)),d:WeiG.Theme.resolveFor('time',new Date(2026,0,2,20,0))}));
    assert(JSON.stringify(boundaries)===JSON.stringify({a:'dark',b:'light',c:'light',d:'dark'}),`${name}: Smart Auto boundary truth failed`);

    // System mode follows a live prefers-color-scheme change without reload.
    await page.emulateMedia({colorScheme:'dark'});await page.evaluate(()=>WeiG.Theme.setMode('system'));await page.waitForFunction(()=>WeiG.Theme.state().resolved==='dark');
    await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>WeiG.Theme.state().mode==='system'&&WeiG.Theme.state().resolved==='light'&&document.documentElement.dataset.theme==='light');
    await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>WeiG.Theme.state().resolved==='dark');
    await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>WeiG.Theme.state().resolved==='light');

    // Dialog is the existing canonical primitive and must resolve to the Light floating surface.
    await page.evaluate(()=>WeiG.Theme.setMode('light'));await page.evaluate(()=>WeiG.Router.home());await page.waitForFunction(()=>document.getElementById('list-view')?.classList.contains('is-active'));
    await page.locator('#columns-btn').click();await page.waitForSelector('#columns-dialog[open]');const dialogLight=await surface(page,'#columns-dialog');assert(whiteBased(dialogLight),`${name}: Light Dialog remained Dark: ${JSON.stringify(dialogLight)}`);await page.locator('#columns-close').click();

    // Reduced Motion never changes Theme truth and introduces no Theme animation owner.
    await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>{document.documentElement.dataset.motion='reduced';WeiG.Theme.setMode('dark');});await page.waitForFunction(()=>WeiG.Theme.state().resolved==='dark');
    await page.evaluate(()=>WeiG.Theme.setMode('light'));await page.waitForFunction(()=>WeiG.Theme.state().resolved==='light');const reduced=await page.locator('#theme-control .ui-select__trigger').evaluate(n=>({animation:getComputedStyle(n).animationName,mode:WeiG.Theme.state().mode,resolved:WeiG.Theme.state().resolved}));assert(reduced.animation==='none'&&reduced.mode==='light'&&reduced.resolved==='light',`${name}: Reduced Motion changed Theme semantics or introduced animation`);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{document.documentElement.dataset.motion='system';});

    // Mobile reuses the exact same control/owner and keeps a 44px touch target.
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(30);const mobile=await page.locator('#theme-btn').evaluate(n=>{const r=n.getBoundingClientRect(),t=n.querySelector('.ui-select__trigger')?.getBoundingClientRect();return{host:[r.width,r.height],trigger:t?[t.width,t.height]:null,count:document.querySelectorAll('#theme-control').length,state:WeiG.Theme.state()};});assert(mobile.host[0]>=44&&mobile.host[1]>=44&&mobile.trigger?.[0]>=44&&mobile.trigger?.[1]>=44&&mobile.count===1,`${name}: Mobile Theme did not reuse one 44px canonical control: ${JSON.stringify(mobile)}`);
    assert(errors.length===0,`${name}: browser errors: ${errors.join(' | ')}`);await context.close();
  }

  // Feature-specific Light surfaces sampled on modern qB: Transfer and Logs.
  {
    const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US',colorScheme:'light'}),page=await context.newPage();await page.goto(`http://${host}:${port}/modern/#/`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#torrent-list [data-hash]');await page.waitForFunction(()=>window.WeiG?.Theme&&document.querySelector('#theme-control'));await page.evaluate(()=>WeiG.Theme.setMode('light'));
    await page.waitForSelector('#transfer-capsule');await page.locator('.transfer-runtime-capsule__stats').click();await page.waitForSelector('#transfer-stats-dialog[open]');const transferStat=await surface(page,'.transfer-stat'),chart=await surface(page,'.transfer-chart-shell');assert(whiteBased(transferStat)&&whiteBased(chart),`modern: Light Transfer surfaces remained Dark`);await page.locator('#transfer-stats-dialog .icon-btn').click().catch(()=>page.evaluate(()=>document.getElementById('transfer-stats-dialog')?.close()));
    await page.locator('#app-nav [data-route="logs"]').click();await page.waitForFunction(()=>document.getElementById('logs-view')?.classList.contains('is-active'));await page.waitForSelector('.logs-toolbar');const logsToolbar=await surface(page,'.logs-toolbar'),logsSearch=await surface(page,'.logs-search');assert(whiteBased(logsToolbar)&&whiteBased(logsSearch),`modern: Light Logs surfaces remained Dark`);await context.close();
  }
  console.log('Theme browser regression passed: qB 4.1.9.1/5.2.0, four modes, live system, Smart Auto, Light surfaces, Mobile and Reduced Motion.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

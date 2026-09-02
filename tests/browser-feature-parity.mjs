import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const privateRoot=path.resolve(here,'../webui/private');
const host='127.0.0.1',port=8772;
const variants={legacy:{qb:'v4.1.9.1',api:'2.1.0'},modern:{qb:'v5.2.0',api:'2.11.4'}};
const prefs={save_path:'/downloads',alt_dl_limit:262144,alt_up_limit:131072};
const torrents=Array.from({length:80},(_,i)=>({hash:String(i+1).padStart(40,'0'),name:`Fixture Torrent ${String(i+1).padStart(2,'0')}`,size:1048576*(i+1),progress:i%4===0?1:.4,dlspeed:1000+i,upspeed:200+i,eta:3600,state:i%4===0?'uploading':'downloading',ratio:.2,tracker:'https://tracker.example/announce',category:'fixture',added_on:1000+i,save_path:'/downloads'}));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,v,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));}
function text(res,v,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));}
function empty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
function torrentInfo(url){let rows=torrents;const hashes=url.searchParams.get('hashes');if(hashes){const set=new Set(hashes.split('|'));rows=rows.filter(t=>set.has(t.hash));}const offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=Math.max(0,Number(url.searchParams.get('limit'))||0);return limit?rows.slice(offset,offset+limit):rows.slice(offset);}
function api(req,res,v,p,url){
  if(p==='app/version')return text(res,v.qb);if(p==='app/webapiVersion')return text(res,v.api);if(p==='app/preferences')return json(res,prefs);if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:12345,up_info_speed:6789,dl_info_data:7340032,up_info_data:3145728,connection_status:'connected',dht_nodes:12,total_peer_connections:4});
  if(p==='transfer/speedLimitsMode')return text(res,'0');if(p==='transfer/downloadLimit')return text(res,'1048576');if(p==='transfer/uploadLimit')return text(res,'524288');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dl_info_speed:12345,up_info_speed:6789,dht_nodes:12,total_peer_connections:4,free_space_on_disk:10737418240}});
  if(p==='torrents/info')return json(res,torrentInfo(url));if(p==='torrents/categories')return json(res,{fixture:{name:'fixture',savePath:'/downloads'}});if(p==='torrents/tags')return json(res,[]);
  if(['torrents/files','torrents/trackers','torrents/webseeds','search/plugins','log/main','log/peers'].includes(p))return json(res,[]);if(p==='sync/torrentPeers')return json(res,{peers:{}});if(p==='rss/items')return json(res,{});
  if(req.method==='POST')return empty(res);return json(res,{});
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),m=url.pathname.match(/^\/(legacy|modern)(?:\/(.*))?$/);if(!m){res.writeHead(404);return res.end('not found');}const v=variants[m[1]],rel=m[2]||'';if(rel.startsWith('api/v2/'))return api(req,res,v,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:'0.3.7',gitSha:'fixture-sha',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});const requested=rel||'index.html',file=path.resolve(privateRoot,requested);if(!(file===privateRoot||file.startsWith(privateRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(e));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
const browser=await chromium.launch({headless:true});
try{
  for(const name of ['legacy','modern']){
    const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'networkidle'});await page.waitForSelector('#torrent-list [data-hash]');await page.waitForFunction(()=>document.querySelector('#catalog-state')?.textContent.includes('80'));

    const owners=await page.evaluate(()=>({selection:!!WeiG.Selection,transfer:!!WeiG.Transfer,layout:!!WeiG.LayoutRuntime,polish:!!WeiG.PolishRuntime,spatial:!!WeiG.SpatialRuntime,runtimeI18n:!!WeiG.RuntimeI18n,interfaceText:!!WeiG.InterfaceText,transferText:!!WeiG.TransferText,alternativeText:!!WeiG.AlternativeWebUIText,legacy:!!(WeiG.V030I18n||WeiG.V034I18n||WeiG.V036I18n||WeiG.V037Text||WeiG.V037Selection||WeiG.V037Layout||WeiG.V037Polish)}));
    assert(owners.selection&&owners.transfer&&owners.layout&&owners.polish&&owners.spatial&&owners.runtimeI18n&&owners.interfaceText&&owners.transferText&&owners.alternativeText,`${name}: semantic runtime owner missing`);assert(!owners.legacy,`${name}: versioned owner survived semantic migration`);
    assert(await page.locator('#selection-control').count()===1,`${name}: selection control missing`);

    const rows=page.locator('#torrent-list [data-hash]');await rows.nth(0).click({modifiers:['Control']});await rows.nth(1).click({modifiers:['Shift']});
    assert(await page.evaluate(()=>WeiG.Selection.count())===2,`${name}: Ctrl/Shift range selection failed`);assert(!(await page.locator('#more-actions-btn').isDisabled()),`${name}: toolbar did not follow Selection owner`);

    await rows.nth(2).click({button:'right'});await page.waitForSelector('#actions-dialog[open]');const contextActions=await page.locator('#actions-grid [data-torrent-action]').evaluateAll(nodes=>nodes.map(n=>n.dataset.torrentAction).sort());assert(contextActions.includes('resume')&&contextActions.includes('delete'),`${name}: context menu ActionRegistry incomplete`);await page.locator('#actions-close').click();
    assert(await page.evaluate(()=>WeiG.Selection.count())===1,`${name}: context menu must own the clicked row selection`);
    await page.locator('#more-actions-btn').click();await page.waitForSelector('#actions-dialog[open]');const toolbarActions=await page.locator('#actions-grid [data-torrent-action]').evaluateAll(nodes=>nodes.map(n=>n.dataset.torrentAction).sort());assert(JSON.stringify(contextActions)===JSON.stringify(toolbarActions),`${name}: context menu and top More diverged from one ActionRegistry`);await page.locator('#actions-close').click();

    await page.evaluate(()=>WeiG.Selection.clear());await page.locator('#selection-action .ui-select__trigger').click();await page.locator('#weigg-floating-layer .ui-select__menu:not([hidden]) .ui-select__option[data-value="all"]').click();await page.waitForFunction(()=>WeiG.Selection.count()===80);assert(await page.evaluate(()=>WeiG.Selection.count())===80,`${name}: select-all-matching did not cross pagination`);await page.evaluate(()=>WeiG.Selection.clear());

    const list=page.locator('#torrent-list');await list.evaluate(el=>{el.scrollTop=500;el.__weiggVirtualScrollTop=500;});await page.locator('#search-input').fill('Fixture Torrent 79');await page.waitForFunction(()=>document.querySelector('#torrent-list')?.scrollTop===0);assert(await list.evaluate(el=>el.scrollTop)===0,`${name}: conceptual search change did not reset Torrent scroll`);
    await page.locator('#search-input').fill('no-such-torrent');await page.waitForFunction(()=>document.querySelector('.torrent-panel')?.classList.contains('is-empty'));assert(await page.locator('.torrent-panel').evaluate(el=>el.classList.contains('is-empty')),`${name}: empty library state did not collapse the data viewport`);await page.locator('#search-input').fill('');await page.waitForFunction(()=>!document.querySelector('.torrent-panel')?.classList.contains('is-empty'));

    assert(await page.locator('#transfer-capsule').count()===1,`${name}: unified Transfer capsule missing`);await page.locator('.transfer-runtime-capsule__stats').click();await page.waitForSelector('#transfer-stats-dialog[open]');assert(await page.locator('#transfer-chart').count()===1,`${name}: realtime Transfer chart missing`);await page.locator('#transfer-chart-window .ui-select__trigger').click();const windows=await page.locator('#weigg-floating-layer .ui-select__menu:not([hidden]) .ui-select__option').allTextContents();assert(windows.join('|').includes('1 min')&&windows.join('|').includes('5 min')&&windows.join('|').includes('15 min'),`${name}: Transfer chart windows incomplete`);await page.evaluate(()=>WeiG.Components.closeSelects(false));
    const statsGeometry=await page.locator('#transfer-stats-dialog').evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return{overflow:s.overflowY,width:r.width,height:r.height,innerHeight};});assert(statsGeometry.overflow==='hidden',`${name}: desktop Transfer stats dialog regained outer scrolling`);assert(statsGeometry.width<=721&&statsGeometry.height<=statsGeometry.innerHeight-40,`${name}: Transfer stats geometry exceeds desktop viewport contract`);await page.locator('#transfer-stats-dialog .dialog__head .icon-btn').click();
    await page.locator('.transfer-runtime-capsule__limits').click();await page.waitForSelector('#transfer-limit-dialog[open]');assert(await page.locator('#transfer-limit-dialog [data-transfer-mode]').count()===2,`${name}: NORMAL/ALT transfer modes missing`);const limitOverflow=await page.locator('#transfer-limit-dialog').evaluate(el=>getComputedStyle(el).overflowY);assert(limitOverflow==='hidden',`${name}: desktop Transfer limit dialog regained outer scrolling`);await page.locator('#transfer-limit-dialog .dialog__head .icon-btn').click();

    const movingProgress=rows.nth(1).locator('.progress-fill');const motion=await movingProgress.evaluate(el=>({fill:getComputedStyle(el,'::after').animationName,sweep:getComputedStyle(el,'::before').animationName,transition:getComputedStyle(el).transitionDuration,width:el.style.width}));assert(motion.width!=='100%',`${name}: progress regression fixture accidentally selected a completed torrent`);assert(motion.fill!=='none'&&motion.sweep!=='none',`${name}: Torrent progress flow/sweep motion missing`);assert(motion.transition!=='0s',`${name}: Torrent progress width transition missing`);
    await page.emulateMedia({reducedMotion:'reduce'});const reduced=await movingProgress.evaluate(el=>({fill:getComputedStyle(el,'::after').animationName,sweep:getComputedStyle(el,'::before').animationName,transition:getComputedStyle(el).transitionDuration}));assert(reduced.fill==='none'&&reduced.sweep==='none',`${name}: reduced-motion did not disable Torrent progress animation`);

    assert(errors.length===0,`${name}: browser errors: ${errors.join(' | ')}`);await context.close();
  }

  {
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,locale:'en-US'}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
    await page.goto(`http://${host}:${port}/modern/#/`,{waitUntil:'networkidle'});await page.waitForSelector('#torrent-list [data-hash]');
    const row=page.locator('#torrent-list [data-hash]').first();const box=await row.boundingBox();assert(!!box,'mobile: first torrent row has no geometry');
    await row.dispatchEvent('pointerdown',{pointerType:'touch',clientX:box.x+12,clientY:box.y+12,pointerId:7,isPrimary:true});await page.waitForTimeout(575);await page.waitForSelector('#actions-dialog[open]');
    assert(await page.evaluate(()=>WeiG.Selection.count())===1,'mobile: long press did not select the pressed torrent');const actions=await page.locator('#actions-grid [data-torrent-action]').evaluateAll(nodes=>nodes.map(n=>n.dataset.torrentAction));assert(actions.includes('resume')&&actions.includes('delete'),'mobile: long press did not open the canonical ActionRegistry');await page.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',pointerId:7,isPrimary:true})));
    assert(errors.length===0,`mobile: browser errors: ${errors.join(' | ')}`);await context.close();
  }

  console.log('Feature parity browser regression passed: semantic owners, Selection/ActionRegistry, desktop context menu, mobile long press, scroll/empty state, Transfer panel and Torrent progress motion on qB 4.1.9.1 and 5.2.0.');
}finally{await browser.close();await new Promise(r=>server.close(r));}

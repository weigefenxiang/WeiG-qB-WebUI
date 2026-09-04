import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const privateRoot=path.resolve(here,'../webui/private');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const host='127.0.0.1',port=8772;
const variants={legacy:{qb:'v4.1.9.1',api:'2.1.0'},modern:{qb:'v5.2.0',api:'2.11.4'}};
const prefs={save_path:'/downloads',alt_dl_limit:256,alt_up_limit:128};
const PRIVATE_HASH='0000000000000000000000000000000000000001';
const PENDING_HASH='0000000000000000000000000000000000000003';
const baseTorrents=Array.from({length:80},(_,i)=>({hash:String(i+1).padStart(40,'0'),name:`Fixture Torrent ${String(i+1).padStart(2,'0')}`,size:1048576*(i+1),progress:i%4===0?1:.4,dlspeed:1000+i,upspeed:200+i,eta:3600,state:i%4===0?'uploading':'downloading',ratio:.2,tracker:i===0?'https://private.example/announce':'https://tracker.example/announce',category:'fixture',tags:'',added_on:1000+i,save_path:'/downloads',has_metadata:i!==2}));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const json=(res,v,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));};
const text=(res,v,status=200)=>{res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));};
const empty=(res,status=200)=>{res.writeHead(status,{'cache-control':'no-store'});res.end('');};
function variantTorrents(v){return baseTorrents.map(t=>{const row={...t};if(v.qb.startsWith('v5'))row.private=t.hash===PRIVATE_HASH;else delete row.private;if(t.hash===PENDING_HASH)row.state='metaDL';return row;});}
function torrentInfo(v,url){let rows=variantTorrents(v);const hashes=url.searchParams.get('hashes');if(hashes){const set=new Set(hashes.split('|'));rows=rows.filter(t=>set.has(t.hash));}const offset=Math.max(0,Number(url.searchParams.get('offset'))||0),limit=Math.max(0,Number(url.searchParams.get('limit'))||0);return limit?rows.slice(offset,offset+limit):rows.slice(offset);}
function properties(v,hash){const t=variantTorrents(v).find(x=>x.hash===hash)||variantTorrents(v)[0],p={save_path:t.save_path,total_size:t.size,total_downloaded:7340032,total_uploaded:3145728,share_ratio:t.ratio,nb_connections:4,seeds:8,peers:2,addition_date:1700000000,completion_date:t.progress===1?1700003600:-1,created_by:'fixture',pieces_num:64,piece_size:262144,has_metadata:t.has_metadata};if(v.qb.startsWith('v5')&&t.has_metadata!==false){p.private=t.hash===PRIVATE_HASH;p.is_private=t.hash===PRIVATE_HASH;}return p;}
async function api(req,res,v,p,url){
  if(p==='app/version')return text(res,v.qb);if(p==='app/webapiVersion')return text(res,v.api);if(p==='app/preferences')return json(res,prefs);if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:12345,up_info_speed:6789,dl_info_data:7340032,up_info_data:3145728,connection_status:'connected',dht_nodes:12});
  if(p==='transfer/speedLimitsMode')return text(res,'0');if(p==='transfer/downloadLimit')return text(res,'1048576');if(p==='transfer/uploadLimit')return text(res,'524288');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dl_info_speed:12345,up_info_speed:6789,dht_nodes:12,total_peer_connections:4,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){if(url.searchParams.get('limit')==='200')await sleep(220);return json(res,torrentInfo(v,url));}
  if(p==='torrents/properties')return json(res,properties(v,url.searchParams.get('hash')));
  if(p==='torrents/trackers')return json(res,[]);if(p==='torrents/categories')return json(res,{fixture:{name:'fixture',savePath:'/downloads'}});if(p==='torrents/tags')return json(res,[]);
  if(['torrents/files','torrents/webseeds','search/plugins','log/main','log/peers'].includes(p))return json(res,[]);if(p==='sync/torrentPeers')return json(res,{peers:{}});if(p==='rss/items')return json(res,{});if(req.method==='POST')return empty(res);return json(res,{});
}
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,`http://${host}:${port}`),m=url.pathname.match(/^\/(legacy|modern)(?:\/(.*))?$/);if(!m){res.writeHead(404);return res.end('not found');}const v=variants[m[1]],rel=m[2]||'';if(rel.startsWith('api/v2/'))return await api(req,res,v,rel.slice(7),url);if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'fixture-sha',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});const requested=rel||'index.html',file=path.resolve(privateRoot,requested);if(!(file===privateRoot||file.startsWith(privateRoot+path.sep))){res.writeHead(403);return res.end('forbidden');}const body=await fs.readFile(file);res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);}catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(e));}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

const browser=await chromium.launch({headless:true});
try{
  for(const name of ['legacy','modern']){
    const context=await browser.newContext({viewport:{width:1440,height:900},locale:'en-US'}),page=await context.newPage(),errors=[],trackerRequests=[];
    page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});page.on('request',req=>{if(req.url().includes('/api/v2/torrents/trackers'))trackerRequests.push(req.url());});
    await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'domcontentloaded'});await page.waitForSelector('#torrent-list [data-hash]');

    // Primary data is not blocked by aggregate indexing.
    const earlyPager=await page.locator('#page-label').textContent();assert(!earlyPager.includes('?'),`${name}: progressive pager exposed ?`);assert(await page.locator('#torrent-list [data-hash]').count()>0,`${name}: first page blocked by indexing`);
    await page.waitForFunction(()=>WeiG.AppState?.catalogReady===true,{timeout:10000});assert((await page.locator('#page-label').textContent()).includes('/ 2'),`${name}: aggregate total did not settle`);

    const owners=await page.evaluate(()=>({selection:!!WeiG.Selection,transfer:!!WeiG.TransferRuntime,privacy:!!WeiG.TorrentSemantics,layout:!!WeiG.LayoutRuntime,spatial:!!WeiG.SpatialRuntime,registry:!!WeiG.TorrentFieldRegistry}));
    assert(Object.values(owners).every(Boolean),`${name}: canonical owners missing ${JSON.stringify(owners)}`);

    // Selection and ActionRegistry stay canonical.
    const rows=page.locator('#torrent-list [data-hash]');await rows.nth(0).locator('.torrent-select-hit').click();await rows.nth(1).click({modifiers:['Control']});assert(await page.evaluate(()=>WeiG.Selection.count())===2,`${name}: multi-selection failed`);
    await page.locator('#more-actions-btn').click();await page.waitForSelector('#actions-dialog[open]');const toolbarActions=await page.locator('#actions-grid [data-torrent-action]').evaluateAll(ns=>ns.map(n=>n.dataset.torrentAction).sort());assert(toolbarActions.length>8,`${name}: ActionRegistry incomplete`);await page.locator('#actions-close').click();

    // Privacy model degrades honestly on qB4 and is native on qB5.
    const privateNav=page.locator('#filter-nav [data-filter="private"]');
    if(name==='legacy'){
      assert(await privateNav.getAttribute('aria-disabled')==='true',`legacy: Private/PT must be disabled`);const before=trackerRequests.length;await privateNav.dispatchEvent('click');await page.waitForSelector('#capability-dialog[open]');const copy=await page.locator('#capability-dialog').textContent();assert(copy.includes('5.0.0')&&copy.includes('4.1.9.1'),`legacy: capability detail incomplete`);assert(trackerRequests.length===before,'legacy: unsupported Private started tracker fallback');await page.locator('#capability-dialog .capability-dialog__done').click();
    }else{
      assert(await privateNav.getAttribute('aria-disabled')==='false',`modern: Private/PT incorrectly disabled`);await privateNav.click();await page.waitForFunction(()=>WeiG.LibraryController.total()===1);const privateRow=page.locator(`#torrent-list [data-hash="${PRIVATE_HASH}"]`);assert(await privateRow.count()===1,'modern: native Private torrent missing');await page.locator('#filter-nav [data-filter="all"]').click();
    }

    // Route frame changes atomically.
    await page.locator('#app-nav [data-route="rss"]').click();await page.waitForFunction(()=>document.getElementById('rss-view')?.classList.contains('is-active'));
    await page.locator('#app-nav [data-route="settings"]').click();await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active')&&document.getElementById('app')?.classList.contains('is-tool-route'));
    assert(await page.locator('#sidebar').evaluate(n=>getComputedStyle(n).display)==='none',`${name}: Sidebar leaked into desktop tool route`);
    await page.evaluate(()=>WeiG.Router.home());await page.waitForFunction(()=>document.getElementById('list-view')?.classList.contains('is-active'));

    // Desktop remains full-height and has no summary cards.
    const fill=await page.evaluate(()=>{const panel=document.querySelector('#list-view>.torrent-panel')?.getBoundingClientRect(),workspace=document.querySelector('.workspace')?.getBoundingClientRect();return panel&&workspace?{gap:workspace.bottom-panel.bottom,panelHeight:panel.height,summary:document.querySelector('.mobile-summary')}:null;});
    assert(fill&&fill.gap<=10&&fill.panelHeight>300&&!fill.summary,`${name}: desktop workspace geometry/summary regression ${JSON.stringify(fill)}`);

    // Reduced Motion preserves truthful progress state while final presentation settles without decorative motion.
    const movingRow=page.locator('#torrent-list [data-hash]').nth(1),movingHash=await movingRow.getAttribute('data-hash'),moving=movingRow.locator('.progress-fill');
    const beforeMotion=await moving.evaluate(el=>{const pseudo=getComputedStyle(el,'::after'),track=el.closest('.progress-track');return{animation:pseudo.animationName,opacity:pseudo.opacity,width:el.style.width,state:track?.dataset.progressState,active:track?.dataset.progressActive};});
    assert(beforeMotion.animation!=='none'&&beforeMotion.active==='true',`${name}: active progress motion missing ${JSON.stringify(beforeMotion)}`);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(hash=>{const row=document.querySelector(`#torrent-list [data-hash="${hash}"]`),el=row&&row.querySelector('.progress-fill');if(!el||!matchMedia('(prefers-reduced-motion: reduce)').matches)return false;const pseudo=getComputedStyle(el,'::after');return pseudo.animationName==='none'&&Number(pseudo.opacity)===0;},movingHash);
    const reducedMotion=await page.locator(`#torrent-list [data-hash="${movingHash}"] .progress-fill`).evaluate(el=>{const pseudo=getComputedStyle(el,'::after'),track=el.closest('.progress-track');return{animation:pseudo.animationName,opacity:pseudo.opacity,width:el.style.width,state:track?.dataset.progressState,active:track?.dataset.progressActive,media:matchMedia('(prefers-reduced-motion: reduce)').matches};});
    assert(reducedMotion.media&&reducedMotion.animation==='none'&&Number(reducedMotion.opacity)===0&&reducedMotion.width===beforeMotion.width&&reducedMotion.state===beforeMotion.state&&reducedMotion.active===beforeMotion.active,`${name}: Reduced Motion final state failed ${JSON.stringify({beforeMotion,reducedMotion})}`);
    assert(errors.length===0,`${name}: browser errors: ${errors.join(' | ')}`);await context.close();
  }

  // Mobile parity: Drawer owns filters/facets, long press reuses ActionRegistry, no alternate state/poller.
  for(const name of ['legacy','modern']){
    const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(`http://${host}:${port}/${name}/#/`,{waitUntil:'domcontentloaded'});await page.waitForSelector('.torrent-mobile-card[data-hash]');await page.waitForFunction(()=>document.querySelectorAll('#facet-controls .facet-control').length===4);
    const hit=await page.locator('.torrent-mobile-card[data-hash]').first().locator('.torrent-select-hit').boundingBox();assert(hit&&hit.width>=44&&hit.height>=44,`${name} mobile: selection target ${hit?.width}x${hit?.height}`);
    await page.locator('#menu-btn').click();await page.waitForFunction(()=>document.getElementById('sidebar')?.classList.contains('is-open'));
    assert(await page.locator('#sidebar-facet-slot>#facet-controls').count()===1,`${name} mobile: facets are not in Drawer Sidebar`);
    if(name==='legacy'){
      const privateNav=page.locator('#filter-nav [data-filter="private"]');await privateNav.dispatchEvent('click');await page.waitForSelector('#capability-dialog[open]');assert(await page.locator('#capability-dialog').getAttribute('data-dialog-capability')==='privateFilter','legacy mobile: Private did not use canonical capability dialog');await page.locator('#capability-dialog .capability-dialog__done').click();
    }
    await page.locator('#drawer-scrim').click();
    const card=page.locator('.torrent-mobile-card[data-hash]').first();await card.dispatchEvent('pointerdown',{pointerType:'touch',button:0,clientX:120,clientY:120});await page.waitForTimeout(560);await card.dispatchEvent('pointerup',{pointerType:'touch',button:0,clientX:120,clientY:120});await page.waitForSelector('#actions-dialog[open]');assert(await page.locator('#actions-grid [data-torrent-action]').count()>5,`${name} mobile: long press did not reuse ActionRegistry`);await page.locator('#actions-close').click();
    assert(await page.locator('.mobile-summary,#mobile-command-slot,#mobile-facet-slot').count()===0,`${name} mobile: retired duplicate UI survived`);
    assert(errors.length===0,`${name} mobile errors: ${errors.join(' | ')}`);await context.close();
  }
  console.log('Feature parity browser regression passed: progressive paging, qB4 capability degradation, qB5 native Private, atomic routing, full-height no-summary library, canonical Selection/ActionRegistry, Sidebar facets, Reduced Motion and Mobile touch behavior.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

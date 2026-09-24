import {launchBrowser,readWebuiStatic} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../webui/private');
const publicRoot=path.resolve(here,'../webui/public');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const host='127.0.0.1',port=8778;
let prefs={
  save_path:'/downloads',listen_port:6881,upnp:false,max_connec:500,max_uploads:20,
  dl_limit:0,up_limit:0,alt_dl_limit:0,alt_up_limit:0,dht:true,pex:true,lsd:true,
  alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui'
};
let feeds={};
const torrent={hash:'f'.repeat(40),name:'Feedback Fixture',size:1048576,progress:.4,dlspeed:1000,upspeed:200,eta:3600,state:'downloading',ratio:.2,tracker:'https://tracker.example/announce',category:'',tags:'',added_on:1000,save_path:'/downloads',private:false};
const frozenCatalog=JSON.parse(await fs.readFile(path.resolve(here,'fixtures/qb-release-catalog.lkg.json'),'utf8'));
const releaseProfile=frozenCatalog.find(item=>String(item&&item.qbVersion||'')==='5.2.0');
if(!releaseProfile||!/^[0-9a-f]{40}$/.test(String(releaseProfile.sourceSha||'')))throw new Error('Feedback browser gate requires frozen exact qB 5.2.0 source identity.');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function assert(ok,msg){if(!ok)throw new Error(msg);}
function json(res,v,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));}
function text(res,v,status=200){res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));}
function empty(res,status=200){res.writeHead(status,{'cache-control':'no-store'});res.end('');}
async function body(req){let out='';for await(const chunk of req)out+=chunk;return out;}
async function api(req,res,p,url){
  if(p==='app/version')return text(res,'v5.2.0');
  if(p==='app/webapiVersion')return text(res,'2.15.1');
  if(p==='app/preferences'){
    if(req.method==='POST')return empty(res);
    return json(res,prefs);
  }
  if(p==='app/setPreferences'&&req.method==='POST'){
    const raw=await body(req),params=new URLSearchParams(raw);
    try{prefs={...prefs,...JSON.parse(params.get('json')||'{}')};}catch{}
    await new Promise(r=>setTimeout(r,700));
    return empty(res);
  }
  if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:2048,up_info_speed:1024,connection_status:'connected',dht_nodes:12,total_peer_connections:4});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{},tags:[],server_state:{connection_status:'connected',dht_nodes:12,total_peer_connections:4,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||0);
    const out=[torrent];
    return json(res,limit?out.slice(offset,offset+limit):out.slice(offset));
  }
  if(p==='torrents/categories')return json(res,{});
  if(p==='torrents/tags')return json(res,[]);
  if(p==='torrents/add'&&req.method==='POST'){await body(req);await new Promise(r=>setTimeout(r,700));return text(res,'Ok.');}
  if(p==='rss/items')return json(res,feeds);
  if(p==='rss/addFeed'&&req.method==='POST'){
    const raw=await body(req),params=new URLSearchParams(raw),feed=params.get('url')||'';
    await new Promise(r=>setTimeout(r,700));feeds={Fixture:{url:feed,title:'Fixture'}};return empty(res);
  }
  if(['search/plugins','log/main','log/peers'].includes(p))return json(res,[]);
  if(req.method==='POST')return empty(res);
  return json(res,{});
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\/+/,'');
    if(rel.startsWith('api/v2/'))return await api(req,res,rel.slice(7),url);
    if(rel==='data/qb-releases.json')return json(res,[releaseProfile]);
    if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'feedback-fixture',qbPath:'/config/weigg-qb-webui',hostPath:'/srv/qb/config/weigg-qb-webui'});
    const requested=rel||'index.html',{file,body:data}=await readWebuiStatic([root,publicRoot],requested);
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(data);
  }catch(e){res.writeHead(e?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(e));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
const browser=await launchBrowser();
try{
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(m.text()))errors.push(m.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#torrent-list [data-hash]');
  await page.waitForFunction(()=>window.WeiG?.Feedback&&typeof WeiG.toast==='function');

  // Real Add Torrent lifecycle: one processing card uses an activity rail, then updates in place after the real API resolves.
  await page.locator('#add-btn').click();
  await page.locator('#torrent-files').setInputFiles({name:'fixture.torrent',mimeType:'application/x-bittorrent',buffer:Buffer.alloc(0)});
  assert(await page.locator('#add-dialog[open]').count()===1,'choosing a local .torrent file must keep Add Torrent open before submission');
  await page.locator('#torrent-urls').fill('magnet:?xt=urn:btih:'+'a'.repeat(40));
  await page.locator('#add-submit').click();
  const processing=page.locator('.feedback-toast[data-kind="info"]',{hasText:'Adding torrent'}).first();
  await processing.waitFor();
  const addId=await processing.getAttribute('data-feedback-id');
  const processingRail=processing.locator('.feedback-toast__progress');
  assert(await processingRail.isVisible(),'indeterminate Add feedback must expose an activity rail');
  assert(await processingRail.getAttribute('data-mode')==='activity','processing rail must be activity mode, not fake lifetime progress');
  await page.waitForFunction(id=>{const rail=document.querySelector(`.feedback-toast[data-feedback-id="${id}"] .feedback-toast__progress`);return !!(rail&&rail.dataset.mode==='activity'&&getComputedStyle(rail,'::before').animationName==='feedback-activity');},addId,{timeout:1500});
  assert(await page.locator('#add-dialog[open]').count()===1,'Add Torrent must remain open while the qB add request is pending');
  await page.waitForFunction(id=>document.querySelector(`.feedback-toast[data-feedback-id="${id}"]`)?.dataset.kind==='success',addId);
  await page.waitForFunction(()=>!document.getElementById('add-dialog')?.open);
  const added=page.locator(`.feedback-toast[data-feedback-id="${addId}"]`);
  assert((await added.textContent()).includes('Torrent added'),'Add success did not update the same feedback card');
  const addedRail=added.locator('.feedback-toast__progress');
  assert(await addedRail.getAttribute('data-mode')==='lifetime','completed Add feedback did not switch the same rail to lifetime mode');
  await page.waitForFunction(id=>{const rail=document.querySelector(`.feedback-toast[data-feedback-id="${id}"] .feedback-toast__progress`);return !!(rail&&rail.dataset.mode==='lifetime'&&getComputedStyle(rail,'::before').animationName==='feedback-lifecycle');},addId,{timeout:1500});

  // Bounded stack, newest at the desktop bottom, no overlap.
  await page.evaluate(()=>{WeiG.Feedback.dismissAll();});
  await page.waitForTimeout(260);
  await page.evaluate(()=>{
    WeiG.toast('one','info',{title:'One',duration:5000});
    WeiG.toast('two','success',{title:'Two',duration:5000});
    WeiG.toast('three','warning',{title:'Three',duration:5000});
    WeiG.toast('four','error',{title:'Four',duration:5000});
  });
  await page.waitForFunction(()=>document.querySelectorAll('.feedback-toast:not(.is-leaving)').length===4);
  let rects=await page.locator('.feedback-toast:not(.is-leaving)').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.feedbackId,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));
  for(let i=1;i<rects.length;i++)assert(rects[i].top>=rects[i-1].bottom+6,`desktop feedback overlapped: ${JSON.stringify(rects)}`);
  assert(rects.at(-1).top>rects[0].top,'newest desktop feedback must occupy the bottom anchor');
  const roles=await page.locator('.feedback-toast:not(.is-leaving)').evaluateAll(nodes=>nodes.map(n=>({kind:n.dataset.kind,role:n.getAttribute('role')})));
  assert(roles.filter(x=>x.kind!=='error').every(x=>x.role==='status')&&roles.find(x=>x.kind==='error')?.role==='alert','feedback kind roles are not canonical');

  await page.evaluate(()=>WeiG.toast('five','info',{title:'Five',duration:5000}));
  await page.waitForSelector('.feedback-toast.is-leaving');
  await page.waitForTimeout(260);
  assert(await page.locator('.feedback-toast:not(.is-leaving)').count()===4,'fifth feedback did not retire the oldest card');
  assert(!(await page.locator('.feedback-toast').allTextContents()).some(t=>t.includes('One')),'oldest feedback was not retired first');

  // Manual dismissal slides right, preserves the bottom anchor and reflows older cards into the gap.
  const stableBefore=await page.locator('.feedback-toast:not(.is-leaving)').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.feedbackId,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));
  const middle=page.locator(`.feedback-toast[data-feedback-id="${stableBefore[1].id}"]`);
  const middleId=stableBefore[1].id;
  const survivorIds=stableBefore.filter(x=>x.id!==middleId).map(x=>x.id);
  const oldestId=stableBefore[0].id,oldestTopBefore=stableBefore[0].top,bottomBefore=stableBefore.at(-1).bottom;
  await middle.locator('.feedback-toast__dismiss').click();
  await page.waitForFunction(id=>document.querySelector(`.feedback-toast[data-feedback-id="${id}"]`)?.classList.contains('is-leaving'),middleId);
  await page.waitForTimeout(60);
  const matrix=await page.locator(`.feedback-toast[data-feedback-id="${middleId}"] .feedback-toast__surface`).evaluate(n=>getComputedStyle(n).transform);
  assert(matrix!=='none','manual dismissal did not enter the right-slide motion');
  await page.waitForFunction(id=>!document.querySelector(`.feedback-toast[data-feedback-id="${id}"]`),middleId);
  await page.waitForFunction(({oldestId,oldestTopBefore,bottomBefore})=>{const nodes=[...document.querySelectorAll('.feedback-toast:not(.is-leaving)')],oldest=nodes.find(n=>n.dataset.feedbackId===oldestId),bottom=nodes.at(-1);if(!oldest||!bottom)return false;return oldest.getBoundingClientRect().top>oldestTopBefore+6&&Math.abs(bottom.getBoundingClientRect().bottom-bottomBefore)<2;},{oldestId,oldestTopBefore,bottomBefore},{timeout:1500});
  const stableAfter=await page.locator('.feedback-toast:not(.is-leaving)').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.feedbackId,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom})));
  assert(JSON.stringify(stableAfter.map(x=>x.id))===JSON.stringify(survivorIds),'middle-card dismissal recreated or reordered surviving feedback');
  for(let i=1;i<stableAfter.length;i++)assert(stableAfter[i].top>=stableAfter[i-1].bottom+6,`feedback overlapped after middle-card dismissal: ${JSON.stringify(stableAfter)}`);
  assert(Math.abs(stableAfter.at(-1).bottom-bottomBefore)<2,`desktop bottom anchor moved after middle-card dismissal: before=${bottomBefore}, after=${stableAfter.at(-1).bottom}`);
  const oldestAfter=stableAfter.find(x=>x.id===oldestId);
  assert(oldestAfter&&oldestAfter.top>oldestTopBefore+6,'older feedback above the removed middle card did not reflow downward into the gap');

  // Strict FIFO auto-dismiss: a later shorter duration waits for the earlier finite card to leave first.
  await page.evaluate(()=>WeiG.Feedback.dismissAll());await page.waitForTimeout(260);
  const fifo=await page.evaluate(()=>{
    const a=WeiG.toast('fifo-a','info',{title:'FIFO A',duration:260});
    const b=WeiG.toast('fifo-b','success',{title:'FIFO B',duration:80});
    const c=WeiG.toast('fifo-c','warning',{title:'FIFO C',duration:120});
    return[a.id,b.id,c.id];
  });
  await page.waitForTimeout(150);
  assert(await page.locator(`.feedback-toast[data-feedback-id=\"${fifo[1]}\"]`).count()===1,'later shorter feedback disappeared before the older finite feedback');
  assert(await page.locator(`.feedback-toast[data-feedback-id=\"${fifo[2]}\"]`).count()===1,'third feedback disappeared before FIFO predecessor');
  await page.waitForFunction(id=>document.querySelector(`.feedback-toast[data-feedback-id=\"${id}\"]`)?.classList.contains('is-leaving'),fifo[0],{timeout:800});
  assert(!(await page.locator(`.feedback-toast[data-feedback-id=\"${fifo[1]}\"]`).evaluate(n=>n.classList.contains('is-leaving'))),'second FIFO card started leaving before first finished its leave motion');
  await page.waitForFunction(id=>!document.querySelector(`.feedback-toast[data-feedback-id=\"${id}\"]`),fifo[0],{timeout:1200});
  await page.waitForFunction(id=>document.querySelector(`.feedback-toast[data-feedback-id=\"${id}\"]`)?.classList.contains('is-leaving'),fifo[1],{timeout:500});
  await page.waitForFunction(id=>!document.querySelector(`.feedback-toast[data-feedback-id=\"${id}\"]`),fifo[1],{timeout:800});
  await page.waitForFunction(id=>document.querySelector(`.feedback-toast[data-feedback-id=\"${id}\"]`)?.classList.contains('is-leaving'),fifo[2],{timeout:500});
  await page.waitForFunction(id=>!document.querySelector(`.feedback-toast[data-feedback-id=\"${id}\"]`),fifo[2],{timeout:800});

  // Error semantics and automatic lifecycle.
  const autoId=await page.evaluate(()=>WeiG.toast('automatic failure','error',{title:'Auto error',duration:180}).id);
  const auto=page.locator(`.feedback-toast[data-feedback-id="${autoId}"]`);
  await auto.waitFor();
  assert(await auto.getAttribute('role')==='alert','error feedback must use role=alert');
  await page.waitForFunction(id=>!document.querySelector(`.feedback-toast[data-feedback-id="${id}"]`),autoId,{timeout:1200});

  // Real Settings write + readback completes before success feedback.
  await page.evaluate(()=>WeiG.Feedback.dismissAll());await page.waitForTimeout(260);
  await page.locator('#app-nav [data-route="settings"]').click();
  await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active'));
  await page.locator('#settings-tabs [data-settings-tab="connection"]').click();
  await page.waitForFunction(()=>WeiG.SettingsState?.tab==='connection');
  const portRoot=':is([data-preference-key="listen_port"],[data-setting-key="listen_port"])',portInput=page.locator(portRoot+' input[type="number"]');
  await portInput.waitFor();const portTitle=String(await page.locator(portRoot+' .setting-title').textContent()).trim();await portInput.fill('6999');await portInput.press('Tab');
  await page.locator('#save-settings-btn').click();
  const settingsProcessing=page.locator('.feedback-toast[data-kind="info"]',{hasText:'Saving settings'}).first();
  await settingsProcessing.waitFor();
  const settingsId=await settingsProcessing.getAttribute('data-feedback-id');
  assert(await settingsProcessing.locator('.feedback-toast__progress').getAttribute('data-mode')==='activity','Settings processing must use activity rail');
  await page.waitForFunction(id=>document.querySelector(`.feedback-toast[data-feedback-id="${id}"]`)?.dataset.kind==='success',settingsId);
  assert((await page.locator(`.feedback-toast[data-feedback-id="${settingsId}"]`).textContent()).includes('Settings saved'),'Settings save did not update the same feedback record');
  assert((await page.locator(`.feedback-toast[data-feedback-id="${settingsId}"]`).textContent()).includes(portTitle),'Settings success feedback lost the source-owned changed-control label');
  assert(await page.locator(`.feedback-toast[data-feedback-id="${settingsId}"] .feedback-toast__progress`).getAttribute('data-mode')==='lifetime','Settings completion did not switch activity rail to lifetime');
  assert(prefs.listen_port===6999,'Settings fixture did not receive the submitted preference');

  // Real WeiG-only save must use the same Feedback owner and name the changed semantic control.
  await page.evaluate(()=>WeiG.Feedback.dismissAll());await page.waitForTimeout(260);
  await page.locator('#settings-tabs [data-settings-tab="weig"]').click();
  await page.waitForFunction(()=>WeiG.SettingsState?.tab==='weig');
  const densityRow=page.locator('[data-setting-key="weig_density"]'),densityTitle=String(await densityRow.locator('.setting-title').textContent()).trim();
  const densityControl=densityRow.locator('.ui-select'),densityCurrent=await densityControl.evaluate(node=>node.getValue());
  const densityNext=densityCurrent==='compact'?'comfortable':'compact';
  await densityControl.locator('.ui-select__trigger').click();
  await page.locator('#weig-floating-layer .ui-select__option[data-value="'+densityNext+'"]').click();
  await page.waitForFunction(value=>WeiG.SettingsState?.weigDraft?.density===value,densityNext);
  await page.locator('#save-settings-btn').click();
  const weigSuccess=page.locator('.feedback-toast[data-kind="success"]',{hasText:densityTitle}).first();
  await weigSuccess.waitFor({timeout:2500});
  assert((await weigSuccess.textContent()).includes(densityTitle),'WeiG-only save feedback lost the changed semantic control label');
  assert(Object.keys(await page.evaluate(()=>WeiG.SettingsState?.weigDraft||{})).length===0,'WeiG-only verified save did not clear its draft');

  // Real RSS add + list readback produces success through the canonical Add Feed dialog.
  await page.evaluate(()=>WeiG.Feedback.dismissAll());await page.waitForTimeout(260);
  await page.locator('#app-nav [data-route="rss"]').click();
  await page.waitForFunction(()=>document.getElementById('rss-view')?.classList.contains('is-active'));
  await page.locator('#rss-add-open-btn').click();
  await page.waitForSelector('#rss-add-dialog[open]');
  await page.locator('#rss-url').fill('https://example.test/feed.xml');
  await page.locator('#rss-add-btn').click();
  const rssProcessing=page.locator('.feedback-toast[data-kind="info"]',{hasText:'Adding RSS feed'}).first();
  await rssProcessing.waitFor();
  const rssId=await rssProcessing.getAttribute('data-feedback-id');
  assert(await rssProcessing.locator('.feedback-toast__progress').getAttribute('data-mode')==='activity','RSS processing must use activity rail');
  await page.waitForFunction(id=>document.querySelector(`.feedback-toast[data-feedback-id="${id}"]`)?.dataset.kind==='success',rssId);
  assert((await page.locator(`.feedback-toast[data-feedback-id="${rssId}"]`).textContent()).includes('RSS added'),'RSS add did not update the same feedback record');

  // Mobile uses the same Dynamic Island owner and bottom anchor above the mobile nav.
  await page.evaluate(()=>WeiG.Feedback.dismissAll());await page.waitForTimeout(260);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{
    WeiG.toast('older mobile','info',{title:'Older',duration:5000});
    WeiG.toast('A very long mobile feedback message that must wrap safely without escaping the viewport or colliding with the Android bottom navigation.','success',{title:'Newer',duration:5000});
  });
  await page.waitForFunction(()=>document.querySelectorAll('.feedback-toast:not(.is-leaving)').length===2);
  const mobile=await page.locator('.feedback-stack').evaluate(n=>{const r=n.getBoundingClientRect(),cards=[...n.querySelectorAll('.feedback-toast:not(.is-leaving)')].map(x=>({text:x.textContent,top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom}));return{left:r.left,right:innerWidth-r.right,bottom:innerHeight-r.bottom,width:r.width,cards};});
  assert(mobile.left>=11&&mobile.right>=11&&mobile.bottom>=77&&mobile.width<=392,'mobile feedback must keep the desktop island width and bottom safe anchor: '+JSON.stringify(mobile));
  assert(await page.locator('.feedback-toast:not(.is-leaving)').evaluateAll(nodes=>nodes.every(n=>{const r=n.getBoundingClientRect();return r.left>=11&&r.right<=379&&r.width<=368;})),'mobile long feedback escaped the viewport');
  const newer=mobile.cards.find(x=>x.text.includes('Newer')),older=mobile.cards.find(x=>x.text.includes('Older'));
  assert(newer&&older&&newer.top>older.top,'mobile newest feedback must use the same bottom-stack order as desktop');

  // A real mobile Settings write/readback must reuse the same verified summary card.
  await page.evaluate(()=>WeiG.Feedback.dismissAll());await page.waitForTimeout(260);
  await page.locator('#mobile-bottom-nav [data-route="settings"]').click();
  await page.waitForFunction(()=>document.getElementById('settings-view')?.classList.contains('is-active'));
  await page.locator('#settings-tabs [data-settings-tab="connection"]').click();
  await page.waitForFunction(()=>WeiG.SettingsState?.tab==='connection');
  const mobilePortRoot=':is([data-preference-key="listen_port"],[data-setting-key="listen_port"])',mobilePortInput=page.locator(mobilePortRoot+' input[type="number"]');
  await mobilePortInput.waitFor();
  const mobilePortTitle=String(await page.locator(mobilePortRoot+' .setting-title').textContent()).trim();
  await mobilePortInput.fill('7001');await mobilePortInput.press('Tab');
  await page.locator('#save-settings-btn').click();
  const mobileSettings=page.locator('.feedback-toast',{hasText:'Saving settings'}).first();
  await mobileSettings.waitFor();
  const mobileSettingsId=await mobileSettings.getAttribute('data-feedback-id');
  await page.waitForFunction(id=>document.querySelector('.feedback-toast[data-feedback-id="'+id+'"]')?.dataset.kind==='success',mobileSettingsId);
  const mobileSaved=page.locator('.feedback-toast[data-feedback-id="'+mobileSettingsId+'"]');
  const mobileSavedText=String(await mobileSaved.textContent());
  assert(mobileSavedText.includes('Settings saved')&&mobileSavedText.includes(mobilePortTitle)&&mobileSavedText.includes('7001'),'mobile Settings feedback lost the verified value/state summary: '+mobileSavedText);
  const mobileSavedRect=await mobileSaved.evaluate(n=>{const r=n.getBoundingClientRect();return{right:innerWidth-r.right,bottom:innerHeight-r.bottom,width:r.width};});
  assert(mobileSavedRect.right>=11&&mobileSavedRect.bottom>=77&&mobileSavedRect.width<=368,'mobile Settings feedback did not use the canonical bottom island geometry: '+JSON.stringify(mobileSavedRect));
  assert(prefs.listen_port===7001,'mobile Settings fixture did not receive the verified preference');

  // Light/Dark both resolve from the project theme tokens through the rendered gradient surface.
  await page.evaluate(()=>{const c=WeiG.Config.load();c.theme='light';WeiG.Config.apply(c);});
  const lightSurface=await page.locator('.feedback-toast__surface').first().evaluate(n=>({image:getComputedStyle(n).backgroundImage,color:getComputedStyle(n).backgroundColor}));
  assert(lightSurface.image&&lightSurface.image!=='none','light feedback surface lost its rendered gradient');
  await page.evaluate(()=>{const c=WeiG.Config.load();c.theme='dark';WeiG.Config.apply(c);});
  const darkSurface=await page.locator('.feedback-toast__surface').first().evaluate(n=>({image:getComputedStyle(n).backgroundImage,color:getComputedStyle(n).backgroundColor}));
  assert(darkSurface.image&&darkSurface.image!=='none'&&darkSurface.image!==lightSurface.image,`feedback gradient did not adapt between Light and Dark: ${JSON.stringify({light:lightSurface,dark:darkSurface})}`);

  // WeiG Reduced Motion disables movement/activity while preserving dismiss semantics.
  await page.evaluate(()=>{WeiG.Feedback.dismissAll();document.documentElement.dataset.motion='reduced';});
  await page.waitForTimeout(30);
  const reducedId=await page.evaluate(()=>WeiG.toast('reduced','success',{title:'Reduced',duration:5000}).id);
  const reduced=page.locator(`.feedback-toast[data-feedback-id="${reducedId}"]`);
  await reduced.waitFor();
  const transition=await reduced.locator('.feedback-toast__surface').evaluate(n=>getComputedStyle(n).transitionDuration);
  assert(transition==='0s'||transition.split(',').every(x=>parseFloat(x)===0),`reduced motion retained surface transition: ${transition}`);
  const reducedLifetime=await reduced.locator('.feedback-toast__progress').evaluate(n=>getComputedStyle(n,'::before').animationName);
  assert(reducedLifetime==='none','WeiG Reduced Motion retained lifetime rail animation');
  await reduced.locator('.feedback-toast__dismiss').click();
  await page.waitForFunction(id=>!document.querySelector(`.feedback-toast[data-feedback-id="${id}"]`),reducedId,{timeout:300});
  const reducedActivityId=await page.evaluate(()=>WeiG.toast('reduced processing','info',{title:'Reduced processing',duration:0}).id);
  const reducedActivity=page.locator(`.feedback-toast[data-feedback-id="${reducedActivityId}"] .feedback-toast__progress`);
  await reducedActivity.waitFor();
  assert(await reducedActivity.getAttribute('data-mode')==='activity','Reduced Motion processing lost activity semantics');
  assert(await reducedActivity.evaluate(n=>getComputedStyle(n,'::before').animationName)==='none','WeiG Reduced Motion retained activity rail movement');
  await page.evaluate(()=>WeiG.Feedback.dismissAll());

  assert(errors.length===0,`feedback browser errors: ${errors.join(' | ')}`);
  await context.close();

  // System Reduced Motion is a second authority independent of WeiG's explicit setting.
  const reducedContext=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',reducedMotion:'reduce'});
  const reducedPage=await reducedContext.newPage();
  await reducedPage.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});
  await reducedPage.waitForFunction(()=>window.WeiG?.Feedback&&typeof WeiG.toast==='function');
  const systemReducedId=await reducedPage.evaluate(()=>WeiG.toast('system reduced','success',{title:'System reduced',duration:5000}).id);
  const systemReduced=reducedPage.locator(`.feedback-toast[data-feedback-id="${systemReducedId}"] .feedback-toast__surface`);
  await systemReduced.waitFor();
  const systemTransition=await systemReduced.evaluate(n=>getComputedStyle(n).transitionDuration);
  const systemProgress=await reducedPage.locator(`.feedback-toast[data-feedback-id="${systemReducedId}"] .feedback-toast__progress`).evaluate(n=>getComputedStyle(n,'::before').animationName);
  assert(systemTransition==='0s'||systemTransition.split(',').every(x=>parseFloat(x)===0),`system reduced motion retained surface transition: ${systemTransition}`);
  assert(systemProgress==='none','system reduced motion retained lifecycle animation');
  const systemActivityId=await reducedPage.evaluate(()=>WeiG.toast('system processing','info',{title:'System processing',duration:0}).id);
  const systemActivity=await reducedPage.locator(`.feedback-toast[data-feedback-id="${systemActivityId}"] .feedback-toast__progress`).evaluate(n=>({mode:n.dataset.mode,animation:getComputedStyle(n,'::before').animationName}));
  assert(systemActivity.mode==='activity'&&systemActivity.animation==='none','system Reduced Motion must keep static activity semantics without movement');
  await reducedContext.close();
  console.log('Floating feedback browser regression passed: local-file Add lifecycle, real Add/Settings/RSS same-record activity-to-lifetime flow, desktop/mobile bottom-island parity, verified mobile Settings summary, Light/Dark and both Reduced Motion authorities.');
}finally{
  await browser.close();
  await new Promise(r=>server.close(r));
}
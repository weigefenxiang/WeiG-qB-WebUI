import {launchBrowser,readWebuiStatic} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../webui/private');
const publicRoot=path.resolve(here,'../webui/public');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const frozen=JSON.parse(await fs.readFile(path.resolve(here,'fixtures/qb-release-catalog.lkg.json'),'utf8'));
const frozenProfile=frozen.find(item=>item.qbVersion==='5.2.0');
if(!frozenProfile)throw new Error('Torrent detail browser gate requires frozen qB 5.2.0 profile.');
// Browser evidence consumes the current exact 5.2.0 Detail source surface without mutating the
// Frozen LKG. Full Frozen promotion remains a separate explicit gate. Tabs come from
// release-5.2.0 propertiesToolbar.html; Content column defaults come from
// DynamicTable.TorrentFilesTable. checked/remaining provenance is source-derived from
// torrent-content.js + file-tree.js and is independently locked by the source contract.
const currentSourceTabs={
  overview:{source:'General',context:'PropTabBar'},
  trackers:{source:'Trackers',context:'PropTabBar'},
  peers:{source:'Peers',context:'PropTabBar'},
  webseeds:{source:'HTTP Sources',context:'PropTabBar'},
  files:{source:'Content',context:'PropTabBar'}
};
const currentSourceTabOrder=['overview','trackers','peers','webseeds','files'];
const currentSourceFileColumns=[
  {key:'checked',caption:'',defaultWidth:50,defaultVisible:true,dataProperties:['priority']},
  {key:'name',caption:'Name',translation:{source:'Name',context:'TrackerListWidget'},defaultWidth:300,defaultVisible:true,dataProperties:['name']},
  {key:'size',caption:'Total Size',translation:{source:'Total Size',context:'TrackerListWidget'},defaultWidth:75,defaultVisible:true,dataProperties:['size']},
  {key:'progress',caption:'Progress',translation:{source:'Progress',context:'TrackerListWidget'},defaultWidth:100,defaultVisible:true,dataProperties:['progress']},
  {key:'priority',caption:'Download Priority',translation:{source:'Download Priority',context:'TrackerListWidget'},defaultWidth:150,defaultVisible:true,dataProperties:['priority']},
  {key:'remaining',caption:'Remaining',translation:{source:'Remaining',context:'TrackerListWidget'},defaultWidth:75,defaultVisible:true,dataProperties:['size','progress','priority']},
  {key:'availability',caption:'Availability',translation:{source:'Availability',context:'TrackerListWidget'},defaultWidth:75,defaultVisible:true,dataProperties:['availability']}
];
const profile=structuredClone(frozenProfile);
profile.torrentDetailUi=profile.torrentDetailUi||{};
profile.torrentDetailUi.tabs=currentSourceTabs;
profile.torrentDetailUi.tabOrder=currentSourceTabOrder;
profile.torrentDetailUi.tables=profile.torrentDetailUi.tables||{};
profile.torrentDetailUi.tables.files=currentSourceFileColumns;
const fileColumns=profile.torrentDetailUi.tables.files;
for(const key of ['checked','name','size','progress','remaining','priority'])if(!fileColumns.some(column=>column.key===key))throw new Error(`Current qB 5.2.0 Content source overlay is missing ${key}.`);

const host='127.0.0.1',port=8777;
const hash='d'.repeat(40);
const torrent={hash,name:'Detail source browser fixture — '+('long title ownership '.repeat(12)),size:64*1024*1024,progress:1,dlspeed:0,upspeed:2048,eta:0,state:'stalledUP',ratio:.5,tracker:'https://tracker.example/announce?token=exact',category:'Detail',tags:'source',num_seeds:5,num_leechs:2,save_path:'/downloads',added_on:1700000000,completion_on:0,priority:1,private:false};
const files=Array.from({length:40},(_,index)=>({index,name:`folder/file-${String(index).padStart(2,'0')}.bin`,size:1048576,progress:index<2?.25:Math.min(.95,.1+(index%9)/10),priority:index===0?0:1,is_seed:false,piece_range:[index,index+1],availability:.8}));
const properties={save_path:'/downloads',total_size:torrent.size,time_elapsed:300,seeding_time:0,eta:900,nb_connections:4,nb_connections_limit:100,total_downloaded:16*1024*1024,total_downloaded_session:4*1024*1024,total_uploaded:2*1024*1024,total_uploaded_session:512*1024,dl_speed:65536,dl_speed_avg:60000,up_speed:2048,up_speed_avg:1800,dl_limit:-1,up_limit:-1,total_wasted:0,seeds:5,seeds_total:12,peers:2,peers_total:9,share_ratio:.5,popularity:1,reannounce:120,pieces_num:256,piece_size:262144,pieces_have:64,created_by:'fixture',last_seen:1700000100,addition_date:1700000000,completion_date:0,creation_date:1699990000,download_path:'/downloads',comment:'detail browser evidence',private:false,has_metadata:true,progress:.25};
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
const text=(res,value,status=200)=>{res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));};
const empty=(res,status=200)=>{res.writeHead(status,{'cache-control':'no-store'});res.end('');};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function api(req,res,p,url){
  if(p==='app/version')return text(res,'v'+profile.qbVersion);
  if(p==='app/webapiVersion')return text(res,profile.webApiVersion||'2.11.4');
  if(p==='app/preferences')return json(res,{save_path:'/downloads',alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',locale:'en'});
  if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:65536,up_info_speed:2048,dl_info_data:16*1024*1024,up_info_data:2*1024*1024,connection_status:'connected'});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{Detail:{name:'Detail',savePath:'/downloads'}},tags:['source'],server_state:{connection_status:'connected',dht_nodes:24,total_peer_connections:7,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){
    const hashes=url.searchParams.get('hashes');
    let out=!hashes||hashes.split('|').includes(hash)?[torrent]:[];
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||0);
    return json(res,limit?out.slice(offset,offset+limit):out.slice(offset));
  }
  if(p==='torrents/properties')return json(res,properties);
  if(p==='torrents/files')return json(res,files);
  if(p==='torrents/trackers')return json(res,[{url:'https://tracker.example/announce?token=exact',status:2,tier:0,msg:'Working',num_peers:4,num_seeds:8,num_leeches:2,num_downloaded:12,next_announce:120,min_announce:60,endpoints:[]}]);
  if(p==='sync/torrentPeers')return json(res,{rid:1,full_update:true,peers:{}});
  if(p==='torrents/webseeds')return json(res,[{url:'https://cdn.example/files/'}]);
  if(p==='torrents/categories')return json(res,{Detail:{name:'Detail',savePath:'/downloads'}});
  if(p==='torrents/tags')return json(res,['source']);
  if(['search/plugins','log/main','log/peers'].includes(p))return json(res,[]);
  if(p==='rss/items')return json(res,{});
  if(req.method==='POST')return empty(res);
  return json(res,{});
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${host}:${port}`),rel=url.pathname.replace(/^\//,'');
    if(rel.startsWith('api/v2/'))return api(req,res,rel.slice(7),url);
    if(rel==='data/qb-releases.json')return json(res,[profile]);
    if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'detail-browser-fixture',qbPath:'/config/weigg-qb-webui'});
    const {file,body}=await readWebuiStatic([root,publicRoot],rel||'index.html');
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});res.end(body);
  }catch(error){res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});res.end(String(error));}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

async function columnLabel(page,key){return page.evaluate(key=>window.WeiG?.QbUiEvidence?.detailColumns?.('files')?.find?.(column=>column.key===key)?.label||key,key);}
async function setColumnVisible(page,key,visible){
  const present=await page.locator(`.shared-table__head .grid-head-cell[data-key="${key}"]`).count()>0;
  if(present===visible)return;
  await page.locator('.shared-table__toolbar button').first().click();
  await page.waitForSelector('#column-configurator-dialog[open]');
  const label=await columnLabel(page,key),box=page.getByRole('checkbox',{name:label,exact:true});
  if((await box.isChecked())!==visible)await box.click();
  await page.locator('#column-configurator-dialog .dialog__actions button').last().click();
  await page.waitForFunction(({key,visible})=>!!document.querySelector(`.shared-table__head .grid-head-cell[data-key="${key}"]`)===visible,{key,visible});
}
async function touch(cdp,type,x,y){const touchPoints=type==='touchEnd'?[]:[{x,y,radiusX:2,radiusY:2,force:1,id:1}];await cdp.send('Input.dispatchTouchEvent',{type,touchPoints});}

const browser=await launchBrowser();
try{
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(message.text()))errors.push(message.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector(`.torrent-row[data-hash="${hash}"] .torrent-title`);
  await page.locator(`.torrent-row[data-hash="${hash}"] .torrent-title`).click();
  await page.waitForSelector('#detail-view.is-active');
  const headerLayout=await page.evaluate(()=>{const hero=document.querySelector('.detail-hero'),eyebrow=hero&&hero.querySelector(':scope>.eyebrow'),state=document.getElementById('detail-state'),progress=hero&&hero.querySelector(':scope>.detail-progress'),track=progress&&progress.querySelector('.progress-track'),pct=document.getElementById('detail-progress-text'),title=document.getElementById('detail-title'),range=document.createRange();range.selectNodeContents(pct);const box=x=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,cy:r.y+r.height/2};};return{direct:!!(hero&&eyebrow&&state&&title&&progress&&eyebrow.parentElement===hero&&state.parentElement===hero&&title.parentElement===hero&&progress.parentElement===hero),hero:box(hero),eyebrow:box(eyebrow),state:box(state),progress:box(progress),track:box(track),pct:box(pct),pctTextRight:range.getBoundingClientRect().right,pctAlign:getComputedStyle(pct).textAlign,title:box(title),text:pct.textContent,stateText:state.textContent};});
  assert(headerLayout.direct,'Detail four-corner nodes must be direct children of the canonical detail-hero geometry owner.');
  assert(Math.abs(headerLayout.eyebrow.cy-headerLayout.state.cy)<3,'Torrent Detail and state must share the top row: '+JSON.stringify(headerLayout));
  assert(Math.abs(headerLayout.title.cy-headerLayout.progress.cy)<4,'Torrent title and progress must share the bottom row: '+JSON.stringify(headerLayout));
  assert(Math.abs(headerLayout.eyebrow.x-headerLayout.title.x)<2,'Detail left corners are not aligned: '+JSON.stringify(headerLayout));
  assert(Math.abs(headerLayout.state.right-headerLayout.progress.right)<2,'Detail right corners are not aligned: '+JSON.stringify(headerLayout));
  assert(Math.abs(headerLayout.track.cy-headerLayout.pct.cy)<3&&headerLayout.text==='100%','Detail progress track and percentage must share one 100% row: '+JSON.stringify(headerLayout));
  assert(headerLayout.pctAlign==='right'&&Math.abs(headerLayout.pctTextRight-headerLayout.state.right)<3,'Detail percentage glyph must end-align to the same right boundary as the state owner: '+JSON.stringify(headerLayout));
  assert(headerLayout.title.right<headerLayout.progress.x,'Long Detail title overlaps the right progress owner: '+JSON.stringify(headerLayout));
  await page.locator('.detail-tabs [data-tab="files"]').click();
  await page.waitForSelector('.shared-table__viewport .shared-table__row');
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('detail-content')).display==='flex');

  for(const key of ['checked','name','size','progress','remaining','priority'])await setColumnVisible(page,key,true);

  const geometry=await page.evaluate(()=>{const tabs=document.querySelector('.detail-tabs').getBoundingClientRect(),content=document.getElementById('detail-content').getBoundingClientRect(),status=document.querySelector('.statusbar').getBoundingClientRect(),viewport=document.querySelector('.shared-table__viewport').getBoundingClientRect(),style=getComputedStyle(document.getElementById('detail-content'));return{tabsBottom:tabs.bottom,contentTop:content.top,contentBottom:content.bottom,statusTop:status.top,contentHeight:content.height,viewportBottom:viewport.bottom,flexGrow:style.flexGrow,minHeight:style.minHeight};});
  assert(geometry.contentTop>=geometry.tabsBottom-1,`Detail Content overlaps tabs: ${JSON.stringify(geometry)}`);
  assert(geometry.statusTop>=geometry.contentBottom&&geometry.statusTop-geometry.contentBottom<24,`Detail Content does not fill to Statusbar: ${JSON.stringify(geometry)}`);
  assert(geometry.contentHeight>250&&geometry.viewportBottom<=geometry.contentBottom+1&&Number(geometry.flexGrow)>0&&geometry.minHeight==='0px',`Detail flex ownership is not active: ${JSON.stringify(geometry)}`);

  const tableAlignment=await page.evaluate(()=>{const head=document.querySelector('.shared-table__head .grid-head-cell[data-key="size"]'),cell=document.querySelector('.shared-table__row [data-column-key="size"]');return{headAlign:head&&head.dataset.align,cellAlign:cell&&cell.dataset.align,headText:head&&getComputedStyle(head).textAlign,cellText:cell&&getComputedStyle(cell).textAlign};});
  assert(tableAlignment.headAlign==='start'&&tableAlignment.cellAlign==='start'&&tableAlignment.headText==='left'&&tableAlignment.cellText==='left',`Ordinary numeric detail columns must share the canonical left/start alignment: ${JSON.stringify(tableAlignment)}`);
  const hierarchy=await page.evaluate(()=>({firstKind:document.querySelector('.shared-table__row')?.dataset.fileKind||'',folderCount:document.querySelectorAll('.shared-table__row[data-file-kind="folder"]').length,fileCount:document.querySelectorAll('.shared-table__row[data-file-kind="file"]').length}));
  assert(hierarchy.firstKind==='folder'&&hierarchy.folderCount>=1&&hierarchy.fileCount>=2,`Content hierarchy did not preserve the synthetic folder row above source file rows: ${JSON.stringify(hierarchy)}`);
  const derived=await page.evaluate(()=>{const rows=[...document.querySelectorAll('.shared-table__row[data-file-kind="file"]')].slice(0,2),fmt=window.WeiG.util.formatBytes;return{rows:rows.map(row=>({checked:row.querySelector('[data-column-key="checked"] input[type="checkbox"]')?.checked,remaining:row.querySelector('[data-column-key="remaining"]')?.textContent?.trim()})),expectedIgnored:fmt(0),expectedNormal:fmt(1048576*(1-.25))};});
  assert(derived.rows.length===2,'Content browser gate did not render the first two source file rows beneath the hierarchy.');
  assert(derived.rows[0].checked===false&&derived.rows[1].checked===true,`Source-driven checked state is wrong: ${JSON.stringify(derived.rows)}`);
  assert(derived.rows[0].remaining===derived.expectedIgnored,`Ignored-file remaining must be zero: ${JSON.stringify(derived)}`);
  assert(derived.rows[1].remaining===derived.expectedNormal,`Source-driven remaining formula is wrong: ${JSON.stringify(derived)}`);

  await page.locator('.shared-table__toolbar button').first().click();
  await page.waitForSelector('#column-configurator-dialog[open]');
  const progressLabel=await columnLabel(page,'progress'),progressBox=page.getByRole('checkbox',{name:progressLabel,exact:true});
  assert(await progressBox.isChecked(),'Column settings did not reflect source-visible Progress state.');
  await progressBox.click();
  await page.waitForFunction(()=>!document.querySelector('.shared-table__head .grid-head-cell[data-key="progress"]'));
  const hiddenState=await page.evaluate(()=>window.WeiG.SharedColumns.read('torrent-detail-files'));
  assert(hiddenState.visibility?.progress===false,`Column settings did not persist visibility through canonical owner: ${JSON.stringify(hiddenState)}`);
  await progressBox.click();
  await page.waitForFunction(()=>!!document.querySelector('.shared-table__head .grid-head-cell[data-key="progress"]'));
  await page.locator('#column-configurator-dialog .dialog__actions button').last().click();

  const nameHead=page.locator('.shared-table__head .grid-head-cell[data-key="name"]'),resize=nameHead.locator('.col-resize');
  const beforeBox=await nameHead.boundingBox(),handle=await resize.boundingBox();
  assert(beforeBox&&handle,'Detail Name resize handle is missing.');
  const persistedBefore=await page.evaluate(()=>JSON.stringify(window.WeiG.SharedColumns.read('torrent-detail-files')));
  const resizeDelta=await page.evaluate(()=>{const viewport=document.querySelector('.shared-table__viewport'),widths=[...document.querySelectorAll('.shared-table__head .grid-head-cell')].reduce((sum,node)=>sum+node.getBoundingClientRect().width,0);return Math.max(360,Math.ceil(viewport.clientWidth-widths+180));});
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+resizeDelta,handle.y+handle.height/2,{steps:8});
  const duringBox=await nameHead.boundingBox(),persistedDuring=await page.evaluate(()=>JSON.stringify(window.WeiG.SharedColumns.read('torrent-detail-files')));
  assert(duringBox.width>beforeBox.width+resizeDelta-40,`Resize pointermove did not paint live geometry: ${beforeBox.width} -> ${duringBox.width}, delta=${resizeDelta}`);
  assert(persistedDuring===persistedBefore,'Resize pointermove persisted state before pointerup.');
  await page.mouse.up();
  const persistedAfter=await page.evaluate(()=>window.WeiG.SharedColumns.read('torrent-detail-files'));
  assert(Number(persistedAfter.widths?.name)>beforeBox.width+resizeDelta-40,`Resize pointerup did not commit canonical width: ${JSON.stringify({persistedAfter,resizeDelta})}`);

  const orderBefore=await page.evaluate(()=>[...document.querySelectorAll('.shared-table__head .grid-head-cell')].map(node=>node.dataset.key));
  const sizeHead=page.locator('.shared-table__head .grid-head-cell[data-key="size"]'),sizeBox=await sizeHead.boundingBox(),nameBox=await nameHead.boundingBox();
  assert(sizeBox&&nameBox,'Detail reorder headers are missing.');
  await page.mouse.move(sizeBox.x+Math.min(24,sizeBox.width/3),sizeBox.y+sizeBox.height/2);await page.mouse.down();await page.mouse.move(sizeBox.x+50,sizeBox.y+sizeBox.height/2,{steps:3});await page.mouse.move(nameBox.x+Math.min(24,nameBox.width/3),nameBox.y+nameBox.height/2,{steps:8});await page.mouse.up();
  await page.waitForTimeout(80);
  const orderAfter=await page.evaluate(()=>[...document.querySelectorAll('.shared-table__head .grid-head-cell')].map(node=>node.dataset.key));
  assert(JSON.stringify(orderAfter)!==JSON.stringify(orderBefore),`Desktop pointer reorder did not change source column order: ${JSON.stringify(orderAfter)}`);
  const savedOrder=await page.evaluate(()=>window.WeiG.SharedColumns.read('torrent-detail-files').order||[]);
  assert(savedOrder.length&&JSON.stringify(savedOrder)===JSON.stringify(orderAfter),`Desktop reorder did not commit the canonical order once: ${JSON.stringify(savedOrder)} vs ${JSON.stringify(orderAfter)}`);

  const scroll=await page.evaluate(()=>{const viewport=document.querySelector('.shared-table__viewport'),head=viewport.querySelector('.shared-table__head .grid-head-cell'),key=head.dataset.key,row=viewport.querySelector(`.shared-table__row [data-column-key="${key}"]`),a={h:head.getBoundingClientRect().left,r:row.getBoundingClientRect().left};viewport.scrollLeft=180;viewport.dispatchEvent(new Event('scroll'));const b={h:head.getBoundingClientRect().left,r:row.getBoundingClientRect().left};return{scrollLeft:viewport.scrollLeft,scrollWidth:viewport.scrollWidth,clientWidth:viewport.clientWidth,detailScrollLeft:document.getElementById('detail-content').scrollLeft,a,b};});
  assert(scroll.scrollWidth>scroll.clientWidth&&scroll.scrollLeft>100,`Detail table did not expose real horizontal overflow: ${JSON.stringify(scroll)}`);
  assert(Math.abs((scroll.a.h-scroll.b.h)-scroll.scrollLeft)<3&&Math.abs((scroll.a.r-scroll.b.r)-scroll.scrollLeft)<3&&Math.abs((scroll.a.h-scroll.a.r)-(scroll.b.h-scroll.b.r))<2,`Header/body horizontal scroll ownership diverged: ${JSON.stringify(scroll)}`);
  assert(scroll.detailScrollLeft===0,'Outer detail-content stole horizontal scroll ownership from shared table viewport.');

  await page.setViewportSize({width:390,height:844});
  await page.waitForSelector('.shared-table__viewport .shared-table__row');
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await page.evaluate(()=>{const viewport=document.querySelector('.shared-table__viewport');viewport.scrollTop=120;viewport.scrollLeft=0;});
  const touchBefore=await page.evaluate(()=>({order:[...document.querySelectorAll('.shared-table__head .grid-head-cell')].map(node=>node.dataset.key),saved:JSON.stringify(window.WeiG.SharedColumns.read('torrent-detail-files')),top:document.querySelector('.shared-table__viewport').scrollTop}));
  const firstBox=await page.locator('.shared-table__head .grid-head-cell').first().boundingBox();assert(firstBox,'Mobile detail header is missing.');
  const tx=firstBox.x+Math.min(24,firstBox.width/2),ty=firstBox.y+firstBox.height/2;
  await touch(cdp,'touchStart',tx,ty);await touch(cdp,'touchMove',tx,ty-45);await touch(cdp,'touchMove',tx,ty-95);await touch(cdp,'touchEnd',tx,ty-95);await page.waitForTimeout(160);
  const touchAfter=await page.evaluate(()=>({order:[...document.querySelectorAll('.shared-table__head .grid-head-cell')].map(node=>node.dataset.key),saved:JSON.stringify(window.WeiG.SharedColumns.read('torrent-detail-files')),top:document.querySelector('.shared-table__viewport').scrollTop}));
  assert(JSON.stringify(touchAfter.order)===JSON.stringify(touchBefore.order)&&touchAfter.saved===touchBefore.saved,`Ordinary mobile touch scroll accidentally reordered columns: ${JSON.stringify({touchBefore,touchAfter})}`);
  assert(touchAfter.top!==touchBefore.top,`Ordinary mobile touch gesture did not remain scrollable: ${JSON.stringify({touchBefore,touchAfter})}`);

  const longBefore=touchAfter.order,heads=page.locator('.shared-table__head .grid-head-cell'),first=await heads.nth(0).boundingBox(),second=await heads.nth(1).boundingBox();assert(first&&second,'Mobile long-press reorder targets are missing.');
  const sx=first.x+Math.min(20,first.width/2),sy=first.y+first.height/2,dx=second.x+Math.min(second.width-8,Math.max(20,second.width*.75)),dy=second.y+second.height/2;
  await touch(cdp,'touchStart',sx,sy);await page.waitForTimeout(340);await touch(cdp,'touchMove',dx,dy);await page.waitForTimeout(70);await touch(cdp,'touchEnd',dx,dy);await page.waitForTimeout(120);
  const longAfter=await page.evaluate(()=>({order:[...document.querySelectorAll('.shared-table__head .grid-head-cell')].map(node=>node.dataset.key),saved:window.WeiG.SharedColumns.read('torrent-detail-files').order||[]}));
  assert(JSON.stringify(longAfter.order)!==JSON.stringify(longBefore),`Mobile long-press/drag did not reorder columns: ${JSON.stringify(longAfter.order)}`);
  assert(JSON.stringify(longAfter.saved)===JSON.stringify(longAfter.order),`Mobile long-press reorder did not persist through canonical owner: ${JSON.stringify(longAfter)}`);
  assert(errors.length===0,`Torrent detail browser errors: ${errors.join(' | ')}`);
  await context.close();
  console.log('Torrent detail browser gate passed: user-path detail opening, full-height Content workspace, source hierarchy plus file-derived checked/remaining, shared horizontal scroll, DOM column settings, pointer resize/reorder, touch-scroll cancellation and long-press reorder are proven in hosted Chrome.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

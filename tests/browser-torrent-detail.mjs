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
const currentSourceFileMenu=[
  {id:'Rename',translation:{source:'Rename...',context:'PropertiesWidget'}},
  {id:'FilePrio',translation:{source:'Priority',context:'PropertiesWidget'},semantic:'file-priority',children:[
    {id:'FilePrioIgnore',translation:{source:'Do not download',context:'PropListDelegate'},semantic:'file-priority-value',priorityValue:'0'},
    {id:'FilePrioNormal',translation:{source:'Normal',context:'PropListDelegate'},semantic:'file-priority-value',priorityValue:'1'},
    {id:'FilePrioHigh',translation:{source:'High',context:'PropListDelegate'},semantic:'file-priority-value',priorityValue:'6'},
    {id:'FilePrioMaximum',translation:{source:'Maximum',context:'PropListDelegate'},semantic:'file-priority-value',priorityValue:'7'}
  ]}
];
const currentSourceWebseedMenu=[
  {id:'AddWebSeeds',translation:{source:'Add web seeds...',context:'PropertiesWidget'},endpoint:'torrents/addWebSeeds',sourceAction:'torrentscontroller.h:addWebSeedsAction'},
  {id:'RemoveWebSeed',translation:{source:'Remove web seed',context:'PropertiesWidget'},endpoint:'torrents/removeWebSeeds',sourceAction:'torrentscontroller.h:removeWebSeedsAction',availability:{minSelection:1}},
  {id:'CopyWebseedUrl',translation:{source:'Copy web seed URL',context:'PropertiesWidget'},availability:{minSelection:1}},
  {id:'EditWebSeed',translation:{source:'Edit web seed URL...',context:'PropertiesWidget'},endpoint:'torrents/editWebSeed',sourceAction:'torrentscontroller.h:editWebSeedAction',availability:{minSelection:1,maxSelection:1}}
];
const profile=structuredClone(frozenProfile);
profile.torrentDetailUi=profile.torrentDetailUi||{};
profile.torrentDetailUi.tabs=currentSourceTabs;
profile.torrentDetailUi.tabOrder=currentSourceTabOrder;
profile.torrentDetailUi.tables=profile.torrentDetailUi.tables||{};
profile.torrentDetailUi.tables.files=currentSourceFileColumns;
profile.torrentDetailUi.contextMenus={...(profile.torrentDetailUi.contextMenus||{}),files:currentSourceFileMenu,webseeds:currentSourceWebseedMenu};
const fileColumns=profile.torrentDetailUi.tables.files;
for(const key of ['checked','name','size','progress','remaining','priority','availability'])if(!fileColumns.some(column=>column.key===key))throw new Error(`Current qB 5.2.0 Content source overlay is missing ${key}.`);

const host='127.0.0.1',port=8777;
const hash='d'.repeat(40),hash2='e'.repeat(40);
const torrent={hash,name:'Detail source browser fixture — '+('long title ownership '.repeat(12)),size:Math.round(410.39*1024*1024*1024),progress:1,dlspeed:0,upspeed:2048,eta:0,state:'stalledUP',ratio:.5,tracker:'https://tracker.example/announce?token=exact',category:'Detail',tags:'source',num_seeds:5,num_leechs:2,save_path:'/downloads',added_on:1700000000,completion_on:0,priority:1,private:false};
const torrent2=Object.assign({},torrent,{hash:hash2,name:'Detail second torrent fixture — '+('mobile floating title '.repeat(10))});
const iconFixtures=['clip.mp4','photo.jpg','installer.exe','notes.txt','archive.zip','report.pdf','script.js','song.flac'];
const files=Array.from({length:40},(_,index)=>({index,name:`${index<2?'folder-a':'folder-b'}/${iconFixtures[index]||('file-'+String(index).padStart(2,'0')+'.bin')}`,size:1048576,progress:index<2?.25:Math.min(.95,.1+(index%9)/10),priority:index===0?0:1,is_seed:index===0,piece_range:[index,index+1],availability:index===0?-1:index===1?0:.8}));
const filePrioWrites=[];
const properties={save_path:'/downloads',total_size:torrent.size,time_elapsed:176*86400+6*3600,seeding_time:176*86400+6*3600,eta:900,nb_connections:4,nb_connections_limit:100,total_downloaded:16*1024*1024,total_downloaded_session:4*1024*1024,total_uploaded:2*1024*1024,total_uploaded_session:512*1024,dl_speed:65536,dl_speed_avg:60000,up_speed:2048,up_speed_avg:1800,dl_limit:-1,up_limit:-1,total_wasted:0,seeds:5,seeds_total:12,peers:2,peers_total:9,share_ratio:.5,popularity:1,reannounce:120,pieces_num:52531,piece_size:8*1024*1024,pieces_have:52531,infohash_v1:hash,infohash_v2:'',created_by:'',last_seen:1700000100,addition_date:-1,completion_date:-1,creation_date:-1,download_path:'/downloads',comment:'',private:false,has_metadata:true,progress:.25};
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
async function waitDetailViewportIdle(page,expected){
  expected=expected||{};
  await page.waitForFunction(({top,left})=>{
    const owner=window.WeiG&&WeiG.AppState&&WeiG.AppState.detailViewport,viewport=owner&&owner.el,root=document.getElementById('detail-content');
    if(!owner||!viewport||!viewport.isConnected||!root||!root.contains(viewport)||owner._scrolling||owner._hasPendingItems||viewport.__weigDataViewportScrollIdleTimer)return false;
    if(top!=null&&Math.abs(viewport.scrollTop-top)>.5)return false;
    if(left!=null&&Math.abs(viewport.scrollLeft-left)>.5)return false;
    return true;
  },{top:expected.top??null,left:expected.left??null},{timeout:3000});
}
async function resetDetailViewport(page){
  await page.waitForFunction(()=>{
    const owner=window.WeiG&&WeiG.AppState&&WeiG.AppState.detailViewport,viewport=owner&&owner.el,root=document.getElementById('detail-content');
    if(!owner||!viewport||!viewport.isConnected||!root||!root.contains(viewport)||owner._scrolling||owner._hasPendingItems||viewport.__weigDataViewportScrollIdleTimer||typeof owner.resetScroll!=='function')return false;
    owner.resetScroll();
    viewport.scrollLeft=0;
    return window.WeiG?.AppState?.detailViewport===owner&&owner.el===viewport&&viewport.isConnected&&root.contains(viewport);
  },undefined,{timeout:3000});
  await waitDetailViewportIdle(page,{top:0,left:0});
}
async function visibleDetailBodyPoint(page){
  const handle=await page.waitForFunction(()=>{
    const owner=window.WeiG&&WeiG.AppState&&WeiG.AppState.detailViewport,viewport=owner&&owner.el,root=document.getElementById('detail-content'),head=viewport&&viewport.querySelector('.shared-table__head');
    if(!viewport||!viewport.isConnected||!root||!root.contains(viewport))return false;
    const vr=viewport.getBoundingClientRect(),hr=head&&head.getBoundingClientRect(),bodyTop=Math.max(vr.top,hr?hr.bottom:vr.top)+2,bodyBottom=vr.bottom-2;
    const cells=[...viewport.querySelectorAll('.shared-table__row:not([hidden]) [data-column-key]')].filter(cell=>cell.dataset.columnKey!=='checked');
    for(const cell of cells){
      const r=cell.getBoundingClientRect(),left=Math.max(vr.left+2,r.left+2),right=Math.min(vr.right-2,r.right-2),top=Math.max(bodyTop,r.top+2),bottom=Math.min(bodyBottom,r.bottom-2);
      if(right-left<8||bottom-top<8)continue;
      for(const fraction of [.5,.75,.25]){
        const x=left+(right-left)*fraction,y=top+(bottom-top)/2,node=document.elementFromPoint(x,y);
        if(!node||!viewport.contains(node)||!node.closest('.shared-table__row'))continue;
        if(node.closest('button,input,a,select,textarea,[role="button"],[role="checkbox"]'))continue;
        return{x,y,column:cell.dataset.columnKey,tag:node.tagName,className:String(node.className||'')};
      }
    }
    return false;
  },undefined,{timeout:2000});
  const point=await handle.jsonValue();await handle.dispose();return point;
}
async function waitFixture(predicate,message,timeout=5000){const started=Date.now();while(!predicate()){if(Date.now()-started>timeout)throw new Error(message);await new Promise(resolve=>setTimeout(resolve,20));}}
const json=(res,value,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));};
const text=(res,value,status=200)=>{res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(value));};
const empty=(res,status=200)=>{res.writeHead(status,{'cache-control':'no-store'});res.end('');};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
async function readForm(req){let body='';for await(const chunk of req)body+=chunk;return new URLSearchParams(body);}
async function api(req,res,p,url){
  if(p==='app/version')return text(res,'v'+profile.qbVersion);
  if(p==='app/webapiVersion')return text(res,profile.webApiVersion||'2.11.4');
  if(p==='app/preferences')return json(res,{save_path:'/downloads',alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui',locale:'en'});
  if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:65536,up_info_speed:2048,dl_info_data:16*1024*1024,up_info_data:2*1024*1024,connection_status:'connected'});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{Detail:{name:'Detail',savePath:'/downloads'}},tags:['source'],server_state:{connection_status:'connected',dht_nodes:24,total_peer_connections:7,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){
    const hashes=url.searchParams.get('hashes'),all=[torrent,torrent2];
    let out=!hashes?all:all.filter(item=>hashes.split('|').includes(item.hash));
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||0);
    return json(res,limit?out.slice(offset,offset+limit):out.slice(offset));
  }
  if(p==='torrents/properties')return json(res,properties);
  if(p==='torrents/files')return json(res,files);
  if(p==='torrents/filePrio'&&req.method==='POST'){const form=await readForm(req),ids=String(form.get('id')||'').split('|').map(Number).filter(Number.isFinite),priority=Number(form.get('priority'));filePrioWrites.push({ids:ids.slice(),priority});ids.forEach(id=>{if(files[id])files[id].priority=priority;});return empty(res);}
  if(p==='torrents/trackers')return json(res,[{url:'** [DHT] **',status:0,tier:-1,msg:'',num_peers:-1,num_seeds:-1,num_leeches:-1,num_downloaded:-1,next_announce:0,min_announce:0,endpoints:[]},{url:'** [PeX] **',status:0,tier:-1,msg:'',num_peers:-1,num_seeds:-1,num_leeches:-1,num_downloaded:-1,next_announce:0,min_announce:0,endpoints:[]},{url:'** [LSD] **',status:0,tier:-1,msg:'',num_peers:-1,num_seeds:-1,num_leeches:-1,num_downloaded:-1,next_announce:0,min_announce:0,endpoints:[]},{url:'https://z-tracker.example/announce',status:2,tier:2,msg:'Z parent',num_peers:3,num_seeds:7,num_leeches:1,num_downloaded:9,next_announce:120,min_announce:60,endpoints:[{name:'z-endpoint.example:443',bt_version:2,status:2,msg:'Z endpoint',num_peers:3,num_seeds:7,num_leeches:1,num_downloaded:9,next_announce:90,min_announce:45}]},{url:'https://a-tracker.example/announce',status:2,tier:0,msg:'A parent',num_peers:4,num_seeds:8,num_leeches:2,num_downloaded:12,next_announce:120,min_announce:60,endpoints:[{name:'z-child.example:443',bt_version:2,status:2,msg:'Z child',num_peers:2,num_seeds:4,num_leeches:1,num_downloaded:6,next_announce:80,min_announce:40},{name:'a-child.example:443',bt_version:1,status:2,msg:'A child',num_peers:1,num_seeds:3,num_leeches:0,num_downloaded:5,next_announce:70,min_announce:35}]}]);
  if(p==='sync/torrentPeers')return json(res,{rid:1,full_update:true,peers:{'112.46.3.128:2028':{ip:'112.46.3.128',port:2028,connection:'BT',flags:'',flags_desc:'',client:'fixture',progress:0,dl_speed:0,up_speed:0,downloaded:0,uploaded:0,relevance:0,files:'',country:'China',country_code:'cn'},'2001:b011::1:1825':{ip:'2001:b011::1',port:1825,connection:'BT',flags:'U H E',flags_desc:'',client:'BitComet 2.03',progress:.056,dl_speed:0,up_speed:40192,downloaded:0,uploaded:177000000,relevance:0,files:'',country:'Taiwan',country_code:'tw'}}});
  if(p==='torrents/webseeds')return json(res,[{url:'https://z-cdn.example/files/'},{url:'https://a-cdn.example/files/'}]);
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
    if(rel.startsWith('api/v2/'))return await api(req,res,rel.slice(7),url);
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
async function dataGridFrameGeometry(page,{frame,head,row}){
  const handle=await page.waitForFunction(({frame,head,row})=>{const f=document.querySelector(frame),h=f&&f.querySelector(head),hc=h&&h.querySelector(':scope > .grid-head-cell'),r=row&&f?[...f.querySelectorAll(row)].find(node=>node.querySelector(':scope > [data-column-key]')):null,rc=r&&r.querySelector(':scope > [data-column-key]');if(!f||!h||!hc||!r||!rc)return null;const fr=f.getBoundingClientRect(),hr=h.getBoundingClientRect(),hcr=hc.getBoundingClientRect(),rr=r.getBoundingClientRect(),rcr=rc.getBoundingClientRect(),hs=getComputedStyle(h),hcs=getComputedStyle(hc),rs=getComputedStyle(r),rcs=getComputedStyle(rc);return{headFrameInset:hcr.left-fr.left,rowFrameInset:rcr.left-fr.left,headInset:hcr.left-hr.left,rowInset:rcr.left-rr.left,headPaddingLeft:hs.paddingLeft,rowPaddingLeft:rs.paddingLeft,headCellPaddingLeft:hcs.paddingLeft,rowCellPaddingLeft:rcs.paddingLeft};},{frame,head,row});
  try{return await handle.jsonValue();}finally{await handle.dispose();}
}
async function assertDetailFrameGeometry(page,main,surface){const detail=await dataGridFrameGeometry(page,{frame:'#detail-content',head:'.shared-table__head',row:'.shared-table__row:not([hidden])'});assert(detail&&Math.abs(detail.headFrameInset-main.headFrameInset)<=1.5&&Math.abs(detail.rowFrameInset-main.rowFrameInset)<=1.5&&Math.abs(detail.headInset-main.headInset)<=1.5&&Math.abs(detail.rowInset-main.rowInset)<=1.5&&detail.headCellPaddingLeft===main.headCellPaddingLeft&&detail.rowCellPaddingLeft===main.rowCellPaddingLeft,surface+' Detail table must consume the same shared DataGrid frame/header gutter as the main Torrent grid: '+JSON.stringify({main,detail}));return detail;}

const browser=await launchBrowser();
try{
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(message.text()))errors.push(message.text());});
  await page.goto(`http://${host}:${port}/#/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector(`.torrent-row[data-hash="${hash}"] .torrent-title`);
  const mainGridFrame=await dataGridFrameGeometry(page,{frame:'.torrent-panel',head:'#torrent-table-head',row:`.torrent-row[data-hash="${hash}"]`});
  assert(mainGridFrame&&mainGridFrame.headFrameInset>0&&Math.abs(mainGridFrame.headFrameInset-mainGridFrame.rowFrameInset)<=1.5&&mainGridFrame.headCellPaddingLeft==='0px'&&mainGridFrame.rowCellPaddingLeft==='0px','Main Torrent grid must expose one shared frame gutter outside zero-inline-padding cells: '+JSON.stringify(mainGridFrame));

  // A37 regression: zero-selection Detail capture must skip a row that is only geometrically present beneath the sticky Torrent header.
  const unobscuredSetup=await page.evaluate(()=>{const list=document.getElementById('torrent-list'),v=window.WeiG?.AppState?.viewport,head=document.getElementById('torrent-table-head');if(!list||!v||!head)throw new Error('Torrent DataViewport unavailable');list.style.setProperty('height','120px','important');list.style.setProperty('flex','0 0 120px');v.refreshGeometry();list.scrollTop=Math.min(Math.max(1,Math.floor(v.rowHeight/2)),Math.max(1,list.scrollHeight-list.clientHeight));list.dispatchEvent(new Event('scroll'));return{scrollTop:list.scrollTop,rowHeight:v.rowHeight};});
  assert(unobscuredSetup.scrollTop>0,'A37 unobscured browser gate requires a partially scrolled Torrent row: '+JSON.stringify(unobscuredSetup));
  await page.waitForTimeout(220);
  const unobscured=await page.evaluate(()=>{const v=WeiG.AppState.viewport,head=document.getElementById('torrent-table-head'),partial=v.firstVisibleItem(),subject=v.firstUnobscuredItem(),partialRow=partial&&document.querySelector('#torrent-list [data-hash="'+partial.hash+'"]'),subjectRow=subject&&document.querySelector('#torrent-list [data-hash="'+subject.hash+'"]'),hr=head.getBoundingClientRect(),pr=partialRow&&partialRow.getBoundingClientRect(),sr=subjectRow&&subjectRow.getBoundingClientRect();return{partial:partial&&partial.hash,subject:subject&&subject.hash,headBottom:hr.bottom,partialTop:pr&&pr.top,subjectTop:sr&&sr.top,selection:WeiG.Selection.count()};});
  assert(unobscured.selection===0&&unobscured.partial&&unobscured.subject&&unobscured.partial!==unobscured.subject&&unobscured.partialTop<unobscured.headBottom-0.5&&unobscured.subjectTop>=unobscured.headBottom-1,'firstUnobscuredItem must identify the first row below the sticky header rather than the partially covered row: '+JSON.stringify(unobscured));
  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForFunction(expected=>WeiG.Selection.count()===0&&WeiG.AppState.detailDockOpen&&WeiG.AppState.detailDockHash===expected,unobscured.subject);
  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForFunction(()=>!WeiG.AppState.detailDockOpen);
  await page.evaluate(()=>{const list=document.getElementById('torrent-list'),v=WeiG.AppState.viewport;list.style.removeProperty('height');list.style.removeProperty('flex');v.resetScroll();v.refreshGeometry();});

  // A35 regression: the home-page inline Dock must use the same shared Detail DataGrid owner
  // before any full Detail route has had a chance to initialize route-specific state.
  const libraryRow=page.locator(`.torrent-row[data-hash="${hash}"]`),libraryBox=await libraryRow.boundingBox();
  assert(libraryBox&&libraryBox.width>80&&libraryBox.height>10,'Inline Detail regression needs a selectable Torrent row');
  await libraryRow.click({position:{x:Math.min(libraryBox.width-12,Math.max(70,libraryBox.width*.72)),y:Math.min(libraryBox.height-4,Math.max(8,libraryBox.height*.5))}});
  await page.waitForFunction(expected=>window.WeiG?.Selection?.count?.()===1&&window.WeiG.Selection.hashes()[0]===expected,hash);
  await page.waitForFunction(()=>[...document.querySelectorAll('#torrent-detail-tabs .tab')].every(node=>!node.disabled));
  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForSelector('#torrent-detail-dock-content .shared-table__viewport .shared-table__row');
  const inlineDetail=await page.evaluate(()=>{const owner=window.WeiG?.AppState?.detailViewport,viewport=document.querySelector('#torrent-detail-dock-content .shared-table__viewport');return{route:window.WeiG?.Router?.route?.().name,tab:window.WeiG?.AppState?.detailDockTab,surface:owner?.__weigSharedDetail?.surface||'',owned:!!(owner&&viewport&&owner.el===viewport),mount:viewport?.closest('.detail-runtime-content')?.id||''};});
  assert(inlineDetail.route==='home'&&inlineDetail.tab==='trackers'&&inlineDetail.surface==='trackers'&&inlineDetail.owned&&inlineDetail.mount==='torrent-detail-dock-content','Inline Trackers Dock must consume the presentation-neutral shared Detail DataGrid owner before full-route navigation: '+JSON.stringify(inlineDetail));
  const freshSplit=await page.evaluate(()=>{const split=document.getElementById('torrent-detail-splitter'),dock=document.getElementById('torrent-detail-dock'),key=window.WeiG?.StorageKeys?.torrentDetailDockHeight;return{stored:key?localStorage.getItem(key):null,now:Number(split?.getAttribute('aria-valuenow')),height:dock?.getBoundingClientRect().height||0};});
  assert(freshSplit.stored===null&&freshSplit.now>0&&freshSplit.height>0,'A37 fresh storage must open the Detail Dock at the nonzero default instead of coercing missing localStorage to persisted zero: '+JSON.stringify(freshSplit));

  // A37 SplitPane: the actual draggable track spans from the Torrent sticky-header bottom to the Detail tabs/pager top.
  let splitBox=await page.locator('#torrent-detail-splitter').boundingBox();
  assert(splitBox&&splitBox.height>0,'A37 SplitPane gate requires a visible separator');
  await page.mouse.move(splitBox.x+splitBox.width/2,splitBox.y+splitBox.height/2);await page.mouse.down();await page.mouse.move(splitBox.x+splitBox.width/2,-500,{steps:6});await page.mouse.up();
  const splitMax=await page.evaluate(()=>{const head=document.getElementById('torrent-table-head'),list=document.getElementById('torrent-list'),split=document.getElementById('torrent-detail-splitter'),dock=document.getElementById('torrent-detail-dock'),pager=document.querySelector('.torrent-pager'),box=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height};};return{head:box(head),list:box(list),split:box(split),dock:box(dock),pager:box(pager),now:Number(split.getAttribute('aria-valuenow')),max:Number(split.getAttribute('aria-valuemax'))};});
  assert(splitMax.list.height>=splitMax.head.height-1&&Math.abs(splitMax.split.top-splitMax.head.bottom)<=2.5&&Math.abs(splitMax.dock.bottom-splitMax.pager.top)<=2.5&&Math.abs(splitMax.now-splitMax.max)<=1,'Detail maximum must stop at the bottom of the runtime-mounted Torrent header without a fixed primary reserve: '+JSON.stringify(splitMax));
  splitBox=await page.locator('#torrent-detail-splitter').boundingBox();await page.mouse.move(splitBox.x+splitBox.width/2,splitBox.y+splitBox.height/2);await page.mouse.down();await page.mouse.move(splitBox.x+splitBox.width/2,2000,{steps:6});await page.mouse.up();
  const splitMin=await page.evaluate(()=>{const split=document.getElementById('torrent-detail-splitter'),dock=document.getElementById('torrent-detail-dock'),pager=document.querySelector('.torrent-pager'),sr=split.getBoundingClientRect(),dr=dock.getBoundingClientRect(),pr=pager.getBoundingClientRect();return{splitBottom:sr.bottom,dockHeight:dr.height,pagerTop:pr.top,now:Number(split.getAttribute('aria-valuenow')),min:Number(split.getAttribute('aria-valuemin'))};});
  assert(splitMin.min===0&&splitMin.now===0&&splitMin.dockHeight<=2.5&&Math.abs(splitMin.splitBottom-splitMin.pagerTop)<=2.5,'Detail minimum must collapse to the tabs/pager boundary without the retired 160px reserve: '+JSON.stringify(splitMin));
  await page.evaluate(()=>WeiG.AppState.detailSplitPane.setSize(9999,false));
  await page.setViewportSize({width:1200,height:620});
  await page.waitForFunction(()=>{const panel=document.querySelector('.torrent-panel'),head=document.getElementById('torrent-table-head'),list=document.getElementById('torrent-list'),split=document.getElementById('torrent-detail-splitter'),pager=document.querySelector('.torrent-pager');if(!panel||!head||!list||!split||!pager)return false;const now=Number(split.getAttribute('aria-valuenow')),max=Number(split.getAttribute('aria-valuemax')),pr=pager.getBoundingClientRect(),rr=panel.getBoundingClientRect(),hr=head.getBoundingClientRect(),lr=list.getBoundingClientRect(),sr=split.getBoundingClientRect();return Number.isFinite(now)&&Number.isFinite(max)&&now<=max&&max>0&&pr.bottom<=rr.bottom+2.5&&lr.height>=hr.height-1&&Math.abs(sr.top-hr.bottom)<=2.5;});
  const splitResize=await page.evaluate(()=>{const panel=document.querySelector('.torrent-panel'),head=document.getElementById('torrent-table-head'),list=document.getElementById('torrent-list'),split=document.getElementById('torrent-detail-splitter'),dock=document.getElementById('torrent-detail-dock'),pager=document.querySelector('.torrent-pager'),rect=n=>{const r=n.getBoundingClientRect();return{top:r.top,bottom:r.bottom,height:r.height};};return{panel:rect(panel),head:rect(head),list:rect(list),split:rect(split),dock:rect(dock),pager:rect(pager),now:Number(split.getAttribute('aria-valuenow')),max:Number(split.getAttribute('aria-valuemax'))};});
  assert(splitResize.now<=splitResize.max&&splitResize.max>0&&splitResize.pager.bottom<=splitResize.panel.bottom+2.5&&splitResize.list.height>=splitResize.head.height-1&&Math.abs(splitResize.split.top-splitResize.head.bottom)<=2.5&&Math.abs(splitResize.dock.bottom-splitResize.pager.top)<=2.5,'SplitPane resize refresh must settle against the latest root geometry and preserve the runtime header minimum: '+JSON.stringify(splitResize));
  await page.setViewportSize({width:1366,height:768});await page.evaluate(()=>WeiG.AppState.detailSplitPane.setSize(280,false));

  await page.locator('#torrent-detail-tabs .tab[data-tab="trackers"]').click();
  await page.waitForFunction(()=>!window.WeiG.AppState.detailDockOpen&&document.getElementById('torrent-detail-dock')?.hidden);

  await page.locator(`.torrent-row[data-hash="${hash}"] .torrent-title`).click();
  await page.waitForSelector('#detail-view.is-active');
  const headerLayout=await page.evaluate(()=>{const hero=document.querySelector('.detail-hero'),eyebrow=hero&&hero.querySelector(':scope>.eyebrow'),state=document.getElementById('detail-state'),progress=hero&&hero.querySelector(':scope>.detail-progress'),track=progress&&progress.querySelector('.progress-track'),pct=document.getElementById('detail-progress-text'),title=document.getElementById('detail-title'),box=x=>{const r=x.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,cy:r.y+r.height/2};};return{direct:!!(hero&&eyebrow&&state&&title&&progress&&eyebrow.parentElement===hero&&state.parentElement===hero&&title.parentElement===hero&&progress.parentElement===hero),hero:box(hero),eyebrow:box(eyebrow),state:box(state),progress:box(progress),track:box(track),pct:box(pct),pctAlign:getComputedStyle(pct).textAlign,title:box(title),text:pct.textContent,stateText:state.textContent,stateTone:state.dataset.tone,progressState:track.dataset.progressState,progressTone:track.dataset.progressTone,progressActive:track.dataset.progressActive};});
  assert(headerLayout.direct,'Detail four-corner nodes must be direct children of the canonical detail-hero geometry owner.');
  assert(Math.abs(headerLayout.eyebrow.cy-headerLayout.state.cy)<3,'Torrent Detail and state must share the top row: '+JSON.stringify(headerLayout));
  assert(Math.abs(headerLayout.title.cy-headerLayout.progress.cy)<4,'Torrent title and progress must share the bottom row: '+JSON.stringify(headerLayout));
  assert(Math.abs(headerLayout.eyebrow.x-headerLayout.title.x)<2,'Detail left corners are not aligned: '+JSON.stringify(headerLayout));
  assert(Math.abs(headerLayout.state.right-headerLayout.progress.right)<2,'Detail right corners are not aligned: '+JSON.stringify(headerLayout));
  assert(Math.abs(headerLayout.track.cy-headerLayout.pct.cy)<3&&headerLayout.text==='100.0%','Detail progress track and percentage must share canonical one-decimal progress text: '+JSON.stringify(headerLayout));assert(headerLayout.progressState==='seed-idle'&&headerLayout.progressTone==='stalled-up'&&headerLayout.stateTone==='stalled-up'&&headerLayout.progressActive==='false','Detail must consume the same stalled-upload presentation snapshot as Library: '+JSON.stringify(headerLayout));
  assert(headerLayout.pctAlign==='right'&&Math.abs(headerLayout.pct.right-headerLayout.state.right)<2,'Detail percentage element must end-align to the same canonical right boundary as the state owner: '+JSON.stringify(headerLayout));
  assert(headerLayout.title.right<headerLayout.progress.x,'Long Detail title overlaps the right progress owner: '+JSON.stringify(headerLayout));
  const general=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.general-detail .kv')].map(row=>{const nodes=row.children;return[String(nodes[0]?.textContent||'').trim().replace(/:$/,''),String(nodes[1]?.textContent||'').trim()];})));
  assert(general['Time Active']?.includes('176d 6h')&&!general['Time Active']?.includes('∞'),'Elapsed/seeding duration must render finite day/hour text instead of ETA infinity semantics: '+JSON.stringify(general));
  assert(general['Total Size']==='410.38 GiB','General total size must preserve fixed two-decimal qB friendlyUnit precision without rounding up: '+JSON.stringify(general));
  assert(general['Pieces']?.includes('52531 × 8.00 MiB')&&general['Pieces']?.includes('(have 52531)'),'General Pieces must consume source-proven pieces_num/piece_size/pieces_have: '+JSON.stringify(general));
  assert(general['Info Hash v2']==='N/A','Source-proven unavailable General values must preserve qB N/A semantics: '+JSON.stringify(general));const generalSentinels=await page.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.general-detail .kv')].map(row=>[row.dataset.generalField,row.children[1]?.textContent??''])));const officialUnknown=await page.evaluate(()=>WeiG.QbUiEvidence.text('detail.value.unknown',{source:'Unknown',context:'HttpServer'},'Unknown'));assert(generalSentinels.created_by===''&&generalSentinels.comment===''&&generalSentinels.addition_date===officialUnknown&&generalSentinels.completion_date===''&&generalSentinels.creation_date==='','General source empty/sentinel presentation drifted: '+JSON.stringify({generalSentinels,officialUnknown}));
  await page.locator('#detail-view .detail-tabs [data-tab="trackers"]').click();
  await page.waitForSelector('.shared-table__row');
  await assertDetailFrameGeometry(page,mainGridFrame,'Trackers');
  const trackerInitial=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row')).map(row=>({kind:row.dataset.trackerKind||'',url:row.querySelector('[data-column-key="url"]')?.textContent||'',tier:row.querySelector('[data-column-key="tier"]')?.textContent||'',bt:row.querySelector('[data-column-key="btVersion"]')?.textContent||''})));
  assert(trackerInitial.slice(0,3).every(row=>row.tier===''&&row.kind==='parent'),'Tracker pseudo rows exposed negative tier sentinel or lost parent semantics '+JSON.stringify(trackerInitial));
  assert(trackerInitial.some(row=>row.kind==='endpoint'&&row.url==='a-child.example:443'&&row.tier===''&&row.bt==='v1'),'Tracker endpoint projection did not expose source endpoint BT protocol/tier semantics '+JSON.stringify(trackerInitial));const trackerZero=await page.evaluate(()=>{const row=[...document.querySelectorAll('.shared-table__row')].find(node=>node.querySelector('[data-column-key="url"]')?.textContent.includes('[DHT]'));return row?Object.fromEntries(['btVersion','message','nextAnnounce','minAnnounce'].map(key=>[key,row.querySelector('[data-column-key="'+key+'"]')?.textContent??null])):null;});assert(trackerZero&&trackerZero.btVersion===''&&trackerZero.message===''&&trackerZero.nextAnnounce==='0'&&trackerZero.minAnnounce==='0','Tracker empty/raw zero presentation must match native qB source semantics: '+JSON.stringify(trackerZero));
  await page.locator('.shared-table__row').nth(3).click({button:'right'});
  await page.waitForSelector('.ui-context-menu');
  await page.waitForFunction(()=>{const menu=document.querySelector('.ui-context-menu');return !!(menu&&menu.dataset.placement&&(menu.dataset.wrap==='0'||menu.dataset.wrap==='1'));});
  const trackerMenuGeometry=await page.evaluate(()=>{const menu=document.querySelector('.ui-context-menu'),labels=[...menu.querySelectorAll('.ui-context-menu__label')];return{wrap:menu?.dataset.wrap||'',menuWidth:menu?.getBoundingClientRect().width||0,viewport:innerWidth,labels:labels.map(label=>({text:label.textContent,whiteSpace:getComputedStyle(label).whiteSpace,height:label.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(label).lineHeight)||0}))};});
  assert(trackerMenuGeometry.wrap==='0'&&trackerMenuGeometry.labels.every(item=>item.whiteSpace==='nowrap'&&(!item.lineHeight||item.height<item.lineHeight*1.6)), 'Context Menu must keep labels on one line whenever the viewport can fit the intrinsic width: '+JSON.stringify(trackerMenuGeometry));
  await page.keyboard.press('Escape');await page.waitForSelector('.ui-context-menu',{state:'detached'});
  assert(await page.locator('#detail-view.is-active').count()===1,'Closing a Context Menu with Escape must not bubble into Detail route navigation.');
  await page.locator('#detail-view .detail-tabs [data-tab="peers"]').click();await page.waitForFunction(()=>document.querySelector('#detail-view .detail-tabs [data-tab="peers"]')?.classList.contains('is-active'));await assertDetailFrameGeometry(page,mainGridFrame,'Peers');await page.locator('[data-detail-back]').click();await page.waitForFunction(()=>WeiG.Router.route().name==='home'&&document.getElementById('list-view')?.classList.contains('is-active'));await page.waitForSelector(`.torrent-row[data-hash="${hash2}"] .torrent-title`);await page.locator(`.torrent-row[data-hash="${hash2}"] .torrent-title`).click();await page.waitForFunction(()=>document.querySelector('#detail-view .detail-tabs [data-tab="peers"]')?.classList.contains('is-active')&&document.getElementById('detail-view')?.classList.contains('is-active'));assert(await page.locator('#detail-view .detail-tabs [data-tab="peers"].is-active').count()===1,'Opening another Torrent after leaving the Users tab must preserve the last Detail tab');await page.locator('#detail-view .detail-tabs [data-tab="trackers"]').click();await page.waitForSelector('.shared-table__row');
  const trackerUrlHead=page.locator('.shared-table__head .grid-head-cell[data-key="url"]');await trackerUrlHead.click();
  await page.waitForFunction(()=>document.querySelector('.shared-table__head .grid-head-cell[data-key="url"]')?.dataset.sortDirection==='asc');
  const trackerAsc=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row')).map(row=>({kind:row.dataset.trackerKind||'',url:row.querySelector('[data-column-key="url"]')?.textContent||''})));
  assert(trackerAsc.slice(0,3).every(row=>/^\*\* \[/.test(row.url)),'Tracker sort displaced pseudo rows '+JSON.stringify(trackerAsc));
  const realAsc=trackerAsc.slice(3);assert(realAsc.map(row=>row.url).join('|')==='https://a-tracker.example/announce|a-child.example:443|z-child.example:443|https://z-tracker.example/announce|z-endpoint.example:443','Tracker ascending sort detached endpoints from parents '+JSON.stringify(realAsc));
  await trackerUrlHead.click();
  const trackerDesc=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row')).map(row=>({kind:row.dataset.trackerKind||'',url:row.querySelector('[data-column-key="url"]')?.textContent||''})));
  const realDesc=trackerDesc.slice(3);assert(realDesc.map(row=>row.url).join('|')==='https://z-tracker.example/announce|z-endpoint.example:443|https://a-tracker.example/announce|z-child.example:443|a-child.example:443','Tracker descending sort detached endpoints from parents '+JSON.stringify(realDesc));

  await page.locator('#detail-view .detail-tabs [data-tab="webseeds"]').click();
  await page.waitForSelector('.shared-table__head .grid-head-cell[data-key="url"]');
  await assertDetailFrameGeometry(page,mainGridFrame,'Web Seeds');
  const webseedHead=page.locator('.shared-table__head .grid-head-cell[data-key="url"]');await webseedHead.click();
  const webseedAsc=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row [data-column-key="url"]')).map(node=>node.textContent));
  assert(webseedAsc[0]?.includes('a-cdn.example'),'HTTP Sources ascending sort failed '+JSON.stringify(webseedAsc));
  await webseedHead.click();
  const webseedDesc=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row [data-column-key="url"]')).map(node=>node.textContent));
  assert(webseedDesc[0]?.includes('z-cdn.example'),'HTTP Sources descending sort failed '+JSON.stringify(webseedDesc));
  const webseedRow=page.locator('.shared-table__row').first();await webseedRow.click({button:'right'});await page.waitForSelector('.ui-context-menu[data-context-level="0"]');
  const webseedMenuLabels=await page.locator('.ui-context-menu[data-context-level="0"] .ui-context-menu__label').allTextContents();
  assert(JSON.stringify(webseedMenuLabels)===JSON.stringify(['Add web seeds...','Remove web seed','Copy web seed URL','Edit web seed URL...']),'HTTP Sources native context actions must preserve exact qB source order/capability: '+JSON.stringify(webseedMenuLabels));
  await page.keyboard.press('Escape');await page.waitForSelector('.ui-context-menu[data-context-level="0"]',{state:'detached'});

  await page.locator('#detail-view .detail-tabs [data-tab="files"]').click();
  await page.waitForSelector('.shared-table__head .grid-head-cell[data-key="size"]');
  await assertDetailFrameGeometry(page,mainGridFrame,'Files');
  const fileSizeHead=page.locator('.shared-table__head .grid-head-cell[data-key="size"]');await fileSizeHead.click();
  const fileSortState=await page.evaluate(()=>({head:document.querySelector('.shared-table__head .grid-head-cell[data-key="size"]')?.textContent||'',folders:Array.from(document.querySelectorAll('.shared-table__row[data-file-kind="folder"] .detail-file-label')).slice(0,2).map(node=>node.textContent),kinds:Array.from(document.querySelectorAll('.shared-table__row')).slice(0,6).map(row=>row.dataset.fileKind||'')}));
  assert(await page.locator('.shared-table__head .grid-head-cell[data-key="size"]').getAttribute('data-sort-direction')==='asc'&&fileSortState.folders.length>=2,'Content sort did not preserve tree/header semantics '+JSON.stringify(fileSortState));
  const folderRow=page.locator('.shared-table__row[data-file-kind="folder"]').first();
  assert(await folderRow.getAttribute('data-context-menu')==='true','Folder Content row must advertise canonical context-menu actions before pointer dispatch.');
  await folderRow.click({button:'right'});
  await page.waitForFunction(()=>{const menu=document.querySelector('.ui-context-menu[data-context-level="0"]');if(!menu||!menu.dataset.placement)return false;const labels=[...menu.querySelectorAll(':scope > .ui-select__options > .ui-select__option > .ui-context-menu__label')].map(node=>String(node.textContent||'').trim());return labels.includes('Download Priority')&&labels.includes('Copy file path')&&labels.includes('Copy containing folder path');});
  const folderRootLabels=await page.locator('.ui-context-menu[data-context-level="0"] > .ui-select__options > .ui-select__option > .ui-context-menu__label').allTextContents();
  assert(JSON.stringify(folderRootLabels)===JSON.stringify(['Rename...','Download Priority','Copy file path','Copy containing folder path']),'Content context menu must preserve qB-native source order and append WeiG path extensions last: '+JSON.stringify(folderRootLabels));
  const priorityParent=page.locator('.ui-context-menu[data-context-level="0"] .ui-select__option[aria-haspopup="menu"]').filter({hasText:'Download Priority'}).first();
  await priorityParent.hover();
  await page.waitForSelector('.ui-context-menu[data-context-level="1"]');
  const priorityLabels=await page.locator('.ui-context-menu[data-context-level="1"] .ui-context-menu__label').allTextContents();
  assert(priorityLabels.includes('Normal')&&priorityLabels.includes('High')&&priorityLabels.includes('Maximum'),'Priority submenu did not expose source-proven priority choices: '+JSON.stringify(priorityLabels));
  assert(await page.locator('.ui-context-menu[data-context-level="1"] .ui-select__option.is-context-checked').count()===0,'Mixed folder priority must not invent a checked source priority choice.');
  assert(await page.locator('.ui-context-menu[data-context-level="1"] .ui-select__option').filter({hasText:'Mixed'}).count()===0,'Display-only Mixed priority must never appear as a writable context-menu choice.');
  await page.keyboard.press('Escape');await page.waitForSelector('.ui-context-menu[data-context-level="1"]',{state:'detached'});
  assert(await page.locator('.ui-context-menu[data-context-level="0"]').count()===1,'First Escape from a nested Context Menu must close only the child submenu.');
  await page.keyboard.press('Escape');await page.waitForSelector('.ui-context-menu[data-context-level="0"]',{state:'detached'});
  const seedLeaf=page.locator('.shared-table__row[data-file-kind="file"]').first();
  await seedLeaf.click({button:'right'});await page.waitForSelector('.ui-context-menu[data-context-level="0"]');
  const seedLeafLabels=await page.locator('.ui-context-menu[data-context-level="0"] .ui-context-menu__label').allTextContents();
  assert(seedLeafLabels.includes('Download Priority'),'Completed/seed file row must retain source-proven Download Priority action: '+JSON.stringify(seedLeafLabels));
  await page.keyboard.press('Escape');await page.waitForSelector('.ui-context-menu[data-context-level="0"]',{state:'detached'});
  await page.locator('#detail-view .detail-tabs [data-tab="peers"]').click();
  await page.waitForSelector('.peer-country-code');
  const peerClientHead=page.locator('.shared-table__head .grid-head-cell[data-key="client"]');await peerClientHead.waitFor();await peerClientHead.click();
  await page.waitForFunction(()=>document.querySelector('.shared-table__head .grid-head-cell[data-key="client"]')?.dataset.sortDirection==='asc');
  const peerAsc=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row [data-column-key="client"]')).map(node=>node.textContent||''));
  assert(peerAsc[0]?.includes('BitComet'),`Peers ascending sort failed: ${JSON.stringify(peerAsc)}`);
  await peerClientHead.click();
  const peerDesc=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row [data-column-key="client"]')).map(node=>node.textContent||''));
  assert(peerDesc[0]==='fixture',`Peers descending sort failed: ${JSON.stringify(peerDesc)}`);
  const countryUi=await page.evaluate(()=>Array.from(document.querySelectorAll('.peer-country-cell')).map(cell=>({code:cell.querySelector('.peer-country-code')?.textContent||'',src:cell.querySelector('.peer-country-flag')?.getAttribute('src')||'',text:cell.textContent.trim(),title:cell.title})));
  assert(countryUi.some(x=>x.code==='CN'&&x.src==='images/flags/cn.svg')&&countryUi.some(x=>x.code==='TW'&&x.src==='images/flags/tw.svg')&&countryUi.every(x=>!x.text.includes('China')&&!x.text.includes('Taiwan')),'Peer country must show official flag + ISO only: '+JSON.stringify(countryUi));
  await page.waitForFunction(()=>{const imgs=Array.from(document.querySelectorAll('.peer-country-flag'));return imgs.length>=2&&imgs.every(img=>img.complete&&img.naturalWidth>0&&!img.hidden);});
  const loadedFlags=await page.evaluate(()=>Array.from(document.querySelectorAll('.peer-country-flag')).map(img=>({src:img.getAttribute('src'),width:img.naturalWidth,height:img.naturalHeight,hidden:img.hidden})));
  assert(loadedFlags.every(x=>x.width>0&&x.height>0&&!x.hidden),'Peer official SVG assets must load successfully from the bundled qB snapshot: '+JSON.stringify(loadedFlags));

  // Every Detail surface owns one persisted sort state shared across torrents, not a viewport-local transient.
  await page.locator('[data-detail-back]').click();
  await page.waitForFunction(()=>WeiG.Router.route().name==='home'&&document.getElementById('list-view')?.classList.contains('is-active'));
  await page.locator(`.torrent-row[data-hash="${hash}"] .torrent-title`).click();
  await page.waitForFunction(()=>document.querySelector('#detail-view .detail-tabs [data-tab="peers"]')?.classList.contains('is-active')&&document.getElementById('detail-view')?.classList.contains('is-active'));
  await page.waitForFunction(()=>document.querySelector('.shared-table__head .grid-head-cell[data-key="client"]')?.dataset.sortDirection==='desc');
  const detailSortVisual=await page.evaluate(()=>{const cell=document.querySelector('.shared-table__head .grid-head-cell[data-key="client"]'),label=cell?.querySelector('.grid-head-label');return{direction:cell?.dataset.sortDirection||'',ariaSort:cell?.getAttribute('aria-sort')||'',marker:cell?.querySelector('.grid-head-sort')?.textContent||'',label:label?.textContent||'',fullLabel:label?.dataset.fullLabel||'',pseudo:getComputedStyle(cell,'::after').content};});
  assert(detailSortVisual.direction==='desc'&&detailSortVisual.ariaSort==='descending'&&detailSortVisual.marker==='↓'&&detailSortVisual.label===detailSortVisual.fullLabel&&!/[↑↓]/.test(detailSortVisual.fullLabel)&&['none','normal','""'].includes(detailSortVisual.pseudo),`Detail sort must share DataGridHeader semantic/visual owner without the retired CSS pseudo indicator: ${JSON.stringify(detailSortVisual)}`);
  const persistedPeer=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row [data-column-key="client"]')).map(node=>node.textContent||''));
  assert(persistedPeer[0]==='fixture',`Peers sort did not persist across torrents: ${JSON.stringify(persistedPeer)}`);

  await page.locator('#detail-view .detail-tabs [data-tab="trackers"]').click();
  await page.waitForFunction(()=>document.querySelector('.shared-table__head .grid-head-cell[data-key="url"]')?.dataset.sortDirection==='desc');
  const persistedTrackers=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row')).map(row=>({kind:row.dataset.trackerKind||'',url:row.querySelector('[data-column-key="url"]')?.textContent||''})));
  assert(persistedTrackers.slice(0,3).every(row=>/^\*\* \[/.test(row.url))&&persistedTrackers[3]?.url==='https://z-tracker.example/announce','Tracker sort did not persist with pseudo rows/tree ownership: '+JSON.stringify(persistedTrackers));

  await page.locator('#detail-view .detail-tabs [data-tab="webseeds"]').click();
  await page.waitForFunction(()=>document.querySelector('#detail-view .detail-tabs [data-tab="webseeds"]')?.classList.contains('is-active')&&Array.from(document.querySelectorAll('.shared-table__row [data-column-key="url"]')).some(node=>String(node.textContent||'').includes('cdn.example')));
  await page.waitForFunction(()=>document.querySelector('.shared-table__head .grid-head-cell[data-key="url"]')?.dataset.sortDirection==='desc');
  const persistedWebseeds=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row [data-column-key="url"]')).map(node=>node.textContent||''));
  assert(persistedWebseeds[0]?.includes('z-cdn.example'),'HTTP Sources sort did not persist across torrents: '+JSON.stringify(persistedWebseeds));

  await page.locator('#detail-view .detail-tabs [data-tab="files"]').click();
  await page.waitForFunction(()=>document.querySelector('#detail-view .detail-tabs [data-tab="files"]')?.classList.contains('is-active')&&document.querySelector('.shared-table__row[data-file-kind]'));
  await page.waitForFunction(()=>document.querySelector('.shared-table__head .grid-head-cell[data-key="size"]')?.dataset.sortDirection==='asc');
  const persistedFiles=await page.evaluate(()=>({folders:Array.from(document.querySelectorAll('.shared-table__row[data-file-kind="folder"] .detail-file-label')).slice(0,2).map(node=>node.textContent),direction:document.querySelector('.shared-table__head .grid-head-cell[data-key="size"]')?.dataset.sortDirection||''}));
  assert(persistedFiles.direction==='asc'&&persistedFiles.folders.length>=2,'Content Total Size sort did not persist across torrents/tree rebuild: '+JSON.stringify(persistedFiles));

  await page.waitForSelector('.shared-table__viewport .shared-table__row');
  await page.waitForFunction(()=>getComputedStyle(document.getElementById('detail-content')).display==='flex');

  for(const key of ['checked','name','size','progress','remaining','priority','availability'])await setColumnVisible(page,key,true);

  const geometry=await page.evaluate(()=>{const tabs=document.querySelector('#detail-view .detail-tabs').getBoundingClientRect(),content=document.getElementById('detail-content').getBoundingClientRect(),status=document.querySelector('.statusbar').getBoundingClientRect(),viewport=document.querySelector('.shared-table__viewport').getBoundingClientRect(),style=getComputedStyle(document.getElementById('detail-content'));return{tabsBottom:tabs.bottom,contentTop:content.top,contentBottom:content.bottom,statusTop:status.top,contentHeight:content.height,viewportBottom:viewport.bottom,flexGrow:style.flexGrow,minHeight:style.minHeight};});
  assert(geometry.contentTop>=geometry.tabsBottom-1,`Detail Content overlaps tabs: ${JSON.stringify(geometry)}`);
  assert(geometry.statusTop>=geometry.contentBottom&&geometry.statusTop-geometry.contentBottom<24,`Detail Content does not fill to Statusbar: ${JSON.stringify(geometry)}`);
  assert(geometry.contentHeight>250&&geometry.viewportBottom<=geometry.contentBottom+1&&Number(geometry.flexGrow)>0&&geometry.minHeight==='0px',`Detail flex ownership is not active: ${JSON.stringify(geometry)}`);

  const tableAlignment=await page.evaluate(()=>{const head=document.querySelector('.shared-table__head .grid-head-cell[data-key="size"]'),cell=document.querySelector('.shared-table__row [data-column-key="size"]');return{headAlign:head&&head.dataset.align,cellAlign:cell&&cell.dataset.align,headText:head&&getComputedStyle(head).textAlign,cellText:cell&&getComputedStyle(cell).textAlign};});
  assert(tableAlignment.headAlign==='start'&&tableAlignment.cellAlign==='start'&&tableAlignment.headText==='left'&&tableAlignment.cellText==='left',`Ordinary numeric detail columns must share the canonical left/start alignment: ${JSON.stringify(tableAlignment)}`);
  const detailRecycler=await page.evaluate(async()=>{const v=WeiG.AppState.detailViewport,el=v.el,max=Math.max(0,el.scrollHeight-el.clientHeight);el.scrollTop=Math.round(max*.5);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));v.resetMetrics();const nodes=v._rowPool.map(slot=>slot.node);for(const ratio of [.05,.60,.20,.90,.35,.75]){el.scrollTop=Math.round(max*ratio);el.dispatchEvent(new Event('scroll'));await new Promise(r=>requestAnimationFrame(r));}return{metrics:v.metrics(),same:nodes.length===v._rowPool.length&&nodes.every((node,i)=>v._rowPool[i].node===node),max};});
  assert(detailRecycler.max>0&&detailRecycler.same&&detailRecycler.metrics.created===0&&detailRecycler.metrics.removed===0&&detailRecycler.metrics.updated>0,'Detail thumb-like recycler stress failed: '+JSON.stringify(detailRecycler));
  await resetDetailViewport(page);
  const detailPoolVisibility=await page.evaluate(()=>{const v=WeiG.AppState.detailViewport,idle=v._rowPool.filter(slot=>!slot.bound).map(slot=>slot.node),active=v._rowPool.filter(slot=>slot.bound).map(slot=>slot.node),paintedIdle=idle.filter(node=>{const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;});return{idleCount:idle.length,idlePainted:paintedIdle.length,activeCount:active.length,activeTops:active.map(node=>Math.round(node.getBoundingClientRect().top*10)/10)};});
  assert(detailPoolVisibility.idleCount>0&&detailPoolVisibility.idlePainted===0,'Detail prewarmed idle row shells painted over the first row: '+JSON.stringify(detailPoolVisibility));
  assert(new Set(detailPoolVisibility.activeTops).size===detailPoolVisibility.activeCount,'Detail active recycler rows overlap at first paint: '+JSON.stringify(detailPoolVisibility));
  const hierarchy=await page.evaluate(()=>{const visible=row=>{const style=getComputedStyle(row),rect=row.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;},rows=[...document.querySelectorAll('.shared-table__row')].filter(visible).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top),folders=rows.filter(row=>row.dataset.fileKind==='folder'),files=rows.filter(row=>row.dataset.fileKind==='file');return{firstKind:rows[0]?.dataset.fileKind||'',folderCount:folders.length,fileCount:files.length};});
  assert(hierarchy.firstKind==='folder'&&hierarchy.folderCount>=1&&hierarchy.fileCount>=2,`Content hierarchy did not preserve the synthetic folder row above source file rows: ${JSON.stringify(hierarchy)}`);
  const fileIconPresentation=await page.evaluate(()=>Array.from(document.querySelectorAll('.shared-table__row:not([hidden])')).map(row=>({kind:row.dataset.fileKind||'',name:row.querySelector('.detail-file-label')?.textContent||'',type:row.querySelector('.detail-file-icon')?.dataset.fileType||'',marker:row.querySelector('.detail-file-icon')?.dataset.marker||'',glyph:row.querySelector('.detail-file-icon')?.textContent||''})).filter(item=>item.name));
  assert(fileIconPresentation.some(item=>item.kind==='folder'&&item.type==='folder'&&item.glyph===''),'Content folder icon did not use CSS presentation '+JSON.stringify(fileIconPresentation));
  for(const expected of [{name:'clip.mp4',type:'video',marker:'VID'},{name:'photo.jpg',type:'image',marker:'IMG'},{name:'installer.exe',type:'app',marker:'APP'},{name:'notes.txt',type:'text',marker:'TXT'},{name:'archive.zip',type:'archive',marker:'ARC'},{name:'report.pdf',type:'document',marker:'DOC'},{name:'script.js',type:'code',marker:'DEV'},{name:'song.flac',type:'audio',marker:'AUD'}]){const hit=fileIconPresentation.find(item=>item.name===expected.name);assert(hit&&hit.type===expected.type&&hit.marker===expected.marker&&hit.glyph==='',`Content file icon classifier mismatch for ${expected.name}: ${JSON.stringify(fileIconPresentation)}`);}
  const derived=await page.evaluate(()=>{const visible=row=>{const style=getComputedStyle(row),rect=row.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;},rows=[...document.querySelectorAll('.shared-table__row[data-file-kind="file"]')].filter(visible).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top).slice(0,2),fmt=window.WeiG.util.formatBytes;return{rows:rows.map(row=>({checked:row.querySelector('[data-column-key="checked"] input[type="checkbox"]')?.checked,remaining:row.querySelector('[data-column-key="remaining"]')?.textContent?.trim(),availability:row.querySelector('[data-column-key="availability"]')?.textContent?.trim()})),expectedIgnored:fmt(0),expectedNormal:fmt(1048576*(1-.25))};});
  assert(derived.rows.length===2,'Content browser gate did not render the first two source file rows beneath the hierarchy.');
  assert(derived.rows[0].checked===false&&derived.rows[1].checked===true,`Source-driven checked state is wrong: ${JSON.stringify(derived.rows)}`);
  assert(derived.rows[0].remaining===derived.expectedIgnored,`Ignored-file remaining must be zero: ${JSON.stringify(derived)}`);
  assert(derived.rows[1].remaining===derived.expectedNormal,`Source-driven remaining formula is wrong: ${JSON.stringify(derived)}`);assert(derived.rows[0].availability==='N/A'&&derived.rows[1].availability==='0.0%',`Content availability zero/sentinel projection is wrong: ${JSON.stringify(derived.rows)}`);
  const folderCheckbox=page.locator('.shared-table__row[data-file-kind="folder"] [data-column-key="checked"] input[type="checkbox"]').first(),headerCheckbox=page.locator('.shared-table__head .grid-head-cell[data-key="checked"] input.detail-files-header-checkbox');
  const mixedFolderPriority=page.locator('.shared-table__row[data-file-kind="folder"]').filter({hasText:'folder-a'}).first().locator('[data-column-key="priority"]');
  assert((await mixedFolderPriority.textContent()).trim()==='Mixed','Mixed Content folder priority must render the exact source display label instead of the raw -1 sentinel.');
  assert(await mixedFolderPriority.locator('.ui-select').count()===0,'Display-only Mixed priority must not become a writable Select choice.');
  assert(await folderCheckbox.evaluate(node=>node.indeterminate===true),'Mixed Content folder must render a tri-state partial checkbox before writes.');
  assert(await headerCheckbox.evaluate(node=>node.indeterminate===true),'Mixed Content header must render a global tri-state partial checkbox before writes.');
  const headerResizeGeometry=await page.evaluate(()=>{const cell=document.querySelector('.shared-table__head .grid-head-cell[data-key="checked"]'),box=cell&&cell.querySelector('input.detail-files-header-checkbox'),handle=cell&&cell.querySelector('.col-resize');if(!cell||!box||!handle)return null;const cr=cell.getBoundingClientRect(),br=box.getBoundingClientRect(),hr=handle.getBoundingClientRect(),after=getComputedStyle(handle,'::after'),divider=hr.left+(parseFloat(after.left)||0),target=document.elementFromPoint(br.left+br.width/2,br.top+br.height/2),overlapX=Math.max(0,Math.min(br.right,hr.right)-Math.max(br.left,hr.left));return{targetIsCheckbox:target===box||box.contains(target),overlapX,dividerDelta:Math.abs(divider-cr.right),cellOverflow:getComputedStyle(cell).overflow,handleRight:getComputedStyle(handle).right};});
  assert(headerResizeGeometry&&headerResizeGeometry.targetIsCheckbox&&headerResizeGeometry.overlapX<=.5&&headerResizeGeometry.dividerDelta<=1.5&&headerResizeGeometry.cellOverflow==='visible'&&headerResizeGeometry.handleRight==='-6px','Shared DataGrid resize handle must sit on the column boundary without stealing header-control hit area: '+JSON.stringify(headerResizeGeometry));
  await folderCheckbox.click();
  await waitFixture(()=>filePrioWrites.length>=2,`Folder checkbox filePrio requests did not reach fixture: ${JSON.stringify(filePrioWrites)}`);
  await page.waitForFunction(()=>{const item=WeiG.AppState.detailViewport?.items?.find(item=>item?.__weigFileKind==='folder'&&item.__weigPath==='folder-a'),row=[...document.querySelectorAll('.shared-table__row[data-file-kind="folder"]')].find(row=>row.querySelector('.detail-file-label')?.textContent==='folder-a'),box=row?.querySelector('[data-column-key="checked"] input[type="checkbox"]');return item?.priority===1&&!!box&&box.checked&&!box.indeterminate;});
  assert(filePrioWrites.slice(-2).every((write,index)=>write.ids.length===1&&write.ids[0]===index&&write.priority===1),`Folder checkbox did not issue source filePrio writes for all descendants: ${JSON.stringify(filePrioWrites)}`);
  assert(files[0].priority===1&&files[1].priority===1,'Folder checkbox fixture server truth did not converge to Normal priority.');
  const firstLeafCheckbox=page.locator('.shared-table__row[data-file-kind="file"] [data-column-key="checked"] input[type="checkbox"]').first();
  const beforeLeafWrites=filePrioWrites.length;
  await firstLeafCheckbox.click();
  await waitFixture(()=>filePrioWrites.length>=beforeLeafWrites+1,`Leaf checkbox filePrio request did not reach fixture: ${JSON.stringify(filePrioWrites)}`);
  await page.waitForFunction(()=>{const item=WeiG.AppState.detailViewport?.items?.find(item=>item?.__weigFileKind==='folder'&&item.__weigPath==='folder-a'),folderRow=[...document.querySelectorAll('.shared-table__row[data-file-kind="folder"]')].find(row=>row.querySelector('.detail-file-label')?.textContent==='folder-a'),folderBox=folderRow?.querySelector('[data-column-key="checked"] input[type="checkbox"]'),leafBox=document.querySelector('.shared-table__row[data-file-kind="file"] [data-column-key="checked"] input[type="checkbox"]'),headerBox=document.querySelector('.shared-table__head .grid-head-cell[data-key="checked"] input.detail-files-header-checkbox');return item?.priority===-1&&!!leafBox&&!leafBox.checked&&!!folderBox&&folderBox.indeterminate===true&&!!headerBox&&headerBox.indeterminate===true;});
  assert(filePrioWrites.at(-1)?.ids?.[0]===0&&filePrioWrites.at(-1)?.priority===0&&files[0].priority===0,'Leaf checkbox did not round-trip Ignored priority through the fixture server.');
  const beforeHeaderWrites=filePrioWrites.length;
  await headerCheckbox.click();
  await waitFixture(()=>filePrioWrites.length>=beforeHeaderWrites+files.length,`Header checkbox did not complete all filePrio requests: ${filePrioWrites.length-beforeHeaderWrites}/${files.length}`,10000);
  await page.waitForFunction(()=>{const box=document.querySelector('.shared-table__head .grid-head-cell[data-key="checked"] input.detail-files-header-checkbox');return !!box&&box.checked&&!box.indeterminate;});
  const headerWrites=filePrioWrites.slice(beforeHeaderWrites);
  assert(headerWrites.length===files.length&&headerWrites.every((write,index)=>write.ids.length===1&&write.ids[0]===index&&write.priority===1),`Header checkbox did not round-trip every source file through filePrio: ${JSON.stringify(headerWrites)}`);
  assert(files.every(file=>file.priority===1),'Header checkbox fixture server truth did not converge all files to Normal priority.');

  const folderA=page.locator('.shared-table__row[data-file-kind="folder"]').filter({hasText:'folder-a'}).first();
  await folderA.click({button:'right'});
  await page.waitForSelector('.ui-context-menu[data-context-level="0"] .ui-select__option[aria-haspopup="menu"]');
  await page.locator('.ui-context-menu[data-context-level="0"] .ui-select__option[aria-haspopup="menu"]').filter({hasText:'Download Priority'}).hover();
  await page.waitForSelector('.ui-context-menu[data-context-level="1"]');
  assert(await page.locator('.ui-context-menu[data-context-level="1"] .ui-select__option.is-context-checked').filter({hasText:'Normal'}).count()===1,'Uniform Normal folder priority must mark the matching nested source choice.');
  const highPriorityValue=await page.evaluate(()=>Number(WeiG.CapabilityRegistry.torrentDetailUi()?.controls?.filePriority?.options?.find(option=>option?.translation?.source==='High')?.value));
  assert(Number.isFinite(highPriorityValue),'High priority test value must come from the exact qB source control, not a version-specific hardcode.');
  const beforeFolderMenuWrites=filePrioWrites.length;
  await page.locator('.ui-context-menu[data-context-level="1"] .ui-select__option').filter({hasText:'High'}).click();
  await waitFixture(()=>filePrioWrites.length>=beforeFolderMenuWrites+2,'Folder priority submenu did not write all descendants: '+JSON.stringify(filePrioWrites.slice(beforeFolderMenuWrites)));
  assert(filePrioWrites.slice(beforeFolderMenuWrites,beforeFolderMenuWrites+2).every((write,index)=>write.ids.length===1&&write.ids[0]===index&&write.priority===highPriorityValue),'Folder priority submenu must reuse canonical descendant filePrio writes with the exact source priority value: '+JSON.stringify(filePrioWrites.slice(beforeFolderMenuWrites)));
  await page.waitForFunction(expected=>WeiG.AppState.detailViewport?.items?.find(item=>item?.__weigFileKind==='folder'&&item.__weigPath==='folder-a')?.priority===expected,highPriorityValue);
  assert(await page.locator('.ui-context-menu').count()===0,'Selecting a nested priority action must close the entire Context Menu tree.');

  const normalFolderStyle=await page.evaluate(()=>{const visible=row=>{const style=getComputedStyle(row),rect=row.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;},row=[...document.querySelectorAll('.shared-table__row[data-file-kind="folder"]')].find(visible),label=row&&row.querySelector('.detail-file-label'),toggle=row&&row.querySelector('.detail-file-toggle'),rr=row&&row.getBoundingClientRect(),lr=label&&label.getBoundingClientRect(),tr=toggle&&toggle.getBoundingClientRect(),fileCount=[...document.querySelectorAll('.shared-table__row[data-file-kind="file"]')].filter(visible).length;return row&&label&&toggle?{fontWeight:getComputedStyle(row).fontWeight,height:rr.height,labelTop:lr.top-rr.top,labelLeft:lr.left-rr.left,toggleTop:tr.top-rr.top,expanded:toggle.getAttribute('aria-expanded'),fileCount}:null;});
  assert(normalFolderStyle&&normalFolderStyle.expanded==='true'&&normalFolderStyle.fileCount>=2,'Normal Content folder row did not start expanded: '+JSON.stringify(normalFolderStyle));
  await page.locator('.shared-table__row[data-file-kind="folder"]:not([hidden]) .detail-file-toggle').first().click();
  await page.waitForFunction(()=>{const v=WeiG.AppState.detailViewport,folder=v?.items?.find(item=>item?.__weigFileKind==='folder'&&item.__weigPath==='folder-a');return folder?.__weigExpanded===false&&!v.items.some(item=>item?.__weigFileKind==='file'&&item.__weigParentPath==='folder-a');});
  const collapsedTree=await page.evaluate(()=>{const v=WeiG.AppState.detailViewport;return{expanded:v.items.find(item=>item?.__weigFileKind==='folder'&&item.__weigPath==='folder-a')?.__weigExpanded,folderAChildren:v.items.filter(item=>item?.__weigFileKind==='file'&&item.__weigParentPath==='folder-a').length,totalFiles:v.items.filter(item=>item?.__weigFileKind==='file').length};});
  assert(collapsedTree.expanded===false&&collapsedTree.folderAChildren===0,`Normal Content folder collapse did not remove its semantic children: ${JSON.stringify(collapsedTree)}`);
  await page.locator('.shared-table__row[data-file-kind="folder"]:not([hidden]) .detail-file-toggle').first().click();
  await page.waitForFunction(()=>{const v=WeiG.AppState.detailViewport,folder=v?.items?.find(item=>item?.__weigFileKind==='folder'&&item.__weigPath==='folder-a');return folder?.__weigExpanded===true&&v.items.some(item=>item?.__weigFileKind==='file'&&item.__weigParentPath==='folder-a');});

  await page.evaluate(()=>{const v=WeiG.AppState.detailViewport,el=v.el,child=v.items.findIndex(item=>item&&item.__weigFileKind==='file'&&item.__weigParentPath);const head=v._headerHeight?v._headerHeight():0;el.scrollTop=Math.max(0,head+Math.max(1,child)*v.rowHeight+2);el.dispatchEvent(new Event('scroll'));});
  await page.waitForFunction(()=>{const sticky=document.querySelector('.shared-table__sticky-folder');const v=WeiG.AppState.detailViewport;return !!sticky&&!sticky.hidden&&getComputedStyle(sticky).display!=='none'&&!v._scrolling;});
  const stickyFolderStyle=await page.evaluate(()=>{const row=document.querySelector('.shared-table__sticky-folder:not([hidden])'),label=row&&row.querySelector('.detail-file-label'),toggle=row&&row.querySelector('.detail-file-toggle'),rr=row&&row.getBoundingClientRect(),lr=label&&label.getBoundingClientRect(),tr=toggle&&toggle.getBoundingClientRect();return row&&label&&toggle?{fontWeight:getComputedStyle(row).fontWeight,height:rr.height,labelTop:lr.top-rr.top,labelLeft:lr.left-rr.left,toggleTop:tr.top-rr.top,expanded:toggle.getAttribute('aria-expanded'),fileKind:row.dataset.fileKind||''}:null;});
  const stickyIdentity=await page.evaluate(()=>{const sticky=document.querySelector('.shared-table__sticky-folder:not([hidden])'),v=WeiG.AppState.detailViewport;if(!sticky||!v)return null;window.__weigStickyIdentity=sticky.firstElementChild;const before=sticky.textContent,top=v.el.scrollTop;v.el.scrollTop=top+Math.max(2,Math.floor(v.rowHeight/4));v.el.dispatchEvent(new Event('scroll'));return{before,top};});
  await page.waitForFunction(()=>{const v=WeiG.AppState.detailViewport;return !!v&&!v._scrolling&&!v.el.__weigDataViewportScrollIdleTimer;});
  const stickyIdentityAfter=await page.evaluate(()=>{const sticky=document.querySelector('.shared-table__sticky-folder:not([hidden])');return{same:!!sticky&&sticky.firstElementChild===window.__weigStickyIdentity,text:sticky?.textContent||''};});
  assert(stickyIdentity&&stickyIdentityAfter.same&&stickyIdentityAfter.text===stickyIdentity.before,'Sticky Content folder rebuilt identical DOM during same-folder scroll: '+JSON.stringify({stickyIdentity,stickyIdentityAfter}));
  assert(stickyFolderStyle&&stickyFolderStyle.fileKind==='folder'&&stickyFolderStyle.fontWeight===normalFolderStyle.fontWeight&&Math.abs(stickyFolderStyle.height-normalFolderStyle.height)<1&&Math.abs(stickyFolderStyle.labelTop-normalFolderStyle.labelTop)<1.5&&Math.abs(stickyFolderStyle.labelLeft-normalFolderStyle.labelLeft)<1.5&&Math.abs(stickyFolderStyle.toggleTop-normalFolderStyle.toggleTop)<1.5,`Sticky Content folder must keep the normal folder typography and position: ${JSON.stringify({normalFolderStyle,stickyFolderStyle})}`);
  const stickyPath=await page.locator('.shared-table__sticky-folder:not([hidden]) .detail-file-label').textContent();
  await page.locator('.shared-table__sticky-folder:not([hidden]) .detail-file-toggle').click();
  await page.waitForFunction(path=>{const v=WeiG.AppState.detailViewport,folder=v?.items?.find(item=>item?.__weigFileKind==='folder'&&item.__weigBaseName===path);return folder?.__weigExpanded===false&&!v.items.some(item=>item?.__weigFileKind==='file'&&item.__weigParentPath===folder.__weigPath);},String(stickyPath||'').trim());
  const stickyCollapsed=await page.evaluate(path=>{const v=WeiG.AppState.detailViewport,folder=v.items.find(item=>item?.__weigFileKind==='folder'&&item.__weigBaseName===path);return{path:folder?.__weigPath||'',expanded:folder?.__weigExpanded,descendants:v.items.filter(item=>item?.__weigFileKind==='file'&&item.__weigParentPath===folder?.__weigPath).length,totalFiles:v.items.filter(item=>item?.__weigFileKind==='file').length};},String(stickyPath||'').trim());
  assert(stickyCollapsed.expanded===false&&stickyCollapsed.descendants===0,'Sticky Content folder toggle did not remove the selected folder descendants: '+JSON.stringify(stickyCollapsed));
  await resetDetailViewport(page);
  await page.locator('.shared-table__row[data-file-kind="folder"]:not([hidden]) .detail-file-toggle').first().click();
  await page.waitForFunction(()=>WeiG.AppState.detailViewport.items.some(item=>item&&item.__weigFileKind==='file'));
  await resetDetailViewport(page);

  await page.locator('.shared-table__toolbar button').first().click();
  await page.waitForSelector('#column-configurator-dialog[open]');
  const sourceConfigOrder=await page.evaluate(()=>WeiG.QbUiEvidence.detailColumns('files').map(column=>column.key)),configOrderBefore=await page.evaluate(()=>[...document.querySelectorAll('#column-configurator-dialog .shared-column-settings__row')].map(row=>row.dataset.columnKey)),visibleOrderControls=await page.locator('#column-configurator-dialog .shared-column-settings__order:not([hidden])').count();
  assert(JSON.stringify(configOrderBefore)===JSON.stringify(sourceConfigOrder),`Detail Column settings must stay on exact source order: ${JSON.stringify({configOrderBefore,sourceConfigOrder})}`);
  assert(visibleOrderControls===0,'Detail source-ordered Column settings must not expose a second reorder owner.');
  const progressLabel=await columnLabel(page,'progress'),progressBox=page.getByRole('checkbox',{name:progressLabel,exact:true});
  assert(await progressBox.isChecked(),'Column settings did not reflect source-visible Progress state.');
  await progressBox.click();
  await page.waitForFunction(()=>!document.querySelector('.shared-table__head .grid-head-cell[data-key="progress"]'));
  const hiddenState=await page.evaluate(()=>window.WeiG.SharedColumns.read('torrent-detail-files'));
  assert(hiddenState.visibility?.progress===false,`Column settings did not persist visibility through canonical owner: ${JSON.stringify(hiddenState)}`);
  await progressBox.click();
  await page.waitForFunction(()=>!!document.querySelector('.shared-table__head .grid-head-cell[data-key="progress"]'));
  const configOrderAfter=await page.evaluate(()=>[...document.querySelectorAll('#column-configurator-dialog .shared-column-settings__row')].map(row=>row.dataset.columnKey));
  assert(JSON.stringify(configOrderAfter)===JSON.stringify(sourceConfigOrder),`Detail Column settings order moved after visibility toggles: ${JSON.stringify({configOrderAfter,sourceConfigOrder})}`);
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

  await page.setViewportSize({width:360,height:800});
  await page.waitForSelector('.shared-table__viewport .shared-table__row');
  await page.locator('#detail-view .detail-tabs [data-tab="peers"]').click();
  await page.waitForFunction(()=>document.querySelector('#detail-view .detail-tabs [data-tab="peers"]')?.classList.contains('is-active'));
  await page.locator('#mobile-bottom-nav [data-route=""]').click();
  await page.waitForFunction(()=>WeiG.Router.route().name==='home'&&document.getElementById('list-view')?.classList.contains('is-active'));
  await page.waitForSelector(`.torrent-mobile-card[data-hash="${hash}"] .mobile-card-title`);
  await page.locator(`.torrent-mobile-card[data-hash="${hash}"] .mobile-card-title`).click();
  await page.waitForFunction(()=>document.querySelector('#detail-view .detail-tabs [data-tab="peers"]')?.classList.contains('is-active')&&document.getElementById('detail-view')?.classList.contains('is-active'));
  assert(await page.locator('#detail-view .detail-tabs [data-tab="peers"].is-active').count()===1,'Mobile Detail must preserve the last Users tab across Library navigation and another Torrent');
  await page.locator('#detail-view .detail-tabs [data-tab="files"]').click();
  await page.waitForSelector('.shared-table__viewport .shared-table__row');
  const mobileHero=await page.evaluate(()=>{const hero=document.querySelector('.detail-hero'),back=document.querySelector('[data-detail-back]'),state=document.getElementById('detail-state'),progress=document.querySelector('#detail-view .detail-progress'),track=progress&&progress.querySelector('.progress-track'),pct=document.getElementById('detail-progress-text'),title=document.getElementById('detail-title'),box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,cy:r.y+r.height/2};};const hs=getComputedStyle(hero);return{hero:box(hero),back:box(back),state:box(state),progress:box(progress),track:box(track),pct:box(pct),title:box(title),paddingLeft:parseFloat(hs.paddingLeft)||0,paddingRight:parseFloat(hs.paddingRight)||0,clipped:title.scrollWidth>title.clientWidth+1,titleText:String(title.textContent||'').trim()};});
  assert(Math.abs(mobileHero.back.cy-mobileHero.state.cy)<4&&Math.abs(mobileHero.state.cy-mobileHero.progress.cy)<4,'Mobile Detail Back/State/Progress must share the first row: '+JSON.stringify(mobileHero));
  assert(mobileHero.title.y>=Math.max(mobileHero.back.bottom,mobileHero.state.bottom,mobileHero.progress.bottom)-2,'Mobile Detail title must occupy the second row below Back/State/Progress: '+JSON.stringify(mobileHero));
  assert(mobileHero.back.width<110,'Mobile Detail Back must remain compact instead of stretching across its hero column: '+JSON.stringify(mobileHero));
  assert(mobileHero.track.width>=54&&mobileHero.pct.right<=mobileHero.hero.right-mobileHero.paddingRight+1,'Mobile Detail progress track/percentage must remain inside the hero at narrow widths: '+JSON.stringify(mobileHero));
  assert(mobileHero.title.x<=mobileHero.hero.x+mobileHero.paddingLeft+1&&mobileHero.title.right>=mobileHero.hero.right-mobileHero.paddingRight-1,'Mobile Detail title must consume the complete second-row content width: '+JSON.stringify(mobileHero));
  assert(mobileHero.clipped,'Mobile Detail fixture must exercise the clipped-title floating preview path');
  await page.locator('#detail-title').click();await page.waitForSelector('.ui-floating-preview');
  const titlePreview=await page.locator('.ui-floating-preview').textContent();assert(titlePreview===mobileHero.titleText,'Mobile Detail floating preview must expose the complete clipped Torrent title');
  await page.evaluate(()=>WeiG.Components.closeTextPreview());await page.waitForSelector('.ui-floating-preview',{state:'detached'});
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});

  // Android/LAN acceptance: a real touch long-press must reach the Tracker context action,
  // and copy must still succeed when Async Clipboard is unavailable on an insecure HTTP origin.
  await page.locator('#detail-view .detail-tabs [data-tab="trackers"]').click();
  await page.waitForSelector('#detail-content .shared-table__head .grid-head-cell[data-key="url"]');
  await page.waitForSelector('#detail-content .shared-table__viewport .shared-table__row');
  const trackerTargetHandle=await page.waitForFunction(()=>{const viewport=document.querySelector('#detail-content .shared-table__viewport'),head=viewport&&viewport.querySelector('.shared-table__head');if(!viewport)return null;viewport.scrollTop=0;const vr=viewport.getBoundingClientRect(),hr=head&&head.getBoundingClientRect(),rows=[...viewport.querySelectorAll('.shared-table__row[data-tracker-kind="parent"][data-context-menu="true"]')];for(const row of rows){const url=String(row.querySelector('[data-column-key="url"]')?.textContent||'').trim();if(!/^https?:\/\//i.test(url))continue;const rr=row.getBoundingClientRect(),left=Math.max(vr.left+8,rr.left+8),right=Math.min(vr.right-8,rr.right-8),top=Math.max(vr.top+8,rr.top+8,hr?hr.bottom+4:vr.top+8),bottom=Math.min(vr.bottom-8,rr.bottom-8);if(right<=left||bottom<=top)continue;for(const fraction of [.5,.25,.75]){const x=left+(right-left)*fraction,y=top+(bottom-top)/2,node=document.elementFromPoint(x,y);if(node&&row.contains(node))return{url:url,x:x,y:y,tag:node.tagName,className:String(node.className||'')};}}return null;});
  const trackerTarget=await trackerTargetHandle.jsonValue();await trackerTargetHandle.dispose();
  assert(trackerTarget&&trackerTarget.url,'Mobile Tracker long-press must resolve an actually visible source-owned Tracker row inside the active viewport.');
  const trackerCopyValue=trackerTarget.url;
  const trackerCopyRow=page.locator('.shared-table__row[data-tracker-kind="parent"][data-context-menu="true"]').filter({hasText:trackerCopyValue}).first();
  assert(await trackerCopyRow.getAttribute('data-ui-context-trigger')==='1','Mobile Tracker row must be bound to the shared Context Menu gesture owner before touch dispatch.');
  await trackerCopyRow.evaluate(row=>{window.__weigLongPressEvents=[];['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend','touchcancel','contextmenu','click'].forEach(type=>row.addEventListener(type,event=>{window.__weigLongPressEvents.push({type:type,pointerType:event.pointerType||'',button:event.button,buttons:event.buttons,clientX:event.clientX,clientY:event.clientY,time:Math.round(performance.now())});},true));});
  await page.evaluate(()=>{window.__weigExecCommand=document.execCommand;window.__weigClipboardDescriptor=Object.getOwnPropertyDescriptor(navigator,'clipboard')||null;Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});document.execCommand=function(){return false;};});
  const tcx=trackerTarget.x,tcy=trackerTarget.y;
  await touch(cdp,'touchStart',tcx,tcy);await page.waitForTimeout(720);await touch(cdp,'touchEnd',tcx,tcy);await page.waitForTimeout(220);
  const longPressDiag=await page.evaluate(()=>({events:window.__weigLongPressEvents||[],menu:document.querySelectorAll('.ui-context-menu').length}));
  assert(longPressDiag.menu===1,'Mobile Tracker long-press did not open the shared Context Menu at visible target '+JSON.stringify(trackerTarget)+'; browser event sequence: '+JSON.stringify(longPressDiag.events));
  const trackerCopyAction=page.locator('.ui-context-menu .ui-select__option').filter({hasText:'Copy tracker URL'}).first();
  assert(await trackerCopyAction.count()===1,'Mobile Tracker long-press must expose the source-owned Copy tracker URL action.');
  await trackerCopyAction.click();
  await page.waitForSelector('dialog.clipboard-copy-dialog[open] textarea.clipboard-copy-value');
  await page.waitForFunction(expected=>{const area=document.querySelector('dialog.clipboard-copy-dialog[open] textarea.clipboard-copy-value');return !!(area&&area.value===expected&&area.selectionStart===0&&area.selectionEnd===area.value.length);},trackerCopyValue,{timeout:5000});
  const manualCopy=await page.evaluate(()=>{const dialog=document.querySelector('dialog.clipboard-copy-dialog[open]'),area=dialog&&dialog.querySelector('textarea.clipboard-copy-value');return{value:area&&area.value||'',selected:!!(area&&area.selectionStart===0&&area.selectionEnd===area.value.length),detailFailure:[...document.querySelectorAll('.toast')].some(node=>/Detail action failed|详情操作失败/i.test(node.textContent||''))};});
  assert(manualCopy.value===trackerCopyValue&&manualCopy.selected&&!manualCopy.detailFailure,'Android/LAN Tracker copy denial must fall back to a selectable canonical manual-copy dialog without a false Detail failure: '+JSON.stringify(manualCopy));
  await page.locator('dialog.clipboard-copy-dialog[open] .dialog__actions button').click();
  await page.waitForSelector('dialog.clipboard-copy-dialog[open]',{state:'detached'});
  await page.evaluate(()=>{document.execCommand=window.__weigExecCommand;delete window.__weigExecCommand;if(window.__weigClipboardDescriptor)Object.defineProperty(navigator,'clipboard',window.__weigClipboardDescriptor);else delete navigator.clipboard;delete window.__weigClipboardDescriptor;delete window.__weigLongPressEvents;});
  await page.locator('#detail-view .detail-tabs [data-tab="files"]').click();
  await page.waitForSelector('#detail-content .shared-table__head .grid-head-cell[data-key="name"]');
  await page.waitForSelector('#detail-content .shared-table__viewport .shared-table__row');
  await resetDetailViewport(page);
  const headerBefore=await page.evaluate(()=>({order:[...document.querySelectorAll('#detail-content .shared-table__head .grid-head-cell')].map(node=>node.dataset.key),saved:JSON.stringify(window.WeiG.SharedColumns.read('torrent-detail-files'))}));
  const firstBox=await page.locator('.shared-table__head .grid-head-cell[data-key="name"]').boundingBox();assert(firstBox,'Mobile detail Name header is missing.');
  const tx=firstBox.x+Math.min(24,firstBox.width/2),ty=firstBox.y+firstBox.height/2;
  await touch(cdp,'touchStart',tx,ty);await touch(cdp,'touchMove',tx,ty-45);await touch(cdp,'touchMove',tx,ty-95);await touch(cdp,'touchEnd',tx,ty-95);await page.waitForTimeout(120);
  const headerAfter=await page.evaluate(()=>({order:[...document.querySelectorAll('#detail-content .shared-table__head .grid-head-cell')].map(node=>node.dataset.key),saved:JSON.stringify(window.WeiG.SharedColumns.read('torrent-detail-files'))}));
  assert(JSON.stringify(headerAfter.order)===JSON.stringify(headerBefore.order)&&headerAfter.saved===headerBefore.saved,`Quick mobile header drag accidentally reordered columns instead of cancelling before long-press arm: ${JSON.stringify({headerBefore,headerAfter})}`);

  await resetDetailViewport(page);
  const nativeBefore=await page.evaluate(()=>{const root=document.getElementById('detail-content'),viewport=document.querySelector('.shared-table__viewport'),owners=[...document.querySelectorAll('#detail-view [data-primary-scroll="1"]')];return{top:viewport.scrollTop,max:Math.max(0,viewport.scrollHeight-viewport.clientHeight),outerTop:root.scrollTop,outerMax:Math.max(0,root.scrollHeight-root.clientHeight),outerOverflow:getComputedStyle(root).overflowY,innerOverflow:getComputedStyle(viewport).overflowY,owners:owners.map(node=>node===viewport?'inner':node===root?'outer':node.className||node.id)};});
  assert(nativeBefore.max>0,`Mobile Detail touch-scroll fixture has no native vertical overflow: ${JSON.stringify(nativeBefore)}`);
  assert(JSON.stringify(nativeBefore.owners)===JSON.stringify(['inner'])&&nativeBefore.outerOverflow==='hidden'&&/auto|scroll/.test(nativeBefore.innerOverflow),`Mobile Detail must expose one table scroll owner and keep the outer shell non-scrolling: ${JSON.stringify(nativeBefore)}`);
  const bodyPoint=await visibleDetailBodyPoint(page);assert(bodyPoint,'Mobile detail visible non-interactive body point is missing.');
  const hit=await page.evaluate(({x,y})=>{const node=document.elementFromPoint(x,y),viewport=document.querySelector('.shared-table__viewport'),row=node&&node.closest&&node.closest('.shared-table__row'),interactive=node&&node.closest&&node.closest('button,input,a,select,textarea,[role="button"],[role="checkbox"]');return{inside:!!(node&&viewport&&viewport.contains(node)),row:!!row,interactive:!!interactive,tag:node&&node.tagName,className:node&&node.className};},bodyPoint);
  assert(hit.inside&&hit.row&&!hit.interactive,`Mobile Detail touch-scroll start point must hit a visible non-interactive cell inside the canonical inner viewport: ${JSON.stringify({bodyPoint,hit})}`);
  const bx=bodyPoint.x,by=bodyPoint.y,scrollDistance=Math.min(120,Math.max(24,nativeBefore.max));
  await page.mouse.move(bx,by);await page.mouse.wheel(0,scrollDistance);await page.waitForTimeout(160);
  const nativeAfter=await page.evaluate(()=>({top:document.querySelector('.shared-table__viewport').scrollTop,outerTop:document.getElementById('detail-content').scrollTop}));
  assert(nativeAfter.top>nativeBefore.top&&nativeAfter.outerTop===0,`Native browser wheel input must move only the canonical inner Detail viewport: ${JSON.stringify({nativeBefore,nativeAfter})}`);

  const longBefore=headerAfter.order,first=await page.locator('.shared-table__head .grid-head-cell[data-key="name"]').boundingBox(),second=await page.locator('.shared-table__head .grid-head-cell[data-key="size"]').boundingBox();assert(first&&second,'Mobile long-press reorder targets are missing.');
  const sx=first.x+Math.min(20,first.width/2),sy=first.y+first.height/2,movingLeft=first.x>second.x,dx=second.x+Math.max(8,Math.min(second.width-8,second.width*(movingLeft?.25:.75))),dy=second.y+second.height/2;
  await touch(cdp,'touchStart',sx,sy);await page.waitForTimeout(340);await touch(cdp,'touchMove',dx,dy);await page.waitForTimeout(70);await touch(cdp,'touchEnd',dx,dy);await page.waitForTimeout(120);
  const longAfter=await page.evaluate(()=>({order:[...document.querySelectorAll('.shared-table__head .grid-head-cell')].map(node=>node.dataset.key),saved:window.WeiG.SharedColumns.read('torrent-detail-files').order||[],source:WeiG.QbUiEvidence.detailColumns('files').map(column=>column.key)}));
  assert(JSON.stringify(longAfter.order)!==JSON.stringify(longBefore),`Mobile long-press/drag did not reorder columns: ${JSON.stringify(longAfter.order)}`);
  assert(longAfter.saved.length?JSON.stringify(longAfter.saved)===JSON.stringify(longAfter.order):JSON.stringify(longAfter.order)===JSON.stringify(longAfter.source),`Mobile long-press reorder did not converge through canonical source/override ownership: ${JSON.stringify(longAfter)}`);
  assert(errors.length===0,`Torrent detail browser errors: ${errors.join(' | ')}`);
  await context.close();
  console.log('Torrent detail browser gate passed: direct Detail-session exit, fresh Overview entry across Torrents, mobile Back/State/Progress geometry plus floating full-title preview, Android-style Tracker long-press copy with insecure-context clipboard fallback, full-height Content workspace, source hierarchy, shared horizontal scroll, column settings, touch-scroll cancellation and long-press reorder are proven in hosted Chrome.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

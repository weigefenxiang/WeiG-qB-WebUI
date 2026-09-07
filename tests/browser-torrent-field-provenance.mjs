import {launchBrowser} from './browser-driver.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../webui/private');
const productVersion=(await fs.readFile(path.resolve(here,'../VERSION'),'utf8')).trim();
const host='127.0.0.1',port=8776;
const variants={
  limited:{qb:'6.0.0',api:'2.16.2'},
  restored:{qb:'6.0.1',api:'2.16.2'}
};
const productFields=['name','size','progress','dlspeed','upspeed','eta','state','ratio','tracker','category','tags','num_seeds','num_leechs','save_path','added_on','completion_on','priority'];
const commonProfile={
  webApiVersion:'2.16.2',
  officialWeiGSupport:true,
  fallback:false,
  apiActions:[
    'appcontroller.h:preferencesAction',
    'torrentscontroller.h:categoriesAction',
    'torrentscontroller.h:tagsAction',
    'torrentscontroller.h:startAction',
    'torrentscontroller.h:stopAction',
    'torrentscontroller.h:reannounceAction',
    'torrentscontroller.h:removeTrackersAction'
  ],
  torrentFilters:['all','downloading','seeding','completed','stopped','running','active','inactive','stalled','checking','moving','errored'],
  torrentInfoParameters:['filter','category','tag','sort','reverse','limit','offset','hashes','private'],
  torrentStates:['error','missingFiles','uploading','stoppedUP','queuedUP','stalledUP','checkingUP','forcedUP','allocating','downloading','metaDL','stoppedDL','queuedDL','stalledDL','checkingDL','forcedDL','checkingResumeData','moving'],
  preferenceDescriptors:[]
};
const profiles=[
  {...commonProfile,qbVersion:'6.0.0',torrentInfoFields:['hash',...productFields.filter(key=>key!=='ratio')]},
  {...commonProfile,qbVersion:'6.0.1',torrentInfoFields:['hash',...productFields]}
];
const torrent={
  hash:'f'.repeat(40),
  name:'Field provenance fixture',
  size:1048576,
  progress:.5,
  dlspeed:1024,
  upspeed:512,
  eta:600,
  state:'downloading',
  ratio:.75,
  tracker:'https://tracker.example/announce',
  category:'Fixture',
  tags:'PhaseE',
  num_seeds:4,
  num_leechs:2,
  save_path:'/downloads',
  added_on:1000,
  completion_on:0,
  priority:1,
  private:false
};
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const json=(res,v,status=200)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(v));};
const text=(res,v,status=200)=>{res.writeHead(status,{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'});res.end(String(v));};
const empty=(res,status=200)=>{res.writeHead(status,{'cache-control':'no-store'});res.end('');};
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};

function api(req,res,v,p,url){
  if(p==='app/version')return text(res,'v'+v.qb);
  if(p==='app/webapiVersion')return text(res,v.api);
  if(p==='app/preferences')return json(res,{save_path:'/downloads',alternative_webui_enabled:true,alternative_webui_path:'/config/weigg-qb-webui'});
  if(p==='app/buildInfo')return json(res,{});
  if(p==='transfer/info')return json(res,{dl_info_speed:2048,up_info_speed:1024,connection_status:'connected'});
  if(p==='transfer/speedLimitsMode'||p==='transfer/downloadLimit'||p==='transfer/uploadLimit')return text(res,'0');
  if(p==='sync/maindata')return json(res,{rid:1,full_update:true,torrents:{},categories:{Fixture:{name:'Fixture',savePath:'/downloads'}},tags:['PhaseE'],server_state:{connection_status:'connected',dht_nodes:12,total_peer_connections:4,free_space_on_disk:10737418240}});
  if(p==='torrents/info'){
    const row={...torrent};
    if(v===variants.limited)delete row.ratio;
    const hashes=url.searchParams.get('hashes');
    let out=!hashes||hashes.split('|').includes(row.hash)?[row]:[];
    const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||0);
    return json(res,limit?out.slice(offset,offset+limit):out.slice(offset));
  }
  if(p==='torrents/categories')return json(res,{Fixture:{name:'Fixture',savePath:'/downloads'}});
  if(p==='torrents/tags')return json(res,['PhaseE']);
  if(['search/plugins','log/main','log/peers'].includes(p))return json(res,[]);
  if(p==='rss/items')return json(res,{});
  if(req.method==='POST')return empty(res);
  return json(res,{});
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${host}:${port}`);
    const match=url.pathname.match(/^\/(limited|restored)(?:\/(.*))?$/);
    if(!match){res.writeHead(404);return res.end('not found');}
    const v=variants[match[1]],rel=match[2]||'';
    if(rel.startsWith('api/v2/'))return api(req,res,v,rel.slice(7),url);
    if(rel==='data/qb-releases.json')return json(res,profiles);
    if(rel==='weigg-install.json')return json(res,{version:productVersion,gitSha:'field-provenance-browser-fixture',qbPath:'/config/weigg-qb-webui'});
    const file=path.resolve(root,rel||'index.html');
    if(!(file===root||file.startsWith(root+path.sep))){res.writeHead(403);return res.end('forbidden');}
    const body=await fs.readFile(file);
    res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':'no-store'});
    res.end(body);
  }catch(error){
    res.writeHead(error?.code==='ENOENT'?404:500,{'content-type':'text/plain; charset=utf-8'});
    res.end(String(error));
  }
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});

const browser=await launchBrowser();
try{
  const context=await browser.newContext({viewport:{width:1366,height:768},locale:'en-US'});
  await context.addInitScript(config=>{
    const key='weigg-v020-settings';
    if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(config));
  },{
    columns:[{key:'name',width:333},{key:'ratio',width:177},{key:'size',width:123}],
    mobileFields:['ratio','size']
  });
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(message.text()))errors.push(message.text());});

  await page.goto(`http://${host}:${port}/limited/#/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#torrent-list [data-hash]');
  await page.waitForFunction(()=>window.WeiG?.ReleaseProfile?.current?.()?.qbVersion==='6.0.0'&&window.WeiG?.AppState?.columns);
  const limited=await page.evaluate(()=>({
    provenance:WeiG.TorrentFieldRegistry.provenance('ratio').mode,
    head:[...document.querySelectorAll('#torrent-table-head .grid-head-cell')].map(node=>node.dataset.key),
    active:WeiG.AppState.columns.map(column=>({key:column.key,width:column.width})),
    saved:WeiG.Config.load().columns,
    savedMobile:WeiG.Config.load().mobileFields,
    effectiveMobile:WeiG.TorrentFieldRegistry.effectiveMobileFields()
  }));
  assert(limited.provenance==='UNAVAILABLE',`limited: ratio provenance must fail closed, got ${limited.provenance}`);
  assert(!limited.head.includes('ratio')&&limited.head.includes('name')&&limited.head.includes('size'),`limited: desktop effective columns wrong ${JSON.stringify(limited.head)}`);
  assert(JSON.stringify(limited.active)===JSON.stringify([{key:'name',width:333},{key:'size',width:123}]),`limited: desktop active preference projection wrong ${JSON.stringify(limited.active)}`);
  assert(JSON.stringify(limited.saved)===JSON.stringify([{key:'name',width:333},{key:'ratio',width:177},{key:'size',width:123}]),`limited: hidden desktop preference was destructively rewritten ${JSON.stringify(limited.saved)}`);
  assert(JSON.stringify(limited.savedMobile)===JSON.stringify(['ratio','size']),`limited: hidden mobile preference was destructively rewritten ${JSON.stringify(limited.savedMobile)}`);
  assert(JSON.stringify(limited.effectiveMobile)===JSON.stringify(['size']),`limited: effective mobile fields wrong ${JSON.stringify(limited.effectiveMobile)}`);

  await page.locator('#columns-btn').click();
  await page.waitForSelector('#columns-dialog[open]');
  assert(await page.locator('#columns-content .column-setting').filter({hasText:'Ratio'}).count()===0,'limited: Desktop Columns dialog exposed unavailable Ratio');
  await page.locator('#columns-close').click();

  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>!!document.querySelector('.torrent-mobile-card--two-line[data-hash]'));
  assert(await page.locator('.torrent-mobile-card--two-line .mobile-metric--ratio').count()===0,'limited: Mobile rendered unavailable Ratio');
  assert(await page.locator('.torrent-mobile-card--two-line .mobile-metric--size').count()>=1,'limited: Mobile lost available Size');

  await page.setViewportSize({width:1366,height:768});
  await page.goto(`http://${host}:${port}/restored/#/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('#torrent-list [data-hash]');
  await page.waitForFunction(()=>window.WeiG?.ReleaseProfile?.current?.()?.qbVersion==='6.0.1'&&window.WeiG?.AppState?.columns?.some?.(column=>column.key==='ratio'));
  const restored=await page.evaluate(()=>({
    provenance:WeiG.TorrentFieldRegistry.provenance('ratio').mode,
    head:[...document.querySelectorAll('#torrent-table-head .grid-head-cell')].map(node=>node.dataset.key),
    active:WeiG.AppState.columns.map(column=>({key:column.key,width:column.width})),
    saved:WeiG.Config.load().columns,
    effectiveMobile:WeiG.TorrentFieldRegistry.effectiveMobileFields()
  }));
  assert(restored.provenance==='NATIVE',`restored: ratio provenance must become NATIVE, got ${restored.provenance}`);
  assert(JSON.stringify(restored.head)===JSON.stringify(['name','ratio','size']),`restored: saved desktop order did not revive ${JSON.stringify(restored.head)}`);
  assert(JSON.stringify(restored.active)===JSON.stringify([{key:'name',width:333},{key:'ratio',width:177},{key:'size',width:123}]),`restored: hidden desktop width/order did not revive ${JSON.stringify(restored.active)}`);
  assert(JSON.stringify(restored.saved)===JSON.stringify([{key:'name',width:333},{key:'ratio',width:177},{key:'size',width:123}]),`restored: saved desktop preference changed unexpectedly ${JSON.stringify(restored.saved)}`);
  assert(JSON.stringify(restored.effectiveMobile)===JSON.stringify(['ratio','size']),`restored: mobile preference did not revive ${JSON.stringify(restored.effectiveMobile)}`);

  await page.locator('#columns-btn').click();
  await page.waitForSelector('#columns-dialog[open]');
  assert(await page.locator('#columns-content .column-setting').filter({hasText:'Ratio'}).count()===1,'restored: Desktop Columns dialog did not restore Ratio');
  await page.locator('#columns-close').click();

  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>!!document.querySelector('.torrent-mobile-card--two-line[data-hash]'));
  assert(await page.locator('.torrent-mobile-card--two-line .mobile-metric--ratio').count()>=1,'restored: Mobile did not restore Ratio');
  assert(errors.length===0,`browser errors: ${errors.join(' | ')}`);
  await context.close();
  console.log('Torrent field browser provenance gate passed: certified synthetic profiles hide unavailable Desktop/Mobile fields without destroying saved preferences, then restore order and width when exact field provenance returns.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}

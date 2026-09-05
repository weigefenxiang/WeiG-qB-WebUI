import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');

const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const absolute=relative=>new URL(String(relative).replace(/^\/+/,''),base).toString();

async function fetchJson(relative){
  const url=new URL(String(relative).replace(/^\/+/,''),base);
  url.searchParams.set('__live_sha',expectedSha);
  const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function waitForDeployedSha(){
  let last='not fetched';
  for(let attempt=1;attempt<=40;attempt++){
    try{
      const site=await fetchJson('metadata/site.json');
      last=site?.simulatorSha||'missing simulatorSha';
      if(last===expectedSha)return site;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages did not expose simulator SHA ${expectedSha}; last observation: ${last}`);
}

async function waitForLogin(page){
  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
}

async function waitForPrivate(page,qbVersion){
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(
    version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),
    qbVersion,
    {timeout:60000}
  );
}

async function waitForCatalog(page,{count,timeout=30000}={}){
  const started=Date.now();
  await page.waitForFunction(
    ()=>Boolean(window.WeiG?.AppState?.catalogReady||window.WeiG?.AppState?.catalogError),
    null,
    {timeout}
  );
  const state=await page.evaluate(()=>({
    ready:Boolean(window.WeiG?.AppState?.catalogReady),
    error:Boolean(window.WeiG?.AppState?.catalogError),
    busy:Boolean(window.WeiG?.AppState?.catalogBusy),
    count:Array.isArray(window.WeiG?.AppState?.catalog)?window.WeiG.AppState.catalog.length:-1,
    pageLabel:String(document.querySelector('#page-label')?.textContent||'').trim()
  }));
  const elapsedMs=Date.now()-started;
  assert.equal(state.error,false,`full-library catalog indexing failed after ${elapsedMs} ms`);
  assert.equal(state.ready,true,`full-library catalog did not become ready after ${elapsedMs} ms`);
  assert.equal(state.busy,false,'catalog must not remain busy after becoming ready');
  if(Number.isFinite(count))assert.equal(state.count,count,`catalog must contain all ${count} torrents`);
  return{...state,elapsedMs};
}

async function openVirtualSession(page,{branch,qb,count,scenario='mixed',seed='pages-live',clean=false}){
  const sim=`pages-live-${branch}-${qb}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const url=new URL(`${branch}/app/`,base);
  url.search=new URLSearchParams({sim,qb,count:String(count),scenario,seed,clean:clean?'1':'0'}).toString();
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await waitForLogin(page);
  return{sim,url:url.toString()};
}

async function login(page,{expectPrefill}){
  const username=page.locator('#username'),password=page.locator('#password');
  if(expectPrefill){
    assert.equal(await username.inputValue(),'demo','Lab mode must prefill demo username');
    assert.equal(await password.inputValue(),'demo','Lab mode must prefill demo password');
  }else{
    assert.equal(await username.inputValue(),'','Clean mode must not prefill username');
    assert.equal(await password.inputValue(),'','Clean mode must not prefill password');
    await username.fill('demo');
    await password.fill('demo');
  }
  await page.locator('#login-btn').click();
}

async function api(page,path,{method='GET',form,json}={}){
  return page.evaluate(async({path,method,form,json})=>{
    const init={method,cache:'no-store'};
    if(form){
      const body=new URLSearchParams();
      for(const [key,value] of Object.entries(form))body.set(key,String(value));
      init.headers={'content-type':'application/x-www-form-urlencoded'};
      init.body=body.toString();
    }else if(json!==undefined){
      init.headers={'content-type':'application/json'};
      init.body=JSON.stringify(json);
    }
    const response=await fetch(`api/v2/${path}`,init);
    const text=await response.text();
    let parsed=null;
    try{parsed=text?JSON.parse(text):null;}catch{}
    return{status:response.status,text:text.trim(),json:parsed};
  },{path,method,form,json});
}

const site=await waitForDeployedSha();
assert.equal(site.simulatorSha,expectedSha,'site metadata must belong to the exact workflow SHA');
assert.ok(site.branches?.dev?.exactSha,'site metadata must include dev exact SHA');
assert.ok(site.branches?.main?.exactSha,'site metadata must include main exact SHA');

const catalog=await fetchJson('metadata/qb-releases.json');
assert.ok(Array.isArray(catalog)&&catalog.length>0,'stable release catalog must be published');
assert.ok(catalog.some(item=>item.qbVersion==='4.1.9.1'),'catalog must retain the qB 4.1.9.1 compatibility floor');
assert.ok(catalog.some(item=>item.qbVersion==='5.2.3'),'catalog must retain the qB 5.2.3 modern anchor');

for(const branch of ['dev','main']){
  const meta=await fetchJson(`${branch}/app/virtual-qb-build.json`);
  assert.equal(meta.branch,branch,`${branch} build metadata must identify its branch`);
  assert.equal(meta.exactSha,site.branches[branch].exactSha,`${branch} app snapshot must match site metadata`);
  assert.equal(meta.simulatorSha,expectedSha,`${branch} app snapshot must use the deployed simulator SHA`);
  assert.equal(meta.webuiModified,false,`${branch} build must preserve webui/** as copied source`);
}

const browser=await launchBrowser();
try{
  {
    const context=await browser.newContext({locale:'zh-CN'});
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error?.stack||error?.message||String(error)));

    await openVirtualSession(page,{branch:'main',qb:'5.2.3',count:5000,scenario:'mixed',seed:'pages-live-5000'});
    await login(page,{expectPrefill:true});
    await waitForPrivate(page,'5.2.3');

    const catalogState=await waitForCatalog(page,{count:5000,timeout:30000});
    assert.match(catalogState.pageLabel,/第\s*1\s*\/\s*100\s*页\s*·\s*每页\s*50/,`5000-Torrent pager must settle after indexing; got ${catalogState.pageLabel}`);
    console.log(`5000-Torrent full-library catalog ready in ${catalogState.elapsedMs} ms.`);

    const version=await api(page,'app/version');
    const webApi=await api(page,'app/webapiVersion');
    assert.equal(version.status,200);assert.equal(version.text,'v5.2.3');
    assert.equal(webApi.status,200);assert.equal(webApi.text,'2.15.1');

    const all=await api(page,'torrents/info?limit=5001&offset=0');
    assert.equal(all.status,200);
    assert.ok(Array.isArray(all.json),'torrents/info must return an array');
    assert.equal(all.json.length,5000,'Pages runtime must sustain the requested 5000 Torrent world');
    const states=new Set(all.json.map(item=>item.state));
    assert.ok(states.size>=6,`5000 Torrent world must expose diverse states; got ${[...states].join(', ')}`);

    let response=await api(page,'transfer/setDownloadLimit',{method:'POST',form:{limit:3*1024*1024}});
    assert.equal(response.status,200,'global download limit write must succeed');
    response=await api(page,'transfer/downloadLimit');
    assert.equal(Number(response.text),3*1024*1024,'global download limit must round-trip');

    response=await api(page,'app/setPreferences',{method:'POST',form:{json:JSON.stringify({queueing_enabled:true,max_active_downloads:3})}});
    assert.equal(response.status,200,'app/setPreferences must succeed');
    response=await api(page,'app/preferences');
    assert.equal(response.json?.queueing_enabled,true,'queueing preference must persist in the virtual daemon');
    assert.equal(Number(response.json?.max_active_downloads),3,'max active downloads must persist in the virtual daemon');

    const addResult=await page.evaluate(async()=>{
      const form=new FormData();
      form.append('torrents',new File(['virtual-pages-acceptance'],'Pages-Live-Acceptance.torrent',{type:'application/x-bittorrent'}));
      const response=await fetch('api/v2/torrents/add',{method:'POST',body:form,cache:'no-store'});
      return{status:response.status,text:(await response.text()).trim()};
    });
    assert.equal(addResult.status,200,'adding a virtual torrent must succeed');
    response=await api(page,'torrents/info?limit=5002&offset=0');
    assert.equal(response.json.length,5001,'added Torrent must enter the persistent virtual world');
    assert.ok(response.json.some(item=>item.name==='Pages-Live-Acceptance.torrent'),'added Torrent must be queryable by its virtual file name');

    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    await waitForPrivate(page,'5.2.3');
    response=await api(page,'transfer/downloadLimit');
    assert.equal(Number(response.text),3*1024*1024,'speed limit must survive a real page reload');
    response=await api(page,'app/preferences');
    assert.equal(response.json?.queueing_enabled,true,'preferences must survive a real page reload');
    response=await api(page,'torrents/info?limit=5002&offset=0');
    assert.ok(response.json.some(item=>item.name==='Pages-Live-Acceptance.torrent'),'added Torrent must survive a real page reload');

    await page.evaluate(()=>window.WeiG.SessionController.logout());
    await waitForLogin(page);
    response=await api(page,'app/preferences');
    assert.equal(response.status,403,'real SessionController logout must leave protected API unauthenticated');
    assert.deepEqual(pageErrors,[],`qB5 Pages session emitted page errors:\n${pageErrors.join('\n')}`);
    await context.close();
  }

  {
    const context=await browser.newContext({locale:'zh-CN'});
    const page=await context.newPage();
    const pageErrors=[];
    page.on('pageerror',error=>pageErrors.push(error?.stack||error?.message||String(error)));

    await openVirtualSession(page,{branch:'dev',qb:'4.1.9.1',count:320,scenario:'mixed',seed:'pages-live-qb4',clean:true});
    await login(page,{expectPrefill:false});
    await waitForPrivate(page,'4.1.9.1');

    const version=await api(page,'app/version');
    const webApi=await api(page,'app/webapiVersion');
    assert.equal(version.text,'v4.1.9.1');
    assert.equal(webApi.text,'2.2.1');

    let response=await api(page,'torrents/info?limit=1&offset=0');
    assert.equal(response.status,200);assert.equal(response.json.length,1);
    const hash=response.json[0].hash;
    response=await api(page,'torrents/pause',{method:'POST',form:{hashes:hash}});
    assert.equal(response.status,200,'qB4 pause endpoint must be available');
    response=await api(page,'torrents/stop',{method:'POST',form:{hashes:hash}});
    assert.equal(response.status,404,'qB4 profile must not expose the qB5 stop endpoint');
    response=await api(page,'torrents/resume',{method:'POST',form:{hashes:hash}});
    assert.equal(response.status,200,'qB4 resume endpoint must be available');

    assert.deepEqual(pageErrors,[],`qB4 Pages session emitted page errors:\n${pageErrors.join('\n')}`);
    await context.close();
  }
}finally{
  await browser.close();
}

console.log(`Virtual qB Pages live acceptance passed for ${expectedSha}: exact deployed metadata, dev/main snapshots, qB5 5000-Torrent runtime/catalog pagination, persistence/add/settings/limits/logout, Clean Mode, and qB4 endpoint semantics.`);

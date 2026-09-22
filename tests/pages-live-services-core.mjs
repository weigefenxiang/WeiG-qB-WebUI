import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const serviceMode=(process.env.WEIG_SERVICES_CORE_MODE||'all').trim()||'all';
const serviceModes=new Set(['all','modern','owner-ui','legacy','isolation','offline']);
assert.ok(serviceModes.has(serviceMode),`Unsupported WEIG_SERVICES_CORE_MODE=${serviceMode}`);
const sessionTimeout=Math.max(5000,Number(process.env.WEIG_PAGES_SESSION_TIMEOUT_MS||20000));
const sessionAttempts=3;
const lane=name=>serviceMode==='all'||serviceMode===name;

async function waitForSha(){
  let last='';
  for(let attempt=0;attempt<40;attempt++){
    try{
      const url=new URL('metadata/site.json',base);url.searchParams.set('__services_sha',expectedSha);
      const response=await fetch(url,{headers:{'cache-control':'no-cache'}});const site=response.ok?await response.json():null;
      last=site?.simulatorSha||`HTTP ${response.status}`;if(last===expectedSha)return;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages services acceptance could not observe ${expectedSha}; last=${last}`);
}

async function sessionDiagnostics(page){
  try{return await page.evaluate(()=>({url:location.href,readyState:document.readyState,bootstrap:document.documentElement.dataset.weigBootstrap||'',loginVisible:!!document.querySelector('#login-form')&&!document.querySelector('#login-form')?.hidden,torrentList:!!document.querySelector('#torrent-list'),fatalVisible:!!document.querySelector('#fatal:not(.is-hidden)'),body:String(document.body?.innerText||'').replace(/\s+/g,' ').slice(0,240)}));}
  catch(error){return{url:page.url(),diagnosticError:error?.message||String(error)};}
}

async function waitForSessionEntry(page){
  const handle=await page.waitForFunction(()=>{
    if(document.querySelector('#torrent-list'))return'private';
    const login=document.querySelector('#login-form'),style=login&&getComputedStyle(login);
    if(login&&!login.hidden&&style?.display!=='none'&&style?.visibility!=='hidden')return'login';
    if(document.querySelector('#fatal:not(.is-hidden)')||document.documentElement.dataset.weigBootstrap==='failed')return'failed';
    return'';
  },null,{timeout:sessionTimeout});
  return handle.jsonValue();
}

async function openSession(page,{branch='main',qb='5.2.3',count=1000,scenario='mixed',seed='services-live',sim}){
  const sessionId=sim||`services-${crypto.randomUUID()}`,url=new URL(`${branch}/app/`,base);
  url.search=new URLSearchParams({sim:sessionId,qb,count:String(count),scenario,seed,clean:'0'}).toString();
  let last=null;
  for(let attempt=1;attempt<=sessionAttempts;attempt++){
    const attemptUrl=new URL(url);attemptUrl.searchParams.set('__weig_session_attempt',String(attempt));
    try{
      await page.goto(attemptUrl.toString(),{waitUntil:'domcontentloaded',timeout:sessionTimeout});
      const entry=await waitForSessionEntry(page);
      if(entry==='failed')throw new Error('WeiG bootstrap entered failed/fatal state before session authentication');
      if(entry==='login'){
        assert.equal(await page.locator('#username').inputValue(),'weigshare');
        assert.equal(await page.locator('#password').inputValue(),'weigshare');
        await page.locator('#login-btn').click();
      }
      await page.waitForSelector('#torrent-list',{state:'attached',timeout:sessionTimeout});
      await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),qb,{timeout:sessionTimeout});
      if(attempt>1)console.log(`Recovered ${serviceMode} session ${sessionId} on bootstrap attempt ${attempt}.`);
      return url.toString();
    }catch(error){
      last={attempt,error:error?.message||String(error),state:await sessionDiagnostics(page)};
      if(attempt<sessionAttempts)await sleep(500*attempt);
    }
  }
  throw new Error(`Pages services ${serviceMode} session bootstrap failed after ${sessionAttempts} attempts: ${JSON.stringify(last)}`);
}

async function api(page,path,{method='GET',form}={}){
  return page.evaluate(async({path,method,form})=>{
    const init={method,cache:'no-store'};
    if(form){const body=new URLSearchParams();for(const [key,value] of Object.entries(form))body.set(key,String(value));init.headers={'content-type':'application/x-www-form-urlencoded'};init.body=body.toString();}
    const response=await fetch(`api/v2/${path}`,init);const text=await response.text();let json=null;try{json=text?JSON.parse(text):null;}catch{}
    return{status:response.status,text:text.trim(),json};
  },{path,method,form});
}

await waitForSha();
const browser=await launchBrowser();
try{
  if(lane('modern')){
    const context=await browser.newContext({locale:'zh-CN'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error?.message||String(error)));
    await openSession(page,{qb:'5.2.3',count:1000,scenario:'mixed',seed:'services-surface'});

    let response=await api(page,'torrents/info?limit=1001&offset=0');
    assert.equal(response.status,200);assert.equal(response.json.length,1000);
    const publicTorrent=response.json.find(t=>t.private!==true),privateTorrent=response.json.find(t=>t.private===true);
    assert.ok(publicTorrent&&privateTorrent,'qB5 live world must contain public and private/PT torrents');

    response=await api(page,`torrents/webseeds?hash=${encodeURIComponent(publicTorrent.hash)}`);
    assert.ok(Array.isArray(response.json)&&response.json.length>=1,'public torrent must expose virtual web seeds on deployed Pages');
    response=await api(page,`torrents/webseeds?hash=${encodeURIComponent(privateTorrent.hash)}`);
    assert.deepEqual(response.json,[],'private/PT torrent must not expose fabricated public web seeds');

    response=await api(page,'torrents/info?filter=active&limit=20&offset=0');
    const peerTarget=response.json.find(t=>t.dlspeed>0||t.upspeed>0)||publicTorrent;
    response=await api(page,`sync/torrentPeers?rid=0&hash=${encodeURIComponent(peerTarget.hash)}`);
    const peerKey=Object.keys(response.json?.peers||{})[0];
    if(peerKey){
      response=await api(page,'transfer/banPeers',{method:'POST',form:{peers:peerKey}});assert.equal(response.status,200);
      response=await api(page,'log/peers?last_known_id=-1');
      assert.ok(response.json.some(item=>item.blocked===true),'peer ban must appear in deployed peer log');
    }

    response=await api(page,'torrents/setDownloadLimit',{method:'POST',form:{hashes:publicTorrent.hash,limit:1024*1024}});assert.equal(response.status,200);
    response=await api(page,`torrents/properties?hash=${encodeURIComponent(publicTorrent.hash)}`);
    assert.equal(Number(response.json?.dl_limit),1024*1024,'per-torrent speed limit must persist through the public WebAPI');

    response=await api(page,'app/setPreferences',{method:'POST',form:{json:JSON.stringify({queueing_enabled:true,max_active_downloads:2,max_active_uploads:3,max_active_torrents:5})}});assert.equal(response.status,200);
    await sleep(500);
    response=await api(page,'torrents/info?limit=1001&offset=0');
    assert.ok(response.json.filter(t=>t.state==='downloading').length<=2,'deployed scheduler must obey maximum active downloads');
    assert.ok(response.json.filter(t=>t.state==='uploading').length<=3,'deployed scheduler must obey maximum active uploads');

    // Full RSS management surface plus rule -> real torrent side effect.
    const beforeRss=response.json.length;
    response=await api(page,'rss/addFolder',{method:'POST',form:{path:'Pages'}});assert.equal(response.status,200);
    response=await api(page,'rss/addFeed',{method:'POST',form:{url:'https://pages-rss.example.invalid/releases.xml',path:'Pages/Releases',refreshInterval:1800}});assert.equal(response.status,200);
    response=await api(page,'rss/setFeedURL',{method:'POST',form:{path:'Pages/Releases',url:'https://pages-rss.example.invalid/mirror.xml'}});assert.equal(response.status,200);
    response=await api(page,'rss/setFeedRefreshInterval',{method:'POST',form:{path:'Pages/Releases',refreshInterval:900}});assert.equal(response.status,200);
    response=await api(page,'rss/items?withData=true');let rssItems=response.json;assert.equal(rssItems['Pages/Releases'].refreshInterval,900);
    const initialArticle=rssItems['Pages/Releases'].articles[0];
    response=await api(page,'rss/markAsRead',{method:'POST',form:{itemPath:'Pages/Releases',articleId:initialArticle.id}});assert.equal(response.status,200);
    response=await api(page,'rss/setRule',{method:'POST',form:{ruleName:'Pages Auto Add',ruleDef:JSON.stringify({enabled:true,mustContain:'Virtual update',tags:['pages-rss'],assignedCategory:'Linux',affectedFeeds:['Pages/Releases']})}});assert.equal(response.status,200);
    response=await api(page,`rss/matchingArticles?ruleName=${encodeURIComponent('Pages Auto Add')}`);assert.equal(response.status,200);
    response=await api(page,'rss/refreshItem',{method:'POST',form:{itemPath:'Pages/Releases'}});assert.equal(response.status,200);
    response=await api(page,'torrents/info?limit=1002&offset=0');
    assert.equal(response.json.length,beforeRss+1,'RSS rule must auto-add a persistent Virtual Torrent on deployed Pages');
    assert.ok(response.json.some(t=>String(t.tags).includes('pages-rss')),'RSS auto-added torrent must carry rule tags');
    response=await api(page,'rss/addFolder',{method:'POST',form:{path:'Archive'}});assert.equal(response.status,200);
    response=await api(page,'rss/moveItem',{method:'POST',form:{itemPath:'Pages/Releases',destPath:'Archive'}});assert.equal(response.status,200);
    rssItems=(await api(page,'rss/items?withData=true')).json;assert.ok(rssItems['Archive/Releases'],'moved RSS feed must retain state at its new path');

    // Search plugin lifecycle, job lifecycle and download -> real torrent side effect.
    response=await api(page,'search/plugins');assert.equal(response.status,200);assert.ok(response.json.some(plugin=>plugin.name==='virtual'));
    response=await api(page,'search/installPlugin',{method:'POST',form:{sources:'https://plugins.example.invalid/pages-extra.py'}});assert.equal(response.status,200);
    response=await api(page,'search/enablePlugin',{method:'POST',form:{names:'pages-extra',enable:false}});assert.equal(response.status,200);
    response=await api(page,'search/updatePlugins',{method:'POST',form:{}});assert.equal(response.status,200);
    response=await api(page,'search/plugins');const extra=response.json.find(plugin=>plugin.name==='pages-extra');assert.ok(extra&&!extra.enabled,'plugin state must be observable after install/disable/update');
    response=await api(page,'search/start',{method:'POST',form:{pattern:'Pages Fedora',plugins:'enabled',category:'all'}});const job=response.json;assert.ok(job.id>0);
    response=await api(page,`search/results?id=${job.id}&limit=20&offset=0`);assert.ok(response.json.results.length>=6,'deployed Search must expose live virtual results');
    const firstResult=response.json.results[0];assert.ok(firstResult.engineName);assert.ok(Number.isInteger(firstResult.pubDate));
    const beforeSearch=(await api(page,'torrents/info?limit=1005&offset=0')).json.length;
    response=await api(page,'search/downloadTorrent',{method:'POST',form:{torrentUrl:firstResult.fileUrl,pluginName:'virtual'}});assert.equal(response.status,200);
    response=await api(page,'torrents/info?limit=1005&offset=0');assert.equal(response.json.length,beforeSearch+1,'search/downloadTorrent must add a real Virtual Torrent');
    response=await api(page,'search/delete',{method:'POST',form:{id:job.id}});assert.equal(response.status,200);
    response=await api(page,'search/uninstallPlugin',{method:'POST',form:{names:'pages-extra'}});assert.equal(response.status,200);

    // qB 5.2 app/clientdata/metadata service surface.
    response=await api(page,'app/defaultSavePath');assert.equal(response.status,200);assert.ok(response.text.startsWith('/'));
    response=await api(page,`app/getDirectoryContent?dirPath=${encodeURIComponent('/downloads')}&mode=dirs&withMetadata=true`);assert.equal(response.status,200);assert.ok(Array.isArray(response.json)&&response.json.every(item=>item.type==='dir'));
    response=await api(page,'app/networkInterfaceList');assert.equal(response.status,200);assert.ok(response.json.some(item=>item.value==='eth0'));
    response=await api(page,'app/networkInterfaceAddressList?iface=eth0');assert.equal(response.status,200);assert.ok(response.json.includes('192.0.2.10'));
    response=await api(page,'app/processInfo');assert.equal(response.status,200);assert.ok(Number.isInteger(response.json.launch_time));
    response=await api(page,'app/rotateAPIKey',{method:'POST',form:{}});assert.equal(response.status,200);assert.match(response.json.apiKey,/^[0-9a-f]{32}$/);
    response=await api(page,'app/deleteAPIKey',{method:'POST',form:{}});assert.equal(response.status,200);
    response=await api(page,'app/sendTestEmail',{method:'POST',form:{}});assert.equal(response.status,200);
    response=await api(page,'clientdata/store',{method:'POST',form:{data:JSON.stringify({pages_acceptance:'ok'})}});assert.equal(response.status,204);
    response=await api(page,`clientdata/load?keys=${encodeURIComponent(JSON.stringify(['pages_acceptance']))}`);assert.deepEqual(response.json,{pages_acceptance:'ok'});

    const metadataSource='magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=Pages%20Metadata';
    response=await api(page,'torrents/fetchMetadata',{method:'POST',form:{source:metadataSource}});assert.equal(response.status,202);
    response=await api(page,'torrents/fetchMetadata',{method:'POST',form:{source:metadataSource}});assert.equal(response.status,200);assert.equal(response.json.info.name,'Pages Metadata');
    response=await api(page,`torrents/saveMetadata?source=${encodeURIComponent(metadataSource)}`);assert.equal(response.status,200);assert.ok(response.text.length>40);

    response=await api(page,'torrentcreator/addTask',{method:'POST',form:{sourcePath:'/virtual/pages-source'}});const task=response.json;assert.ok(task.taskID);
    await sleep(2200);
    response=await api(page,`torrentcreator/status?taskID=${encodeURIComponent(task.taskID)}`);assert.equal(response.json.status,'Finished');
    const creatorBlob=await page.evaluate(async taskID=>{const r=await fetch(`api/v2/torrentcreator/torrentFile?taskID=${encodeURIComponent(taskID)}`,{cache:'no-store'});return{status:r.status,size:(await r.blob()).size};},task.taskID);
    assert.equal(creatorBlob.status,200);assert.ok(creatorBlob.size>0,'deployed Torrent Creator must return a virtual torrent blob');

    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
    response=await api(page,'rss/rules');assert.ok(response.json['Pages Auto Add'],'RSS rules must survive real browser reload through IndexedDB');
    response=await api(page,'torrents/info?limit=1005&offset=0');assert.ok(response.json.some(t=>String(t.tags).includes('pages-rss')),'RSS-created torrent must survive reload');
    response=await api(page,'clientdata/load');assert.equal(response.json.pages_acceptance,'ok','clientdata must survive browser reload');
    assert.deepEqual(errors,[],`qB5 services page errors:\n${errors.join('\n')}`);
    await context.close();
  }

  if(lane('owner-ui')){
    // A6 0.3.159 product-behavior gate: exercise the dev UI owners instead of
    // proving only the underlying Virtual qB endpoints.
    const context=await browser.newContext({locale:'zh-CN'}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
    await openSession(page,{branch:'dev',qb:'5.2.3',count:24,scenario:'mixed',seed:'services-owner-ui'});
    let response=await api(page,'torrents/info?limit=30&offset=0');
    const detailTarget=response.json.find(item=>item.private!==true)||response.json[0];
    assert.ok(detailTarget,'owner UI gate requires one torrent detail target');

    await page.evaluate(()=>window.WeiG.Router.go('rss'));
    await page.waitForFunction(()=>document.getElementById('rss-view')?.classList.contains('is-active'),null,{timeout:30000});
    const downloader=page.getByRole('button',{name:'RSS Downloader'}).first();
    await downloader.waitFor({state:'visible',timeout:30000});
    await page.waitForFunction(()=>{const button=[...document.querySelectorAll('#rss-view button')].find(node=>node.textContent.trim()==='RSS Downloader');return !!button&&!button.disabled;},null,{timeout:30000});
    await downloader.click();
    await page.waitForSelector('#rss-rules-dialog[open]',{state:'visible',timeout:30000});
    const addRule=page.locator('#rss-rules-dialog [data-rss-rule-collection-action="add"]');
    const removeRule=page.locator('#rss-rules-dialog [data-rss-rule-collection-action="remove"]');
    assert.equal(await addRule.count(),1,'RSS Rule Collection must expose exactly one source-proven add action beside the rule list');
    assert.equal(await removeRule.count(),1,'RSS Rule Collection must expose exactly one source-proven remove action beside the rule list');
    await addRule.click();
    await page.waitForFunction(()=>window.WeiG?.RSSRules?.state?.().newDraft===true,null,{timeout:30000});
    assert.equal(await page.locator('#rss-rules-dialog [data-rss-rule-draft="new"].is-active').count(),1,'new RSS rule draft must live inside the canonical Rule Collection list');
    const ruleName='Pages UI Rule';
    await page.locator('#rss-rules-dialog [data-rss-rule-field="name"]').fill(ruleName);

    const stopped=page.locator('#rss-rules-dialog [data-rss-rule-key="stopped"] .ui-select__trigger');
    await stopped.waitFor({state:'visible',timeout:30000});await stopped.click();
    await page.locator('#rss-rules-dialog .weig-floating-layer--dialog .ui-select__option[data-value="1"]').click();
    const layout=page.locator('#rss-rules-dialog [data-rss-rule-key="layout"] .ui-select__trigger');
    await layout.waitFor({state:'visible',timeout:30000});await layout.click();
    await page.locator('#rss-rules-dialog .weig-floating-layer--dialog .ui-select__option[data-value="2"]').click();
    await page.locator('#rss-rules-dialog [data-rss-rule-save="1"]').click();
    await page.waitForFunction(name=>window.WeiG?.RSSRules?.state?.().rules?.includes(name)&&window.WeiG?.RSSRules?.state?.().newDraft===false,ruleName,{timeout:30000});
    response=await api(page,'rss/rules');
    assert.equal(response.status,200,'saved RSS rule must be readable through the source-proven endpoint');
    assert.equal(response.json?.[ruleName]?.torrentParams?.stopped,true,'canonical Add Stopped/Paused Select must persist its source-proven modern boolean value');
    assert.equal(response.json?.[ruleName]?.torrentParams?.content_layout,'Subfolder','canonical Torrent Content Layout Select must persist its source-proven modern value');
    await removeRule.click();
    await page.waitForFunction(name=>!window.WeiG?.RSSRules?.state?.().rules?.includes(name),ruleName,{timeout:30000});
    response=await api(page,'rss/rules');assert.equal(response.json?.[ruleName],undefined,'Rule Collection remove action must remove the selected persisted rule');
    const closeDownloader=page.locator('#rss-rules-dialog .workspace__header .inline-form button').last();
    await closeDownloader.click();
    await page.waitForSelector('#rss-rules-dialog',{state:'hidden',timeout:30000});

    await page.evaluate(({hash})=>window.WeiG.Router.detail(hash,'trackers'),{hash:detailTarget.hash});
    await page.waitForFunction(()=>document.getElementById('detail-view')?.classList.contains('is-active'),null,{timeout:30000});
    await page.waitForSelector('#detail-content .shared-table__toolbar',{state:'visible',timeout:30000});
    assert.equal(await page.locator('#detail-content .shared-table__toolbar .shared-table__columns-button').count(),1,'Tracker Detail top toolbar must retain only the shared Columns presentation owner');
    assert.equal(await page.locator('#detail-content .shared-table__toolbar .btn--primary').count(),0,'Tracker source context actions must not be duplicated as Add/Edit/Remove/Copy top buttons');
    const trackerRow=page.locator('#detail-content .shared-table__row').last();
    await trackerRow.waitFor({state:'visible',timeout:30000});await trackerRow.click({button:'right'});
    await page.waitForSelector('#weig-floating-layer .ui-context-menu .ui-select__option',{state:'visible',timeout:30000});
    assert.ok(await page.locator('#weig-floating-layer .ui-context-menu .ui-select__option').count()>=2,'Tracker row context menu actions must remain available after retiring the duplicate toolbar');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors,[],`owner UI gate page errors:\n${errors.join('\n')}`);
    await context.close();
  }

  if(lane('legacy')){
    // Historical old-GUI RSS dialect: collection + Add Paused must work on the
    // exact qB 4.1.9.1 source surface; Content Layout is intentionally absent
    // because that upstream control did not exist yet.
    const context=await browser.newContext({locale:'zh-CN'}),page=await context.newPage();
    await openSession(page,{branch:'dev',qb:'4.1.9.1',count:24,scenario:'mixed',seed:'services-rss-4191'});
    await page.evaluate(()=>window.WeiG.Router.go('rss'));
    await page.waitForFunction(()=>document.getElementById('rss-view')?.classList.contains('is-active'),null,{timeout:30000});
    const downloader=page.getByRole('button',{name:'RSS Downloader'}).first();
    await downloader.waitFor({state:'visible',timeout:30000});
    await page.waitForFunction(()=>{const button=[...document.querySelectorAll('#rss-view button')].find(node=>node.textContent.trim()==='RSS Downloader');return !!button&&!button.disabled;},null,{timeout:30000});
    await downloader.click();await page.waitForSelector('#rss-rules-dialog[open]',{state:'visible',timeout:30000});
    await page.locator('#rss-rules-dialog [data-rss-rule-collection-action="add"]').click();
    await page.locator('#rss-rules-dialog [data-rss-rule-field="name"]').fill('Legacy UI Rule');
    const stopped=page.locator('#rss-rules-dialog [data-rss-rule-key="stopped"] .ui-select__trigger');
    await stopped.waitFor({state:'visible',timeout:30000});await stopped.click();await page.locator('#rss-rules-dialog .weig-floating-layer--dialog .ui-select__option[data-value="1"]').click();
    assert.equal(await page.locator('#rss-rules-dialog [data-rss-rule-key="layout"]').count(),0,'qB 4.1.9.1 must not fabricate a Torrent Content Layout control absent from exact upstream source');
    await page.locator('#rss-rules-dialog [data-rss-rule-save="1"]').click();
    await page.waitForFunction(()=>window.WeiG?.RSSRules?.state?.().rules?.includes('Legacy UI Rule'),null,{timeout:30000});
    const rules=await api(page,'rss/rules');
    assert.equal(rules.json?.['Legacy UI Rule']?.addPaused,true,'qB 4.1.9.1 canonical Add Paused Select must round-trip through the old GUI/API dialect');
    await context.close();

    const context410=await browser.newContext({locale:'zh-CN'}),page410=await context410.newPage();
    await openSession(page410,{branch:'dev',qb:'4.1.0',count:100,scenario:'mixed',seed:'services-qb410'});
    for(const path of ['app/buildInfo','app/processInfo','search/plugins']){
      const response=await api(page410,path);assert.equal(response.status,404,`${path} must be absent in deployed qB 4.1.0 profile`);
    }
    let response=await api(page410,'rss/items?withData=true');
    assert.equal(response.status,200,'qB 4.1.0 RSS items must follow exact source action provenance, not a stale WebAPI >= 2.1.0 heuristic');
    assert.ok(response.json&&typeof response.json==='object'&&!Array.isArray(response.json),'qB 4.1.0 RSS items must return the real virtual RSS object shape');
    response=await api(page410,'app/defaultSavePath');assert.equal(response.status,200,'original v2 generation must retain defaultSavePath');
    response=await api(page410,'transfer/banPeers',{method:'POST',form:{peers:'10.0.0.1:50000'}});assert.equal(response.status,404,'qB 4.1.0 profile must not expose peer ban');
    await context410.close();
  }

  if(lane('isolation')){
    const context=await browser.newContext({locale:'zh-CN'}),a=await context.newPage(),b=await context.newPage();
    await openSession(a,{qb:'5.2.3',count:120,seed:'isolation-a',sim:`isolation-a-${Date.now()}`});
    await openSession(b,{qb:'4.1.9.1',count:120,seed:'isolation-b',sim:`isolation-b-${Date.now()}`});
    let response=await api(a,'transfer/setDownloadLimit',{method:'POST',form:{limit:7*1024*1024}});assert.equal(response.status,200);
    response=await api(b,'transfer/downloadLimit');assert.equal(Number(response.text),0,'independent virtual sessions must not share speed-limit state');
    response=await api(a,'torrents/add',{method:'POST',form:{urls:'magnet:?xt=urn:btih:1111111111111111111111111111111111111111&dn=Isolation-A'}});assert.equal(response.status,200);
    const aList=await api(a,'torrents/info?limit=200&offset=0'),bList=await api(b,'torrents/info?limit=200&offset=0');
    assert.equal(aList.json.length,121);assert.equal(bList.json.length,120,'independent sessions must not share torrent entities');
    assert.equal((await api(a,'app/version')).text,'v5.2.3');assert.equal((await api(b,'app/version')).text,'v4.1.9.1','independent tabs must retain distinct qB profiles');
    await context.close();
  }

  if(lane('offline')){
    const context=await browser.newContext({locale:'zh-CN'}),page=await context.newPage();
    await openSession(page,{qb:'5.2.3',count:120,scenario:'offline',seed:'services-offline'});
    let transfer=await api(page,'transfer/info');assert.equal(transfer.json.connection_status,'disconnected');assert.equal(transfer.json.dl_info_speed,0);assert.equal(transfer.json.up_info_speed,0);
    let response=await api(page,'app/shutdown',{method:'POST',form:{}});assert.equal(response.status,200);
    transfer=await api(page,'transfer/info');assert.equal(transfer.json.connection_status,'disconnected','virtual shutdown must leave the daemon offline without affecting the browser');
    await context.close();
  }
}finally{await browser.close();}

console.log(`Virtual qB Pages services acceptance (${serviceMode}) passed for ${expectedSha}: torrent/peer limits, full RSS management, Search plugin/job/download management, qB5 app/clientdata/metadata services, Torrent Creator, historical qB4 boundaries, multi-session isolation, offline and virtual shutdown behavior.`);

import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

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

async function openSession(page,{branch='main',qb='5.2.3',count=1000,scenario='mixed',seed='services-live',sim}){
  const url=new URL(`${branch}/app/`,base);
  url.search=new URLSearchParams({sim:sim||`services-${crypto.randomUUID()}`,qb,count:String(count),scenario,seed,clean:'0'}).toString();
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
  assert.equal(await page.locator('#username').inputValue(),'demo');
  assert.equal(await page.locator('#password').inputValue(),'demo');
  await page.locator('#login-btn').click();
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),qb,{timeout:60000});
  return url.toString();
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
  {
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

    const beforeRss=response.json.length;
    response=await api(page,'rss/setRule',{method:'POST',form:{ruleName:'Pages Auto Add',ruleDef:JSON.stringify({enabled:true,mustContain:'Virtual update',tags:['pages-rss'],assignedCategory:'Linux'})}});assert.equal(response.status,200);
    response=await api(page,'rss/addFeed',{method:'POST',form:{url:'https://pages-rss.example.invalid/releases.xml',path:''}});assert.equal(response.status,200);
    response=await api(page,'rss/items?withData=true');const feedKey=Object.keys(response.json)[0];assert.ok(feedKey);
    response=await api(page,'rss/refreshItem',{method:'POST',form:{itemPath:feedKey}});assert.equal(response.status,200);
    response=await api(page,'torrents/info?limit=1002&offset=0');
    assert.equal(response.json.length,beforeRss+1,'RSS rule must auto-add a persistent Virtual Torrent on deployed Pages');
    assert.ok(response.json.some(t=>String(t.tags).includes('pages-rss')),'RSS auto-added torrent must carry rule tags');

    response=await api(page,'search/start',{method:'POST',form:{pattern:'Pages Fedora',plugins:'enabled',category:'all'}});const job=response.json;assert.ok(job.id>0);
    response=await api(page,`search/results?id=${job.id}&limit=20&offset=0`);assert.ok(response.json.results.length>=6,'deployed Search must expose live virtual results');

    response=await api(page,'torrentcreator/addTask',{method:'POST',form:{sourcePath:'/virtual/pages-source'}});const task=response.json;assert.ok(task.taskID);
    await sleep(2200);
    response=await api(page,`torrentcreator/status?taskID=${encodeURIComponent(task.taskID)}`);assert.equal(response.json.status,'Finished');
    const creatorBlob=await page.evaluate(async taskID=>{const r=await fetch(`api/v2/torrentcreator/torrentFile?taskID=${encodeURIComponent(taskID)}`,{cache:'no-store'});return{status:r.status,size:(await r.blob()).size};},task.taskID);
    assert.equal(creatorBlob.status,200);assert.ok(creatorBlob.size>0,'deployed Torrent Creator must return a virtual torrent blob');

    await page.reload({waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
    response=await api(page,'rss/rules');assert.ok(response.json['Pages Auto Add'],'RSS rules must survive real browser reload through IndexedDB');
    response=await api(page,'torrents/info?limit=1002&offset=0');assert.ok(response.json.some(t=>String(t.tags).includes('pages-rss')),'RSS-created torrent must survive reload');
    assert.deepEqual(errors,[],`qB5 services page errors:\n${errors.join('\n')}`);
    await context.close();
  }

  {
    const context=await browser.newContext({locale:'zh-CN'}),page=await context.newPage();
    await openSession(page,{branch:'dev',qb:'4.1.0',count:100,scenario:'mixed',seed:'services-qb410'});
    for(const path of ['app/buildInfo','rss/items?withData=true','search/plugins']){
      const response=await api(page,path);assert.equal(response.status,404,`${path} must be absent in deployed qB 4.1.0 profile`);
    }
    const response=await api(page,'transfer/banPeers',{method:'POST',form:{peers:'10.0.0.1:50000'}});assert.equal(response.status,404,'qB 4.1.0 profile must not expose peer ban');
    await context.close();
  }

  {
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

  {
    const context=await browser.newContext({locale:'zh-CN'}),page=await context.newPage();
    await openSession(page,{qb:'5.2.3',count:120,scenario:'offline',seed:'services-offline'});
    const transfer=await api(page,'transfer/info');assert.equal(transfer.json.connection_status,'disconnected');assert.equal(transfer.json.dl_info_speed,0);assert.equal(transfer.json.up_info_speed,0);
    await context.close();
  }
}finally{await browser.close();}

console.log(`Virtual qB Pages services acceptance passed for ${expectedSha}: webseeds, peer logs/bans, per-torrent limits, queue scheduling, RSS auto-add persistence, Search, Torrent Creator, historical qB4 capability failures, multi-session isolation and offline behavior.`);

import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');

const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function deployedSha(){
  const url=new URL('metadata/site.json',base);
  url.searchParams.set('__live_protocol_sha',expectedSha);
  const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);
  return (await response.json())?.simulatorSha||'';
}

async function waitForDeployedSha(){
  let last='';
  for(let attempt=0;attempt<40;attempt++){
    try{last=await deployedSha();if(last===expectedSha)return;}catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages protocol gate did not observe simulator SHA ${expectedSha}; last=${last}`);
}

async function openSession(page,qb,seed){
  const url=new URL('dev/app/',base);
  url.search=new URLSearchParams({sim:`protocol-${qb}-${Date.now()}-${Math.random().toString(16).slice(2)}`,qb,count:'64',scenario:'mixed',seed}).toString();
  await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
  await page.locator('#login-btn').click();
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),qb,{timeout:60000});
}

async function api(page,path,{method='GET',form}={}){
  return page.evaluate(async({path,method,form})=>{
    const init={method,cache:'no-store'};
    if(form){
      const body=new URLSearchParams();
      for(const [key,value] of Object.entries(form))body.set(key,String(value));
      init.headers={'content-type':'application/x-www-form-urlencoded'};
      init.body=body.toString();
    }
    const response=await fetch(`api/v2/${path}`,init);
    const text=await response.text();
    let json=null;try{json=text?JSON.parse(text):null;}catch{}
    return{status:response.status,text:text.trim(),json};
  },{path,method,form});
}

await waitForDeployedSha();
const browser=await launchBrowser();
try{
  {
    const context=await browser.newContext({locale:'zh-CN'});
    const page=await context.newPage();
    await openSession(page,'5.2.3','pages-live-protocol-523');

    let response=await api(page,'torrents/info?sort=definitely_not_a_qb_field');
    assert.equal(response.status,400,'deployed qB5 torrents/info must reject invalid sort keys with BadParams');
    assert.match(response.text,/sort.*invalid/i);

    response=await api(page,'torrents/info?limit=20');
    assert.equal(response.status,200);assert.ok(Array.isArray(response.json));
    const candidate=response.json.find(row=>row.state!=='metaDL');
    assert.ok(candidate?.hash,'qB5.2 live protocol fixture must contain a metadata-ready torrent');
    response=await api(page,`torrents/info?hashes=${candidate.hash}&includeTrackers=true&includeFiles=true`);
    assert.equal(response.status,200);assert.equal(response.json.length,1);
    assert.ok(Array.isArray(response.json[0].trackers),'qB5.2 includeTrackers must project tracker data in deployed Service Worker');
    assert.ok(Array.isArray(response.json[0].files),'qB5.2 includeFiles must project file data in deployed Service Worker');

    response=await api(page,'app/setPreferences',{method:'POST',form:{json:JSON.stringify({alt_dl_limit:32,alt_up_limit:16})}});
    assert.equal(response.status,200,'live protocol gate must configure tiny alternate limits');
    const normal=await api(page,'transfer/info');
    assert.equal(normal.status,200);
    response=await api(page,'transfer/toggleSpeedLimitsMode',{method:'POST',form:{}});
    assert.equal(response.status,200,'legacy toggleSpeedLimitsMode must remain available');
    const alternate=await api(page,'transfer/info');
    assert.equal(alternate.status,200);
    assert.ok(Number(alternate.json?.dl_info_speed)<=32*1024,`deployed alternate download cap leaked: ${alternate.json?.dl_info_speed}`);
    assert.ok(Number(alternate.json?.up_info_speed)<=16*1024,`deployed alternate upload cap leaked: ${alternate.json?.up_info_speed}`);
    response=await api(page,'transfer/toggleSpeedLimitsMode',{method:'POST',form:{}});
    assert.equal(response.status,200);

    await context.close();
  }

  {
    const context=await browser.newContext({locale:'zh-CN'});
    const page=await context.newPage();
    await openSession(page,'5.1.4','pages-live-protocol-514');
    let response=await api(page,'torrents/info?limit=20');
    assert.equal(response.status,200);
    const candidate=response.json.find(row=>row.state!=='metaDL');
    assert.ok(candidate?.hash,'qB5.1 live protocol fixture must contain a metadata-ready torrent');
    response=await api(page,`torrents/info?hashes=${candidate.hash}&includeTrackers=true&includeFiles=true`);
    assert.equal(response.status,200);assert.equal(response.json.length,1);
    assert.ok(Array.isArray(response.json[0].trackers),'qB5.1 must support includeTrackers');
    assert.equal(Object.prototype.hasOwnProperty.call(response.json[0],'files'),false,'qB5.1 must not expose the later qB5.2 includeFiles projection');
    await context.close();
  }
}finally{
  await browser.close();
}

console.log(`Virtual qB Pages protocol acceptance passed for ${expectedSha}: invalid sort BadParams, qB5.1/5.2 inline projections, and immediate alternate-rate enforcement are live.`);

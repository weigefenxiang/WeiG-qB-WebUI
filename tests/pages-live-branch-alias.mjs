import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function waitForDeployedSha(){
  let last='not fetched';
  for(let attempt=0;attempt<40;attempt++){
    try{
      const url=new URL('metadata/site.json',base);
      url.searchParams.set('__live_sha',expectedSha);
      const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
      const site=response.ok?await response.json():null;
      last=site?.simulatorSha||`HTTP ${response.status}`;
      if(last===expectedSha)return site;
    }catch(error){last=error?.message||String(error);}
    await sleep(1500);
  }
  throw new Error(`Pages did not expose simulator SHA ${expectedSha}; last observation: ${last}`);
}

await waitForDeployedSha();
const browser=await launchBrowser();
try{
  const context=await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error?.stack||error?.message||String(error)));
  page.on('console',message=>{
    if(message.type()!=='error')return;
    const text=message.text();
    const source=String(message.location()?.url||'');
    if(/favicon(?:\.ico)?|Wei\.G\.ico/i.test(`${source} ${text}`))return;
    errors.push(source?`${text} (${source})`:text);
  });

  const entry=new URL('dev/',base);
  const params=new URLSearchParams({
    sim:`pages-branch-root-${Date.now()}`,
    qb:'5.2.3',
    count:'80',
    scenario:'mixed',
    seed:'branch-root-alias'
  });
  entry.search=params.toString();
  entry.hash='#branch-root';

  await page.goto(entry.toString(),{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForURL(url=>url.pathname.endsWith('/dev/app/')&&url.hash==='#branch-root',{timeout:60000});
  const landed=new URL(page.url());
  for(const [key,value] of params)assert.equal(landed.searchParams.get(key),value,`/dev/ must preserve ${key}`);
  assert.equal(landed.hash,'#branch-root','/dev/ must preserve hash');

  await page.waitForSelector('#login-form',{state:'visible',timeout:60000});
  assert.equal(await page.locator('#username').inputValue(),'weigshare','/dev/ must land in the Lab-enabled dev app');
  assert.equal(await page.locator('#password').inputValue(),'weigshare','/dev/ must retain the Lab credential preset');
  await page.locator('#login-btn').click();
  await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});
  await page.waitForFunction(()=>String(document.querySelector('#qb-version')?.textContent||'').includes('5.2.3'),null,{timeout:60000});

  const buildUrl=new URL('virtual-qb-build.json',landed);
  buildUrl.search='';
  buildUrl.hash='';
  const buildResponse=await fetch(buildUrl,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});
  assert.equal(buildResponse.status,200,`/dev/ landed app build metadata must be published at ${buildUrl}`);
  const build=await buildResponse.json();
  assert.equal(build.branch,'dev','/dev/ must resolve to the dev app snapshot');
  assert.equal(build.exactSha,expectedSha,'/dev/ must resolve to the exact deployed dev SHA');
  assert.equal(build.simulatorSha,expectedSha,'/dev/ must use the exact deployed simulator SHA');
  assert.deepEqual(errors,[],`/dev/ branch-root alias produced browser errors: ${errors.join('\n')}`);

  await context.close();
  console.log(`Virtual qB Pages branch-root acceptance passed for ${expectedSha}: /dev/ preserves query/hash, reaches the exact dev app and renders without browser errors.`);
}finally{
  await browser.close();
}

import assert from 'node:assert/strict';
import {launchBrowser} from './browser-driver.mjs';

const rawBase=(process.env.WEIGG_PAGES_URL||process.argv[2]||'').trim();
const expectedSha=(process.env.WEIGG_EXPECTED_SIMULATOR_SHA||process.argv[3]||'').trim();
assert.ok(rawBase,'WEIGG_PAGES_URL or argv[2] is required');
assert.ok(expectedSha,'WEIGG_EXPECTED_SIMULATOR_SHA or argv[3] is required');
const base=new URL(rawBase.endsWith('/')?rawBase:`${rawBase}/`);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchJson(relative){const url=new URL(String(relative).replace(/^\/+/,''),base);url.searchParams.set('__live_sha',expectedSha);const response=await fetch(url,{headers:{'cache-control':'no-cache','pragma':'no-cache'}});if(!response.ok)throw new Error(`${url} returned HTTP ${response.status}`);return response.json();}
async function waitForDeployedSha(){let last='not fetched';for(let attempt=1;attempt<=40;attempt++){try{const site=await fetchJson('metadata/site.json');last=site?.simulatorSha||'missing simulatorSha';if(last===expectedSha)return site;}catch(error){last=error?.message||String(error);}await sleep(1500);}throw new Error(`Pages did not expose simulator SHA ${expectedSha}; last observation: ${last}`);}
function canonicalFilters(profile){const out=[];for(const raw of profile?.torrentFilters||[]){const value=raw==='paused'?'stopped':raw==='resumed'?'running':raw;if(value&&!out.includes(value))out.push(value);}return out;}
function exactExpectedFilters(profile){const out=canonicalFilters(profile);if((profile?.torrentInfoParameters||[]).includes('private'))out.push('private');return out;}
async function openSession(page,qb){const sim=`pages-release-profile-${qb}-${Date.now()}-${Math.random().toString(16).slice(2)}`;const url=new URL('dev/app/',base);url.search=new URLSearchParams({sim,qb,count:'40',scenario:'mixed',seed:`release-profile-${qb}`,clean:'0'}).toString();await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('#login-form',{state:'visible',timeout:60000});await page.locator('#login-btn').click();await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});await page.waitForFunction(version=>window.WeiG?.ReleaseProfile?.current()?.qbVersion===version,qb,{timeout:60000});await page.waitForFunction(()=>window.WeiG?.CapabilityRegistry?.state('tags')?.feature&&window.WeiG?.TorrentFilterView,{timeout:60000});await page.waitForTimeout(120);}
async function inspect(page){return page.evaluate(()=>({profile:window.WeiG.ReleaseProfile.current(),filters:Array.from(document.querySelectorAll('#filter-nav [data-filter]')).filter(n=>!n.hidden&&getComputedStyle(n).display!=='none').map(n=>n.dataset.filter),tag:(()=>{const n=document.querySelector('[data-facet="tag"]');return n?!(n.hidden||getComputedStyle(n).display==='none'):false;})(),privateSupported:window.WeiG.CapabilityRegistry.supports('privateFilter'),tagsSupported:window.WeiG.CapabilityRegistry.supports('tags'),stalledSupported:window.WeiG.CapabilityRegistry.supports('stalledFilter'),certified:window.WeiG.ReleaseProfile.isCertified()}));}

await waitForDeployedSha();
const catalog=await fetchJson('metadata/qb-releases.json');
assert.ok(Array.isArray(catalog)&&catalog.length>=30,'published exact stable qB catalog is unexpectedly small');
assert.equal(catalog[0].qbVersion,'4.1.0','formal supported stable floor must be qB 4.1.0');
const v461=catalog.find(item=>item.qbVersion==='4.6.1');assert.ok(v461&&v461.webApiVersion==='2.9.3','published source catalog must preserve qB 4.6.1 -> WebAPI 2.9.3');
const latest=catalog.at(-1);assert.ok(latest?.qbVersion,'published catalog must have a latest stable release');

const browser=await launchBrowser();
let context=null;
try{
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',msg=>{if(msg.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(msg.text()))errors.push(msg.text());});

  await openSession(page,'4.1.0');
  let state=await inspect(page);assert.equal(state.certified,true,'qB 4.1.0 must bind an exact certified source profile');assert.deepEqual(state.filters,exactExpectedFilters(catalog[0]),`qB 4.1.0 rendered filters must equal its exact source profile: ${JSON.stringify(state)}`);assert.equal(state.tag,false,'qB 4.1.0 unsupported Tags facet must be hidden');assert.equal(state.tagsSupported,false,'qB 4.1.0 must not claim Tags support');assert.equal(state.privateSupported,false,'qB 4.1.0 must not claim Private filter support');assert.equal(state.stalledSupported,(catalog[0].torrentFilters||[]).includes('stalled'),'qB 4.1.0 Stalled truth must be source-derived');

  await page.evaluate(()=>window.WeiG.Router.go('settings'));await page.waitForSelector('#settings-view.is-active',{timeout:30000});
  for(const tab of ['downloads','connection','speed','bittorrent','webui','advanced']){const button=page.locator(`#settings-tabs [data-settings-tab="${tab}"]`);await button.click();await page.waitForFunction(name=>document.querySelector('#settings-content')?.dataset.settingsRenderer==='canonical'&&document.querySelector(`#settings-tabs [data-settings-tab="${name}"]`)?.classList.contains('is-active'),tab);}

  await openSession(page,latest.qbVersion);state=await inspect(page);assert.equal(state.certified,true,'latest stable must bind an exact certified profile');assert.deepEqual(state.filters,exactExpectedFilters(latest),`latest stable rendered filters must equal exact source profile: ${JSON.stringify(state.filters)}`);const expectedTags=(latest.apiActions||[]).includes('torrentscontroller.h:tagsAction');const expectedPrivate=(latest.torrentInfoParameters||[]).includes('private');const expectedStalled=(latest.torrentFilters||[]).includes('stalled');assert.equal(state.tagsSupported,expectedTags,'latest Tags capability must equal exact upstream action surface');assert.equal(state.tag,expectedTags,'latest Tags facet visibility must equal exact upstream action surface');assert.equal(state.privateSupported,expectedPrivate,'latest Private capability must equal exact torrents/info parameter surface');assert.equal(state.stalledSupported,expectedStalled,'latest Stalled capability must equal exact Torrent filter surface');
  assert.equal(errors.length,0,`Pages release-profile browser errors: ${errors.join(' | ')}`);
  console.log(`Pages release-profile gate passed: exact qB 4.1.0 floor + ${latest.qbVersion} latest stable, source-derived Torrent filter/capability visibility, six canonical Settings surfaces, and qB 4.6.1/WebAPI 2.9.3 catalog fact.`);
}finally{if(context)await context.close();await browser.close();}

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
function canonicalFilter(raw){return raw==='paused'?'stopped':raw==='resumed'?'running':raw;}
function canonicalFilters(profile){const out=[];for(const raw of profile?.torrentFilters||[]){const value=canonicalFilter(raw);if(value&&!out.includes(value))out.push(value);}return out;}
const derivedOrder=['downloading','seeding','completed','stopped','running','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored'];
const derivedRequirements={
  downloading:{fields:['state','progress'],states:['downloading','stalledDL','forcedDL','metaDL','queuedDL']},
  seeding:{fields:['state'],states:['uploading','stalledUP','forcedUP','queuedUP']},
  completed:{fields:['progress']},
  stopped:{fields:['state'],statePattern:/^(?:paused|stopped)(?:DL|UP)?$/i},
  running:{fields:['state'],statePattern:/^(?:paused|stopped)(?:DL|UP)?$/i},
  active:{fields:['dlspeed','upspeed']},
  inactive:{fields:['dlspeed','upspeed']},
  stalled:{fields:['state'],states:['stalledDL','stalledUP']},
  stalled_uploading:{fields:['state'],states:['stalledUP']},
  stalled_downloading:{fields:['state'],states:['stalledDL']},
  checking:{fields:['state'],statePattern:/^checking/i},
  moving:{fields:['state'],states:['moving']},
  errored:{fields:['state'],states:['error','missingFiles']}
};
function canDeriveFilter(profile,filter){const req=derivedRequirements[canonicalFilter(filter)];if(!req)return false;const fields=profile?.torrentInfoFields||[];if(!(req.fields||[]).every(name=>fields.includes(name)))return false;if(!req.states&&!req.statePattern)return true;const states=profile?.torrentStates||[];if(req.states?.some(name=>states.includes(name)))return true;if(req.statePattern&&states.some(name=>req.statePattern.test(String(name))))return true;return false;}
function expectedFilterMode(profile,filter){const value=canonicalFilter(filter);if(value==='private')return(profile?.torrentInfoFields||[]).includes('private')?'local':'unavailable';if(canonicalFilters(profile).includes(value))return'native';if(canDeriveFilter(profile,value))return'local';return'unavailable';}
function expectedRenderedFilters(profile){const out=canonicalFilters(profile);for(const name of derivedOrder)if(canDeriveFilter(profile,name)&&!out.includes(name))out.push(name);if((profile?.torrentInfoFields||[]).includes('private')&&!out.includes('private'))out.push('private');return out;}
function expectedModes(profile){return Object.fromEntries(expectedRenderedFilters(profile).map(name=>[name,expectedFilterMode(profile,name)]));}
async function openSession(page,qb){const sim=`pages-release-profile-${qb}-${Date.now()}-${Math.random().toString(16).slice(2)}`;const url=new URL('dev/app/',base);url.search=new URLSearchParams({sim,qb,count:'40',scenario:'mixed',seed:`release-profile-${qb}`,clean:'0'}).toString();await page.goto(url.toString(),{waitUntil:'domcontentloaded',timeout:60000});await page.waitForSelector('#login-form',{state:'visible',timeout:60000});await page.locator('#login-btn').click();await page.waitForSelector('#torrent-list',{state:'attached',timeout:60000});await page.waitForFunction(version=>window.WeiG?.ReleaseProfile?.current()?.qbVersion===version,qb,{timeout:60000});await page.waitForFunction(()=>window.WeiG?.CapabilityRegistry?.state('tags')?.feature&&window.WeiG?.CapabilityRegistry?.state('tagFacet')?.feature&&window.WeiG?.TorrentFilterView&&window.WeiG?.TorrentSemantics,{timeout:60000});await page.waitForTimeout(120);}
async function inspect(page){return page.evaluate(()=>{const filters=Array.from(document.querySelectorAll('#filter-nav [data-filter]')).filter(n=>!n.hidden&&getComputedStyle(n).display!=='none').map(n=>n.dataset.filter);return{profile:window.WeiG.ReleaseProfile.current(),filters,filterModes:Object.fromEntries(filters.map(name=>[name,window.WeiG.TorrentSemantics.filterMode(name)])),tag:(()=>{const n=document.querySelector('[data-facet="tag"]');return n?!(n.hidden||getComputedStyle(n).display==='none'):false;})(),tagFacetSupported:window.WeiG.CapabilityRegistry.supports('tagFacet'),privateSupported:window.WeiG.CapabilityRegistry.supports('privateFilter'),tagsSupported:window.WeiG.CapabilityRegistry.supports('tags'),stalledSupported:window.WeiG.CapabilityRegistry.supports('stalledFilter'),certified:window.WeiG.ReleaseProfile.isCertified()};});}

await waitForDeployedSha();
const catalog=await fetchJson('metadata/qb-releases.json');
assert.ok(Array.isArray(catalog)&&catalog.length>=30,'published exact stable qB catalog is unexpectedly small');
assert.equal(catalog[0].qbVersion,'4.1.0','formal supported stable floor must be qB 4.1.0');
const v461=catalog.find(item=>item.qbVersion==='4.6.1');assert.ok(v461&&v461.webApiVersion==='2.9.3','published source catalog must preserve qB 4.6.1 -> WebAPI 2.9.3');
const latest=catalog.at(-1);assert.ok(latest?.qbVersion,'published catalog must have a latest stable release');

const browser=await launchBrowser();
let context=null;
try{
  context=await browser.newContext({viewport:{width:1366,height:768},locale:'zh-CN'});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',msg=>{const text=msg.text();if(msg.type()==='error'&&!/favicon|Wei\.G\.ico/i.test(text)&&!/Failed to load resource:\s*the server responded with a status of 404/i.test(text))errors.push(text);});

  await openSession(page,'4.1.0');
  let state=await inspect(page);const floor=catalog[0],floorTagFacet=(floor.torrentInfoFields||[]).includes('tags'),floorTagsAction=(floor.apiActions||[]).includes('torrentscontroller.h:tagsAction');assert.equal(state.certified,true,'qB 4.1.0 must bind an exact certified source profile');assert.deepEqual(state.filters,expectedRenderedFilters(floor),`qB 4.1.0 rendered filters must equal native + locally derivable source truth: ${JSON.stringify(state)}`);assert.deepEqual(state.filterModes,expectedModes(floor),'qB 4.1.0 filter modes must distinguish native from locally derived filters');assert.equal(state.tagFacetSupported,floorTagFacet,'qB 4.1.0 Tags facet capability must equal exact torrents/info field provenance');assert.equal(state.tag,floorTagFacet,'qB 4.1.0 Tags facet visibility must equal exact torrents/info field provenance');assert.equal(state.tagsSupported,floorTagsAction,'qB 4.1.0 Tags mutation capability must equal exact upstream action surface');assert.equal(state.privateSupported,(floor.torrentInfoFields||[]).includes('private'),'qB 4.1.0 Private filter support must equal exact torrents/info field provenance');assert.equal(state.stalledSupported,(floor.torrentFilters||[]).includes('stalled'),'qB 4.1.0 native Stalled capability truth must remain source-derived');

  await page.evaluate(()=>window.WeiG.Router.go('settings'));await page.waitForSelector('#settings-view.is-active',{timeout:30000});
  for(const tab of ['downloads','connection','speed','bittorrent','webui','advanced']){const button=page.locator(`#settings-tabs [data-settings-tab="${tab}"]`);await button.click();await page.waitForFunction(name=>document.querySelector('#settings-content')?.dataset.settingsRenderer==='canonical'&&document.querySelector(`#settings-tabs [data-settings-tab="${name}"]`)?.classList.contains('is-active'),tab);}

  await openSession(page,latest.qbVersion);state=await inspect(page);assert.equal(state.certified,true,'latest stable must bind an exact certified profile');assert.deepEqual(state.filters,expectedRenderedFilters(latest),`latest stable rendered filters must equal native + locally derivable source truth: ${JSON.stringify(state.filters)}`);assert.deepEqual(state.filterModes,expectedModes(latest),'latest stable filter modes must distinguish native from locally derived filters');const expectedTagsAction=(latest.apiActions||[]).includes('torrentscontroller.h:tagsAction');const expectedTagFacet=(latest.torrentInfoFields||[]).includes('tags');const expectedPrivate=(latest.torrentInfoFields||[]).includes('private');const expectedStalled=(latest.torrentFilters||[]).includes('stalled');assert.equal(state.tagsSupported,expectedTagsAction,'latest Tags mutation capability must equal exact upstream action surface');assert.equal(state.tagFacetSupported,expectedTagFacet,'latest Tags facet capability must equal exact torrents/info field provenance');assert.equal(state.tag,expectedTagFacet,'latest Tags facet visibility must equal exact torrents/info field provenance');assert.equal(state.privateSupported,expectedPrivate,'latest Private capability must equal exact torrents/info field provenance');assert.equal(state.stalledSupported,expectedStalled,'latest native Stalled capability must equal exact Torrent filter surface');
  assert.equal(errors.length,0,`Pages release-profile browser errors: ${errors.join(' | ')}`);
  console.log(`Pages release-profile gate passed: exact qB 4.1.0 floor + ${latest.qbVersion} latest stable, source-native + locally-derived Torrent filter visibility, exact facet/action capability ownership, six canonical Settings surfaces, and qB 4.6.1/WebAPI 2.9.3 catalog fact.`);
}finally{if(context)await context.close();await browser.close();}

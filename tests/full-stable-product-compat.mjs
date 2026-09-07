import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalogPath=path.resolve(process.argv[2]||'');
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-product-compat.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const capabilityData=JSON.parse(fs.readFileSync(path.join(root,'webui/private/data/capabilities.json'),'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'full-stable product matrix requires a non-empty generated release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','formal product matrix floor must be qB 4.1.0');
assert.ok(catalog.every(x=>x.stable===true&&x.officialWeiGSupport!==false),'formal product matrix accepts official supported stable profiles only');

const sources={};
for(const name of ['release-profile.js','settings-schema.js','capabilities.js','torrent-semantics.js','qb-client.js'])sources[name]=fs.readFileSync(path.join(root,'webui/private/scripts',name),'utf8');
class TestFormData{constructor(){this.entries=[];}append(name,value,filename){this.entries.push({name,value,filename});}}
const document={addEventListener(){},querySelectorAll(){return[];},createElement(){return{className:'',dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},querySelector(){return null;},querySelectorAll(){return[];},remove(){}};},body:{appendChild(){}}};
const W={buildAssetUrl:x=>x,t:key=>key,util:{parseScalar:value=>value,normalizeTracker:value=>String(value||''),form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
const window={WeiG:W,window:null,dispatchEvent(){},addEventListener(){},requestAnimationFrame:fn=>fn()};window.window=window;
const context={window,document,console,URL,URLSearchParams,FormData:TestFormData,Blob,CustomEvent:class{},requestAnimationFrame:fn=>fn(),fetch:async url=>{const value=String(url);if(value.includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};if(value.includes('capabilities.json'))return{ok:true,status:200,json:async()=>capabilityData};throw new Error(`Unexpected fetch ${value}`);}};
for(const name of ['release-profile.js','settings-schema.js','capabilities.js','torrent-semantics.js','qb-client.js'])vm.runInNewContext(sources[name],context,{filename:name});
const R=W.ReleaseProfile,C=W.CapabilityRegistry,T=W.TorrentSemantics,S=W.SettingsSchema,Client=W.QBClient;
assert.ok(R&&C&&T&&S&&Client,'formal product compatibility owners must load');

const currentColumnFields=['name','size','progress','dlspeed','upspeed','eta','state','ratio','tracker','category','tags','num_seeds','num_leechs','save_path','added_on','completion_on','priority'];
const baselineFilters=['all','downloading','seeding','completed','stopped','running','active','inactive','errored'];
const coreActions=['start','stop','delete','force','recheck','sequential','firstlast','autotmm','top','bottom','rename','location','category','dllimit','uplimit','addTrackers'];
const optionalActions=['reannounce','removeTrackers','editTracker','tags'];
const settingsSurfaces=new Set(['downloads','connection','speed','bittorrent','webui','advanced']);
const rows=[];
let searchSeen=false,rssSeen=false;

function actionFact(profile,kind){const desc=R.resolveTorrentActionDescriptor(kind);if(!desc)return null;assert.ok(desc.sourceAction,`${profile.qbVersion}: exact stable action ${kind} must retain sourceAction provenance`);assert.ok(profile.apiActions.includes(desc.sourceAction),`${profile.qbVersion}: ${kind} resolved to missing source action ${desc.sourceAction}`);const params=profile.apiActionParameters?.[desc.sourceAction];assert.ok(params,`${profile.qbVersion}: ${kind} lacks source-derived parameter descriptor`);assert.equal(desc.endpoint.length>0,true,`${profile.qbVersion}: ${kind} resolved empty endpoint`);return desc;}
function capture(client){const calls=[];client.request=async(reqPath,options={})=>{calls.push({path:reqPath,options});return null;};return calls;}
async function expectRejectedWithoutHttp(client,method,args,label){const calls=capture(client);let rejected=false;try{await client[method](...args);}catch{rejected=true;}assert.equal(rejected,true,`${label}: unsupported action must reject before HTTP`);assert.equal(calls.length,0,`${label}: unsupported action must not emit HTTP`);}

for(const profile of catalog){
  const client=new Client();client.qbVersion=profile.qbVersion;client.webApiVersion=profile.webApiVersion;
  await C.bind(client);
  assert.equal(R.current()?.qbVersion,profile.qbVersion,`${profile.qbVersion}: ReleaseProfile exact bind`);
  assert.equal(R.current()?.sourceSha,profile.sourceSha,`${profile.qbVersion}: ReleaseProfile source SHA drift`);
  assert.equal(R.isCertified(),true,`${profile.qbVersion}: official stable profile must certify`);

  const productFilters=T.statusFilters();
  for(const required of baselineFilters)assert.ok(productFilters.includes(required),`${profile.qbVersion}: baseline product filter ${required} unavailable`);
  assert.equal(productFilters.includes('paused')||productFilters.includes('resumed'),false,`${profile.qbVersion}: raw historical filter aliases leaked into product semantics`);
  let nativeFilters=0,derivedFilters=0;
  for(const filter of productFilters){const mode=T.filterMode(filter);assert.ok(mode==='native'||mode==='local',`${profile.qbVersion}: exposed filter ${filter} resolved ${mode}`);if(mode==='native')nativeFilters++;else{derivedFilters++;assert.equal(T.canDeriveFilter(filter),true,`${profile.qbVersion}: local filter ${filter} lacks source-proven derivation`);}}
  const privateExpected=profile.torrentInfoFields.includes('private');
  assert.equal(C.supports('privateFilter'),privateExpected,`${profile.qbVersion}: authoritative Private capability must follow exact Torrent field`);

  assert.equal(C.supports('categoryFacet'),profile.torrentInfoFields.includes('category'),`${profile.qbVersion}: Category facet must follow read field facts`);
  assert.equal(C.supports('tagFacet'),profile.torrentInfoFields.includes('tags'),`${profile.qbVersion}: Tags facet must follow read field facts`);
  assert.equal(C.supports('categories'),profile.apiActions.includes('torrentscontroller.h:categoriesAction'),`${profile.qbVersion}: native Categories taxonomy must follow source action`);
  assert.equal(C.supports('tags'),profile.apiActions.includes('torrentscontroller.h:tagsAction'),`${profile.qbVersion}: native Tags taxonomy must follow source action`);
  assert.ok(profile.torrentInfoFields.includes('tracker')&&profile.torrentInfoFields.includes('save_path'),`${profile.qbVersion}: Tracker/Path facets require bulk catalog fields`);

  for(const field of currentColumnFields)assert.ok(profile.torrentInfoFields.includes(field),`${profile.qbVersion}: current product column field missing: ${field}`);

  for(const kind of coreActions)assert.ok(actionFact(profile,kind),`${profile.qbVersion}: core Torrent action ${kind} unavailable`);
  for(const kind of optionalActions)actionFact(profile,kind);

  let calls=capture(client);await client.resume('abc');await client.pause('abc');
  assert.equal(calls[0]?.path,`torrents/${R.resolveTorrentAction('start')}`,`${profile.qbVersion}: QBClient start dispatch diverged from ReleaseProfile`);
  assert.equal(calls[1]?.path,`torrents/${R.resolveTorrentAction('stop')}`,`${profile.qbVersion}: QBClient stop dispatch diverged from ReleaseProfile`);
  if(R.supportsTorrentAction('reannounce')){calls=capture(client);await client.reannounce('abc');assert.equal(calls[0]?.path,'torrents/reannounce',`${profile.qbVersion}: Reannounce source action resolved wrong endpoint`);}else await expectRejectedWithoutHttp(client,'reannounce',['abc'],`${profile.qbVersion} Reannounce`);
  if(R.supportsTorrentAction('removeTrackers')){calls=capture(client);await client.removeTrackers('abc','https://tracker.invalid/announce');assert.equal(calls[0]?.path,'torrents/removeTrackers',`${profile.qbVersion}: Remove Tracker source action resolved wrong endpoint`);}else await expectRejectedWithoutHttp(client,'removeTrackers',['abc','https://tracker.invalid/announce'],`${profile.qbVersion} Remove Tracker`);

  S.bindProfile(R.current());
  assert.equal(profile.preferenceDescriptors.length,profile.preferenceKeys.length,`${profile.qbVersion}: Preference descriptor/key count mismatch`);
  let writableSettings=0;
  for(const descriptor of profile.preferenceDescriptors){const bound=S.descriptor(descriptor.key);assert.ok(bound&&bound.key===descriptor.key,`${profile.qbVersion}: SettingsSchema lost descriptor ${descriptor.key}`);const route=S.describe(descriptor.key);assert.ok(settingsSurfaces.has(route.surface)&&route.section,`${profile.qbVersion}: Preference ${descriptor.key} lacks safe Settings route`);if(descriptor.writable===true){writableSettings++;assert.equal(descriptor.setterPresent,true,`${profile.qbVersion}: writable ${descriptor.key} lacks setter`);assert.ok(descriptor.writeType,`${profile.qbVersion}: writable ${descriptor.key} lacks write type`);assert.notEqual(descriptor.typeAgreement,'MISMATCH',`${profile.qbVersion}: mismatched ${descriptor.key} must not remain writable`);}}

  const search=C.supports('search'),rss=C.supports('rss'),logs=C.supports('logs');
  assert.equal(logs,true,`${profile.qbVersion}: Logs must remain available from formal 4.1.0 support floor`);
  if(searchSeen)assert.equal(search,true,`${profile.qbVersion}: Search capability regressed after becoming available`);if(search)searchSeen=true;
  if(rssSeen)assert.equal(rss,true,`${profile.qbVersion}: RSS capability regressed after becoming available`);if(rss)rssSeen=true;

  rows.push({qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion,nativeFilters,derivedFilters,categoryFacet:C.supports('categoryFacet'),tagFacet:C.supports('tagFacet'),nativeCategories:C.supports('categories'),nativeTags:C.supports('tags'),privateFilter:C.supports('privateFilter'),actions:[...coreActions,...optionalActions].filter(x=>R.supportsTorrentAction(x)).length,settings:profile.preferenceDescriptors.length,writableSettings,search,rss,logs});
}

assert.equal(rows.length,catalog.length,'every generated stable profile must enter the formal product matrix');
assert.equal(rows[0].qbVersion,'4.1.0','formal product matrix minimum drifted');
const latest=rows.at(-1),derivedReleases=rows.filter(x=>x.derivedFilters>0).length,readOnlyTags=rows.filter(x=>x.tagFacet&&!x.nativeTags).length;
console.log(`Full stable PRODUCT compatibility matrix passed: ${rows.length} official stable releases ${rows[0].qbVersion} -> ${latest.qbVersion}; ${derivedReleases} releases use at least one reliable local filter derivation; ${readOnlyTags} releases expose Tags read/facet before native taxonomy; latest has ${latest.actions} resolved Torrent actions and ${latest.writableSettings}/${latest.settings} writable source-proven Preferences.`);

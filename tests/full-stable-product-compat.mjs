import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createCompactRuntime} from '../tools/qb-compact-runtime.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalogPath=path.resolve(process.argv[2]||path.join(root,'tests/fixtures/qb-release-catalog.lkg.json'));
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-product-compat.mjs [base-qb-releases.json]');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'full-stable product matrix requires a non-empty canonical base catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','formal product matrix floor must be qB 4.1.0');
assert.ok(catalog.every(x=>x.stable===true&&x.officialWeiGSupport!==false),'formal product matrix accepts official supported stable profiles only');
const {W}=createCompactRuntime(catalog,{owners:['settings-schema.js','capabilities.js','torrent-fields.js','torrent-semantics.js','qb-client.js']});
const F=W.TorrentFieldRegistry,C=W.CapabilityRegistry,T=W.TorrentSemantics,S=W.SettingsSchema,Client=W.QBClient;
assert.ok(F&&C&&T&&S&&Client,'formal compact product compatibility owners must load');

const currentColumnFields=['name','size','progress','dlspeed','upspeed','eta','state','ratio','tracker','category','tags','num_seeds','num_leechs','save_path','added_on','completion_on','priority'];
assert.deepEqual(Array.from(F.fields,x=>x.key),currentColumnFields,'runtime TorrentFieldRegistry must own the exact current 17-field product surface');
const baselineFilters=['all','downloading','seeding','completed','stopped','running','active','inactive','errored'];
const coreActions=['start','stop','delete','force','recheck','sequential','firstlast','autotmm','top','bottom','rename','location','category','dllimit','uplimit','addTrackers'];
const optionalActions=['reannounce','removeTrackers','editTracker','tags'];
const expectedSettingsSurfaces=['behavior','downloads','connection','speed','bittorrent','rss','webui','advanced'];
const settingsSurfaces=new Set(expectedSettingsSurfaces);
function settingsGraphKeys(graph){
  const keys=new Set();
  for(const field of graph?.fieldsets||[])for(const control of field?.legendControls||[])if(control?.preferenceKey)keys.add(String(control.preferenceKey));
  for(const row of graph?.rows||[])for(const item of row?.items||[])if(item?.preferenceKey)keys.add(String(item.preferenceKey));
  return keys;
}
const surfaceActions=new Map([
  ['search','searchcontroller.h:pluginsAction'],
  ['searchPlugins','searchcontroller.h:pluginsAction'],
  ['searchStart','searchcontroller.h:startAction'],
  ['searchStatus','searchcontroller.h:statusAction'],
  ['searchResults','searchcontroller.h:resultsAction'],
  ['searchStop','searchcontroller.h:stopAction'],
  ['rss','rsscontroller.h:itemsAction'],
  ['rssItems','rsscontroller.h:itemsAction'],
  ['rssAddFeed','rsscontroller.h:addFeedAction'],
  ['rssRemoveItem','rsscontroller.h:removeItemAction'],
  ['rssRules','rsscontroller.h:rulesAction'],
  ['rssSetRule','rsscontroller.h:setRuleAction'],
  ['rssRenameRule','rsscontroller.h:renameRuleAction'],
  ['rssRemoveRule','rsscontroller.h:removeRuleAction'],
  ['rssRefresh','rsscontroller.h:refreshItemAction'],
  ['logs','logcontroller.h:mainAction'],
  ['logsMain','logcontroller.h:mainAction'],
  ['logsPeers','logcontroller.h:peersAction'],
  ['settingsRead','appcontroller.h:preferencesAction'],
  ['settingsWrite','appcontroller.h:setPreferencesAction']
]);
const rows=[];

function actionFact(profile,kind){const desc=C.resolveTorrentActionDescriptor(kind);if(!desc)return null;assert.ok(desc.sourceAction,`${profile.qbVersion}: exact stable action ${kind} must retain sourceAction provenance`);assert.ok(profile.apiActions.includes(desc.sourceAction),`${profile.qbVersion}: ${kind} resolved to missing source action ${desc.sourceAction}`);const params=profile.apiActionParameters?.[desc.sourceAction];assert.ok(params,`${profile.qbVersion}: ${kind} lacks source-derived parameter descriptor`);assert.equal(desc.endpoint.length>0,true,`${profile.qbVersion}: ${kind} resolved empty endpoint`);return desc;}
function capture(client){const calls=[];client.request=async(reqPath,options={})=>{calls.push({path:reqPath,options});return null;};return calls;}
async function expectRejectedWithoutHttp(client,method,args,label){const calls=capture(client);let rejected=false;try{await client[method](...args);}catch{rejected=true;}assert.equal(rejected,true,`${label}: unsupported action must reject before HTTP`);assert.equal(calls.length,0,`${label}: unsupported action must not emit HTTP`);}

for(const profile of catalog){
  const client=new Client();client.qbVersion=profile.qbVersion;client.webApiVersion=profile.webApiVersion;
  await C.bind(client);
  await S.loadCompatibility();
  const release=C.releaseIdentity();
  assert.equal(release?.qbVersion,profile.qbVersion,`${profile.qbVersion}: CapabilityRegistry exact bind`);
  assert.equal(release?.sourceSha,profile.sourceSha,`${profile.qbVersion}: CapabilityRegistry source SHA drift`);
  assert.equal(C.isCertified(),true,`${profile.qbVersion}: official stable profile must certify`);

  const productFilters=T.statusFilters();
  for(const required of baselineFilters)assert.ok(productFilters.includes(required),`${profile.qbVersion}: baseline product filter ${required} unavailable`);
  assert.equal(productFilters.includes('paused')||productFilters.includes('resumed'),false,`${profile.qbVersion}: raw historical filter aliases leaked into product semantics`);
  let nativeFilters=0,derivedFilters=0;
  for(const filter of productFilters){const mode=T.filterMode(filter);assert.ok(mode==='native'||mode==='local',`${profile.qbVersion}: exposed filter ${filter} resolved ${mode}`);if(mode==='native')nativeFilters++;else{derivedFilters++;assert.equal(T.canDeriveFilter(filter),true,`${profile.qbVersion}: local filter ${filter} lacks source-proven derivation`);}}
  const privateExpected=profile.torrentInfoFields.includes('private');
  assert.equal(C.supports('privateFilter'),privateExpected,`${profile.qbVersion}: authoritative Private capability must follow exact Torrent field`);

  assert.equal(C.supports('categoryFacet'),profile.torrentInfoFields.includes('category'),`${profile.qbVersion}: Category facet must follow read field facts`);
  assert.equal(C.supports('tagFacet'),profile.torrentInfoFields.includes('tags'),`${profile.qbVersion}: Tags facet must follow read field facts`);
  const categoriesExpected=profile.apiActions.includes('torrentscontroller.h:categoriesAction')||profile.apiActions.includes('synccontroller.h:maindataAction');
  assert.equal(C.supports('categories'),categoriesExpected,`${profile.qbVersion}: Categories taxonomy must follow a source-proven read action`);
  assert.equal(C.supports('tags'),profile.apiActions.includes('torrentscontroller.h:tagsAction'),`${profile.qbVersion}: native Tags taxonomy must follow source action`);
  assert.ok(profile.torrentInfoFields.includes('tracker')&&profile.torrentInfoFields.includes('save_path'),`${profile.qbVersion}: Tracker/Path facets require bulk catalog fields`);

  for(const [id,sourceAction] of surfaceActions){
    assert.equal(C.supports(id),profile.apiActions.includes(sourceAction),`${profile.qbVersion}: ${id} must follow exact source action ${sourceAction}`);
  }

  for(const field of currentColumnFields){
    assert.ok(profile.torrentInfoFields.includes(field),`${profile.qbVersion}: source fact for current product field missing: ${field}`);
    const fact=F.provenance(field,profile);
    assert.equal(fact.mode,'NATIVE',`${profile.qbVersion}: runtime field ${field} must resolve NATIVE, got ${fact.mode}`);
    assert.equal(fact.sourceField,field,`${profile.qbVersion}: runtime field ${field} source provenance drift`);
    assert.equal(F.isAvailable(field,profile),true,`${profile.qbVersion}: runtime field ${field} must be effective`);
  }

  for(const kind of coreActions)assert.ok(actionFact(profile,kind),`${profile.qbVersion}: core Torrent action ${kind} unavailable`);
  for(const kind of optionalActions)actionFact(profile,kind);

  let calls=capture(client);await client.resume('abc');await client.pause('abc');
  assert.equal(calls[0]?.path,`torrents/${C.resolveTorrentActionDescriptor('start').endpoint}`,`${profile.qbVersion}: QBClient start dispatch diverged from CapabilityRegistry`);
  assert.equal(calls[1]?.path,`torrents/${C.resolveTorrentActionDescriptor('stop').endpoint}`,`${profile.qbVersion}: QBClient stop dispatch diverged from CapabilityRegistry`);
  if(C.supportsTorrentAction('reannounce')){calls=capture(client);await client.reannounce('abc');assert.equal(calls[0]?.path,'torrents/reannounce',`${profile.qbVersion}: Reannounce source action resolved wrong endpoint`);}else await expectRejectedWithoutHttp(client,'reannounce',['abc'],`${profile.qbVersion} Reannounce`);
  if(C.supportsTorrentAction('removeTrackers')){calls=capture(client);await client.removeTrackers('abc','https://tracker.invalid/announce');assert.equal(calls[0]?.path,'torrents/removeTrackers',`${profile.qbVersion}: Remove Tracker source action resolved wrong endpoint`);}else await expectRejectedWithoutHttp(client,'removeTrackers',['abc','https://tracker.invalid/announce'],`${profile.qbVersion} Remove Tracker`);

  const nativeSettingsSurfaces=S.nativeSurfaces();
  assert.deepEqual(nativeSettingsSurfaces,expectedSettingsSurfaces,`${profile.qbVersion}: formal product matrix must execute the exact eight source-native Settings surfaces`);
  const mappedSettings=new Set();
  for(const surface of nativeSettingsSurfaces){
    const graph=S.controlGraph(surface);
    assert.ok(graph,`${profile.qbVersion}: Settings surface ${surface} lacks source-native Control Graph`);
    for(const key of settingsGraphKeys(graph))mappedSettings.add(key);
  }
  assert.ok(mappedSettings.size>0,`${profile.qbVersion}: source-native Settings graph exposes no preference controls`);
  const descriptorByKey=new Map(profile.preferenceDescriptors.map(item=>[String(item.key),item]));
  assert.equal(profile.preferenceDescriptors.length,profile.preferenceKeys.length,`${profile.qbVersion}: Preference descriptor/key count mismatch`);
  let writableSettings=0;
  for(const key of mappedSettings){
    const source=descriptorByKey.get(key);
    assert.ok(source,`${profile.qbVersion}: Settings graph preference ${key} escaped the exact source descriptor set`);
    const bound=S.sourcePreference(key);
    assert.ok(bound&&bound.key===key,`${profile.qbVersion}: SettingsSchema lost source-native preference ${key}`);
    assert.ok(settingsSurfaces.has(bound.tab)&&bound.sectionId,`${profile.qbVersion}: Preference ${key} lacks a source-native Settings route`);
    const proof=bound.descriptor;
    assert.ok(proof,`${profile.qbVersion}: Preference ${key} lacks source descriptor proof`);
    assert.equal(proof.getterPresent,source.getterPresent,`${profile.qbVersion}: ${key} getter provenance drift`);
    assert.equal(proof.setterPresent,source.setterPresent,`${profile.qbVersion}: ${key} setter provenance drift`);
    assert.equal(proof.readType,source.readType,`${profile.qbVersion}: ${key} read type drift`);
    assert.equal(proof.writeType,source.writeType,`${profile.qbVersion}: ${key} write type drift`);
    assert.equal(proof.typeAgreement,source.typeAgreement,`${profile.qbVersion}: ${key} type agreement drift`);
    assert.equal(proof.writable,source.writable,`${profile.qbVersion}: ${key} writable proof drift`);
    if(proof.writable===true){
      writableSettings++;
      assert.equal(proof.setterPresent,true,`${profile.qbVersion}: writable ${key} lacks setter`);
      assert.ok(proof.writeType,`${profile.qbVersion}: writable ${key} lacks write type`);
      assert.notEqual(proof.typeAgreement,'MISMATCH',`${profile.qbVersion}: mismatched ${key} must not remain writable`);
    }
  }

  const search=C.supports('search'),rss=C.supports('rss'),logs=C.supports('logs');
  assert.equal(search,profile.apiActions.includes('searchcontroller.h:pluginsAction'),`${profile.qbVersion}: Search top-level availability must be exact-source`);
  assert.equal(rss,profile.apiActions.includes('rsscontroller.h:itemsAction'),`${profile.qbVersion}: RSS top-level availability must be exact-source`);
  assert.equal(logs,profile.apiActions.includes('logcontroller.h:mainAction'),`${profile.qbVersion}: Logs top-level availability must be exact-source`);

  rows.push({qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion,nativeFilters,derivedFilters,categoryFacet:C.supports('categoryFacet'),tagFacet:C.supports('tagFacet'),nativeCategories:C.supports('categories'),nativeTags:C.supports('tags'),privateFilter:C.supports('privateFilter'),actions:[...coreActions,...optionalActions].filter(x=>C.supportsTorrentAction(x)).length,settings:mappedSettings.size,writableSettings,search,rss,logs});
}

assert.equal(rows.length,catalog.length,'every generated stable profile must enter the formal product matrix');
assert.equal(rows[0].qbVersion,'4.1.0','formal product matrix minimum drifted');
const latest=rows.at(-1),derivedReleases=rows.filter(x=>x.derivedFilters>0).length,readOnlyTags=rows.filter(x=>x.tagFacet&&!x.nativeTags).length;
console.log(`Full stable PRODUCT compatibility matrix passed: ${rows.length} official stable releases ${rows[0].qbVersion} -> ${latest.qbVersion}; all ${currentColumnFields.length} current Torrent fields resolve NATIVE through TorrentFieldRegistry; ${surfaceActions.size} Settings/Search/RSS/Logs action capabilities follow exact source provenance; ${derivedReleases} releases use at least one reliable local filter derivation; ${readOnlyTags} releases expose Tags read/facet before native taxonomy; latest has ${latest.actions} resolved Torrent actions and ${latest.writableSettings}/${latest.settings} writable source-proven Preferences.`);
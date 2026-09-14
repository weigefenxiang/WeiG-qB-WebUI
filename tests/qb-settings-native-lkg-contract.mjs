import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyQbSettingsTranslationLkg,buildQbSettingsTranslationLkg} from '../tools/qb-settings-translation-lkg.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const catalogText=fs.readFileSync(path.join(here,'fixtures/qb-release-catalog.lkg.json'),'utf8').replace(/\r\n/g,'\n');
const localeEvidence=JSON.parse(fs.readFileSync(path.join(here,'../tools/data/qb-locale-lkg.json'),'utf8'));
const behaviorEvidence=JSON.parse(fs.readFileSync(path.join(here,'../tools/data/qb-translator-behavior-lkg.json'),'utf8'));
const catalogSha256=crypto.createHash('sha256').update(catalogText,'utf8').digest('hex');

assert.equal(localeEvidence.schemaVersion,1);
assert.equal(behaviorEvidence.schemaVersion,1);
assert.equal(localeEvidence.baseCatalogSha256,catalogSha256,'frozen locale evidence must remain bound to the LF-canonical stable base catalog on every platform');
assert.equal(localeEvidence.profileCount,65,'locale evidence must cover all admitted stable releases');
assert.equal(behaviorEvidence.profileCount,65,'translator behavior evidence must cover all admitted stable releases');
assert.equal(localeEvidence.supportFloor,'4.1.0');
assert.equal(behaviorEvidence.supportFloor,'4.1.0');
assert.equal(localeEvidence.latestAdmittedStable,'5.2.3');
assert.equal(behaviorEvidence.latestAdmittedStable,'5.2.3');

const localeByVersion=new Map(localeEvidence.profiles.map(profile=>[String(profile.qbVersion),profile]));
let nativeCapableLocaleRoutes=0;
let mandatoryBridgeLocaleRoutes=0;
let altDisabledProfiles=0;
for(const profile of behaviorEvidence.profiles){
  const localeProfile=localeByVersion.get(String(profile.qbVersion));
  assert.ok(localeProfile,`${profile.qbVersion}: frozen locale profile missing`);
  assert.equal(String(localeProfile.sourceSha),String(profile.sourceSha),`${profile.qbVersion}: locale and translator evidence must bind the same exact source SHA`);
  const locales=localeEvidence.localeSets?.[localeProfile.localeSet];
  assert.ok(Array.isArray(locales)&&locales.length>0,`${profile.qbVersion}: exact WebUI locale set must be resolved`);
  assert.equal(new Set(locales).size,locales.length,`${profile.qbVersion}: locale set must not contain duplicates`);
  const family=behaviorEvidence.families?.[profile.family];
  assert.ok(family,`${profile.qbVersion}: translator family ${profile.family} is missing`);
  assert.equal(family.qbtTrParserExists,true,`${profile.qbVersion}: admitted Settings translation route requires QBT_TR parser evidence`);
  if(profile.family==='dedicated-alt-disabled'){
    altDisabledProfiles+=1;
    assert.equal(family.altWebuiTranslation,false,`${profile.qbVersion}: hard compatibility-hole family must stay non-native`);
    mandatoryBridgeLocaleRoutes+=locales.length;
  }else{
    assert.equal(family.altWebuiTranslation,true,`${profile.qbVersion}: native-capable family must retain Alternative WebUI translation evidence`);
    nativeCapableLocaleRoutes+=locales.length;
  }
}

assert.equal(localeByVersion.size,65,'locale evidence must not contain duplicate/missing stable versions');
assert.equal(altDisabledProfiles,11,'4.5.0 through 4.6.4 must remain the 11-release mandatory compatibility-bridge family');
for(const version of ['4.5.0','4.6.4'])assert.equal(behaviorEvidence.profiles.find(profile=>profile.qbVersion===version)?.family,'dedicated-alt-disabled',`${version}: hard Alternative WebUI translation hole boundary changed`);
for(const version of ['4.4.5','4.6.5','5.0.0','5.2.3'])assert.notEqual(behaviorEvidence.profiles.find(profile=>profile.qbVersion===version)?.family,'dedicated-alt-disabled',`${version}: native-capable boundary changed`);
assert.ok(nativeCapableLocaleRoutes>0&&mandatoryBridgeLocaleRoutes>0,'stable evidence must retain both native-capable and mandatory-bridge routes');

const artifactResolver=fs.readFileSync(path.join(here,'../tools/qb-settings-translation-artifact.mjs'),'utf8');
assert.ok(artifactResolver.includes('const ARTIFACT_PAGE_SIZE=100;')&&artifactResolver.includes('const ARTIFACT_MAX_PAGES=10;'),'Settings translation resolver must deep-scan enough artifact pages that large locale matrices cannot hide reusable LKG evidence');
assert.ok(artifactResolver.includes('&page=${page}')&&artifactResolver.includes('listArtifacts({maxPages:ARTIFACT_MAX_PAGES})'),'Settings translation resolver must paginate the initial reusable-evidence scan instead of trusting only the newest 100 artifacts');
assert.ok(artifactResolver.includes('const POLL_INTERVAL_MS=10000;')&&!artifactResolver.includes('sleep(30000)'),'Settings translation resolver must react to fresh evidence without a fixed 30-second polling penalty');
assert.ok((artifactResolver.match(/await tryBootstrapCatalog\(artifacts\)/g)||[]).length>=2,'Settings translation resolver must accept a newly merged source catalog while waiting instead of blocking on the later LKG upload job');
assert.ok(artifactResolver.includes('incompatibleArtifactIds')&&artifactResolver.includes('listArtifacts({maxPages:1})'),'Fast polling must stay API-bounded and avoid repeatedly downloading known-incompatible artifacts');
assert.ok(artifactResolver.includes('qb-releases.recovery.json')&&artifactResolver.includes('recoveryEvidence'),'bootstrap reuse must require the deterministic full-TS recovery sidecar instead of silently rebuilding a v1 LKG');
assert.ok(artifactResolver.includes('lkg?.schemaVersion!==2')&&artifactResolver.includes('torrentTableColumns')&&artifactResolver.includes('detailUiBindings')&&artifactResolver.includes('recoveryRoutes'),'certified artifact reuse must reject stale source evidence and require native columns, Torrent detail UI facts, and recovery coverage');

const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
const shaA='a'.repeat(40),shaB='b'.repeat(40);
const setEn={messages:[{context:'OptionsDialog',source:'Language:',comment:null,translation:'Language:',numerus:false}]};
const setDe={messages:[{context:'OptionsDialog',source:'Language:',comment:null,translation:'Sprache:',numerus:false}]};
const hEn=hash(setEn),hDe=hash(setDe);
const nativeColumn=(key,source,visible=true)=>({key,caption:source,defaultWidth:120,defaultVisible:visible,translation:{source,context:'TransferListModel'},dataProperties:[key]});
const ref=(source,context)=>({source,context});
const detailUi=()=>({
  tabs:{overview:ref('General','PropTabBar'),trackers:ref('Trackers','PropTabBar'),peers:ref('Peers','PropTabBar'),webseeds:ref('HTTP Sources','PropTabBar'),files:ref('Content','PropTabBar')},
  tabOrder:['overview','trackers','peers','webseeds','files'],
  propertyGroups:{transfer:ref('Transfer','PropertiesWidget')},
  propertyLabels:{eta:ref('ETA:','PropertiesWidget')},
  propertyLayout:[{key:'transfer',translation:ref('Transfer','PropertiesWidget'),fields:[{id:'eta',valueSource:'properties',dataProperties:['eta']}]}],
  tables:{
    files:[{key:'name',caption:'Name',defaultWidth:300,defaultVisible:true,translation:ref('Name','TrackerListWidget'),dataProperties:['name']}],
    trackers:[{key:'url',caption:'URL',defaultWidth:250,defaultVisible:true,translation:ref('URL','TrackerListWidget'),dataProperties:['url']}],
    peers:[{key:'ip',caption:'IP',defaultWidth:100,defaultVisible:true,translation:ref('IP','PeerListWidget'),dataProperties:['ip']}],
    webseeds:[{key:'url',caption:'URL',defaultWidth:500,defaultVisible:true,translation:ref('URL','HttpServer'),dataProperties:['url']}]
  }
});
const sourceProfile=(qbVersion,sourceSha,sets)=>({qbVersion,sourceSha,webuiLocales:[{value:'en'},{value:'de'}],settingsUiSource:'qb-upstream-preferences-ui',settingsUiMappedPreferences:1,settingsUiTotalPreferences:1,settingsUi:{locale:{controlId:'locale_select',title:{source:'Language:',context:'OptionsDialog'}}},qbOwnedUiSource:'qb-upstream-webui-source-context',qbOwnedUi:{'column.name':{source:'Name',context:'TransferListModel'}},settingsTranslations:{en:hEn,de:hDe},settingsTranslationSets:sets,torrentTableColumns:[nativeColumn('name','Name'),nativeColumn('size','Size',false)],torrentDetailUi:detailUi()});
const frozen=[{qbVersion:'4.1.0',sourceSha:shaA},{qbVersion:'5.2.3',sourceSha:shaB}];
const enriched=[sourceProfile('4.1.0',shaA,{[hEn]:setEn,[hDe]:setDe}),sourceProfile('5.2.3',shaB,{})];
const recoveryEvidence={schemaVersion:1,source:'qb-official-ts-full-recovery-votes',releases:[{qbVersion:'4.1.0',sourceSha:shaA,locale:'de',sourceLanguage:'de',translationSourceSha256:'1'.repeat(64)},{qbVersion:'5.2.3',sourceSha:shaB,locale:'de',sourceLanguage:'de',translationSourceSha256:'2'.repeat(64)}],locales:[{locale:'de',messages:[{context:'OptionsDialog',source:'Language:',candidates:[{translation:'Sprache:',numerus:false,count:2,latestQbVersion:'5.2.3'}]}]}]};
const lkg=buildQbSettingsTranslationLkg(enriched,frozen,{baseCatalogSha256:'f'.repeat(64),recoveryEvidence});
assert.equal(lkg.schemaVersion,2,'Settings/source LKG must stay on schema v2 while freezing additive source facts');
assert.equal(lkg.torrentColumnBindings,4,'LKG v2 must freeze every exact source-derived native Torrent column');
assert.equal(lkg.detailUiBindings,24,'LKG v2 must freeze every exact source-derived Torrent detail UI binding including General layout bindings');
assert.equal(lkg.recovery.routeCount,2,'LKG v2 must freeze exact release/locale recovery provenance');
assert.equal(lkg.recovery.localeCount,1);
assert.deepEqual(lkg.profiles[0].recoveryLocales,['de']);
assert.deepEqual(lkg.profiles[1].torrentTableColumns.map(item=>item.key),['name','size']);
assert.equal(lkg.profiles[1].torrentDetailUi.tabs.webseeds.source,'HTTP Sources');
assert.deepEqual(lkg.profiles[1].torrentDetailUi.tabOrder,['overview','trackers','peers','webseeds','files'],'LKG must preserve the source-proven Detail tab order');
assert.deepEqual(lkg.profiles[1].torrentDetailUi.propertyLayout[0].fields,[{id:'eta',valueSource:'properties',dataProperties:['eta']}],'LKG must preserve source-proven General group/order/API bindings');
assert.equal(lkg.profiles[1].torrentDetailUi.tables.files[0].defaultWidth,300,'LKG must preserve native detail column defaults when source provides them');
const materialized=applyQbSettingsTranslationLkg(frozen,lkg,{catalogSha256:'f'.repeat(64)});
assert.deepEqual(materialized[0].torrentTableColumns.map(item=>item.key),['name','size'],'Frozen materialization must restore exact native columns before runtime packaging');
assert.deepEqual(materialized[0].torrentDetailUi.tabOrder,['overview','trackers','peers','webseeds','files'],'Frozen materialization must restore exact source Detail tab order');
assert.equal(materialized[0].torrentDetailUi.tables.trackers[0].key,'url','Frozen materialization must restore exact Torrent detail UI facts before runtime packaging');
assert.deepEqual(materialized[0].torrentDetailUi.propertyLayout[0].fields,[{id:'eta',valueSource:'properties',dataProperties:['eta']}],'Frozen materialization must restore exact General layout facts before runtime packaging');
assert.throws(()=>applyQbSettingsTranslationLkg(frozen,{...lkg,schemaVersion:1}),/schemaVersion 2/,'stale v1 Settings LKG must fail closed');
const missingColumns=structuredClone(enriched);delete missingColumns[0].torrentTableColumns;
assert.throws(()=>buildQbSettingsTranslationLkg(missingColumns,frozen,{recoveryEvidence}),/native Torrent columns are missing/,'ephemeral source columns may not disappear before the LKG boundary');
const missingDetailUi=structuredClone(enriched);delete missingDetailUi[0].torrentDetailUi;
assert.throws(()=>buildQbSettingsTranslationLkg(missingDetailUi,frozen,{recoveryEvidence}),/Torrent detail UI is missing/,'ephemeral Torrent detail source facts may not disappear before the LKG boundary');
const missingTabOrder=structuredClone(enriched);delete missingTabOrder[0].torrentDetailUi.tabOrder;
assert.throws(()=>buildQbSettingsTranslationLkg(missingTabOrder,frozen,{recoveryEvidence}),/tab order is missing or incomplete/,'source-proven Detail tab order may not disappear before the LKG boundary');
const missingPropertyLayout=structuredClone(enriched);delete missingPropertyLayout[0].torrentDetailUi.propertyLayout;
assert.throws(()=>buildQbSettingsTranslationLkg(missingPropertyLayout,frozen,{recoveryEvidence}),/General property layout is missing/,'stale detail UI evidence without source-proven General structure may not cross the LKG boundary');
const duplicatePropertyLayout=structuredClone(enriched);duplicatePropertyLayout[0].torrentDetailUi.propertyLayout[0].fields.push(structuredClone(duplicatePropertyLayout[0].torrentDetailUi.propertyLayout[0].fields[0]));
assert.throws(()=>buildQbSettingsTranslationLkg(duplicatePropertyLayout,frozen,{recoveryEvidence}),/duplicate Torrent General field ownership/,'General field ownership drift must fail closed');
assert.throws(()=>buildQbSettingsTranslationLkg(enriched,frozen,{}),/requires deterministic full official-TS recovery evidence/,'LKG v2 cannot certify narrow Settings copy without full native recovery evidence');
const badSet=structuredClone(lkg);badSet.sets[hDe].messages[0].translation='Tampered';
assert.throws(()=>applyQbSettingsTranslationLkg(frozen,badSet),/payload hash mismatch/,'narrow official-TS sets stay hash-bound after freezing');
const badRecovery=structuredClone(lkg);badRecovery.recovery.union.locales.de[0].translation='Tampered';
assert.throws(()=>applyQbSettingsTranslationLkg(frozen,badRecovery),/recovery union hash mismatch/,'full recovery union stays hash-bound and build-only');
const badRoute=structuredClone(lkg);badRoute.recovery.routes[1].locale='fr';badRoute.profiles[1].recoveryLocales=['fr'];
assert.throws(()=>applyQbSettingsTranslationLkg(frozen,badRoute),/frozen recovery route/,'tampered recovery routing must fail closed');
const badSource=structuredClone(frozen);badSource[1].sourceSha='c'.repeat(40);
assert.throws(()=>applyQbSettingsTranslationLkg(badSource,lkg),/source SHA mismatch/,'LKG v2 remains exact-source-SHA bound');
const duplicateColumns=structuredClone(enriched);duplicateColumns[0].torrentTableColumns.push(structuredClone(duplicateColumns[0].torrentTableColumns[0]));
assert.throws(()=>buildQbSettingsTranslationLkg(duplicateColumns,frozen,{recoveryEvidence}),/duplicate native Torrent column key/,'native column key drift must fail closed');
const duplicateDetailColumns=structuredClone(enriched);duplicateDetailColumns[0].torrentDetailUi.tables.peers.push(structuredClone(duplicateDetailColumns[0].torrentDetailUi.tables.peers[0]));
assert.throws(()=>buildQbSettingsTranslationLkg(duplicateDetailColumns,frozen,{recoveryEvidence}),/duplicate column key/,'Torrent detail column key drift must fail closed');

console.log(`Native Settings stable routing evidence passed: 65 releases, ${nativeCapableLocaleRoutes} native-capable locale routes, ${mandatoryBridgeLocaleRoutes} mandatory exact-TS bridge routes, 11 Alternative WebUI gap releases; Settings/source LKG v2 freezes exact native columns, source-proven General layout, Torrent detail UI facts and deterministic full-TS recovery while resolver reuse remains bounded.`);

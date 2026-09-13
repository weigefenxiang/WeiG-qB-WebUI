#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {materializeQbNativeQmRecoveryUnion} from './qb-native-qm-recovery.mjs';

const LKG_SCHEMA_VERSION=2;
function assert(ok,message){if(!ok)throw new Error(message);}
function canonicalLfBytes(file){return Buffer.from(fs.readFileSync(file,'utf8').replace(/\r\n?/g,'\n'),'utf8');}
function clone(value){return JSON.parse(JSON.stringify(value));}
function profileKey(profile){return String(profile?.qbVersion||'').trim();}
function localeValues(profile){return [...new Set((profile?.webuiLocales||[]).map(item=>String(typeof item==='string'?item:item?.value||'').trim()).filter(Boolean))];}
function baseLanguage(value){return String(value||'').trim().replace('-', '_').split('_')[0].split('@')[0].toLowerCase();}
function stableJson(value){return JSON.stringify(value);}
function sha256Json(value){return crypto.createHash('sha256').update(stableJson(value),'utf8').digest('hex');}
function validateTranslationSet(hash,payload,label){
  assert(/^[0-9a-f]{64}$/.test(String(hash||'')),`${label}: Settings translation set hash is invalid.`);
  assert(payload&&Array.isArray(payload.messages),`${label}: Settings translation set ${hash} is invalid.`);
  assert(sha256Json(payload)===hash,`${label}: Settings translation set ${hash} payload hash mismatch.`);
}
function validateColumns(columns,qbVersion){
  assert(Array.isArray(columns)&&columns.length>0,`${qbVersion}: source-derived native Torrent columns are missing.`);
  const seen=new Set(),out=[];
  for(const column of columns){
    const key=String(column?.key||'').trim();
    assert(key,`${qbVersion}: native Torrent column key is empty.`);
    assert(!seen.has(key),`${qbVersion}: duplicate native Torrent column key ${key}.`);seen.add(key);
    assert(typeof column.caption==='string',`${qbVersion} ${key}: native Torrent column caption is invalid.`);
    assert(Number.isFinite(Number(column.defaultWidth)),`${qbVersion} ${key}: native Torrent column width is invalid.`);
    assert(typeof column.defaultVisible==='boolean',`${qbVersion} ${key}: native Torrent column visibility is invalid.`);
    assert(Array.isArray(column.dataProperties)&&column.dataProperties.length>0,`${qbVersion} ${key}: native Torrent column dataProperties are missing.`);
    if(column.translation){
      assert(String(column.translation.source||'')&&String(column.translation.context||''),`${qbVersion} ${key}: native Torrent column translation ref is invalid.`);
    }
    out.push(clone(column));
  }
  return out;
}
function validateRef(ref,label){assert(ref&&String(ref.source||'').trim()&&String(ref.context||'').trim(),`${label}: translation ref is invalid.`);return clone(ref);}
function validateDetailUi(value,qbVersion){
  assert(value&&typeof value==='object'&&!Array.isArray(value),`${qbVersion}: source-derived Torrent detail UI is missing.`);
  const tabs={};
  for(const key of ['overview','trackers','peers','webseeds','files'])tabs[key]=validateRef(value.tabs?.[key],`${qbVersion} detail tab ${key}`);
  const propertyGroups={};
  for(const [key,ref] of Object.entries(value.propertyGroups||{}))propertyGroups[key]=validateRef(ref,`${qbVersion} detail group ${key}`);
  const propertyLabels={};
  for(const [key,ref] of Object.entries(value.propertyLabels||{}))propertyLabels[key]=validateRef(ref,`${qbVersion} detail property ${key}`);
  assert(Object.keys(propertyLabels).length>0,`${qbVersion}: source-derived Torrent detail property labels are missing.`);
  const tables={};
  for(const surface of ['files','trackers','peers','webseeds']){
    const columns=value.tables?.[surface];
    assert(Array.isArray(columns)&&columns.length>0,`${qbVersion}: source-derived Torrent detail ${surface} columns are missing.`);
    const seen=new Set();
    tables[surface]=columns.map(column=>{
      const key=String(column?.key||'').trim();
      assert(key,`${qbVersion} detail ${surface}: column key is empty.`);
      assert(!seen.has(key),`${qbVersion} detail ${surface}: duplicate column key ${key}.`);seen.add(key);
      assert(typeof column.caption==='string',`${qbVersion} detail ${surface} ${key}: caption is invalid.`);
      assert(Array.isArray(column.dataProperties)&&column.dataProperties.length>0,`${qbVersion} detail ${surface} ${key}: dataProperties are missing.`);
      if(column.translation)validateRef(column.translation,`${qbVersion} detail ${surface} ${key}`);
      return clone(column);
    });
  }
  return{tabs,propertyGroups,propertyLabels,tables};
}
function detailUiBindingCount(detailUi){return Object.keys(detailUi.tabs||{}).length+Object.keys(detailUi.propertyGroups||{}).length+Object.keys(detailUi.propertyLabels||{}).length+Object.values(detailUi.tables||{}).reduce((sum,columns)=>sum+(columns?.length||0),0);}
function freezeRecovery(enrichedCatalog,recoveryEvidence){
  assert(recoveryEvidence,'Settings/source LKG v2 requires deterministic full official-TS recovery evidence.');
  const union=materializeQbNativeQmRecoveryUnion(recoveryEvidence);
  assert(union?.schemaVersion===1&&union.source==='qb-official-ts-deterministic-recovery-union'&&union.locales&&typeof union.locales==='object','Settings/source LKG recovery union is invalid.');
  const byVersion=new Map(enrichedCatalog.map(profile=>[profileKey(profile),profile]));
  const routeIds=new Set(),routes=[];
  for(const route of recoveryEvidence.releases||[]){
    const qbVersion=String(route?.qbVersion||'').trim(),sourceSha=String(route?.sourceSha||'').trim(),locale=String(route?.locale||'').trim();
    const profile=byVersion.get(qbVersion);
    assert(profile&&String(profile.sourceSha||'')===sourceSha,`${qbVersion||'unknown'} ${locale||'unknown'}: recovery route escaped its exact source profile.`);
    assert(localeValues(profile).includes(locale),`${qbVersion} ${locale}: recovery route is not present in the exact source locale surface.`);
    const identity=`${qbVersion}\u0000${sourceSha}\u0000${locale}`;
    assert(!routeIds.has(identity),`${qbVersion} ${locale}: duplicate frozen recovery route.`);routeIds.add(identity);
    routes.push(clone(route));
  }
  for(const profile of enrichedCatalog){
    const qbVersion=profileKey(profile),sourceSha=String(profile?.sourceSha||'');
    for(const locale of localeValues(profile)){
      if(baseLanguage(locale)==='en')continue;
      assert(routeIds.has(`${qbVersion}\u0000${sourceSha}\u0000${locale}`),`${qbVersion} ${locale}: full official-TS recovery route is missing.`);
    }
  }
  const localeNames=Object.keys(union.locales);
  assert(routes.length>0&&localeNames.length>0,'Settings/source LKG recovery evidence is empty.');
  return{schemaVersion:1,source:'qb-official-ts-frozen-recovery',routeCount:routes.length,localeCount:localeNames.length,routes,union,unionSha256:sha256Json(union)};
}
function validateFrozenRecovery(recovery,profiles){
  assert(recovery&&recovery.schemaVersion===1&&recovery.source==='qb-official-ts-frozen-recovery','Settings/source LKG recovery block is missing or invalid.');
  assert(Array.isArray(recovery.routes)&&recovery.union&&typeof recovery.union==='object','Settings/source LKG recovery routes/union are missing.');
  assert(Number(recovery.routeCount)===recovery.routes.length&&Number(recovery.routeCount)>0,'Settings/source LKG recovery route count mismatch.');
  assert(Number(recovery.localeCount)===Object.keys(recovery.union.locales||{}).length&&Number(recovery.localeCount)>0,'Settings/source LKG recovery locale count mismatch.');
  assert(/^[0-9a-f]{64}$/.test(String(recovery.unionSha256||''))&&sha256Json(recovery.union)===recovery.unionSha256,'Settings/source LKG recovery union hash mismatch.');
  assert(recovery.union.schemaVersion===1&&recovery.union.source==='qb-official-ts-deterministic-recovery-union','Settings/source LKG recovery union identity is invalid.');
  const byVersion=new Map(profiles.map(profile=>[profileKey(profile),profile])),seen=new Set();
  for(const route of recovery.routes){
    const qbVersion=String(route?.qbVersion||''),sourceSha=String(route?.sourceSha||''),locale=String(route?.locale||'');
    const profile=byVersion.get(qbVersion);
    assert(profile&&String(profile.sourceSha||'')===sourceSha,`${qbVersion||'unknown'} ${locale||'unknown'}: frozen recovery route source SHA mismatch.`);
    assert(Array.isArray(profile.recoveryLocales)&&profile.recoveryLocales.includes(locale),`${qbVersion} ${locale}: frozen recovery route is not bound to the profile locale set.`);
    assert(Object.hasOwn(recovery.union.locales||{},locale),`${qbVersion} ${locale}: frozen recovery route locale is missing from the recovery union.`);
    const identity=`${qbVersion}\u0000${sourceSha}\u0000${locale}`;assert(!seen.has(identity),`${qbVersion} ${locale}: duplicate frozen recovery route.`);seen.add(identity);
  }
  for(const profile of profiles){for(const locale of profile.recoveryLocales||[])assert(seen.has(`${profile.qbVersion}\u0000${profile.sourceSha}\u0000${locale}`),`${profile.qbVersion} ${locale}: frozen recovery route is missing.`);}
  const routedLocales=new Set(recovery.routes.map(route=>String(route.locale||'')));
  for(const locale of Object.keys(recovery.union.locales||{}))assert(routedLocales.has(locale),`${locale}: recovery union locale has no frozen exact-release route.`);
}

export function buildQbSettingsTranslationLkg(enrichedCatalog,frozenCatalog,{baseCatalogSha256=null,sourceEvidence=null,recoveryEvidence=null}={}){
  assert(Array.isArray(enrichedCatalog)&&enrichedCatalog.length,'Settings/source LKG requires a non-empty source-enriched catalog.');
  assert(Array.isArray(frozenCatalog)&&frozenCatalog.length,'Settings/source LKG requires the admitted Frozen catalog.');
  assert(enrichedCatalog.length===frozenCatalog.length,`Settings/source profile count drift: ${enrichedCatalog.length} != ${frozenCatalog.length}`);

  const frozenByVersion=new Map(frozenCatalog.map((item)=>[profileKey(item),item]));
  assert(frozenByVersion.size===frozenCatalog.length,'Frozen catalog contains duplicate qB versions.');
  const sets={};
  const profiles=[];
  const seenProfiles=new Set();
  let mappedProfiles=0,mappedPreferences=0,translationRoutes=0,ownedUiBindings=0,torrentColumnBindings=0,detailUiBindings=0;

  for(const source of enrichedCatalog){
    const qbVersion=profileKey(source),sourceSha=String(source?.sourceSha||'').trim();
    assert(qbVersion&&sourceSha,'Every Settings/source profile must bind qbVersion + sourceSha.');
    assert(!seenProfiles.has(qbVersion),`${qbVersion}: duplicate Settings/source profile.`);seenProfiles.add(qbVersion);
    const frozen=frozenByVersion.get(qbVersion);
    assert(frozen,`${qbVersion}: release is not present in the admitted Frozen catalog.`);
    assert(String(frozen.sourceSha||'')===sourceSha,`${qbVersion}: Settings/source evidence source SHA drift.`);

    const preferences=clone(source.settingsUi||{}),ui=clone(source.qbOwnedUi||{}),translations=clone(source.settingsTranslations||{}),torrentTableColumns=validateColumns(source.torrentTableColumns,qbVersion),torrentDetailUi=validateDetailUi(source.torrentDetailUi,qbVersion);
    const mapped=Number(source.settingsUiMappedPreferences)||0,total=Number(source.settingsUiTotalPreferences)||0;
    assert(mapped===Object.keys(preferences).length,`${qbVersion}: mapped Settings preference count drift.`);
    assert(mapped<=total,`${qbVersion}: mapped Settings preference count exceeds source preference surface.`);
    assert(Object.keys(ui).length>0,`${qbVersion}: source-derived qB-owned UI copy is missing.`);
    if(mapped>0)mappedProfiles+=1;
    mappedPreferences+=mapped;ownedUiBindings+=Object.keys(ui).length;translationRoutes+=Object.keys(translations).length;torrentColumnBindings+=torrentTableColumns.length;detailUiBindings+=detailUiBindingCount(torrentDetailUi);

    for(const [hash,payload] of Object.entries(source.settingsTranslationSets||{})){
      validateTranslationSet(hash,payload,qbVersion);
      if(sets[hash])assert(stableJson(sets[hash])===stableJson(payload),`${qbVersion}: Settings translation set hash collision ${hash}.`);
      else sets[hash]=clone(payload);
    }
    profiles.push({qbVersion,sourceSha,source:String(source.settingsUiSource||''),ownedUiSource:String(source.qbOwnedUiSource||''),mappedPreferences:mapped,totalPreferences:total,preferences,ui,translations,torrentTableColumns,torrentDetailUi,recoveryLocales:[]});
  }

  assert(profiles.length===frozenByVersion.size&&seenProfiles.size===frozenByVersion.size,'Settings/source LKG must cover every admitted stable exactly once.');
  for(const profile of profiles)for(const hash of Object.values(profile.translations||{})){assert(sets[hash],`${profile.qbVersion}: referenced Settings translation set ${hash} is missing.`);validateTranslationSet(hash,sets[hash],profile.qbVersion);}
  assert(mappedProfiles>0&&mappedPreferences>0,'Settings/source LKG must contain source-mapped qB Settings copy.');
  assert(ownedUiBindings>0,'Settings/source LKG must contain source-derived qB-owned UI copy.');
  assert(torrentColumnBindings>0,'Settings/source LKG must contain source-derived native Torrent columns.');
  assert(detailUiBindings>0,'Settings/source LKG must contain source-derived Torrent detail UI facts.');
  assert(translationRoutes>0&&Object.keys(sets).length>0,'Settings/source LKG must contain official locale translation evidence.');
  const recovery=freezeRecovery(enrichedCatalog,recoveryEvidence);
  const recoveryLocalesByVersion=new Map();
  for(const route of recovery.routes){const list=recoveryLocalesByVersion.get(route.qbVersion)||[];if(!list.includes(route.locale))list.push(route.locale);recoveryLocalesByVersion.set(route.qbVersion,list);}
  for(const profile of profiles)profile.recoveryLocales=(recoveryLocalesByVersion.get(profile.qbVersion)||[]).sort();

  return{schemaVersion:LKG_SCHEMA_VERSION,source:'qb-upstream-preferences-ui+owned-ui+torrent-columns+detail-ui+official-ts-recovery',supportFloor:profileKey(frozenCatalog[0]),latestAdmittedStable:profileKey(frozenCatalog.at(-1)),profileCount:profiles.length,ownedUiBindings,torrentColumnBindings,detailUiBindings,...(baseCatalogSha256?{baseCatalogSha256}:{}),...(sourceEvidence?{sourceEvidence}:{}),profiles,sets,recovery};
}

export function applyQbSettingsTranslationLkg(catalog,lkg,{catalogSha256=''}={}){
  assert(Array.isArray(catalog)&&catalog.length,'Settings/source LKG requires a non-empty target catalog.');
  assert(lkg&&lkg.schemaVersion===LKG_SCHEMA_VERSION&&Array.isArray(lkg.profiles)&&lkg.sets&&typeof lkg.sets==='object',`Settings/source LKG must use schemaVersion ${LKG_SCHEMA_VERSION} with profiles and sets.`);
  assert(Number(lkg.profileCount)===catalog.length&&lkg.profiles.length===catalog.length,`Settings/source LKG profile count mismatch: ${lkg.profiles.length}/${lkg.profileCount} != ${catalog.length}`);
  assert(Number(lkg.ownedUiBindings)>0,'Settings/source LKG is stale: source-derived qB-owned UI bindings are missing.');
  assert(Number(lkg.torrentColumnBindings)>0,'Settings/source LKG is stale: native Torrent column bindings are missing.');
  assert(Number(lkg.detailUiBindings)>0,'Settings/source LKG is stale: Torrent detail UI bindings are missing.');
  assert(profileKey(catalog[0])===String(lkg.supportFloor||''),`Settings/source LKG support floor mismatch: ${lkg.supportFloor} != ${profileKey(catalog[0])}`);
  assert(profileKey(catalog.at(-1))===String(lkg.latestAdmittedStable||''),`Settings/source LKG latest stable mismatch: ${lkg.latestAdmittedStable} != ${profileKey(catalog.at(-1))}`);
  if(catalogSha256)assert(String(lkg.baseCatalogSha256||'')===catalogSha256,`Settings/source LKG base catalog SHA-256 mismatch: ${lkg.baseCatalogSha256||'missing'} != ${catalogSha256}`);

  const byVersion=new Map(lkg.profiles.map(profile=>[profileKey(profile),profile]));
  assert(byVersion.size===lkg.profiles.length,'Settings/source LKG contains duplicate qB versions.');
  validateFrozenRecovery(lkg.recovery,lkg.profiles);
  let appliedColumns=0,appliedDetailUi=0;
  const output=catalog.map(profile=>{
    const qbVersion=profileKey(profile),fact=byVersion.get(qbVersion);
    assert(fact,`${qbVersion}: Settings/source LKG profile missing.`);
    assert(String(fact.sourceSha||'')===String(profile.sourceSha||''),`${qbVersion}: Settings/source LKG source SHA mismatch.`);
    const preferences=clone(fact.preferences||{}),ui=clone(fact.ui||{}),translations=clone(fact.translations||{}),sets={},torrentTableColumns=validateColumns(fact.torrentTableColumns,qbVersion),torrentDetailUi=validateDetailUi(fact.torrentDetailUi,qbVersion);
    const mapped=Number(fact.mappedPreferences)||0,total=Number(fact.totalPreferences)||0;
    assert(mapped===Object.keys(preferences).length,`${qbVersion}: Settings/source LKG mapped preference count drift.`);
    assert(mapped<=total,`${qbVersion}: Settings/source LKG mapped preferences exceed source surface.`);
    assert(Object.keys(ui).length>0,`${qbVersion}: Settings/source LKG qB-owned UI bindings are missing.`);
    for(const hash of new Set(Object.values(translations))){assert(lkg.sets[hash],`${qbVersion}: Settings translation set ${hash} is missing from the LKG.`);validateTranslationSet(hash,lkg.sets[hash],qbVersion);sets[hash]=clone(lkg.sets[hash]);}
    appliedColumns+=torrentTableColumns.length;appliedDetailUi+=detailUiBindingCount(torrentDetailUi);
    return{...profile,torrentTableColumns,torrentDetailUi,settingsUiSource:String(fact.source||''),settingsUiMappedPreferences:mapped,settingsUiTotalPreferences:total,settingsUi:preferences,qbOwnedUiSource:String(fact.ownedUiSource||''),qbOwnedUi:ui,settingsTranslations:translations,settingsTranslationSets:sets};
  });
  assert(appliedColumns===Number(lkg.torrentColumnBindings),`Settings/source LKG native Torrent column count drift: ${appliedColumns} != ${lkg.torrentColumnBindings}`);
  assert(appliedDetailUi===Number(lkg.detailUiBindings),`Settings/source LKG Torrent detail UI count drift: ${appliedDetailUi} != ${lkg.detailUiBindings}`);
  return output;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const enrichedPath=path.resolve(process.argv[2]||'');
    const frozenPath=path.resolve(process.argv[3]||'');
    const outputPath=path.resolve(process.argv[4]||'');
    const defaultRecovery=enrichedPath?enrichedPath.replace(/\.json$/i,'.recovery.json'):'';
    const recoveryPath=path.resolve(process.argv[5]||defaultRecovery||'');
    if(!enrichedPath||!fs.existsSync(enrichedPath)||!frozenPath||!fs.existsSync(frozenPath)||!outputPath||!recoveryPath||!fs.existsSync(recoveryPath))throw new Error('Usage: node tools/qb-settings-translation-lkg.mjs <source-enriched-catalog.json> <frozen-catalog.json> <output.json> [recovery-evidence.json]');
    const enriched=JSON.parse(fs.readFileSync(enrichedPath,'utf8'));
    const frozen=JSON.parse(fs.readFileSync(frozenPath,'utf8'));
    const recoveryEvidence=JSON.parse(fs.readFileSync(recoveryPath,'utf8'));
    const baseCatalogSha256=crypto.createHash('sha256').update(canonicalLfBytes(frozenPath)).digest('hex');
    const sourceEvidence=process.env.GITHUB_SHA?{weiGCommit:process.env.GITHUB_SHA,...(process.env.GITHUB_RUN_ID?{ciRunId:Number(process.env.GITHUB_RUN_ID)}:{})}:null;
    const lkg=buildQbSettingsTranslationLkg(enriched,frozen,{baseCatalogSha256,sourceEvidence,recoveryEvidence});
    fs.mkdirSync(path.dirname(outputPath),{recursive:true});
    fs.writeFileSync(outputPath,JSON.stringify(lkg)+'\n','utf8');
    const mapped=lkg.profiles.reduce((sum,item)=>sum+item.mappedPreferences,0),routes=lkg.profiles.reduce((sum,item)=>sum+Object.keys(item.translations||{}).length,0);
    console.log(`Frozen qB Settings/source LKG v2: ${lkg.profileCount} releases, ${mapped} mapped preferences, ${lkg.ownedUiBindings} qB-owned UI bindings, ${lkg.torrentColumnBindings} native Torrent columns, ${lkg.detailUiBindings} Torrent detail UI bindings, ${routes} narrow locale routes, ${Object.keys(lkg.sets).length} deduplicated translation sets, ${lkg.recovery.routeCount} full-TS recovery routes / ${lkg.recovery.localeCount} locales.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

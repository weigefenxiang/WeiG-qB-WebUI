#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function assert(ok,message){if(!ok)throw new Error(message);}
function canonicalLfBytes(file){return Buffer.from(fs.readFileSync(file,'utf8').replace(/\r\n?/g,'\n'),'utf8');}
function clone(value){return JSON.parse(JSON.stringify(value));}
function profileKey(profile){return String(profile?.qbVersion||'').trim();}

export function buildQbSettingsTranslationLkg(enrichedCatalog,frozenCatalog,{baseCatalogSha256=null,sourceEvidence=null}={}){
  assert(Array.isArray(enrichedCatalog)&&enrichedCatalog.length,'Settings translation LKG requires a non-empty source-enriched catalog.');
  assert(Array.isArray(frozenCatalog)&&frozenCatalog.length,'Settings translation LKG requires the admitted Frozen catalog.');
  assert(enrichedCatalog.length===frozenCatalog.length,`Settings translation profile count drift: ${enrichedCatalog.length} != ${frozenCatalog.length}`);

  const frozenByVersion=new Map(frozenCatalog.map((item)=>[profileKey(item),item]));
  const sets={};
  const profiles=[];
  let mappedProfiles=0;
  let mappedPreferences=0;
  let translationRoutes=0;

  for(const source of enrichedCatalog){
    const qbVersion=profileKey(source),sourceSha=String(source?.sourceSha||'').trim();
    assert(qbVersion&&sourceSha,'Every Settings translation profile must bind qbVersion + sourceSha.');
    const frozen=frozenByVersion.get(qbVersion);
    assert(frozen,`${qbVersion}: release is not present in the admitted Frozen catalog.`);
    assert(String(frozen.sourceSha||'')===sourceSha,`${qbVersion}: Settings translation evidence source SHA drift.`);

    const preferences=clone(source.settingsUi||{});
    const translations=clone(source.settingsTranslations||{});
    const mapped=Number(source.settingsUiMappedPreferences)||0;
    const total=Number(source.settingsUiTotalPreferences)||0;
    assert(mapped===Object.keys(preferences).length,`${qbVersion}: mapped Settings preference count drift.`);
    assert(mapped<=total,`${qbVersion}: mapped Settings preference count exceeds source preference surface.`);
    if(mapped>0)mappedProfiles+=1;
    mappedPreferences+=mapped;
    translationRoutes+=Object.keys(translations).length;

    for(const [hash,payload] of Object.entries(source.settingsTranslationSets||{})){
      if(sets[hash])assert(JSON.stringify(sets[hash])===JSON.stringify(payload),`${qbVersion}: Settings translation set hash collision ${hash}.`);
      else sets[hash]=clone(payload);
    }
    profiles.push({qbVersion,sourceSha,source:String(source.settingsUiSource||''),mappedPreferences:mapped,totalPreferences:total,preferences,translations});
  }

  assert(profiles.length===frozenByVersion.size,'Settings translation LKG must cover every admitted stable exactly once.');
  for(const profile of profiles){
    for(const hash of Object.values(profile.translations||{}))assert(sets[hash],`${profile.qbVersion}: referenced Settings translation set ${hash} is missing.`);
  }
  assert(mappedProfiles>0&&mappedPreferences>0,'Settings translation LKG must contain source-mapped qB Settings copy.');
  assert(translationRoutes>0&&Object.keys(sets).length>0,'Settings translation LKG must contain official locale translation evidence.');

  return{
    schemaVersion:1,
    source:'qb-upstream-preferences-ui+official-ts',
    supportFloor:profileKey(frozenCatalog[0]),
    latestAdmittedStable:profileKey(frozenCatalog.at(-1)),
    profileCount:profiles.length,
    ...(baseCatalogSha256?{baseCatalogSha256}:{}),
    ...(sourceEvidence?{sourceEvidence}:{}),
    profiles,
    sets
  };
}

export function applyQbSettingsTranslationLkg(catalog,lkg,{catalogSha256=''}={}){
  assert(Array.isArray(catalog)&&catalog.length,'Settings translation LKG requires a non-empty target catalog.');
  assert(lkg&&lkg.schemaVersion===1&&Array.isArray(lkg.profiles)&&lkg.sets&&typeof lkg.sets==='object','Settings translation LKG must use schemaVersion 1 with profiles and sets.');
  assert(Number(lkg.profileCount)===catalog.length&&lkg.profiles.length===catalog.length,`Settings translation LKG profile count mismatch: ${lkg.profiles.length}/${lkg.profileCount} != ${catalog.length}`);
  assert(profileKey(catalog[0])===String(lkg.supportFloor||''),`Settings translation LKG support floor mismatch: ${lkg.supportFloor} != ${profileKey(catalog[0])}`);
  assert(profileKey(catalog.at(-1))===String(lkg.latestAdmittedStable||''),`Settings translation LKG latest stable mismatch: ${lkg.latestAdmittedStable} != ${profileKey(catalog.at(-1))}`);
  if(catalogSha256)assert(String(lkg.baseCatalogSha256||'')===catalogSha256,`Settings translation LKG base catalog SHA-256 mismatch: ${lkg.baseCatalogSha256||'missing'} != ${catalogSha256}`);

  const byVersion=new Map(lkg.profiles.map(profile=>[profileKey(profile),profile]));
  assert(byVersion.size===lkg.profiles.length,'Settings translation LKG contains duplicate qB versions.');
  return catalog.map(profile=>{
    const qbVersion=profileKey(profile),fact=byVersion.get(qbVersion);
    assert(fact,`${qbVersion}: Settings translation LKG profile missing.`);
    assert(String(fact.sourceSha||'')===String(profile.sourceSha||''),`${qbVersion}: Settings translation LKG source SHA mismatch.`);
    const preferences=clone(fact.preferences||{}),translations=clone(fact.translations||{}),sets={};
    const mapped=Number(fact.mappedPreferences)||0,total=Number(fact.totalPreferences)||0;
    assert(mapped===Object.keys(preferences).length,`${qbVersion}: Settings translation LKG mapped preference count drift.`);
    assert(mapped<=total,`${qbVersion}: Settings translation LKG mapped preferences exceed source surface.`);
    for(const hash of new Set(Object.values(translations))){
      assert(lkg.sets[hash],`${qbVersion}: Settings translation set ${hash} is missing from the LKG.`);
      sets[hash]=clone(lkg.sets[hash]);
    }
    return{
      ...profile,
      settingsUiSource:String(fact.source||''),
      settingsUiMappedPreferences:mapped,
      settingsUiTotalPreferences:total,
      settingsUi:preferences,
      settingsTranslations:translations,
      settingsTranslationSets:sets
    };
  });
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const enrichedPath=path.resolve(process.argv[2]||'');
    const frozenPath=path.resolve(process.argv[3]||'');
    const outputPath=path.resolve(process.argv[4]||'');
    if(!enrichedPath||!fs.existsSync(enrichedPath)||!frozenPath||!fs.existsSync(frozenPath)||!outputPath)throw new Error('Usage: node tools/qb-settings-translation-lkg.mjs <source-enriched-catalog.json> <frozen-catalog.json> <output.json>');
    const enriched=JSON.parse(fs.readFileSync(enrichedPath,'utf8'));
    const frozen=JSON.parse(fs.readFileSync(frozenPath,'utf8'));
    const baseCatalogSha256=crypto.createHash('sha256').update(canonicalLfBytes(frozenPath)).digest('hex');
    const sourceEvidence=process.env.GITHUB_SHA?{
      weiGCommit:process.env.GITHUB_SHA,
      ...(process.env.GITHUB_RUN_ID?{ciRunId:Number(process.env.GITHUB_RUN_ID)}:{})
    }:null;
    const lkg=buildQbSettingsTranslationLkg(enriched,frozen,{baseCatalogSha256,sourceEvidence});
    fs.mkdirSync(path.dirname(outputPath),{recursive:true});
    fs.writeFileSync(outputPath,JSON.stringify(lkg)+'\n','utf8');
    const mapped=lkg.profiles.reduce((sum,item)=>sum+item.mappedPreferences,0);
    const routes=lkg.profiles.reduce((sum,item)=>sum+Object.keys(item.translations||{}).length,0);
    console.log(`Frozen qB Settings translation evidence: ${lkg.profileCount} releases, ${mapped} mapped preferences, ${routes} locale routes, ${Object.keys(lkg.sets).length} deduplicated translation sets.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

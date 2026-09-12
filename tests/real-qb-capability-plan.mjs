#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'..');
const DIMENSIONS=['api','settings','search','auth','locale','altWebui'];
const CURRENT_DESCRIPTOR_FIELDS=[
  'key','type','readType','writeType','getterPresent','setterPresent','getterKind','setterKind',
  'getterSource','setterSource','getterConfidence','setterConfidence','typeAgreement','writable',
  'source','sourceConfidence','upstreamFallbackExpression','upstreamFallbackValue',
  'upstreamFallbackConfidence','semanticGetterEnriched'
];
const AUTH_PREF=/auth|csrf|clickjack|secure_cookie|web_ui_(?:username|password|domain|address|port|https)|use_https|ssl_/i;
const ALT_PREF=/^alternative_webui_(?:enabled|path)$/;

function fail(message){throw new Error(message);}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  }
  return value;
}
function stableJson(value){return JSON.stringify(canonical(value));}
function sorted(values){return [...new Set((values||[]).map(String))].sort();}
function actionParameters(profile,predicate=()=>true){
  const source=profile?.apiActionParameters||{};
  return Object.fromEntries(Object.keys(source).filter(predicate).sort().map(action=>{
    const item=source[action]||{};
    return [action,{
      parameters:sorted(item.parameters),
      required:sorted(item.required),
      optional:sorted(item.optional)
    }];
  }));
}
function descriptors(profile,predicate=()=>true){
  const rows=Array.isArray(profile?.preferenceDescriptors)?profile.preferenceDescriptors:[];
  return rows.filter(row=>row&&typeof row.key==='string'&&predicate(row.key)).map(row=>{
    const out={};
    for(const key of CURRENT_DESCRIPTOR_FIELDS)out[key]=Object.hasOwn(row,key)?row[key]:null;
    return out;
  }).sort((a,b)=>a.key.localeCompare(b.key));
}
function sourceSurface(profile){
  return {
    protocolGeneration:profile.protocolGeneration??null,
    webApiVersion:profile.webApiVersion??null,
    apiActions:sorted(profile.apiActions),
    apiActionParameters:actionParameters(profile),
    torrentFilters:sorted(profile.torrentFilters),
    torrentInfoParameters:sorted(profile.torrentInfoParameters),
    torrentInfoFields:sorted(profile.torrentInfoFields),
    torrentStates:sorted(profile.torrentStates),
    torrentPropertiesFields:sorted(profile.torrentPropertiesFields),
    torrentTrackerFields:sorted(profile.torrentTrackerFields),
    torrentFileFields:sorted(profile.torrentFileFields),
    torrentWebSeedFields:sorted(profile.torrentWebSeedFields)
  };
}
function searchSurface(profile){
  const isSearch=action=>action.startsWith('searchcontroller.h:');
  return {
    actions:sorted(profile.apiActions).filter(isSearch),
    parameters:actionParameters(profile,isSearch)
  };
}
function authSurface(profile){
  const isAuth=action=>action.startsWith('authcontroller.h:');
  return {
    actions:sorted(profile.apiActions).filter(isAuth),
    parameters:actionParameters(profile,isAuth),
    preferences:descriptors(profile,key=>AUTH_PREF.test(key))
  };
}
function altWebuiSurface(profile){
  const appActions=sorted(profile.apiActions).filter(action=>
    action==='appcontroller.h:preferencesAction'||action==='appcontroller.h:setPreferencesAction');
  return {
    appActions,
    appParameters:actionParameters(profile,action=>appActions.includes(action)),
    preferences:descriptors(profile,key=>ALT_PREF.test(key))
  };
}
function settingsSurface(profile){return {preferences:descriptors(profile)};}
function localeIndex(localeLkg){
  if(!localeLkg||!localeLkg.localeSets||!Array.isArray(localeLkg.profiles))fail('Locale LKG is missing localeSets/profiles.');
  const byVersion=new Map();
  for(const row of localeLkg.profiles){
    const version=String(row?.qbVersion||'').trim();
    const setId=String(row?.localeSet||'').trim();
    const values=localeLkg.localeSets[setId];
    if(!version||!setId||!Array.isArray(values))fail(`Locale LKG has an invalid profile row for ${version||'unknown'}.`);
    if(byVersion.has(version))fail(`Locale LKG duplicates qB ${version}.`);
    byVersion.set(version,{locales:sorted(values)});
  }
  return byVersion;
}
function isFourthComponent(version){return /^\d+\.\d+\.\d+\.\d+$/.test(version);}
function fingerprint(dimension,facts){return sha256(`${dimension}\0${stableJson(facts)}`);}

export function buildCapabilityPlan(root=repoRoot){
  const manifestPath=path.join(root,'tools/data/qb-stable-lkg.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  const catalogPath=path.join(root,manifest.catalogPath);
  const catalogBytes=fs.readFileSync(catalogPath);
  const catalogDigest=sha256(catalogBytes);
  if(catalogDigest!==manifest.catalogSha256)fail(`Frozen catalog digest mismatch: expected ${manifest.catalogSha256}, got ${catalogDigest}.`);
  const catalog=JSON.parse(catalogBytes);
  if(!Array.isArray(catalog)||catalog.length!==manifest.profileCount)fail(`Frozen catalog count mismatch: expected ${manifest.profileCount}, got ${Array.isArray(catalog)?catalog.length:'non-array'}.`);
  const localeLkg=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-locale-lkg.json'),'utf8'));
  if(localeLkg.profileCount!==manifest.profileCount||localeLkg.baseCatalogSha256!==manifest.catalogSha256)fail('Locale LKG identity does not match Frozen stable catalog.');
  const localeByVersion=localeIndex(localeLkg);
  const seen=new Set();
  const rows=catalog.map((profile,index)=>{
    const version=String(profile?.qbVersion||'').trim();
    if(!/^\d+(?:\.\d+){2,3}$/.test(version))fail(`Frozen catalog has invalid qB version at ordinal ${index}.`);
    if(seen.has(version))fail(`Frozen catalog duplicates qB ${version}.`);
    seen.add(version);
    const locale=localeByVersion.get(version);
    if(!locale)fail(`Locale LKG has no qB ${version} profile.`);
    if(!Array.isArray(profile.apiActions)||!profile.apiActionParameters||!Array.isArray(profile.preferenceDescriptors))fail(`qB ${version} lacks source facts required for capability planning.`);
    const facts={
      api:sourceSurface(profile),
      settings:settingsSurface(profile),
      search:searchSurface(profile),
      auth:authSurface(profile),
      locale,
      altWebui:altWebuiSurface(profile)
    };
    const fingerprints=Object.fromEntries(DIMENSIONS.map(d=>[d,fingerprint(d,facts[d])]));
    return {
      qbVersion:version,
      ordinal:index,
      sentinelReasons:isFourthComponent(version)?['fourth-component-stable']:[],
      fingerprints
    };
  });
  if(rows[0]?.qbVersion!==manifest.supportFloor||rows.at(-1)?.qbVersion!==manifest.latestAdmittedStable)fail('Frozen planner boundaries diverged from manifest.');
  if(localeByVersion.size!==rows.length)fail(`Locale LKG/profile coverage mismatch: ${localeByVersion.size} locale profiles for ${rows.length} stable releases.`);

  const families={};
  for(const dimension of DIMENSIONS){
    const byFingerprint=new Map();
    for(const row of rows){
      const fp=row.fingerprints[dimension];
      if(!byFingerprint.has(fp))byFingerprint.set(fp,[]);
      byFingerprint.get(fp).push(row);
    }
    families[dimension]=[...byFingerprint.entries()].map(([fp,members],familyOrdinal)=>{
      const versions=members.map(row=>row.qbVersion);
      const representatives=[];
      const add=(version,reason)=>{if(!representatives.some(x=>x.qbVersion===version))representatives.push({qbVersion:version,reasons:[reason]});else representatives.find(x=>x.qbVersion===version).reasons.push(reason);};
      add(versions[0],'family-head');
      add(versions.at(-1),'family-tail');
      for(const row of members)for(const reason of row.sentinelReasons)add(row.qbVersion,reason);
      return {
        id:`${dimension}-${fp.slice(0,12)}`,
        fingerprint:fp,
        familyOrdinal,
        members:versions,
        head:versions[0],
        tail:versions.at(-1),
        representatives
      };
    });
  }
  const familyIds={};
  for(const dimension of DIMENSIONS){
    familyIds[dimension]=new Map(families[dimension].map(f=>[f.fingerprint,f.id]));
  }
  const versions=rows.map(row=>({
    qbVersion:row.qbVersion,
    ordinal:row.ordinal,
    sentinelReasons:row.sentinelReasons,
    families:Object.fromEntries(DIMENSIONS.map(d=>[d,familyIds[d].get(row.fingerprints[d])])),
    fingerprints:row.fingerprints
  }));
  const representativeSet=dimension=>new Set(families[dimension].flatMap(f=>f.representatives.map(r=>r.qbVersion)));
  const coreDimensions=['api','settings','auth','altWebui'];
  const coreFull=new Set(coreDimensions.flatMap(d=>[...representativeSet(d)]));
  const searchFull=representativeSet('search');
  const fastMatrix=versions.map(row=>({
    qb:row.qbVersion,
    coreMode:coreFull.has(row.qbVersion)?'full':'smoke',
    searchMode:searchFull.has(row.qbVersion)?'full':'skip'
  }));
  return {
    schemaVersion:1,
    evidenceLevel:'frozen-source-structural',
    decisionMode:'analysis-only',
    frozen:{
      supportFloor:manifest.supportFloor,
      latestAdmittedStable:manifest.latestAdmittedStable,
      profileCount:manifest.profileCount,
      catalogSha256:manifest.catalogSha256,
      localeBaseCatalogSha256:localeLkg.baseCatalogSha256
    },
    dimensions:DIMENSIONS,
    versions,
    families,
    fast:{
      coreDimensions,
      matrix:fastMatrix
    },
    summary:{
      ...Object.fromEntries(DIMENSIONS.map(d=>[d,{
        familyCount:families[d].length,
        representativeCount:new Set(families[d].flatMap(f=>f.representatives.map(r=>r.qbVersion))).size
      }])),
      fast:{
        coreFullCount:fastMatrix.filter(row=>row.coreMode==='full').length,
        searchFullCount:fastMatrix.filter(row=>row.searchMode==='full').length,
        smokeOnlyCount:fastMatrix.filter(row=>row.coreMode==='smoke'&&row.searchMode==='skip').length
      }
    }
  };
}

export function matrixForMode(plan,mode){
  if(mode==='fast')return plan.fast.matrix;
  if(mode==='exhaustive')return plan.versions.map(row=>({qb:row.qbVersion,coreMode:'full',searchMode:'full'}));
  fail(`Unknown G-FM planning mode: ${mode}`);
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const plan=buildCapabilityPlan();
  const matrixArg=process.argv.indexOf('--matrix');
  if(matrixArg!==-1){
    const mode=process.argv[matrixArg+1];
    process.stdout.write(`${JSON.stringify(matrixForMode(plan,mode))}\n`);
  }else if(process.argv.includes('--summary')){
    console.log(JSON.stringify({
      schemaVersion:plan.schemaVersion,
      evidenceLevel:plan.evidenceLevel,
      decisionMode:plan.decisionMode,
      profileCount:plan.frozen.profileCount,
      summary:plan.summary
    },null,2));
  }else{
    process.stdout.write(`${JSON.stringify(plan,null,2)}\n`);
  }
}

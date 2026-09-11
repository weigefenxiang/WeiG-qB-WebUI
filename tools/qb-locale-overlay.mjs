#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function profileKey(profile){return String(profile?.qbVersion||'').trim();}
function localeValues(value){
  const seen=new Set(),out=[];
  for(const item of Array.isArray(value)?value:[]){
    const code=String(item&&typeof item==='object'?item.value:item||'').trim();
    if(code&&!seen.has(code)){seen.add(code);out.push(code);}
  }
  return out;
}
function localeObjects(value){return localeValues(value).map(value=>({value,label:null}));}
function sha256Bytes(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
function numeric(value){const n=Number(value);return Number.isFinite(n)?n:0;}

// Frozen LKG profiles predate semantic parsing of Preferences::getLocale(). Their
// setter side is already source-proven as QString, but the unresolved getter type
// makes the simulator fail closed and reject locale writes. qBittorrent exposes
// QString Preferences::getLocale() / setLocale(const QString&) across the supported
// range, so repair only this exact preference when the frozen setter evidence agrees.
export function repairLocalePreferenceSemantics(profile){
  const descriptors=Array.isArray(profile?.preferenceDescriptors)?profile.preferenceDescriptors:null;
  if(!descriptors)return profile;
  const index=descriptors.findIndex(item=>item&&String(item.key)==='locale');
  if(index<0)return profile;
  const current=descriptors[index]||{};
  if(current.getterPresent!==true||current.setterPresent!==true||current.writeType!=='string'){
    throw new Error(`${profileKey(profile)||'unknown'}: locale preference lacks the required source-proven getter/setter string contract.`);
  }
  if(current.readType&&current.readType!=='string')throw new Error(`${profileKey(profile)||'unknown'}: locale getter type conflicts with qBittorrent Preferences::getLocale().`);
  if(current.typeAgreement==='MISMATCH')throw new Error(`${profileKey(profile)||'unknown'}: locale descriptor has a read/write type conflict.`);
  if(current.readType==='string'&&current.typeAgreement==='EXACT'&&current.writable===true)return profile;

  const nextDescriptor={
    ...current,
    type:'string',
    readType:'string',
    writeType:'string',
    getterKind:'PREFERENCES_DECLARATION',
    getterSource:'UPSTREAM_GETTER',
    getterConfidence:'HIGH',
    typeAgreement:'EXACT',
    writable:true,
    source:'UPSTREAM_GETTER_SETTER',
    sourceConfidence:'HIGH',
    semanticGetterEnriched:true,
    localeSemanticSource:'src/base/preferences.h:Preferences::getLocale'
  };
  const nextDescriptors=descriptors.slice();
  nextDescriptors[index]=nextDescriptor;

  let stats=profile?.preferenceDescriptorStats;
  if(stats&&typeof stats==='object'){
    stats={...stats};
    if(!current.readType){
      stats.readTyped=numeric(stats.readTyped)+1;
      stats.unresolvedRead=Math.max(0,numeric(stats.unresolvedRead)-1);
    }
    if(current.typeAgreement!=='EXACT')stats.exactAgreement=numeric(stats.exactAgreement)+1;
    if(current.semanticGetterEnriched!==true)stats.semanticGetterEnriched=numeric(stats.semanticGetterEnriched)+1;
  }
  return{...profile,preferenceDescriptors:nextDescriptors,...(stats?{preferenceDescriptorStats:stats}:{})};
}

export function extractLocaleOverlay(catalog,metadata={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Source catalog must be a non-empty array.');
  const setIds=new Map(),localeSets={},profiles=[];
  for(const profile of catalog){
    const qbVersion=profileKey(profile),sourceSha=String(profile?.sourceSha||'').trim(),locales=localeValues(profile?.webuiLocales);
    if(!qbVersion||!sourceSha)throw new Error('Every locale overlay profile requires qbVersion and sourceSha.');
    if(!locales.length)throw new Error(`${qbVersion}: source catalog has no WebUI locale facts.`);
    const key=JSON.stringify(locales);
    let localeSet=setIds.get(key);
    if(!localeSet){localeSet=`s${setIds.size+1}`;setIds.set(key,localeSet);localeSets[localeSet]=locales;}
    profiles.push({qbVersion,sourceSha,source:String(profile?.webuiLocaleSource||'unresolved'),localeSet});
  }
  return{
    schemaVersion:1,
    supportFloor:profileKey(catalog[0]),
    latestAdmittedStable:profileKey(catalog.at(-1)),
    profileCount:profiles.length,
    ...(metadata.baseCatalogSha256?{baseCatalogSha256:String(metadata.baseCatalogSha256)}:{}),
    ...(metadata.sourceEvidence?{sourceEvidence:metadata.sourceEvidence}:{}),
    localeSets,
    profiles
  };
}

export function applyLocaleOverlay(catalog,overlay,{catalogSha256=''}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Base catalog must be a non-empty array.');
  if(!overlay||overlay.schemaVersion!==1||!overlay.localeSets||typeof overlay.localeSets!=='object'||!Array.isArray(overlay.profiles))throw new Error('Locale overlay must use schemaVersion 1 with localeSets and profiles.');
  if(Number(overlay.profileCount)!==catalog.length||overlay.profiles.length!==catalog.length)throw new Error(`Locale overlay profile count mismatch: ${overlay.profiles.length}/${overlay.profileCount} != ${catalog.length}`);
  if(profileKey(catalog[0])!==String(overlay.supportFloor||''))throw new Error(`Locale overlay support floor mismatch: ${overlay.supportFloor} != ${profileKey(catalog[0])}`);
  if(profileKey(catalog.at(-1))!==String(overlay.latestAdmittedStable||''))throw new Error(`Locale overlay latest stable mismatch: ${overlay.latestAdmittedStable} != ${profileKey(catalog.at(-1))}`);
  if(catalogSha256&&String(overlay.baseCatalogSha256||'')!==catalogSha256)throw new Error(`Locale overlay base catalog SHA-256 mismatch: ${overlay.baseCatalogSha256||'missing'} != ${catalogSha256}`);
  const byVersion=new Map(overlay.profiles.map(profile=>[profileKey(profile),profile]));
  if(byVersion.size!==overlay.profiles.length)throw new Error('Locale overlay contains duplicate qB versions.');
  return catalog.map(profile=>{
    const qbVersion=profileKey(profile),fact=byVersion.get(qbVersion);
    if(!fact)throw new Error(`${qbVersion}: locale overlay profile missing.`);
    if(String(fact.sourceSha||'')!==String(profile.sourceSha||''))throw new Error(`${qbVersion}: locale overlay source SHA mismatch.`);
    const setName=String(fact.localeSet||''),webuiLocales=localeObjects(overlay.localeSets[setName]);
    if(!setName||!webuiLocales.length)throw new Error(`${qbVersion}: locale overlay set ${setName||'missing'} is unresolved.`);
    return repairLocalePreferenceSemantics({...profile,webuiLocaleSource:String(fact.source||'unresolved'),webuiLocales});
  });
}

function readJson(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const mode=String(process.argv[2]||'');
    if(mode==='extract'){
      const input=path.resolve(process.argv[3]||''),output=path.resolve(process.argv[4]||'');
      if(!input||!output)throw new Error('Usage: node tools/qb-locale-overlay.mjs extract <enriched-catalog.json> <locale-overlay.json>');
      const overlay=extractLocaleOverlay(readJson(input));
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify(overlay,null,2)+'\n','utf8');
      console.log(`Extracted ${overlay.profiles.length} exact qB locale profiles into ${Object.keys(overlay.localeSets).length} locale sets.`);
    }else if(mode==='apply'){
      const catalogPath=path.resolve(process.argv[3]||''),overlayPath=path.resolve(process.argv[4]||''),output=path.resolve(process.argv[5]||'');
      if(!catalogPath||!overlayPath||!output)throw new Error('Usage: node tools/qb-locale-overlay.mjs apply <catalog.json> <locale-overlay.json> <output.json>');
      const catalogBytes=fs.readFileSync(catalogPath);
      const merged=applyLocaleOverlay(JSON.parse(catalogBytes.toString('utf8')),readJson(overlayPath),{catalogSha256:sha256Bytes(catalogBytes)});
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify(merged,null,2)+'\n','utf8');
      console.log(`Applied exact qB locale overlay to ${merged.length} profiles.`);
    }else throw new Error('Mode must be extract or apply.');
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

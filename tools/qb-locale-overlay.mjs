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

export function extractLocaleOverlay(catalog,metadata={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Source catalog must be a non-empty array.');
  const profiles=catalog.map(profile=>{
    const qbVersion=profileKey(profile),sourceSha=String(profile?.sourceSha||'').trim(),locales=localeValues(profile?.webuiLocales);
    if(!qbVersion||!sourceSha)throw new Error('Every locale overlay profile requires qbVersion and sourceSha.');
    if(!locales.length)throw new Error(`${qbVersion}: source catalog has no WebUI locale facts.`);
    return{qbVersion,sourceSha,source:String(profile?.webuiLocaleSource||'unresolved'),locales};
  });
  return{
    schemaVersion:1,
    supportFloor:profileKey(catalog[0]),
    latestAdmittedStable:profileKey(catalog.at(-1)),
    profileCount:profiles.length,
    ...(metadata.baseCatalogSha256?{baseCatalogSha256:String(metadata.baseCatalogSha256)}:{}),
    ...(metadata.sourceEvidence?{sourceEvidence:metadata.sourceEvidence}:{}),
    profiles
  };
}

export function applyLocaleOverlay(catalog,overlay,{catalogSha256=''}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Base catalog must be a non-empty array.');
  if(!overlay||overlay.schemaVersion!==1||!Array.isArray(overlay.profiles))throw new Error('Locale overlay must use schemaVersion 1 with profiles.');
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
    const webuiLocales=localeObjects(fact.locales);
    if(!webuiLocales.length)throw new Error(`${qbVersion}: locale overlay has no WebUI locales.`);
    return{...profile,webuiLocaleSource:String(fact.source||'unresolved'),webuiLocales};
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
      console.log(`Extracted ${overlay.profiles.length} exact qB locale profiles.`);
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function profileKey(profile){return String(profile?.qbVersion||'').trim();}
function cloneLocales(value){return Array.isArray(value)?value.map(item=>({value:String(item?.value||''),label:item?.label==null?null:String(item.label)})).filter(item=>item.value):[];}

export function extractLocaleOverlay(catalog){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Source catalog must be a non-empty array.');
  return{
    schemaVersion:1,
    profiles:catalog.map(profile=>{
      const qbVersion=profileKey(profile),sourceSha=String(profile?.sourceSha||'').trim(),webuiLocales=cloneLocales(profile?.webuiLocales);
      if(!qbVersion||!sourceSha)throw new Error('Every locale overlay profile requires qbVersion and sourceSha.');
      if(!webuiLocales.length)throw new Error(`${qbVersion}: source catalog has no WebUI locale facts.`);
      return{qbVersion,sourceSha,webuiLocaleSource:String(profile?.webuiLocaleSource||'unresolved'),webuiLocales};
    })
  };
}

export function applyLocaleOverlay(catalog,overlay){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Base catalog must be a non-empty array.');
  if(!overlay||overlay.schemaVersion!==1||!Array.isArray(overlay.profiles))throw new Error('Locale overlay must use schemaVersion 1 with profiles.');
  if(overlay.profiles.length!==catalog.length)throw new Error(`Locale overlay profile count mismatch: ${overlay.profiles.length} != ${catalog.length}`);
  const byVersion=new Map(overlay.profiles.map(profile=>[profileKey(profile),profile]));
  if(byVersion.size!==overlay.profiles.length)throw new Error('Locale overlay contains duplicate qB versions.');
  return catalog.map(profile=>{
    const qbVersion=profileKey(profile),fact=byVersion.get(qbVersion);
    if(!fact)throw new Error(`${qbVersion}: locale overlay profile missing.`);
    if(String(fact.sourceSha||'')!==String(profile.sourceSha||''))throw new Error(`${qbVersion}: locale overlay source SHA mismatch.`);
    const webuiLocales=cloneLocales(fact.webuiLocales);
    if(!webuiLocales.length)throw new Error(`${qbVersion}: locale overlay has no WebUI locales.`);
    return{...profile,webuiLocaleSource:String(fact.webuiLocaleSource||'unresolved'),webuiLocales};
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
      const merged=applyLocaleOverlay(readJson(catalogPath),readJson(overlayPath));
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify(merged,null,2)+'\n','utf8');
      console.log(`Applied exact qB locale overlay to ${merged.length} profiles.`);
    }else throw new Error('Mode must be extract or apply.');
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

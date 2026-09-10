#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// qBittorrent WebApplication::sendFile limits Alternative WebUI static files to 10 MiB.
export const QB_WEBUI_MAX_STATIC_FILE_BYTES=10*1024*1024;

function assertStaticSize(name,content){
  const bytes=Buffer.byteLength(content);
  if(bytes>=QB_WEBUI_MAX_STATIC_FILE_BYTES)throw new Error(`${name} is ${bytes} bytes; qB WebUI static files must stay below ${QB_WEBUI_MAX_STATIC_FILE_BYTES} bytes.`);
  return bytes;
}

export function settingsTranslationData(catalog){
  const sets={};
  const profiles=[];
  for(const item of catalog||[]){
    Object.assign(sets,item&&item.settingsTranslationSets||{});
    if(!item||!item.qbVersion||!item.sourceSha)continue;
    profiles.push({qbVersion:item.qbVersion,sourceSha:item.sourceSha,preferences:item.settingsUi||{},translations:item.settingsTranslations||{}});
  }
  return{schemaVersion:1,source:'qb-upstream-preferences-ui+webui-ts',profiles,sets};
}

export function packCatalog(input,output){
  if(!input||!output)throw new Error('Usage: node tools/qb-webui-catalog.mjs <input.json> <output.json>');
  const source=fs.readFileSync(input,'utf8');
  const catalog=JSON.parse(source);
  if(!Array.isArray(catalog)||catalog.length===0)throw new Error('qB release catalog must be a non-empty JSON array.');
  const packed=`${JSON.stringify(catalog)}\n`;
  const bytes=assertStaticSize('Packed qB release catalog',packed);
  const outputPath=path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,packed);
  const settingsPath=path.join(path.dirname(outputPath),'qb-settings-translations.json');
  const settingsPacked=`${JSON.stringify(settingsTranslationData(catalog))}\n`;
  const settingsBytes=assertStaticSize('Packed qB Settings translation catalog',settingsPacked);
  fs.writeFileSync(settingsPath,settingsPacked);
  const verified=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  if(JSON.stringify(verified)!==JSON.stringify(catalog))throw new Error('Packed qB release catalog changed JSON semantics.');
  const verifiedSettings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
  if(JSON.stringify(verifiedSettings)!==JSON.stringify(settingsTranslationData(catalog)))throw new Error('Packed qB Settings translation catalog changed JSON semantics.');
  return {profiles:catalog.length,sourceBytes:Buffer.byteLength(source),packedBytes:bytes,settingsPackedBytes:settingsBytes,maxStaticBytes:QB_WEBUI_MAX_STATIC_FILE_BYTES};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const result=packCatalog(process.argv[2],process.argv[3]);
    console.log(JSON.stringify(result));
  }catch(error){
    console.error(error?.message||error);
    process.exitCode=1;
  }
}

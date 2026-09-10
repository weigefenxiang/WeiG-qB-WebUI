#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// qBittorrent WebApplication::sendFile limits Alternative WebUI static files to 10 MiB.
export const QB_WEBUI_MAX_STATIC_FILE_BYTES=10*1024*1024;
const SETTINGS_FIELDS=[
  'settingsUiSource',
  'settingsUiMappedPreferences',
  'settingsUiTotalPreferences',
  'settingsUi',
  'settingsTranslations',
  'settingsTranslationSets'
];

function assertStaticSize(name,content){
  const bytes=Buffer.byteLength(content);
  if(bytes>=QB_WEBUI_MAX_STATIC_FILE_BYTES)throw new Error(`${name} is ${bytes} bytes; qB WebUI static files must stay below ${QB_WEBUI_MAX_STATIC_FILE_BYTES} bytes.`);
  return bytes;
}
function collectSettingsSets(catalog){
  const sets={};
  for(const item of catalog||[])Object.assign(sets,item&&item.settingsTranslationSets||{});
  return sets;
}
export function settingsTranslationShard(item,allSets){
  if(!item||!item.qbVersion||!item.sourceSha)return null;
  const translations=item.settingsTranslations||{};
  const preferences=item.settingsUi||{};
  if(!Object.keys(translations).length&&!Object.keys(preferences).length)return null;
  if(!/^[0-9a-f]{40}$/.test(String(item.sourceSha)))throw new Error(`${item.qbVersion}: invalid exact source SHA for Settings translation shard.`);
  const sets={};
  for(const hash of new Set(Object.values(translations))){
    if(!allSets[hash])throw new Error(`${item.qbVersion}: missing Settings translation set ${hash}.`);
    sets[hash]=allSets[hash];
  }
  return{
    schemaVersion:1,
    source:'qb-upstream-preferences-ui+webui-ts',
    qbVersion:item.qbVersion,
    sourceSha:item.sourceSha,
    preferences,
    translations,
    sets
  };
}
export function runtimeCatalogData(catalog){
  const allSets=collectSettingsSets(catalog);
  return (catalog||[]).map(item=>{
    const runtime={...item};
    for(const key of SETTINGS_FIELDS)delete runtime[key];
    const shard=settingsTranslationShard(item,allSets);
    if(shard)runtime.settingsTranslationPath=`qb-settings/${item.sourceSha}.json`;
    return runtime;
  });
}
export function packCatalog(input,output){
  if(!input||!output)throw new Error('Usage: node tools/qb-webui-catalog.mjs <input.json> <output.json>');
  const source=fs.readFileSync(input,'utf8');
  const catalog=JSON.parse(source);
  if(!Array.isArray(catalog)||catalog.length===0)throw new Error('qB release catalog must be a non-empty JSON array.');

  const runtimeCatalog=runtimeCatalogData(catalog);
  const packed=`${JSON.stringify(runtimeCatalog)}\n`;
  const bytes=assertStaticSize('Packed qB release catalog',packed);
  const outputPath=path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});
  fs.writeFileSync(outputPath,packed);

  const settingsDir=path.join(path.dirname(outputPath),'qb-settings');
  fs.rmSync(settingsDir,{recursive:true,force:true});
  fs.mkdirSync(settingsDir,{recursive:true});
  const allSets=collectSettingsSets(catalog);
  let shardCount=0,maxShardBytes=0,totalShardBytes=0;
  for(const item of catalog){
    const shard=settingsTranslationShard(item,allSets);
    if(!shard)continue;
    const shardPacked=`${JSON.stringify(shard)}\n`;
    const shardBytes=assertStaticSize(`qB Settings translation shard ${item.qbVersion}`,shardPacked);
    fs.writeFileSync(path.join(settingsDir,`${item.sourceSha}.json`),shardPacked);
    shardCount+=1;
    maxShardBytes=Math.max(maxShardBytes,shardBytes);
    totalShardBytes+=shardBytes;
  }

  const verified=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  if(JSON.stringify(verified)!==JSON.stringify(runtimeCatalog))throw new Error('Packed qB release catalog changed runtime JSON semantics.');
  return{
    profiles:runtimeCatalog.length,
    sourceBytes:Buffer.byteLength(source),
    packedBytes:bytes,
    settingsShardCount:shardCount,
    maxSettingsShardBytes:maxShardBytes,
    totalSettingsShardBytes:totalShardBytes,
    maxStaticBytes:QB_WEBUI_MAX_STATIC_FILE_BYTES
  };
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

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildNativeSettingsBundle,renderLocaleQm,renderLocaleTs,renderNativeSettingsRegistry} from './qb-settings-native-bundle.mjs';

// qBittorrent WebApplication::sendFile limits Alternative WebUI static files to 10 MiB.
// Keep individual runtime files well below that boundary: real qB serves these files,
// while Pages tests otherwise hide the cost of one almost-10-MiB catalog request.
export const QB_WEBUI_MAX_STATIC_FILE_BYTES=10*1024*1024;
const PROJECT_MAX_SINGLE_FILE_BYTES=5*1024*1024;
const SETTINGS_FIELDS=[
  'settingsUiSource',
  'settingsUiMappedPreferences',
  'settingsUiTotalPreferences',
  'settingsUi',
  'qbOwnedUiSource',
  'qbOwnedUi',
  'settingsTranslations',
  'settingsTranslationSets'
];
const DEFAULT_BEHAVIOR_PATH=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'data/qb-translator-behavior-lkg.json');

function assertStaticSize(name,content,limit=QB_WEBUI_MAX_STATIC_FILE_BYTES){
  const bytes=Buffer.byteLength(content);
  if(bytes>=limit)throw new Error(`${name} is ${bytes} bytes; file budget is below ${limit} bytes.`);
  return bytes;
}
function collectSettingsSets(catalog){
  const sets={};
  for(const item of catalog||[])Object.assign(sets,item&&item.settingsTranslationSets||{});
  return sets;
}
function bundleProfile(bundle,item){return (bundle?.profiles||[]).find(profile=>profile.sourceSha===item?.sourceSha&&profile.qbVersion===item?.qbVersion)||null;}
function behaviorEvidence(input){if(input)return input;return JSON.parse(fs.readFileSync(DEFAULT_BEHAVIOR_PATH,'utf8'));}
export function settingsTranslationShard(item,allSets,locales=null){
  if(!item||!item.qbVersion||!item.sourceSha)return null;
  const allowed=locales?new Set(locales.map(String)):null;
  const translations=Object.fromEntries(Object.entries(item.settingsTranslations||{}).filter(([locale])=>!allowed||allowed.has(locale)));
  const preferences=item.settingsUi||{};
  const ui=item.qbOwnedUi||{};
  if(!Object.keys(translations).length||(!Object.keys(preferences).length&&!Object.keys(ui).length))return null;
  if(!/^[0-9a-f]{40}$/.test(String(item.sourceSha)))throw new Error(`${item.qbVersion}: invalid exact source SHA for Settings translation shard.`);
  const sets={};
  for(const hash of new Set(Object.values(translations))){
    if(!allSets[hash])throw new Error(`${item.qbVersion}: missing Settings translation set ${hash}.`);
    sets[hash]=allSets[hash];
  }
  return{
    schemaVersion:2,
    source:'qb-upstream-preferences-ui+owned-ui+webui-ts-compatibility-only',
    qbVersion:item.qbVersion,
    sourceSha:item.sourceSha,
    preferences,
    ui,
    translations,
    sets
  };
}
export function runtimeCatalogData(catalog,bundle){
  const allSets=collectSettingsSets(catalog);
  return (catalog||[]).map(item=>{
    const runtime={...item};
    for(const key of SETTINGS_FIELDS)delete runtime[key];
    const routing=bundleProfile(bundle,item);
    const nativeLocales=routing?.nativeLocales||[];
    const bridgeLocales=routing?.bridgeLocales||[];
    if(nativeLocales.length)runtime.settingsNativeLocales=nativeLocales;
    if(bridgeLocales.length)runtime.settingsTranslationLocales=bridgeLocales;
    const shard=settingsTranslationShard(item,allSets,bridgeLocales);
    if(shard)runtime.settingsTranslationPath=`qb-settings/${item.sourceSha}.json`;
    if(nativeLocales.length||bridgeLocales.length)runtime.settingsCopySource='qB-native-QBT_TR+official-QM-with-exact-TS-bridge';
    return runtime;
  });
}
export function runtimeCatalogIndexData(runtimeCatalog){
  return (runtimeCatalog||[]).map(item=>{
    const sourceSha=String(item&&item.sourceSha||'');
    if(!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error(`${item?.qbVersion||'unknown'}: runtime profile requires an exact source SHA.`);
    return{
      qbVersion:item.qbVersion,
      webApiVersion:item.webApiVersion,
      sourceSha,
      stable:item.stable!==false,
      officialWeiGSupport:item.officialWeiGSupport!==false,
      profilePath:`qb-release-profiles/${sourceSha}.json`
    };
  });
}
export function packCatalog(input,output,options={}){
  if(!input||!output)throw new Error('Usage: node tools/qb-webui-catalog.mjs <input.json> <output.json> [--qm-source-dir=path] [--qm-output-dir=path] [--behavior=path]');
  const source=fs.readFileSync(input,'utf8');
  const catalog=JSON.parse(source);
  if(!Array.isArray(catalog)||catalog.length===0)throw new Error('qB release catalog must be a non-empty JSON array.');
  const behavior=behaviorEvidence(options.behaviorEvidence);
  const bundle=buildNativeSettingsBundle(catalog,behavior);
  const runtimeCatalog=runtimeCatalogData(catalog,bundle);
  const runtimeIndex=runtimeCatalogIndexData(runtimeCatalog);
  const packed=`${JSON.stringify(runtimeIndex)}\n`;
  const bytes=assertStaticSize('Packed qB release catalog index',packed,PROJECT_MAX_SINGLE_FILE_BYTES);
  const outputPath=path.resolve(output),dataDir=path.dirname(outputPath);
  fs.mkdirSync(dataDir,{recursive:true});
  fs.writeFileSync(outputPath,packed);

  const profileDir=path.join(dataDir,'qb-release-profiles');
  fs.rmSync(profileDir,{recursive:true,force:true});
  fs.mkdirSync(profileDir,{recursive:true});
  let profileShardCount=0,maxProfileShardBytes=0,totalProfileShardBytes=0;
  for(const profile of runtimeCatalog){
    const profilePacked=`${JSON.stringify(profile)}\n`;
    const profileBytes=assertStaticSize(`qB runtime profile ${profile.qbVersion}`,profilePacked,PROJECT_MAX_SINGLE_FILE_BYTES);
    fs.writeFileSync(path.join(profileDir,`${profile.sourceSha}.json`),profilePacked);
    profileShardCount+=1;
    maxProfileShardBytes=Math.max(maxProfileShardBytes,profileBytes);
    totalProfileShardBytes+=profileBytes;
  }

  const registry=renderNativeSettingsRegistry(catalog);
  const registryBytes=assertStaticSize('Native qB Settings QBT_TR registry',registry,PROJECT_MAX_SINGLE_FILE_BYTES);
  fs.writeFileSync(path.join(dataDir,'qb-settings-native.txt'),registry,'utf8');

  if(options.qmSourceDir){
    const qmSourceDir=path.resolve(options.qmSourceDir);
    fs.rmSync(qmSourceDir,{recursive:true,force:true});
    fs.mkdirSync(qmSourceDir,{recursive:true});
    for(const [locale,messages] of Object.entries(bundle.localeMessages))fs.writeFileSync(path.join(qmSourceDir,`webui_${locale}.ts`),renderLocaleTs(locale,messages),'utf8');
  }

  const qmOutputDir=path.resolve(options.qmOutputDir||path.join(dataDir,'..','..','translations'));
  fs.rmSync(qmOutputDir,{recursive:true,force:true});
  fs.mkdirSync(qmOutputDir,{recursive:true});
  let qmCount=0,maxQmBytes=0,totalQmBytes=0;
  for(const [locale,messages] of Object.entries(bundle.localeMessages)){
    const qm=renderLocaleQm(messages);
    const qmBytes=assertStaticSize(`Minimal official qB QM ${locale}`,qm,PROJECT_MAX_SINGLE_FILE_BYTES);
    fs.writeFileSync(path.join(qmOutputDir,`webui_${locale}.qm`),qm);
    qmCount+=1;maxQmBytes=Math.max(maxQmBytes,qmBytes);totalQmBytes+=qmBytes;
  }

  const settingsDir=path.join(dataDir,'qb-settings');
  fs.rmSync(settingsDir,{recursive:true,force:true});
  fs.mkdirSync(settingsDir,{recursive:true});
  const allSets=collectSettingsSets(catalog);
  let shardCount=0,maxShardBytes=0,totalShardBytes=0;
  for(const item of catalog){
    const routing=bundleProfile(bundle,item);
    const shard=settingsTranslationShard(item,allSets,routing?.bridgeLocales||[]);
    if(!shard)continue;
    const shardPacked=`${JSON.stringify(shard)}\n`;
    const shardBytes=assertStaticSize(`qB Settings compatibility shard ${item.qbVersion}`,shardPacked,PROJECT_MAX_SINGLE_FILE_BYTES);
    fs.writeFileSync(path.join(settingsDir,`${item.sourceSha}.json`),shardPacked);
    shardCount+=1;
    maxShardBytes=Math.max(maxShardBytes,shardBytes);
    totalShardBytes+=shardBytes;
  }

  const verified=JSON.parse(fs.readFileSync(outputPath,'utf8'));
  if(JSON.stringify(verified)!==JSON.stringify(runtimeIndex))throw new Error('Packed qB release index changed runtime JSON semantics.');
  const nativeLocaleRoutes=bundle.profiles.reduce((sum,item)=>sum+item.nativeLocales.length,0);
  const bridgeLocaleRoutes=bundle.profiles.reduce((sum,item)=>sum+item.bridgeLocales.length,0);
  const ownedUiBindings=bundle.profiles.reduce((sum,item)=>sum+(Number(item.mappedUi)||0),0);
  return{
    profiles:runtimeCatalog.length,
    sourceBytes:Buffer.byteLength(source),
    packedBytes:bytes,
    profileShardCount,maxProfileShardBytes,totalProfileShardBytes,
    nativeRegistryBytes:registryBytes,
    nativeLocaleRoutes,
    bridgeLocaleRoutes,
    ownedUiBindings,
    qmLocaleSources:Object.keys(bundle.localeMessages).length,
    qmCount,maxQmBytes,totalQmBytes,
    settingsShardCount:shardCount,
    maxSettingsShardBytes:maxShardBytes,
    totalSettingsShardBytes:totalShardBytes,
    maxStaticBytes:QB_WEBUI_MAX_STATIC_FILE_BYTES,
    projectMaxSingleFileBytes:PROJECT_MAX_SINGLE_FILE_BYTES
  };
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const qmSourceArg=process.argv.find(value=>value.startsWith('--qm-source-dir='));
    const qmOutputArg=process.argv.find(value=>value.startsWith('--qm-output-dir='));
    const behaviorArg=process.argv.find(value=>value.startsWith('--behavior='));
    const behavior=behaviorArg?JSON.parse(fs.readFileSync(path.resolve(behaviorArg.slice('--behavior='.length)),'utf8')):undefined;
    const result=packCatalog(process.argv[2],process.argv[3],{qmSourceDir:qmSourceArg?qmSourceArg.slice('--qm-source-dir='.length):null,qmOutputDir:qmOutputArg?qmOutputArg.slice('--qm-output-dir='.length):null,behaviorEvidence:behavior});
    console.log(JSON.stringify(result));
  }catch(error){
    console.error(error?.message||error);
    process.exitCode=1;
  }
}

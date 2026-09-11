#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyQbSettingsTranslationOverlay,buildQbSettingsTranslationOverlayFromClone} from './qb-settings-translation-overlay.mjs';

function unique(values){const out=[];for(const value of values||[]){const item=String(value||'').trim();if(item&&!out.includes(item))out.push(item);}return out;}

export function selectCatalogShard(catalog,index,count){
  if(!Array.isArray(catalog))throw new Error('qB release catalog must be an array.');
  if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||index<0||index>=count)throw new Error(`Invalid qB locale shard ${index}/${count}.`);
  return catalog.filter((_,position)=>position%count===index);
}

function profileIdentity(profile){return `${String(profile?.qbVersion||'').trim()}\u0000${String(profile?.sourceSha||'').trim()}`;}
function stablePayload(value){return JSON.stringify(value);}
export function mergeEnrichedCatalogShards(baseCatalog,shards){
  if(!Array.isArray(baseCatalog)||!baseCatalog.length)throw new Error('Base qB release catalog must be a non-empty array.');
  if(!Array.isArray(shards)||!shards.length)throw new Error('At least one enriched qB locale shard is required.');
  const byIdentity=new Map(),sets=new Map();
  for(const shard of shards){
    if(!Array.isArray(shard))throw new Error('Each enriched qB locale shard must be an array.');
    for(const profile of shard){
      const identity=profileIdentity(profile);
      if(!identity||identity==='\u0000')throw new Error('Enriched qB locale shard contains an unbound profile.');
      if(byIdentity.has(identity))throw new Error(`Duplicate enriched qB locale profile: ${identity.replace('\u0000',' ')}`);
      byIdentity.set(identity,profile);
      for(const [hash,payload] of Object.entries(profile?.settingsTranslationSets||{})){
        if(sets.has(hash)&&stablePayload(sets.get(hash))!==stablePayload(payload))throw new Error(`Settings translation hash collision while merging shards: ${hash}`);
        if(!sets.has(hash))sets.set(hash,payload);
      }
    }
  }
  const emitted=new Set();
  const merged=baseCatalog.map((base)=>{
    const identity=profileIdentity(base),source=byIdentity.get(identity);
    if(!source)throw new Error(`Missing enriched qB locale profile: ${identity.replace('\u0000',' ')}`);
    const next={...source};
    delete next.settingsTranslationSets;
    const localSets={};
    for(const hash of Object.values(next.settingsTranslations||{})){
      if(emitted.has(hash))continue;
      if(!sets.has(hash))throw new Error(`${next.qbVersion}: missing merged Settings translation set ${hash}.`);
      emitted.add(hash);
      localSets[hash]=sets.get(hash);
    }
    if(Object.keys(localSets).length)next.settingsTranslationSets=localSets;
    return next;
  });
  if(byIdentity.size!==merged.length)throw new Error(`Enriched shard profile count ${byIdentity.size} does not match base catalog ${merged.length}.`);
  return merged;
}

function decodeHtml(value){return String(value||'').replace(/&quot;|&#34;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function plainText(value){return decodeHtml(String(value||'').replace(/<[^>]*>/g,'').trim());}

export function parseExplicitLocaleOptions(source=''){
  const match=String(source).match(/<select\b[^>]*\bid=["']locale_select["'][^>]*>([\s\S]*?)<\/select>/i);
  if(!match||match[1].includes('${LANGUAGE_OPTIONS}'))return[];
  const options=[];
  for(const option of match[1].matchAll(/<option\b[^>]*\bvalue=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)){
    const value=String(option[1]||'').trim();
    if(!value)continue;
    const rawLabel=plainText(option[2]);
    options.push({value,label:rawLabel&&!rawLabel.includes('QBT_TR(')?rawLabel:null});
  }
  return options;
}

export function localeCodesFromPaths(paths=[]){
  const webui=[];
  for(const file of paths){
    const match=String(file).match(/(?:^|\/)src\/webui\/www\/translations\/webui_(.+)\.ts$/);
    if(match)webui.push(match[1]);
  }
  return unique(webui).sort((a,b)=>a.localeCompare(b));
}

export function extractWebuiLocaleFacts({preferencesSource='',paths=[]}={}){
  const explicit=parseExplicitLocaleOptions(preferencesSource);
  if(explicit.length)return{webuiLocales:explicit,webuiLocaleSource:'preferences-html'};
  const codes=localeCodesFromPaths(paths);
  return{webuiLocales:codes.map(value=>({value,label:null})),webuiLocaleSource:codes.length?'translation-resources':'unresolved'};
}

function git(qbRoot,...args){return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function showMaybe(qbRoot,tag,file){try{return git(qbRoot,'show',`${tag}:${file}`);}catch{return'';}}

export function extractProfileWebuiLocaleFacts(qbRoot,tag){
  const source=showMaybe(qbRoot,tag,'src/webui/www/private/views/preferences.html')||showMaybe(qbRoot,tag,'src/webui/www/private/preferences_content.html');
  const paths=git(qbRoot,'ls-tree','-r','--name-only',tag,'src/webui/www/translations').split(/\r?\n/).filter(Boolean);
  return extractWebuiLocaleFacts({preferencesSource:source,paths});
}

export function enrichCatalogWebuiLocales(catalog,qbRoot){
  if(!Array.isArray(catalog))throw new Error('qB release catalog must be an array.');
  return catalog.map(profile=>{
    const qbVersion=String(profile?.qbVersion||'').trim();
    const tag=String(profile?.tag||`release-${qbVersion}`).trim();
    if(!qbVersion||!tag)return{...profile,webuiLocales:[],webuiLocaleSource:'unresolved'};
    return{...profile,...extractProfileWebuiLocaleFacts(qbRoot,tag)};
  });
}

export function enrichCatalogWebuiSourceFacts(catalog,qbRoot){
  const localized=enrichCatalogWebuiLocales(catalog,qbRoot);
  const settingsOverlay=buildQbSettingsTranslationOverlayFromClone(localized,qbRoot);
  return applyQbSettingsTranslationOverlay(localized,settingsOverlay);
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const args=process.argv.slice(2);
    if(args[0]==='--merge'){
      const basePath=path.resolve(args[1]||''),shardDir=path.resolve(args[2]||''),output=path.resolve(args[3]||'');
      if(!basePath||!fs.existsSync(basePath)||!shardDir||!fs.existsSync(shardDir)||!output)throw new Error('Usage: node tools/qb-locale-source.mjs --merge <base-catalog.json> <shard-dir> <output.json>');
      const baseCatalog=JSON.parse(fs.readFileSync(basePath,'utf8'));
      const shardFiles=fs.readdirSync(shardDir).filter((name)=>/^qb-releases-shard-\d+\.json$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
      if(!shardFiles.length)throw new Error('No qB locale shard files were found for merge.');
      const shards=shardFiles.map((name)=>JSON.parse(fs.readFileSync(path.join(shardDir,name),'utf8')));
      const merged=mergeEnrichedCatalogShards(baseCatalog,shards);
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify(merged,null,2)+'\n','utf8');
      console.log(`Merged ${shardFiles.length} qB locale/source shards into ${merged.length} exact release profiles.`);
    }else{
      const positional=args.filter((arg)=>!arg.startsWith('--shard-index=')&&!arg.startsWith('--shard-count='));
      const qbRoot=path.resolve(positional[0]||process.env.QB_UPSTREAM_DIR||'');
      const input=path.resolve(positional[1]||'');
      const output=path.resolve(positional[2]||positional[1]||'');
      if(!qbRoot||!fs.existsSync(qbRoot)||!input||!fs.existsSync(input))throw new Error('Usage: node tools/qb-locale-source.mjs <qBittorrent-clone> <catalog.json> [output.json] [--shard-index=N --shard-count=M]');
      const shardIndexArg=args.find((arg)=>arg.startsWith('--shard-index='));
      const shardCountArg=args.find((arg)=>arg.startsWith('--shard-count='));
      if(Boolean(shardIndexArg)!==Boolean(shardCountArg))throw new Error('qB locale sharding requires both --shard-index and --shard-count.');
      const fullCatalog=JSON.parse(fs.readFileSync(input,'utf8'));
      let catalog=fullCatalog;
      let shardLabel='full';
      if(shardIndexArg){
        const shardIndex=Number(shardIndexArg.split('=')[1]);
        const shardCount=Number(shardCountArg.split('=')[1]);
        catalog=selectCatalogShard(fullCatalog,shardIndex,shardCount);
        shardLabel=`${shardIndex+1}/${shardCount}`;
      }
      const enriched=enrichCatalogWebuiSourceFacts(catalog,qbRoot);
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify(enriched,null,2)+'\n','utf8');
      const resolved=enriched.filter(item=>Array.isArray(item.webuiLocales)&&item.webuiLocales.length).length;
      const mapped=enriched.reduce((sum,item)=>sum+(Number(item.settingsUiMappedPreferences)||0),0);
      const total=enriched.reduce((sum,item)=>sum+(Number(item.settingsUiTotalPreferences)||0),0);
      console.log(`Enriched qB locale/source shard ${shardLabel}: ${resolved}/${enriched.length} release profiles; source-proven Settings labels ${mapped}/${total}.`);
    }
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyQbSettingsTranslationOverlay,buildQbSettingsTranslationOverlayFromClone} from './qb-settings-translation-overlay.mjs';

function unique(values){const out=[];for(const value of values||[]){const item=String(value||'').trim();if(item&&!out.includes(item))out.push(item);}return out;}
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

function profileIdentity(profile){return `${String(profile?.qbVersion||'').trim()}\u0000${String(profile?.sourceSha||'').trim()}`;}
function stableJson(value){return JSON.stringify(value);}

export function mergeParallelWebuiSourceFacts(catalog,shards){
  const profiles=new Map();
  const sets=new Map();
  for(const shard of shards){
    if(!Array.isArray(shard))throw new Error('Parallel qB locale shard must be an array.');
    for(const profile of shard){
      const identity=profileIdentity(profile);
      if(!identity||identity==='\u0000')throw new Error('Parallel qB locale shard profile is missing identity.');
      if(profiles.has(identity))throw new Error(`Duplicate parallel qB locale profile: ${identity.replace('\u0000',' ')}`);
      const copy={...profile};
      const localSets=copy.settingsTranslationSets||{};
      delete copy.settingsTranslationSets;
      profiles.set(identity,copy);
      for(const [hash,payload] of Object.entries(localSets)){
        if(sets.has(hash)&&stableJson(sets.get(hash))!==stableJson(payload))throw new Error(`Settings translation hash collision across parallel shards: ${hash}`);
        if(!sets.has(hash))sets.set(hash,payload);
      }
    }
  }

  const seenSets=new Set();
  return catalog.map(original=>{
    const identity=profileIdentity(original);
    const profile=profiles.get(identity);
    if(!profile)throw new Error(`${original?.qbVersion||'unknown'}: missing parallel qB locale profile.`);
    const localSets={};
    for(const hash of Object.values(profile.settingsTranslations||{})){
      if(seenSets.has(hash))continue;
      if(!sets.has(hash))throw new Error(`${profile.qbVersion}: parallel qB locale merge is missing Settings translation set ${hash}.`);
      seenSets.add(hash);
      localSets[hash]=sets.get(hash);
    }
    return{...profile,...(Object.keys(localSets).length?{settingsTranslationSets:localSets}:{})};
  });
}

function runWorker(script,qbRoot,input,output){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[script,qbRoot,input,output,'--serial'],{
      stdio:'inherit',
      env:{...process.env,WEIGG_QB_LOCALE_WORKERS:'1'}
    });
    child.on('error',reject);
    child.on('exit',(code,signal)=>code===0?resolve():reject(new Error(`qB locale worker failed (${signal||code}).`)));
  });
}

async function enrichCatalogWebuiSourceFactsParallel(catalog,qbRoot,workers,script){
  const count=Math.max(1,Math.min(workers,catalog.length));
  if(count===1)return enrichCatalogWebuiSourceFacts(catalog,qbRoot);
  const buckets=Array.from({length:count},()=>[]);
  catalog.forEach((profile,index)=>buckets[index%count].push(profile));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-qb-locale-'));
  try{
    const tasks=buckets.map((profiles,index)=>{
      const input=path.join(temp,`input-${index}.json`);
      const output=path.join(temp,`output-${index}.json`);
      fs.writeFileSync(input,JSON.stringify(profiles,null,2)+'\n','utf8');
      return{output,promise:runWorker(script,qbRoot,input,output)};
    });
    await Promise.all(tasks.map(item=>item.promise));
    const shards=tasks.map(item=>JSON.parse(fs.readFileSync(item.output,'utf8')));
    return mergeParallelWebuiSourceFacts(catalog,shards);
  }finally{
    fs.rmSync(temp,{recursive:true,force:true});
  }
}

const scriptPath=fileURLToPath(import.meta.url);
const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(scriptPath);
if(isMain){
  try{
    const argv=process.argv.slice(2);
    const serialIndex=argv.indexOf('--serial');
    const serial=serialIndex>=0;
    if(serial)argv.splice(serialIndex,1);
    const qbRoot=path.resolve(argv[0]||process.env.QB_UPSTREAM_DIR||'');
    const input=path.resolve(argv[1]||'');
    const output=path.resolve(argv[2]||argv[1]||'');
    if(!qbRoot||!fs.existsSync(qbRoot)||!input||!fs.existsSync(input))throw new Error('Usage: node tools/qb-locale-source.mjs <qBittorrent-clone> <catalog.json> [output.json] [--serial]');
    const catalog=JSON.parse(fs.readFileSync(input,'utf8'));
    const available=typeof os.availableParallelism==='function'?os.availableParallelism():os.cpus().length;
    const requested=Number.parseInt(process.env.WEIGG_QB_LOCALE_WORKERS||'',10);
    const workers=serial?1:Math.max(1,Math.min(Number.isFinite(requested)&&requested>0?requested:available,8,catalog.length));
    const enriched=workers>1?await enrichCatalogWebuiSourceFactsParallel(catalog,qbRoot,workers,scriptPath):enrichCatalogWebuiSourceFacts(catalog,qbRoot);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(enriched,null,2)+'\n','utf8');
    const resolved=enriched.filter(item=>Array.isArray(item.webuiLocales)&&item.webuiLocales.length).length;
    const mapped=enriched.reduce((sum,item)=>sum+(Number(item.settingsUiMappedPreferences)||0),0);
    const total=enriched.reduce((sum,item)=>sum+(Number(item.settingsUiTotalPreferences)||0),0);
    console.log(`Enriched WebUI locale facts for ${resolved}/${enriched.length} qB release profiles; source-proven Settings labels ${mapped}/${total}; workers=${workers}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

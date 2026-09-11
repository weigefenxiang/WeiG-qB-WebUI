#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function unique(values){return [...new Set((values||[]).map(value=>String(value||'').trim()).filter(Boolean))];}
function localeValues(profile){return unique((profile?.webuiLocales||[]).map(item=>typeof item==='string'?item:item?.value));}
function refKey(context,source){return `${String(context||'')}\u0000${String(source||'')}`;}
function refId(context,source){return crypto.createHash('sha256').update(refKey(context,source)).digest('hex').slice(0,24);}
function isPlainEnglish(locale){return String(locale||'').trim().replace('-','_').toLowerCase()==='en';}
function encodeField(value){return encodeURIComponent(String(value??''));}
function decodeTranslation(value){if(Array.isArray(value))return null;const text=String(value??'');return text||null;}
function collectSets(catalog){const out={};for(const profile of catalog||[])Object.assign(out,profile?.settingsTranslationSets||{});return out;}
function exactBehavior(evidence,profile){const hit=(evidence?.profiles||[]).find(item=>String(item?.qbVersion||'')===String(profile?.qbVersion||''));if(!hit||String(hit.sourceSha||'')!==String(profile?.sourceSha||''))return null;const family=evidence?.families?.[hit.family];return family?{family:hit.family,...family}:null;}
function messageMap(set){const out=new Map();for(const item of set?.messages||[]){if(!item?.context||!item?.source)continue;const value=decodeTranslation(item.translation);if(value!==null)out.set(refKey(item.context,item.source),value);}return out;}
function refsForProfile(profile){const out=[];const seen=new Set();for(const entry of Object.values(profile?.settingsUi||{})){for(const role of ['title','description']){const ref=entry?.[role];if(!ref?.source||!ref?.context)continue;const identity=refKey(ref.context,ref.source);if(!seen.has(identity)){seen.add(identity);out.push({context:String(ref.context),source:String(ref.source)});}}}return out;}
function translationSet(profile,locale,allSets){const hash=profile?.settingsTranslations?.[locale];return hash?allSets[hash]||null:null;}
function addVote(votes,locale,identity,value,profileIndex){if(!value)return;let byRef=votes.get(locale);if(!byRef){byRef=new Map();votes.set(locale,byRef);}let byValue=byRef.get(identity);if(!byValue){byValue=new Map();byRef.set(identity,byValue);}const item=byValue.get(value)||{count:0,lastProfileIndex:-1};item.count+=1;item.lastProfileIndex=Math.max(item.lastProfileIndex,profileIndex);byValue.set(value,item);}
function chooseCanonical(votes){const locales=new Map();for(const [locale,byRef] of votes){const chosen=new Map();for(const [identity,byValue] of byRef){const ranked=[...byValue.entries()].sort((a,b)=>b[1].count-a[1].count||b[1].lastProfileIndex-a[1].lastProfileIndex||a[0].localeCompare(b[0]));chosen.set(identity,ranked[0][0]);}locales.set(locale,chosen);}return locales;}
function expectedOutput(ref,exactMap){return exactMap.get(refKey(ref.context,ref.source))||ref.source;}
function dedicatedLocaleCompatible(profile,locale,behavior,canonical,allSets){if(isPlainEnglish(locale))return true;const exact=messageMap(translationSet(profile,locale,allSets));const refs=refsForProfile(profile);if(!refs.length)return false;for(const ref of refs){const identity=refKey(ref.context,ref.source);const exactValue=expectedOutput(ref,exact);const canonicalValue=canonical?.get(identity)||ref.source;if(behavior.missingTranslationFallback==='none-explicit'&&!exact.has(identity))return false;if(canonicalValue!==exactValue)return false;}return true;}
function xmlEscape(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}

export function buildNativeSettingsBundle(catalog,behaviorEvidence){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Native qB Settings bundle requires a non-empty enriched catalog.');
  if(!behaviorEvidence||behaviorEvidence.schemaVersion!==1)throw new Error('Native qB Settings bundle requires translator behavior evidence schemaVersion 1.');
  const allSets=collectSets(catalog);
  const votes=new Map();
  catalog.forEach((profile,profileIndex)=>{
    for(const locale of localeValues(profile)){
      const set=translationSet(profile,locale,allSets);
      for(const item of set?.messages||[]){const value=decodeTranslation(item.translation);if(value!==null)addVote(votes,locale,refKey(item.context,item.source),value,profileIndex);}
    }
  });
  const canonical=chooseCanonical(votes);
  const profiles=[];
  for(const profile of catalog){
    const qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim();
    if(!qbVersion||!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error('Each native Settings profile requires exact qbVersion + sourceSha.');
    const behavior=exactBehavior(behaviorEvidence,profile);
    if(!behavior)throw new Error(`${qbVersion}: translator behavior evidence does not match ${sourceSha}.`);
    const refs=refsForProfile(profile),nativeLocales=[],bridgeLocales=[];
    for(const locale of localeValues(profile)){
      let native=false;
      if(refs.length&&behavior.altWebuiTranslation===true){
        native=behavior.family==='qapp-native'||dedicatedLocaleCompatible(profile,locale,behavior,canonical.get(locale),allSets);
      }
      (native?nativeLocales:bridgeLocales).push(locale);
    }
    profiles.push({qbVersion,sourceSha,family:behavior.family,nativeLocales,bridgeLocales,mappedPreferences:Object.keys(profile?.settingsUi||{}).length});
  }
  const localeMessages={};
  for(const [locale,byRef] of canonical){
    if(isPlainEnglish(locale))continue;
    const messages=[];
    for(const [identity,translation] of byRef){
      const split=identity.indexOf('\u0000');
      const context=identity.slice(0,split),source=identity.slice(split+1);
      if(translation===source)continue;
      messages.push({context,source,translation});
    }
    messages.sort((a,b)=>refKey(a.context,a.source).localeCompare(refKey(b.context,b.source)));
    if(messages.length)localeMessages[locale]=messages;
  }
  return{schemaVersion:1,source:'qB-official-source-context+official-translation-union',profileCount:profiles.length,profiles,localeMessages};
}

export function renderNativeSettingsRegistry(catalog){
  if(!Array.isArray(catalog))throw new Error('Native Settings registry requires a catalog array.');
  const refs=new Map(),profileLines=[];
  for(const profile of catalog){
    const sourceSha=String(profile?.sourceSha||'');
    if(!/^[0-9a-f]{40}$/.test(sourceSha))continue;
    for(const [key,entry] of Object.entries(profile?.settingsUi||{})){
      const ids={};
      for(const role of ['title','description']){
        const ref=entry?.[role];
        if(!ref?.source||!ref?.context)continue;
        const id=refId(ref.context,ref.source),identity=refKey(ref.context,ref.source);
        const previous=refs.get(id);
        if(previous&&previous.identity!==identity)throw new Error(`Native Settings ref hash collision ${id}.`);
        refs.set(id,{id,identity,context:String(ref.context),source:String(ref.source)});ids[role]=id;
      }
      if(!ids.title)continue;
      profileLines.push(`@@WEIGG_PROFILE\t${sourceSha}\t${encodeField(key)}\t${encodeField(entry?.controlId||'')}\t${ids.title}\t${ids.description||'-'}`);
    }
  }
  const lines=['# WeiG qB Settings native QBT_TR registry v1',...profileLines.sort()];
  for(const item of [...refs.values()].sort((a,b)=>a.id.localeCompare(b.id))){
    lines.push(`@@WEIGG_TEXT\t${item.id}`);
    lines.push(`QBT_TR(${item.source})QBT_TR[CONTEXT=${item.context}]`);
    lines.push('@@WEIGG_END');
  }
  return `${lines.join('\n')}\n`;
}

export function renderLocaleTs(locale,messages){
  const byContext=new Map();
  for(const item of messages||[]){if(!item?.context||!item?.source||!item?.translation)continue;const list=byContext.get(item.context)||[];list.push(item);byContext.set(item.context,list);}
  const lines=['<?xml version="1.0" encoding="utf-8"?>','<!DOCTYPE TS>',`<TS version="2.1" language="${xmlEscape(locale)}">`];
  for(const context of [...byContext.keys()].sort()){
    lines.push('<context>',`<name>${xmlEscape(context)}</name>`);
    for(const item of byContext.get(context).sort((a,b)=>a.source.localeCompare(b.source))){lines.push('<message>',`<source>${xmlEscape(item.source)}</source>`,`<translation>${xmlEscape(item.translation)}</translation>`,'</message>');}
    lines.push('</context>');
  }
  lines.push('</TS>','');
  return lines.join('\n');
}

export function writeNativeSettingsArtifacts(catalog,behaviorEvidence,{registryPath,qmSourceDir}={}){
  const bundle=buildNativeSettingsBundle(catalog,behaviorEvidence);
  if(registryPath){fs.mkdirSync(path.dirname(registryPath),{recursive:true});fs.writeFileSync(registryPath,renderNativeSettingsRegistry(catalog),'utf8');}
  if(qmSourceDir){fs.rmSync(qmSourceDir,{recursive:true,force:true});fs.mkdirSync(qmSourceDir,{recursive:true});for(const [locale,messages] of Object.entries(bundle.localeMessages))fs.writeFileSync(path.join(qmSourceDir,`webui_${locale}.ts`),renderLocaleTs(locale,messages),'utf8');}
  return bundle;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const catalogPath=path.resolve(process.argv[2]||'');
    const behaviorPath=path.resolve(process.argv[3]||'tools/data/qb-translator-behavior-lkg.json');
    const registryPath=path.resolve(process.argv[4]||'qb-settings-native.txt');
    const qmSourceDir=path.resolve(process.argv[5]||'qb-settings-qm-src');
    if(!catalogPath||!fs.existsSync(catalogPath)||!fs.existsSync(behaviorPath))throw new Error('Usage: node tools/qb-settings-native-bundle.mjs <enriched-catalog.json> [behavior.json] [registry.txt] [qm-source-dir]');
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),behavior=JSON.parse(fs.readFileSync(behaviorPath,'utf8'));
    const bundle=writeNativeSettingsArtifacts(catalog,behavior,{registryPath,qmSourceDir});
    const native=bundle.profiles.reduce((sum,item)=>sum+item.nativeLocales.length,0),bridge=bundle.profiles.reduce((sum,item)=>sum+item.bridgeLocales.length,0);
    console.log(`Built qB Settings native bundle: ${bundle.profileCount} profiles, ${Object.keys(bundle.localeMessages).length} QM locale sources, native locale routes ${native}, bridge locale routes ${bridge}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

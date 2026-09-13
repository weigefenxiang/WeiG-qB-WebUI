#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const QM_MAGIC=Buffer.from([0x3c,0xb8,0x64,0x18,0xca,0xef,0x9c,0x95,0xcd,0x21,0x1c,0xbf,0x60,0xa1,0xbd,0xdd]);
const QM_HASHES=0x42,QM_MESSAGES=0x69;
const TAG_END=1,TAG_TRANSLATION=3,TAG_SOURCE=6,TAG_CONTEXT=7,TAG_COMMENT=8;
function unique(values){return [...new Set((values||[]).map(value=>String(value||'').trim()).filter(Boolean))];}
function localeValues(profile){return unique((profile?.webuiLocales||[]).map(item=>typeof item==='string'?item:item?.value));}
function refKey(context,source){return `${String(context||'')}\u0000${String(source||'')}`;}
function refId(context,source){return crypto.createHash('sha256').update(refKey(context,source)).digest('hex').slice(0,24);}
function isPlainEnglish(locale){return String(locale||'').trim().replace('-','_').toLowerCase()==='en';}
function encodeField(value){return encodeURIComponent(String(value??''));}
function qbtTranslation(value){if(Array.isArray(value))return value.length?String(value[0]):null;const text=String(value??'');return text||null;}
function collectSets(catalog){const out={};for(const profile of catalog||[])Object.assign(out,profile?.settingsTranslationSets||{});return out;}
function exactBehavior(evidence,profile){const hit=(evidence?.profiles||[]).find(item=>String(item?.qbVersion||'')===String(profile?.qbVersion||''));if(!hit||String(hit.sourceSha||'')!==String(profile?.sourceSha||''))return null;const family=evidence?.families?.[hit.family];return family?{family:hit.family,...family}:null;}
function messageMap(set){const out=new Map();for(const item of set?.messages||[]){if(!item?.context||!item?.source)continue;const value=qbtTranslation(item.translation);if(value!==null)out.set(refKey(item.context,item.source),value);}return out;}
function refsForProfile(profile){const out=[];const seen=new Set();const add=(ref)=>{if(!ref?.source||!ref?.context)return;const identity=refKey(ref.context,ref.source);if(!seen.has(identity)){seen.add(identity);out.push({context:String(ref.context),source:String(ref.source)});}};for(const entry of Object.values(profile?.settingsUi||{}))for(const role of ['title','description'])add(entry?.[role]);for(const ref of Object.values(profile?.qbOwnedUi||{}))add(ref);return out;}
function translationSet(profile,locale,allSets){const hash=profile?.settingsTranslations?.[locale];return hash?allSets[hash]||null:null;}
function assertRecoveryUnion(union){
  if(!union||union.schemaVersion!==1||union.source!=='qb-official-ts-deterministic-recovery-union'||!union.locales||typeof union.locales!=='object')throw new Error('Native qB Settings bundle requires the certified deterministic recovery union.');
  for(const [locale,messages] of Object.entries(union.locales)){
    if(!locale||!Array.isArray(messages))throw new Error('Native qB recovery union contains an invalid locale payload.');
    const seen=new Set();
    for(const item of messages){
      if(!item?.context||!item?.source)throw new Error(`${locale}: recovery union message requires context + source.`);
      const identity=refKey(item.context,item.source);if(seen.has(identity))throw new Error(`${locale}: duplicate recovery union message ${item.context}/${item.source}.`);seen.add(identity);
      if(item.numerus===true){if(!Array.isArray(item.translation)||!item.translation.length||item.translation.some(value=>!String(value||'').trim()))throw new Error(`${locale}: recovery numerus message is invalid.`);}
      else if(Array.isArray(item.translation)||!String(item.translation||'').trim())throw new Error(`${locale}: recovery scalar message is invalid.`);
    }
  }
  return union;
}
function recoveryLocaleMap(union,locale){return messageMap({messages:union?.locales?.[locale]||[]});}
function expectedOutput(ref,exactMap){return exactMap.get(refKey(ref.context,ref.source))||ref.source;}
function dedicatedLocaleCompatible(profile,locale,behavior,recoveryMap,allSets){if(isPlainEnglish(locale))return true;const exact=messageMap(translationSet(profile,locale,allSets));const refs=refsForProfile(profile);if(!refs.length)return false;for(const ref of refs){const identity=refKey(ref.context,ref.source);const exactValue=expectedOutput(ref,exact);const recoveryValue=recoveryMap.get(identity)||ref.source;if(behavior.missingTranslationFallback==='none-explicit'&&!exact.has(identity))return false;if(recoveryValue!==exactValue)return false;}return true;}
function xmlEscape(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function u32(value){const out=Buffer.allocUnsafe(4);out.writeUInt32BE(value>>>0);return out;}
function qByteArray(value){const data=Buffer.from(String(value??''),'utf8');return Buffer.concat([u32(data.length),data]);}
function qString(value){const data=Buffer.from(String(value??''),'utf16le');data.swap16();return Buffer.concat([u32(data.length),data]);}
function elfHash(value){const data=Buffer.isBuffer(value)?value:Buffer.from(String(value??''),'utf8');let h=0;for(const byte of data){h=((h<<4)+byte)>>>0;const g=h&0xf0000000;if(g)h=(h^(g>>>24))>>>0;h=(h&(~g))>>>0;}return h||1;}
function qmBlock(tag,data){return Buffer.concat([Buffer.from([tag]),u32(data.length),data]);}
function translationForms(item){if(Array.isArray(item?.translation))return item.translation.map(String);const value=String(item?.translation??'');return value?[value]:[];}
function qmMessage(item){const forms=translationForms(item);return Buffer.concat([...forms.flatMap(value=>[Buffer.from([TAG_TRANSLATION]),qString(value)]),Buffer.from([TAG_COMMENT]),qByteArray(''),Buffer.from([TAG_SOURCE]),qByteArray(item.source),Buffer.from([TAG_CONTEXT]),qByteArray(item.context),Buffer.from([TAG_END])]);}

export function buildNativeSettingsBundle(catalog,behaviorEvidence,{recoveryUnion}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Native qB Settings bundle requires a non-empty enriched catalog.');
  if(!behaviorEvidence||behaviorEvidence.schemaVersion!==1)throw new Error('Native qB Settings bundle requires translator behavior evidence schemaVersion 1.');
  const union=assertRecoveryUnion(recoveryUnion);
  const allSets=collectSets(catalog);
  const profiles=[];
  for(const profile of catalog){
    const qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim();
    if(!qbVersion||!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error('Each native Settings profile requires exact qbVersion + sourceSha.');
    const behavior=exactBehavior(behaviorEvidence,profile);
    if(!behavior)throw new Error(`${qbVersion}: translator behavior evidence does not match ${sourceSha}.`);
    const refs=refsForProfile(profile),nativeLocales=[],bridgeLocales=[];
    if(refs.length){
      for(const locale of localeValues(profile)){
        let native=false;
        if(behavior.altWebuiTranslation===true){
          native=behavior.family==='qapp-native'||dedicatedLocaleCompatible(profile,locale,behavior,recoveryLocaleMap(union,locale),allSets);
        }
        (native?nativeLocales:bridgeLocales).push(locale);
      }
    }
    profiles.push({qbVersion,sourceSha,family:behavior.family,nativeLocales,bridgeLocales,mappedPreferences:Object.keys(profile?.settingsUi||{}).length,mappedUi:Object.keys(profile?.qbOwnedUi||{}).length});
  }
  const localeMessages={};
  for(const [locale,messages] of Object.entries(union.locales)){
    if(isPlainEnglish(locale)||!messages.length)continue;
    localeMessages[locale]=messages.map(item=>({context:String(item.context),source:String(item.source),translation:Array.isArray(item.translation)?item.translation.map(String):String(item.translation),numerus:item.numerus===true}));
  }
  return{schemaVersion:2,source:'qB-official-source-context+deterministic-full-recovery-union',profileCount:profiles.length,profiles,localeMessages};
}

export function renderNativeSettingsRegistry(catalog){
  if(!Array.isArray(catalog))throw new Error('Native Settings registry requires a catalog array.');
  const refs=new Map(),profileLines=[],uiLines=[];
  const remember=(ref)=>{if(!ref?.source||!ref?.context)return null;const id=refId(ref.context,ref.source),identity=refKey(ref.context,ref.source),previous=refs.get(id);if(previous&&previous.identity!==identity)throw new Error(`Native Settings ref hash collision ${id}.`);refs.set(id,{id,identity,context:String(ref.context),source:String(ref.source)});return id;};
  for(const profile of catalog){
    const sourceSha=String(profile?.sourceSha||'');
    if(!/^[0-9a-f]{40}$/.test(sourceSha))continue;
    for(const [key,entry] of Object.entries(profile?.settingsUi||{})){
      const ids={};
      for(const role of ['title','description']){const id=remember(entry?.[role]);if(id)ids[role]=id;}
      if(!ids.title)continue;
      profileLines.push(`@@WEIGG_PROFILE\t${sourceSha}\t${encodeField(key)}\t${encodeField(entry?.controlId||'')}\t${ids.title}\t${ids.description||'-'}`);
    }
    for(const [key,ref] of Object.entries(profile?.qbOwnedUi||{})){
      const id=remember(ref);if(id)uiLines.push(`@@WEIGG_UI\t${sourceSha}\t${encodeField(key)}\t${id}`);
    }
  }
  const lines=['# WeiG qB Settings native QBT_TR registry v2',...profileLines.sort(),...uiLines.sort()];
  for(const item of [...refs.values()].sort((a,b)=>a.id.localeCompare(b.id))){
    lines.push(`@@WEIGG_TEXT\t${item.id}`);
    lines.push(`QBT_TR(${item.source})QBT_TR[CONTEXT=${item.context}]`);
    lines.push('@@WEIGG_END');
  }
  return `${lines.join('\n')}\n`;
}

export function renderLocaleTs(locale,messages){
  const byContext=new Map();
  for(const item of messages||[]){if(!item?.context||!item?.source||!translationForms(item).length)continue;const list=byContext.get(item.context)||[];list.push(item);byContext.set(item.context,list);}
  const lines=['<?xml version="1.0" encoding="utf-8"?>','<!DOCTYPE TS>',`<TS version="2.1" language="${xmlEscape(locale)}">`];
  for(const context of [...byContext.keys()].sort()){
    lines.push('<context>',`<name>${xmlEscape(context)}</name>`);
    for(const item of byContext.get(context).sort((a,b)=>a.source.localeCompare(b.source))){
      const forms=translationForms(item);
      if(item.numerus===true||forms.length>1)lines.push('<message numerus="yes">',`<source>${xmlEscape(item.source)}</source>`,'<translation>',...forms.map(value=>`<numerusform>${xmlEscape(value)}</numerusform>`),'</translation>','</message>');
      else lines.push('<message>',`<source>${xmlEscape(item.source)}</source>`,`<translation>${xmlEscape(forms[0])}</translation>`,'</message>');
    }
    lines.push('</context>');
  }
  lines.push('</TS>','');
  return lines.join('\n');
}

export function renderLocaleQm(messages){
  const items=(messages||[]).filter(item=>item?.context&&item?.source&&translationForms(item).length).map(item=>({context:String(item.context),source:String(item.source),translation:Array.isArray(item.translation)?item.translation.map(String):String(item.translation),numerus:item.numerus===true}));
  const messageParts=[],offsets=[];let offset=0;
  for(const item of items){const record=qmMessage(item);messageParts.push(record);offsets.push({hash:elfHash(Buffer.from(item.source,'utf8')),offset});offset+=record.length;}
  offsets.sort((a,b)=>a.hash-b.hash||a.offset-b.offset);
  const hashData=Buffer.concat(offsets.flatMap(item=>[u32(item.hash),u32(item.offset)]));
  const messageData=Buffer.concat(messageParts);
  return Buffer.concat([QM_MAGIC,qmBlock(QM_HASHES,hashData),qmBlock(QM_MESSAGES,messageData)]);
}

export function writeNativeSettingsArtifacts(catalog,behaviorEvidence,{registryPath,qmSourceDir,qmOutputDir,recoveryUnion}={}){
  const bundle=buildNativeSettingsBundle(catalog,behaviorEvidence,{recoveryUnion});
  if(registryPath){fs.mkdirSync(path.dirname(registryPath),{recursive:true});fs.writeFileSync(registryPath,renderNativeSettingsRegistry(catalog),'utf8');}
  if(qmSourceDir){fs.rmSync(qmSourceDir,{recursive:true,force:true});fs.mkdirSync(qmSourceDir,{recursive:true});for(const [locale,messages] of Object.entries(bundle.localeMessages))fs.writeFileSync(path.join(qmSourceDir,`webui_${locale}.ts`),renderLocaleTs(locale,messages),'utf8');}
  if(qmOutputDir){fs.rmSync(qmOutputDir,{recursive:true,force:true});fs.mkdirSync(qmOutputDir,{recursive:true});for(const [locale,messages] of Object.entries(bundle.localeMessages))fs.writeFileSync(path.join(qmOutputDir,`webui_${locale}.qm`),renderLocaleQm(messages));}
  return bundle;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const catalogPath=path.resolve(process.argv[2]||'');
    const behaviorPath=path.resolve(process.argv[3]||'tools/data/qb-translator-behavior-lkg.json');
    const registryPath=path.resolve(process.argv[4]||'qb-settings-native.txt');
    const qmSourceDir=path.resolve(process.argv[5]||'qb-settings-qm-src');
    const qmOutputDir=path.resolve(process.argv[6]||'qb-settings-qm');
    const settingsLkgArg=process.argv.find(value=>value.startsWith('--settings-lkg='));
    const settingsLkgPath=settingsLkgArg?path.resolve(settingsLkgArg.slice('--settings-lkg='.length)):'';
    if(!catalogPath||!fs.existsSync(catalogPath)||!fs.existsSync(behaviorPath)||!settingsLkgPath||!fs.existsSync(settingsLkgPath))throw new Error('Usage: node tools/qb-settings-native-bundle.mjs <enriched-catalog.json> [behavior.json] [registry.txt] [qm-source-dir] [qm-output-dir] --settings-lkg=path');
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),behavior=JSON.parse(fs.readFileSync(behaviorPath,'utf8')),settingsLkg=JSON.parse(fs.readFileSync(settingsLkgPath,'utf8'));
    const bundle=writeNativeSettingsArtifacts(catalog,behavior,{registryPath,qmSourceDir,qmOutputDir,recoveryUnion:settingsLkg?.recovery?.union});
    const native=bundle.profiles.reduce((sum,item)=>sum+item.nativeLocales.length,0),bridge=bundle.profiles.reduce((sum,item)=>sum+item.bridgeLocales.length,0),ui=bundle.profiles.reduce((sum,item)=>sum+item.mappedUi,0);
    console.log(`Built qB Settings native bundle: ${bundle.profileCount} profiles, ${ui} qB-owned UI bindings, ${Object.keys(bundle.localeMessages).length} full recovery QM assets, native locale routes ${native}, bridge locale routes ${bridge}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

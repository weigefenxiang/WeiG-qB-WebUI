#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalQbDisplayText,canonicalQbRef,qbSourceRefKey} from './qb-source-text.mjs';
import {validateQbNativeQmRecoveryUnion} from './qb-native-qm-recovery.mjs';

const QM_MAGIC=Buffer.from([0x3c,0xb8,0x64,0x18,0xca,0xef,0x9c,0x95,0xcd,0x21,0x1c,0xbf,0x60,0xa1,0xbd,0xdd]);
const QM_HASHES=0x42,QM_MESSAGES=0x69;
const TAG_END=1,TAG_TRANSLATION=3,TAG_SOURCE=6,TAG_CONTEXT=7,TAG_COMMENT=8;
function unique(values){return [...new Set((values||[]).map(value=>String(value||'').trim()).filter(Boolean))];}
function localeValues(profile){return unique((profile?.webuiLocales||[]).map(item=>typeof item==='string'?item:item?.value));}
const refKey=qbSourceRefKey;
function refId(context,source){return crypto.createHash('sha256').update(refKey(context,source)).digest('hex').slice(0,24);}
function contentId(prefix,value){return `${prefix}${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20)}`;}
function isPlainEnglish(locale){return String(locale||'').trim().replace('-','_').toLowerCase()==='en';}
function encodeField(value){return encodeURIComponent(String(value??''));}
function qbtTranslation(value){if(Array.isArray(value))return value.length?canonicalQbDisplayText(value[0]):null;const text=canonicalQbDisplayText(value);return text||null;}
function collectSets(catalog){const out={};for(const profile of catalog||[])Object.assign(out,profile?.settingsTranslationSets||{});return out;}
function exactBehavior(evidence,profile){const hit=(evidence?.profiles||[]).find(item=>String(item?.qbVersion||'')===String(profile?.qbVersion||''));if(!hit||String(hit.sourceSha||'')!==String(profile?.sourceSha||''))return null;const family=evidence?.families?.[hit.family];return family?{family:hit.family,...family}:null;}
function messageMap(set){const out=new Map();for(const item of set?.messages||[]){if(!item?.context||!item?.source)continue;const value=qbtTranslation(item.translation);if(value!==null)out.set(refKey(item.context,item.source),value);}return out;}
function refsForProfile(profile){const out=[];const seen=new Set();const add=(ref)=>{if(!ref?.source||!ref?.context)return;const identity=refKey(ref.context,ref.source);if(!seen.has(identity)){seen.add(identity);out.push({context:String(ref.context),source:String(ref.source)});}};for(const entry of Object.values(profile?.settingsUi||{}))for(const role of ['title','description'])add(entry?.[role]);for(const ref of Object.values(profile?.qbOwnedUi||{}))add(ref);return out;}
function translationSet(profile,locale,allSets){const hash=profile?.settingsTranslations?.[locale];return hash?allSets[hash]||null:null;}
function assertRecoveryUnion(union){return validateQbNativeQmRecoveryUnion(union);}
function recoveryLocaleMap(union,locale){return new Map((union?.locales?.[locale]||[]).map(item=>[refKey(item.context,item.source),item]));}
function expectedOutput(ref,exactMap){return exactMap.get(refKey(ref.context,ref.source))||ref.source;}
function dedicatedLocaleCompatible(profile,locale,behavior,recoveryMap,allSets){if(isPlainEnglish(locale))return true;const exact=messageMap(translationSet(profile,locale,allSets));const refs=refsForProfile(profile);if(!refs.length)return false;for(const ref of refs){const identity=refKey(ref.context,ref.source);const exactValue=expectedOutput(ref,exact);const recoveryItem=recoveryMap.get(identity);const recoveryValue=recoveryItem?qbtTranslation(recoveryItem.translation):ref.source;if(behavior.missingTranslationFallback==='none-explicit'&&!exact.has(identity))return false;if(recoveryValue!==exactValue)return false;}return true;}
function canonicalBinding(profile,rememberRef){
  const preferences={};
  for(const key of Object.keys(profile?.settingsUi||{}).sort()){
    const entry=profile.settingsUi[key]||{},title=rememberRef(entry.title),description=rememberRef(entry.description);
    if(!title)continue;
    preferences[key]={title,description:description||null,controlId:String(entry.controlId||'')||null};
  }
  const ui={};
  for(const key of Object.keys(profile?.qbOwnedUi||{}).sort()){
    const id=rememberRef(profile.qbOwnedUi[key]);if(id)ui[key]=id;
  }
  return{preferences,ui};
}
function canonicalBridgeSet(profile,locale,allSets,rememberRef){
  const exact=messageMap(translationSet(profile,locale,allSets)),out={};
  for(const ref of refsForProfile(profile)){
    const id=rememberRef(ref),value=exact.get(refKey(ref.context,ref.source));
    if(id&&value!==undefined&&String(value)!==String(ref.source))out[id]=String(value);
  }
  return out;
}
function stableObject(value){if(Array.isArray(value))return value.map(stableObject);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=stableObject(value[key]);return out;}return value;}
function sameLocale(a,b){const clean=value=>String(value||'').trim().replace(/_/g,'-').toLowerCase();return clean(a)===clean(b);}
function xmlEscape(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');}
function u32(value){const out=Buffer.allocUnsafe(4);out.writeUInt32BE(value>>>0);return out;}
function qByteArray(value){const data=Buffer.from(String(value??''),'utf8');return Buffer.concat([u32(data.length),data]);}
function qString(value){const data=Buffer.from(String(value??''),'utf16le');data.swap16();return Buffer.concat([u32(data.length),data]);}
function elfHash(value){const data=Buffer.isBuffer(value)?value:Buffer.from(String(value??''),'utf8');let h=0;for(const byte of data){h=((h<<4)+byte)>>>0;const g=h&0xf0000000;if(g)h=(h^(g>>>24))>>>0;h=(h&(~g))>>>0;}return h||1;}
function qmBlock(tag,data){return Buffer.concat([Buffer.from([tag]),u32(data.length),data]);}
function translationForms(item){if(Array.isArray(item?.translation))return item.translation.map(canonicalQbDisplayText).filter(Boolean);const value=canonicalQbDisplayText(item?.translation);return value?[value]:[];}
function qmMessage(item){const forms=translationForms(item);return Buffer.concat([...forms.flatMap(value=>[Buffer.from([TAG_TRANSLATION]),qString(value)]),Buffer.from([TAG_COMMENT]),qByteArray(''),Buffer.from([TAG_SOURCE]),qByteArray(item.source),Buffer.from([TAG_CONTEXT]),qByteArray(item.context),Buffer.from([TAG_END])]);}

export function buildNativeSettingsBundle(catalog,behaviorEvidence,{recoveryUnion}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('qB runtime copy bundle requires a non-empty enriched catalog.');
  if(!behaviorEvidence||behaviorEvidence.schemaVersion!==1)throw new Error('qB runtime copy bundle requires translator behavior evidence schemaVersion 1.');
  const union=assertRecoveryUnion(recoveryUnion),allSets=collectSets(catalog),refs=new Map(),bindings={},bridgeSets={},profiles=[];
  const rememberRef=(ref)=>{const canonical=canonicalQbRef(ref);if(!canonical)return null;const id=refId(canonical.context,canonical.source),identity=refKey(canonical.context,canonical.source),previous=refs.get(id);if(previous&&previous.identity!==identity)throw new Error(`qB-owned ref hash collision ${id}.`);if(!previous)refs.set(id,{id,identity,context:canonical.context,source:canonical.source});return id;};
  const requiredQmRefs=new Map();
  for(const profile of catalog){
    const qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim();
    if(!qbVersion||!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error('Each qB runtime copy profile requires exact qbVersion + sourceSha.');
    const behavior=exactBehavior(behaviorEvidence,profile);if(!behavior)throw new Error(`${qbVersion}: translator behavior evidence does not match ${sourceSha}.`);
    const binding=canonicalBinding(profile,rememberRef),bindingId=contentId('b',stableObject(binding));if(!bindings[bindingId])bindings[bindingId]=binding;
    const profileRefs=refsForProfile(profile),nativeLocales=[],bridgeLocales=[],bridges={};
    if(profileRefs.length){
      for(const locale of localeValues(profile)){
        let native=false;
        if(behavior.altWebuiTranslation===true)native=behavior.family==='qapp-native'||dedicatedLocaleCompatible(profile,locale,behavior,recoveryLocaleMap(union,locale),allSets);
        if(native){
          nativeLocales.push(locale);
          const activeRoot=behavior.translatorResource&&String(behavior.translatorResource).includes('active-webui-root');
          if(activeRoot&&!isPlainEnglish(locale)){
            const set=requiredQmRefs.get(locale)||new Set();for(const ref of profileRefs)set.add(refKey(ref.context,ref.source));requiredQmRefs.set(locale,set);
          }
        }else{
          bridgeLocales.push(locale);
          const bridge=canonicalBridgeSet(profile,locale,allSets,rememberRef),normalized=stableObject(bridge),setId=contentId('t',normalized);
          if(Object.keys(bridge).length){if(!bridgeSets[setId])bridgeSets[setId]=normalized;bridges[locale]=setId;}else bridges[locale]=null;
        }
      }
    }
    profiles.push({qbVersion,sourceSha,family:behavior.family,bindingId,nativeLocales,bridgeLocales,bridges,mappedPreferences:Object.keys(binding.preferences).length,mappedUi:Object.keys(binding.ui).length});
  }
  const localeMessages={};
  for(const [locale,required] of requiredQmRefs){
    const unionMap=recoveryLocaleMap(union,locale),messages=[];
    for(const identity of [...required].sort()){
      const item=unionMap.get(identity);if(!item)continue;
      messages.push({context:String(item.context),source:String(item.source),translation:Array.isArray(item.translation)?item.translation.map(String):String(item.translation),numerus:item.numerus===true});
    }
    if(messages.length)localeMessages[locale]=messages;
  }
  return{schemaVersion:3,source:'qB-source-context-runtime-copy-ir+minimal-official-qm',profileCount:profiles.length,profiles,refs:Object.fromEntries([...refs.values()].sort((a,b)=>a.id.localeCompare(b.id)).map(item=>[item.id,{context:item.context,source:item.source}])),bindings:stableObject(bindings),bridgeSets:stableObject(bridgeSets),localeMessages};
}

function tokenOrder(a,b){return Number.parseInt(a,36)-Number.parseInt(b,36);}
function compactBridgeTables(bridgeSets,profiles){
  const pairKeys=new Set();
  for(const setId of Object.keys(bridgeSets||{}).sort())for(const ref of Object.keys(bridgeSets[setId]||{}).sort())pairKeys.add(JSON.stringify([ref,String(bridgeSets[setId][ref])]));
  const values={},tokens=new Map(),ordered=[...pairKeys].sort();
  ordered.forEach((key,index)=>{const [ref,value]=JSON.parse(key),token=index.toString(36);tokens.set(key,token);values[token]={ref,value};});
  const fullSets={};
  for(const setId of Object.keys(bridgeSets||{}).sort())fullSets[setId]=Object.keys(bridgeSets[setId]||{}).sort().map(ref=>tokens.get(JSON.stringify([ref,String(bridgeSets[setId][ref])])));
  const sets={},previousByLocale=new Map();
  const fullPlan=setId=>({parent:null,add:[...(fullSets[setId]||[])],remove:[]});
  for(const profile of profiles||[]){
    for(const locale of Object.keys(profile?.bridges||{}).sort()){
      const setId=profile.bridges[locale];
      if(!setId||!fullSets[setId]){previousByLocale.delete(locale);continue;}
      if(!sets[setId]){
        let plan=fullPlan(setId),parent=previousByLocale.get(locale);
        if(parent&&parent!==setId&&sets[parent]&&fullSets[parent]){
          const current=new Set(fullSets[setId]),previous=new Set(fullSets[parent]);
          const add=[...current].filter(token=>!previous.has(token)).sort(tokenOrder),remove=[...previous].filter(token=>!current.has(token)).sort(tokenOrder);
          const fullCost=plan.add.join(',').length,deltaCost=parent.length+add.join(',').length+remove.join(',').length+2;
          if(deltaCost<fullCost)plan={parent,add,remove};
        }
        sets[setId]=plan;
      }
      previousByLocale.set(locale,setId);
    }
  }
  for(const setId of Object.keys(fullSets).sort())if(!sets[setId])sets[setId]=fullPlan(setId);
  return{values,sets};
}

export function renderOwnedCopyRegistry(bundle){
  if(!bundle||bundle.schemaVersion!==3)throw new Error('Owned copy registry requires runtime copy bundle schemaVersion 3.');
  const compact=compactBridgeTables(bundle.bridgeSets,bundle.profiles),lines=['# WeiG qB-owned copy runtime IR v3'];
  for(const profile of [...bundle.profiles].sort((a,b)=>a.sourceSha.localeCompare(b.sourceSha))){
    lines.push(`@@PROFILE\t${profile.sourceSha}\t${encodeField(profile.qbVersion)}\t${encodeField(profile.family)}\t${profile.bindingId}\t${encodeField(profile.nativeLocales.join(','))}\t${encodeField(profile.bridgeLocales.join(','))}`);
    for(const locale of Object.keys(profile.bridges||{}).sort())lines.push(`@@BRIDGE\t${profile.sourceSha}\t${encodeField(locale)}\t${profile.bridges[locale]||'-'}`);
  }
  for(const bindingId of Object.keys(bundle.bindings||{}).sort()){
    const binding=bundle.bindings[bindingId];
    for(const key of Object.keys(binding.preferences||{}).sort()){
      const entry=binding.preferences[key];
      lines.push(`@@PREF\t${bindingId}\t${encodeField(key)}\t${encodeField(entry.controlId||'')}\t${entry.title}\t${entry.description||'-'}`);
    }
    for(const key of Object.keys(binding.ui||{}).sort())lines.push(`@@UI\t${bindingId}\t${encodeField(key)}\t${binding.ui[key]}`);
  }
  for(const token of Object.keys(compact.values).sort(tokenOrder)){const item=compact.values[token];lines.push(`@@VAL\t${token}\t${item.ref}\t${JSON.stringify(item.value)}`);}
  for(const setId of Object.keys(compact.sets).sort()){const set=compact.sets[setId];lines.push(`@@SET\t${setId}\t${set.parent||'-'}\t${set.add.join(',')}\t${set.remove.join(',')}`);}
  for(const id of Object.keys(bundle.refs||{}).sort()){
    const item=bundle.refs[id];lines.push(`@@REF\t${id}\t${encodeField(item.context)}\t${encodeField(item.source)}`);lines.push(`QBT_TR(${item.source})QBT_TR[CONTEXT=${item.context}]`);lines.push('@@END');
  }
  return `${lines.join('\n')}\n`;
}

export function renderLocaleTs(locale,messages){
  const byContext=new Map();
  for(const item of messages||[]){if(!item?.context||!item?.source||!translationForms(item).length)continue;const list=byContext.get(item.context)||[];list.push(item);byContext.set(item.context,list);}
  const lines=['<?xml version="1.0" encoding="utf-8"?>','<!DOCTYPE TS>',`<TS version="2.1" language="${xmlEscape(locale)}">`];
  for(const context of [...byContext.keys()].sort()){
    lines.push('<context>',`<name>${xmlEscape(context)}</name>`);
    for(const item of byContext.get(context).sort((a,b)=>a.source.localeCompare(b.source))){const forms=translationForms(item);if(item.numerus===true||forms.length>1)lines.push('<message numerus="yes">',`<source>${xmlEscape(item.source)}</source>`,'<translation>',...forms.map(value=>`<numerusform>${xmlEscape(value)}</numerusform>`),'</translation>','</message>');else lines.push('<message>',`<source>${xmlEscape(item.source)}</source>`,`<translation>${xmlEscape(forms[0])}</translation>`,'</message>');}
    lines.push('</context>');
  }
  lines.push('</TS>','');return lines.join('\n');
}

export function renderLocaleQm(messages){
  const items=(messages||[]).filter(item=>item?.context&&item?.source&&translationForms(item).length).map(item=>({context:String(item.context),source:String(item.source),translation:Array.isArray(item.translation)?item.translation.map(String):String(item.translation),numerus:item.numerus===true}));
  const messageParts=[],offsets=[];let offset=0;
  for(const item of items){const record=qmMessage(item);messageParts.push(record);offsets.push({hash:elfHash(Buffer.from(item.source,'utf8')),offset});offset+=record.length;}
  offsets.sort((a,b)=>a.hash-b.hash||a.offset-b.offset);const hashData=Buffer.concat(offsets.flatMap(item=>[u32(item.hash),u32(item.offset)])),messageData=Buffer.concat(messageParts);return Buffer.concat([QM_MAGIC,qmBlock(QM_HASHES,hashData),qmBlock(QM_MESSAGES,messageData)]);
}

export function writeNativeSettingsArtifacts(catalog,behaviorEvidence,{registryPath,qmSourceDir,qmOutputDir,recoveryUnion}={}){
  const bundle=buildNativeSettingsBundle(catalog,behaviorEvidence,{recoveryUnion});
  if(registryPath){fs.mkdirSync(path.dirname(registryPath),{recursive:true});fs.writeFileSync(registryPath,renderOwnedCopyRegistry(bundle),'utf8');}
  if(qmSourceDir){fs.rmSync(qmSourceDir,{recursive:true,force:true});fs.mkdirSync(qmSourceDir,{recursive:true});for(const [locale,messages] of Object.entries(bundle.localeMessages))fs.writeFileSync(path.join(qmSourceDir,`webui_${locale}.ts`),renderLocaleTs(locale,messages),'utf8');}
  if(qmOutputDir){fs.rmSync(qmOutputDir,{recursive:true,force:true});fs.mkdirSync(qmOutputDir,{recursive:true});for(const [locale,messages] of Object.entries(bundle.localeMessages))fs.writeFileSync(path.join(qmOutputDir,`webui_${locale}.qm`),renderLocaleQm(messages));}
  return bundle;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const catalogPath=path.resolve(process.argv[2]||''),behaviorPath=path.resolve(process.argv[3]||'tools/data/qb-translator-behavior-lkg.json'),registryPath=path.resolve(process.argv[4]||'qb-settings-native.txt'),qmSourceDir=path.resolve(process.argv[5]||'qb-settings-qm-src'),qmOutputDir=path.resolve(process.argv[6]||'qb-settings-qm'),settingsLkgArg=process.argv.find(value=>value.startsWith('--settings-lkg=')),settingsLkgPath=settingsLkgArg?path.resolve(settingsLkgArg.slice('--settings-lkg='.length)):'';
    if(!catalogPath||!fs.existsSync(catalogPath)||!fs.existsSync(behaviorPath)||!settingsLkgPath||!fs.existsSync(settingsLkgPath))throw new Error('Usage: node tools/qb-settings-native-bundle.mjs <enriched-catalog.json> [behavior.json] [registry.txt] [qm-source-dir] [qm-output-dir] --settings-lkg=path');
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),behavior=JSON.parse(fs.readFileSync(behaviorPath,'utf8')),settingsLkg=JSON.parse(fs.readFileSync(settingsLkgPath,'utf8')),bundle=writeNativeSettingsArtifacts(catalog,behavior,{registryPath,qmSourceDir,qmOutputDir,recoveryUnion:settingsLkg?.recovery?.union});
    const native=bundle.profiles.reduce((sum,item)=>sum+item.nativeLocales.length,0),bridge=bundle.profiles.reduce((sum,item)=>sum+item.bridgeLocales.length,0),ui=bundle.profiles.reduce((sum,item)=>sum+item.mappedUi,0);
    console.log(`Built qB runtime copy bundle: ${bundle.profileCount} profiles, ${ui} qB-owned UI bindings, ${Object.keys(bundle.bindings).length} deduplicated binding sets, ${Object.keys(bundle.bridgeSets).length} compact bridge sets, ${Object.keys(bundle.localeMessages).length} minimal QM assets, native locale routes ${native}, bridge locale routes ${bridge}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

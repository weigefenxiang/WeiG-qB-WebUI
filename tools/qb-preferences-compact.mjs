#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const DESCRIPTOR_FIELDS=['getterPresent','setterPresent','readType','writeType','typeAgreement','writable'];
const CONTROL_FIELDS=['tab','sectionId','order','titleRef','descriptionRef','controlId','semantic','attributes','options','unitRef','staticDisabled','gates'];

function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
function timeline(rows){const out=[];let previous,seen=false;for(const row of rows){const value=row.value;if(!seen||!same(previous,value)){out.push({from:String(row.from),value});previous=value;seen=true;}}return out;}
function exactIdentity(profile){const qbVersion=String(profile?.qbVersion||''),sourceSha=String(profile?.sourceSha||'');if(!qbVersion||!/^[0-9a-f]{40}$/i.test(sourceSha))throw new Error('Preferences compact profile requires exact qbVersion + sourceSha.');return{qbVersion,sourceSha};}
function sourceRefTable(){const refs=[],ids=new Map();const remember=(ref)=>{if(!ref?.source||!ref?.context)return-1;const key=`${ref.context}\u0000${ref.source}`;if(!ids.has(key)){ids.set(key,refs.length);refs.push([String(ref.context),String(ref.source)]);}return ids.get(key);};return{refs,remember};}
function literalOrRef(label,remember){if(label?.source&&label?.context)return['r',remember(label)];if(label&&Object.prototype.hasOwnProperty.call(label,'literal'))return['l',label.literal];return['l',String(label??'')];}
function compactControl(item,remember){if(!item)return null;const control=item.control||{},options=Array.isArray(control.options)&&control.options.length?control.options.map(option=>[option?.value??'',literalOrRef(option?.label,remember)]):0,gates=Array.isArray(item.dependencies?.gates)&&item.dependencies.gates.length?item.dependencies.gates.map(gate=>[String(gate?.controlId||''),String(gate?.preferenceKey||'')]):0;return[String(item.tab||''),String(item.sectionId||''),Number(item.order)||0,remember(item.title),remember(item.description),String(control.id||''),String(control.semantic||''),control.attributes&&Object.keys(control.attributes).length?stable(control.attributes):0,options,remember(control.unit),control.staticDisabled===true?1:0,gates];}
function compactDescriptor(item){const descriptor=item?.descriptor;if(!descriptor)return null;return DESCRIPTOR_FIELDS.map(field=>Object.prototype.hasOwnProperty.call(descriptor,field)?descriptor[field]:null);}
function compactTabs(manifest,remember){return(Array.isArray(manifest?.tabs)?manifest.tabs:[]).map(tab=>[String(tab?.id||''),String(tab?.nativeId||''),remember(tab?.title)]);}
function compactSections(manifest,tabId,remember){const tab=(Array.isArray(manifest?.tabs)?manifest.tabs:[]).find(item=>String(item?.id||'')===String(tabId));if(!tab)return null;return(Array.isArray(tab.sections)?tab.sections:[]).map(section=>[String(section?.id||''),remember(section?.title)]);}

export function compileQbPreferencesCompact(sourceCatalog){
  if(!sourceCatalog||sourceCatalog.schemaVersion!==1||!Array.isArray(sourceCatalog.profiles)||!sourceCatalog.profiles.length)throw new Error('Preferences compact compiler requires source catalog schemaVersion 1.');
  const profiles=sourceCatalog.profiles,identities=profiles.map(exactIdentity),{refs,remember}=sourceRefTable(),tabIds=new Set(),preferenceKeys=new Set();
  for(const profile of profiles){for(const tab of profile?.manifest?.tabs||[])if(tab?.id)tabIds.add(String(tab.id));for(const key of Object.keys(profile?.manifest?.preferences||{}))preferenceKeys.add(String(key));}
  const tabs=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactTabs(profile.manifest,remember)}))),sections={},preferences={},descriptors={};
  for(const tabId of [...tabIds].sort())sections[tabId]=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactSections(profile.manifest,tabId,remember)})));
  for(const key of [...preferenceKeys].sort()){
    preferences[key]=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactControl(profile?.manifest?.preferences?.[key],remember)})));
    descriptors[key]=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactDescriptor(profile?.manifest?.preferences?.[key])})));
  }
  return{schemaVersion:2,source:'qb-upstream-preferences-native-surface-compact',format:{release:['qbVersion','sourceSha'],ref:['context','source'],tab:['id','nativeId','titleRef'],section:['id','titleRef'],preference:CONTROL_FIELDS,descriptor:DESCRIPTOR_FIELDS,option:['value',['kind','refOrLiteral']],gate:['controlId','preferenceKey']},releases:identities.map(item=>[item.qbVersion,item.sourceSha]),refs,tabs,sections,preferences,descriptors};
}

export function expandQbPreferencesCompact(compact,qbVersion){
  if(!compact||compact.schemaVersion!==2)throw new Error('Preferences compact expansion requires schemaVersion 2.');
  const compare=(a,b)=>{const aa=String(a||'0').split('.').map(Number),bb=String(b||'0').split('.').map(Number),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const x=aa[i]||0,y=bb[i]||0;if(x!==y)return x-y;}return 0;};
  const change=(rows)=>{let value=null;for(const row of rows||[]){if(compare(row.from,qbVersion)>0)break;value=row.value;}return value;};
  const ref=(id)=>Number.isInteger(id)&&id>=0&&compact.refs?.[id]?{context:compact.refs[id][0],source:compact.refs[id][1]}:null;
  const tabs=(change(compact.tabs)||[]).map(row=>({id:row[0],nativeId:row[1],title:ref(row[2]),sections:[],preferences:[]})),byTab=new Map(tabs.map(tab=>[tab.id,tab]));
  for(const tab of tabs){tab.sections=(change(compact.sections?.[tab.id])||[]).map((row,index)=>({id:row[0],order:index,title:ref(row[1]),preferences:[]}));}
  const preferences={};
  for(const key of Object.keys(compact.preferences||{})){
    const row=change(compact.preferences[key]);if(!row)continue;const descriptorRow=change(compact.descriptors?.[key]);const options=row[8]===0?[]:(row[8]||[]).map(option=>({value:option[0],label:option[1]?.[0]==='r'?ref(option[1][1]):{literal:option[1]?.[1]}}));
    const item={key,tab:row[0],sectionId:row[1],order:row[2],title:ref(row[3]),description:ref(row[4]),control:{id:row[5],semantic:row[6],attributes:row[7]===0?{}:row[7],options,unit:ref(row[9]),staticDisabled:row[10]===1},dependencies:{gates:row[11]===0?[]:(row[11]||[]).map(gate=>({controlId:gate[0],preferenceKey:gate[1]}))},descriptor:descriptorRow?Object.fromEntries(DESCRIPTOR_FIELDS.map((field,index)=>[field,descriptorRow[index]])):null};
    preferences[key]=item;const tab=byTab.get(item.tab);if(tab){tab.preferences.push(key);const section=tab.sections.find(value=>value.id===item.sectionId);if(section)section.preferences.push(key);}
  }
  for(const tab of tabs){tab.preferences.sort((a,b)=>(preferences[a]?.order||0)-(preferences[b]?.order||0));for(const section of tab.sections)section.preferences.sort((a,b)=>(preferences[a]?.order||0)-(preferences[b]?.order||0));}
  return{tabs,preferences};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){try{const input=path.resolve(process.argv[2]||''),output=path.resolve(process.argv[3]||'');if(!input||!fs.existsSync(input)||!output)throw new Error('Usage: node tools/qb-preferences-compact.mjs <source-catalog.json> <output.json>');const source=JSON.parse(fs.readFileSync(input,'utf8')),result=compileQbPreferencesCompact(source);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result)+'\n','utf8');console.log(`Compiled Preferences compact IR: ${result.releases.length} exact releases, ${result.tabs.length} tab change points, ${Object.keys(result.preferences).length} source-mapped preference identities, ${Buffer.byteLength(JSON.stringify(result))} bytes.`);}catch(error){console.error(error?.message||error);process.exitCode=1;}}

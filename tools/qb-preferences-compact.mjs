#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {admittedCatalogRows,catalogIdentity} from './qb-catalog-identity.mjs';

const DESCRIPTOR_FIELDS=['getterPresent','setterPresent','readType','writeType','typeAgreement','writable'];
const CONTROL_FIELDS=['tab','sectionId','order','titleRef','descriptionRef','controlId','semantic','attributes','options','unitRef','staticDisabled','gates','projection','structured'];

function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;}
function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b));}
function timeline(rows){const out=[];let previous,seen=false;for(const row of rows){const value=row.value;if(!seen||!same(previous,value)){out.push({from:String(row.from),value});previous=value;seen=true;}}return out;}
function exactIdentity(profile){const qbVersion=String(profile?.qbVersion||''),sourceSha=String(profile?.sourceSha||'');if(!qbVersion||!/^[0-9a-f]{40}$/i.test(sourceSha))throw new Error('Preferences compact profile requires exact qbVersion + sourceSha.');return{qbVersion,sourceSha:sourceSha.toLowerCase()};}
function sourceRefTable(){const refs=[],ids=new Map();const remember=(ref)=>{if(!ref?.source||!ref?.context)return-1;const key=`${ref.context}\u0000${ref.source}`;if(!ids.has(key)){ids.set(key,refs.length);refs.push([String(ref.context),String(ref.source)]);}return ids.get(key);};return{refs,remember};}
function literalOrRef(label,remember){if(label?.source&&label?.context)return['r',remember(label)];if(label&&Object.prototype.hasOwnProperty.call(label,'literal'))return['l',label.literal];return['l',String(label??'')];}
function compactControl(item,remember){if(!item)return null;const control=item.control||{},options=Array.isArray(control.options)&&control.options.length?control.options.map(option=>[option?.value??'',literalOrRef(option?.label,remember)]):0,gates=Array.isArray(item.dependencies?.gates)&&item.dependencies.gates.length?item.dependencies.gates.map(gate=>[String(gate?.controlId||''),String(gate?.preferenceKey||'')]):0,projection=item.projection&&typeof item.projection==='object'?stable(item.projection):0,structured=control.structured&&typeof control.structured==='object'?stable(control.structured):0;return[String(item.tab||''),String(item.sectionId||''),Number(item.order)||0,remember(item.title),remember(item.description),String(control.id||''),String(control.semantic||''),control.attributes&&Object.keys(control.attributes).length?stable(control.attributes):0,options,remember(control.unit),control.staticDisabled===true?1:0,gates,projection,structured];}
function compactDescriptor(item){const descriptor=item?.descriptor;if(!descriptor)return null;return DESCRIPTOR_FIELDS.map(field=>Object.prototype.hasOwnProperty.call(descriptor,field)?descriptor[field]:null);}
function compactTabs(manifest,remember){return(Array.isArray(manifest?.tabs)?manifest.tabs:[]).map(tab=>[String(tab?.id||''),String(tab?.nativeId||''),remember(tab?.title)]);}
function compactSections(manifest,tabId,remember){const tab=(Array.isArray(manifest?.tabs)?manifest.tabs:[]).find(item=>String(item?.id||'')===String(tabId));if(!tab)return null;return(Array.isArray(tab.sections)?tab.sections:[]).map(section=>[String(section?.id||''),remember(section?.title)]);}
const GRAPH_ROLES=['preference','auxiliary','gate','helper'];
const GRAPH_SEMANTICS=['text','number','checkbox','select','password','textarea','radio','structured'];
const GRAPH_TEMPLATES=['fieldset','nested-gated-fieldset','single-row','inline-multi-control','inline-multi-helper','control-helper','gated-sentinel','helper-only','content-only'];
const GRAPH_CONTENT_KINDS=['note','help','list','hint'];
const GRAPH_PREDICATES=['truthy','falsy','equals','notEquals','gt','lte','allOf','anyOf','unknown','true','false'];
const GRAPH_ACTIONS=['random-int','source-helper','source-action','unknown'];
function graphStringTable(){const strings=[],ids=new Map();const remember=value=>{const text=String(value??'');if(!text)return 0;if(!ids.has(text)){ids.set(text,strings.length+1);strings.push(text);}return ids.get(text);};return{strings,remember};}
function compactGraphLabel(label,remember){if(!label)return 0;return literalOrRef(label,remember);}
function compactPredicate(predicate,rememberString){
  if(!predicate)return 0;const kind=GRAPH_PREDICATES.indexOf(String(predicate.kind||''));if(kind<0)return[GRAPH_PREDICATES.indexOf('unknown')];
  if(predicate.kind==='truthy'||predicate.kind==='falsy')return[kind,rememberString(predicate.key)];
  if(predicate.kind==='equals'||predicate.kind==='notEquals'||predicate.kind==='gt'||predicate.kind==='lte')return[kind,rememberString(predicate.key),stable(predicate.value)];
  if(predicate.kind==='allOf'||predicate.kind==='anyOf')return[kind,(predicate.items||[]).map(item=>compactPredicate(item,rememberString))];
  return[kind];
}
function compactGraphAction(action,rememberString){
  if(!action)return 0;const kind=GRAPH_ACTIONS.indexOf(String(action.kind||''));if(kind===0)return[kind,rememberString(action.targetControlId),Number(action.min),Number(action.max)];if(kind===1)return[kind,rememberString(action.name)];if(kind===2)return[kind,rememberString(action.owner),rememberString(action.name)];return[GRAPH_ACTIONS.indexOf('unknown')];
}
function compactGraphControl(item,remember,rememberString){
  return[0,rememberString(item?.id),rememberString(item?.preferenceKey),GRAPH_ROLES.indexOf(String(item?.role||'')),GRAPH_SEMANTICS.indexOf(String(item?.semantic||'')),item?.staticDisabled===true?1:0,compactGraphLabel(item?.label,remember),compactGraphLabel(item?.adornment,remember),compactGraphLabel(item?.suffix,remember),compactPredicate(item?.condition,rememberString),item?.dynamicOptions?stable(item.dynamicOptions):0,item?.writeOnly?stable(item.writeOnly):0,item?.displayFormat?rememberString(item.displayFormat):0];
}
function compactGraphHelper(item,remember,rememberString){return[1,rememberString(item?.id),compactGraphLabel(item?.label,remember),compactGraphAction(item?.action,rememberString),compactPredicate(item?.condition,rememberString)];}
function compactGraphContent(item,remember,rememberString){const kind=GRAPH_CONTENT_KINDS.indexOf(String(item?.contentKind||''));return[2,kind<0?0:kind,rememberString(item?.id),rememberString(item?.forControlId),compactGraphLabel(item?.label,remember),(item?.items||[]).map(label=>compactGraphLabel(label,remember))];}
function compactGraphItem(item,remember,rememberString){if(item?.kind==='helper')return compactGraphHelper(item,remember,rememberString);if(item?.kind==='content')return compactGraphContent(item,remember,rememberString);return compactGraphControl(item,remember,rememberString);}
function compactGraphTab(tab,remember,rememberString){
  if(!tab)return null;
  const fieldsets=(tab.fieldsets||[]).map(item=>[rememberString(item?.id),rememberString(item?.parentId),compactGraphLabel(item?.title,remember),GRAPH_TEMPLATES.indexOf(String(item?.template||'')),Number(item?.sourceOrder)||0,(item?.legendControls||[]).map(control=>compactGraphControl(control,remember,rememberString))]);
  const rows=(tab.rows||[]).map(item=>[rememberString(item?.id),rememberString(item?.parentFieldsetId),Number(item?.order)||0,GRAPH_TEMPLATES.indexOf(String(item?.template||'')),Number(item?.sourceOrder)||0,(item?.items||[]).map(child=>compactGraphItem(child,remember,rememberString))]);
  return[fieldsets,rows];
}

function exactCatalogIdentity(identities,canonicalCatalog){
  const rows=admittedCatalogRows(canonicalCatalog);
  if(rows.length!==identities.length)throw new Error(`Preferences compact canonical release-set length mismatch: ${identities.length} != ${rows.length}.`);
  for(let i=0;i<rows.length;i++){
    const actual=identities[i],expected=rows[i];
    if(actual.qbVersion!==expected.qbVersion||actual.sourceSha!==expected.sourceSha)throw new Error(`Preferences compact canonical release-set mismatch at ${actual.qbVersion||i}: ${actual.qbVersion}/${actual.sourceSha} != ${expected.qbVersion}/${expected.sourceSha}.`);
  }
  return catalogIdentity(canonicalCatalog);
}

export function compileQbPreferencesCompact(sourceCatalog,canonicalCatalog=null){
  if(!sourceCatalog||sourceCatalog.schemaVersion!==1||!Array.isArray(sourceCatalog.profiles)||!sourceCatalog.profiles.length)throw new Error('Preferences compact compiler requires source catalog schemaVersion 1.');
  const profiles=sourceCatalog.profiles,identities=profiles.map(exactIdentity),identity=exactCatalogIdentity(identities,canonicalCatalog||profiles),{refs,remember}=sourceRefTable(),{strings:graphStrings,remember:rememberGraphString}=graphStringTable(),tabIds=new Set(),graphTabIds=new Set(),preferenceKeys=new Set();
  for(const profile of profiles){for(const tab of profile?.manifest?.tabs||[])if(tab?.id)tabIds.add(String(tab.id));for(const tabId of Object.keys(profile?.manifest?.controlGraph?.tabs||{}))graphTabIds.add(String(tabId));for(const key of Object.keys(profile?.manifest?.preferences||{}))preferenceKeys.add(String(key));}
  const tabs=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactTabs(profile.manifest,remember)}))),sections={},preferences={},descriptors={},graphs={};
  for(const tabId of [...tabIds].sort())sections[tabId]=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactSections(profile.manifest,tabId,remember)})));
  for(const key of [...preferenceKeys].sort()){
    preferences[key]=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactControl(profile?.manifest?.preferences?.[key],remember)})));
    descriptors[key]=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactDescriptor(profile?.manifest?.preferences?.[key])})));
  }
  for(const tabId of [...graphTabIds].sort())graphs[tabId]=timeline(profiles.map(profile=>({from:profile.qbVersion,value:compactGraphTab(profile?.manifest?.controlGraph?.tabs?.[tabId],remember,rememberGraphString)})));
  return{schemaVersion:2,source:'qb-upstream-preferences-native-surface-compact',catalogIdentity:identity,format:{release:['qbVersion','sourceSha'],ref:['context','source'],tab:['id','nativeId','titleRef'],section:['id','titleRef'],preference:CONTROL_FIELDS,descriptor:DESCRIPTOR_FIELDS,option:['value',['kind','refOrLiteral']],gate:['controlId','preferenceKey'],projection:{identity:['kind','safeWrite'],scale:['kind','safeWrite','scale'],'switch-map':['kind','safeWrite','values','defaultValue'],'sentinel-gate':['kind','safeWrite','gateControlId','disabledValue','defaultValue','enabledWhen','scale?'],'presence-gate':['kind','safeWrite','gateControlId','disabledValue','enabledWhen'],unproven:['kind','safeWrite','readFactor?','writeFactor?']},graph:{string:'1-based graphStrings index, 0=null',roles:GRAPH_ROLES,semantics:GRAPH_SEMANTICS,templates:GRAPH_TEMPLATES,contentKinds:GRAPH_CONTENT_KINDS,predicates:GRAPH_PREDICATES,actions:GRAPH_ACTIONS,tab:['fieldsets','rows'],fieldset:['id','parentId','title','template','sourceOrder','legendControls'],row:['id','parentFieldsetId','order','template','sourceOrder','items'],control:['kind=0','id','preferenceKey','role','semantic','staticDisabled','label','adornment','suffix','condition','dynamicOptions','writeOnly','displayFormat'],helper:['kind=1','id','label','action','condition'],content:['kind=2','contentKind','id','forControlId','label','items']}},releases:identities.map(item=>[item.qbVersion,item.sourceSha]),refs,graphStrings,tabs,sections,preferences,descriptors,graphs};
}

export function expandQbPreferencesCompact(compact,qbVersion){
  if(!compact||compact.schemaVersion!==2)throw new Error('Preferences compact expansion requires schemaVersion 2.');
  const compare=(a,b)=>{const aa=String(a||'0').split('.').map(Number),bb=String(b||'0').split('.').map(Number),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const x=aa[i]||0,y=bb[i]||0;if(x!==y)return x-y;}return 0;};
  const change=(rows)=>{let value=null;for(const row of rows||[]){if(compare(row.from,qbVersion)>0)break;value=row.value;}return value;};
  const ref=(id)=>Number.isInteger(id)&&id>=0&&compact.refs?.[id]?{context:compact.refs[id][0],source:compact.refs[id][1]}:null;
  const graphString=(id)=>Number.isInteger(id)&&id>0&&compact.graphStrings?.[id-1]!=null?String(compact.graphStrings[id-1]):null;
  const graphLabel=(raw)=>!raw?null:(raw[0]==='r'?ref(raw[1]):raw[0]==='l'?{literal:raw[1]}:null);
  const graphPredicate=(raw)=>{if(!Array.isArray(raw)||raw.length===0)return null;const kind=GRAPH_PREDICATES[raw[0]]||'unknown';if(kind==='truthy'||kind==='falsy')return{kind,key:graphString(raw[1])};if(kind==='equals'||kind==='notEquals'||kind==='gt'||kind==='lte')return{kind,key:graphString(raw[1]),value:structuredClone(raw[2])};if(kind==='allOf'||kind==='anyOf')return{kind,items:(raw[1]||[]).map(graphPredicate)};return{kind};};
  const graphAction=(raw)=>{if(!Array.isArray(raw)||raw.length===0)return null;const kind=GRAPH_ACTIONS[raw[0]]||'unknown';if(kind==='random-int')return{kind,targetControlId:graphString(raw[1]),min:raw[2],max:raw[3]};if(kind==='source-helper')return{kind,name:graphString(raw[1])};if(kind==='source-action')return{kind,owner:graphString(raw[1]),name:graphString(raw[2])};return{kind};};
  const graphControl=(raw)=>({id:graphString(raw[1]),preferenceKey:graphString(raw[2]),role:GRAPH_ROLES[raw[3]]||'',semantic:GRAPH_SEMANTICS[raw[4]]||'',staticDisabled:raw[5]===1,label:graphLabel(raw[6]),adornment:graphLabel(raw[7]),suffix:graphLabel(raw[8]),condition:graphPredicate(raw[9]),...(raw[10]?{dynamicOptions:structuredClone(raw[10])}:{}),...(raw[11]?{writeOnly:structuredClone(raw[11])}:{}),...(raw[12]?{displayFormat:graphString(raw[12])}:{})});
  const graphContent=(raw)=>({kind:'content',contentKind:GRAPH_CONTENT_KINDS[raw?.[1]]||'note',id:graphString(raw?.[2]),forControlId:graphString(raw?.[3]),label:graphLabel(raw?.[4]),items:(raw?.[5]||[]).map(graphLabel).filter(Boolean)});
  const graphItem=(raw)=>raw?.[0]===1?{kind:'helper',id:graphString(raw[1]),role:'helper',label:graphLabel(raw[2]),action:graphAction(raw[3]),condition:graphPredicate(raw[4])}:raw?.[0]===2?graphContent(raw):{kind:'control',...graphControl(raw)};
  const graphTab=(raw)=>{if(!Array.isArray(raw))return null;return{fieldsets:(raw[0]||[]).map(row=>({id:graphString(row[0]),parentId:graphString(row[1]),title:graphLabel(row[2]),template:GRAPH_TEMPLATES[row[3]]||'',sourceOrder:row[4]||0,legendControls:(row[5]||[]).map(graphControl)})),rows:(raw[1]||[]).map(row=>({id:graphString(row[0]),parentFieldsetId:graphString(row[1]),order:row[2],template:GRAPH_TEMPLATES[row[3]]||'',sourceOrder:row[4]||0,items:(row[5]||[]).map(graphItem)}))};};

  const tabs=(change(compact.tabs)||[]).map(row=>({id:row[0],nativeId:row[1],title:ref(row[2]),sections:[],preferences:[]})),byTab=new Map(tabs.map(tab=>[tab.id,tab]));
  for(const tab of tabs){tab.sections=(change(compact.sections?.[tab.id])||[]).map((row,index)=>({id:row[0],order:index,title:ref(row[1]),preferences:[]}));}
  const preferences={};
  for(const key of Object.keys(compact.preferences||{})){
    const row=change(compact.preferences[key]);if(!row)continue;const descriptorRow=change(compact.descriptors?.[key]);const options=row[8]===0?[]:(row[8]||[]).map(option=>({value:option[0],label:option[1]?.[0]==='r'?ref(option[1][1]):{literal:option[1]?.[1]}}));
    const item={key,tab:row[0],sectionId:row[1],order:row[2],title:ref(row[3]),description:ref(row[4]),control:{id:row[5],semantic:row[6],attributes:row[7]===0?{}:row[7],options,unit:ref(row[9]),staticDisabled:row[10]===1,...(row[13]?{structured:structuredClone(row[13])}:{})},dependencies:{gates:row[11]===0?[]:(row[11]||[]).map(gate=>({controlId:gate[0],preferenceKey:gate[1]}))},projection:row[12]===0?null:structuredClone(row[12]),descriptor:descriptorRow?Object.fromEntries(DESCRIPTOR_FIELDS.map((field,index)=>[field,descriptorRow[index]])):null};
    preferences[key]=item;const tab=byTab.get(item.tab);if(tab){tab.preferences.push(key);const section=tab.sections.find(value=>value.id===item.sectionId);if(section)section.preferences.push(key);}
  }
  for(const tab of tabs){tab.preferences.sort((a,b)=>(preferences[a]?.order||0)-(preferences[b]?.order||0));for(const section of tab.sections)section.preferences.sort((a,b)=>(preferences[a]?.order||0)-(preferences[b]?.order||0));}
  const graphTabs={};for(const tabId of Object.keys(compact.graphs||{})){const value=graphTab(change(compact.graphs[tabId]));if(value)graphTabs[tabId]={id:tabId,...value};}
  return{tabs,preferences,controlGraph:{schemaVersion:1,tabs:graphTabs}};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){try{const input=path.resolve(process.argv[2]||''),output=path.resolve(process.argv[3]||'');if(!input||!fs.existsSync(input)||!output)throw new Error('Usage: node tools/qb-preferences-compact.mjs <source-catalog.json> <output.json> [canonical-catalog.json]');const source=JSON.parse(fs.readFileSync(input,'utf8')),defaultCatalog=path.resolve(path.dirname(input),'qb-releases.json'),catalogPath=process.argv[4]?path.resolve(process.argv[4]):defaultCatalog,canonical=fs.existsSync(catalogPath)?JSON.parse(fs.readFileSync(catalogPath,'utf8')):source.profiles,result=compileQbPreferencesCompact(source,canonical);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result)+'\n','utf8');console.log(`Compiled Preferences compact IR: ${result.releases.length} exact releases, catalog ${result.catalogIdentity.releaseSetSha256.slice(0,12)}, ${result.tabs.length} tab change points, ${Object.keys(result.preferences).length} source-mapped preference identities, ${Buffer.byteLength(JSON.stringify(result))} bytes.`);}catch(error){console.error(error?.message||error);process.exitCode=1;}}

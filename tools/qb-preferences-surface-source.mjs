#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {settingsTabRefs} from './qb-owned-ui-source.mjs';
import {extractQbPreferenceUiFacts} from './qb-settings-translation-source.mjs';
import {extractQbPreferencesBehaviorPredicates,extractQbPreferencesCompositeUiFacts} from './qb-preferences-semantic-composite.mjs';
import {extractQbPreferenceValueProjection} from './qb-preferences-value-projection.mjs';
import {assertCatalogIdentity,catalogIdentity} from './qb-catalog-identity.mjs';

const PREFERENCES_SOURCE_PATHS=['src/webui/www/private/views/preferences.html','src/webui/www/private/preferences_content.html','src/webui/www/private/preferences.html'];
const TOOLBAR_SOURCE_PATHS=['src/webui/www/private/views/preferencesToolbar.html','src/webui/www/private/preferences.html'];
const SOURCE_BLOB_PATHS=[...new Set([...PREFERENCES_SOURCE_PATHS,...TOOLBAR_SOURCE_PATHS])];

function decodeHtml(value){return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_m,n)=>String.fromCodePoint(Number.parseInt(n,16))).replace(/&amp;/g,'&').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();}
function qbtTr(value){const match=String(value||'').match(/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/i);if(!match)return null;const source=decodeHtml(match[1]),context=String(match[2]||'').trim();return source&&context?{source,context}:null;}
function attrText(value,name){const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=String(value||'').match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'));return match?String(match[1]??match[2]??match[3]??''):null;}
function hasAttr(value,name){const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(?:^|\\s)${escaped}(?:\\s*=|\\s|$)`,'i').test(String(value||''));}
function tabSlug(value){return String(value||'').replace(/Tab$/i,'').replace(/[^A-Za-z0-9]+/g,'').toLowerCase();}
function elementRanges(markup,tag){const text=String(markup||''),re=new RegExp(`<\\/?${tag}\\b[^>]*>`,'gi'),stack=[],out=[];let match;while((match=re.exec(text))){const raw=match[0],closing=/^<\//.test(raw),selfClosing=/\/>$/.test(raw);if(!closing){const attrs=raw.replace(new RegExp(`^<${tag}\\b`,'i'),'').replace(/\/?\s*>$/,'');if(!selfClosing)stack.push({start:match.index,openEnd:re.lastIndex,attrs,raw});}else if(stack.length){const open=stack.pop();out.push({...open,endStart:match.index,end:re.lastIndex});}}return out.sort((a,b)=>a.start-b.start||b.end-a.end);}
function directLegend(markup,fieldset){if(!fieldset)return null;const body=String(markup||'').slice(fieldset.openEnd,fieldset.endStart),nested=elementRanges(body,'fieldset').filter(item=>item.start!==0),cut=nested.length?Math.min(...nested.map(item=>item.start)):body.length,head=body.slice(0,cut),match=head.match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/i)||body.match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/i);return match?qbtTr(match[1]):null;}
function controlsInLegend(markup,fieldset,uiByControl){if(!fieldset)return[];const body=String(markup||'').slice(fieldset.openEnd,fieldset.endStart),match=body.match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/i);if(!match)return[];const out=[];for(const control of match[1].matchAll(/<input\b([^>]*)>/gi)){const id=attrText(control[1],'id'),type=String(attrText(control[1],'type')||'text').toLowerCase();if(!id||type!=='checkbox')continue;const handlers={};for(const name of ['onclick','onchange','oninput']){const value=attrText(control[1],name);if(value)handlers[name]=value;}out.push({controlId:id,preferenceKey:uiByControl.get(id)||null,handlers});}return out;}
function rangeIndex(ranges){const out=new Map();for(const item of ranges||[]){const id=attrText(item.attrs,'id');if(id&&!out.has(id))out.set(id,item);}return out;}
function controlIndex(markup,caches){const text=String(markup||''),out=new Map(),re=/<(input|select|textarea|table)\b([^>]*)>/gi;let match;while((match=re.exec(text))){const tag=String(match[1]||'').toLowerCase(),attrs=match[2]||'',id=attrText(attrs,'id');if(!id||out.has(id))continue;const type=tag==='input'?String(attrText(attrs,'type')||'text').toLowerCase():tag,semantic=tag==='table'?'structured':tag==='select'?'select':tag==='textarea'?'textarea':type==='checkbox'?'checkbox':type==='radio'?'radio':type==='number'?'number':type==='password'?'password':'text';let range=null;if(tag==='select')range=caches.selectsById.get(id)||null;else if(tag==='textarea')range=caches.textareasById.get(id)||null;else if(tag==='table')range=caches.tablesById.get(id)||null;const handlers={};for(const name of ['onclick','onchange','oninput']){const value=attrText(attrs,name);if(value)handlers[name]=value;}const attributes={};for(const name of ['min','max','step','maxlength','pattern','placeholder']){const value=attrText(attrs,name);if(value!==null)attributes[name]=value;}const classes=String(attrText(attrs,'class')||'').split(/\s+/).filter(Boolean);out.set(id,{id,tag,type,semantic,start:match.index??0,openEnd:re.lastIndex,range,handlers,attributes,classes,staticDisabled:hasAttr(attrs,'disabled')});}return out;}
function findControl(_markup,id,caches){return caches.controls.get(String(id||''))||null;}
function selectOptions(markup,control){if(!control||control.tag!=='select'||!control.range)return[];const body=String(markup||'').slice(control.range.openEnd,control.range.endStart),out=[];for(const match of body.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)){const value=attrText(match[1],'value'),ref=qbtTr(match[2]),literal=ref?null:decodeHtml(match[2]);out.push({value:value===null?decodeHtml(match[2]):value,label:ref||{literal}});}return out;}
function immediateUnit(markup,control,_descriptor,_projection){if(!control||control.semantic==='select')return null;let tail=String(markup||'').slice(control.openEnd,control.openEnd+180),stop=tail.search(/<(?:input|select|textarea|button|label|div|tr|fieldset)\b|<\/(?:td|div|span|fieldset)>/i);if(stop>=0)tail=tail.slice(0,stop);const ref=qbtTr(tail);if(ref)return ref;const literal=decodeHtml(tail).replace(/&nbsp;/gi,' ').replace(/^[:\s\u00a0]+|[:\s\u00a0]+$/g,'');return literal&&literal.length<=48&&!/[.!?。！？]$/.test(literal)?{literal}:null;}
function descriptorSubset(descriptor){if(!descriptor)return null;const out={};for(const key of ['getterPresent','setterPresent','readType','writeType','typeAgreement','writable'])out[key]=Object.prototype.hasOwnProperty.call(descriptor,key)?descriptor[key]:null;return out;}
function safeStringWriteProjection(projection,descriptor,control){
  if(!projection||projection.safeWrite===true)return projection;
  const semantic=String(control?.semantic||''),direct=projection.kind==='unproven'&&projection.writeFactor===1;
  const exactString=descriptor?.setterPresent===true&&descriptor?.writable===true&&descriptor?.writeType==='string'&&descriptor?.typeAgreement==='EXACT';
  return direct&&exactString&&['text','select','password','textarea'].includes(semantic)?{...projection,safeWrite:true,writeIdentity:true}:projection;
}
function sourceTabs(preferencesSource,toolbarSource){const divs=elementRanges(preferencesSource,'div').filter(item=>/\bPrefTab\b/.test(String(attrText(item.attrs,'class')||''))),bySlug=new Map(divs.map(item=>[tabSlug(attrText(item.attrs,'id')),item])),toolbar=settingsTabRefs(toolbarSource||preferencesSource),out=[];for(const item of toolbar){const range=bySlug.get(item.tab)||null;if(range)out.push({id:item.tab,nativeId:attrText(range.attrs,'id')||null,title:item.ref,range});}if(out.length)return out;for(const range of divs){const id=tabSlug(attrText(range.attrs,'id'));if(id)out.push({id,nativeId:attrText(range.attrs,'id')||null,title:null,range});}return out;}

function qbtOrLiteral(value){const ref=qbtTr(value);if(ref)return ref;const literal=decodeHtml(value);return literal?{literal}:null;}
function buttonRanges(markup){
  const text=String(markup||''),out=[];for(const match of text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)){
    const attrs=match[1]||'',start=match.index??0,end=start+match[0].length,onclick=attrText(attrs,'onclick')||'',id=attrText(attrs,'id')||('button@'+start);
    out.push({id,start,end,attrs,onclick,label:qbtOrLiteral(match[2])});
  }
  return out;
}
function escapeRegex(value){return String(value||'').replace(/[-/\\^$*+?.()|[\]{}]/g,match=>'\\'+match);}
function labelRefForControl(markup,id){
  const escaped=escapeRegex(id);
  let match=String(markup||'').match(new RegExp("<label\\b[^>]*\\bfor\\s*=\\s*([\\\"'])"+escaped+"\\1[^>]*>([\\s\\S]*?)<\\/label>",'i'));
  if(match)return qbtOrLiteral(match[2]);
  const control=String(markup||'').match(new RegExp("<(?:input|select|textarea|table)\\b[^>]*\\bid\\s*=\\s*([\\\"'])"+escaped+"\\1[^>]*>",'i'));
  const labelled=control&&attrText(control[0],'aria-labelledby');
  if(labelled){for(const labelId of String(labelled).split(/\s+/)){const lid=escapeRegex(labelId);match=String(markup||'').match(new RegExp("<label\\b[^>]*\\bid\\s*=\\s*([\\\"'])"+lid+"\\1[^>]*>([\\s\\S]*?)<\\/label>",'i'));if(match)return qbtOrLiteral(match[2]);}}
  return null;
}
function sourceHelperAction(handler){
  const value=String(handler||'').trim(),match=value.match(/^(?:qBittorrent\.Preferences\.)?([A-Za-z_$][\w$]*)\(\s*\)\s*;?$/);
  return match?{kind:'source-helper',name:match[1]}:{kind:'unknown'};
}
function gatePredicate(preference){
  const gates=preference?.dependencies?.gates||[],items=gates.map(gate=>gate?.preferenceKey?{kind:'truthy',key:String(gate.preferenceKey)}:null).filter(Boolean);
  if(!items.length)return null;return items.length===1?items[0]:{kind:'allOf',items};
}
function inside(range,pos){return !!range&&pos>=range.openEnd&&pos<range.endStart;}
function nearestContaining(ranges,pos){return(ranges||[]).filter(range=>inside(range,pos)).sort((a,b)=>(a.end-a.start)-(b.end-b.start))[0]||null;}

function immediateSuffix(markup,control,rowEnd){
  if(!control||!Number.isFinite(rowEnd))return null;
  let tail=String(markup||'').slice(control.openEnd,Math.min(rowEnd,control.openEnd+64)),stop=tail.indexOf('<');
  if(stop>=0)tail=tail.slice(0,stop);
  const literal=decodeHtml(tail).replace(/&nbsp;/gi,' ').trim();
  return literal&&literal.length<=12&&/^[:;,/|·–—-]+$/.test(literal)?{literal}:null;
}
function graphControl(control,preferencesByControl,behavior,markup,role,rowEnd){
  const key=preferencesByControl.get(control.id)||null,preference=key&&preferencesByControl.preferences?.[key]||null;
  const condition=behavior.predicates?.[control.id]||gatePredicate(preference),adornment=(preference&&preference.control&&preference.control.unit)||immediateUnit(markup,control,null,null);
  return{id:control.id,preferenceKey:key,role:role||(key?'preference':'auxiliary'),semantic:control.semantic,staticDisabled:control.staticDisabled===true,label:(preference&&preference.title)||labelRefForControl(markup,control.id),adornment:adornment||null,suffix:immediateSuffix(markup,control,rowEnd),condition:condition||null};
}
function buildControlGraph(markup,tabs,fieldsets,caches,preferences){
  const preferenceById=new Map(),preferenceObject={};
  for(const [key,item] of Object.entries(preferences||{})){const id=String(item?.control?.id||'');if(id&&!preferenceById.has(id))preferenceById.set(id,key);preferenceObject[key]=item;}
  preferenceById.preferences=preferenceObject;
  const controlToPreference=Object.fromEntries([...preferenceById.entries()]),behavior=extractQbPreferencesBehaviorPredicates(markup,controlToPreference),buttons=buttonRanges(markup),legends=elementRanges(markup,'legend'),formRows=(caches.divs||[]).filter(row=>String(attrText(row.attrs,'class')||'').split(/\s+/).includes('formRow')),tableRows=caches.trs||[],allRows=[...formRows,...tableRows].sort((a,b)=>a.start-b.start||a.end-b.end),graphTabs={},representedControls=new Set(),representedHelpers=new Set(),sourceControls=new Set(),sourceHelpers=new Set();
  for(const tab of tabs){
    const tabFields=fieldsets.filter(item=>inside(tab.range,item.start)).sort((a,b)=>a.start-b.start),fieldIds=new Map(tabFields.map((item,index)=>[item,tab.id+':fieldset:'+index]));
    const graphFields=tabFields.map((item,index)=>{
      const parent=nearestContaining(tabFields.filter(candidate=>candidate!==item),item.start),legend=legends.find(value=>value.start>=item.openEnd&&value.end<=item.endStart),legendControls=[];
      if(legend){for(const control of caches.controls.values())if(inside(legend,control.start)){representedControls.add(control.id);legendControls.push(graphControl(control,preferenceById,behavior,markup,'gate',legend.endStart));}}
      return{id:tab.id+':fieldset:'+index,parentId:parent?fieldIds.get(parent):null,title:directLegend(markup,item),template:legendControls.length?'nested-gated-fieldset':'fieldset',legendControls};
    });
    const rows=[],assignedControls=new Set(),assignedButtons=new Set(),tabRows=allRows.filter(row=>inside(tab.range,row.start));
    for(const row of tabRows){
      const controls=[...caches.controls.values()].filter(control=>inside(row,control.start)),rowButtons=buttons.filter(button=>inside(row,button.start));
      if(!controls.length&&!rowButtons.length)continue;
      const parent=nearestContaining(tabFields,row.start),items=[];
      for(const control of controls){assignedControls.add(control.id);representedControls.add(control.id);sourceControls.add(control.id);items.push({kind:'control',...graphControl(control,preferenceById,behavior,markup,null,row.endStart)});}
      for(const button of rowButtons){assignedButtons.add(button.id);representedHelpers.add(button.id);sourceHelpers.add(button.id);items.push({kind:'helper',id:button.id,role:'helper',label:button.label,action:sourceHelperAction(button.onclick)});}
      const mapped=items.filter(item=>item.kind==='control'&&item.preferenceKey).length,auxCheckbox=items.some(item=>item.kind==='control'&&!item.preferenceKey&&item.semantic==='checkbox'),hasHelper=items.some(item=>item.kind==='helper');
      const template=hasHelper?(mapped>1?'inline-multi-helper':'control-helper'):(auxCheckbox&&mapped?'gated-sentinel':mapped>1?'inline-multi-control':'single-row');
      rows.push({id:tab.id+':row:'+rows.length,parentFieldsetId:parent?fieldIds.get(parent):null,order:rows.length,template,items});
    }
    for(const control of caches.controls.values()){
      if(!inside(tab.range,control.start))continue;
      sourceControls.add(control.id);if(assignedControls.has(control.id))continue;representedControls.add(control.id);const parent=nearestContaining(tabFields,control.start);
      rows.push({id:tab.id+':row:'+rows.length,parentFieldsetId:parent?fieldIds.get(parent):null,order:rows.length,template:'single-row',items:[{kind:'control',...graphControl(control,preferenceById,behavior,markup,null,null)}]});
    }
    for(const button of buttons){
      if(!inside(tab.range,button.start))continue;
      sourceHelpers.add(button.id);if(assignedButtons.has(button.id))continue;representedHelpers.add(button.id);const parent=nearestContaining(tabFields,button.start);
      rows.push({id:tab.id+':row:'+rows.length,parentFieldsetId:parent?fieldIds.get(parent):null,order:rows.length,template:'helper-only',items:[{kind:'helper',id:button.id,role:'helper',label:button.label,action:sourceHelperAction(button.onclick)}]});
    }
    graphTabs[tab.id]={id:tab.id,fieldsets:graphFields,rows};
  }
  const mappedControls=new Set([...preferenceById.keys()]),unknownBehaviors=Object.entries(behavior.predicates||{}).filter(([,predicate])=>predicate?.kind==='unknown').map(([controlId])=>controlId),behaviorControls=new Set((behavior.assignments||[]).map(item=>String(item.controlId||'')).filter(Boolean)),sourceAdornmentControls=new Set([...caches.controls.values()].filter(control=>tabs.some(tab=>inside(tab.range,control.start))&&immediateUnit(markup,control,null,null)).map(control=>control.id)),graphItems=Object.values(graphTabs).flatMap(tab=>tab.rows.flatMap(row=>row.items).concat(tab.fieldsets.flatMap(field=>field.legendControls||[]))),representedAdornmentControls=new Set(graphItems.filter(item=>item.kind==='control'&&item.adornment).map(item=>item.id)),representedBehaviorControls=new Set([...behaviorControls].filter(id=>representedControls.has(id)||representedHelpers.has(id))),complete=sourceControls.size===representedControls.size&&sourceHelpers.size===representedHelpers.size&&sourceAdornmentControls.size===representedAdornmentControls.size&&behaviorControls.size===representedBehaviorControls.size;
  return{schemaVersion:1,tabs:graphTabs,census:{sourceControls:sourceControls.size,representedControls:representedControls.size,sourceHelpers:sourceHelpers.size,representedHelpers:representedHelpers.size,sourceAdornments:sourceAdornmentControls.size,representedAdornments:representedAdornmentControls.size,behaviorControls:behaviorControls.size,representedBehaviorControls:representedBehaviorControls.size,mappedPreferenceControls:mappedControls.size,behaviorAssignments:behavior.assignments.length,unknownBehaviors,complete}};
}


function timedTrace(trace,label,fn){const start=Date.now();trace?.(`${label} START`);const value=fn();trace?.(`${label} DONE ${Date.now()-start}ms`);return value;}

export function extractQbPreferencesNativeSurface({preferencesSource='',toolbarSource='',preferenceDescriptors=[],trace=null}={}){
  const descriptors=new Map((preferenceDescriptors||[]).map(item=>[String(item?.key||''),item]));
  const keys=[...descriptors.keys()].filter(Boolean);
  const ui=timedTrace(trace,'ui-facts',()=>extractQbPreferenceUiFacts(preferencesSource,keys));
  const supplement=timedTrace(trace,'composite-ui-facts',()=>extractQbPreferencesCompositeUiFacts(preferencesSource,keys));
  for(const [key,fact] of Object.entries(supplement))if(!ui[key])ui[key]=fact;
  const uiByControl=new Map(Object.entries(ui).map(([key,item])=>[String(item?.controlId||''),key]).filter(([id])=>id));
  const indexes=timedTrace(trace,'structural-indexes',()=>{
    const tabs=sourceTabs(preferencesSource,toolbarSource),fieldsets=elementRanges(preferencesSource,'fieldset'),selects=elementRanges(preferencesSource,'select'),textareas=elementRanges(preferencesSource,'textarea'),tables=elementRanges(preferencesSource,'table'),divs=elementRanges(preferencesSource,'div'),trs=elementRanges(preferencesSource,'tr'),caches={selects,textareas,tables,divs,trs,selectsById:rangeIndex(selects),textareasById:rangeIndex(textareas),tablesById:rangeIndex(tables)};
    caches.controls=controlIndex(preferencesSource,caches);
    return{tabs,fieldsets,caches};
  });
  const {tabs,fieldsets,caches}=indexes,preferences={},tabRows=[];
  tabs.forEach((tab,tabOrder)=>{
    const tabStarted=Date.now();trace?.(`tab:${tab.id} START`);
    const rows=[];
    for(const [key,fact] of Object.entries(ui)){
      const control=findControl(preferencesSource,fact.controlId,caches);if(!control||control.start<tab.range.start||control.start>tab.range.end)continue;
      const prefStarted=Date.now();trace?.(`tab:${tab.id} pref:${key} START control=${control.id}`);
      const layoutStarted=Date.now(),containing=fieldsets.filter(item=>item.start<control.start&&item.end>control.start&&item.start>=tab.range.start&&item.end<=tab.range.end).sort((a,b)=>(a.end-a.start)-(b.end-b.start));
      const nearest=containing[0]||null,sectionRef=directLegend(preferencesSource,nearest),gates=[];
      for(const ancestor of containing){for(const gate of controlsInLegend(preferencesSource,ancestor,uiByControl))if(gate.controlId!==control.id&&!gates.some(item=>item.controlId===gate.controlId))gates.push(gate);}
      trace?.(`tab:${tab.id} pref:${key} layout DONE ${Date.now()-layoutStarted}ms ancestors=${containing.length} gates=${gates.length}`);
      const projectionStarted=Date.now();trace?.(`tab:${tab.id} pref:${key} projection START`);
      const descriptor=descriptorSubset(descriptors.get(key)),projection=safeStringWriteProjection(extractQbPreferenceValueProjection(preferencesSource,key,control.id),descriptor,control);
      trace?.(`tab:${tab.id} pref:${key} projection DONE ${Date.now()-projectionStarted}ms kind=${projection?.kind||'unknown'}`);
      rows.push({key,sourcePos:control.start,sectionKey:nearest?String(nearest.start):'root',sectionRef,control,fact,gates,descriptor,projection});
      trace?.(`tab:${tab.id} pref:${key} DONE ${Date.now()-prefStarted}ms`);
    }
    rows.sort((a,b)=>a.sourcePos-b.sourcePos||a.key.localeCompare(b.key));
    const sections=[],sectionByTransition=[];let lastKey=null,current=null;
    rows.forEach((row,order)=>{if(row.sectionKey!==lastKey){current={id:`${tab.id}:${sections.length}`,order:sections.length,title:row.sectionRef||null,preferences:[]};sections.push(current);lastKey=row.sectionKey;}current.preferences.push(row.key);sectionByTransition[order]=current;});
    rows.forEach((row,order)=>{const section=sectionByTransition[order],options=selectOptions(preferencesSource,row.control),unit=immediateUnit(preferencesSource,row.control,row.descriptor,row.projection);preferences[row.key]={key:row.key,tab:tab.id,tabOrder,sectionId:section.id,sectionOrder:section.order,order,title:row.fact.title||null,description:row.fact.description||null,control:{id:row.control.id,tag:row.control.tag,type:row.control.type,semantic:row.control.semantic,attributes:row.control.attributes,classes:row.control.classes,handlers:row.control.handlers,staticDisabled:row.control.staticDisabled,options,...(unit?{unit}:{})},dependencies:{gates:row.gates},descriptor:row.descriptor,projection:row.projection};});
    tabRows.push({id:tab.id,nativeId:tab.nativeId,title:tab.title||null,order:tabOrder,sections,preferences:rows.map(row=>row.key)});
    trace?.(`tab:${tab.id} DONE ${Date.now()-tabStarted}ms rows=${rows.length}`);
  });
  const controlGraph=timedTrace(trace,'control-graph',()=>buildControlGraph(preferencesSource,tabs,fieldsets,caches,preferences));return{tabs:tabRows,preferences,controlGraph,structuralCensus:controlGraph.census,mappedPreferences:Object.keys(preferences).length,totalPreferences:keys.length};
}

function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function showMaybe(root,tag,file){try{return git(root,'show',`${tag}:${file}`);}catch{return'';}}
function preferencesSource(root,tag){for(const file of PREFERENCES_SOURCE_PATHS){const source=showMaybe(root,tag,file);if(source)return source;}return'';}
function toolbarSource(root,tag){for(const file of TOOLBAR_SOURCE_PATHS){const source=showMaybe(root,tag,file);if(source)return source;}return'';}
function isPartialClone(root){try{return git(root,'config','--get','remote.origin.promisor')==='true';}catch{return false;}}
function sourceBlobOid(root,tag,file){try{const oid=git(root,'rev-parse','--verify',`${tag}:${file}`);return /^[0-9a-f]{40}$/i.test(oid)?oid:'';}catch{return'';}}
function prefetchSourceBlobs(root,catalog){
  if(!isPartialClone(root))return;
  const objectIds=new Set();
  for(const profile of catalog||[]){const tag=String(profile?.tag||`release-${profile?.qbVersion||''}`).trim();if(!tag)continue;for(const file of SOURCE_BLOB_PATHS){const oid=sourceBlobOid(root,tag,file);if(oid)objectIds.add(oid);}}
  if(!objectIds.size)return;
  const ids=[...objectIds];
  try{
    git(root,'fetch','--quiet','--no-tags','--no-write-fetch-head','origin',...ids);
    console.log(`Hydrated ${ids.length} qB Preferences source blobs in one partial-clone fetch.`);
  }catch(error){
    console.warn(`Batch blob hydration was unavailable; refetching bounded source blobs for stable tags (${error?.message||error}).`);
    git(root,'fetch','--quiet','--no-tags','--no-write-fetch-head','--refetch','--filter=blob:limit=2097152','origin','+refs/tags/*:refs/tags/*');
  }
}

export function selectQbPreferencesCatalogShard(catalog,index,count){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('qB Preferences sharding requires a non-empty exact release catalog.');
  if(!Number.isInteger(index)||!Number.isInteger(count)||count<1||index<0||index>=count)throw new Error(`Invalid qB Preferences shard ${index}/${count}.`);
  return catalog.filter((_profile,position)=>(position%count)===index);
}

export function mergeQbPreferencesSourceCatalogShards(canonicalCatalog,shards){
  if(!Array.isArray(canonicalCatalog)||!canonicalCatalog.length)throw new Error('qB Preferences shard merge requires the canonical exact release catalog.');
  if(!Array.isArray(shards)||!shards.length)throw new Error('qB Preferences shard merge requires at least one shard.');
  const expectedIdentity=catalogIdentity(canonicalCatalog),expected=new Map();
  for(const profile of canonicalCatalog){
    const qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim().toLowerCase();
    if(!qbVersion||!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error('Canonical qB Preferences merge catalog requires exact qbVersion + sourceSha.');
    expected.set(`${qbVersion}\u0000${sourceSha}`,{qbVersion,sourceSha});
  }
  const actual=new Map(),duplicates=[],unexpected=[];
  for(const shard of shards){
    if(shard?.schemaVersion!==1||shard?.source!=='qb-upstream-preferences-native-surface'||!Array.isArray(shard?.profiles))throw new Error('qB Preferences shard has an invalid source catalog shape.');
    assertCatalogIdentity(shard.catalogIdentity,expectedIdentity,'qB Preferences shard Frozen catalog identity');
    for(const profile of shard.profiles){
      const qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim().toLowerCase(),key=`${qbVersion}\u0000${sourceSha}`;
      if(!expected.has(key)){unexpected.push(`${qbVersion}@${sourceSha.slice(0,12)}`);continue;}
      if(actual.has(key)){duplicates.push(qbVersion);continue;}
      actual.set(key,profile);
    }
  }
  const missing=[...expected.entries()].filter(([key])=>!actual.has(key)).map(([,row])=>row.qbVersion);
  if(missing.length||duplicates.length||unexpected.length)throw new Error(`qB Preferences shard aggregate mismatch: missing=[${missing.join(',')}], duplicate=[${duplicates.join(',')}], unexpected=[${unexpected.join(',')}].`);
  const profiles=canonicalCatalog.map(profile=>actual.get(`${String(profile.qbVersion).trim()}\u0000${String(profile.sourceSha).trim().toLowerCase()}`));
  console.log(`Merged qB Preferences source shards: expected=${expected.size} executed=${actual.size} missing=0 duplicate=0 unexpected=0.`);
  return{schemaVersion:1,source:'qb-upstream-preferences-native-surface',catalogIdentity:expectedIdentity,profiles};
}

export function buildQbPreferencesSourceCatalog(catalog,qbRoot,{trace=false,fullCatalog=catalog,shard=null}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('qB Preferences native surface extraction requires a non-empty exact release catalog.');
  prefetchSourceBlobs(qbRoot,catalog);
  const profiles=[];
  for(let index=0;index<catalog.length;index++){
    const profile=catalog[index],qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim(),tag=String(profile?.tag||`release-${qbVersion}`).trim();
    if(!qbVersion||!/^[0-9a-f]{40}$/i.test(sourceSha)||!tag)throw new Error('Each qB Preferences profile requires exact qbVersion + sourceSha + tag.');
    const prefix=`[Preferences ${index+1}/${catalog.length} qB ${qbVersion}]`,detail=message=>{if(trace)console.log(`${prefix} ${message}`);},started=Date.now();
    console.log(`${prefix} release START`);
    const sourceStarted=Date.now(),source=preferencesSource(qbRoot,tag),toolbar=toolbarSource(qbRoot,tag);
    detail(`source-read DONE ${Date.now()-sourceStarted}ms sourceBytes=${source.length} toolbarBytes=${toolbar.length}`);
    if(!source)throw new Error(`${qbVersion}: qB Preferences source is unavailable.`);
    const manifest=extractQbPreferencesNativeSurface({preferencesSource:source,toolbarSource:toolbar,preferenceDescriptors:profile.preferenceDescriptors||[],trace:trace?(message=>detail(message)):null});
    if(!manifest.tabs.length)throw new Error(`${qbVersion}: qB Preferences native tabs are unresolved.`);
    profiles.push({qbVersion,sourceSha,tag,manifest});
    console.log(`${prefix} release DONE ${Date.now()-started}ms mapped=${manifest.mappedPreferences}/${manifest.totalPreferences} tabs=${manifest.tabs.length}`);
  }
  return{schemaVersion:1,source:'qb-upstream-preferences-native-surface',catalogIdentity:catalogIdentity(fullCatalog),...(shard?{shard}:{}),profiles};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const args=process.argv.slice(2);
    if(args[0]==='--merge'){
      const catalogPath=path.resolve(args[1]||''),shardDir=path.resolve(args[2]||''),outputPath=path.resolve(args[3]||'');
      if(!catalogPath||!fs.existsSync(catalogPath)||!shardDir||!fs.existsSync(shardDir)||!outputPath)throw new Error('Usage: node tools/qb-preferences-surface-source.mjs --merge <catalog.json> <shard-dir> <output.json>');
      const shardFiles=fs.readdirSync(shardDir).filter(name=>/^qb-preferences-source-shard-\d+\.json$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
      if(!shardFiles.length)throw new Error('No qB Preferences source shard files were found for merge.');
      const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),shards=shardFiles.map(name=>JSON.parse(fs.readFileSync(path.join(shardDir,name),'utf8'))),result=mergeQbPreferencesSourceCatalogShards(catalog,shards);
      fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n','utf8');
      console.log(`Merged ${shardFiles.length} qB Preferences source shards into ${result.profiles.length} exact releases; Frozen catalog ${result.catalogIdentity.releaseSetSha256.slice(0,12)}.`);
    }else{
      const qbRoot=path.resolve(args[0]||process.env.QB_UPSTREAM_DIR||''),catalogPath=path.resolve(args[1]||''),outputPath=path.resolve(args[2]||''),shardIndexArg=args.find(arg=>arg.startsWith('--shard-index=')),shardCountArg=args.find(arg=>arg.startsWith('--shard-count='));
      if(!qbRoot||!fs.existsSync(qbRoot)||!catalogPath||!fs.existsSync(catalogPath)||!outputPath)throw new Error('Usage: node tools/qb-preferences-surface-source.mjs <qBittorrent-clone> <catalog.json> <output.json> [--shard-index=N --shard-count=M]');
      if(Boolean(shardIndexArg)!==Boolean(shardCountArg))throw new Error('qB Preferences sharding requires both --shard-index and --shard-count.');
      const fullCatalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),trace=/^(?:1|true|yes)$/i.test(String(process.env.QB_PREFERENCES_TRACE||''));let catalog=fullCatalog,shard=null;
      if(shardIndexArg){
        const index=Number(shardIndexArg.split('=')[1]),count=Number(shardCountArg.split('=')[1]);
        catalog=selectQbPreferencesCatalogShard(fullCatalog,index,count);shard={index,count};
        if(!catalog.length)throw new Error(`qB Preferences shard ${index}/${count} selected no releases.`);
        console.log(`qB Preferences shard ${index+1}/${count}: ${catalog.map(profile=>profile.qbVersion).join(', ')}`);
      }
      const result=buildQbPreferencesSourceCatalog(catalog,qbRoot,{trace,fullCatalog,shard});
      fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n','utf8');
      const mapped=result.profiles.reduce((sum,item)=>sum+item.manifest.mappedPreferences,0),total=result.profiles.reduce((sum,item)=>sum+item.manifest.totalPreferences,0),tabs=result.profiles.reduce((sum,item)=>sum+item.manifest.tabs.length,0);
      console.log(`Generated exact qB Preferences native surface for ${result.profiles.length} releases; tabs ${tabs}; source-mapped preferences ${mapped}/${total}; Frozen catalog ${result.catalogIdentity.releaseSetSha256.slice(0,12)}.`);
    }
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

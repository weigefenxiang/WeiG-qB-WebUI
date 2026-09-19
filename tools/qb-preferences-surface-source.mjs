#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {settingsTabRefs} from './qb-owned-ui-source.mjs';
import {extractQbPreferenceControlCandidates,extractQbPreferenceUiFacts} from './qb-settings-translation-source.mjs';
import {extractQbPreferencesBehaviorPredicates,extractQbPreferencesCompositeUiFacts} from './qb-preferences-semantic-composite.mjs';
import {extractQbPreferenceValueProjection} from './qb-preferences-value-projection.mjs';
import {assertCatalogIdentity,catalogIdentity} from './qb-catalog-identity.mjs';
import {extractPreferenceSetterHints} from './qb-source-parsers.mjs';

const PREFERENCES_SOURCE_PATHS=['src/webui/www/private/views/preferences.html','src/webui/www/private/preferences_content.html','src/webui/www/private/preferences.html'];
const TOOLBAR_SOURCE_PATHS=['src/webui/www/private/views/preferencesToolbar.html','src/webui/www/private/preferences.html'];
const APP_CONTROLLER_PATH='src/webui/api/appcontroller.cpp';
const SOURCE_BLOB_PATHS=[...new Set([...PREFERENCES_SOURCE_PATHS,...TOOLBAR_SOURCE_PATHS,APP_CONTROLLER_PATH])];

function decodeHtml(value){return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_m,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_m,n)=>String.fromCodePoint(Number.parseInt(n,16))).replace(/&amp;/g,'&').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();}
function qbtTr(value){const match=String(value||'').match(/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/i);if(!match)return null;const source=decodeHtml(match[1]),context=String(match[2]||'').trim();return source&&context?{source,context}:null;}
function attrText(value,name){const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=String(value||'').match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'));return match?String(match[1]??match[2]??match[3]??''):null;}
function hasAttr(value,name){const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(?:^|\\s)${escaped}(?:\\s*=|\\s|$)`,'i').test(String(value||''));}
function tabSlug(value){return String(value||'').replace(/Tab$/i,'').replace(/[^A-Za-z0-9]+/g,'').toLowerCase();}
function elementRanges(markup,tag){const text=String(markup||''),re=new RegExp(`<\\/?${tag}\\b[^>]*>`,'gi'),stack=[],out=[];let match;while((match=re.exec(text))){const raw=match[0],closing=/^<\//.test(raw),selfClosing=/\/>$/.test(raw);if(!closing){const attrs=raw.replace(new RegExp(`^<${tag}\\b`,'i'),'').replace(/\/?\s*>$/,'');if(!selfClosing)stack.push({start:match.index,openEnd:re.lastIndex,attrs,raw});}else if(stack.length){const open=stack.pop();out.push({...open,endStart:match.index,end:re.lastIndex});}}return out.sort((a,b)=>a.start-b.start||b.end-a.end);}
function directLegend(markup,fieldset){if(!fieldset)return null;const body=String(markup||'').slice(fieldset.openEnd,fieldset.endStart),nested=elementRanges(body,'fieldset').filter(item=>item.start!==0),cut=nested.length?Math.min(...nested.map(item=>item.start)):body.length,head=body.slice(0,cut),match=head.match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/i)||body.match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/i);return match?qbtTr(match[1]):null;}
function controlsInLegend(markup,fieldset,uiByControl){if(!fieldset)return[];const body=String(markup||'').slice(fieldset.openEnd,fieldset.endStart),match=body.match(/<legend\b[^>]*>([\s\S]*?)<\/legend>/i);if(!match)return[];const out=[];for(const control of match[1].matchAll(/<input\b([^>]*)>/gi)){const id=attrText(control[1],'id'),type=String(attrText(control[1],'type')||'text').toLowerCase();if(!id||type!=='checkbox')continue;const handlers={};for(const name of ['onclick','onchange','oninput']){const value=attrText(control[1],name);if(value)handlers[name]=value;}out.push({controlId:id,preferenceKey:uiByControl.get(id)||null,handlers});}return out;}
function rangeIndex(ranges){const out=new Map();for(const item of ranges||[]){const id=attrText(item.attrs,'id');if(id&&!out.has(id))out.set(id,item);}return out;}
function controlIndex(markup,caches){const text=String(markup||''),out=new Map(),re=/<(input|select|textarea|table)\b([^>]*)>/gi;let match;while((match=re.exec(text))){const tag=String(match[1]||'').toLowerCase(),attrs=match[2]||'',id=attrText(attrs,'id');if(!id||out.has(id))continue;const type=tag==='input'?String(attrText(attrs,'type')||'text').toLowerCase():tag;if(tag==='input'&&['button','submit','reset'].includes(type))continue;const semantic=tag==='table'?'structured':tag==='select'?'select':tag==='textarea'?'textarea':type==='checkbox'?'checkbox':type==='radio'?'radio':type==='number'?'number':type==='password'?'password':'text';let range=null;if(tag==='select')range=caches.selectsById.get(id)||null;else if(tag==='textarea')range=caches.textareasById.get(id)||null;else if(tag==='table')range=caches.tablesById.get(id)||null;const handlers={};for(const name of ['onclick','onchange','oninput']){const value=attrText(attrs,name);if(value)handlers[name]=value;}const attributes={};for(const name of ['min','max','step','maxlength','pattern','placeholder']){const value=attrText(attrs,name);if(value!==null)attributes[name]=value;}const classes=String(attrText(attrs,'class')||'').split(/\s+/).filter(Boolean);out.set(id,{id,tag,type,semantic,start:match.index??0,openEnd:re.lastIndex,range,handlers,attributes,classes,sourceAttrs:attrs,staticDisabled:hasAttr(attrs,'disabled')});}return out;}
function findControl(_markup,id,caches){return caches.controls.get(String(id||''))||null;}
function selectOptions(markup,control){if(!control||control.tag!=='select'||!control.range)return[];const body=String(markup||'').slice(control.range.openEnd,control.range.endStart),out=[];for(const match of body.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)){const value=attrText(match[1],'value'),ref=qbtTr(match[2]),literal=ref?null:decodeHtml(match[2]);out.push({value:value===null?decodeHtml(match[2]):value,label:ref||{literal}});}return out;}
function immediateUnit(markup,control,_descriptor,_projection){if(!control||control.semantic==='select')return null;let tail=String(markup||'').slice(control.openEnd,control.openEnd+180),stop=tail.search(/<(?:input|select|textarea|button|label|div|tr|fieldset)\b|<\/(?:td|div|span|fieldset)>/i);if(stop>=0)tail=tail.slice(0,stop);const ref=qbtTr(tail);if(ref)return ref;const literal=decodeHtml(tail).replace(/&nbsp;/gi,' ').replace(/^[:\s\u00a0]+|[:\s\u00a0]+$/g,'');return literal&&literal.length<=48&&!/[.!?。！？]$/.test(literal)?{literal}:null;}
function descriptorSubset(descriptor){if(!descriptor)return null;const out={};for(const key of ['getterPresent','setterPresent','readType','writeType','typeAgreement','writable'])out[key]=Object.prototype.hasOwnProperty.call(descriptor,key)?descriptor[key]:null;return out;}
function safeSourceWriteProjection(projection,descriptor,control,fact){
  if(!projection||projection.safeWrite===true)return projection;
  const semantic=String(control?.semantic||''),direct=projection.kind==='unproven'&&projection.writeFactor===1;
  const exactString=descriptor?.setterPresent===true&&descriptor?.writable===true&&descriptor?.writeType==='string'&&descriptor?.typeAgreement==='EXACT';
  if(direct&&exactString&&['text','select','password','textarea'].includes(semantic))return{...projection,safeWrite:true,writeIdentity:true};
  const exactObject=descriptor?.getterPresent===true&&descriptor?.setterPresent===true&&descriptor?.writable===true&&descriptor?.readType==='object'&&descriptor?.writeType==='object'&&descriptor?.typeAgreement==='EXACT';
  if(semantic==='structured'&&fact?.structured?.kind==='keyed-map'&&exactObject)return{kind:'identity',safeWrite:true};
  return projection;
}
function sourceTabs(preferencesSource,toolbarSource){const divs=elementRanges(preferencesSource,'div').filter(item=>/\bPrefTab\b/.test(String(attrText(item.attrs,'class')||''))),bySlug=new Map(divs.map(item=>[tabSlug(attrText(item.attrs,'id')),item])),toolbar=settingsTabRefs(toolbarSource||preferencesSource),out=[];for(const item of toolbar){const range=bySlug.get(item.tab)||null;if(range)out.push({id:item.tab,nativeId:attrText(range.attrs,'id')||null,title:item.ref,range});}if(out.length)return out;for(const range of divs){const id=tabSlug(attrText(range.attrs,'id'));if(id)out.push({id,nativeId:attrText(range.attrs,'id')||null,title:null,range});}return out;}

function qbtOrLiteral(value){const ref=qbtTr(value);if(ref)return ref;const literal=decodeHtml(value);return literal?{literal}:null;}
function sourceLabelRanges(markup){
  const text=String(markup||''),out=[];
  for(const match of text.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)){
    const ref=qbtOrLiteral(match[2]);if(!ref)continue;
    const attrs=match[1]||'',start=match.index??0;
    out.push({start,end:start+match[0].length,attrs,ref,forId:attrText(attrs,'for'),id:attrText(attrs,'id')});
  }
  return out;
}
function sourceQbtRanges(markup){
  const text=String(markup||''),out=[];
  for(const match of text.matchAll(/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/gi)){
    const ref={source:decodeHtml(match[1]),context:String(match[2]||'').trim()},start=match.index??0;
    if(ref.source&&ref.context)out.push({start,end:start+match[0].length,ref});
  }
  return out;
}
function sourceRefIdentity(ref){
  if(!ref)return'';
  if(ref.source&&ref.context)return String(ref.context)+'\u0000'+String(ref.source);
  if(Object.prototype.hasOwnProperty.call(ref,'literal'))return'literal\u0000'+String(ref.literal);
  return JSON.stringify(ref);
}
function buildSourceOwnershipIndex(markup,tabs,fieldsets,caches){
  const labels=sourceLabelRanges(markup),legends=elementRanges(markup,'legend'),options=elementRanges(markup,'option'),copyRefs=sourceQbtRanges(markup),behaviorGates=extractQbPreferencesBehaviorPredicates(markup,{}).controlDependencies||{},byFor=new Map(),byId=new Map(),rows=[...(caches.divs||[]).filter(row=>String(attrText(row.attrs,'class')||'').split(/\s+/).includes('formRow')),...(caches.trs||[])].sort((a,b)=>a.start-b.start||a.end-b.end),owners=new Map();
  for(const label of labels){
    if(label.forId){const list=byFor.get(label.forId)||[];list.push(label);byFor.set(label.forId,list);}
    if(label.id&&!byId.has(label.id))byId.set(label.id,label);
  }
  const explicitIds=new Set(byFor.keys());
  for(const control of caches.controls.values()){
    const tab=tabs.find(item=>inside(item.range,control.start))||null;if(!tab)continue;
    const tabFields=fieldsets.filter(item=>inside(tab.range,item.start)).sort((a,b)=>a.start-b.start),nearestField=nearestContaining(tabFields,control.start),row=nearestContaining(rows.filter(item=>inside(tab.range,item.start)),control.start),candidates=[];
    const add=(label,rank,evidence)=>{if(label?.ref)candidates.push({ref:label.ref,rank,evidence,sourceRange:{start:label.start,end:label.end}});};
    for(const label of byFor.get(control.id)||[])add(label,4,'E1:label-for');
    const labelledBy=String(attrText(control.sourceAttrs||'','aria-labelledby')||'').trim();
    if(labelledBy)for(const labelId of labelledBy.split(/\s+/)){const label=byId.get(labelId);if(label)add(label,4,'E1:aria-labelledby');}
    if(!candidates.some(item=>item.rank===4)&&row){
      const rowLabels=labels.filter(label=>inside(row,label.start)),rowControls=[...caches.controls.values()].filter(item=>inside(row,item.start)),available=rowLabels.filter(label=>!label.forId||!caches.controls.has(label.forId));
      const before=available.filter(label=>label.end<=control.start).sort((a,b)=>b.end-a.end);
      for(const label of before){
        const crossedControl=rowControls.some(item=>item.id!==control.id&&item.start>label.end&&item.start<control.start),crossedLabel=rowLabels.some(item=>item!==label&&item.start>label.end&&item.end<=control.start);
        if(!crossedControl&&!crossedLabel){add(label,3,'E2:bounded-row-adjacent');break;}
      }
      if(!candidates.some(item=>item.rank===3)){
        const unlabeledControls=rowControls.filter(item=>{
          if(explicitIds.has(item.id))return false;
          return !String(attrText(item.sourceAttrs||'','aria-labelledby')||'').trim();
        });
        if(available.length===1&&unlabeledControls.length===1&&unlabeledControls[0].id===control.id)add(available[0],3,available[0].forId?'E2:bounded-row-dangling-for':'E2:bounded-row-unique');
      }
    }
    if(!candidates.some(item=>item.rank>=3)){
      const adjacent=labels.filter(label=>{
        if(label.forId||label.end>control.start||!inside(tab.range,label.start))return false;
        if(String(markup||'').slice(label.end,control.start).trim()!=='')return false;
        const labelField=nearestContaining(tabFields,label.start);
        return labelField===nearestField;
      }).sort((a,b)=>b.end-a.end);
      if(adjacent.length)add(adjacent[0],3,'E2:direct-adjacent');
    }
    if(!candidates.some(item=>item.rank>=3)&&row){
      const free=copyRefs.filter(copy=>{
        if(!inside(row,copy.start)||copy.end>control.start)return false;
        if(labels.some(label=>copy.start>=label.start&&copy.end<=label.end))return false;
        if(options.some(option=>inside(option,copy.start)))return false;
        return true;
      }).sort((a,b)=>b.end-a.end);
      const colon=free.filter(copy=>/:\s*$/.test(String(copy.ref?.source||'')));
      if(colon.length)candidates.push({ref:colon[0].ref,rank:3,evidence:'E2:inline-copy-group',sourceRange:{start:colon[0].start,end:colon[0].end}});
      else{
        const rowControls=[...caches.controls.values()].filter(item=>inside(row,item.start)&&!explicitIds.has(item.id)&&!String(attrText(item.sourceAttrs||'','aria-labelledby')||'').trim());
        if(free.length===1&&rowControls.length===1&&rowControls[0].id===control.id)candidates.push({ref:free[0].ref,rank:3,evidence:'E2:inline-copy-unique',sourceRange:{start:free[0].start,end:free[0].end}});
      }
    }
    if(!candidates.length){
      const gateLabels=[];
      for(const gateId of behaviorGates[control.id]||[]){
        const gate=caches.controls.get(String(gateId||''));if(gate?.semantic!=='checkbox')continue;
        for(const label of byFor.get(gate.id)||[])gateLabels.push(label);
      }
      const identities=[...new Set(gateLabels.map(label=>sourceRefIdentity(label.ref)).filter(Boolean))];
      if(identities.length===1)for(const label of gateLabels)add(label,2,'E3:behavior-gate');
      else if(identities.length>1)for(const label of gateLabels)add(label,2,'E3:ambiguous-behavior-gate');
    }
    if(!candidates.length&&nearestField){
      const ref=directLegend(markup,nearestField),directFieldControls=[...caches.controls.values()].filter(item=>inside(nearestField,item.start)&&nearestContaining(tabFields,item.start)===nearestField),controlLegend=legends.find(legend=>inside(nearestField,legend.start)&&inside(legend,control.start))||null;
      const evidence=controlLegend?'E3:legend-control':(control.tag==='table'?'E3:structured-group':(directFieldControls.length===1?'E3:single-control-group':''));
      if(ref&&evidence)candidates.push({ref,rank:2,evidence,sourceRange:{start:controlLegend?.start??nearestField.start,end:controlLegend?.end??nearestField.openEnd}});
    }
    candidates.sort((a,b)=>b.rank-a.rank||a.sourceRange.start-b.sourceRange.start);
    const topRank=candidates[0]?.rank||0,top=candidates.filter(item=>item.rank===topRank),identities=[...new Set(top.map(item=>sourceRefIdentity(item.ref)).filter(Boolean))],label=identities.length===1?top[0]:null;
    owners.set(control.id,{
      controlId:control.id,tabId:tab.id,
      fieldsetId:nearestField?tab.id+':fieldset:'+tabFields.indexOf(nearestField):null,
      fieldsetRange:nearestField?{start:nearestField.start,end:nearestField.end}:null,
      rowBounded:!!row,
      rowRange:row?{start:row.start,end:row.end}:null,
      label:label?{ref:label.ref,rank:label.rank,evidence:label.evidence,sourceRange:label.sourceRange}:null,
      ambiguousLabelRefs:identities.length>1?top.map(item=>({ref:item.ref,evidence:item.evidence,sourceRange:item.sourceRange})):[]
    });
  }
  return owners;
}
function bindingEvidenceWeight(evidence){
  const value=String(evidence||'');
  if(/(?:modern-read|legacy-read|legacy-property-read|indexed-modern-write|legacy-write|indexed-write|modern-write|object-helper-write|locale-source-call)/.test(value))return 80;
  if(/(?:read-variable|variable-write|helper-write)/.test(value))return 70;
  if(/statement/.test(value))return 60;
  if(/semantic-structured-return/.test(value))return 95;
  if(/semantic-switch/.test(value))return 85;
  if(/semantic-/.test(value))return 65;
  return 40;
}
function resolveCanonicalPreferenceFacts(keys,directCandidates,legacyUi,supplement,ownership,caches){
  const ui={},ambiguousBindings=[],unresolvedBindings=[];
  for(const key of keys){
    const byId=new Map();
    const add=(id,evidence,origin,fact=null)=>{
      id=String(id||'');if(!id||!caches.controls.has(id))return;
      const current=byId.get(id)||{controlId:id,evidences:[],origins:new Set(),legacy:null,supplement:null};
      if(evidence&&!current.evidences.includes(String(evidence)))current.evidences.push(String(evidence));
      current.origins.add(origin);
      if(origin==='legacy')current.legacy=fact;
      if(origin==='supplement')current.supplement=fact;
      byId.set(id,current);
    };
    for(const candidate of directCandidates[key]||[])add(candidate.controlId,candidate.evidence,'direct');
    const legacy=legacyUi[key]||null;
    const extra=supplement[key];if(extra)add(extra.controlId,extra.evidence,'supplement',extra);
    const ranked=[...byId.values()].map(candidate=>{
      const owner=ownership.get(candidate.controlId),labelScore=(owner?.label?.rank||0)*100,directScore=candidate.evidences.reduce((max,value)=>Math.max(max,bindingEvidenceWeight(value)),0),originScore=(candidate.origins.has('supplement')?30:0)+(candidate.supplement?.structured?70:0);
      return{...candidate,owner,score:labelScore+directScore+originScore};
    }).sort((a,b)=>b.score-a.score||a.controlId.localeCompare(b.controlId));
    if(!ranked.length)continue;
    const top=ranked.filter(item=>item.score===ranked[0].score);
    if(top.length>1){
      ambiguousBindings.push({key,candidates:top.map(item=>({controlId:item.controlId,score:item.score,evidences:item.evidences}))});
      continue;
    }
    const selected=ranked[0],owner=selected.owner;
    if(!owner?.label?.ref){
      unresolvedBindings.push({key,controlId:selected.controlId,reason:owner?.ambiguousLabelRefs?.length?'ambiguous-label':'missing-structural-label'});
      continue;
    }
    const structured=selected.supplement?.structured||null,legacyForSelected=legacy&&String(legacy.controlId||'')===selected.controlId?legacy:null,description=(legacyForSelected?.description||selected.supplement?.description||null);
    ui[key]={controlId:selected.controlId,evidence:'canonical-source-owner',title:owner.label.ref,...(description?{description}:{}),...(structured?{structured}:{})};
  }
  return{ui,diagnostics:{ambiguousBindings,unresolvedBindings}};
}
function helperRanges(markup){
  const text=String(markup||''),out=[];
  for(const match of text.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)){
    const attrs=match[1]||'',start=match.index??0,end=start+match[0].length,onclick=attrText(attrs,'onclick')||'',id=attrText(attrs,'id')||('button@'+start);
    out.push({id,start,end,attrs,onclick,label:qbtOrLiteral(match[2]),sourceTag:'button'});
  }
  for(const match of text.matchAll(/<input\b([^>]*)>/gi)){
    const attrs=match[1]||'',type=String(attrText(attrs,'type')||'text').toLowerCase();if(!['button','submit','reset'].includes(type))continue;
    const start=match.index??0,end=start+match[0].length,onclick=attrText(attrs,'onclick')||'',id=attrText(attrs,'id')||('input-button@'+start),value=attrText(attrs,'value')||'';
    out.push({id,start,end,attrs,onclick,label:qbtOrLiteral(value),sourceTag:'input'});
  }
  return out.sort((a,b)=>a.start-b.start);
}
function qbtRefs(value){
  const out=[];for(const match of String(value||'').matchAll(/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([^\]]+)\]/gi)){const source=decodeHtml(match[1]),context=String(match[2]||'').trim();if(source&&context)out.push({source,context});}
  return out;
}
function sourceContentNodes(markup,tabs,caches){
  const text=String(markup||''),lists=[...elementRanges(text,'ul'),...elementRanges(text,'ol')].sort((a,b)=>a.start-b.start),out=[];
  for(const list of lists){
    if(!tabs.some(tab=>inside(tab.range,list.start)))continue;
    const body=text.slice(list.openEnd,list.endStart),items=[];
    for(const match of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)){const label=qbtOrLiteral(match[1]);if(label)items.push(label);}
    if(!items.length)continue;
    const parent=nearestContaining((caches.divs||[]).filter(div=>!String(attrText(div.attrs,'class')||'').split(/\s+/).includes('PrefTab')),list.start);
    if(parent){
      const prefix=text.slice(parent.openEnd,list.start);
      if(!/<(?:input|select|textarea|table|fieldset)\b/i.test(prefix)){
        const refs=qbtRefs(prefix),label=refs.at(-1)||null;
        if(label)out.push({kind:'content',contentKind:'note',id:'note@'+list.start,start:list.start-0.1,end:list.start,label,items:[],forControlId:null});
      }
    }
    out.push({kind:'content',contentKind:'list',id:'list@'+list.start,start:list.start,end:list.end,label:null,items,forControlId:null});
    if(parent){
      const suffix=text.slice(list.end,parent.endStart);
      if(!/<(?:input|select|textarea|table|fieldset|ul|ol)\b/i.test(suffix)){
        qbtRefs(suffix).forEach((label,index)=>out.push({kind:'content',contentKind:'hint',id:'hint@'+list.end+':'+index,start:list.end+(index+1)/100,end:list.end+(index+1)/100,label,items:[],forControlId:null}));
      }
    }
  }
  return out.sort((a,b)=>a.start-b.start);
}
function graphContentItem(content){
  return{kind:'content',contentKind:String(content?.contentKind||'note'),id:String(content?.id||''),forControlId:content?.forControlId??null,label:content?.label??null,items:Array.isArray(content?.items)?content.items:[]};
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
function balancedBlock(text,start){text=String(text||'');const open=text.indexOf('{',start);if(open<0)return'';let depth=0,quote='',escape=false,lineComment=false,blockComment=false;for(let i=open;i<text.length;i++){const ch=text[i],next=text[i+1];if(lineComment){if(ch==='\n')lineComment=false;continue;}if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue;}if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}if(ch==='"'||ch==="'"){quote=ch;continue;}if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0)return text.slice(open+1,i);}}return'';}
function sourceHelperAction(handler,markup){
  const value=String(handler||'').trim(),qualified=value.match(/^(?:window\.)?qBittorrent\.([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\(\s*\)\s*;?$/);
  if(qualified&&qualified[1]!=='Preferences')return{kind:'source-action',owner:qualified[1],name:qualified[2]};
  const match=value.match(/^(?:qBittorrent\.Preferences\.)?([A-Za-z_$][\w$]*)\(\s*\)\s*;?$/);
  if(!match)return{kind:'unknown'};
  const name=match[1],escaped=escapeRegex(name),text=String(markup||''),decl=new RegExp('\\b(?:(?:const|let|var)\\s+)?'+escaped+'\\s*=\\s*(?:\\(\\s*\\)\\s*=>|function\\s*\\(\\s*\\))\\s*\\{','g'),hit=decl.exec(text),body=hit?balancedBlock(text,hit.index):'';
  if(body){
    const targetFor=variable=>{
      const direct=body.match(new RegExp('document\\.getElementById\\(\\s*["\\\']([^"\\\']+)["\\\']\\s*\\)\\.value\\s*=\\s*'+escapeRegex(variable)+'\\s*;?'));
      if(direct)return direct[1];
      const mootools=body.match(new RegExp('\\$\\(\\s*["\\\']([^"\\\']+)["\\\']\\s*\\)\\.setProperty\\(\\s*["\\\']value["\\\']\\s*,\\s*'+escapeRegex(variable)+'\\s*\\)\\s*;?'));
      return mootools?mootools[1]:null;
    };
    const typed=body.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+Uint(8|16|32)Array\(\s*1\s*\)\s*;/),random=body.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*crypto\.getRandomValues\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\[\s*0\s*\]\s*;/);
    if(typed&&random&&typed[1]===random[2]){
      const variable=random[1],bits=Number(typed[2]),guard=body.match(new RegExp('while\\s*\\(\\s*'+escapeRegex(variable)+'\\s*<\\s*(\\d+)\\s*\\)')),target=targetFor(variable);
      if(guard&&target&&Number.isFinite(bits))return{kind:'random-int',targetControlId:target,min:Number(guard[1]),max:(2**bits)-1};
    }
    const numeric=new Map([...body.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(-?\d+)\s*;/g)].map(hit=>[hit[1],Number(hit[2])])),
      legacy=body.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*Math\.floor\(\s*Math\.random\(\s*\)\s*\*\s*\(\s*([A-Za-z_$][\w$]*)\s*-\s*([A-Za-z_$][\w$]*)\s*\+\s*1\s*\)\s*\+\s*([A-Za-z_$][\w$]*)\s*\)\s*;/);
    if(legacy&&legacy[3]===legacy[4]&&numeric.has(legacy[2])&&numeric.has(legacy[3])){
      const variable=legacy[1],min=numeric.get(legacy[3]),max=numeric.get(legacy[2]),target=targetFor(variable);
      if(target&&Number.isFinite(min)&&Number.isFinite(max)&&max>=min)return{kind:'random-int',targetControlId:target,min,max};
    }
  }
  return{kind:'source-helper',name};
}
function directValueControlId(expression){
  const text=String(expression||'').trim(),patterns=[
    /document\.getElementById\(\s*["']([^"']+)["']\s*\)\s*\.\s*value$/,
    /\$\(\s*["']([^"']+)["']\s*\)\s*\.\s*(?:value|getProperty\(\s*["']value["']\s*\))$/
  ];
  for(const re of patterns){const match=text.match(re);if(match)return String(match[1]||'');}
  return null;
}
function writeOnlyControlFacts(markup,descriptors){
  const text=String(markup||''),byKey=new Map((descriptors||[]).map(item=>[String(item?.key||''),item]).filter(([key])=>key)),variables=new Map(),out=new Map();
  for(const match of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)){const id=directValueControlId(match[2]);if(id)variables.set(match[1],id);}
  for(const match of text.matchAll(/settings\s*\[\s*["']([^"']+)["']\s*\]\s*=\s*([^;\n]+)/g)){
    const key=String(match[1]||''),descriptor=byKey.get(key);if(!descriptor||descriptor.getterPresent!==false||descriptor.setterPresent!==true||descriptor.writeType!=='string')continue;
    const expression=String(match[2]||'').trim(),id=directValueControlId(expression)||variables.get(expression);if(!id)continue;
    const before=text.slice(Math.max(0,(match.index||0)-500),match.index||0),omitEmpty=new RegExp('if\\s*\\(\\s*'+escapeRegex(expression)+'\\s*\\.\\s*length\\s*>\\s*0\\s*\\)').test(before);
    out.set(id,{key,writeType:'string',safeWrite:true,omitEmpty});
  }
  return out;
}
function functionBodies(markup){
  const text=String(markup||''),out=[],re=/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>\s*\{|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*function\s*\(([^)]*)\)\s*\{|\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g;
  let match;while((match=re.exec(text))){const name=String(match[1]||match[3]||match[5]||''),args=String(match[2]||match[4]||match[6]||'').split(',').map(value=>value.trim()).filter(Boolean),body=balancedBlock(text,match.index||0);if(name&&body)out.push({name,args,body});}
  return out;
}
function sourceDynamicOptions(markup,controlId){
  const text=String(markup||''),escaped=escapeRegex(controlId),selectRange=elementRanges(text,'select').find(item=>attrText(item.attrs,'id')===controlId)||null;
  if(selectRange){
    const body=text.slice(selectRange.openEnd,selectRange.endStart),template=body.match(/^\s*\$\{([A-Za-z_$][\w$]*)\}\s*$/);
    if(template)return{kind:'server-template-options',token:String(template[1])};
  }
  for(const fn of functionBodies(text)){
    const modernTarget=new RegExp('getElementById\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)').test(fn.body),legacyTarget=new RegExp('\\$\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)').test(fn.body);
    if((!modernTarget&&!legacyTarget)||!/\.options\.add\s*\(/.test(fn.body))continue;
    const endpointMatch=fn.body.match(/["']api\/v2\/([^"']+)["']/);if(!endpointMatch)continue;
    const endpoint=String(endpointMatch[1]||''),objectPair=fn.body.match(/new\s+Option\(\s*([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*,\s*\1\.([A-Za-z_$][\w$]*)\s*\)/),scalarPair=fn.body.match(/new\s+Option\(\s*([A-Za-z_$][\w$]*)\s*,\s*\1\s*\)/);
    let responseShape='unknown',labelField=null,valueField=null;if(objectPair){responseShape='object-array';labelField=objectPair[2];valueField=objectPair[3];}else if(scalarPair)responseShape='string-array';
    let queryParam=null,queryArg=null,dependsOnControlId=null;
    const query=fn.body.match(/new\s+URLSearchParams\(\s*\{\s*([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)\s*\}\s*\)/),legacyQuery=fn.body.match(/\bdata\s*:\s*\{\s*["']?([A-Za-z_$][\w$]*)["']?\s*:\s*([A-Za-z_$][\w$]*)\s*\}/);
    if(query||legacyQuery){
      const pair=query||legacyQuery;queryParam=pair[1];queryArg=pair[2];
      if(fn.args.includes(queryArg)){
        const modernCall=new RegExp('document\\.getElementById\\(\\s*["\\\']([^"\\\']+)["\\\']\\s*\\)\\.addEventListener\\(\\s*["\\\']change["\\\'][\\s\\S]{0,600}?'+escapeRegex(fn.name)+'\\(\\s*this\\.value').exec(text);
        const legacyCall=new RegExp('\\$\\(\\s*["\\\']([^"\\\']+)["\\\']\\s*\\)\\.addEvent\\(\\s*["\\\']change["\\\'][\\s\\S]{0,600}?'+escapeRegex(fn.name)+'\\(\\s*\\$\\(this\\)\\.(?:getProperty|get)\\(\\s*["\\\']value["\\\']\\s*\\)').exec(text);
        dependsOnControlId=(modernCall&&modernCall[1])||(legacyCall&&legacyCall[1])||null;
      }
    }
    const staticOptions=[];for(const option of fn.body.matchAll(/new\s+Option\(\s*["']([^"']*)["']\s*,\s*["']([^"']*)["']\s*\)/g)){const ref=qbtTr(option[1]);staticOptions.push({value:String(option[2]||''),label:ref||{literal:decodeHtml(option[1])}});}
    return{kind:'api-options',endpoint,responseShape,labelField,valueField,queryParam,dependsOnControlId,staticOptions};
  }
  return null;
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
function sourceDisplayFormat(markup,controlId){
  const text=String(markup||''),escaped=escapeRegex(controlId);
  const assignment=new RegExp('document\\.getElementById\\(\\s*["\\\']'+escaped+'["\\\']\\s*\\)\\s*\\.\\s*value\\s*=\\s*([A-Za-z_$][\\w$]*)\\s*\\(').exec(text);
  if(!assignment)return null;
  const name=escapeRegex(assignment[1]);
  const arrow=new RegExp('(?:const|let|var)\\s+'+name+'\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{([\\s\\S]{0,700}?)\\n\\s*\\};').exec(text);
  const declared=new RegExp('function\\s+'+name+'\\s*\\([^)]*\\)\\s*\\{([\\s\\S]{0,700}?)\\n\\s*\\}').exec(text);
  const body=String((arrow&&arrow[1])||(declared&&declared[1])||'');
  const valueMatch=/\b(?:let|const|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[A-Za-z_$][\w$]*\.toString\(\)\s*;?/.exec(body);
  const value=valueMatch&&valueMatch[1];
  if(!value)return null;
  const v=escapeRegex(value);
  if(!new RegExp('\\b'+v+'\\.length\\s*===?\\s*1\\b').test(body))return null;
  const tick=String.fromCharCode(96),template=tick+'0${'+value+'}'+tick;
  if(body.indexOf(template)<0&&!new RegExp('["\\\']0["\\\']\\s*\\+\\s*'+v).test(body))return null;
  if(!new RegExp('return\\s+'+v+'\\s*;').test(body))return null;
  return'zero-pad-2';
}
function graphControl(control,preferencesByControl,behavior,markup,role,rowEnd,writeOnlyByControl){
  const key=preferencesByControl.get(control.id)||null,preference=key&&preferencesByControl.preferences?.[key]||null,writeOnly=!key&&writeOnlyByControl&&writeOnlyByControl.get(control.id)||null;
  const condition=behavior.predicates?.[control.id]||gatePredicate(preference),adornment=(preference&&preference.control&&preference.control.unit)||immediateUnit(markup,control,null,null),dynamicOptions=control.semantic==='select'?sourceDynamicOptions(markup,control.id):null,displayFormat=sourceDisplayFormat(markup,control.id);
  return{id:control.id,preferenceKey:key,role:role||(key?'preference':'auxiliary'),semantic:control.semantic,staticDisabled:control.staticDisabled===true,label:(preference&&preference.title)||labelRefForControl(markup,control.id),adornment:adornment||null,suffix:immediateSuffix(markup,control,rowEnd),condition:condition||null,...(dynamicOptions?{dynamicOptions}:{}),...(writeOnly&&['text','password','textarea','select'].includes(control.semantic)?{writeOnly}:{}),...(displayFormat?{displayFormat}:{})};
}
function buildControlGraph(markup,tabs,fieldsets,caches,preferences,writeOnlyByControl){
  const preferenceById=new Map(),preferenceObject={};
  for(const [key,item] of Object.entries(preferences||{})){const id=String(item?.control?.id||'');if(id&&!preferenceById.has(id))preferenceById.set(id,key);preferenceObject[key]=item;}
  preferenceById.preferences=preferenceObject;
  const controlToPreference=Object.fromEntries([...preferenceById.entries()]),predicateAliases={...controlToPreference};
  for(const [key,item] of Object.entries(preferenceObject)){
    const projection=item?.projection||{},gateId=String(projection.gateControlId||'');if(!gateId||predicateAliases[gateId])continue;
    if(projection.kind==='sentinel-gate'&&projection.enabledWhen?.kind==='gt')predicateAliases[gateId]={predicate:{kind:'gt',key,value:Number(projection.enabledWhen.value)}};
    else if(projection.kind==='presence-gate')predicateAliases[gateId]=key;
  }
  const behavior=extractQbPreferencesBehaviorPredicates(markup,predicateAliases),helpers=helperRanges(markup),contents=sourceContentNodes(markup,tabs,caches),legends=elementRanges(markup,'legend'),formRows=(caches.divs||[]).filter(row=>String(attrText(row.attrs,'class')||'').split(/\s+/).includes('formRow')),tableRows=caches.trs||[],allRows=[...formRows,...tableRows].sort((a,b)=>a.start-b.start||a.end-b.end),graphTabs={},representedControls=new Set(),representedHelpers=new Set(),representedContents=new Set(),sourceControls=new Set(),sourceHelpers=new Set(),sourceContents=new Set(),legendControlIds=new Set();
  for(const tab of tabs){
    const tabFields=fieldsets.filter(item=>inside(tab.range,item.start)).sort((a,b)=>a.start-b.start),fieldIds=new Map(tabFields.map((item,index)=>[item,tab.id+':fieldset:'+index]));
    const graphFields=tabFields.map((item,index)=>{
      const parent=nearestContaining(tabFields.filter(candidate=>candidate!==item),item.start),legend=legends.find(value=>value.start>=item.openEnd&&value.end<=item.endStart),legendControls=[];
      if(legend){for(const control of caches.controls.values())if(inside(legend,control.start)){sourceControls.add(control.id);representedControls.add(control.id);legendControlIds.add(control.id);legendControls.push(graphControl(control,preferenceById,behavior,markup,'gate',legend.endStart,writeOnlyByControl));}}
      return{id:tab.id+':fieldset:'+index,parentId:parent?fieldIds.get(parent):null,title:directLegend(markup,item),template:legendControls.length?'nested-gated-fieldset':'fieldset',legendControls,sourceOrder:0,_sourcePos:item.start};
    });
    const rows=[],assignedControls=new Set(),assignedHelpers=new Set(),assignedContents=new Set(),tabRows=allRows.filter(row=>inside(tab.range,row.start)),tabContents=contents.filter(content=>inside(tab.range,content.start));
    for(const row of tabRows){
      const parent=nearestContaining(tabFields,row.start),sameField=pos=>nearestContaining(tabFields,pos)===parent;
      const controls=[...caches.controls.values()].filter(control=>inside(row,control.start)&&!legendControlIds.has(control.id)&&sameField(control.start)),rowHelpers=helpers.filter(helper=>inside(row,helper.start)&&sameField(helper.start)),rowContents=tabContents.filter(content=>inside(row,content.start)&&sameField(content.start));
      if(!controls.length&&!rowHelpers.length&&!rowContents.length)continue;
      const items=[];
      for(const control of controls){assignedControls.add(control.id);representedControls.add(control.id);sourceControls.add(control.id);items.push({kind:'control',...graphControl(control,preferenceById,behavior,markup,null,row.endStart,writeOnlyByControl)});}
      for(const helper of rowHelpers){assignedHelpers.add(helper.id);representedHelpers.add(helper.id);sourceHelpers.add(helper.id);items.push({kind:'helper',id:helper.id,role:'helper',label:helper.label,action:sourceHelperAction(helper.onclick,markup),condition:behavior.predicates?.[helper.id]||null});}
      for(const content of rowContents){assignedContents.add(content.id);representedContents.add(content.id);sourceContents.add(content.id);items.push(graphContentItem(content));}
      const mapped=items.filter(item=>item.kind==='control'&&item.preferenceKey).length,auxCheckbox=items.some(item=>item.kind==='control'&&!item.preferenceKey&&item.semantic==='checkbox'),hasHelper=items.some(item=>item.kind==='helper'),hasContent=items.some(item=>item.kind==='content');
      const template=hasContent&&!mapped&&!hasHelper?'content-only':hasHelper?(mapped>1?'inline-multi-helper':'control-helper'):(auxCheckbox&&mapped?'gated-sentinel':mapped>1?'inline-multi-control':'single-row');
      rows.push({id:tab.id+':row:'+rows.length,parentFieldsetId:parent?fieldIds.get(parent):null,order:rows.length,sourceOrder:0,_sourcePos:row.start,template,items});
    }
    for(const control of caches.controls.values()){
      if(!inside(tab.range,control.start))continue;
      sourceControls.add(control.id);if(legendControlIds.has(control.id)||assignedControls.has(control.id))continue;representedControls.add(control.id);const parent=nearestContaining(tabFields,control.start);
      rows.push({id:tab.id+':row:'+rows.length,parentFieldsetId:parent?fieldIds.get(parent):null,order:rows.length,sourceOrder:0,_sourcePos:control.start,template:'single-row',items:[{kind:'control',...graphControl(control,preferenceById,behavior,markup,null,null,writeOnlyByControl)}]});
    }
    for(const helper of helpers){
      if(!inside(tab.range,helper.start))continue;
      sourceHelpers.add(helper.id);if(assignedHelpers.has(helper.id))continue;representedHelpers.add(helper.id);const parent=nearestContaining(tabFields,helper.start);
      rows.push({id:tab.id+':row:'+rows.length,parentFieldsetId:parent?fieldIds.get(parent):null,order:rows.length,sourceOrder:0,_sourcePos:helper.start,template:'helper-only',items:[{kind:'helper',id:helper.id,role:'helper',label:helper.label,action:sourceHelperAction(helper.onclick,markup),condition:behavior.predicates?.[helper.id]||null}]});
    }
    for(const content of tabContents){
      sourceContents.add(content.id);if(assignedContents.has(content.id))continue;representedContents.add(content.id);const parent=nearestContaining(tabFields,content.start);
      rows.push({id:tab.id+':row:'+rows.length,parentFieldsetId:parent?fieldIds.get(parent):null,order:rows.length,sourceOrder:0,_sourcePos:content.start,template:'content-only',items:[graphContentItem(content)]});
    }
    for(const parentId of [null,...graphFields.map(field=>field.id)]){
      const children=[
        ...graphFields.filter(field=>field.parentId===parentId).map(field=>({node:field,pos:field._sourcePos})),
        ...rows.filter(row=>row.parentFieldsetId===parentId).map(row=>({node:row,pos:row._sourcePos}))
      ].sort((a,b)=>a.pos-b.pos);
      children.forEach((entry,index)=>{entry.node.sourceOrder=index;});
    }
    graphFields.forEach(field=>{delete field._sourcePos;});rows.forEach(row=>{delete row._sourcePos;});
    graphTabs[tab.id]={id:tab.id,fieldsets:graphFields,rows};
  }
  const mappedControls=new Set([...preferenceById.keys()]),unknownBehaviors=[...new Set([...Object.entries(behavior.predicates||{}).filter(([,predicate])=>predicate?.kind==='unknown').map(([controlId])=>controlId),...(behavior.unresolved||[]).map(item=>String(item?.controlId||'')).filter(Boolean)])],behaviorControls=new Set((behavior.assignments||[]).map(item=>String(item.controlId||'')).filter(Boolean)),sourceAdornmentControls=new Set([...caches.controls.values()].filter(control=>tabs.some(tab=>inside(tab.range,control.start))&&immediateUnit(markup,control,null,null)).map(control=>control.id)),graphItems=Object.values(graphTabs).flatMap(tab=>tab.rows.flatMap(row=>row.items).concat(tab.fieldsets.flatMap(field=>field.legendControls||[]))),representedAdornmentControls=new Set(graphItems.filter(item=>item.kind==='control'&&item.adornment).map(item=>item.id)),representedBehaviorControls=new Set([...behaviorControls].filter(id=>representedControls.has(id)||representedHelpers.has(id))),complete=sourceControls.size===representedControls.size&&sourceHelpers.size===representedHelpers.size&&sourceContents.size===representedContents.size&&sourceAdornmentControls.size===representedAdornmentControls.size&&behaviorControls.size===representedBehaviorControls.size&&unknownBehaviors.length===0;
  return{schemaVersion:1,tabs:graphTabs,census:{sourceControls:sourceControls.size,representedControls:representedControls.size,sourceHelpers:sourceHelpers.size,representedHelpers:representedHelpers.size,sourceActions:sourceHelpers.size,representedActions:representedHelpers.size,sourceContents:sourceContents.size,representedContents:representedContents.size,sourceCopyNodes:sourceContents.size,representedCopyNodes:representedContents.size,sourceAdornments:sourceAdornmentControls.size,representedAdornments:representedAdornmentControls.size,behaviorControls:behaviorControls.size,representedBehaviorControls:representedBehaviorControls.size,mappedPreferenceControls:mappedControls.size,behaviorAssignments:behavior.assignments.length,unknownBehaviors,complete}};
}


function timedTrace(trace,label,fn){const start=Date.now();trace?.(`${label} START`);const value=fn();trace?.(`${label} DONE ${Date.now()-start}ms`);return value;}

export function extractQbPreferencesNativeSurface({preferencesSource='',toolbarSource='',preferenceDescriptors=[],writeOnlyDescriptors=[],trace=null}={}){
  const descriptors=new Map((preferenceDescriptors||[]).map(item=>[String(item?.key||''),item])),writeOnlyByControl=writeOnlyControlFacts(preferencesSource,writeOnlyDescriptors);
  const keys=[...descriptors.keys()].filter(Boolean);
  const indexes=timedTrace(trace,'structural-indexes',()=>{
    const tabs=sourceTabs(preferencesSource,toolbarSource),fieldsets=elementRanges(preferencesSource,'fieldset'),selects=elementRanges(preferencesSource,'select'),textareas=elementRanges(preferencesSource,'textarea'),tables=elementRanges(preferencesSource,'table'),divs=elementRanges(preferencesSource,'div'),trs=elementRanges(preferencesSource,'tr'),caches={selects,textareas,tables,divs,trs,selectsById:rangeIndex(selects),textareasById:rangeIndex(textareas),tablesById:rangeIndex(tables)};
    caches.controls=controlIndex(preferencesSource,caches);
    return{tabs,fieldsets,caches};
  });
  const {tabs,fieldsets,caches}=indexes,ownership=timedTrace(trace,'source-ownership',()=>buildSourceOwnershipIndex(preferencesSource,tabs,fieldsets,caches));
  const directCandidates=timedTrace(trace,'binding-candidates',()=>extractQbPreferenceControlCandidates(preferencesSource,keys));
  const legacyUi=timedTrace(trace,'legacy-ui-adapter',()=>extractQbPreferenceUiFacts(preferencesSource,keys));
  const supplement=timedTrace(trace,'composite-ui-adapter',()=>extractQbPreferencesCompositeUiFacts(preferencesSource,keys));
  const resolved=timedTrace(trace,'ownership-resolver',()=>resolveCanonicalPreferenceFacts(keys,directCandidates,legacyUi,supplement,ownership,caches)),ui=resolved.ui;
  const uiByControl=new Map(Object.entries(ui).map(([key,item])=>[String(item?.controlId||''),key]).filter(([id])=>id)),preferences={},tabRows=[];
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
      const descriptor=descriptorSubset(descriptors.get(key)),projection=safeSourceWriteProjection(extractQbPreferenceValueProjection(preferencesSource,key,control.id),descriptor,control,fact);
      trace?.(`tab:${tab.id} pref:${key} projection DONE ${Date.now()-projectionStarted}ms kind=${projection?.kind||'unknown'}`);
      rows.push({key,sourcePos:control.start,sectionKey:nearest?String(nearest.start):'root',sectionRef,control,fact,gates,descriptor,projection});
      trace?.(`tab:${tab.id} pref:${key} DONE ${Date.now()-prefStarted}ms`);
    }
    rows.sort((a,b)=>a.sourcePos-b.sourcePos||a.key.localeCompare(b.key));
    const sections=[],sectionByTransition=[];let lastKey=null,current=null;
    rows.forEach((row,order)=>{if(row.sectionKey!==lastKey){current={id:`${tab.id}:${sections.length}`,order:sections.length,title:row.sectionRef||null,preferences:[]};sections.push(current);lastKey=row.sectionKey;}current.preferences.push(row.key);sectionByTransition[order]=current;});
    rows.forEach((row,order)=>{const section=sectionByTransition[order],options=selectOptions(preferencesSource,row.control),unit=immediateUnit(preferencesSource,row.control,row.descriptor,row.projection);preferences[row.key]={key:row.key,tab:tab.id,tabOrder,sectionId:section.id,sectionOrder:section.order,order,title:row.fact.title||null,description:row.fact.description||null,control:{id:row.control.id,tag:row.control.tag,type:row.control.type,semantic:row.control.semantic,attributes:row.control.attributes,classes:row.control.classes,handlers:row.control.handlers,staticDisabled:row.control.staticDisabled,options,...(unit?{unit}:{}),...(row.fact.structured?{structured:row.fact.structured}:{})},dependencies:{gates:row.gates},descriptor:row.descriptor,projection:row.projection};});
    tabRows.push({id:tab.id,nativeId:tab.nativeId,title:tab.title||null,order:tabOrder,sections,preferences:rows.map(row=>row.key)});
    trace?.(`tab:${tab.id} DONE ${Date.now()-tabStarted}ms rows=${rows.length}`);
  });
  const controlGraph=timedTrace(trace,'control-graph',()=>buildControlGraph(preferencesSource,tabs,fieldsets,caches,preferences,writeOnlyByControl));
  const graphLocations=new Map();
  for(const [tabId,graphTab] of Object.entries(controlGraph.tabs||{})){
    for(const field of graphTab.fieldsets||[])for(const item of field.legendControls||[])if(item.preferenceKey)graphLocations.set(item.preferenceKey,{tabId,fieldsetId:field.id,item});
    for(const row of graphTab.rows||[])for(const item of row.items||[])if(item.kind==='control'&&item.preferenceKey)graphLocations.set(item.preferenceKey,{tabId,fieldsetId:row.parentFieldsetId||null,item});
  }
  const duplicateControls=[],byControl=new Map();
  for(const [key,item] of Object.entries(preferences)){const id=String(item?.control?.id||'');if(!id)continue;const list=byControl.get(id)||[];list.push(key);byControl.set(id,list);}
  for(const [controlId,preferenceKeys] of byControl)if(preferenceKeys.length>1)duplicateControls.push({controlId,preferenceKeys});
  const crossTab=[],crossFieldset=[],crossRow=[],wrongSourceRef=[],missingLabels=[],ambiguousLabels=[];
  for(const [key,item] of Object.entries(preferences)){
    const owner=ownership.get(String(item?.control?.id||'')),location=graphLocations.get(key);
    if(!owner?.label?.ref)missingLabels.push(key);
    if(owner?.ambiguousLabelRefs?.length)ambiguousLabels.push({key,controlId:item.control.id,refs:owner.ambiguousLabelRefs});
    if(owner&&item.tab!==owner.tabId)crossTab.push({key,manifest:item.tab,source:owner.tabId});
    if(owner&&location&&String(location.fieldsetId||'')!==String(owner.fieldsetId||''))crossFieldset.push({key,graph:location.fieldsetId||null,source:owner.fieldsetId||null});
    if(String(owner?.label?.evidence||'').startsWith('E2:bounded-row')){
      const row=owner?.rowRange,labelRange=owner?.label?.sourceRange;
      if(!row||!labelRange||labelRange.start<row.start||labelRange.end>row.end)crossRow.push({key,controlId:item.control.id,evidence:owner?.label?.evidence||null});
    }
    if(owner?.label?.ref&&sourceRefIdentity(item.title)!==sourceRefIdentity(owner.label.ref))wrongSourceRef.push({key,controlId:item.control.id});
  }
  const missingOptions=[];
  for(const [key,item] of Object.entries(preferences)){
    if(item?.control?.semantic!=='select'||(item.control.options||[]).length)continue;
    const dynamic=graphLocations.get(key)?.item?.dynamicOptions;if(!dynamic)missingOptions.push(key);
  }
  const structural=controlGraph.census||{},ownershipCensus={
    schemaVersion:1,
    crossTabOwnershipMismatch:crossTab.length,
    crossFieldsetOwnershipMismatch:crossFieldset.length,
    crossRowOwnershipMismatch:crossRow.length,
    ambiguousBinding:resolved.diagnostics.ambiguousBindings.length,
    duplicatePreferenceOwnership:resolved.diagnostics.ambiguousBindings.length,
    duplicateControlOwnership:duplicateControls.length,
    wrongSourceRef:wrongSourceRef.length,
    ambiguousSourceRef:ambiguousLabels.length,
    missingRequiredLabel:missingLabels.length+resolved.diagnostics.unresolvedBindings.length,
    missingOptions:missingOptions.length,
    optionOrderMismatch:0,
    unaccountedNativeControl:Math.max(0,Number(structural.sourceControls||0)-Number(structural.representedControls||0)),
    unaccountedNativeHelper:Math.max(0,Number(structural.sourceHelpers||0)-Number(structural.representedHelpers||0)),
    unaccountedNativeContent:Math.max(0,Number(structural.sourceContents||0)-Number(structural.representedContents||0)),
    runtimeRelevantUnknownBehavior:Array.isArray(structural.unknownBehaviors)?structural.unknownBehaviors.length:0,
    details:{crossTab,crossFieldset,crossRow,ambiguousBindings:resolved.diagnostics.ambiguousBindings,unresolvedBindings:resolved.diagnostics.unresolvedBindings,duplicateControls,wrongSourceRef,ambiguousLabels,missingOptions}
  };
  ownershipCensus.complete=[
    'crossTabOwnershipMismatch','crossFieldsetOwnershipMismatch','crossRowOwnershipMismatch','ambiguousBinding','duplicatePreferenceOwnership','duplicateControlOwnership','wrongSourceRef','ambiguousSourceRef','missingRequiredLabel','missingOptions','optionOrderMismatch','unaccountedNativeControl','unaccountedNativeHelper','unaccountedNativeContent','runtimeRelevantUnknownBehavior'
  ].every(key=>Number(ownershipCensus[key]||0)===0);
  return{tabs:tabRows,preferences,controlGraph,structuralCensus:controlGraph.census,ownershipCensus,mappedPreferences:Object.keys(preferences).length,totalPreferences:keys.length};
}

function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function showMaybe(root,tag,file){try{return git(root,'show',`${tag}:${file}`);}catch{return'';}}
function preferencesSource(root,tag){for(const file of PREFERENCES_SOURCE_PATHS){const source=showMaybe(root,tag,file);if(source)return source;}return'';}
function toolbarSource(root,tag){for(const file of TOOLBAR_SOURCE_PATHS){const source=showMaybe(root,tag,file);if(source)return source;}return'';}
function appControllerSource(root,tag){return showMaybe(root,tag,APP_CONTROLLER_PATH);}
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
    const sourceStarted=Date.now(),source=preferencesSource(qbRoot,tag),toolbar=toolbarSource(qbRoot,tag),appSource=appControllerSource(qbRoot,tag);
    detail(`source-read DONE ${Date.now()-sourceStarted}ms sourceBytes=${source.length} toolbarBytes=${toolbar.length} appBytes=${appSource.length}`);
    if(!source||!appSource)throw new Error(`${qbVersion}: qB Preferences source is unavailable.`);
    const readable=new Set((profile.preferenceKeys||[]).map(String)),setterHints=extractPreferenceSetterHints(appSource,tag),writeOnlyDescriptors=[...setterHints.values()].filter(item=>item?.setterPresent===true&&item?.writeType&&!readable.has(String(item.key))).map(item=>({...item,getterPresent:false,readType:null,typeAgreement:'WRITE_ONLY',writable:true}));
    const manifest=extractQbPreferencesNativeSurface({preferencesSource:source,toolbarSource:toolbar,preferenceDescriptors:profile.preferenceDescriptors||[],writeOnlyDescriptors,trace:trace?(message=>detail(message)):null});
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

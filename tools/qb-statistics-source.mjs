import {parseQbtSourceRef} from './qb-source-text.mjs';

function escapeRe(value){return String(value||'').replace(/[.*+?^()|[\]\\$]/g,'\\$&');}
function ref(value){return parseQbtSourceRef(String(value||''));}
function slug(value,index){const base=String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');return base||('group-'+String(index+1));}
function assignmentMap(source){const out=new Map();for(const match of String(source||'').matchAll(/\bstatistics\.([A-Za-z0-9_]+)\s*=\s*serverState\.([A-Za-z0-9_]+)\s*;/g))out.set(match[1],match[2]);return out;}
function sinkExpression(source,id){
  const text=String(source||''),name=escapeRe(id),patterns=[
    new RegExp("\\$\\(\\s*[\"']"+name+"[\"']\\s*\\)\\.set\\(\\s*[\"'](?:html|text)[\"']\\s*,\\s*([^;]+)\\);","i"),
    new RegExp("\\$\\(\\s*[\"']"+name+"[\"']\\s*\\)\\.(?:textContent|innerHTML)\\s*=\\s*([^;]+);","i"),
    new RegExp("document\\.getElementById\\(\\s*[\"']"+name+"[\"']\\s*\\)\\.(?:textContent|innerHTML)\\s*=\\s*([^;]+);","i")
  ];
  for(const pattern of patterns){const match=pattern.exec(text);if(match)return String(match[1]||'').trim();}
  return'';
}
function serverField(expression,assignments,context,id){
  const direct=[...String(expression||'').matchAll(/\bserverState\.([A-Za-z0-9_]+)/g)].map(match=>match[1]);
  const projected=[...String(expression||'').matchAll(/\bstatistics\.([A-Za-z0-9_]+)/g)].map(match=>assignments.get(match[1])).filter(Boolean);
  const fields=[...new Set([...direct,...projected])];
  if(fields.length!==1)throw new Error(`${context}: Statistics field ${id} has ${fields.length?'ambiguous':'no'} source-proven server_state binding`);
  return fields[0];
}
function formatKind(expression){
  const value=String(expression||'');
  if(/friendlyUnit\s*\(/.test(value))return'bytes';
  if(value.includes('%'))return'percent';
  if(value.includes(' ms'))return'milliseconds';
  return'plain';
}
export function validateQbStatisticsUi(value,context='qB Statistics'){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Array.isArray(value.groups)||!value.groups.length)throw new Error(`${context}: Statistics UI groups are unresolved`);
  const seenGroups=new Set(),seenFields=new Set(),groups=value.groups.map((group,index)=>{
    const key=String(group?.key||'').trim();
    if(!key||seenGroups.has(key))throw new Error(`${context}: invalid/duplicate Statistics group ${key||index}`);seenGroups.add(key);
    const translation=group.translation;
    if(!translation?.source||!translation?.context)throw new Error(`${context}: Statistics group ${key} translation ref is invalid`);
    if(!Array.isArray(group.fields)||!group.fields.length)throw new Error(`${context}: Statistics group ${key} has no fields`);
    const fields=group.fields.map(field=>{
      const id=String(field?.id||'').trim(),dataProperty=String(field?.dataProperty||'').trim(),format=String(field?.format||'').trim();
      if(!id||seenFields.has(id))throw new Error(`${context}: invalid/duplicate Statistics field ${id||'(empty)'}`);seenFields.add(id);
      if(!dataProperty)throw new Error(`${context}: Statistics field ${id} has no server_state property`);
      if(!['bytes','percent','milliseconds','plain'].includes(format))throw new Error(`${context}: Statistics field ${id} has invalid format ${format}`);
      if(!field.translation?.source||!field.translation?.context)throw new Error(`${context}: Statistics field ${id} translation ref is invalid`);
      return{id,dataProperty,format,translation:{source:String(field.translation.source),context:String(field.translation.context)}};
    });
    return{key,translation:{source:String(translation.source),context:String(translation.context)},fields};
  });
  return{groups};
}
export function statisticsUiBindingCount(value){return (value?.groups||[]).reduce((sum,group)=>sum+1+(group?.fields||[]).length,0);}
export function extractQbStatisticsUi({markupSource='',runtimeSource=''}={},context='qB source'){
  const markup=String(markupSource||''),runtime=String(runtimeSource||''),assignments=assignmentMap(runtime),groups=[],seenKeys=new Set();
  const groupRe=/<h3\b[^>]*>([\s\S]*?)<\/h3>\s*<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  for(const groupMatch of markup.matchAll(groupRe)){
    const translation=ref(groupMatch[1]);
    if(!translation)throw new Error(`${context}: Statistics group translation is unresolved`);
    let key=slug(translation.source,groups.length),suffix=2;while(seenKeys.has(key))key=slug(translation.source,groups.length)+'-'+suffix++;seenKeys.add(key);
    const fields=[];
    for(const row of String(groupMatch[2]||'').matchAll(/<tr\b[^>]*>[\s\S]*?<td\b[^>]*>([\s\S]*?)<\/td>\s*<td\b[^>]*\bid=["']([^"']+)["'][^>]*>[\s\S]*?<\/td>[\s\S]*?<\/tr>/gi)){
      const fieldRef=ref(row[1]),id=String(row[2]||'').trim();
      if(!fieldRef||!id)throw new Error(`${context}: Statistics row copy/id is unresolved`);
      const expression=sinkExpression(runtime,id);
      if(!expression)throw new Error(`${context}: Statistics field ${id} render sink is unresolved`);
      fields.push({id,dataProperty:serverField(expression,assignments,context,id),format:formatKind(expression),translation:fieldRef});
    }
    if(!fields.length)throw new Error(`${context}: Statistics group ${translation.source} has no source-proven rows`);
    groups.push({key,translation,fields});
  }
  return validateQbStatisticsUi({groups},context);
}
export function statisticsTranslationRefs(ui){const out={};for(const group of ui?.groups||[]){out[`statistics.group.${group.key}`]=group.translation;for(const field of group.fields||[])out[`statistics.field.${field.id}`]=field.translation;}return out;}

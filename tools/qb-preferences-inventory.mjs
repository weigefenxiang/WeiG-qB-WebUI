import {accountSourceInventory} from './qb-source-census.mjs';

function attrText(value,name){
  const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=String(value||'').match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'));
  return match?String(match[1]??match[2]??match[3]??''):null;
}
function tabSlug(value){return String(value||'').replace(/Tab$/i,'').replace(/[^A-Za-z0-9]+/g,'').toLowerCase();}
function uniqueByFirstPosition(rows,key='key'){
  const seen=new Set(),out=[];
  for(const row of [...rows].sort((a,b)=>a.position-b.position)){
    const value=String(row?.[key]||'').trim();
    if(!value||seen.has(value))continue;
    seen.add(value);out.push(row);
  }
  return out;
}
function mergeBindings(rows){
  const byControl=new Map();
  for(const row of [...rows].sort((a,b)=>a.position-b.position)){
    const key=String(row?.key||'').trim();if(!key)continue;
    const current=byControl.get(key)||{key,preferenceKeys:[],syntax:[],position:row.position??0};
    current.position=Math.min(current.position,row.position??current.position);
    for(const value of row.preferenceKeys||[])if(!current.preferenceKeys.includes(value))current.preferenceKeys.push(value);
    for(const value of row.syntax||[])if(!current.syntax.includes(value))current.syntax.push(value);
    byControl.set(key,current);
  }
  return [...byControl.values()].sort((a,b)=>a.position-b.position);
}
function preferenceRefs(value,descriptorKeys){
  const out=[];
  const add=(key,syntax,position)=>{key=String(key||'').trim();if(!key||(descriptorKeys.size&&!descriptorKeys.has(key)))return;out.push({key,syntax,position});};
  for(const match of String(value||'').matchAll(/\bpref\s*\.\s*([A-Za-z_$][\w$]*)/g))add(match[1],'dot',match.index??0);
  for(const match of String(value||'').matchAll(/\bpref\s*\[\s*(['"])(.*?)\1\s*\]/g))add(match[2],'bracket',match.index??0);
  return out;
}
function writeFacts(source,descriptorKeys){
  const text=String(source||''),bindings=[],refs=[];
  const acceptKey=(key)=>{key=String(key||'').trim();return key&&(!descriptorKeys.size||descriptorKeys.has(key))?key:'';};
  const controlIds=(statement)=>{
    const out=[];
    for(const match of String(statement||'').matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)/g))if(!out.includes(match[1]))out.push(match[1]);
    for(const match of String(statement||'').matchAll(/\$\(\s*["']([^"']+)["']\s*\)/g))if(!out.includes(match[1]))out.push(match[1]);
    return out;
  };
  const add=(key,statement,position,family)=>{
    key=acceptKey(key);if(!key)return;
    const ids=controlIds(statement);if(!ids.length)return;
    refs.push({key,syntax:`write:${family}`,position:position??0});
    for(const id of ids)bindings.push({key:id,preferenceKeys:[key],syntax:[`write:${family}`],position:position??0});
  };
  for(const match of text.matchAll(/settings\.set\(\s*["']([^"']+)["']\s*,[^;\n]*?\)\s*;?/g))add(match[1],match[0],match.index,'settings-set');
  for(const match of text.matchAll(/settings\[\s*["']([^"']+)["']\s*\]\s*=\s*[^;\n]*;?/g))add(match[1],match[0],match.index,'indexed-settings');
  for(const match of text.matchAll(/(?:settings|preferences)\.([A-Za-z0-9_]+)\s*=\s*[^;\n]*;?/g))add(match[1],match[0],match.index,'property-settings');
  for(const match of text.matchAll(/(?:^|[,{;]\s*)([A-Za-z0-9_]+)\s*:\s*[^,;\n]*(?:document\.getElementById|\$)\([^,;\n]*[,;]?/gm))add(match[1],match[0],match.index,'object-entry');

  const controlVars=new Map();
  for(const match of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*?(?:document\.getElementById\(\s*["']([^"']+)["']\s*\)|\$\(\s*["']([^"']+)["']\s*\))[^;\n]*;?/g))controlVars.set(match[1],match[2]||match[3]);
  for(const match of text.matchAll(/settings\[\s*["']([^"']+)["']\s*\]\s*=\s*([A-Za-z_$][\w$]*)\s*;/g)){
    const key=acceptKey(match[1]),id=controlVars.get(match[2]);if(!key||!id)continue;
    refs.push({key,syntax:'write:indexed-variable',position:match.index??0});
    bindings.push({key:id,preferenceKeys:[key],syntax:['write:indexed-variable'],position:match.index??0});
  }
  return{refs:uniqueByFirstPosition(refs),bindings:mergeBindings(bindings)};
}
function sourceBindings(source,descriptorKeys){
  const text=String(source||''),rows=[];
  const addStatement=(controlId,statement,position,family)=>{
    const refs=preferenceRefs(statement,descriptorKeys);
    if(!refs.length)return;
    rows.push({key:String(controlId),preferenceKeys:[...new Set(refs.map(item=>item.key))],syntax:[...new Set(refs.map(item=>`${family}:${item.syntax}`))],position:position??0});
  };
  for(const match of text.matchAll(/document\.getElementById\(\s*["']([^"']+)["']\s*\)[^;\n]*?=[^;\n]*;?/g))addStatement(match[1],match[0],match.index,'modern-assignment');
  for(const match of text.matchAll(/\$\(\s*["']([^"']+)["']\s*\)[^;\n]*?=[^;\n]*;?/g))addStatement(match[1],match[0],match.index,'legacy-assignment');
  for(const match of text.matchAll(/\$\(\s*["']([^"']+)["']\s*\)\.(?:setProperty|set)\([^;\n]*\)\s*;?/g))addStatement(match[1],match[0],match.index,'legacy-set');

  const keyVars=new Map();
  for(const match of text.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*?\bpref\s*\.\s*([A-Za-z_$][\w$]*)/g)){
    const key=String(match[2]||'');if(!descriptorKeys.size||descriptorKeys.has(key))keyVars.set(match[1],key);
  }
  for(const [name,key] of keyVars){
    const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const patterns=[
      {re:new RegExp(`document\\.getElementById\\(\\s*["']([^"']+)["']\\s*\\)[^;\\n]*?\\b${escaped}\\b[^;\\n]*;?`,'g'),family:'modern-variable'},
      {re:new RegExp(`\\$\\(\\s*["']([^"']+)["']\\s*\\)[^;\\n]*?\\b${escaped}\\b[^;\\n]*;?`,'g'),family:'legacy-variable'}
    ];
    for(const item of patterns)for(const match of text.matchAll(item.re))rows.push({key:match[1],preferenceKeys:[key],syntax:[item.family],position:match.index??0});
  }
  const writes=writeFacts(text,descriptorKeys);
  return{bindings:mergeBindings([...rows,...writes.bindings]),writeRefs:writes.refs};
}

export function extractQbPreferencesInventory({preferencesSource='',preferenceDescriptors=[]}={}){
  const source=String(preferencesSource||''),descriptorKeys=new Set((preferenceDescriptors||[]).map(item=>String(item?.key||'').trim()).filter(Boolean));
  const tabs=[];
  for(const match of source.matchAll(/<div\b([^>]*)>/gi)){
    const attrs=match[1]||'',classes=String(attrText(attrs,'class')||'').split(/\s+/).filter(Boolean);
    if(!classes.includes('PrefTab'))continue;
    const nativeId=String(attrText(attrs,'id')||'').trim(),key=tabSlug(nativeId);
    if(key)tabs.push({key,nativeId,position:match.index??0});
  }
  const controls=[];
  for(const match of source.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)){
    const id=String(attrText(match[2]||'','id')||'').trim();
    if(id)controls.push({key:id,tag:String(match[1]||'').toLowerCase(),position:match.index??0});
  }
  const readRefs=preferenceRefs(source,descriptorKeys),bindingFacts=sourceBindings(source,descriptorKeys),refs=uniqueByFirstPosition([...readRefs,...bindingFacts.writeRefs]);
  return{
    tabs:uniqueByFirstPosition(tabs),
    controls:uniqueByFirstPosition(controls),
    preferenceRefs:refs,
    bindings:bindingFacts.bindings,
    descriptorCount:descriptorKeys.size,
    referencedDescriptorCount:new Set(refs.map(item=>item.key)).size
  };
}

export function auditQbPreferencesInventory({inventory,manifest,exclusions={}}={}){
  if(!inventory||!manifest)throw new Error('Preferences inventory audit requires independent inventory + semantic manifest.');
  const mappedTabs=(manifest.tabs||[]).map(item=>({key:String(item?.id||'')}));
  const mappedPreferences=Object.keys(manifest.preferences||{}).map(key=>({key}));
  const mappedControlIds=[...new Set(Object.values(manifest.preferences||{}).map(item=>String(item?.control?.id||'')).filter(Boolean))];
  const mappedControls=mappedControlIds.map(key=>({key}));
  const rawControls=(inventory.controls||[]).map(item=>String(item?.key||'')).filter(Boolean);
  return{
    tabs:accountSourceInventory({inventory:inventory.tabs||[],mapped:mappedTabs,excluded:exclusions.tabs||[]}),
    preferences:accountSourceInventory({inventory:inventory.preferenceRefs||[],mapped:mappedPreferences,excluded:exclusions.preferences||[]}),
    bindings:accountSourceInventory({inventory:inventory.bindings||[],mapped:mappedControls,excluded:exclusions.bindings||[]}),
    rawControls:{inventoryCount:rawControls.length,mappedControlCount:mappedControlIds.length,unmappedControls:rawControls.filter(id=>!mappedControlIds.includes(id))}
  };
}

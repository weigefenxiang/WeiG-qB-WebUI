import {accountSourceInventory} from './qb-source-census.mjs';

function attrText(value,name){
  const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=String(value||'').match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'));
  return match?String(match[1]??match[2]??match[3]??''):null;
}
function tabSlug(value){return String(value||'').replace(/Tab$/i,'').replace(/[^A-Za-z0-9]+/g,'').toLowerCase();}
function uniqueByFirstPosition(rows,key='key'){
  const seen=new Set(),out=[];
  for(const row of rows.sort((a,b)=>a.position-b.position)){
    const value=String(row?.[key]||'').trim();
    if(!value||seen.has(value))continue;
    seen.add(value);out.push(row);
  }
  return out;
}
function preferenceRefs(value,descriptorKeys){
  const out=[];
  const add=(key,syntax,position)=>{key=String(key||'').trim();if(!key||(descriptorKeys.size&&!descriptorKeys.has(key)))return;out.push({key,syntax,position});};
  for(const match of String(value||'').matchAll(/\bpref\s*\.\s*([A-Za-z_$][\w$]*)/g))add(match[1],'dot',match.index??0);
  for(const match of String(value||'').matchAll(/\bpref\s*\[\s*(['"])(.*?)\1\s*\]/g))add(match[2],'bracket',match.index??0);
  return out;
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
  return uniqueByFirstPosition(rows);
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
  const refs=preferenceRefs(source,descriptorKeys);
  return{
    tabs:uniqueByFirstPosition(tabs),
    controls:uniqueByFirstPosition(controls),
    preferenceRefs:uniqueByFirstPosition(refs),
    bindings:sourceBindings(source,descriptorKeys),
    descriptorCount:descriptorKeys.size,
    referencedDescriptorCount:new Set(refs.map(item=>item.key)).size
  };
}

export function auditQbPreferencesInventory({inventory,manifest,exclusions={}}={}){
  if(!inventory||!manifest)throw new Error('Preferences inventory audit requires independent inventory + semantic manifest.');
  const mappedTabs=(manifest.tabs||[]).map(item=>({key:String(item?.id||'')}));
  const mappedPreferences=Object.keys(manifest.preferences||{}).map(key=>({key}));
  const mappedControls=Object.values(manifest.preferences||{}).map(item=>({key:String(item?.control?.id||'')})).filter(item=>item.key);
  const mappedControlIds=new Set(mappedControls.map(item=>item.key));
  const rawControls=(inventory.controls||[]).map(item=>String(item?.key||'')).filter(Boolean);
  return{
    tabs:accountSourceInventory({inventory:inventory.tabs||[],mapped:mappedTabs,excluded:exclusions.tabs||[]}),
    preferences:accountSourceInventory({inventory:inventory.preferenceRefs||[],mapped:mappedPreferences,excluded:exclusions.preferences||[]}),
    bindings:accountSourceInventory({inventory:inventory.bindings||[],mapped:mappedControls,excluded:exclusions.bindings||[]}),
    rawControls:{inventoryCount:rawControls.length,mappedControlCount:mappedControlIds.size,unmappedControls:rawControls.filter(id=>!mappedControlIds.has(id))}
  };
}

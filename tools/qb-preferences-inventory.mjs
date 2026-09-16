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
  const preferenceRefs=[];
  for(const match of source.matchAll(/\bpref\s*\.\s*([A-Za-z_$][\w$]*)/g)){
    const key=String(match[1]||'').trim();
    if(key&&(!descriptorKeys.size||descriptorKeys.has(key)))preferenceRefs.push({key,syntax:'dot',position:match.index??0});
  }
  for(const match of source.matchAll(/\bpref\s*\[\s*(['"])(.*?)\1\s*\]/g)){
    const key=String(match[2]||'').trim();
    if(key&&(!descriptorKeys.size||descriptorKeys.has(key)))preferenceRefs.push({key,syntax:'bracket',position:match.index??0});
  }
  return{
    tabs:uniqueByFirstPosition(tabs),
    controls:uniqueByFirstPosition(controls),
    preferenceRefs:uniqueByFirstPosition(preferenceRefs),
    descriptorCount:descriptorKeys.size,
    referencedDescriptorCount:new Set(preferenceRefs.map(item=>item.key)).size
  };
}

export function auditQbPreferencesInventory({inventory,manifest,exclusions={}}={}){
  if(!inventory||!manifest)throw new Error('Preferences inventory audit requires independent inventory + semantic manifest.');
  const mappedTabs=(manifest.tabs||[]).map(item=>({key:String(item?.id||'')}));
  const mappedPreferences=Object.keys(manifest.preferences||{}).map(key=>({key}));
  const mappedControls=Object.values(manifest.preferences||{}).map(item=>({key:String(item?.control?.id||'')})).filter(item=>item.key);
  return{
    tabs:accountSourceInventory({inventory:inventory.tabs||[],mapped:mappedTabs,excluded:exclusions.tabs||[]}),
    preferences:accountSourceInventory({inventory:inventory.preferenceRefs||[],mapped:mappedPreferences,excluded:exclusions.preferences||[]}),
    controls:accountSourceInventory({inventory:inventory.controls||[],mapped:mappedControls,excluded:exclusions.controls||[]})
  };
}

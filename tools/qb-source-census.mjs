function defaultKey(item){
  if(typeof item==='string'||typeof item==='number')return String(item);
  if(item&&typeof item==='object')return String(item.key??item.id??'');
  return'';
}
function indexed(items,keyOf){
  const keys=[],counts=new Map();
  for(const item of items||[]){const key=String(keyOf(item)||'').trim();if(!key)throw new Error('Source census entries require a stable non-empty key.');keys.push(key);counts.set(key,(counts.get(key)||0)+1);}
  return{keys,duplicates:[...counts].filter(([,count])=>count>1).map(([key])=>key)};
}

export function accountSourceInventory({inventory=[],mapped=[],excluded=[],keyOf=defaultKey}={}){
  if(!Array.isArray(inventory)||!Array.isArray(mapped)||!Array.isArray(excluded))throw new Error('Source census requires inventory, mapped, and excluded arrays.');
  for(const item of excluded){if(!item||typeof item!=='object'||!String(item.reason||'').trim())throw new Error(`Source census exclusion ${defaultKey(item)||'unknown'} requires an explicit review reason.`);}
  const inventoryIndex=indexed(inventory,keyOf),mappedIndex=indexed(mapped,keyOf),excludedIndex=indexed(excluded,keyOf),inventorySet=new Set(inventoryIndex.keys),mappedSet=new Set(mappedIndex.keys),excludedSet=new Set(excludedIndex.keys);
  const overlap=[...mappedSet].filter(key=>excludedSet.has(key));
  const escaped=[...new Set([...mappedSet,...excludedSet])].filter(key=>!inventorySet.has(key));
  const unaccounted=[...inventorySet].filter(key=>!mappedSet.has(key)&&!excludedSet.has(key));
  const duplicates={inventory:inventoryIndex.duplicates,mapped:mappedIndex.duplicates,excluded:excludedIndex.duplicates};
  const complete=!overlap.length&&!escaped.length&&!unaccounted.length&&!duplicates.inventory.length&&!duplicates.mapped.length&&!duplicates.excluded.length;
  return{inventoryCount:inventoryIndex.keys.length,mappedCount:mappedIndex.keys.length,excludedCount:excludedIndex.keys.length,duplicates,overlap,escaped,unaccounted,complete};
}

export function assertCompleteSourceCensus(result,label='source census'){
  if(result?.complete)return true;
  const parts=[];
  if(result?.unaccounted?.length)parts.push(`unaccounted=${result.unaccounted.join(',')}`);
  if(result?.overlap?.length)parts.push(`mapped/excluded overlap=${result.overlap.join(',')}`);
  if(result?.escaped?.length)parts.push(`escaped=${result.escaped.join(',')}`);
  for(const kind of ['inventory','mapped','excluded'])if(result?.duplicates?.[kind]?.length)parts.push(`duplicate ${kind}=${result.duplicates[kind].join(',')}`);
  throw new Error(`${label} is incomplete: ${parts.join('; ')||'unknown accounting failure'}.`);
}

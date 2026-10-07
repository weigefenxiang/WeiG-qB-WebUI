function assertInteger(value,label,min=0){const n=Number(value);if(!Number.isInteger(n)||n<min)throw new Error(`${label} must be an integer >= ${min}.`);return n;}
function normalizeTags(tags){const values=(tags||[]).map(value=>String(value||'').trim()).filter(Boolean);if(!values.length)throw new Error('Stable tag set must not be empty.');const seen=new Set();for(const tag of values){if(seen.has(tag))throw new Error(`Duplicate stable tag ${tag}.`);seen.add(tag);}return values;}
export function selectStableTagShard(tags,shardIndex,shardCount){
  const expected=normalizeTags(tags),count=assertInteger(shardCount,'shardCount',1),index=assertInteger(shardIndex,'shardIndex',0);
  if(index>=count)throw new Error(`shardIndex ${index} must be below shardCount ${count}.`);
  return expected.filter((_tag,ordinal)=>ordinal%count===index);
}
export function buildReleaseCatalogShard(expectedTags,profiles,shardIndex,shardCount){
  const expected=normalizeTags(expectedTags),count=assertInteger(shardCount,'shardCount',1),index=assertInteger(shardIndex,'shardIndex',0);
  const assigned=selectStableTagShard(expected,index,count),items=Array.isArray(profiles)?profiles:[];
  const actual=items.map(item=>String(item?.tag||''));
  if(JSON.stringify(actual)!==JSON.stringify(assigned))throw new Error(`Catalog shard ${index}/${count} profile/tag assignment drift.`);
  return{schemaVersion:1,source:'qb-stable-source-catalog-shard',shardIndex:index,shardCount:count,expectedTags:expected,profiles:items};
}
export function mergeReleaseCatalogShards(shards,expectedShardCount){
  const count=assertInteger(expectedShardCount,'expectedShardCount',1),items=Array.isArray(shards)?shards:[];
  if(items.length!==count)throw new Error(`Expected ${count} catalog shards, got ${items.length}.`);
  let expectedTags=null;const seenIndexes=new Set(),byTag=new Map();
  for(const shard of items){
    if(!shard||shard.schemaVersion!==1||shard.source!=='qb-stable-source-catalog-shard')throw new Error('Invalid qB stable source catalog shard envelope.');
    if(Number(shard.shardCount)!==count)throw new Error(`Catalog shard count drift: ${shard.shardCount} != ${count}.`);
    const index=assertInteger(shard.shardIndex,'shardIndex',0);if(index>=count||seenIndexes.has(index))throw new Error(`Duplicate/invalid catalog shard index ${index}.`);seenIndexes.add(index);
    const tags=normalizeTags(shard.expectedTags);
    if(expectedTags===null)expectedTags=tags;else if(JSON.stringify(tags)!==JSON.stringify(expectedTags))throw new Error(`Catalog shard ${index} expected-tag snapshot drift.`);
    const assigned=selectStableTagShard(tags,index,count),profiles=Array.isArray(shard.profiles)?shard.profiles:[],actual=profiles.map(item=>String(item?.tag||''));
    if(JSON.stringify(actual)!==JSON.stringify(assigned))throw new Error(`Catalog shard ${index} profile/tag assignment drift.`);
    for(const profile of profiles){const tag=String(profile?.tag||'');if(byTag.has(tag))throw new Error(`Duplicate catalog profile ${tag}.`);byTag.set(tag,profile);}
  }
  for(let index=0;index<count;index++)if(!seenIndexes.has(index))throw new Error(`Missing catalog shard ${index}.`);
  const missing=expectedTags.filter(tag=>!byTag.has(tag)),unexpected=[...byTag.keys()].filter(tag=>!expectedTags.includes(tag));
  if(missing.length||unexpected.length)throw new Error(`Catalog shard coverage mismatch: missing=${missing.join(',')||'none'} unexpected=${unexpected.join(',')||'none'}.`);
  return expectedTags.map(tag=>byTag.get(tag));
}

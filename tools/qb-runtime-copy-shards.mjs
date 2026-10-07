import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const RUNTIME_SOURCE_REFS=[
  ['HttpServer','External IP: %1%2'],
  ['HttpServer','External IPs: %1, %2'],
  ['HttpServer','External IP: N/A'],
  ['HttpServer','Free space: %1']
];
const encodeField=value=>encodeURIComponent(String(value??''));
const safeLocale=value=>{const locale=String(value||'').trim();if(!/^[A-Za-z0-9@._-]+$/.test(locale))throw new Error('Unsafe qB locale asset name: '+locale);return locale;};
const majorOf=value=>String(value||'').replace(/^v/i,'').split('.')[0]||'0';
function versionParts(value){return String(value||'0').replace(/^v/i,'').split(/[+-]/)[0].split('.').map(x=>Number.parseInt(x,10)||0);}
function compareVersion(a,b){const x=versionParts(a),y=versionParts(b),n=Math.max(x.length,y.length);for(let i=0;i<n;i++){const av=x[i]||0,bv=y[i]||0;if(av!==bv)return av-bv;}return 0;}
function tokenOrder(a,b){return Number.parseInt(a,36)-Number.parseInt(b,36);}
function stableObject(value){if(Array.isArray(value))return value.map(stableObject);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=stableObject(value[key]);return out;}return value;}
function contentId(prefix,value){return prefix+crypto.createHash('sha256').update(JSON.stringify(stableObject(value))).digest('hex').slice(0,20);}
function normalizedLocales(value){return [...new Set((value||[]).map(item=>String(item||'').trim()).filter(Boolean))].sort();}
export function copyRouteDescriptor(profile){
  const fallbackSets=profile?.bridges||profile?.fallbackSets||{};
  return stableObject({schemaVersion:1,source:'qB-copy-semantic-route',family:String(profile?.family||''),bindingId:String(profile?.bindingId||''),nativeLocales:normalizedLocales(profile?.nativeLocales),fallbackLocales:normalizedLocales(profile?.bridgeLocales||profile?.fallbackLocales),fallbackSets});
}
export function copyRouteId(profile){return contentId('r',copyRouteDescriptor(profile));}

function runtimeRefIds(bundle,binding){
  const ids=new Set();
  for(const entry of Object.values(binding?.preferences||{})){if(entry?.title)ids.add(entry.title);if(entry?.description)ids.add(entry.description);}
  for(const id of Object.values(binding?.ui||{}))if(id)ids.add(id);
  for(const [id,ref] of Object.entries(bundle?.refs||{}))if(RUNTIME_SOURCE_REFS.some(([context,source])=>ref?.context===context&&ref?.source===source))ids.add(id);
  return [...ids].sort();
}
export function ownedCopyProfileManifest(profile){
  return{schemaVersion:1,source:'qB-source-context-runtime-copy-profile',sourceSha:String(profile?.sourceSha||''),qbVersion:String(profile?.qbVersion||''),routeId:copyRouteId(profile),family:String(profile?.family||''),bindingId:String(profile?.bindingId||''),nativeLocales:[...(profile?.nativeLocales||[])],fallbackLocales:[...(profile?.bridgeLocales||[])],fallbackSets:{...(profile?.bridges||{})}};
}
export function renderOwnedCopyBinding(bundle,bindingId){
  const binding=bundle?.bindings?.[bindingId];if(!binding)throw new Error('Unknown qB copy binding '+bindingId);
  const lines=['# WeiG qB-owned binding runtime v1',`@@BINDING\t${bindingId}`];
  for(const key of Object.keys(binding.preferences||{}).sort()){const entry=binding.preferences[key];lines.push(`@@PREF\t${encodeField(key)}\t${encodeField(entry.controlId||'')}\t${entry.title}\t${entry.description||'-'}`);}
  for(const key of Object.keys(binding.ui||{}).sort())lines.push(`@@UI\t${encodeField(key)}\t${binding.ui[key]}`);
  for(const id of runtimeRefIds(bundle,binding)){const ref=bundle.refs[id];if(!ref)throw new Error('Missing qB copy ref '+id+' for '+bindingId);lines.push(`@@REF\t${id}\t${encodeField(ref.context)}\t${encodeField(ref.source)}`,`QBT_TR(${ref.source})QBT_TR[CONTEXT=${ref.context}]`,'@@END');}
  return lines.join('\n')+'\n';
}
export function buildOwnedCopyFallbackGroup(bundle,major,locale){
  major=String(major);locale=safeLocale(locale);
  const profiles=(bundle?.profiles||[]).filter(p=>majorOf(p.qbVersion)===major&&(p.bridgeLocales||[]).includes(locale)&&p.bridges&&p.bridges[locale]).sort((a,b)=>compareVersion(a.qbVersion,b.qbVersion));
  const pairKeys=new Set(),setMaps=new Map();
  for(const profile of profiles){const setId=profile.bridges[locale],map=bundle.bridgeSets?.[setId];if(!map)continue;setMaps.set(setId,map);for(const [ref,value] of Object.entries(map))pairKeys.add(JSON.stringify([ref,String(value)]));}
  const values=[],tokens=new Map();[...pairKeys].sort().forEach((key,index)=>{const [ref,value]=JSON.parse(key),token=index.toString(36);tokens.set(key,token);values.push([ref,value]);});
  const full={};for(const [setId,map] of setMaps)full[setId]=Object.keys(map).sort().map(ref=>tokens.get(JSON.stringify([ref,String(map[ref])])));
  const sets={},seen=new Set();let previous=null;
  for(const profile of profiles){const setId=profile.bridges[locale];if(!setId||seen.has(setId)||!full[setId])continue;seen.add(setId);let plan=[null,[...full[setId]],[]];if(previous&&full[previous]){const current=new Set(full[setId]),prior=new Set(full[previous]),add=[...current].filter(t=>!prior.has(t)).sort(tokenOrder),remove=[...prior].filter(t=>!current.has(t)).sort(tokenOrder),fullCost=plan[1].join(',').length,deltaCost=previous.length+add.join(',').length+remove.join(',').length+2;if(deltaCost<fullCost)plan=[previous,add,remove];}sets[setId]=plan;previous=setId;}
  return{schemaVersion:2,source:'qB-exact-official-fallback-pack',major,locale,values,sets};
}
export function runtimeCopyFallbackGroups(bundle){
  const keys=new Set();for(const profile of bundle?.profiles||[]){const major=majorOf(profile.qbVersion);for(const locale of profile.bridgeLocales||[])if(profile.bridges&&profile.bridges[locale])keys.add(major+'\u0000'+safeLocale(locale));}
  const out={};for(const key of [...keys].sort()){const [major,locale]=key.split('\u0000'),group=buildOwnedCopyFallbackGroup(bundle,major,locale);if(Object.keys(group.sets).length)out[`${major}/${locale}.json`]=group;}return out;
}
export function materializeRuntimeCopyShards(bundle,dataDir){
  if(!bundle||bundle.schemaVersion!==3)throw new Error('Runtime copy sharding requires native bundle schemaVersion 3.');
  const profileDir=path.join(dataDir,'qb-copy-profiles'),bindingDir=path.join(dataDir,'qb-copy-bindings'),fallbackDir=path.join(dataDir,'qb-copy-fallback');
  for(const dir of [profileDir,bindingDir,fallbackDir]){fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});}
  let profileBytes=0,bindingBytes=0,fallbackBytes=0,maxProfileBytes=0,maxBindingBytes=0,maxFallbackBytes=0;
  for(const profile of bundle.profiles||[]){const body=JSON.stringify(ownedCopyProfileManifest(profile))+'\n',bytes=Buffer.byteLength(body);fs.writeFileSync(path.join(profileDir,`${profile.sourceSha}.json`),body);profileBytes+=bytes;maxProfileBytes=Math.max(maxProfileBytes,bytes);}
  for(const bindingId of Object.keys(bundle.bindings||{}).sort()){const body=renderOwnedCopyBinding(bundle,bindingId),bytes=Buffer.byteLength(body);fs.writeFileSync(path.join(bindingDir,`${bindingId}.txt`),body);bindingBytes+=bytes;maxBindingBytes=Math.max(maxBindingBytes,bytes);}
  const groups=runtimeCopyFallbackGroups(bundle);for(const [relative,value] of Object.entries(groups)){const target=path.join(fallbackDir,relative),body=JSON.stringify(value)+'\n',bytes=Buffer.byteLength(body);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);fallbackBytes+=bytes;maxFallbackBytes=Math.max(maxFallbackBytes,bytes);}
  return{profileShardCount:(bundle.profiles||[]).length,bindingShardCount:Object.keys(bundle.bindings||{}).length,fallbackShardCount:Object.keys(groups).length,profileBytes,bindingBytes,fallbackBytes,totalBytes:profileBytes+bindingBytes+fallbackBytes,maxProfileBytes,maxBindingBytes,maxFallbackBytes};
}

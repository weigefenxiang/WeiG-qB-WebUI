import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

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
  const refs=[],runs=[],values=[],tokens=new Map();let previousRef=null;
  [...pairKeys].sort().forEach((key,index)=>{const [ref,value]=JSON.parse(key),token=index.toString(36);if(!/^[0-9a-f]{24}$/.test(ref))throw new Error('Invalid qB copy ref '+ref);tokens.set(key,token);values.push(value);if(ref===previousRef)runs[runs.length-1]++;else{refs.push(ref);runs.push(1);previousRef=ref;}});
  const full={};for(const [setId,map] of setMaps)full[setId]=Object.keys(map).sort().map(ref=>tokens.get(JSON.stringify([ref,String(map[ref])])));
  const sets={},seen=new Set();let previous=null;
  for(const profile of profiles){const setId=profile.bridges[locale];if(!setId||seen.has(setId)||!full[setId])continue;seen.add(setId);let plan=[null,[...full[setId]],[]];if(previous&&full[previous]){const current=new Set(full[setId]),prior=new Set(full[previous]),add=[...current].filter(t=>!prior.has(t)).sort(tokenOrder),remove=[...prior].filter(t=>!current.has(t)).sort(tokenOrder),fullCost=plan[1].join(',').length,deltaCost=previous.length+add.join(',').length+remove.join(',').length+2;if(deltaCost<fullCost)plan=[previous,add,remove];}sets[setId]=plan;previous=setId;}
  return{schemaVersion:3,source:'qB-exact-official-fallback-pack',major,locale,refs:refs.join(''),runs:runs.map(value=>value.toString(36)).join(','),values,sets};
}
export function runtimeCopyFallbackGroups(bundle){
  const keys=new Set();for(const profile of bundle?.profiles||[]){const major=majorOf(profile.qbVersion);for(const locale of profile.bridgeLocales||[])if(profile.bridges&&profile.bridges[locale])keys.add(major+'\u0000'+safeLocale(locale));}
  const out={};for(const key of [...keys].sort()){const [major,locale]=key.split('\u0000'),group=buildOwnedCopyFallbackGroup(bundle,major,locale);if(Object.keys(group.sets).length)out[`${major}/${locale}.json`]=group;}return out;
}
export function fallbackPackDescriptor(group){
  return stableObject({schemaVersion:4,source:'qB-exact-official-fallback-pack',locale:safeLocale(group?.locale),refs:String(group?.refs||''),runs:String(group?.runs||''),values:[...(group?.values||[])],sets:{...(group?.sets||{})}});
}
export function runtimeCopyFallbackPacks(bundle){
  const groups=runtimeCopyFallbackGroups(bundle),packs={},best=new Map();
  for(const group of Object.values(groups)){
    const pack=fallbackPackDescriptor(group),body=JSON.stringify(pack)+'\n',packId=contentId('p',pack),gzip=gzipSync(Buffer.from(body,'utf8'),{level:9,mtime:0}),bytes=gzip.length,prior=packs[packId];
    if(prior&&prior.body!==body)throw new Error('qB fallback pack hash collision '+packId);
    packs[packId]={pack,body,gzip,bytes};
    for(const setId of Object.keys(pack.sets||{})){const key=pack.locale+'\u0000'+setId,current=best.get(key);if(!current||bytes<current.bytes||(bytes===current.bytes&&packId<current.packId))best.set(key,{packId,bytes});}
  }
  return{packs,setPackIds:new Map([...best].map(([key,value])=>[key,value.packId]))};
}
export function ownedCopyRouteManifest(profile,setPackIds){
  const descriptor=copyRouteDescriptor(profile),routeId=copyRouteId(profile),fallback={};
  for(const locale of descriptor.fallbackLocales||[]){const setId=descriptor.fallbackSets&&descriptor.fallbackSets[locale];if(!setId){fallback[locale]=[null,null];continue;}const packId=setPackIds.get(locale+'\u0000'+setId);if(!/^p[0-9a-f]{20}$/.test(String(packId||'')))throw new Error('Missing qB fallback pack for '+routeId+' '+locale+' '+setId);fallback[locale]=[setId,packId];}
  return stableObject({schemaVersion:2,source:'qB-copy-semantic-runtime-route',routeId,family:descriptor.family,bindingId:descriptor.bindingId,nativeLocales:descriptor.nativeLocales,fallback});
}
export function runtimeCopyRouteManifests(bundle,setPackIds){
  const routes={};for(const profile of bundle?.profiles||[]){const route=ownedCopyRouteManifest(profile,setPackIds),prior=routes[route.routeId];if(prior&&JSON.stringify(prior)!==JSON.stringify(route))throw new Error('qB copy route collision '+route.routeId);routes[route.routeId]=route;}return routes;
}
export function materializeRuntimeCopyShards(bundle,dataDir){
  if(!bundle||bundle.schemaVersion!==3)throw new Error('Runtime copy sharding requires native bundle schemaVersion 3.');
  const routeDir=path.join(dataDir,'qb-copy-routes'),bindingDir=path.join(dataDir,'qb-copy-bindings'),fallbackDir=path.join(dataDir,'qb-copy-fallback');
  fs.rmSync(path.join(dataDir,'qb-copy-profiles'),{recursive:true,force:true});
  for(const dir of [routeDir,bindingDir,fallbackDir]){fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true});}
  const fallbackPlan=runtimeCopyFallbackPacks(bundle),routes=runtimeCopyRouteManifests(bundle,fallbackPlan.setPackIds),referencedPacks=new Set(Object.values(routes).flatMap(route=>Object.values(route.fallback||{}).map(value=>Array.isArray(value)?value[1]:null).filter(Boolean)));
  let routeBytes=0,bindingBytes=0,fallbackBytes=0,maxRouteBytes=0,maxBindingBytes=0,maxFallbackBytes=0;
  for(const [routeId,route] of Object.entries(routes).sort()){const raw=Buffer.from(JSON.stringify(route)+'\n','utf8'),body=gzipSync(raw,{level:9,mtime:0}),bytes=body.length;fs.writeFileSync(path.join(routeDir,`${routeId}.json.gz`),body);routeBytes+=bytes;maxRouteBytes=Math.max(maxRouteBytes,bytes);}
  for(const bindingId of Object.keys(bundle.bindings||{}).sort()){const body=renderOwnedCopyBinding(bundle,bindingId),bytes=Buffer.byteLength(body);fs.writeFileSync(path.join(bindingDir,`${bindingId}.txt`),body);bindingBytes+=bytes;maxBindingBytes=Math.max(maxBindingBytes,bytes);}
  for(const packId of [...referencedPacks].sort()){const item=fallbackPlan.packs[packId];if(!item)throw new Error('Missing selected qB fallback pack '+packId);fs.writeFileSync(path.join(fallbackDir,`${packId}.json.gz`),item.gzip);fallbackBytes+=item.bytes;maxFallbackBytes=Math.max(maxFallbackBytes,item.bytes);}
  return{routeShardCount:Object.keys(routes).length,bindingShardCount:Object.keys(bundle.bindings||{}).length,fallbackShardCount:referencedPacks.size,routeBytes,bindingBytes,fallbackBytes,totalBytes:routeBytes+bindingBytes+fallbackBytes,maxRouteBytes,maxBindingBytes,maxFallbackBytes,routeBySource:Object.fromEntries((bundle.profiles||[]).map(profile=>[String(profile.sourceSha||''),copyRouteId(profile)]))};
}

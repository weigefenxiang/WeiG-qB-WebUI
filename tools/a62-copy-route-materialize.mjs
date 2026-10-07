#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';

const dataDir=path.resolve(process.argv[2]||'webui/private/data');
const profileDir=path.join(dataDir,'qb-copy-profiles'),routeDir=path.join(dataDir,'qb-copy-routes'),bindingDir=path.join(dataDir,'qb-copy-bindings'),fallbackDir=path.join(dataDir,'qb-copy-fallback'),capabilityFile=path.join(dataDir,'capabilities.json');
const stable=value=>Array.isArray(value)?value.map(stable):(value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value);
const contentId=(prefix,value)=>prefix+crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,20);
const safeLocale=value=>{const locale=String(value||'').trim();if(!/^[A-Za-z0-9@._-]+$/.test(locale))throw new Error('Unsafe qB locale '+locale);return locale;};
const locales=value=>[...new Set((value||[]).map(x=>String(x||'').trim()).filter(Boolean))].sort();
const descriptor=profile=>stable({schemaVersion:1,source:'qB-copy-semantic-route',family:String(profile?.family||''),bindingId:String(profile?.bindingId||''),nativeLocales:locales(profile?.nativeLocales),fallbackLocales:locales(profile?.fallbackLocales),fallbackSets:{...(profile?.fallbackSets||{})}});
const routeId=profile=>contentId('r',descriptor(profile));
const packDescriptor=group=>stable({schemaVersion:4,source:'qB-exact-official-fallback-pack',locale:safeLocale(group?.locale),refs:String(group?.refs||''),runs:String(group?.runs||''),values:[...(group?.values||[])],sets:{...(group?.sets||{})}});
const walk=(dir,suffix)=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const item=path.join(dir,entry.name);return entry.isDirectory()?walk(item,suffix):(entry.isFile()&&entry.name.endsWith(suffix)?[item]:[]);}):[];
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));

function validateFinal(){
  const routes=walk(routeDir,'.json.gz'),packs=walk(fallbackDir,'.json.gz'),profiles=fs.existsSync(profileDir)?walk(profileDir,'.json'):[];
  if(profiles.length)throw new Error('Retired qb-copy-profiles still present');
  if(routes.length!==58)throw new Error('Expected 58 semantic copy routes, got '+routes.length);
  if(packs.length!==133)throw new Error('Expected 133 content-addressed gzip fallback packs, got '+packs.length);
  const routeIds=new Set(routes.map(file=>path.basename(file,'.json.gz'))),packIds=new Set(packs.map(file=>path.basename(file,'.json.gz')));
  let fallbackBytes=0;
  for(const file of packs){fallbackBytes+=fs.statSync(file).size;const pack=JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8')),id=path.basename(file,'.json.gz');if(contentId('p',pack)!==id)throw new Error('Fallback pack identity mismatch '+id);if(pack.schemaVersion!==4||pack.source!=='qB-exact-official-fallback-pack'||Object.hasOwn(pack,'major'))throw new Error('Invalid flat fallback pack '+id);}
  const capability=readJson(capabilityFile);if((capability.releases||[]).length!==65)throw new Error('Capability release inventory drifted');
  for(const row of capability.releases||[]){if(!/^r[0-9a-f]{20}$/.test(String(row.copyRouteId||''))||!routeIds.has(row.copyRouteId))throw new Error('Capability release missing semantic copy route '+String(row.qbVersion||''));}
  for(const file of routes){const route=JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8')),id=path.basename(file,'.json.gz');if(route.routeId!==id||route.schemaVersion!==2||route.source!=='qB-copy-semantic-runtime-route')throw new Error('Invalid route '+id);if(!fs.existsSync(path.join(bindingDir,route.bindingId+'.txt')))throw new Error('Missing binding '+route.bindingId);for(const [locale,value] of Object.entries(route.fallback||{})){if(!Array.isArray(value)||value.length!==2)throw new Error('Malformed fallback route '+id+' '+locale);const pid=value[1];if(pid&&!packIds.has(pid))throw new Error('Missing pack '+pid+' for '+id+' '+locale);}}
  return{routeCount:routes.length,packCount:packs.length,fallbackBytes};
}

if(!fs.existsSync(profileDir)){
  console.log(JSON.stringify({kind:'A62_7_ROUTE_OWNER',status:'already-materialized',...validateFinal()}));process.exit(0);
}
const profileFiles=walk(profileDir,'.json').sort();if(profileFiles.length!==65)throw new Error('Expected 65 source profiles, got '+profileFiles.length);
const profiles=profileFiles.map(readJson),groups=walk(fallbackDir,'.json.gz').sort();if(groups.length!==133)throw new Error('Expected 133 gzip fallback groups, got '+groups.length);
const packs=new Map(),best=new Map();
for(const file of groups){
  const group=JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8')),pack=packDescriptor(group),pid=contentId('p',pack),body=JSON.stringify(pack)+'\n',gz=gzipSync(Buffer.from(body,'utf8'),{level:9,mtime:0}),prior=packs.get(pid);
  if(prior&&prior.body!==body)throw new Error('Fallback pack collision '+pid);
  packs.set(pid,{pack,body,gz,bytes:gz.length});
  for(const setId of Object.keys(pack.sets||{})){const key=pack.locale+'\u0000'+setId,current=best.get(key);if(!current||gz.length<current.bytes||(gz.length===current.bytes&&pid<current.pid))best.set(key,{pid,bytes:gz.length});}
}
const routes=new Map(),bySource=new Map();
for(const profile of profiles){
  const d=descriptor(profile),rid=routeId(profile);
  const fallback={};for(const locale of d.fallbackLocales||[]){const setId=d.fallbackSets&&d.fallbackSets[locale];if(!setId){fallback[locale]=[null,null];continue;}const selected=best.get(locale+'\u0000'+setId);if(!selected)throw new Error('No fallback pack for '+rid+' '+locale+' '+setId);fallback[locale]=[setId,selected.pid];}
  const route=stable({schemaVersion:2,source:'qB-copy-semantic-runtime-route',routeId:rid,family:d.family,bindingId:d.bindingId,nativeLocales:d.nativeLocales,fallback}),prior=routes.get(rid);
  if(prior&&JSON.stringify(prior)!==JSON.stringify(route))throw new Error('Route collision '+rid);
  routes.set(rid,route);bySource.set(String(profile.sourceSha||''),rid);
}
if(routes.size!==58)throw new Error('Expected 58 semantic routes, got '+routes.size);
const capability=readJson(capabilityFile);
for(const row of capability.releases||[]){const rid=bySource.get(String(row.sourceSha||''));if(!rid)throw new Error('No route for capability '+String(row.qbVersion||''));row.copyRouteId=rid;}
const referenced=new Set([...routes.values()].flatMap(route=>Object.values(route.fallback||{}).map(value=>Array.isArray(value)?value[1]:null).filter(Boolean)));
if(referenced.size!==133)throw new Error('Expected all 133 minimal gzip packs to remain selected, got '+referenced.size);
fs.rmSync(routeDir,{recursive:true,force:true});fs.mkdirSync(routeDir,{recursive:true});
const stageFallback=path.join(dataDir,'qb-copy-fallback.route-stage');fs.rmSync(stageFallback,{recursive:true,force:true});fs.mkdirSync(stageFallback,{recursive:true});
for(const [rid,route] of [...routes].sort()){const raw=Buffer.from(JSON.stringify(route)+'\n','utf8');fs.writeFileSync(path.join(routeDir,rid+'.json.gz'),gzipSync(raw,{level:9,mtime:0}));}
for(const pid of [...referenced].sort()){const item=packs.get(pid);if(!item)throw new Error('Selected pack missing '+pid);fs.writeFileSync(path.join(stageFallback,pid+'.json.gz'),item.gz);}
fs.rmSync(fallbackDir,{recursive:true,force:true});fs.renameSync(stageFallback,fallbackDir);
fs.rmSync(profileDir,{recursive:true,force:true});
fs.writeFileSync(capabilityFile,JSON.stringify(capability,null,2)+'\n','utf8');
const result=validateFinal();
console.log(JSON.stringify({kind:'A62_7_ROUTE_OWNER',status:'materialized',sourceProfiles:profiles.length,uniqueRoutes:routes.size,semanticKeys:best.size,...result},null,2));

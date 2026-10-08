#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {runtimeCopySnapshot} from './qb-runtime-copy-product.mjs';
import {rebindCopyRoutes} from './qb-copy-route-control-plane.mjs';
import {fileURLToPath} from 'node:url';

const normalizedRoot=value=>path.resolve(String(value||''));

// Append one new certified official release without replacing the 65-profile
// content-addressed Copy owner. Preserve every existing file and its bytes.
export function appendRuntimeCopyRelease(sourceDir,targetDir,routeId){
  const source=normalizedRoot(sourceDir),target=normalizedRoot(targetDir);
  if(!/^r[0-9a-f]{20}$/.test(String(routeId||'')))throw new Error('New official Copy route ID is invalid.');
  const sourceSnapshot=runtimeCopySnapshot(source),before=runtimeCopySnapshot(target);
  const routeFile=path.join(source,'qb-copy-routes',routeId+'.json.gz');
  if(!fs.existsSync(routeFile))throw new Error('New exact official Copy route shard is missing.');
  const route=JSON.parse(gunzipSync(fs.readFileSync(routeFile)).toString('utf8'));
  if(route?.schemaVersion!==2||route.routeId!==routeId||!/^b[0-9a-f]{20}$/.test(String(route.bindingId||''))||!Array.isArray(route.nativeLocales)||!route.fallback||typeof route.fallback!=='object'||Array.isArray(route.fallback))throw new Error('New exact official Copy route descriptor is invalid.');
  const packs=new Set();
  for(const [locale,owner] of Object.entries(route.fallback)){
    if(Array.isArray(owner)&&owner.length===2&&owner[0]===null&&owner[1]===null)continue;
    const pack=Array.isArray(owner)?String(owner[1]||''):'';
    if(!locale||!Array.isArray(owner)||owner.length!==2||!/^t[0-9a-f]{20}$/.test(String(owner[0]||''))||!/^p[0-9a-f]{20}$/.test(pack))throw new Error('New official Copy fallback dependency is unresolved for '+locale);
    packs.add(pack);
  }
  const needed=[['qb-copy-routes',routeId+'.json.gz'],['qb-copy-bindings',route.bindingId+'.txt'],...Array.from(packs).sort().map(id=>['qb-copy-fallback',id+'.json.gz'])];
  let appended=0;
  for(const [folder,name] of needed){
    const from=path.join(source,folder,name),to=path.join(target,folder,name);
    if(!fs.existsSync(from)||!fs.statSync(from).isFile())throw new Error('Official source Copy dependency is missing: '+folder+'/'+name);
    const bytes=fs.readFileSync(from);
    if(!bytes.length)throw new Error('Official source Copy dependency is empty: '+folder+'/'+name);
    if(fs.existsSync(to)){
      if(!fs.readFileSync(to).equals(bytes))throw new Error('Existing certified Copy shard is immutable: '+folder+'/'+name);
    }else{
      fs.mkdirSync(path.dirname(to),{recursive:true});
      fs.copyFileSync(from,to);
      appended++;
    }
  }
  const after=runtimeCopySnapshot(target),lookup=new Map(after.files.map(row=>[row.path,row]));
  for(const previous of before.files){
    const current=lookup.get(previous.path);
    if(!current||current.sha256!==previous.sha256||current.bytes!==previous.bytes)throw new Error('Historical certified Copy shard changed during append: '+previous.path);
  }
  for(const [folder,name] of needed){
    const relative=folder+'/'+name,current=lookup.get(relative),expected=sourceSnapshot.files.find(row=>row.path===relative);
    if(!current||!expected||current.sha256!==expected.sha256||current.bytes!==expected.bytes)throw new Error('New official Copy dependency failed source SHA verification: '+relative);
  }
  return{source:sourceSnapshot,target:after,appendedFiles:appended,requiredFiles:needed.length,routeId};
}

 
// The certified route map remains the current product owner: source generation
// may append new routes but must never rewrite previously certified shards.
export function reconcileRuntimeCopyReleaseSet(sourceDir,targetDir,indexPath,capabilityPath,{write=false}={}){
  const source=normalizedRoot(sourceDir),target=normalizedRoot(targetDir);
  const index=JSON.parse(fs.readFileSync(indexPath,'utf8'));
  const capability=JSON.parse(fs.readFileSync(capabilityPath,'utf8'));
  if(!Array.isArray(capability?.releases)||capability.releases.length<65)throw new Error('Certified historical Copy prefix is missing.');
  const projection=rebindCopyRoutes(index,capability,{historicalReleases:capability.releases});
  const missing=[];
  for(let i=0;i<capability.releases.length;i++){
    const row=capability.releases[i],routeId=String(row.copyRouteId||''),routeFile=path.join(target,'qb-copy-routes',routeId+'.json.gz');
    if(!fs.existsSync(routeFile)){
      if(i<65||String(index[i].copyRouteId||'')!==routeId)throw new Error('Immutable historical Copy route cannot be regenerated: '+row.qbVersion);
      missing.push(routeId);
    }
  }
  if(missing.length&&!write)return{equal:false,missingRoutes:missing,historicalSourceDrift:projection.historicalSourceDrift};
  let appendedFiles=0;
  for(const id of new Set(missing))appendedFiles+=appendRuntimeCopyRelease(source,target,id).appendedFiles;
  const required=new Set();
  function requireAsset(relative){
    const name=path.join(target,relative);
    if(!fs.existsSync(name)||!fs.statSync(name).isFile())throw new Error('Missing certified Copy asset: '+relative);
    required.add(relative);
  }
  for(const row of capability.releases){
    const id=String(row.copyRouteId||''),relative='qb-copy-routes/'+id+'.json.gz';
    requireAsset(relative);
    const route=JSON.parse(gunzipSync(fs.readFileSync(path.join(target,relative))).toString('utf8'));
    if(route?.schemaVersion!==2||route.routeId!==id||!/^b[0-9a-f]{20}$/.test(String(route.bindingId||''))||!Array.isArray(route.nativeLocales)||!route.fallback||typeof route.fallback!=='object'||Array.isArray(route.fallback))throw new Error('Invalid certified Copy route: '+id);
    requireAsset('qb-copy-bindings/'+route.bindingId+'.txt');
    for(const [locale,pair] of Object.entries(route.fallback)){
      if(!locale||!Array.isArray(pair)||pair.length!==2)throw new Error('Invalid Copy fallback pair for '+id);
      if(pair[0]===null&&pair[1]===null)continue;
      if(!/^t[0-9a-f]{20}$/.test(String(pair[0]||''))||!/^p[0-9a-f]{20}$/.test(String(pair[1]||'')))throw new Error('Incomplete Copy fallback pair for '+id);
      requireAsset('qb-copy-fallback/'+pair[1]+'.json.gz');
    }
  }
  const snapshot=runtimeCopySnapshot(target);
  const inventory=new Set(snapshot.files.map(file=>file.path));
  if(inventory.size!==required.size||[...inventory].some(file=>!required.has(file)))throw new Error('Unreferenced Copy materialization or missing certified source dependency.');
  return{equal:true,appendedFiles,releaseCount:capability.releases.length,assetCount:inventory.size,historicalSourceDrift:projection.historicalSourceDrift};
}
const isAdmissionMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isAdmissionMain){
  try{
    const [mode,source,target,index,capability]=process.argv.slice(2);
    if(!['check','admit'].includes(mode)||!source||!target||!index||!capability)throw new Error('Usage: node tools/qb-runtime-copy-admission.mjs check|admit generated-data product-data generated-index product-capabilities');
    const result=reconcileRuntimeCopyReleaseSet(source,target,index,capability,{write:mode==='admit'});
    console.log(JSON.stringify({kind:'QB_COPY_APPEND_ONLY_ADMISSION',mode,...result}));
    if(!result.equal)process.exitCode=2;
  }catch(error){console.error(error?.stack||error);process.exitCode=1;}
}

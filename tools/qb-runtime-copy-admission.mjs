#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {runtimeCopySnapshot} from './qb-runtime-copy-product.mjs';

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
    const pack=Array.isArray(owner)?String(owner[1]||''):'';
    if(!locale||!/^p[0-9a-f]{20}$/.test(pack))throw new Error('New official Copy fallback dependency is unresolved for '+locale);
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

#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';

export const COPY_SHARD_SPECS=[
  {name:'qb-copy-routes',ext:'.json.gz'},
  {name:'qb-copy-bindings',ext:'.txt'},
  {name:'qb-copy-fallback',ext:'.json.gz'}
];

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function walk(root){const out=[];for(const entry of fs.readdirSync(root,{withFileTypes:true})){const file=path.join(root,entry.name);if(entry.isDirectory())out.push(...walk(file));else if(entry.isFile())out.push(file);}return out;}
function normalizedRoot(value){return path.resolve(String(value||''));}

export function runtimeCopySnapshot(dataDir){
  const root=normalizedRoot(dataDir);
  if(fs.existsSync(path.join(root,'qb-settings-native.txt')))throw new Error('Retired all-version qB copy registry reappeared.');
  if(fs.existsSync(path.join(root,'qb-copy-profiles')))throw new Error('Retired sourceSha qB copy profile owner reappeared.');
  const files=[];
  for(const spec of COPY_SHARD_SPECS){
    const dir=path.join(root,spec.name);
    if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory())throw new Error(`Missing qB copy shard directory ${spec.name}.`);
    const selected=walk(dir).filter(file=>file.endsWith(spec.ext)).sort();
    if(!selected.length)throw new Error(`qB copy shard directory ${spec.name} is empty.`);
    for(const file of selected){
      const body=fs.readFileSync(file),relative=path.relative(root,file).replaceAll('\\','/'),bytes=body.length;
      if(bytes<=0)throw new Error(`Empty qB copy shard: ${relative}`);
      if(spec.name==='qb-copy-routes'||spec.name==='qb-copy-fallback')JSON.parse(gunzipSync(body).toString('utf8'));else if(spec.ext==='.json')JSON.parse(body.toString('utf8'));
      else {
        const text=body.toString('utf8');
        if(!/^@@BINDING\tb[0-9a-f]{20}$/m.test(text))throw new Error(`Malformed qB binding identity: ${relative}`);
        if(text.includes('@@VAL\t')||text.includes('@@SET\t')||text.includes('@@BRIDGE\t'))throw new Error(`Binding shard retained all-version translation rows: ${relative}`);
      }
      files.push({path:relative,bytes,sha256:sha256(file)});
    }
  }
  return{schemaVersion:1,source:'qB-runtime-copy-shard-tree',files,totalBytes:files.reduce((sum,item)=>sum+item.bytes,0),counts:Object.fromEntries(COPY_SHARD_SPECS.map(spec=>[spec.name,files.filter(item=>item.path.startsWith(spec.name+'/')).length]))};
}

export function compareRuntimeCopyTrees(left,right){
  const a=runtimeCopySnapshot(left),b=runtimeCopySnapshot(right);
  const compact=value=>value.files.map(({path,bytes,sha256})=>({path,bytes,sha256}));
  return{equal:JSON.stringify(compact(a))===JSON.stringify(compact(b)),left:a,right:b};
}

export function syncRuntimeCopyTree(sourceDir,targetDir){
  const source=normalizedRoot(sourceDir),target=normalizedRoot(targetDir);
  const before=runtimeCopySnapshot(source);
  fs.mkdirSync(target,{recursive:true});
  fs.rmSync(path.join(target,'qb-settings-native.txt'),{force:true});
  fs.rmSync(path.join(target,'qb-copy-profiles'),{recursive:true,force:true});
  for(const spec of COPY_SHARD_SPECS){
    const from=path.join(source,spec.name),to=path.join(target,spec.name);
    fs.rmSync(to,{recursive:true,force:true});
    fs.cpSync(from,to,{recursive:true,force:true});
  }
  const after=runtimeCopySnapshot(target);
  const compared=compareRuntimeCopyTrees(source,target);
  if(!compared.equal)throw new Error('Synced qB copy shard tree differs from generated source.');
  return{source:before,target:after};
}

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

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const mode=String(process.argv[2]||'validate'),a=process.argv[3],b=process.argv[4];
    let result;
    if(mode==='validate')result=runtimeCopySnapshot(a);
    else if(mode==='compare'){result=compareRuntimeCopyTrees(a,b);if(!result.equal)process.exitCode=2;}
    else if(mode==='sync')result=syncRuntimeCopyTree(a,b);
    else throw new Error('Usage: node tools/qb-runtime-copy-product.mjs <validate data-dir | compare generated-data-dir product-data-dir | sync generated-data-dir product-data-dir>');
    console.log(JSON.stringify(result));
  }catch(error){console.error(error?.stack||error);process.exitCode=1;}
}

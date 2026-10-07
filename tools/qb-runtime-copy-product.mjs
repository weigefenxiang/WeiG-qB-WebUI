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

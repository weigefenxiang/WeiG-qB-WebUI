#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';

const root=path.resolve('.');
const sourceRoot=path.join(root,'webui/private/data/qb-copy-fallback');
const outArg=process.argv.find(value=>value.startsWith('--out='));
if(!outArg)throw new Error('Usage: node tools/a62-copy-gzip-prototype.mjs --out=<artifact-dir>');
const outRoot=path.resolve(outArg.slice('--out='.length));
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
function files(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const item=path.join(dir,entry.name);
    return entry.isDirectory()?files(item):(entry.isFile()&&entry.name.endsWith('.json')?[item]:[]);
  }).sort();
}
if(!fs.existsSync(sourceRoot))throw new Error('Missing current qB fallback owner');
fs.rmSync(outRoot,{recursive:true,force:true});
fs.mkdirSync(outRoot,{recursive:true});
const rows=[];let rawBytes=0,gzipBytes=0,maxRawBytes=0,maxGzipBytes=0;
for(const file of files(sourceRoot)){
  const body=fs.readFileSync(file),relative=path.relative(sourceRoot,file).replaceAll('\\','/');
  const gz=gzipSync(body,{level:9,mtime:0});
  const restored=gunzipSync(gz);
  if(!restored.equals(body))throw new Error('gzip round-trip mismatch: '+relative);
  const target=path.join(outRoot,relative+'.gz');
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,gz);
  const row={path:relative,rawBytes:body.length,gzipBytes:gz.length,rawSha256:sha256(body),gzipSha256:sha256(gz)};
  rows.push(row);rawBytes+=body.length;gzipBytes+=gz.length;maxRawBytes=Math.max(maxRawBytes,body.length);maxGzipBytes=Math.max(maxGzipBytes,gz.length);
}
if(rows.length!==133)throw new Error('Expected 133 current fallback packs, got '+rows.length);
if(rawBytes!==4733945)throw new Error('Current green fallback budget drifted: '+rawBytes+' != 4733945');
if(gzipBytes>=rawBytes)throw new Error('gzip prototype did not reduce installed bytes');
const report={schemaVersion:1,kind:'A62_7_GZIP_PROTOTYPE',sourceSha:process.env.GITHUB_SHA||'',packCount:rows.length,rawBytes,gzipBytes,savingsBytes:rawBytes-gzipBytes,savingsPct:Number(((rawBytes-gzipBytes)*100/rawBytes).toFixed(2)),maxRawBytes,maxGzipBytes,rows};
fs.writeFileSync(path.join(outRoot,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));

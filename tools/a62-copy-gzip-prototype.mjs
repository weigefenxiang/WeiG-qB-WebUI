#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';

const root=path.resolve('.');
const sourceRoot=path.join(root,'webui/private/data/qb-copy-fallback');
const outArg=process.argv.find(value=>value.startsWith('--out='));
const inPlace=process.argv.includes('--in-place');
if(!outArg&&!inPlace)throw new Error('Usage: node tools/a62-copy-gzip-prototype.mjs (--out=<artifact-dir> | --in-place)');
const outRoot=outArg?path.resolve(outArg.slice('--out='.length)):sourceRoot;
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
function files(dir,suffix){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const item=path.join(dir,entry.name);
    return entry.isDirectory()?files(item,suffix):(entry.isFile()&&entry.name.endsWith(suffix)?[item]:[]);
  }).sort();
}
if(!fs.existsSync(sourceRoot))throw new Error('Missing current qB fallback owner');
const rawFiles=files(sourceRoot,'.json'),gzipFiles=files(sourceRoot,'.json.gz');
if(inPlace&&rawFiles.length&&gzipFiles.length)throw new Error('Refusing mixed raw/gzip fallback owner');
if(outArg){fs.rmSync(outRoot,{recursive:true,force:true});fs.mkdirSync(outRoot,{recursive:true});}
const inputs=rawFiles.length?rawFiles:gzipFiles;
if(inputs.length!==133)throw new Error('Expected 133 current fallback packs, got '+inputs.length);
const rows=[];let rawBytes=0,gzipBytes=0,maxRawBytes=0,maxGzipBytes=0;
for(const file of inputs){
  const isGzip=file.endsWith('.json.gz'),relative=path.relative(sourceRoot,file).replaceAll('\\','/'),raw=isGzip?gunzipSync(fs.readFileSync(file)):fs.readFileSync(file),gz=isGzip?fs.readFileSync(file):gzipSync(raw,{level:9,mtime:0});
  if(!gunzipSync(gz).equals(raw))throw new Error('gzip round-trip mismatch: '+relative);
  const logical=relative.replace(/\.gz$/,'');
  if(inPlace&&!isGzip){fs.writeFileSync(file+'.gz',gz);fs.unlinkSync(file);}
  if(outArg){const target=path.join(outRoot,logical+'.gz');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,gz);}
  rows.push({path:logical,rawBytes:raw.length,gzipBytes:gz.length,rawSha256:sha256(raw),gzipSha256:sha256(gz)});
  rawBytes+=raw.length;gzipBytes+=gz.length;maxRawBytes=Math.max(maxRawBytes,raw.length);maxGzipBytes=Math.max(maxGzipBytes,gz.length);
}
if(rawBytes!==4733945)throw new Error('Current green fallback budget drifted: '+rawBytes+' != 4733945');
if(gzipBytes!==1978408)throw new Error('Deterministic gzip fallback budget drifted: '+gzipBytes+' != 1978408');
const report={schemaVersion:1,kind:'A62_7_GZIP_MATERIALIZATION',sourceSha:process.env.GITHUB_SHA||'',packCount:rows.length,rawBytes,gzipBytes,savingsBytes:rawBytes-gzipBytes,savingsPct:Number(((rawBytes-gzipBytes)*100/rawBytes).toFixed(2)),maxRawBytes,maxGzipBytes,rows};
if(outArg)fs.writeFileSync(path.join(outRoot,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));

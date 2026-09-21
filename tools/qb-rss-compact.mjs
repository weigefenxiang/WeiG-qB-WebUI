#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function stable(value){return JSON.stringify(value);}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function timeline(catalog,key){const out=[];let previous;for(const profile of catalog){const value=clone(profile?.[key]??null),serialized=stable(value);if(out.length&&serialized===previous)continue;out.push({from:String(profile.qbVersion||''),value});previous=serialized;}return out;}
function releaseIdentity(catalog){const rows=catalog.map(item=>`${String(item.qbVersion||'')}\u0000${String(item.sourceSha||'')}`);return crypto.createHash('sha256').update(rows.join('\n'),'utf8').digest('hex');}
export function compileRssCompat(catalog){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('RSS compact compiler requires a non-empty enriched catalog.');
  const first=String(catalog[0]?.qbVersion||''),last=String(catalog.at(-1)?.qbVersion||'');
  if(!first||!last)throw new Error('RSS compact compiler requires ordered release identities.');
  const seen=new Set();for(const profile of catalog){const id=`${profile.qbVersion}\u0000${profile.sourceSha}`;if(seen.has(id))throw new Error(`Duplicate RSS release identity ${profile.qbVersion}`);seen.add(id);if(!profile.rssDownloaderUi)throw new Error(`${profile.qbVersion}: missing exact RSS Downloader source facts.`);}
  return{schemaVersion:1,source:'qb-upstream-rss-downloader',releaseSet:{count:catalog.length,first,last,identitySha256:releaseIdentity(catalog)},sourceFacts:{rssDownloaderUi:timeline(catalog,'rssDownloaderUi')}};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const input=path.resolve(process.argv[2]||''),output=path.resolve(process.argv[3]||'');if(!input||!fs.existsSync(input)||!output)throw new Error('Usage: node tools/qb-rss-compact.mjs <enriched-catalog.json> <rss-compat.json>');
    const data=compileRssCompat(JSON.parse(fs.readFileSync(input,'utf8')));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n','utf8');
    console.log(`Compiled RSS compact contract for ${data.releaseSet.count} exact releases with ${data.sourceFacts.rssDownloaderUi.length} source change points; identity ${data.releaseSet.identitySha256}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

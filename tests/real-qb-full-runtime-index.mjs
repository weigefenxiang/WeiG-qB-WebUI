#!/usr/bin/env node
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outPath=process.argv[2];
if(!outPath) throw new Error('Output path is required.');
const manifest=JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8'));
const catalog=JSON.parse(fs.readFileSync(manifest.catalogPath,'utf8'));
const versions=[...new Set(catalog.map(x=>String(x.qbVersion||'').trim()))];
if(versions.length!==manifest.profileCount) throw new Error(`Frozen profile count mismatch: ${versions.length} != ${manifest.profileCount}`);

const sourceRepository='https://github.com/linuxserver/docker-qbittorrent.git';
let raw='';
try{
  raw=execFileSync('git',['ls-remote','--tags','--refs',sourceRepository],{
    encoding:'utf8',
    timeout:60000,
    maxBuffer:20*1024*1024,
    stdio:['ignore','pipe','pipe']
  });
}catch(error){
  const stderr=String(error?.stderr||'').trim();
  throw new Error(`LinuxServer source tag discovery failed${stderr?`: ${stderr}`:''}`);
}
const refs=raw.split(/\r?\n/).filter(Boolean).map((line,index)=>{
  const match=line.match(/^([0-9a-f]{40})\t(refs\/tags\/.+)$/i);
  if(!match) throw new Error(`Unexpected git ls-remote tag row ${index+1}.`);
  return {sha:match[1].toLowerCase(),ref:match[2]};
}).sort((a,b)=>a.ref.localeCompare(b.ref)||a.sha.localeCompare(b.sha));
if(refs.length===0) throw new Error('LinuxServer source tag discovery returned no tags.');
const normalized=refs.map(x=>`${x.sha}\t${x.ref}`).join('\n')+'\n';
const sourceTagListSha256=crypto.createHash('sha256').update(normalized).digest('hex');

const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const matchers=new Map(versions.map(version=>[
  version,
  new RegExp(`^(?:amd64-)?(?:version-)?${escapeRe(version)}(?=$|[_-]|\\d{8})`)
]));
const matches=Object.fromEntries(versions.map(v=>[v,[]]));
for(const {ref} of refs){
  const name=ref.slice('refs/tags/'.length);
  for(const [version,re] of matchers){
    if(re.test(name)) matches[version].push(name);
  }
}
const lsRevision=name=>{
  const m=name.match(/-ls(\d+)$/i);
  return m?Number(m[1]):-1;
};
const score=(version,name)=>{
  const bare=name.replace(/^amd64-/,'').replace(/^version-/,'');
  if(bare===version)return 0;
  if(bare.startsWith(`${version}-`))return 1;
  if(bare.startsWith(`${version}_`))return 2;
  if(new RegExp(`^${escapeRe(version)}\\d{8}`).test(bare))return 3;
  return 4;
};
for(const version of versions){
  matches[version]=[...new Set(matches[version])]
    .sort((a,b)=>score(version,a)-score(version,b)||lsRevision(b)-lsRevision(a)||b.localeCompare(a))
    .slice(0,20);
}
const result={
  schemaVersion:2,
  phase:'G-FM',
  provider:'linuxserver/qbittorrent',
  discoveryRole:'candidate-tag-discovery-only; runtime truth still requires immutable image digest and exact qB identity',
  sourceRepository,
  sourceRefPattern:'refs/tags/*',
  sourceTagListSha256,
  sourceTagCount:refs.length,
  frozenCatalogSha256:manifest.catalogSha256,
  frozenProfileCount:manifest.profileCount,
  versionsWithHistoricalTags:Object.values(matches).filter(v=>v.length).length,
  tagsByVersion:matches
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify({sourceTags:refs.length,sourceTagListSha256,versionsWithHistoricalTags:result.versionsWithHistoricalTags}));

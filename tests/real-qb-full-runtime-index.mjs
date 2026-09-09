#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const outPath=process.argv[2];
if(!outPath) throw new Error('Output path is required.');
const manifest=JSON.parse(fs.readFileSync('tools/data/qb-stable-lkg.json','utf8'));
const catalog=JSON.parse(fs.readFileSync(manifest.catalogPath,'utf8'));
const versions=[...new Set(catalog.map(x=>String(x.qbVersion||'').trim()))];
if(versions.length!==manifest.profileCount) throw new Error(`Frozen profile count mismatch: ${versions.length} != ${manifest.profileCount}`);

const escapeRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const matchers=new Map(versions.map(version=>{
  const esc=escapeRe(version);
  return [version,new RegExp(`^(?:amd64-)?(?:version-)?${esc}(?=$|[_-]|\\d{8})`)];
}));
const matches=Object.fromEntries(versions.map(v=>[v,[]]));
const seen=new Set();
let url='https://hub.docker.com/v2/repositories/linuxserver/qbittorrent/tags?page_size=100';
let pages=0;
const pageDigests=[];
while(url){
  if(++pages>250) throw new Error('Docker Hub tag pagination exceeded 250 pages; refusing an incomplete runtime index.');
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||parsed.hostname!=='hub.docker.com'||!parsed.pathname.startsWith('/v2/repositories/linuxserver/qbittorrent/tags')){
    throw new Error(`Unexpected Docker Hub pagination URL: ${url}`);
  }
  const response=await fetch(url,{headers:{Accept:'application/json','User-Agent':'WeiG-qB-WebUI-GFM/1'}});
  if(!response.ok) throw new Error(`Docker Hub tag page ${pages}: HTTP ${response.status}`);
  const text=await response.text();
  pageDigests.push(crypto.createHash('sha256').update(text).digest('hex'));
  const data=JSON.parse(text);
  for(const row of Array.isArray(data.results)?data.results:[]){
    const name=String(row?.name||'').trim();
    if(!name||seen.has(name)) continue;
    seen.add(name);
    for(const [version,re] of matchers){
      if(re.test(name)) matches[version].push(name);
    }
  }
  url=data.next||null;
}
const score=(version,name)=>{
  if(name===version)return 0;
  if(name===`version-${version}`)return 1;
  if(name.startsWith(`${version}_`))return 2;
  if(name.startsWith(`version-${version}_`))return 3;
  if(name.startsWith(`amd64-${version}`))return 4;
  return 5;
};
for(const version of versions){
  matches[version]=[...new Set(matches[version])].sort((a,b)=>score(version,a)-score(version,b)||a.localeCompare(b)).slice(0,20);
}
const result={
  schemaVersion:1,
  phase:'G-FM',
  provider:'linuxserver/qbittorrent',
  source:'https://hub.docker.com/v2/repositories/linuxserver/qbittorrent/tags',
  generatedAt:new Date().toISOString(),
  frozenCatalogSha256:manifest.catalogSha256,
  frozenProfileCount:manifest.profileCount,
  pagesFetched:pages,
  uniqueTagsSeen:seen.size,
  pageContentDigest:crypto.createHash('sha256').update(pageDigests.join('\n')).digest('hex'),
  tagsByVersion:matches
};
fs.mkdirSync(path.dirname(outPath),{recursive:true});
fs.writeFileSync(outPath,`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify({pages:pages,uniqueTags:seen.size,versionsWithHistoricalTags:Object.values(matches).filter(v=>v.length).length}));

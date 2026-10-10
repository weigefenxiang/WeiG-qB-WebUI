#!/usr/bin/env node
// A72 observation only: never admit prerelease source into Frozen stable contracts.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve(process.argv[2]||'');
if(!fs.existsSync(path.join(root,'.git')))throw new Error('Usage: node tests/a72-prerelease-source-audit.mjs <upstream-qB-git-clone>');
const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024}).trim();
const expected=[
  {channel:'stable',tag:'release-5.2.4',commit:'a1e4649cb8ae581925acc161dbab5cbc6584c542',webApi:'2.15.1'},
  {channel:'beta',tag:'release-5.3.0beta1',commit:'26663c60a4a772b9bb0661bc11a4577ca75a5db5',webApi:'2.16.2'},
  {channel:'rc',tag:'release-5.3.0rc1',commit:'b76f8383561283c29c9577554ea6127cfde8a4a4',webApi:'2.16.2'}
];
// Pin the exact upstream Git blobs reviewed alongside the annotated release tags.
// These identities are audit witnesses, not source admission or runtime settings.
const sourceBlobWitnesses={
  'release-5.2.4':{
    'src/webui/webapplication.h':'3dedda7b9dfbb743e6f8419102c4bd305d6b4de2',
    'src/webui/api/appcontroller.h':'e94c641d3ea1baa8bc300100261a6bbb0209f085',
    'src/webui/api/torrentscontroller.h':'d3ef62a9dda9a2d421b12c293caadea86b458486',
    'src/webui/api/rsscontroller.h':'9c9e5f1fd585c717f3c093a1bf804d6c543858d4'
  },
  'release-5.3.0beta1':{
    'src/webui/webapplication.h':'8bd23c2541be16387ba43ea5b46d2002ba32e7fc',
    'src/webui/api/appcontroller.h':'8837458ebd274bfeade1b1df51956d8fcf844216',
    'src/webui/api/torrentscontroller.h':'4eb102e89ff93de90a7fd93e94c88ea35dff3658',
    'src/webui/api/rsscontroller.h':'e370dde0d17f24dabde04a468cc8e749aea0afde'
  },
  'release-5.3.0rc1':{
    'src/webui/webapplication.h':'1525325deb5112000994905a18ce42606558c840',
    'src/webui/api/appcontroller.h':'8837458ebd274bfeade1b1df51956d8fcf844216',
    'src/webui/api/torrentscontroller.h':'4eb102e89ff93de90a7fd93e94c88ea35dff3658',
    'src/webui/api/rsscontroller.h':'a4b1bfd7a31010b8e34b80477a475b1903cff0b9'
  }
};
const watched=[
  'src/webui/webapplication.h',
  'src/webui/api/appcontroller.h',
  'src/webui/api/appcontroller.cpp',
  'src/webui/api/torrentscontroller.h',
  'src/webui/api/torrentscontroller.cpp',
  'src/webui/api/rsscontroller.h',
  'src/webui/api/rsscontroller.cpp',
  'src/webui/api/serialize/serialize_torrent.cpp',
  'src/webui/api/synccontroller.cpp',
  'src/webui/www/private/views/preferences.html',
  'src/webui/www/private/views/rssDownloader.html',
  'src/webui/www/private/views/rssCloneRule.html'
];
const observed=git('tag','--list','release-5.3.0*').split(/\r?\n/).filter(tag=>/^release-5\.3\.0(?:alpha|beta|rc)\d+$/.test(tag));
const unknown=observed.filter(tag=>!expected.some(row=>row.tag===tag));
if(unknown.length)throw new Error('Official qB 5.3 prerelease tag(s) need source review before claiming coverage: '+unknown.join(', '));
const blobs=(tag,p)=>{
  try{return git('rev-parse','refs/tags/'+tag+':'+p);}
  catch{return null;}
};
const snapshots=expected.map(row=>{
  const exact=git('rev-parse','refs/tags/'+row.tag+'^{commit}');
  if(exact!==row.commit)throw new Error(row.tag+' source SHA changed; freeze fresh source evidence before proceeding');
  for(const [sourcePath,sha] of Object.entries(sourceBlobWitnesses[row.tag]||{})){
    const actual=blobs(row.tag,sourcePath);
    if(actual!==sha)throw new Error(row.tag+' official Git blob changed: '+sourcePath+' expected '+sha+' actual '+actual);
  }
  const text=git('show','refs/tags/'+row.tag+':src/webui/webapplication.h');
  const match=/API_VERSION\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/.exec(text);
  if(!match)throw new Error(row.tag+' API_VERSION source parser unable to identify version');
  const actual=match.slice(1).join('.');
  if(actual!==row.webApi)throw new Error(row.tag+' WebAPI source identity changed: '+actual+' != '+row.webApi);
  return{...row,apiSource:'src/webui/webapplication.h',blobs:Object.fromEntries(watched.map(p=>[p,blobs(row.tag,p)]))};
});
const stable=snapshots[0];
for(const item of snapshots.slice(1)){
  const changed=watched.filter(p=>item.blobs[p]!==stable.blobs[p]);
  if(!changed.includes('src/webui/api/appcontroller.h')||!changed.includes('src/webui/www/private/views/preferences.html'))throw new Error(item.tag+' upstream change inventory unexpectedly lost reviewed API/Settings drift');
  item.changedVsStable=changed;
  item.certifiedByWeiG=false;
}
// Compare complete source action declarations by pinned tag, not by guessed
// WebAPI endpoint names. The following deltas remain observed-only.
function declaredActions(tag,file){
  const text=git('show','refs/tags/'+tag+':src/webui/api/'+file+'.h');
  return new Set(Array.from(text.matchAll(/\bvoid\s+(\w+Action)\s*\(/g),m=>m[1]));
}
function declaredDelta(from,to,file){
  const old=declaredActions(from,file),next=declaredActions(to,file);
  return{added:[...next].filter(x=>!old.has(x)).sort(),removed:[...old].filter(x=>!next.has(x)).sort()};
}
const expectedDeltas={
  'release-5.3.0beta1':{
    appcontroller:['getFreeSpaceAtPathAction'],
    torrentscontroller:['downloadFileAction'],
    rsscontroller:['cloneRuleAction']
  },
  'release-5.3.0rc1':{
    appcontroller:[],
    torrentscontroller:[],
    rsscontroller:['exportRulesAction','importRulesAction']
  }
};
const sourceActionDelta={};
for(const [tag,previous] of [['release-5.3.0beta1','release-5.2.4'],['release-5.3.0rc1','release-5.3.0beta1']]){
  sourceActionDelta[tag]={};
  for(const [file,expectedAdd] of Object.entries(expectedDeltas[tag])){
    const change=declaredDelta(previous,tag,file);
    if(JSON.stringify(change.added)!==JSON.stringify(expectedAdd)||change.removed.length){
      throw new Error(tag+': upstream '+file+' action declaration drift requires source review: '+JSON.stringify(change));
    }
    sourceActionDelta[tag][file]=change;
  }
}
const result={
  schemaVersion:1,kind:'A72-upstream-prerelease-source-observation',
  productSha:String(process.env.GITHUB_SHA||''),
  stableFrozenUnaffected:true,sourceReadOnly:true,
  observedPrereleaseTags:observed.sort(),
  sourceActionDelta,
  snapshots
};
if(!/^[a-f0-9]{40}$/.test(result.productSha))throw new Error('A72 prerelease source evidence requires current exact product SHA');
const output=path.resolve(process.env.A72_UPSTREAM_SOURCE_OUTPUT||'artifacts/a72-prerelease-source/source-audit.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log('A72 official exact-source prerelease audit:',JSON.stringify(snapshots.map(s=>({tag:s.tag,commit:s.commit,webApi:s.webApi,changedVsStable:s.changedVsStable?.length||0,certified:s.certifiedByWeiG===true}))));

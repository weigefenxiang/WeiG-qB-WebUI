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
const result={
  schemaVersion:1,kind:'A72-upstream-prerelease-source-observation',
  productSha:String(process.env.GITHUB_SHA||''),
  stableFrozenUnaffected:true,sourceReadOnly:true,
  observedPrereleaseTags:observed.sort(),
  snapshots
};
if(!/^[a-f0-9]{40}$/.test(result.productSha))throw new Error('A72 prerelease source evidence requires current exact product SHA');
const output=path.resolve(process.env.A72_UPSTREAM_SOURCE_OUTPUT||'artifacts/a72-prerelease-source/source-audit.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log('A72 official exact-source prerelease audit:',JSON.stringify(snapshots.map(s=>({tag:s.tag,commit:s.commit,webApi:s.webApi,changedVsStable:s.changedVsStable?.length||0,certified:s.certifiedByWeiG===true}))));

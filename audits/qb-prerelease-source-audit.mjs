#!/usr/bin/env node
// A72 observation only: never admit prerelease source into Frozen stable contracts.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {extractPreferenceDescriptors} from '../tools/qb-source-parsers.mjs';
import {extractQbPreferencesNativeSurface} from '../tools/qb-preferences-surface-source.mjs';

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
// One source-census owner for ALL future official release tags, not merely
// 5.3.0*. New stable or prerelease tags require explicit official-source review
// before A72 can claim coverage; discovery NEVER admits a write contract.
function futureOfficialTag(tag){
  const match=/^release-(\d+)\.(\d+)\.(\d+)(?:[-._]?(alpha|beta|rc|pre|dev|nightly)(?:[-._]?(\d+))?)?$/i.exec(String(tag||''));
  if(!match)return null;
  const version=match.slice(1,4).map(Number);
  const floor=[5,2,4];
  for(let i=0;i<3;i++){
    if(version[i]>floor[i])return{tag,channel:(match[4]||'stable').toLowerCase()};
    if(version[i]<floor[i])return null;
  }
  return null;
}
const discovered=git('tag','--list','release-*').split(/\r?\n/).map(futureOfficialTag).filter(Boolean);
const observed=discovered.filter(row=>row.channel!=='stable').map(row=>row.tag).sort();
const unknown=discovered.map(row=>row.tag).filter(tag=>!expected.some(row=>row.tag===tag)).sort();
if(unknown.length)throw new Error('New official qB stable/prerelease tags require source review before A72 compatibility claims: '+unknown.join(', '));
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
// Reuse the canonical Settings source parser to observe GET/SET type drift
// without emitting runtime bindings or assuming any new field is safe to write.
function sourcePreferenceIndex(tag){
  const source=git('show','refs/tags/'+tag+':src/webui/api/appcontroller.cpp');
  const descriptors=extractPreferenceDescriptors(source,'official '+tag);
  if(descriptors.length<50)throw new Error(tag+': unexpectedly sparse Preferences extraction; source format needs review');
  return new Map(descriptors.map(row=>[row.key,{
    readType:row.readType||null,writeType:row.writeType||null,
    getterPresent:row.getterPresent===true,setterPresent:row.setterPresent===true,
    typeAgreement:row.typeAgreement||'UNRESOLVED'
  }]));
}
function preferenceDrift(before,after){
  const added=[...after.keys()].filter(key=>!before.has(key)).sort();
  const removed=[...before.keys()].filter(key=>!after.has(key)).sort();
  const changed=[...after.keys()].filter(key=>before.has(key)&&JSON.stringify(after.get(key))!==JSON.stringify(before.get(key))).sort().map(key=>({
    key,before:before.get(key),after:after.get(key)
  }));
  return{added,removed,changed,sourceOnly:true,writeCertified:false};
}
const preferenceSources=Object.fromEntries(expected.map(row=>[row.tag,sourcePreferenceIndex(row.tag)]));
const preferenceSourceDelta={
  'release-5.3.0beta1':preferenceDrift(preferenceSources['release-5.2.4'],preferenceSources['release-5.3.0beta1']),
  'release-5.3.0rc1':preferenceDrift(preferenceSources['release-5.3.0beta1'],preferenceSources['release-5.3.0rc1'])
};
// Native field types, source select options and gate dependencies remain
// observation-only until the existing Settings compatibility owner admits them.
function showOptional(tag,p){
  try{return git('show','refs/tags/'+tag+':'+p);}catch{return'';}
}
function nativeIndex(tag){
  const preferenceDescriptors=extractPreferenceDescriptors(git('show','refs/tags/'+tag+':src/webui/api/appcontroller.cpp'),'official '+tag);
  const preferencesSource=git('show','refs/tags/'+tag+':src/webui/www/private/views/preferences.html');
  const toolbarSource=showOptional(tag,'src/webui/www/private/views/preferencesToolbar.html');
  const miscSource=showOptional(tag,'src/webui/www/private/scripts/misc.js');
  const parsed=extractQbPreferencesNativeSurface({preferencesSource,toolbarSource,miscSource,preferenceDescriptors});
  if(!Array.isArray(parsed.tabs)||parsed.tabs.length<6||parsed.mappedPreferences<30)throw new Error(tag+': official source-native Settings surface is unexpectedly incomplete');
  const rows=new Map();
  for(const [key,item] of Object.entries(parsed.preferences)){
    const ctrl=item.control||{},details={
      controlId:String(ctrl.id||''),semantic:String(ctrl.semantic||''),
      attributes:ctrl.attributes||{},options:(ctrl.options||[]).map(option=>String(option.value??'')),
      gates:(item.dependencies?.gates||[]).map(gate=>String(gate.controlId||'')).sort(),
      projection:String(item.projection?.kind||''),
      readType:item.descriptor?.readType||null,writeType:item.descriptor?.writeType||null
    };
    rows.set(key,details);
  }
  return{totalPreferences:parsed.totalPreferences,mappedPreferences:parsed.mappedPreferences,tabs:parsed.tabs.map(tab=>tab.id),rows};
}
const sourceNativeSurfaces=Object.fromEntries(expected.map(row=>[row.tag,nativeIndex(row.tag)]));
function nativeDelta(before,after){
  return{
    added:[...after.rows.keys()].filter(key=>!before.rows.has(key)).sort(),
    removed:[...before.rows.keys()].filter(key=>!after.rows.has(key)).sort(),
    changed:[...after.rows.keys()].filter(key=>before.rows.has(key)&&JSON.stringify(before.rows.get(key))!==JSON.stringify(after.rows.get(key))).sort().map(key=>({
      key,before:before.rows.get(key),after:after.rows.get(key)
    })),
    totalBefore:before.totalPreferences,totalAfter:after.totalPreferences,
    mappedBefore:before.mappedPreferences,mappedAfter:after.mappedPreferences,
    tabsBefore:before.tabs,tabsAfter:after.tabs,
    sourceOnly:true,writeCertified:false
  };
}
const nativeSettingsDelta={
  'release-5.3.0beta1':nativeDelta(sourceNativeSurfaces['release-5.2.4'],sourceNativeSurfaces['release-5.3.0beta1']),
  'release-5.3.0rc1':nativeDelta(sourceNativeSurfaces['release-5.3.0beta1'],sourceNativeSurfaces['release-5.3.0rc1'])
};
const result={
  schemaVersion:1,kind:'A72-upstream-prerelease-source-observation',
  productSha:String(process.env.GITHUB_SHA||''),
  stableFrozenUnaffected:true,sourceReadOnly:true,
  observedPrereleaseTags:observed.sort(),
  sourceActionDelta,
  preferenceSourceDelta,
  nativeSettingsDelta,
  snapshots
};
if(!/^[a-f0-9]{40}$/.test(result.productSha))throw new Error('A72 prerelease source evidence requires current exact product SHA');
const output=path.resolve(process.env.A72_UPSTREAM_SOURCE_OUTPUT||'artifacts/a72-prerelease-source/source-audit.json');
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log('A72 official exact-source prerelease audit:',JSON.stringify(snapshots.map(s=>({tag:s.tag,commit:s.commit,webApi:s.webApi,changedVsStable:s.changedVsStable?.length||0,certified:s.certifiedByWeiG===true}))),JSON.stringify(Object.fromEntries(Object.entries(preferenceSourceDelta).map(([tag,x])=>[tag,{added:x.added.length,removed:x.removed.length,changed:x.changed.length,writeCertified:false}]))));

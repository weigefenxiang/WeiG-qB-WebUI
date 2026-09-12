#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {extractPreferenceDescriptors,extractPreferenceKeys} from './qb-source-parsers.mjs';
import {extractTorrentFilters,extractTorrentInfoParameters} from './qb-torrent-surface-parsers.mjs';
import {extractTorrentInfoFields,extractTorrentStates} from './qb-torrent-fields-parser.mjs';
import {extractTorrentDetailSurfaces} from './qb-detail-surface-parsers.mjs';
import {extractControllerActionParameters} from './qb-action-surface-parsers.mjs';
import {supportedStableReleaseTags} from './qb-release-tags.mjs';
import {enrichPreferenceDescriptorsFromGetter} from './qb-preference-semantics.mjs';
import {validateCatalogQuality} from './qb-catalog-quality.mjs';

function arg(name,fallback=''){
  const prefix=`--${name}=`;
  const hit=process.argv.find(value=>value.startsWith(prefix));
  return hit?hit.slice(prefix.length):fallback;
}
function requiredInt(name){
  const value=Number(arg(name));
  if(!Number.isInteger(value))throw new Error(`Missing or invalid --${name}=N`);
  return value;
}

const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
const output=path.resolve(arg('output','qb-releases-shard.json'));
const manifestOutput=path.resolve(arg('manifest','qb-releases-shard.meta.json'));
const shardIndex=requiredInt('shard-index');
const shardCount=requiredInt('shard-count');
if(!qbRoot||!fs.existsSync(qbRoot))throw new Error('Usage: node tools/qb-release-catalog-shard.mjs <qBittorrent-clone> --shard-index=N --shard-count=M [--output=path] [--manifest=path]');
if(shardCount<1||shardIndex<0||shardIndex>=shardCount)throw new Error(`Invalid catalog shard ${shardIndex}/${shardCount}.`);

function git(...args){return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function parts(v){return String(v).replace(/^release-/,'').split('.').map(x=>Number.parseInt(x,10)||0);}
function show(ref,file){return git('show',`${ref}:${file}`);}
function parseApi(source,tag){const m=source.match(/API_VERSION\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/);if(!m)throw new Error(`${tag}: cannot parse API_VERSION`);return`${m[1]}.${m[2]}.${m[3]}`;}

function preferenceSurface(ref){
  const source=show(ref,'src/webui/api/appcontroller.cpp');
  const sessionHeaderSource=show(ref,'src/base/bittorrent/session.h');
  const preferencesHeaderSource=show(ref,'src/base/preferences.h');
  const preferenceKeys=extractPreferenceKeys(source,ref);
  const structuralDescriptors=extractPreferenceDescriptors(source,ref);
  const preferenceDescriptors=enrichPreferenceDescriptorsFromGetter(source,structuralDescriptors,ref,{sessionHeaderSource,preferencesHeaderSource});
  if(preferenceDescriptors.length!==preferenceKeys.length)throw new Error(`${ref}: descriptor/key count mismatch ${preferenceDescriptors.length}/${preferenceKeys.length}`);
  const expected=new Set(preferenceKeys),seen=new Set();
  for(const descriptor of preferenceDescriptors){
    if(!expected.has(descriptor.key))throw new Error(`${ref}: descriptor escaped Preferences surface: ${descriptor.key}`);
    if(seen.has(descriptor.key))throw new Error(`${ref}: duplicate descriptor: ${descriptor.key}`);
    seen.add(descriptor.key);
    if(descriptor.writable&&!descriptor.writeType)throw new Error(`${ref}: writable descriptor lacks high-confidence writeType: ${descriptor.key}`);
    if(descriptor.typeAgreement==='MISMATCH'&&descriptor.writable)throw new Error(`${ref}: conflicting descriptor cannot remain writable: ${descriptor.key}`);
  }
  const getterPresent=preferenceDescriptors.filter(item=>item.getterPresent===true).length;
  const setterPresent=preferenceDescriptors.filter(item=>item.setterPresent===true).length;
  const readTyped=preferenceDescriptors.filter(item=>item.readType).length;
  const writeTyped=preferenceDescriptors.filter(item=>item.writeType).length;
  const exactAgreement=preferenceDescriptors.filter(item=>item.typeAgreement==='EXACT').length;
  const mismatched=preferenceDescriptors.filter(item=>item.typeAgreement==='MISMATCH').length;
  const safeFallback=preferenceDescriptors.filter(item=>item.upstreamFallbackValue!==null&&item.upstreamFallbackValue!==undefined).length;
  const semanticGetterEnriched=preferenceDescriptors.filter(item=>item.semanticGetterEnriched===true).length;
  const structuredRead=preferenceDescriptors.filter(item=>item.readType==='array'||item.readType==='object').length;
  const structuredWrite=preferenceDescriptors.filter(item=>item.writeType==='array'||item.writeType==='object').length;
  return{preferenceKeys,preferenceDescriptors,preferenceDescriptorStats:{total:preferenceKeys.length,getterPresent,setterPresent,readTyped,writeTyped,exactAgreement,mismatched,safeFallback,semanticGetterEnriched,unresolvedRead:preferenceKeys.length-readTyped,unresolvedWrite:preferenceKeys.length-writeTyped,structuredRead,structuredWrite,typed:writeTyped,highConfidence:writeTyped,unresolved:preferenceKeys.length-writeTyped,structured:structuredWrite}};
}

function apiActions(ref){
  const names=git('ls-tree','-r','--name-only',ref,'src/webui/api').split(/\r?\n/).filter(x=>x.endsWith('controller.h'));
  const actions=new Set();
  for(const file of names){
    const source=show(ref,file);
    for(const m of source.matchAll(/\bvoid\s+([A-Za-z0-9_]+Action)\s*\(/g))actions.add(`${path.basename(file)}:${m[1]}`);
  }
  return[...actions].sort();
}

function apiActionSurface(ref,actions){
  const byHeader=new Map();
  for(const action of actions){const [header]=action.split(':');if(!byHeader.has(header))byHeader.set(header,[]);byHeader.get(header).push(action);}
  const result={};
  for(const [header,expected] of byHeader){
    const cpp=`src/webui/api/${header.replace(/\.h$/,'.cpp')}`;
    let source;try{source=show(ref,cpp);}catch{throw new Error(`${ref}: missing controller implementation ${cpp} for ${expected.join(', ')}`);}
    const parsed=extractControllerActionParameters(source,header,ref);
    for(const action of expected){if(!Object.prototype.hasOwnProperty.call(parsed,action))throw new Error(`${ref}: action parameter parser missed ${action}`);result[action]=parsed[action];}
  }
  return Object.fromEntries(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}

function torrentSurface(ref){
  const torrentsControllerSource=show(ref,'src/webui/api/torrentscontroller.cpp');
  const torrentFilterSource=show(ref,'src/base/torrentfilter.cpp');
  const serializerSource=show(ref,'src/webui/api/serialize/serialize_torrent.cpp');
  const serializerHeaderSource=show(ref,'src/webui/api/serialize/serialize_torrent.h');
  return{
    torrentFilters:extractTorrentFilters({torrentFilterSource,torrentsControllerSource},ref),
    torrentInfoParameters:extractTorrentInfoParameters(torrentsControllerSource,ref),
    torrentInfoFields:extractTorrentInfoFields({headerSource:serializerHeaderSource,serializerSource},ref),
    torrentStates:extractTorrentStates(serializerSource,ref),
    ...extractTorrentDetailSurfaces(torrentsControllerSource,ref)
  };
}

const allTags=supportedStableReleaseTags(git('tag','--list','release-*').split(/\r?\n/).filter(Boolean));
if(!allTags.length)throw new Error('No stable qBittorrent release tags found from 4.1.0.');
const tags=allTags.filter((_,position)=>position%shardCount===shardIndex);
if(!tags.length)throw new Error(`Catalog shard ${shardIndex}/${shardCount} owns no stable tags.`);

const profiles=[];
for(const tag of tags){
  const qbVersion=tag.slice('release-'.length);
  const webApiVersion=parseApi(show(tag,'src/webui/webapplication.h'),tag);
  const sourceSha=git('rev-list','-n','1',tag);
  const preferences=preferenceSurface(tag);
  const actions=apiActions(tag);
  profiles.push({
    qbVersion,webApiVersion,tag,sourceSha,stable:true,officialWeiGSupport:true,
    protocolGeneration:`webapi-v${parts(webApiVersion)[0]||'unknown'}`,
    ...preferences,
    apiActions:actions,
    apiActionParameters:apiActionSurface(tag,actions),
    ...torrentSurface(tag)
  });
}
validateCatalogQuality(profiles);

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.mkdirSync(path.dirname(manifestOutput),{recursive:true});
fs.writeFileSync(output,JSON.stringify(profiles,null,2)+'\n','utf8');
fs.writeFileSync(manifestOutput,JSON.stringify({schemaVersion:1,shardIndex,shardCount,allTags,ownedTags:tags,profileCount:profiles.length},null,2)+'\n','utf8');
console.log(`Extracted raw qB catalog shard ${shardIndex+1}/${shardCount}: ${profiles.length}/${allTags.length} stable releases (${tags[0]} -> ${tags.at(-1)}).`);

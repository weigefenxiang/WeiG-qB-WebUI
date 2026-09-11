import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {extractPreferenceDescriptors,extractPreferenceKeys} from './qb-source-parsers.mjs';
import {extractTorrentFilters,extractTorrentInfoParameters} from './qb-torrent-surface-parsers.mjs';
import {extractTorrentInfoFields,extractTorrentStates} from './qb-torrent-fields-parser.mjs';
import {extractTorrentDetailSurfaces} from './qb-detail-surface-parsers.mjs';
import {extractControllerActionParameters} from './qb-action-surface-parsers.mjs';
import {compareQbVersions,isSupportedStableReleaseTag,supportedStableReleaseTags} from './qb-release-tags.mjs';
import {enrichPreferenceDescriptorsFromGetter} from './qb-preference-semantics.mjs';
import {annotateCatalogEvolution,validateCatalogEvolution} from './qb-catalog-evolution.mjs';
import {summarizeCatalogQuality,validateCatalogQuality} from './qb-catalog-quality.mjs';

const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
const outputArg=process.argv.find(x=>x.startsWith('--output='));
const output=path.resolve(outputArg?outputArg.slice('--output='.length):'simulator/versions/catalog.generated.json');
const baseArg=process.argv.find(x=>x.startsWith('--base-catalog='));
const basePath=baseArg?path.resolve(baseArg.slice('--base-catalog='.length)):null;
const refsArg=process.argv.find(x=>x.startsWith('--refs='));
const requestedRefs=refsArg?refsArg.slice('--refs='.length).split(',').map(x=>x.trim()).filter(Boolean):[];
if(!qbRoot||!fs.existsSync(qbRoot)){console.error('Usage: node tools/qb-release-catalog.mjs <qBittorrent-clone> [--output=path] [--base-catalog=path] [--refs=release-x.y.z,...]');process.exit(2);}
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
    let source;try{source=show(ref,cpp);}catch(error){throw new Error(`${ref}: missing controller implementation ${cpp} for ${expected.join(', ')}`);}
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

function readBaseCatalog(){
  if(!basePath)return[];
  if(!fs.existsSync(basePath))throw new Error(`Frozen base catalog not found: ${basePath}`);
  const value=JSON.parse(fs.readFileSync(basePath,'utf8'));
  if(!Array.isArray(value)||!value.length)throw new Error('Frozen base catalog must be a non-empty array.');
  return value;
}
function stableTags(){return supportedStableReleaseTags(git('tag','--list','release-*').split(/\r?\n/).filter(Boolean));}
function assertFrozenPrefix(allTags,baseCatalog){
  const baseTags=baseCatalog.map(item=>String(item?.tag||''));
  if(baseTags[0]!=='release-4.1.0')throw new Error(`Frozen base catalog floor must be release-4.1.0, got ${baseTags[0]||'empty'}`);
  if(baseTags.length>allTags.length)throw new Error(`Upstream stable tag set shrank below frozen LKG: ${allTags.length} < ${baseTags.length}`);
  for(let i=0;i<baseTags.length;i++)if(baseTags[i]!==allTags[i])throw new Error(`Frozen stable history changed at ordinal ${i}: LKG ${baseTags[i]} vs upstream ${allTags[i]||'missing'}`);
  return baseTags;
}

const allTags=stableTags();
if(!allTags.length)throw new Error('No stable qBittorrent release tags found from 4.1.0.');
const baseCatalog=readBaseCatalog();
if(baseCatalog.length)assertFrozenPrefix(allTags,baseCatalog);
let tags;
if(requestedRefs.length){
  tags=[...new Set(requestedRefs)].sort(compareQbVersions);
  for(const tag of tags){if(!isSupportedStableReleaseTag(tag))throw new Error(`Invalid or unsupported stable ref: ${tag}`);git('rev-parse','--verify',`refs/tags/${tag}`);}
  if(baseCatalog.length){const frozen=new Set(baseCatalog.map(item=>item.tag));for(const tag of tags)if(frozen.has(tag))throw new Error(`Incremental extraction must not re-parse frozen stable tag ${tag}`);}
}else tags=baseCatalog.length?allTags.slice(baseCatalog.length):allTags;

const catalog=baseCatalog.map(item=>structuredClone(item));
for(const tag of tags){
  const qbVersion=tag.slice('release-'.length);
  const webApiVersion=parseApi(show(tag,'src/webui/webapplication.h'),tag);
  const sourceSha=git('rev-list','-n','1',tag);
  const preferences=preferenceSurface(tag);
  const actions=apiActions(tag);
  catalog.push({
    qbVersion,webApiVersion,tag,sourceSha,stable:true,officialWeiGSupport:true,
    protocolGeneration:`webapi-v${parts(webApiVersion)[0]||'unknown'}`,
    ...preferences,
    apiActions:actions,
    apiActionParameters:apiActionSurface(tag,actions),
    ...torrentSurface(tag)
  });
}
if(!catalog.length)throw new Error('No catalog profiles were produced.');
if(tags.length||!baseCatalog.length){
  const frozenJson=baseCatalog.map(item=>JSON.stringify(item));
  annotateCatalogEvolution(catalog);
  validateCatalogEvolution(catalog);
  validateCatalogQuality(catalog);
  for(let i=0;i<frozenJson.length;i++)if(JSON.stringify(catalog[i])!==frozenJson[i])throw new Error(`Incremental annotation mutated frozen LKG profile ${baseCatalog[i].qbVersion}`);
}else{
  validateCatalogEvolution(catalog);
  validateCatalogQuality(catalog);
}
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(catalog,null,2)+'\n','utf8');
const totals=summarizeCatalogQuality(catalog),safeFallback=catalog.reduce((sum,item)=>sum+(Number(item.preferenceDescriptorStats?.safeFallback)||0),0);
const admission=baseCatalog.length?`; preserved ${baseCatalog.length} frozen profiles and source-parsed ${tags.length} new stable tag${tags.length===1?'':'s'}`:'';
console.log(`Generated ${catalog.length} stable qB profiles: ${catalog[0].qbVersion} -> ${catalog.at(-1).qbVersion}${admission}; API actions ${totals.actions} / params ${totals.actionParameters}; Torrent fields ${totals.torrentInfoFields}, states ${totals.torrentStates}, filters ${totals.torrentFilters}, properties ${totals.torrentPropertiesFields}, tracker fields ${totals.torrentTrackerFields}, file fields ${totals.torrentFileFields}; preference getter types ${totals.readTyped}/${totals.preferences} (${totals.semanticGetterEnriched} semantic enrichments), setter types ${totals.writeTyped}/${totals.preferences}, exact read/write agreement ${totals.exactAgreement}, conflicts ${totals.mismatched}, enum fallbacks ${safeFallback}.`);

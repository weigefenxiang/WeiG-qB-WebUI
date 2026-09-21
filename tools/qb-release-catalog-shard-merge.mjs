#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {compareQbVersions} from './qb-release-tags.mjs';
import {annotateCatalogEvolution,validateCatalogEvolution} from './qb-catalog-evolution.mjs';
import {validateCatalogQuality} from './qb-catalog-quality.mjs';
import {materializeQbNativeQmRecoveryUnion,mergeQbNativeQmRecoveryEvidence} from './qb-native-qm-recovery.mjs';

const shardDir=path.resolve(process.argv[2]||'');
const output=path.resolve(process.argv[3]||'qb-releases.json');
if(!shardDir||!fs.existsSync(shardDir))throw new Error('Usage: node tools/qb-release-catalog-shard-merge.mjs <shard-dir> [output.json]');
function recoveryOutputPath(value){return /\.json$/i.test(value)?value.replace(/\.json$/i,'.recovery.json'):`${value}.recovery.json`;}
function baseLanguage(value){return String(value||'').trim().replace(/-/g,'_').split('_')[0].split('@')[0].toLowerCase();}

const metaFiles=fs.readdirSync(shardDir).filter(name=>/^qb-releases-shard-\d+\.meta\.json$/.test(name)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
if(!metaFiles.length)throw new Error('No qB catalog shard manifests were found.');
const metas=metaFiles.map(name=>JSON.parse(fs.readFileSync(path.join(shardDir,name),'utf8')));
const shardCount=Number(metas[0]?.shardCount);
if(!Number.isInteger(shardCount)||shardCount<1)throw new Error('Catalog shard manifest has invalid shardCount.');
if(metas.length!==shardCount)throw new Error(`Expected ${shardCount} catalog shard manifests, found ${metas.length}.`);
const canonicalTags=metas[0]?.allTags;
if(!Array.isArray(canonicalTags)||!canonicalTags.length)throw new Error('Catalog shard manifest is missing allTags.');

const seenShardIndexes=new Set();
const profiles=[];
const recoveryShards=[];
for(const meta of metas){
  if(meta?.schemaVersion!==1)throw new Error('Unsupported qB catalog shard manifest schema.');
  const index=Number(meta.shardIndex);
  if(!Number.isInteger(index)||index<0||index>=shardCount)throw new Error(`Invalid catalog shard index ${meta.shardIndex}.`);
  if(seenShardIndexes.has(index))throw new Error(`Duplicate catalog shard index ${index}.`);
  seenShardIndexes.add(index);
  if(Number(meta.shardCount)!==shardCount)throw new Error(`Catalog shard ${index} disagrees on shardCount.`);
  if(JSON.stringify(meta.allTags)!==JSON.stringify(canonicalTags))throw new Error(`Catalog shard ${index} disagrees on the upstream stable tag set.`);
  const expectedOwned=canonicalTags.filter((_,position)=>position%shardCount===index);
  if(JSON.stringify(meta.ownedTags)!==JSON.stringify(expectedOwned))throw new Error(`Catalog shard ${index} owns the wrong stable tag slice.`);
  const shardPath=path.join(shardDir,`qb-releases-shard-${index}.json`);
  if(!fs.existsSync(shardPath))throw new Error(`Missing enriched catalog shard ${index}.`);
  const shard=JSON.parse(fs.readFileSync(shardPath,'utf8'));
  if(!Array.isArray(shard)||shard.length!==expectedOwned.length)throw new Error(`Catalog shard ${index} profile count mismatch.`);
  const actualTags=shard.map(profile=>String(profile?.tag||''));
  if(JSON.stringify(actualTags)!==JSON.stringify(expectedOwned))throw new Error(`Catalog shard ${index} profile identities drifted from its exact upstream tag slice.`);
  const recoveryPath=path.join(shardDir,`qb-releases-shard-${index}.recovery.json`);
  if(!fs.existsSync(recoveryPath))throw new Error(`Missing full-TS recovery evidence shard ${index}.`);
  recoveryShards.push(JSON.parse(fs.readFileSync(recoveryPath,'utf8')));
  profiles.push(...shard);
}
if(seenShardIndexes.size!==shardCount)throw new Error(`Catalog shard index coverage mismatch: ${seenShardIndexes.size}/${shardCount}.`);

profiles.sort((a,b)=>compareQbVersions(String(a?.tag||a?.qbVersion||''),String(b?.tag||b?.qbVersion||'')));
const mergedTags=profiles.map(profile=>String(profile?.tag||''));
if(JSON.stringify(mergedTags)!==JSON.stringify(canonicalTags))throw new Error(`Merged catalog stable tag coverage mismatch: ${mergedTags.length}/${canonicalTags.length}.`);
if(new Set(mergedTags).size!==mergedTags.length)throw new Error('Merged qB catalog contains duplicate stable tags.');

const recoveryEvidence=mergeQbNativeQmRecoveryEvidence(recoveryShards);
const recoveryReleaseIds=new Set(recoveryEvidence.releases.map(item=>`${item.qbVersion}\u0000${item.sourceSha}\u0000${item.locale}`));
const profileByVersion=new Map(profiles.map(profile=>[String(profile.qbVersion),profile]));
for(const release of recoveryEvidence.releases){
  const profile=profileByVersion.get(String(release.qbVersion));
  if(!profile||String(profile.sourceSha)!==String(release.sourceSha))throw new Error(`${release.qbVersion} ${release.locale}: recovery evidence escaped its exact merged source profile.`);
}
for(const profile of profiles){
  for(const localeEntry of profile.webuiLocales||[]){
    const locale=String(typeof localeEntry==='string'?localeEntry:localeEntry?.value||'').trim();
    if(!locale||baseLanguage(locale)==='en')continue;
    const identity=`${profile.qbVersion}\u0000${profile.sourceSha}\u0000${locale}`;
    if(!recoveryReleaseIds.has(identity))throw new Error(`${profile.qbVersion} ${locale}: merged source profile lacks full official TS recovery evidence.`);
  }
}
const recoveryUnion=materializeQbNativeQmRecoveryUnion(recoveryEvidence);

annotateCatalogEvolution(profiles);
validateCatalogEvolution(profiles);
validateCatalogQuality(profiles);
for(const profile of profiles){
  if(!Array.isArray(profile.webuiLocales)||profile.webuiLocales.length===0)throw new Error(`${profile.qbVersion}: merged Settings evidence shard lacks WebUI locale facts.`);
  if(!profile.settingsTranslations||typeof profile.settingsTranslations!=='object')throw new Error(`${profile.qbVersion}: merged Settings evidence shard lacks Settings translation mapping facts.`);
}

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(profiles,null,2)+'\n','utf8');
fs.writeFileSync(recoveryOutputPath(output),JSON.stringify(recoveryEvidence,null,2)+'\n','utf8');
console.log(`Merged ${shardCount} parallel qB source+locale shards into ${profiles.length} exact stable release profiles: ${profiles[0].qbVersion} -> ${profiles.at(-1).qbVersion}; recovery routes ${recoveryEvidence.releases.length}, locales ${Object.keys(recoveryUnion.locales).length}.`);

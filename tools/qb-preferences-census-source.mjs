#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {admittedCatalogRows,catalogIdentity} from './qb-catalog-identity.mjs';
import {extractQbPreferencesInventory,auditQbPreferencesInventory} from './qb-preferences-inventory.mjs';
import {reviewedQbPreferencesExclusions} from './qb-preferences-reviewed-exclusions.mjs';

function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function showMaybe(root,tag,file){try{return git(root,'show',`${tag}:${file}`);}catch{return'';}}
function preferencesSource(root,tag){
  const candidates=[
    'src/webui/www/private/views/preferences.html',
    'src/webui/www/private/preferences_content.html',
    'src/webui/www/private/preferences.html'
  ];
  for(const file of candidates){const source=showMaybe(root,tag,file);if(source)return{file,source};}
  return null;
}
function admittedProfiles(catalog){return (catalog||[]).filter(profile=>profile?.stable!==false&&profile?.officialWeiGSupport!==false);}
function sameSha(a,b){return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();}

export function buildQbPreferencesCensus(catalog,sourceCatalog,qbRoot){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('qB Preferences census requires a non-empty exact release catalog.');
  if(!sourceCatalog||sourceCatalog.schemaVersion!==1||sourceCatalog.source!=='qb-upstream-preferences-native-surface'||!Array.isArray(sourceCatalog.profiles))throw new Error('qB Preferences census requires the semantic native-surface source catalog.');
  if(!qbRoot||!fs.existsSync(qbRoot))throw new Error(`qB Preferences census upstream checkout is unavailable: ${qbRoot||'missing'}.`);
  const rows=admittedCatalogRows(catalog),bases=admittedProfiles(catalog);
  if(bases.length!==rows.length)throw new Error('qB Preferences census admitted catalog normalization drifted.');
  if(sourceCatalog.profiles.length!==rows.length)throw new Error(`qB Preferences census release-set mismatch: semantic=${sourceCatalog.profiles.length}, expected=${rows.length}.`);
  const profiles=[];
  for(let index=0;index<rows.length;index++){
    const started=Date.now(),row=rows[index],base=bases[index],semantic=sourceCatalog.profiles[index];
    console.log(`[Preferences census ${index+1}/${rows.length} qB ${row.qbVersion}] START`);
    if(String(base?.qbVersion||'')!==row.qbVersion||!sameSha(base?.sourceSha,row.sourceSha))throw new Error(`${row.qbVersion}: canonical catalog row/profile drift.`);
    if(String(semantic?.qbVersion||'')!==row.qbVersion||!sameSha(semantic?.sourceSha,row.sourceSha))throw new Error(`${row.qbVersion}: semantic Preferences source identity drift.`);
    const tag=String(base?.tag||semantic?.tag||`release-${row.qbVersion}`).trim();
    const resolvedSha=git(qbRoot,'rev-list','-n','1',tag);
    if(!sameSha(resolvedSha,row.sourceSha))throw new Error(`${row.qbVersion}: upstream tag ${tag} resolves to ${resolvedSha}, expected ${row.sourceSha}.`);
    const raw=preferencesSource(qbRoot,tag);
    if(!raw)throw new Error(`${row.qbVersion}: independent Preferences census cannot read native source.`);
    const inventory=extractQbPreferencesInventory({preferencesSource:raw.source,preferenceDescriptors:base.preferenceDescriptors||[]});
    const exclusions=reviewedQbPreferencesExclusions({source:raw.source,preferenceDescriptors:base.preferenceDescriptors||[],inventory,manifest:semantic.manifest});
    const census=auditQbPreferencesInventory({inventory,manifest:semantic.manifest,exclusions});
    profiles.push({
      qbVersion:row.qbVersion,
      sourceSha:row.sourceSha,
      tag,
      sourcePath:raw.file,
      inventory:{
        tabs:inventory.tabs.length,
        preferenceRefs:inventory.preferenceRefs.length,
        bindings:inventory.bindings.length,
        rawControls:inventory.controls.length,
        descriptorCount:inventory.descriptorCount,
        referencedDescriptorCount:inventory.referencedDescriptorCount
      },
      reviewedExclusions:exclusions,
      census
    });
    console.log(`[Preferences census ${index+1}/${rows.length} qB ${row.qbVersion}] DONE ${Date.now()-started}ms tabs=${inventory.tabs.length} preferences=${inventory.preferenceRefs.length} bindings=${inventory.bindings.length}`);
  }
  return{schemaVersion:1,source:'qb-upstream-preferences-independent-census',catalogIdentity:catalogIdentity(catalog),profiles};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||''),catalogPath=path.resolve(process.argv[3]||''),sourcePath=path.resolve(process.argv[4]||''),outputPath=path.resolve(process.argv[5]||'qb-preferences-census.json');
    if(!qbRoot||!fs.existsSync(qbRoot)||!catalogPath||!fs.existsSync(catalogPath)||!sourcePath||!fs.existsSync(sourcePath))throw new Error('Usage: node tools/qb-preferences-census-source.mjs <qBittorrent-clone> <qb-releases.json> <qb-preferences-source-catalog.json> [output.json]');
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),sourceCatalog=JSON.parse(fs.readFileSync(sourcePath,'utf8')),result=buildQbPreferencesCensus(catalog,sourceCatalog,qbRoot);
    fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n','utf8');
    const complete=result.profiles.filter(profile=>['tabs','preferences','bindings'].every(domain=>profile.census?.[domain]?.complete)).length;
    console.log(`Generated independent qB Preferences census for ${result.profiles.length} exact releases; complete ${complete}/${result.profiles.length}; Frozen catalog ${result.catalogIdentity.releaseSetSha256.slice(0,12)}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

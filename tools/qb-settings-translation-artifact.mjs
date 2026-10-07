#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyQbSettingsTranslationLkg,buildQbSettingsTranslationLkg} from './qb-settings-translation-lkg.mjs';
import {artifactSourceSha,localSettingsEvidenceCompatibility} from './settings-evidence-compat.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'..');
const ARTIFACT_PAGE_SIZE=100;
const ARTIFACT_MAX_PAGES=10;
const incompatibleArtifactIds=new Set();
function arg(name,fallback=''){const prefix=`--${name}=`;const hit=process.argv.find(value=>value.startsWith(prefix));return hit?hit.slice(prefix.length):fallback;}
function required(name){const value=arg(name);if(!value)throw new Error(`Missing --${name}=...`);return value;}
function canonical(text){return Buffer.from(text.replace(/\r\n?/g,'\n'),'utf8');}
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}

const repository=arg('repo',process.env.GITHUB_REPOSITORY||'');
const branch=arg('branch',process.env.GITHUB_REF_NAME||'dev');
const output=path.resolve(required('out'));
const sourceSha=arg('source-sha',process.env.WEIG_PAGES_SOURCE_SHA||process.env.GITHUB_SHA||'').toLowerCase();
const certifiedOnly=process.argv.includes('--certified-only');
if(sourceSha&&!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error(`Invalid --source-sha=${sourceSha}`);
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
if(!repository||!token)throw new Error('qB Settings/source artifact resolver requires repository identity and GH_TOKEN.');

const stablePath=path.join(projectRoot,'tools/data/qb-stable-lkg.json');
const stable=JSON.parse(fs.readFileSync(stablePath,'utf8'));
const frozenPath=path.join(projectRoot,stable.catalogPath);
const frozenText=fs.readFileSync(frozenPath,'utf8');
if(sha256(canonical(frozenText))!==stable.catalogSha256)throw new Error('Frozen qB catalog LF-canonical SHA-256 does not match qb-stable-lkg.json.');
const frozen=JSON.parse(frozenText);

async function api(url,options={}){
  const target=url.startsWith('http')?url:`https://api.github.com${url}`;
  const response=await fetch(target,{...options,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',Authorization:`Bearer ${token}`,...(options.headers||{})}});
  if(!response.ok)throw new Error(`GitHub API ${response.status} ${response.statusText}: ${target}`);
  if(response.status===204)return null;
  const type=response.headers.get('content-type')||'';
  return type.includes('json')?response.json():Buffer.from(await response.arrayBuffer());
}
async function listArtifacts({maxPages=1}={}){
  const artifacts=[];
  for(let page=1;page<=maxPages;page++){
    const data=await api(`/repos/${repository}/actions/artifacts?per_page=${ARTIFACT_PAGE_SIZE}&page=${page}`);
    const batch=Array.isArray(data?.artifacts)?data.artifacts:[];
    artifacts.push(...batch.filter(item=>!item.expired));
    if(batch.length<ARTIFACT_PAGE_SIZE)break;
  }
  return artifacts.sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
}
async function downloadArtifact(artifact){
  const response=await fetch(artifact.archive_download_url,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`},redirect:'follow'});
  if(!response.ok)throw new Error(`Artifact ${artifact.id} download failed: ${response.status}`);
  const zip=Buffer.from(await response.arrayBuffer());
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weig-qb-settings-'));
  const zipPath=path.join(dir,'artifact.zip');
  fs.writeFileSync(zipPath,zip);
  const unzip=spawnSync('unzip',['-qo',zipPath,'-d',dir],{stdio:'inherit'});
  if(unzip.status!==0)throw new Error(`Artifact ${artifact.id} unzip failed with ${unzip.status}`);
  return dir;
}
function validateLkg(lkg,label){
  if(lkg?.schemaVersion!==2)throw new Error(`${label}: Settings/source LKG schema is not v2.`);
  if(lkg?.baseCatalogSha256!==stable.catalogSha256)throw new Error(`${label}: base catalog SHA mismatch.`);
  if(Number(lkg?.profileCount)!==stable.profileCount)throw new Error(`${label}: profile count mismatch.`);
  if(lkg?.supportFloor!==stable.supportFloor||lkg?.latestAdmittedStable!==stable.latestAdmittedStable)throw new Error(`${label}: stable range mismatch.`);
  applyQbSettingsTranslationLkg(frozen,lkg,{catalogSha256:stable.catalogSha256});
  const mapped=(lkg.profiles||[]).reduce((sum,item)=>sum+(Number(item.mappedPreferences)||0),0);
  const routes=(lkg.profiles||[]).reduce((sum,item)=>sum+Object.keys(item.translations||{}).length,0);
  const columns=(lkg.profiles||[]).reduce((sum,item)=>sum+(Array.isArray(item.torrentTableColumns)?item.torrentTableColumns.length:0),0);
  const trackerFilters=(lkg.profiles||[]).reduce((sum,item)=>sum+(Array.isArray(item.trackerFilters)?item.trackerFilters.length:0),0);
  const detailUiBindings=Number(lkg?.detailUiBindings)||0;
  const recoveryRoutes=Number(lkg?.recovery?.routeCount)||0,recoveryLocales=Number(lkg?.recovery?.localeCount)||0;
  if(!mapped||!routes||!Object.keys(lkg.sets||{}).length||!columns||!trackerFilters||Number(lkg?.trackerFilterBindings)!==trackerFilters||!detailUiBindings||!recoveryRoutes||!recoveryLocales)throw new Error(`${label}: Settings/source v2 evidence is incomplete.`);
  return{mapped,routes,sets:Object.keys(lkg.sets||{}).length,columns,trackerFilters,detailUiBindings,recoveryRoutes,recoveryLocales};
}
function saveLkg(lkg,source){
  const stats=validateLkg(lkg,source);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(lkg)+'\n','utf8');
  console.log(`Resolved certified qB Settings/source v2 evidence from ${source}: ${lkg.profileCount} releases, ${stats.mapped} mappings, ${stats.columns} native columns, ${stats.trackerFilters} Tracker filter bindings, ${stats.detailUiBindings} detail UI bindings, ${stats.routes} narrow locale routes, ${stats.sets} translation sets, ${stats.recoveryRoutes} recovery routes / ${stats.recoveryLocales} locales -> ${output}`);
  return true;
}
function compatibleArtifactCandidates(artifacts,prefix){
  const named=artifacts.filter(item=>String(item.name).startsWith(prefix)&&!incompatibleArtifactIds.has(item.id));
  if(!sourceSha)return named;
  const exactName=prefix+sourceSha,exact=named.filter(item=>String(item.name)===exactName),equivalent=[];
  for(const artifact of named){
    if(String(artifact.name)===exactName)continue;
    const artifactSha=artifactSourceSha(artifact.name,prefix);
    if(!artifactSha)continue;
    const compatibility=localSettingsEvidenceCompatibility({ancestorSha:artifactSha,currentSha:sourceSha,cwd:projectRoot});
    if(compatibility.compatible){
      console.log(`Settings/source evidence reuse admitted: ${artifactSha} -> ${sourceSha} (${compatibility.reason}).`);
      equivalent.push(artifact);
    }else if(compatibility.reason==='settings-source-changed'){
      console.log(`Settings/source evidence reuse rejected: ${artifactSha} -> ${sourceSha}; changed owner(s): ${compatibility.changedPaths.join(', ')}`);
    }
  }
  return[...exact,...equivalent];
}
async function tryCertifiedArtifact(artifacts){
  for(const artifact of compatibleArtifactCandidates(artifacts,'qb-settings-translation-lkg-')){
    try{
      const dir=await downloadArtifact(artifact);
      const file=path.join(dir,'qb-settings-translation-lkg.json');
      if(!fs.existsSync(file)){incompatibleArtifactIds.add(artifact.id);continue;}
      const lkg=JSON.parse(fs.readFileSync(file,'utf8'));
      if(saveLkg(lkg,`artifact ${artifact.id}/${artifact.name}`))return artifact;
    }catch(error){
      incompatibleArtifactIds.add(artifact.id);
      console.warn(`Skipping incompatible Settings/source LKG artifact ${artifact.id}: ${error.message}`);
    }
  }
  return null;
}
async function tryBootstrapCatalog(artifacts){
  for(const artifact of compatibleArtifactCandidates(artifacts,'qb-release-catalog-')){
    try{
      const dir=await downloadArtifact(artifact);
      const file=path.join(dir,'qb-releases.json'),recoveryFile=path.join(dir,'qb-releases.recovery.json');
      if(!fs.existsSync(file)||!fs.existsSync(recoveryFile)){incompatibleArtifactIds.add(artifact.id);continue;}
      const enriched=JSON.parse(fs.readFileSync(file,'utf8'));
      const recoveryEvidence=JSON.parse(fs.readFileSync(recoveryFile,'utf8'));
      const lkg=buildQbSettingsTranslationLkg(enriched,frozen,{
        baseCatalogSha256:stable.catalogSha256,
        sourceEvidence:{bootstrapArtifactId:artifact.id,bootstrapArtifactName:artifact.name,bootstrapCreatedAt:artifact.created_at},
        recoveryEvidence
      });
      saveLkg(lkg,`source-enriched bootstrap artifact ${artifact.id}/${artifact.name}`);
      return artifact;
    }catch(error){
      incompatibleArtifactIds.add(artifact.id);
      console.warn(`Skipping incompatible source catalog artifact ${artifact.id}: ${error.message}`);
    }
  }
  return null;
}
console.log(`Scanning up to ${ARTIFACT_MAX_PAGES*ARTIFACT_PAGE_SIZE} recent artifacts for ${sourceSha?`exact or Settings-source-equivalent ${sourceSha} `:''}qB Settings/source v2 evidence.`);
const artifacts=await listArtifacts({maxPages:ARTIFACT_MAX_PAGES});
if(await tryCertifiedArtifact(artifacts))process.exit(0);
if(!certifiedOnly&&await tryBootstrapCatalog(artifacts))process.exit(0);
const identity=sourceSha?` for exact or Settings-source-equivalent source SHA ${sourceSha}`:'';
throw new Error(`No compatible certified Settings/source v2 LKG${certifiedOnly?'': ' or source-enriched bootstrap artifact'} is available${identity}. Evidence must be prepared before this resolver runs.`);

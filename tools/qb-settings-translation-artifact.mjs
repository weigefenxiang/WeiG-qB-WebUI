#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {applyQbSettingsTranslationLkg,buildQbSettingsTranslationLkg} from './qb-settings-translation-lkg.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'..');
function arg(name,fallback=''){const prefix=`--${name}=`;const hit=process.argv.find(value=>value.startsWith(prefix));return hit?hit.slice(prefix.length):fallback;}
function required(name){const value=arg(name);if(!value)throw new Error(`Missing --${name}=...`);return value;}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function canonical(text){return Buffer.from(text.replace(/\r\n?/g,'\n'),'utf8');}
function sha256(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}

const repository=arg('repo',process.env.GITHUB_REPOSITORY||'');
const branch=arg('branch',process.env.GITHUB_REF_NAME||'dev');
const output=path.resolve(required('out'));
const dispatchIfMissing=process.argv.includes('--dispatch-if-missing');
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN||'';
if(!repository||!token)throw new Error('qB Settings translation artifact resolver requires repository identity and GH_TOKEN.');

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
async function listArtifacts(){
  const data=await api(`/repos/${repository}/actions/artifacts?per_page=100`);
  return (data.artifacts||[]).filter(item=>!item.expired).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
}
async function downloadArtifact(artifact){
  const response=await fetch(artifact.archive_download_url,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`},redirect:'follow'});
  if(!response.ok)throw new Error(`Artifact ${artifact.id} download failed: ${response.status}`);
  const zip=Buffer.from(await response.arrayBuffer());
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-qb-settings-'));
  const zipPath=path.join(dir,'artifact.zip');
  fs.writeFileSync(zipPath,zip);
  const unzip=spawnSync('unzip',['-qo',zipPath,'-d',dir],{stdio:'inherit'});
  if(unzip.status!==0)throw new Error(`Artifact ${artifact.id} unzip failed with ${unzip.status}`);
  return dir;
}
function validateLkg(lkg,label){
  if(lkg?.baseCatalogSha256!==stable.catalogSha256)throw new Error(`${label}: base catalog SHA mismatch.`);
  if(Number(lkg?.profileCount)!==stable.profileCount)throw new Error(`${label}: profile count mismatch.`);
  if(lkg?.supportFloor!==stable.supportFloor||lkg?.latestAdmittedStable!==stable.latestAdmittedStable)throw new Error(`${label}: stable range mismatch.`);
  applyQbSettingsTranslationLkg(frozen,lkg,{catalogSha256:stable.catalogSha256});
  const mapped=(lkg.profiles||[]).reduce((sum,item)=>sum+(Number(item.mappedPreferences)||0),0);
  const routes=(lkg.profiles||[]).reduce((sum,item)=>sum+Object.keys(item.translations||{}).length,0);
  if(!mapped||!routes||!Object.keys(lkg.sets||{}).length)throw new Error(`${label}: Settings translation evidence is empty.`);
  return{mapped,routes,sets:Object.keys(lkg.sets||{}).length};
}
function saveLkg(lkg,source){
  const stats=validateLkg(lkg,source);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(lkg)+'\n','utf8');
  console.log(`Resolved certified qB Settings translation evidence from ${source}: ${lkg.profileCount} releases, ${stats.mapped} mappings, ${stats.routes} locale routes, ${stats.sets} translation sets -> ${output}`);
  return true;
}
async function tryCertifiedArtifact(artifacts){
  for(const artifact of artifacts.filter(item=>String(item.name).startsWith('qb-settings-translation-lkg-'))){
    try{
      const dir=await downloadArtifact(artifact);
      const file=path.join(dir,'qb-settings-translation-lkg.json');
      if(!fs.existsSync(file))continue;
      const lkg=JSON.parse(fs.readFileSync(file,'utf8'));
      if(saveLkg(lkg,`artifact ${artifact.id}/${artifact.name}`))return artifact;
    }catch(error){console.warn(`Skipping incompatible Settings LKG artifact ${artifact.id}: ${error.message}`);}
  }
  return null;
}
async function tryBootstrapCatalog(artifacts){
  for(const artifact of artifacts.filter(item=>String(item.name).startsWith('qb-release-catalog-'))){
    try{
      const dir=await downloadArtifact(artifact);
      const file=path.join(dir,'qb-releases.json');
      if(!fs.existsSync(file))continue;
      const enriched=JSON.parse(fs.readFileSync(file,'utf8'));
      const lkg=buildQbSettingsTranslationLkg(enriched,frozen,{
        baseCatalogSha256:stable.catalogSha256,
        sourceEvidence:{bootstrapArtifactId:artifact.id,bootstrapArtifactName:artifact.name,bootstrapCreatedAt:artifact.created_at}
      });
      saveLkg(lkg,`source-enriched bootstrap artifact ${artifact.id}/${artifact.name}`);
      return artifact;
    }catch(error){console.warn(`Skipping incompatible source catalog artifact ${artifact.id}: ${error.message}`);}
  }
  return null;
}
async function dispatchCandidate(){
  await api(`/repos/${repository}/actions/workflows/ci.yml/dispatches`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:branch,inputs:{validation_mode:'candidate'}})});
  console.log(`Dispatched CI candidate on ${branch} to refresh certified qB Settings translation evidence.`);
}

let artifacts=await listArtifacts();
if(await tryCertifiedArtifact(artifacts))process.exit(0);
const bootstrap=await tryBootstrapCatalog(artifacts);
if(bootstrap){
  if(dispatchIfMissing)await dispatchCandidate();
  process.exit(0);
}
if(!dispatchIfMissing)throw new Error('No compatible certified Settings LKG or source-enriched bootstrap artifact is available.');
await dispatchCandidate();
for(let attempt=1;attempt<=70;attempt++){
  await sleep(30000);
  artifacts=await listArtifacts();
  const resolved=await tryCertifiedArtifact(artifacts);
  if(resolved)process.exit(0);
  console.log(`Waiting for certified qB Settings translation LKG artifact (${attempt}/70)...`);
}
throw new Error('Timed out waiting for a compatible certified qB Settings translation LKG artifact.');

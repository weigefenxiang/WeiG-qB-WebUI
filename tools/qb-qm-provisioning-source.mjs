#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveQbTranslationResourcePath} from './qb-settings-translation-overlay.mjs';

function normalizeLocale(value){return String(value||'').trim().replace(/-/g,'_');}
function localeValues(profile){return [...new Set((profile?.webuiLocales||[]).map(item=>typeof item==='string'?item:item?.value).map(normalizeLocale).filter(Boolean))];}
function exactBehavior(behaviorEvidence,profile){
  const hit=(behaviorEvidence?.profiles||[]).find(item=>String(item?.qbVersion||'')===String(profile?.qbVersion||''));
  if(!hit||String(hit.sourceSha||'')!==String(profile?.sourceSha||''))return null;
  const family=behaviorEvidence?.families?.[hit.family];
  return family?{family:hit.family,...family}:null;
}
function isPlainEnglish(locale){return normalizeLocale(locale).toLowerCase()==='en';}

export function buildQmProvisioningPlan(catalog,behaviorEvidence,readReleaseSources){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('qB QM provisioning requires a non-empty exact-release catalog.');
  if(!behaviorEvidence||behaviorEvidence.schemaVersion!==1)throw new Error('qB QM provisioning requires translator behavior evidence schemaVersion 1.');
  if(typeof readReleaseSources!=='function')throw new Error('qB QM provisioning requires an exact-release source loader.');
  const profiles=[];
  for(const profile of catalog){
    const qbVersion=String(profile?.qbVersion||'').trim();
    const sourceSha=String(profile?.sourceSha||'').trim();
    const tag=String(profile?.tag||`release-${qbVersion}`).trim();
    if(!qbVersion||!sourceSha)throw new Error('Each QM provisioning profile must bind qbVersion + sourceSha.');
    const behavior=exactBehavior(behaviorEvidence,profile);
    if(!behavior)throw new Error(`${qbVersion}: translator behavior evidence does not match exact source SHA ${sourceSha}.`);
    const locales=localeValues(profile);
    if(!locales.length)throw new Error(`${qbVersion}: WebUI locales are unresolved.`);
    if(behavior.family==='qapp-native'){
      profiles.push({qbVersion,sourceSha,family:behavior.family,strategy:'application-translator',resources:[]});
      continue;
    }
    if(behavior.altWebuiTranslation!==true){
      profiles.push({qbVersion,sourceSha,family:behavior.family,strategy:'compatibility-bridge-required',resources:[]});
      continue;
    }
    if(behavior.translatorResource!=='active-webui-root/translations/webui_<locale>.qm'){
      throw new Error(`${qbVersion}: unsupported dedicated translator resource ${behavior.translatorResource}.`);
    }
    const release=readReleaseSources({profile,qbVersion,sourceSha,tag})||{};
    const paths=Array.isArray(release.paths)?release.paths:[];
    const readSource=typeof release.readSource==='function'?release.readSource:()=>'';
    const resources=[];
    for(const locale of locales){
      if(isPlainEnglish(locale))continue;
      const sourceTs=resolveQbTranslationResourcePath(locale,paths,readSource);
      if(!sourceTs)throw new Error(`${qbVersion}: no exact official qB translation source can provision ${locale}.`);
      const targetPath=`translations/webui_${locale}.qm`;
      resources.push({locale,sourceTs,targetPath,lreleaseArgs:[sourceTs,'-qm',targetPath]});
    }
    profiles.push({
      qbVersion,sourceSha,family:behavior.family,
      strategy:behavior.missingTranslationFallback==='none-explicit'?'active-root-qm-strict':'active-root-qm',
      translatorResource:behavior.translatorResource,
      resources
    });
  }
  return{
    schemaVersion:1,
    source:'qB-upstream-translator-behavior+official-translation-sources',
    profileCount:profiles.length,
    supportFloor:profiles[0].qbVersion,
    latestAdmittedStable:profiles.at(-1).qbVersion,
    profiles
  };
}

function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function showMaybe(root,ref,file){try{return git(root,'show',`${ref}:${file}`);}catch{return'';}}
function translationPaths(root,ref){
  try{return git(root,'ls-tree','-r','--name-only',ref,'src/webui/www/translations','src/lang').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);}
  catch{return[];}
}
export function buildQmProvisioningPlanFromClone(catalog,behaviorEvidence,qbRoot){
  return buildQmProvisioningPlan(catalog,behaviorEvidence,({qbVersion,sourceSha,tag})=>{
    const resolved=git(qbRoot,'rev-list','-n','1',tag);
    if(resolved!==sourceSha)throw new Error(`${qbVersion}: tag/source SHA mismatch ${resolved} != ${sourceSha}`);
    const paths=translationPaths(qbRoot,sourceSha);
    const cache=new Map();
    return{paths,readSource:(resourcePath)=>{if(!cache.has(resourcePath))cache.set(resourcePath,showMaybe(qbRoot,sourceSha,resourcePath));return cache.get(resourcePath);}};
  });
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
    const catalogPath=path.resolve(process.argv[3]||'tests/fixtures/qb-release-catalog.lkg.json');
    const behaviorPath=path.resolve(process.argv[4]||'tools/data/qb-translator-behavior-lkg.json');
    const outputPath=path.resolve(process.argv[5]||'qb-qm-provisioning-plan.json');
    if(!qbRoot||!fs.existsSync(qbRoot))throw new Error('Usage: node tools/qb-qm-provisioning-source.mjs <qBittorrent-clone> [catalog.json] [behavior.json] [output.json]');
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
    const behavior=JSON.parse(fs.readFileSync(behaviorPath,'utf8'));
    const plan=buildQmProvisioningPlanFromClone(catalog,behavior,qbRoot);
    fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(plan,null,2)+'\n','utf8');
    const counts=Object.fromEntries([...new Set(plan.profiles.map(x=>x.strategy))].map(strategy=>[strategy,plan.profiles.filter(x=>x.strategy===strategy).length]));
    console.log(`Built QM provisioning plan for ${plan.profileCount} stable releases: ${JSON.stringify(counts)}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

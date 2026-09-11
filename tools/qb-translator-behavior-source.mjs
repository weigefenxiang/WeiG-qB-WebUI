#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {compareQbVersions} from './qb-release-tags.mjs';

const WEBAPPLICATION_PATH='src/webui/webapplication.cpp';

function git(qbRoot,...args){
  return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}

function isTranslatableExpression(source=''){
  const match=String(source).match(/const\s+bool\s+isTranslatable\s*(?:=|\{)\s*([^\n;]+)/);
  return match?match[1].trim():'';
}

export function extractTranslatorBehaviorFacts(source=''){
  const text=String(source||'');
  const qbtTrParserExists=text.includes('QBT_TR');
  const translationCall=text.includes('qApp->translate(')
    ? 'qApp->translate'
    : text.includes('m_translator.translate(')
      ? 'm_translator.translate'
      : 'unresolved';

  const translatableExpr=isTranslatableExpression(text);
  const translationMimeRule=/mimeType\.inherits\([^;\n]*text\/plain/.test(translatableExpr)
    ? 'inherits:text/plain'
    : 'unresolved';

  let altWebuiTranslation=null;
  if(translationMimeRule!=='unresolved'){
    altWebuiTranslation=!/!\s*m_isAltUIUsed\b/.test(translatableExpr);
  }

  let translatorResource='unresolved';
  if(translationCall==='qApp->translate'){
    translatorResource='application-installed-translator';
  }else if(translationCall==='m_translator.translate'){
    const loadIndex=text.indexOf('m_translator.load(');
    const loadWindow=loadIndex>=0?text.slice(loadIndex,loadIndex+480):'';
    if(/\bm_rootFolder\b/.test(loadWindow)&&/translations\/webui_/.test(loadWindow)){
      translatorResource='active-webui-root/translations/webui_<locale>.qm';
    }
  }

  let missingTranslationFallback='unresolved';
  if(translationCall==='qApp->translate'){
    missingTranslationFallback='qt-application-translator';
  }else if(translationCall==='m_translator.translate'){
    if(/loadedText\.isEmpty\(\)\s*\?\s*sourceText\s*:\s*loadedText/.test(text)){
      missingTranslationFallback='explicit-source';
    }else{
      missingTranslationFallback='none-explicit';
    }
  }

  return{
    qbtTrParserExists,
    translationCall,
    translatorResource,
    altWebuiTranslation,
    missingTranslationFallback,
    translationMimeRule
  };
}

export function translatorBehaviorFamily(facts={}){
  if(facts.translationCall==='qApp->translate'&&facts.altWebuiTranslation===true){
    return'qapp-native';
  }
  if(facts.translationCall==='m_translator.translate'&&facts.altWebuiTranslation===false){
    return'dedicated-alt-disabled';
  }
  if(facts.translationCall==='m_translator.translate'
      &&facts.altWebuiTranslation===true
      &&facts.missingTranslationFallback==='none-explicit'){
    return'dedicated-native-no-explicit-fallback';
  }
  if(facts.translationCall==='m_translator.translate'
      &&facts.altWebuiTranslation===true
      &&facts.missingTranslationFallback==='explicit-source'){
    return'dedicated-native-explicit-fallback';
  }
  return'unresolved';
}

export function validateTranslatorBehaviorFacts(facts,label='qB source'){
  if(!facts?.qbtTrParserExists)throw new Error(`${label}: QBT_TR parser not found`);
  if(facts.translationCall==='unresolved')throw new Error(`${label}: translation call path unresolved`);
  if(facts.translationMimeRule==='unresolved')throw new Error(`${label}: translateDocument MIME rule unresolved`);
  if(facts.altWebuiTranslation===null)throw new Error(`${label}: Alternative WebUI translation behavior unresolved`);
  if(facts.translationCall==='m_translator.translate'
      &&facts.translatorResource==='unresolved'){
    throw new Error(`${label}: dedicated WebUI translator resource path unresolved`);
  }
  if(facts.missingTranslationFallback==='unresolved'){
    throw new Error(`${label}: missing-translation fallback unresolved`);
  }
  const family=translatorBehaviorFamily(facts);
  if(family==='unresolved')throw new Error(`${label}: translator behavior family unresolved`);
  return family;
}

export function buildTranslatorBehaviorEvidence(catalog,sourceLoader){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('qB release catalog must be a non-empty array.');
  if(typeof sourceLoader!=='function')throw new Error('sourceLoader must be a function.');

  const profiles=catalog.map((profile,index)=>{
    const qbVersion=String(profile?.qbVersion||'').trim();
    const tag=String(profile?.tag||`release-${qbVersion}`).trim();
    const sourceSha=String(profile?.sourceSha||'').trim();
    if(!qbVersion)throw new Error(`profile ${index}: qbVersion is required`);
    if(!/^release-\d+\.\d+\.\d+(?:\.\d+)?$/.test(tag))throw new Error(`${qbVersion}: invalid stable tag ${tag}`);
    if(!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error(`${qbVersion}: exact 40-char sourceSha is required`);

    const source=sourceLoader({qbVersion,tag,sourceSha,profile});
    const facts=extractTranslatorBehaviorFacts(source);
    const family=validateTranslatorBehaviorFacts(facts,`${qbVersion} (${sourceSha})`);
    return{qbVersion,tag,sourceSha,family,...facts};
  });

  for(let i=1;i<profiles.length;i++){
    if(compareQbVersions(profiles[i-1].qbVersion,profiles[i].qbVersion)>=0){
      throw new Error(`qB release catalog must be strictly version-sorted: ${profiles[i-1].qbVersion} -> ${profiles[i].qbVersion}`);
    }
  }

  return{
    schemaVersion:1,
    source:`qB-upstream-${WEBAPPLICATION_PATH}`,
    supportFloor:profiles[0].qbVersion,
    latestAdmittedStable:profiles.at(-1).qbVersion,
    profileCount:profiles.length,
    profiles
  };
}

export function buildTranslatorBehaviorEvidenceFromClone(catalog,qbRoot){
  return buildTranslatorBehaviorEvidence(catalog,({qbVersion,tag,sourceSha})=>{
    const resolvedTagSha=git(qbRoot,'rev-list','-n','1',tag);
    if(resolvedTagSha!==sourceSha){
      throw new Error(`${qbVersion}: tag/source SHA mismatch ${resolvedTagSha} != ${sourceSha}`);
    }
    return git(qbRoot,'show',`${sourceSha}:${WEBAPPLICATION_PATH}`);
  });
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
    const input=path.resolve(process.argv[3]||'tests/fixtures/qb-release-catalog.lkg.json');
    const output=path.resolve(process.argv[4]||'tools/data/qb-translator-behavior-lkg.json');
    if(!qbRoot||!fs.existsSync(qbRoot)){
      throw new Error('Usage: node tools/qb-translator-behavior-source.mjs <qBittorrent-clone> [catalog.json] [output.json]');
    }
    if(!fs.existsSync(input))throw new Error(`qB release catalog not found: ${input}`);
    const catalog=JSON.parse(fs.readFileSync(input,'utf8'));
    const evidence=buildTranslatorBehaviorEvidenceFromClone(catalog,qbRoot);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(evidence,null,2)+'\n','utf8');
    const counts=new Map();
    for(const profile of evidence.profiles)counts.set(profile.family,(counts.get(profile.family)||0)+1);
    console.log(`Extracted qB translator behavior for ${evidence.profileCount} stable releases: ${evidence.supportFloor} -> ${evidence.latestAdmittedStable}; ${[...counts].map(([family,count])=>`${family}=${count}`).join(', ')}.`);
  }catch(error){
    console.error(error?.message||error);
    process.exitCode=1;
  }
}

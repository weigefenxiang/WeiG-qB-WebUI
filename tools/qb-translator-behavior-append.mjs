#!/usr/bin/env node
// Append-only translator semantics. Never re-extract or rewrite certified historical
// behavior merely to admit a newly discovered stable qB release.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertFrozenPrefix} from './qb-stable-admission.mjs';
import {extractTranslatorBehaviorFacts,validateTranslatorBehaviorFacts} from './qb-translator-behavior-source.mjs';

const assert=(ok,message)=>{if(!ok)throw new Error(message);};

export function appendTranslatorBehaviorEvidence(frozen,candidate,lkg,sourceLoader){
  assert(typeof sourceLoader==='function','Official new-version translator source loader is required.');
  const fresh=assertFrozenPrefix(frozen,candidate,'Translator behavior source candidate');
  assert(fresh.length>0,'Translator behavior append requires a newly discovered stable source.');
  assert(lkg?.schemaVersion===1&&Array.isArray(lkg.profiles)&&lkg.profileCount===frozen.length,'Certified translator behavior LKG does not match historical Frozen count.');
  assert(lkg.supportFloor===frozen[0].qbVersion&&lkg.latestAdmittedStable===frozen.at(-1).qbVersion,'Certified translator behavior LKG release boundaries mismatch.');
  for(let i=0;i<frozen.length;i++){
    const profile=frozen[i],saved=lkg.profiles[i];
    assert(saved?.qbVersion===profile.qbVersion&&saved?.sourceSha===profile.sourceSha&&lkg.families?.[saved.family],'Certified translator behavior prefix mismatch at '+i);
  }
  const families=structuredClone(lkg.families),profiles=lkg.profiles.map(item=>structuredClone(item));
  for(const release of fresh){
    const qbVersion=String(release.qbVersion||''),sourceSha=String(release.sourceSha||'');
    assert(/^[0-9a-f]{40}$/.test(sourceSha)&&release.tag==='release-'+qbVersion,'New official stable source identity is invalid: '+qbVersion);
    const source=sourceLoader({qbVersion,sourceSha,tag:release.tag});
    const facts=extractTranslatorBehaviorFacts(source);
    const family=validateTranslatorBehaviorFacts(facts,qbVersion+' ('+sourceSha+')');
    assert(families[family],'New official translator family requires explicit independent source review before admission: '+family);
    assert(JSON.stringify(families[family])===JSON.stringify(facts),'Official source translator facts differ within existing semantic family '+family+': '+qbVersion);
    profiles.push({qbVersion,sourceSha,family});
  }
  return {...lkg,latestAdmittedStable:candidate.at(-1).qbVersion,profileCount:profiles.length,families,profiles};
}

const main=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(main){
  try{
    const root=path.resolve(process.argv[2]||''),frozenPath=path.resolve(process.argv[3]||''),candidatePath=path.resolve(process.argv[4]||''),output=path.resolve(process.argv[5]||''),lkgPath=path.resolve(process.argv[6]||'tools/data/qb-translator-behavior-lkg.json');
    for(const input of [root,frozenPath,candidatePath,lkgPath])assert(fs.existsSync(input),'Translator append source input missing: '+input);
    assert(process.argv[5],'Usage: node tools/qb-translator-behavior-append.mjs <official-qB-clone> <frozen.json> <new-candidate.json> <output.json> [prior-translator-lkg.json]');
    assert(!fs.existsSync(output),'Translator append output must not preexist: '+output);
    const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),old=read(frozenPath),candidate=read(candidatePath),lkg=read(lkgPath);
    const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    const next=appendTranslatorBehaviorEvidence(old,candidate,lkg,({tag,sourceSha})=>{
      const actual=git('rev-parse',tag+'^{commit}');
      assert(actual===sourceSha,'Official tag/commit identity mismatch: '+tag);
      return git('show',sourceSha+':src/webui/webapplication.cpp');
    });
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(next,null,2)+'\n','utf8');
    console.log('Verified and appended '+(next.profileCount-old.length)+' official translator source profiles onto immutable '+old.length+'-profile historical LKG.');
  }catch(e){console.error(e?.stack||e);process.exitCode=1;}
}

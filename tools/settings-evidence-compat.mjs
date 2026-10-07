import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {isSettingsSourcePath} from './change-classifier.mjs';

const SHA_RE=/^[0-9a-f]{40}$/;

export function artifactSourceSha(name,prefix){
  const value=String(name||'');
  const expected=String(prefix||'');
  if(!expected||!value.startsWith(expected))return '';
  const sha=value.slice(expected.length).toLowerCase();
  return SHA_RE.test(sha)?sha:'';
}

export function settingsEvidenceChangedPaths(paths){
  return [...new Set((paths||[]).map(value=>String(value||'').trim().replaceAll('\\','/')).filter(Boolean).filter(isSettingsSourcePath))].sort();
}

function runGit(args,cwd){
  return spawnSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
}

export function localSettingsEvidenceCompatibility({ancestorSha,currentSha,cwd=process.cwd()}={}){
  ancestorSha=String(ancestorSha||'').toLowerCase();
  currentSha=String(currentSha||'').toLowerCase();
  cwd=path.resolve(cwd);
  if(!SHA_RE.test(ancestorSha)||!SHA_RE.test(currentSha))return{compatible:false,reason:'invalid-sha',changedPaths:[]};
  if(ancestorSha===currentSha)return{compatible:true,reason:'exact-sha',changedPaths:[]};

  const ancestor=runGit(['merge-base','--is-ancestor',ancestorSha,currentSha],cwd);
  if(ancestor.status!==0)return{compatible:false,reason:'not-ancestor-or-history-unavailable',changedPaths:[]};

  const diff=spawnSync('git',['-c','core.quotePath=false','diff','--name-only','-z',ancestorSha,currentSha],{cwd,encoding:null,stdio:['ignore','pipe','pipe']});
  if(diff.status!==0)return{compatible:false,reason:'diff-unavailable',changedPaths:[]};
  const changed=Buffer.from(diff.stdout||[]).toString('utf8').split('\0').filter(Boolean);
  const settingsChanges=settingsEvidenceChangedPaths(changed);
  if(settingsChanges.length)return{compatible:false,reason:'settings-source-changed',changedPaths:settingsChanges};
  return{compatible:true,reason:'settings-source-equivalent',changedPaths:[]};
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const FULL=Symbol('full-value');
const clone=value=>value==null?value:structuredClone(value);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);

function compareVersions(a,b){
  const A=String(a||'0').replace(/^v/i,'').split('.').map(value=>Number.parseInt(value,10)||0);
  const B=String(b||'0').replace(/^v/i,'').split('.').map(value=>Number.parseInt(value,10)||0);
  for(let i=0;i<Math.max(A.length,B.length);i++){const delta=(A[i]||0)-(B[i]||0);if(delta)return delta;}
  return 0;
}
function hasLiteralNull(value){
  if(value===null)return true;
  if(Array.isArray(value))return value.some(hasLiteralNull);
  if(plain(value))return Object.values(value).some(hasLiteralNull);
  return false;
}
function mergePatch(previous,next){
  if(isDeepStrictEqual(previous,next))return undefined;
  if(next===null)return FULL;
  if(!plain(previous)||!plain(next))return clone(next);
  const patch={},keys=new Set([...Object.keys(previous),...Object.keys(next)]);
  for(const key of keys){
    if(!own(next,key)){patch[key]=null;continue;}
    if(!own(previous,key)){
      if(hasLiteralNull(next[key]))return FULL;
      patch[key]=clone(next[key]);
      continue;
    }
    const child=mergePatch(previous[key],next[key]);
    if(child===FULL)return FULL;
    if(child!==undefined)patch[key]=child;
  }
  return patch;
}
function applyMerge(target,patch){
  if(!patch||typeof patch!=='object'||Array.isArray(patch))return clone(patch);
  const out=target&&typeof target==='object'&&!Array.isArray(target)?clone(target):{};
  for(const [key,value] of Object.entries(patch)){
    if(value===null)delete out[key];
    else out[key]=applyMerge(out[key],value);
  }
  return out;
}
export function resolveDetailRuntime(runtime,qbVersion){
  const spec=runtime?.sourceFacts?.torrentDetailUi,changes=spec?.changes;
  if(spec?.mode!=='merge'||!Array.isArray(changes))return null;
  let value=null;
  for(const change of changes){
    if(compareVersions(change?.from,qbVersion)>0)break;
    if(own(change,'value'))value=clone(change.value);
    else if(own(change,'patch'))value=applyMerge(value,change.patch);
  }
  return value;
}
export function compileDetailRuntime(catalog){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Detail runtime compiler requires a non-empty exact release catalog.');
  const changes=[];
  let previous,initialized=false,lastVersion='';
  for(const profile of catalog){
    const version=String(profile?.qbVersion||'').trim();
    if(!version)throw new Error('Detail runtime compiler found a release without qbVersion.');
    if(lastVersion&&compareVersions(lastVersion,version)>=0)throw new Error(`Detail runtime catalog is not strictly ordered: ${lastVersion} -> ${version}.`);
    lastVersion=version;
    const value=own(profile,'torrentDetailUi')?clone(profile.torrentDetailUi):null;
    if(initialized&&isDeepStrictEqual(previous,value))continue;
    if(!initialized||value===null||previous===null||hasLiteralNull(value)){
      changes.push({from:version,value:clone(value)});
    }else{
      const patch=mergePatch(previous,value);
      if(patch===FULL)changes.push({from:version,value:clone(value)});
      else if(patch!==undefined)changes.push({from:version,patch});
    }
    previous=clone(value);initialized=true;
  }
  const runtime={schemaVersion:1,sourceFacts:{torrentDetailUi:{mode:'merge',changes}}};
  for(const profile of catalog){
    const expected=own(profile,'torrentDetailUi')?profile.torrentDetailUi:null;
    const actual=resolveDetailRuntime(runtime,profile.qbVersion);
    if(!isDeepStrictEqual(actual,expected))throw new Error(`Detail runtime round-trip mismatch for qB ${profile.qbVersion}.`);
  }
  return runtime;
}
export function writeDetailRuntime(catalog,output){
  const runtime=compileDetailRuntime(catalog);
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(runtime)+'\n','utf8');
  return runtime;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const output=path.resolve(process.argv[2]||path.join(root,'webui/private/data/detail-compat.json'));
    const catalogPath=path.resolve(process.argv[3]||path.join(root,'tests/fixtures/qb-release-catalog.lkg.json'));
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
    const runtime=writeDetailRuntime(catalog,output);
    console.log(`Materialized Detail runtime: ${runtime.sourceFacts.torrentDetailUi.changes.length} source change points from ${catalog.length} exact releases.`);
  }catch(error){console.error(error?.stack||error);process.exitCode=1;}
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCapabilityPlan,matrixForMode} from './real-qb-capability-plan.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'..');
const fail=message=>{throw new Error(message);};
const exactStableIdentity=(actual,expected)=>String(actual??'').trim()===expected||String(actual??'').trim()===`v${expected}`;

export function bindRuntimeEvidence(runtime,{root=repoRoot,mode,version,coreMode,searchMode,capabilitySmoke}={}){
  if(!runtime||runtime.phase!=='G-FM'||runtime.module!=='runtime-resolver')fail('G-FM runtime binder requires runtime-resolver evidence.');
  if(!capabilitySmoke||capabilitySmoke.phase!=='G-FM'||capabilitySmoke.module!=='capability-smoke')fail('G-FM runtime binder requires capability-smoke evidence.');
  const plan=buildCapabilityPlan(root);
  const matrix=matrixForMode(plan,mode);
  const assignment=matrix.find(row=>row.qb===version);
  const planned=plan.versions.find(row=>row.qbVersion===version);
  if(!assignment||!planned)fail(`qB ${version||'<missing>'} is not in the Frozen G-FM plan.`);
  if(coreMode!==assignment.coreMode||searchMode!==assignment.searchMode)fail(`G-FM assignment mismatch for qB ${version}: expected core=${assignment.coreMode}, search=${assignment.searchMode}; got core=${coreMode}, search=${searchMode}.`);
  if(String(runtime.expected_qb_version||'').trim()!==version)fail(`Runtime evidence expected qB ${runtime.expected_qb_version||'<missing>'}, binder received ${version}.`);
  if(runtime.frozen_catalog_sha256!==plan.frozen.catalogSha256)fail('Runtime evidence Frozen catalog digest does not match the capability plan.');
  if(String(capabilitySmoke.expected_qb_version||'').trim()!==version)fail('Capability smoke version does not match runtime evidence.');
  if(capabilitySmoke.frozen_catalog_sha256!==plan.frozen.catalogSha256)fail('Capability smoke Frozen catalog digest does not match the capability plan.');
  if(String(capabilitySmoke.weig_sha||'').toLowerCase()!==String(runtime.weig_sha||'').toLowerCase())fail('Capability smoke WeiG SHA does not match runtime evidence.');
  const fingerprintMatch=/^[0-9a-f]{64}$/.test(String(capabilitySmoke.actual_capability_fingerprint||''))&&capabilitySmoke.actual_capability_fingerprint===capabilitySmoke.expected_capability_fingerprint;
  const smokePass=exactStableIdentity(runtime.runtime_version,version)&&runtime.cleanup_result==='PASS'&&capabilitySmoke.status==='PASS'&&exactStableIdentity(capabilitySmoke.runtime_version,version)&&fingerprintMatch;
  return {
    ...runtime,
    schemaVersion:4,
    gfm_mode:mode,
    core_mode:coreMode,
    search_mode:searchMode,
    runtime_smoke_result:smokePass?'PASS':'FAIL',
    expected_capability_fingerprint:capabilitySmoke.expected_capability_fingerprint||null,
    actual_capability_fingerprint:capabilitySmoke.actual_capability_fingerprint||null,
    capability_smoke_status:capabilitySmoke.status||'FAIL',
    expected_capability_families:planned.families,
    expected_capability_fingerprints:planned.fingerprints
  };
}

function args(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const key=argv[i];
    if(!key.startsWith('--'))fail(`Unknown argument: ${key}`);
    const value=argv[++i];
    if(value==null)fail(`Missing value for ${key}`);
    out[key.slice(2)]=value;
  }
  return out;
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const a=args(process.argv.slice(2));
  const file=path.resolve(a.file||'');
  const smokeFile=path.resolve(a['smoke-file']||'');
  if(!a.file||!fs.existsSync(file))fail(`Runtime evidence file is missing: ${a.file||'<missing>'}`);
  if(!a['smoke-file']||!fs.existsSync(smokeFile))fail(`Capability smoke evidence file is missing: ${a['smoke-file']||'<missing>'}`);
  const runtime=JSON.parse(fs.readFileSync(file,'utf8'));
  const capabilitySmoke=JSON.parse(fs.readFileSync(smokeFile,'utf8'));
  const bound=bindRuntimeEvidence(runtime,{mode:a.mode,version:a.version,coreMode:a['core-mode'],searchMode:a['search-mode'],capabilitySmoke});
  const tmp=`${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp,`${JSON.stringify(bound,null,2)}\n`);
  fs.renameSync(tmp,file);
  console.log(`Bound G-FM ${a.mode} runtime evidence for qB ${a.version}: smoke=${bound.runtime_smoke_result}, capability=${String(bound.actual_capability_fingerprint||'').slice(0,12)}, core=${bound.core_mode}, search=${bound.search_mode}`);
}

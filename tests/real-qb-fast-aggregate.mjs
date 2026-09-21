#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCapabilityPlan,matrixForMode} from './real-qb-capability-plan.mjs';
import {aggregateSchemaForMode} from './real-qb-gfm-aggregate-schema.mjs';
import {buildCapabilityWitnessSpec,fingerprintCapabilityWitness} from './real-qb-capability-smoke.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'..');
const norm=v=>String(v??'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const sameNumericVersion=(a,b)=>{const aa=norm(a).split('.'),bb=norm(b).split('.');if(!aa.every(x=>/^\d+$/.test(x))||!bb.every(x=>/^\d+$/.test(x)))return norm(a)===norm(b);const n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++)if(Number(aa[i]||0)!==Number(bb[i]||0))return false;return true;};
const exactStableIdentity=(actual,expected)=>String(actual??'').trim()===expected||String(actual??'').trim()===`v${expected}`;
const canonical=value=>Array.isArray(value)?value.map(canonical):(value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value);
const stableJson=value=>JSON.stringify(canonical(value));
const fail=message=>{throw new Error(message);};

function walk(dir){
  const out=[];
  if(!fs.existsSync(dir))return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...walk(file));
    else if(entry.isFile()&&entry.name.endsWith('.json'))out.push(file);
  }
  return out.sort();
}
function readJson(file){
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}
  catch(error){return {__parse_error:String(error?.message||error),__file:file};}
}
function group(records,key){
  const out=new Map();
  for(const item of records){
    const version=norm(item.data?.[key]);
    if(!out.has(version))out.set(version,[]);
    out.get(version).push(item);
  }
  return out;
}
function semanticIssues(doc,{label,profile,catalogSha,expectedSha}){
  const issues=[];
  if(!doc||typeof doc!=='object')return [`${label} evidence is missing`];
  if(doc.frozen_catalog_sha256!==catalogSha)issues.push(`${label} Frozen catalog digest mismatch`);
  if(expectedSha&&String(doc.weig_sha||'').toLowerCase()!==expectedSha)issues.push(`${label} WeiG SHA mismatch`);
  if(!sameNumericVersion(doc.webapi_version,profile.webApiVersion))issues.push(`${label} WebAPI identity mismatch`);
  if(!doc.summary||Number(doc.summary.FAIL||0)!==0)issues.push(`${label} semantic FAIL count is non-zero or missing`);
  return issues;
}

export function aggregateFast(dir,{root=repoRoot,expectedSha=String(process.env.GITHUB_SHA||process.env.WEIG_GIT_SHA||'').trim().toLowerCase(),write=true}={}){
  if(expectedSha&&!/^[0-9a-f]{40}$/.test(expectedSha))fail('Fast G-FM aggregate requires an exact 40-character WeiG SHA.');
  const plan=buildCapabilityPlan(root);
  const schema=aggregateSchemaForMode(plan,'fast');
  const matrix=matrixForMode(plan,'fast');
  const matrixByVersion=new Map(matrix.map(row=>[row.qb,row]));
  const planByVersion=new Map(plan.versions.map(row=>[row.qbVersion,row]));
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
  const catalog=JSON.parse(fs.readFileSync(path.join(root,manifest.catalogPath),'utf8'));
  const profileByVersion=new Map(catalog.map(profile=>[norm(profile.qbVersion),profile]));
  const docs=walk(dir).map(file=>({file,data:readJson(file)}));
  const runtimeDocs=docs.filter(item=>item.data?.phase==='G-FM'&&item.data?.module==='runtime-resolver');
  const coreDocs=docs.filter(item=>item.data?.phase==='G'&&!item.data?.module);
  const searchDocs=docs.filter(item=>item.data?.phase==='G'&&item.data?.module==='search-lifecycle');
  const runtimeByVersion=group(runtimeDocs,'expected_qb_version');
  const coreByVersion=group(coreDocs,'qb_version');
  const searchByVersion=group(searchDocs,'qb_version');
  const expectedVersions=new Set(plan.versions.map(row=>row.qbVersion));
  const unexpectedRuntime=[...runtimeByVersion.keys()].filter(version=>version&&!expectedVersions.has(version));
  const unexpectedCore=[...coreByVersion.keys()].filter(version=>version&&!expectedVersions.has(version));
  const unexpectedSearch=[...searchByVersion.keys()].filter(version=>version&&!expectedVersions.has(version));
  const missingRuntime=[],duplicateRuntime=[],results=[];
  let realSmokePass=0,exactIdentityPass=0,capabilityWitnessPass=0,fingerprintBindingPass=0,cleanupPass=0,coreFullPass=0,searchFullPass=0;

  for(const version of plan.versions.map(row=>row.qbVersion)){
    const planned=planByVersion.get(version);
    const assignment=matrixByVersion.get(version);
    const profile=profileByVersion.get(version);
    if(!planned||!assignment||!profile)fail(`Fast G-FM planner lost qB ${version}.`);
    const expectedCapabilityFingerprint=fingerprintCapabilityWitness(buildCapabilityWitnessSpec(profile));
    const issues=[];
    const runtimeRecords=runtimeByVersion.get(version)||[];
    let runtime=null;
    let smokePass=false,identityPass=false,capabilityPass=false,cleanup=false,fingerprintPass=false,familyPass=false,shaPass=false,frozenPass=false,modePass=false,assignmentPass=false;
    if(runtimeRecords.length===0){missingRuntime.push(version);issues.push('missing runtime evidence');}
    else if(runtimeRecords.length!==1){duplicateRuntime.push(version);issues.push(`duplicate runtime evidence: ${runtimeRecords.length}`);}
    else{
      runtime=runtimeRecords[0].data;
      smokePass=runtime.runtime_smoke_result==='PASS';
      identityPass=exactStableIdentity(runtime.runtime_version,version);
      cleanup=runtime.cleanup_result==='PASS';
      capabilityPass=runtime.capability_smoke_status==='PASS'&&/^[0-9a-f]{64}$/.test(String(runtime.actual_capability_fingerprint||''))&&runtime.expected_capability_fingerprint===expectedCapabilityFingerprint&&runtime.actual_capability_fingerprint===expectedCapabilityFingerprint;
      fingerprintPass=stableJson(runtime.expected_capability_fingerprints)===stableJson(planned.fingerprints);
      familyPass=stableJson(runtime.expected_capability_families)===stableJson(planned.families);
      shaPass=!expectedSha||String(runtime.weig_sha||'').toLowerCase()===expectedSha;
      frozenPass=runtime.frozen_catalog_sha256===plan.frozen.catalogSha256;
      modePass=runtime.gfm_mode==='fast';
      assignmentPass=runtime.core_mode===assignment.coreMode&&runtime.search_mode===assignment.searchMode;
      if(!smokePass)issues.push(`runtime smoke did not PASS: ${runtime.runtime_smoke_result||'missing'}`);
      if(!identityPass)issues.push(`runtime exact qB identity mismatch: ${runtime.runtime_version||'missing'}`);
      if(!capabilityPass)issues.push('runtime capability witness fingerprint does not match the Frozen expected safe-read surface');
      if(!cleanup)issues.push(`runtime cleanup did not PASS: ${runtime.cleanup_result||'missing'}`);
      if(!fingerprintPass)issues.push('runtime expected capability fingerprints do not match the current Frozen planner');
      if(!familyPass)issues.push('runtime expected capability families do not match the current Frozen planner');
      if(!shaPass)issues.push('runtime evidence WeiG SHA mismatch');
      if(!frozenPass)issues.push('runtime evidence Frozen catalog digest mismatch');
      if(!modePass)issues.push(`runtime evidence mode is ${runtime.gfm_mode||'missing'}, expected fast`);
      if(!assignmentPass)issues.push(`runtime semantic assignment mismatch: expected core=${assignment.coreMode}, search=${assignment.searchMode}`);
    }
    if(identityPass)exactIdentityPass++;
    if(capabilityPass)capabilityWitnessPass++;
    if(cleanup)cleanupPass++;
    if(fingerprintPass&&familyPass)fingerprintBindingPass++;
    if(smokePass&&identityPass&&capabilityPass&&cleanup&&fingerprintPass&&familyPass&&shaPass&&frozenPass&&modePass&&assignmentPass)realSmokePass++;

    const coreRecords=coreByVersion.get(version)||[];
    let coreSemanticPass=assignment.coreMode!=='full';
    if(assignment.coreMode==='full'){
      if(coreRecords.length!==1)issues.push(`expected one core semantic evidence, got ${coreRecords.length}`);
      else{
        const coreIssues=semanticIssues(coreRecords[0].data,{label:'core',profile,catalogSha:plan.frozen.catalogSha256,expectedSha});
        issues.push(...coreIssues);
        coreSemanticPass=coreIssues.length===0;
      }
      if(coreSemanticPass)coreFullPass++;
    }else if(coreRecords.length!==0){
      issues.push(`smoke-only core assignment produced ${coreRecords.length} unexpected core semantic evidence record(s)`);
      coreSemanticPass=false;
    }

    const searchRecords=searchByVersion.get(version)||[];
    let searchSemanticPass=assignment.searchMode!=='full';
    if(assignment.searchMode==='full'){
      if(searchRecords.length!==1)issues.push(`expected one Search semantic evidence, got ${searchRecords.length}`);
      else{
        const searchIssues=semanticIssues(searchRecords[0].data,{label:'search',profile,catalogSha:plan.frozen.catalogSha256,expectedSha});
        issues.push(...searchIssues);
        searchSemanticPass=searchIssues.length===0;
      }
      if(searchSemanticPass)searchFullPass++;
    }else if(searchRecords.length!==0){
      issues.push(`Search-skip assignment produced ${searchRecords.length} unexpected Search semantic evidence record(s)`);
      searchSemanticPass=false;
    }

    results.push({
      qb_version:version,
      status:issues.length===0?'PASS':'FAIL',
      core_mode:assignment.coreMode,
      search_mode:assignment.searchMode,
      runtime_resolver_status:runtime?.status||null,
      runtime_version:runtime?.runtime_version||null,
      expected_runtime_capability_fingerprint:expectedCapabilityFingerprint,
      actual_runtime_capability_fingerprint:runtime?.actual_capability_fingerprint||null,
      expected_families:planned.families,
      expected_fingerprints:planned.fingerprints,
      runtime_smoke_pass:smokePass&&identityPass&&capabilityPass&&cleanup&&fingerprintPass&&familyPass&&shaPass&&frozenPass&&modePass&&assignmentPass,
      exact_identity_pass:identityPass,
      capability_witness_pass:capabilityPass,
      fingerprint_binding_pass:fingerprintPass&&familyPass,
      cleanup_pass:cleanup,
      core_semantic_pass:coreSemanticPass,
      search_semantic_pass:searchSemanticPass,
      issues
    });
  }

  const resultByVersion=new Map(results.map(row=>[row.qb_version,row]));
  const familyResults={};
  let allFamiliesPass=true;
  for(const dimension of schema.familyEvidence.dimensions){
    const expected=schema.familyEvidence.byDimension[dimension];
    const families=expected.families.map(family=>{
      const representatives=family.representatives.map(representative=>{
        const versionResult=resultByVersion.get(representative.qbVersion);
        const pass=dimension==='search'?versionResult?.search_semantic_pass===true:versionResult?.core_semantic_pass===true;
        return {qb_version:representative.qbVersion,status:pass?'PASS':'FAIL',reasons:representative.reasons};
      });
      const status=representatives.every(row=>row.status==='PASS')?'PASS':'FAIL';
      if(status!=='PASS')allFamiliesPass=false;
      return {family_id:family.familyId,fingerprint:family.fingerprint,status,coveredVersions:family.coveredVersions,representatives};
    });
    familyResults[dimension]={
      expected:expected.expectedFamilyCount,
      PASS:families.filter(row=>row.status==='PASS').length,
      FAIL:families.filter(row=>row.status!=='PASS').length,
      expectedRepresentatives:expected.expectedRepresentativeCount,
      results:families
    };
  }

  const pass=results.filter(row=>row.status==='PASS').length;
  const failCount=results.length-pass;
  const status=pass===plan.frozen.profileCount&&failCount===0&&realSmokePass===plan.frozen.profileCount&&capabilityWitnessPass===plan.frozen.profileCount&&coreFullPass===plan.summary.fast.coreFullCount&&searchFullPass===plan.summary.fast.searchFullCount&&allFamiliesPass&&missingRuntime.length===0&&duplicateRuntime.length===0&&unexpectedRuntime.length===0&&unexpectedCore.length===0&&unexpectedSearch.length===0?'PASS':'FAIL';
  const out={
    schemaVersion:2,
    phase:'G-FM',
    module:'aggregate',
    mode:'fast',
    evidenceClass:'gfm-fast',
    status,
    weig_sha:expectedSha||null,
    webui_version:fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),
    frozen_catalog_sha256:plan.frozen.catalogSha256,
    versions:{
      expected:plan.frozen.profileCount,
      executedRuntimeEvidence:runtimeDocs.length,
      realSmokePass,
      exactIdentityPass,
      capabilityWitnessPass,
      fingerprintBindingPass,
      cleanupPass,
      PASS:pass,
      FAIL:failCount,
      missing:missingRuntime,
      duplicates:duplicateRuntime
    },
    semantics:{
      core:{expected:plan.summary.fast.coreFullCount,PASS:coreFullPass},
      search:{expected:plan.summary.fast.searchFullCount,PASS:searchFullPass}
    },
    families:familyResults,
    unexpected_runtime_versions:unexpectedRuntime,
    unexpected_core_versions:unexpectedCore,
    unexpected_search_versions:unexpectedSearch,
    results
  };
  if(write){
    const outDir=path.join(root,'artifacts/real-qb-fast-aggregate');
    fs.mkdirSync(outDir,{recursive:true});
    const outFile=path.join(outDir,`${expectedSha||'unknown'}.json`);
    fs.writeFileSync(outFile,`${JSON.stringify(out,null,2)}\n`);
    console.log(`Fast G-FM aggregate evidence: ${path.relative(root,outFile)}`);
  }
  return out;
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
  const args=process.argv.slice(2);
  if(args[0]!=='--aggregate')fail('Usage: real-qb-fast-aggregate.mjs --aggregate <evidence-dir>');
  const out=aggregateFast(path.resolve(args[1]||path.join(repoRoot,'fast-evidence')));
  console.log(JSON.stringify({status:out.status,versions:out.versions,semantics:out.semantics,families:Object.fromEntries(Object.entries(out.families).map(([dimension,row])=>[dimension,`${row.PASS}/${row.expected}`]))}));
  if(out.status!=='PASS')process.exitCode=1;
}

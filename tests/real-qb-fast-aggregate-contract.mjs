#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCapabilityPlan,matrixForMode} from './real-qb-capability-plan.mjs';
import {aggregateFast} from './real-qb-fast-aggregate.mjs';
import {bindRuntimeEvidence} from './real-qb-gfm-bind-runtime.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const plan=buildCapabilityPlan(root);
const matrix=matrixForMode(plan,'fast');
const matrixByVersion=new Map(matrix.map(row=>[row.qb,row]));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,manifest.catalogPath),'utf8'));
const profileByVersion=new Map(catalog.map(profile=>[String(profile.qbVersion),profile]));
const preload=fs.readFileSync(path.join(root,'tests/real-qb-gfm-mode-preload.mjs'),'utf8');
assert.ok(preload.includes("target==='real-qb-harness.mjs'&&coreMode==='smoke'")&&preload.includes('process.exit(0)'),'Fast G-FM preload must skip the expensive core semantic harness only for smoke assignments');
assert.ok(preload.includes("target==='real-qb-search.mjs'&&searchMode==='skip'")&&preload.includes("import './real-qb-torrent-creator.mjs'"),'Fast G-FM preload must skip Search only for skip assignments while preserving the existing Torrent Creator preload');
const sha='a'.repeat(40);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-fast-gfm-'));
const write=(name,data)=>fs.writeFileSync(path.join(temp,name),`${JSON.stringify(data,null,2)}\n`);

try{
  for(const row of plan.versions){
    const version=row.qbVersion;
    const assignment=matrixByVersion.get(version);
    const profile=profileByVersion.get(version);
    assert.ok(assignment&&profile,`synthetic Fast G-FM fixture lost qB ${version}`);
    const rawRuntime={
      schemaVersion:3,
      phase:'G-FM',
      module:'runtime-resolver',
      status:'PASS',
      expected_qb_version:version,
      runtime_version:version,
      weig_sha:sha,
      frozen_catalog_sha256:plan.frozen.catalogSha256,
      cleanup_result:'PASS'
    };
    const runtime=bindRuntimeEvidence(rawRuntime,{root,mode:'fast',version,coreMode:assignment.coreMode,searchMode:assignment.searchMode});
    assert.equal(runtime.schemaVersion,4);
    assert.equal(runtime.runtime_smoke_result,'PASS');
    assert.deepEqual(runtime.expected_capability_families,row.families);
    assert.deepEqual(runtime.expected_capability_fingerprints,row.fingerprints);
    write(`runtime-${version}.json`,runtime);
    if(assignment.coreMode==='full')write(`core-${version}.json`,{
      schemaVersion:1,
      phase:'G',
      qb_version:version,
      webapi_version:profile.webApiVersion,
      weig_sha:sha,
      frozen_catalog_sha256:plan.frozen.catalogSha256,
      summary:{PASS:1,FAIL:0}
    });
    if(assignment.searchMode==='full')write(`search-${version}.json`,{
      schemaVersion:1,
      phase:'G',
      module:'search-lifecycle',
      qb_version:version,
      webapi_version:profile.webApiVersion,
      weig_sha:sha,
      frozen_catalog_sha256:plan.frozen.catalogSha256,
      summary:{PASS:1,FAIL:0}
    });
  }

  const first=plan.versions[0];
  const firstAssignment=matrixByVersion.get(first.qbVersion);
  const firstRuntime=JSON.parse(fs.readFileSync(path.join(temp,`runtime-${first.qbVersion}.json`),'utf8'));
  const wrongCore=firstAssignment.coreMode==='full'?'smoke':'full';
  assert.throws(()=>bindRuntimeEvidence(firstRuntime,{root,mode:'fast',version:first.qbVersion,coreMode:wrongCore,searchMode:firstAssignment.searchMode}),/assignment mismatch/,'runtime binder must fail closed when workflow assignment drifts from the Frozen planner');

  const pass=aggregateFast(temp,{root,expectedSha:sha,write:false});
  assert.equal(pass.schemaVersion,2);
  assert.equal(pass.mode,'fast');
  assert.equal(pass.evidenceClass,'gfm-fast');
  assert.equal(pass.status,'PASS');
  assert.equal(pass.versions.expected,65);
  assert.equal(pass.versions.executedRuntimeEvidence,65);
  assert.equal(pass.versions.realSmokePass,65);
  assert.equal(pass.versions.exactIdentityPass,65);
  assert.equal(pass.versions.fingerprintBindingPass,65);
  assert.equal(pass.versions.cleanupPass,65);
  assert.equal(pass.versions.PASS,65);
  assert.equal(pass.versions.FAIL,0);
  assert.equal(pass.semantics.core.expected,plan.summary.fast.coreFullCount);
  assert.equal(pass.semantics.core.PASS,plan.summary.fast.coreFullCount);
  assert.equal(pass.semantics.search.expected,plan.summary.fast.searchFullCount);
  assert.equal(pass.semantics.search.PASS,plan.summary.fast.searchFullCount);
  for(const dimension of [...plan.fast.coreDimensions,'search']){
    assert.equal(pass.families[dimension].expected,plan.families[dimension].length,`${dimension} family expected count drifted`);
    assert.equal(pass.families[dimension].PASS,plan.families[dimension].length,`${dimension} family Full evidence did not all PASS`);
    assert.equal(pass.families[dimension].FAIL,0,`${dimension} family aggregate contains FAIL`);
  }
  assert.equal(pass.families.locale,undefined,'Fast G-FM must not claim Locale family Full evidence from the separate Locale owner');

  const runtimeFile=path.join(temp,`runtime-${first.qbVersion}.json`);
  const tampered=JSON.parse(fs.readFileSync(runtimeFile,'utf8'));
  tampered.expected_capability_fingerprints.api='0'.repeat(64);
  fs.writeFileSync(runtimeFile,`${JSON.stringify(tampered,null,2)}\n`);
  const failed=aggregateFast(temp,{root,expectedSha:sha,write:false});
  assert.equal(failed.status,'FAIL','Fast G-FM must fail closed when runtime fingerprint binding drifts from the Frozen planner');
  assert.equal(failed.versions.fingerprintBindingPass,64,'exactly the tampered version must lose fingerprint binding PASS');
  assert.equal(failed.versions.PASS,64,'tampered fingerprint binding must make that version fail aggregate evidence');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}

console.log(`Fast G-FM aggregate contract passed: 65/65 runtime smoke, ${plan.summary.fast.coreFullCount} core Full reps, ${plan.summary.fast.searchFullCount} Search Full reps, exact Frozen fingerprint binding, mode preload and runtime binder fail closed.`);

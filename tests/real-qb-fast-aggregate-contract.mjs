#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCapabilityPlan,matrixForMode} from './real-qb-capability-plan.mjs';
import {aggregateFast} from './real-qb-fast-aggregate.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const plan=buildCapabilityPlan(root);
const matrix=matrixForMode(plan,'fast');
const matrixByVersion=new Map(matrix.map(row=>[row.qb,row]));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,manifest.catalogPath),'utf8'));
const profileByVersion=new Map(catalog.map(profile=>[String(profile.qbVersion),profile]));
const sha='a'.repeat(40);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-fast-gfm-'));
const write=(name,data)=>fs.writeFileSync(path.join(temp,name),`${JSON.stringify(data,null,2)}\n`);

try{
  for(const row of plan.versions){
    const version=row.qbVersion;
    const assignment=matrixByVersion.get(version);
    const profile=profileByVersion.get(version);
    assert.ok(assignment&&profile,`synthetic Fast G-FM fixture lost qB ${version}`);
    write(`runtime-${version}.json`,{
      schemaVersion:4,
      phase:'G-FM',
      module:'runtime-resolver',
      status:'PASS',
      runtime_smoke_result:'PASS',
      expected_qb_version:version,
      runtime_version:version,
      weig_sha:sha,
      frozen_catalog_sha256:plan.frozen.catalogSha256,
      cleanup_result:'PASS',
      gfm_mode:'fast',
      core_mode:assignment.coreMode,
      search_mode:assignment.searchMode,
      expected_capability_families:row.families,
      expected_capability_fingerprints:row.fingerprints
    });
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

  const first=plan.versions[0];
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

console.log(`Fast G-FM aggregate contract passed: 65/65 runtime smoke, ${plan.summary.fast.coreFullCount} core Full reps, ${plan.summary.fast.searchFullCount} Search Full reps, exact Frozen fingerprint binding and per-family coverage fail closed.`);

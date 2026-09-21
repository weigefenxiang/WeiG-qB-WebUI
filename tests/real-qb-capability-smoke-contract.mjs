#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SAFE_READ_ACTIONS,buildCapabilityWitnessSpec,runCapabilitySmoke} from './real-qb-capability-smoke.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(root,manifest.catalogPath),'utf8'));
const profile=catalog.find(row=>{
  const spec=buildCapabilityWitnessSpec(row);
  return spec.readablePreferences.length>=3&&spec.safeReadActions.some(action=>action!=='appcontroller.h:preferencesAction');
});
assert.ok(profile,'Capability smoke contract requires one Frozen profile with readable preferences and one non-preferences safe GET.');
const expected=buildCapabilityWitnessSpec(profile);
const sha='c'.repeat(40);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-capability-smoke-'));
const env={
  QB_VERSION:String(profile.qbVersion),
  WEIG_QB_URL:'http://runtime.invalid/',
  WEIG_QB_USER:'contract-user',
  WEIG_QB_PASS:'contract-pass',
  WEIG_GIT_SHA:sha,
  WEIG_REAL_QB_EVIDENCE_DIR:temp
};
const evidenceFile=path.join(temp,`${sha}-${profile.qbVersion}-capability-smoke.json`);
const endpointToAction=new Map(Object.entries(SAFE_READ_ACTIONS).map(([action,endpoint])=>[endpoint,action]));
const failingAction=expected.safeReadActions.find(action=>action!=='appcontroller.h:preferencesAction');

function mockFetch({omitPreference=null,failAction=null}={}){
  const preferences={};
  const values=[false,0,'',null,true];
  for(let i=0;i<expected.readablePreferences.length;i++){
    const key=expected.readablePreferences[i];
    if(key!==omitPreference)preferences[key]=values[i%values.length];
  }
  return async (input,options={})=>{
    const url=input instanceof URL?input:new URL(String(input));
    const endpoint=url.pathname;
    if(endpoint==='/api/v2/auth/login'){
      assert.equal(options.method,'POST');
      return new Response('Ok.',{status:200,headers:{'set-cookie':'SID=contract-session; Path=/; HttpOnly'}});
    }
    if(endpoint==='/api/v2/auth/logout')return new Response('Ok.',{status:200});
    if(endpoint==='/api/v2/app/version')return new Response(String(profile.qbVersion),{status:200});
    if(endpoint==='/api/v2/app/webapiVersion')return new Response(String(profile.webApiVersion),{status:200});
    if(endpoint==='/api/v2/app/preferences')return new Response(JSON.stringify(preferences),{status:200,headers:{'content-type':'application/json'}});
    const action=endpointToAction.get(endpoint);
    if(action){
      if(action===failAction)return new Response('disabled for contract',{status:503});
      return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
    }
    throw new Error(`Unexpected capability-smoke contract endpoint: ${endpoint}`);
  };
}

try{
  const pass=await runCapabilitySmoke({root,env,fetchImpl:mockFetch()});
  assert.equal(pass.status,'PASS');
  assert.equal(pass.runtime_version,String(profile.qbVersion));
  assert.equal(pass.actual_capability_fingerprint,pass.expected_capability_fingerprint);
  assert.deepEqual(pass.actual_witness.readablePreferences,expected.readablePreferences);
  assert.deepEqual(pass.missing_readable_preferences,[]);
  for(const key of expected.readablePreferences.slice(0,3))assert.ok(pass.actual_witness.readablePreferences.includes(key),`Falsy runtime preference ${key} must count as present by property existence, not truthiness.`);

  const missingKey=expected.readablePreferences[0];
  await assert.rejects(runCapabilitySmoke({root,env,fetchImpl:mockFetch({omitPreference:missingKey})}),/fingerprint mismatch/);
  const missingEvidence=JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
  assert.equal(missingEvidence.status,'FAIL');
  assert.ok(missingEvidence.missing_readable_preferences.includes(missingKey));
  assert.notEqual(missingEvidence.actual_capability_fingerprint,missingEvidence.expected_capability_fingerprint);

  await assert.rejects(runCapabilitySmoke({root,env,fetchImpl:mockFetch({failAction:failingAction})}),/fingerprint mismatch/);
  const endpointEvidence=JSON.parse(fs.readFileSync(evidenceFile,'utf8'));
  assert.equal(endpointEvidence.status,'FAIL');
  assert.deepEqual(endpointEvidence.failed_safe_read_actions,[{action:failingAction,status:503}]);
  assert.notEqual(endpointEvidence.actual_capability_fingerprint,endpointEvidence.expected_capability_fingerprint);

  const preload=fs.readFileSync(path.join(root,'tests/real-qb-gfm-mode-preload.mjs'),'utf8');
  assert.ok(preload.includes('catch(error)')&&preload.includes('capability smoke recorded FAIL evidence')&&preload.includes("if(coreMode==='smoke')process.exit(0)"),'G-FM preload must preserve capability FAIL evidence without aborting the certified runner before it can finalize runtime evidence.');
  const binder=fs.readFileSync(path.join(root,'tests/real-qb-gfm-bind-runtime.mjs'),'utf8');
  assert.ok(binder.includes("if(bound.runtime_smoke_result!=='PASS')process.exitCode=1"),'G-FM binder CLI must write bound evidence first and then fail closed when runtime smoke is not PASS.');
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}

console.log(`Real-qB capability smoke contract passed for qB ${profile.qbVersion}: actual witness is runtime-derived, falsy preference values use property existence, drift writes FAIL evidence, and binder/preload preserve diagnostics while failing closed.`);

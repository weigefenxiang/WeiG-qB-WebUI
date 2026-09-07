import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assertFrozenPrefix,stableAdmissionDelta,verifyLkg,renderAdmissionReport,promotedManifest} from '../tools/qb-stable-admission.mjs';

const base=[
  {qbVersion:'4.1.0',tag:'release-4.1.0',stable:true,officialWeiGSupport:true},
  {qbVersion:'5.2.3',tag:'release-5.2.3',stable:true,officialWeiGSupport:true}
];
const future={qbVersion:'6.0.0',webApiVersion:'3.0.0',tag:'release-6.0.0',sourceSha:'abc',stable:true,officialWeiGSupport:true,apiActionChanges:{added:['x:aAction'],removed:['x:bAction']},apiActionParameterChanges:{changed:[]},preferenceChanges:{added:['new_pref'],removed:[]},surfaceChanges:{torrentFilters:{added:['future'],removed:[]}}};
const candidate=[...structuredClone(base),future];

assert.deepEqual(stableAdmissionDelta(base,['release-4.0.5','release-4.1.0','release-5.2.3','release-6.0.0','release-6.1.0beta1']),['release-6.0.0'],'pre-release tags must stay outside official stable admission');
assert.throws(()=>stableAdmissionDelta(base,['release-4.1.0','release-5.2.2','release-5.2.3']),/history changed/,'a retroactive insertion before the LKG boundary must fail closed');
assert.equal(assertFrozenPrefix(base,candidate).length,1,'candidate should append exactly one new stable profile');
const mutated=structuredClone(candidate);mutated[0].qbVersion='4.1.1';assert.throws(()=>assertFrozenPrefix(base,mutated),/mutated frozen/,'old profile mutation must be rejected');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-lkg-')),file=path.join(dir,'catalog.json');fs.writeFileSync(file,JSON.stringify(base));const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
verifyLkg({catalog:base,manifest:{schemaVersion:1,supportFloor:'4.1.0',latestAdmittedStable:'5.2.3',profileCount:2,catalogSha256:hash},catalogPath:file});
const report=renderAdmissionReport(base,candidate);for(const token of ['qB 6.0.0','added actions','removed actions','new_pref'])assert.ok(report.includes(token),`upstream admission report missing ${token}`);
const old={schemaVersion:1,supportFloor:'4.1.0',latestAdmittedStable:'5.2.3',profileCount:2,catalogSha256:'old'},next=promotedManifest(old,base,candidate,{validationCommit:'sha',admittedAt:'date'});assert.equal(next.latestAdmittedStable,'6.0.0');assert.equal(next.profileCount,3);assert.equal(old.latestAdmittedStable,'5.2.3','manifest promotion must not mutate prior LKG state in memory');
fs.rmSync(dir,{recursive:true,force:true});
console.log('Stable admission contract passed: old profiles are immutable, only future official stable tags append, retroactive history drift fails closed, and LKG promotion is prepared only from a validated candidate.');

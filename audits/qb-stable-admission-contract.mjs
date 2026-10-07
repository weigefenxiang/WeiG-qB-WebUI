import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {catalogIdentity,assertCatalogIdentity} from '../tools/qb-catalog-identity.mjs';
import {accountSourceInventory,assertCompleteSourceCensus} from '../tools/qb-source-census.mjs';
import {assertFrozenPrefix,stableAdmissionDelta,admissionProductCatalog,verifyLkg,renderAdmissionReport,promotedManifest} from '../tools/qb-stable-admission.mjs';

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
assert.deepEqual(admissionProductCatalog(base,candidate).map(x=>x.qbVersion),['4.1.0','5.2.3','6.0.0'],'new-stable product admission must test the support floor, previous LKG, and new profiles without replaying every frozen historical profile');
assert.throws(()=>admissionProductCatalog(base,base),/requires at least one new stable/,'focused admission product catalog must not run when discovery found no new stable');

const identityCatalog=[
  {qbVersion:'4.1.0',sourceSha:'1111111111111111111111111111111111111111',stable:true,officialWeiGSupport:true,tag:'release-4.1.0'},
  {qbVersion:'5.2.3',sourceSha:'2222222222222222222222222222222222222222',stable:true,officialWeiGSupport:true,tag:'release-5.2.3'}
];
const identity=catalogIdentity(identityCatalog),sameIdentity=catalogIdentity(structuredClone(identityCatalog));
assert.equal(identity.supportFloor,'4.1.0');assert.equal(identity.latestAdmittedStable,'5.2.3');assert.equal(identity.releaseCount,2);assert.match(identity.releaseSetSha256,/^[0-9a-f]{64}$/);assert.match(identity.sourceCatalogSha256,/^[0-9a-f]{64}$/);assertCatalogIdentity(identity,sameIdentity);
const changedIdentityCatalog=structuredClone(identityCatalog);changedIdentityCatalog[1].sourceSha='3333333333333333333333333333333333333333';const changedIdentity=catalogIdentity(changedIdentityCatalog);assert.notEqual(changedIdentity.releaseSetSha256,identity.releaseSetSha256,'release-set identity must change when an exact source identity changes');assert.notEqual(changedIdentity.sourceCatalogSha256,identity.sourceCatalogSha256,'source-catalog identity must change when catalog facts change');assert.throws(()=>assertCatalogIdentity(identity,changedIdentity),/mismatch/,'mixed catalog identities must fail closed');

const census=accountSourceInventory({inventory:['behavior','downloads','future'],mapped:['behavior','downloads'],excluded:[{key:'future',reason:'synthetic reviewed exclusion'}]});assert.equal(census.complete,true);assert.deepEqual(census.unaccounted,[]);assertCompleteSourceCensus(census);
const missing=accountSourceInventory({inventory:['behavior','downloads','future'],mapped:['behavior','downloads'],excluded:[]});assert.deepEqual(missing.unaccounted,['future']);assert.throws(()=>assertCompleteSourceCensus(missing,'Preferences inventory'),/unaccounted=future/,'new upstream inventory must remain a hard failure until mapped or explicitly reviewed');
assert.throws(()=>accountSourceInventory({inventory:['future'],mapped:[],excluded:[{key:'future'}]}),/explicit review reason/,'explicit exclusions must carry a review reason');
const duplicate=accountSourceInventory({inventory:['behavior','behavior'],mapped:['behavior'],excluded:[]});assert.deepEqual(duplicate.duplicates.inventory,['behavior']);assert.throws(()=>assertCompleteSourceCensus(duplicate),/duplicate inventory=behavior/,'duplicate inventory identities must fail closed');

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'weigg-lkg-')),file=path.join(dir,'catalog.json');fs.writeFileSync(file,JSON.stringify(base));const hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
verifyLkg({catalog:base,manifest:{schemaVersion:1,supportFloor:'4.1.0',latestAdmittedStable:'5.2.3',profileCount:2,catalogSha256:hash},catalogPath:file});
const report=renderAdmissionReport(base,candidate);for(const token of ['qB 6.0.0','added actions','removed actions','new_pref'])assert.ok(report.includes(token),`upstream admission report missing ${token}`);
const old={schemaVersion:1,supportFloor:'4.1.0',latestAdmittedStable:'5.2.3',profileCount:2,catalogSha256:'old'},next=promotedManifest(old,base,candidate,{validationCommit:'sha',admittedAt:'date'});assert.equal(next.latestAdmittedStable,'6.0.0');assert.equal(next.profileCount,3);assert.equal(old.latestAdmittedStable,'5.2.3','manifest promotion must not mutate prior LKG state in memory');
fs.rmSync(dir,{recursive:true,force:true});
console.log('Stable admission contract passed: old profiles are immutable, only future official stable tags append, common catalog identity detects mixed source sets, census accounting requires mapped or explicitly reviewed inventory with no duplicates, and LKG promotion is prepared only from a validated candidate.');

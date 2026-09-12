#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCapabilityPlan,matrixForMode} from './real-qb-capability-plan.mjs';
import {aggregateSchemaForMode} from './real-qb-gfm-aggregate-schema.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const a=buildCapabilityPlan(root);
const b=buildCapabilityPlan(root);
assert.deepEqual(a,b,'capability family planner must be deterministic for the same Frozen inputs');
assert.equal(a.schemaVersion,1);
assert.equal(a.evidenceLevel,'frozen-source-structural');
assert.equal(a.decisionMode,'analysis-only','phase-1 planner must not claim runtime-equivalence authority');
assert.equal(a.versions.length,65,'planner must cover all 65 Frozen stable qB releases');
assert.equal(a.frozen.profileCount,65);
assert.equal(a.versions[0].qbVersion,a.frozen.supportFloor);
assert.equal(a.versions.at(-1).qbVersion,a.frozen.latestAdmittedStable);
assert.deepEqual(a.dimensions,['api','settings','search','auth','locale','altWebui']);

for(const dimension of a.dimensions){
  const families=a.families[dimension];
  assert.ok(Array.isArray(families)&&families.length>0,`${dimension} must produce at least one family`);
  const ids=new Set(),fingerprints=new Set(),covered=[];
  for(const family of families){
    assert.match(family.id,new RegExp(`^${dimension}-[0-9a-f]{12}$`));
    assert.match(family.fingerprint,/^[0-9a-f]{64}$/);
    assert.ok(!ids.has(family.id),`${dimension} family id collision: ${family.id}`);
    assert.ok(!fingerprints.has(family.fingerprint),`${dimension} duplicate fingerprint family`);
    ids.add(family.id);fingerprints.add(family.fingerprint);
    assert.ok(family.members.length>0,`${family.id} must have members`);
    assert.equal(family.head,family.members[0],`${family.id} head must be first Frozen member`);
    assert.equal(family.tail,family.members.at(-1),`${family.id} tail must be last Frozen member`);
    const reps=new Map(family.representatives.map(row=>[row.qbVersion,row.reasons]));
    assert.ok(reps.get(family.head)?.includes('family-head'),`${family.id} must select family head`);
    assert.ok(reps.get(family.tail)?.includes('family-tail'),`${family.id} must select family tail`);
    for(const version of family.members.filter(v=>/^\d+\.\d+\.\d+\.\d+$/.test(v))){
      assert.ok(reps.get(version)?.includes('fourth-component-stable'),`${family.id} must retain ${version} as a fourth-component sentinel`);
    }
    covered.push(...family.members);
  }
  assert.equal(covered.length,65,`${dimension} families must cover exactly 65 memberships`);
  assert.equal(new Set(covered).size,65,`${dimension} families must cover every version exactly once`);
  for(const row of a.versions){
    assert.ok(ids.has(row.families[dimension]),`qB ${row.qbVersion} has unknown ${dimension} family`);
    assert.match(row.fingerprints[dimension],/^[0-9a-f]{64}$/,`qB ${row.qbVersion} lacks ${dimension} fingerprint`);
  }
}

const fast=matrixForMode(a,'fast');
const exhaustive=matrixForMode(a,'exhaustive');
assert.equal(fast.length,65,'fast matrix must retain all 65 exact real runtimes');
assert.equal(exhaustive.length,65,'exhaustive matrix must retain all 65 exact real runtimes');
assert.ok(exhaustive.every(row=>row.coreMode==='full'&&row.searchMode==='full'),'exhaustive matrix must remain full/full for every stable version');
assert.equal(fast.filter(row=>row.coreMode==='full').length,a.summary.fast.coreFullCount);
assert.equal(fast.filter(row=>row.searchMode==='full').length,a.summary.fast.searchFullCount);
assert.equal(fast.filter(row=>row.coreMode==='smoke'&&row.searchMode==='skip').length,a.summary.fast.smokeOnlyCount);
const fastByVersion=new Map(fast.map(row=>[row.qb,row]));
for(const dimension of a.fast.coreDimensions){
  for(const family of a.families[dimension])for(const representative of family.representatives){
    assert.equal(fastByVersion.get(representative.qbVersion)?.coreMode,'full',`${dimension} representative ${representative.qbVersion} must receive full core semantics`);
  }
}
for(const family of a.families.search)for(const representative of family.representatives){
  assert.equal(fastByVersion.get(representative.qbVersion)?.searchMode,'full',`Search representative ${representative.qbVersion} must receive full Search lifecycle`);
}

const planBeforeAggregateSchema=structuredClone(a);
const fastAggregateSchema=aggregateSchemaForMode(a,'fast');
const exhaustiveAggregateSchema=aggregateSchemaForMode(a,'exhaustive');
assert.deepEqual(a,planBeforeAggregateSchema,'aggregate schema derivation must not mutate the capability plan');
assert.equal(fastAggregateSchema.schemaVersion,2);
assert.equal(fastAggregateSchema.phase,'G-FM');
assert.equal(fastAggregateSchema.module,'aggregate');
assert.equal(fastAggregateSchema.mode,'fast');
assert.equal(fastAggregateSchema.evidenceClass,'gfm-fast');
assert.equal(exhaustiveAggregateSchema.mode,'exhaustive');
assert.equal(exhaustiveAggregateSchema.evidenceClass,'gfm-exhaustive');
assert.notEqual(fastAggregateSchema.evidenceClass,exhaustiveAggregateSchema.evidenceClass,'fast evidence must be structurally distinct from exhaustive evidence');
assert.equal(fastAggregateSchema.frozenCatalogSha256,a.frozen.catalogSha256);
assert.equal(exhaustiveAggregateSchema.frozenCatalogSha256,a.frozen.catalogSha256);
assert.equal(fastAggregateSchema.versionEvidence.expectedCount,65);
assert.equal(fastAggregateSchema.versionEvidence.requireRuntimeStatus,'PASS');
assert.equal(fastAggregateSchema.versionEvidence.requireExactQbIdentity,true);
assert.equal(fastAggregateSchema.versionEvidence.requireCleanupResult,'PASS');
assert.equal(fastAggregateSchema.versionEvidence.requireFingerprintMatch,true);
assert.deepEqual(fastAggregateSchema.versionEvidence.fingerprintDimensions,a.dimensions);
assert.equal(fastAggregateSchema.versionEvidence.versions.length,65);
const fastVersionExpectations=new Map(fastAggregateSchema.versionEvidence.versions.map(row=>[row.qbVersion,row]));
for(const row of a.versions){
  const expected=fastVersionExpectations.get(row.qbVersion);
  assert.ok(expected,`fast aggregate schema is missing qB ${row.qbVersion}`);
  assert.deepEqual(expected.expectedFamilies,row.families,`fast aggregate family identity drifted for qB ${row.qbVersion}`);
  assert.deepEqual(expected.expectedFingerprints,row.fingerprints,`fast aggregate fingerprint drifted for qB ${row.qbVersion}`);
}
const fastFamilyDimensions=[...a.fast.coreDimensions,'search'];
assert.deepEqual(fastAggregateSchema.familyEvidence.dimensions,fastFamilyDimensions);
assert.equal(fastAggregateSchema.familyEvidence.byDimension.locale,undefined,'Locale has its own real compatibility matrix and must not be silently claimed as a G-FM family-full semantic owner');
for(const dimension of fastFamilyDimensions){
  const block=fastAggregateSchema.familyEvidence.byDimension[dimension];
  assert.equal(block.evidenceKind,dimension==='search'?'search-semantic-full':'core-semantic-full');
  assert.equal(block.expectedFamilyCount,a.families[dimension].length,`${dimension} fast aggregate family count drifted`);
  assert.equal(block.expectedRepresentativeCount,a.summary[dimension].representativeCount,`${dimension} fast aggregate representative count drifted`);
  assert.equal(block.families.length,a.families[dimension].length);
  const expectedFamilies=new Map(a.families[dimension].map(family=>[family.id,family]));
  for(const family of block.families){
    const planned=expectedFamilies.get(family.familyId);
    assert.ok(planned,`fast aggregate schema references unknown ${dimension} family ${family.familyId}`);
    assert.equal(family.fingerprint,planned.fingerprint);
    assert.deepEqual(family.coveredVersions,planned.members);
    assert.deepEqual(family.representatives.map(row=>row.qbVersion),planned.representatives.map(row=>row.qbVersion));
    assert.ok(family.representatives.every(row=>row.requiredStatus==='PASS'),`${family.familyId} representatives must require PASS full evidence`);
  }
}
assert.equal(exhaustiveAggregateSchema.familyEvidence,null,'exhaustive aggregate must remain per-version full evidence rather than family substitution');
assert.equal(exhaustiveAggregateSchema.versionEvidence.expectedCount,65);
assert.equal(exhaustiveAggregateSchema.versionEvidence.requireCoreSemanticStatus,'PASS');
assert.equal(exhaustiveAggregateSchema.versionEvidence.requireSearchSemanticStatus,'PASS');
assert.equal(exhaustiveAggregateSchema.versionEvidence.versions.length,65);
assert.throws(()=>aggregateSchemaForMode(a,'unknown'),/Unknown G-FM aggregate mode/,'unknown aggregate modes must fail closed');

const localeLkg=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-locale-lkg.json'),'utf8'));
const distinctLocaleSets=new Set(Object.values(localeLkg.localeSets).map(values=>JSON.stringify([...new Set(values.map(String))].sort())));
assert.equal(a.families.locale.length,distinctLocaleSets.size,'locale families must be derived from exact Frozen locale inventories');

const fourPart=a.versions.filter(row=>/^\d+\.\d+\.\d+\.\d+$/.test(row.qbVersion));
assert.ok(fourPart.length>0,'Frozen catalog must retain fourth-component sentinel coverage');
for(const row of fourPart)assert.ok(row.sentinelReasons.includes('fourth-component-stable'));

const workflow=fs.readFileSync(path.join(root,'.github/workflows/real-qb-full.yml'),'utf8');
assert.ok(!workflow.includes('real-qb-capability-plan.mjs'),'schema/planner phase must not silently change G-FM execution/aggregate decisions');

const summaryMessage=`Real-qB capability planner contract passed: ${a.versions.length}/65 versions are deterministically partitioned without changing G-FM decisions; families=${a.dimensions.map(d=>`${d}:${a.summary[d].familyCount}/${a.summary[d].representativeCount} reps`).join(', ')}; fast=core ${a.summary.fast.coreFullCount}/65, Search ${a.summary.fast.searchFullCount}/65, smoke-only ${a.summary.fast.smokeOnlyCount}/65; aggregate schemas=fast/exhaustive isolated.`;
console.log(summaryMessage);
if(process.env.GITHUB_ACTIONS==='true')console.log(`::notice title=Real-qB capability planner::${summaryMessage}`);

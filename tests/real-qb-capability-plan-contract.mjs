#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCapabilityPlan} from './real-qb-capability-plan.mjs';

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

const localeLkg=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-locale-lkg.json'),'utf8'));
const distinctLocaleSets=new Set(Object.values(localeLkg.localeSets).map(values=>JSON.stringify([...new Set(values.map(String))].sort())));
assert.equal(a.families.locale.length,distinctLocaleSets.size,'locale families must be derived from exact Frozen locale inventories');

const fourPart=a.versions.filter(row=>/^\d+\.\d+\.\d+\.\d+$/.test(row.qbVersion));
assert.ok(fourPart.length>0,'Frozen catalog must retain fourth-component sentinel coverage');
for(const row of fourPart)assert.ok(row.sentinelReasons.includes('fourth-component-stable'));

const workflow=fs.readFileSync(path.join(root,'.github/workflows/real-qb-full.yml'),'utf8');
assert.ok(!workflow.includes('real-qb-capability-plan.mjs'),'phase-1 read-only planner must not silently change G-FM execution/aggregate decisions');

console.log(`Real-qB capability planner contract passed: ${a.versions.length}/65 versions are deterministically partitioned without changing G-FM decisions; families=${a.dimensions.map(d=>`${d}:${a.summary[d].familyCount}/${a.summary[d].representativeCount} reps`).join(', ')}.`);

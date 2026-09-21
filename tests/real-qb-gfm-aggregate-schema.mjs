#!/usr/bin/env node

const fail=message=>{throw new Error(message);};
const clone=value=>structuredClone(value);

function assertPlanner(plan){
  if(!plan||plan.schemaVersion!==1||plan.evidenceLevel!=='frozen-source-structural')fail('G-FM aggregate schema requires the certified capability planner output.');
  if(!Array.isArray(plan.versions)||plan.versions.length!==plan.frozen?.profileCount)fail('Capability planner version coverage is incomplete.');
  if(!Array.isArray(plan.dimensions)||!plan.dimensions.length)fail('Capability planner dimensions are missing.');
  if(!plan.fast||!Array.isArray(plan.fast.coreDimensions))fail('Capability planner fast-mode ownership is missing.');
  for(const dimension of plan.dimensions){
    if(!Array.isArray(plan.families?.[dimension])||!plan.families[dimension].length)fail(`Capability planner has no ${dimension} families.`);
  }
}

function versionExpectation(plan,row,{fingerprints}){
  const out={qbVersion:row.qbVersion};
  if(fingerprints){
    out.expectedFamilies=clone(row.families);
    out.expectedFingerprints=clone(row.fingerprints);
  }
  return out;
}

function familyBlock(plan,dimension){
  const families=plan.families[dimension];
  const representatives=new Set(families.flatMap(family=>family.representatives.map(row=>row.qbVersion)));
  return {
    evidenceKind:dimension==='search'?'search-semantic-full':'core-semantic-full',
    expectedFamilyCount:families.length,
    expectedRepresentativeCount:representatives.size,
    families:families.map(family=>({
      familyId:family.id,
      fingerprint:family.fingerprint,
      coveredVersions:[...family.members],
      representatives:family.representatives.map(row=>({
        qbVersion:row.qbVersion,
        reasons:[...row.reasons],
        requiredStatus:'PASS'
      }))
    }))
  };
}

export function aggregateSchemaForMode(plan,mode){
  assertPlanner(plan);
  const common={
    schemaVersion:2,
    phase:'G-FM',
    module:'aggregate',
    mode,
    frozenCatalogSha256:plan.frozen.catalogSha256
  };
  if(mode==='fast'){
    const familyDimensions=[...plan.fast.coreDimensions,'search'];
    if(new Set(familyDimensions).size!==familyDimensions.length)fail('Fast G-FM aggregate family dimensions must be unique.');
    for(const dimension of familyDimensions)if(!plan.dimensions.includes(dimension))fail(`Fast G-FM references unknown capability dimension ${dimension}.`);
    return {
      ...common,
      evidenceClass:'gfm-fast',
      versionEvidence:{
        expectedCount:plan.frozen.profileCount,
        requireRuntimeSmokeResult:'PASS',
        requireExactQbIdentity:true,
        requireCleanupResult:'PASS',
        requireRuntimeCapabilityWitnessFingerprint:true,
        requireFingerprintMatch:true,
        fingerprintDimensions:[...plan.dimensions],
        versions:plan.versions.map(row=>versionExpectation(plan,row,{fingerprints:true}))
      },
      familyEvidence:{
        dimensions:familyDimensions,
        byDimension:Object.fromEntries(familyDimensions.map(dimension=>[dimension,familyBlock(plan,dimension)]))
      }
    };
  }
  if(mode==='exhaustive'){
    return {
      ...common,
      evidenceClass:'gfm-exhaustive',
      versionEvidence:{
        expectedCount:plan.frozen.profileCount,
        requireRuntimeStatus:'PASS',
        requireExactQbIdentity:true,
        requireCleanupResult:'PASS',
        requireCoreSemanticStatus:'PASS',
        requireSearchSemanticStatus:'PASS',
        versions:plan.versions.map(row=>versionExpectation(plan,row,{fingerprints:false}))
      },
      familyEvidence:null
    };
  }
  fail(`Unknown G-FM aggregate mode: ${mode}`);
}

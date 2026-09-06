import assert from 'node:assert/strict';
import {resolveEndpointContract} from '../simulator/protocol/endpoint-contracts.js';

const profile=webApiVersion=>({webApiVersion});

{
  const before=resolveEndpointContract(profile('2.11.8'),'torrents/addTrackers');
  const after=resolveEndpointContract(profile('2.11.9'),'torrents/addTrackers');
  assert.equal(before.hashSelection,'single');
  assert.equal(before.allSelector,false);
  assert.equal(after.hashSelection,'multi-or-all');
  assert.equal(after.allSelector,true);
  assert.equal(after.pipeSeparatedHashes,true);
  assert.equal(after.ignoreMissingBatchMembers,true);
}

{
  const before=resolveEndpointContract(profile('2.11.8'),'torrents/removeTrackers');
  const after=resolveEndpointContract(profile('2.11.9'),'torrents/removeTrackers');
  assert.equal(before.hashSelection,'single-or-star-all');
  assert.equal(before.legacyStarSelector,true);
  assert.equal(before.pipeSeparatedHashes,false);
  assert.equal(after.hashSelection,'multi-or-all');
  assert.equal(after.legacyStarSelector,true);
  assert.equal(after.ignoreMissingBatchMembers,true);
}

{
  assert.equal(resolveEndpointContract(profile('2.12.1'),'torrents/trackers').trackerTimingFields,false);
  assert.equal(resolveEndpointContract(profile('2.13.0'),'torrents/trackers').trackerTimingFields,true);
  assert.equal(resolveEndpointContract(profile('2.15.0'),'torrents/properties').availabilityField,false);
  assert.equal(resolveEndpointContract(profile('2.15.1'),'torrents/properties').availabilityField,true);
  assert.equal(resolveEndpointContract(profile('2.14.1'),'sync/maindata').useSubcategoriesField,true);
  assert.equal(resolveEndpointContract(profile('2.15.0'),'sync/maindata').useSubcategoriesField,false);
}

{
  const legacy=resolveEndpointContract(profile('2.15.0'),'torrents/editCategory');
  const modern=resolveEndpointContract(profile('2.15.1'),'torrents/editCategory');
  assert.deepEqual(legacy.requiredParameters,['category','savePath']);
  assert.equal(legacy.emptyCategoryStatus,400);
  assert.equal(legacy.missingResourceStatus,409);
  assert.equal(legacy.noOp,'conflict');
  assert.equal(modern.missingResourceStatus,404);
  assert.equal(modern.noOp,'success');
}

{
  const legacy=resolveEndpointContract(profile('2.12.1'),'torrents/editTracker');
  const modern=resolveEndpointContract(profile('2.13.0'),'torrents/editTracker');
  assert.deepEqual(legacy.requiredParameters,['hash','origUrl','newUrl']);
  assert.equal(legacy.trackerUrlParameter,'origUrl');
  assert.equal(legacy.tierEdit,false);
  assert.deepEqual(modern.requiredParameters,['hash','url']);
  assert.deepEqual(modern.mutationParameters,['newUrl','tier']);
  assert.equal(modern.mutationParameterRequirement,'at-least-one');
  assert.equal(modern.trackerUrlParameter,'url');
  assert.equal(modern.tierEdit,true);
}

{
  const unknown=resolveEndpointContract(profile('2.15.2'),'torrents/properties');
  assert.deepEqual(unknown,{path:'torrents/properties',webApiVersion:'2.15.2',semanticRevision:'unclassified'});
  const missing=resolveEndpointContract({},'torrents/properties');
  assert.equal(missing.semanticRevision,'unclassified');
  assert.equal(resolveEndpointContract(profile('2.15.1'),'torrents/reannounce'),null,'structural-only endpoints must not be copied into Endpoint Contract');
}

console.log('Virtual qB endpoint contracts passed: audited semantic revisions resolve through one dormant interface, structural truth stays out, and future unknown revisions fail closed.');

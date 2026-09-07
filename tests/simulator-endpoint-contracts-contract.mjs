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

  const legacyMainData=resolveEndpointContract(profile('2.0.2'),'sync/maindata');
  const categoryMapMainData=resolveEndpointContract(profile('2.1.0'),'sync/maindata');
  const freeSpaceMainData=resolveEndpointContract(profile('2.1.1'),'sync/maindata');
  assert.equal(legacyMainData.categoriesShape,'name-list','sync/maindata categories must be a name list before WebAPI 2.1.0');
  assert.equal(categoryMapMainData.categoriesShape,'details-map','sync/maindata categories must become a details map at WebAPI 2.1.0');
  assert.equal(categoryMapMainData.freeSpaceOnDiskField,false,'free_space_on_disk must not appear at WebAPI 2.1.0');
  assert.equal(freeSpaceMainData.freeSpaceOnDiskField,true,'free_space_on_disk must appear at WebAPI 2.1.1');

  const beforeSubcategories=resolveEndpointContract(profile('2.8.19'),'sync/maindata');
  const introducedSubcategories=resolveEndpointContract(profile('2.9.2'),'sync/maindata');
  const retainedSubcategories=resolveEndpointContract(profile('2.14.1'),'sync/maindata');
  const removedSubcategories=resolveEndpointContract(profile('2.15.0'),'sync/maindata');
  assert.equal(beforeSubcategories.useSubcategoriesField,false,'sync/maindata must not invent use_subcategories before WebAPI 2.9.2');
  assert.equal(introducedSubcategories.useSubcategoriesField,true,'sync/maindata must introduce use_subcategories at WebAPI 2.9.2');
  assert.equal(introducedSubcategories.useSubcategoriesPreference,'use_subcategories','Endpoint Contract must point projection at the canonical Preference key');
  assert.equal(retainedSubcategories.useSubcategoriesField,true);
  assert.equal(removedSubcategories.useSubcategoriesField,false,'sync/maindata must remove use_subcategories from WebAPI 2.15.0 onward');
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

console.log('Virtual qB endpoint contracts passed: audited semantic revisions resolve through one interface, sync/maindata models category/free-space/subcategories response lifecycles, structural truth stays out, and future unknown revisions fail closed.');

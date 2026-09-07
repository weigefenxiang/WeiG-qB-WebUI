import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const catalogPath=path.resolve(process.argv[2]||'');
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-taxonomy-compat.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'frozen taxonomy matrix requires a non-empty release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','frozen taxonomy matrix floor must remain qB 4.1.0');

const CATEGORY_WRITES=[
  'torrentscontroller.h:setCategoryAction',
  'torrentscontroller.h:createCategoryAction',
  'torrentscontroller.h:removeCategoriesAction'
];
const CATEGORIES='torrentscontroller.h:categoriesAction';
const TAG_ACTIONS=[
  'torrentscontroller.h:tagsAction',
  'torrentscontroller.h:addTagsAction',
  'torrentscontroller.h:removeTagsAction',
  'torrentscontroller.h:createTagsAction',
  'torrentscontroller.h:deleteTagsAction'
];
let categoriesCount=0,tagCount=0,firstCategories=null,firstTags=null;
for(const profile of catalog){
  assert.equal(profile.stable,true,`${profile.qbVersion}: frozen taxonomy matrix accepts stable profiles only`);
  assert.notEqual(profile.officialWeiGSupport,false,`${profile.qbVersion}: frozen taxonomy matrix accepts official supported profiles only`);
  assert.ok(Array.isArray(profile.apiActions),`${profile.qbVersion}: apiActions source facts missing`);
  for(const action of CATEGORY_WRITES)assert.ok(profile.apiActions.includes(action),`${profile.qbVersion}: category write surface lost exact source action ${action}`);
  if(profile.apiActions.includes(CATEGORIES)){
    categoriesCount++;
    if(!firstCategories)firstCategories=profile.qbVersion;
  }
  const tagPresence=TAG_ACTIONS.map(action=>profile.apiActions.includes(action));
  const present=tagPresence.filter(Boolean).length;
  assert.ok(present===0||present===TAG_ACTIONS.length,`${profile.qbVersion}: Tag action group must be source-proven atomically; got ${present}/${TAG_ACTIONS.length}`);
  if(present===TAG_ACTIONS.length){
    tagCount++;
    if(!firstTags)firstTags=profile.qbVersion;
  }
}
assert.ok(categoriesCount>0&&categoriesCount<catalog.length,'Frozen profiles must preserve both pre-categoriesAction and categoriesAction-capable eras');
assert.ok(tagCount>0&&tagCount<catalog.length,'Frozen profiles must preserve both pre-Tag and Tag-capable eras');
assert.equal(firstCategories,'4.1.4','categoriesAction must first appear at qB 4.1.4 in the frozen stable catalog');
assert.equal(firstTags,'4.2.0','Tag action group must first appear at qB 4.2.0 in the frozen stable catalog');
console.log(`Frozen taxonomy compatibility passed: ${catalog.length} official stable releases preserve qB 4.1.0 category writes, categoriesAction starts at ${firstCategories}, and the five Tag actions start atomically at ${firstTags}.`);

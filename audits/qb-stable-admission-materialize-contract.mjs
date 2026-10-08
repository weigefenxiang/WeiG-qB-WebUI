import assert from 'node:assert/strict';
import {appendExactLocaleOverlay} from '../tools/qb-stable-admission-materialize.mjs';
const historical=[{qbVersion:'5.2.3',sourceSha:'a'.repeat(40)}],newProfile={qbVersion:'5.2.4',sourceSha:'b'.repeat(40)};
const before={schemaVersion:1,supportFloor:'5.2.3',profileCount:1,latestAdmittedStable:'5.2.3',baseCatalogSha256:'f'.repeat(64),
  localeSets:{s1:['en','zh']},profiles:[{qbVersion:'5.2.3',sourceSha:'a'.repeat(40),source:'preferences-html',localeSet:'s1'}]};
const official=[{...historical[0]},{...newProfile,webuiLocaleSource:'views/preferences.html',webuiLocales:[{value:'en'},{value:'zh'},{value:'fr'}]}];
const next=appendExactLocaleOverlay(before,[...historical,newProfile],official,'e'.repeat(64),{mode:'source'});
assert.equal(next.profileCount,2);
assert.equal(next.latestAdmittedStable,'5.2.4');
assert.equal(next.profiles[1].sourceSha,newProfile.sourceSha);
assert.equal(next.profiles[1].localeSet,'s2');
assert.deepEqual(next.localeSets.s2,['en','zh','fr']);
assert.deepEqual(next.profiles[0],before.profiles[0]);
assert.deepEqual(before.localeSets,{s1:['en','zh']},'Old certified Locale owner must not mutate');
const unchanged=appendExactLocaleOverlay(before,[...historical,newProfile],[official[0],{...official[1],webuiLocales:[{value:'en'},{value:'zh'}]}],'e'.repeat(64),{});
assert.equal(unchanged.profiles[1].localeSet,'s1','Exact same official inventory must reuse existing Locale set');
assert.throws(()=>appendExactLocaleOverlay(before,[...historical,newProfile],[official[0],{...official[1],sourceSha:'c'.repeat(40)}],'e'.repeat(64),{}),/identity changed/);
assert.throws(()=>appendExactLocaleOverlay(before,[...historical,newProfile],[official[0],{...official[1],webuiLocales:[]}],'e'.repeat(64),{}),/incomplete/);
console.log('Canonical stable admission Locale overlay contract passed: immutable certified history and exact newly extracted official source.');

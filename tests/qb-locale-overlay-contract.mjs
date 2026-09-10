import assert from 'node:assert/strict';
import {applyLocaleOverlay,extractLocaleOverlay} from '../tools/qb-locale-overlay.mjs';

const base=[
  {qbVersion:'4.1.0',sourceSha:'aaa',preferenceKeys:['locale']},
  {qbVersion:'5.2.3',sourceSha:'bbb',preferenceKeys:['locale']}
];
const enriched=[
  {...base[0],webuiLocaleSource:'preferences-html',webuiLocales:[{value:'en',label:'English'},{value:'zh',label:'简体中文'}]},
  {...base[1],webuiLocaleSource:'translation-resources',webuiLocales:[{value:'en',label:null},{value:'zh_CN',label:null}]}
];
const overlay=extractLocaleOverlay(enriched);
assert.equal(overlay.schemaVersion,1);
assert.equal(overlay.profiles.length,2);
assert.deepEqual(overlay.profiles.map(item=>[item.qbVersion,item.sourceSha,item.webuiLocaleSource]),[
  ['4.1.0','aaa','preferences-html'],
  ['5.2.3','bbb','translation-resources']
]);
const applied=applyLocaleOverlay(base,overlay);
assert.deepEqual(applied.map(item=>item.webuiLocales.map(locale=>locale.value)),[['en','zh'],['en','zh_CN']]);
assert.deepEqual(base.map(item=>Object.hasOwn(item,'webuiLocales')),[false,false],'overlay application must not mutate the Frozen LKG input');
assert.throws(()=>applyLocaleOverlay(base,{...overlay,profiles:[{...overlay.profiles[0],sourceSha:'wrong'},overlay.profiles[1]]}),/source SHA mismatch/);
assert.throws(()=>applyLocaleOverlay(base,{...overlay,profiles:overlay.profiles.slice(0,1)}),/profile count mismatch/);

console.log('qB locale overlay contract passed: exact release/source-SHA facts can augment Virtual qB without mutating the Frozen LKG.');

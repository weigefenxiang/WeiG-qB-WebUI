import assert from 'node:assert/strict';
import {applyLocaleOverlay,extractLocaleOverlay,repairLocalePreferenceSemantics} from '../tools/qb-locale-overlay.mjs';

const base=[
  {qbVersion:'4.1.0',sourceSha:'aaa',preferenceKeys:['locale']},
  {qbVersion:'4.1.1',sourceSha:'bbb',preferenceKeys:['locale']},
  {qbVersion:'5.2.3',sourceSha:'ccc',preferenceKeys:['locale']}
];
const enriched=[
  {...base[0],webuiLocaleSource:'preferences-html',webuiLocales:[{value:'en',label:'English'},{value:'zh',label:'简体中文'}]},
  {...base[1],webuiLocaleSource:'preferences-html',webuiLocales:[{value:'en',label:'English'},{value:'zh',label:'简体中文'}]},
  {...base[2],webuiLocaleSource:'translation-resources',webuiLocales:[{value:'en',label:null},{value:'zh_CN',label:null}]}
];
const overlay=extractLocaleOverlay(enriched,{baseCatalogSha256:'deadbeef',sourceEvidence:{ciRunId:1}});
assert.equal(overlay.schemaVersion,1);
assert.equal(overlay.supportFloor,'4.1.0');
assert.equal(overlay.latestAdmittedStable,'5.2.3');
assert.equal(overlay.profileCount,3);
assert.equal(Object.keys(overlay.localeSets).length,2,'identical locale lists must share one frozen set');
assert.deepEqual(overlay.profiles.map(item=>[item.qbVersion,item.sourceSha,item.source,item.localeSet]),[
  ['4.1.0','aaa','preferences-html','s1'],
  ['4.1.1','bbb','preferences-html','s1'],
  ['5.2.3','ccc','translation-resources','s2']
]);
const applied=applyLocaleOverlay(base,overlay,{catalogSha256:'deadbeef'});
assert.deepEqual(applied.map(item=>item.webuiLocales.map(locale=>locale.value)),[['en','zh'],['en','zh'],['en','zh_CN']]);
assert.deepEqual(base.map(item=>Object.hasOwn(item,'webuiLocales')),[false,false,false],'overlay application must not mutate the Frozen LKG input');
assert.throws(()=>applyLocaleOverlay(base,{...overlay,profiles:[{...overlay.profiles[0],sourceSha:'wrong'},...overlay.profiles.slice(1)]},{catalogSha256:'deadbeef'}),/source SHA mismatch/);
assert.throws(()=>applyLocaleOverlay(base,{...overlay,profileCount:2,profiles:overlay.profiles.slice(0,2)},{catalogSha256:'deadbeef'}),/profile count mismatch/);
assert.throws(()=>applyLocaleOverlay(base,overlay,{catalogSha256:'bad'}),/base catalog SHA-256 mismatch/);
assert.throws(()=>applyLocaleOverlay(base,{...overlay,localeSets:{...overlay.localeSets,s2:[]}},{catalogSha256:'deadbeef'}),/locale overlay set s2 is unresolved/i);

const unresolvedLocale={
  qbVersion:'5.2.3',
  preferenceDescriptors:[{
    key:'locale',type:'string',readType:null,writeType:'string',getterPresent:true,setterPresent:true,
    getterKind:'UNKNOWN',setterKind:'STRING',getterSource:'UPSTREAM_GETTER',setterSource:'UPSTREAM_SETTER',
    getterConfidence:'UNRESOLVED',setterConfidence:'HIGH',typeAgreement:'READ_UNRESOLVED',writable:true,
    source:'UPSTREAM_SETTER',sourceConfidence:'HIGH'
  }],
  preferenceDescriptorStats:{readTyped:100,unresolvedRead:20,exactAgreement:90,semanticGetterEnriched:4}
};
const repaired=repairLocalePreferenceSemantics(unresolvedLocale);
const locale=repaired.preferenceDescriptors[0];
assert.equal(locale.readType,'string','Preferences::getLocale() must restore exact string read semantics');
assert.equal(locale.writeType,'string');
assert.equal(locale.typeAgreement,'EXACT');
assert.equal(locale.writable,true,'Locale must remain writable after source-backed read-type repair');
assert.equal(locale.getterKind,'PREFERENCES_DECLARATION');
assert.equal(locale.getterConfidence,'HIGH');
assert.equal(locale.localeSemanticSource,'src/base/preferences.h:Preferences::getLocale');
assert.deepEqual(repaired.preferenceDescriptorStats,{readTyped:101,unresolvedRead:19,exactAgreement:91,semanticGetterEnriched:5});
assert.equal(unresolvedLocale.preferenceDescriptors[0].readType,null,'Locale semantic repair must not mutate Frozen LKG input');
assert.throws(()=>repairLocalePreferenceSemantics({...unresolvedLocale,preferenceDescriptors:[{...unresolvedLocale.preferenceDescriptors[0],writeType:'number'}]}),/required source-proven getter\/setter string contract/);

console.log('qB locale overlay contract passed: source-SHA/base-catalog binding, deduplicated exact locale sets, Frozen LKG immutability and source-backed writable locale semantics are enforced.');

import assert from 'node:assert/strict';
import {buildTranslationSetIndex,emulateQbtDocument,exactTranslatorBehavior,translationIndexForProfile} from '../simulator/build/qbt-tr-emulator.mjs';

const behavior={schemaVersion:1,families:{
  'qapp-native':{altWebuiTranslation:true},
  'dedicated-native-no-explicit-fallback':{altWebuiTranslation:true,missingTranslationFallback:'none-explicit'},
  'dedicated-native-explicit-fallback':{altWebuiTranslation:true,missingTranslationFallback:'explicit-source'},
  'dedicated-alt-disabled':{altWebuiTranslation:false}
},profiles:[
  {qbVersion:'4.1.3',sourceSha:'a'.repeat(40),family:'qapp-native'},
  {qbVersion:'4.1.4',sourceSha:'e'.repeat(40),family:'dedicated-native-no-explicit-fallback'},
  {qbVersion:'4.6.4',sourceSha:'b'.repeat(40),family:'dedicated-alt-disabled'},
  {qbVersion:'5.2.3',sourceSha:'c'.repeat(40),family:'dedicated-native-explicit-fallback'}
]};
const shared={messages:[{context:'OptionsDialog',source:'Language:',translation:'语言：'},{context:'OptionsDialog',source:"Owner's label",translation:'所有者“标签”'}]};
const catalog=[
  {qbVersion:'4.1.3',sourceSha:'a'.repeat(40),settingsTranslations:{zh:'set1'},settingsTranslationSets:{set1:shared}},
  {qbVersion:'4.1.4',sourceSha:'e'.repeat(40),settingsTranslations:{zh_CN:'missing-set'}},
  {qbVersion:'4.6.4',sourceSha:'b'.repeat(40),settingsTranslations:{zh_CN:'set1'}},
  {qbVersion:'5.2.3',sourceSha:'c'.repeat(40),settingsTranslations:{zh_CN:'set1'}}
];
assert.equal(buildTranslationSetIndex(catalog).get('set1'),shared,'deduplicated translation sets must be resolved across profiles');
assert.equal(exactTranslatorBehavior(behavior,catalog[3]).family,'dedicated-native-explicit-fallback');
assert.equal(translationIndexForProfile(catalog,catalog[3],'zh-CN').get('OptionsDialog\u0000Language:'),'语言：');

const marker='QBT_TR(Language:)QBT_TR[CONTEXT=OptionsDialog]';
let result=emulateQbtDocument(marker,{catalog,behaviorEvidence:behavior,qbVersion:'5.2.3',locale:'zh-CN'});
assert.equal(result.text,'语言：');assert.equal(result.mode,'native-qbt-emulation');assert.equal(result.translated,1);
result=emulateQbtDocument(marker,{catalog,behaviorEvidence:behavior,qbVersion:'4.1.3',locale:'zh'});
assert.equal(result.text,'语言：','old qApp translator family uses the same exact official source/context evidence in Pages');
result=emulateQbtDocument(marker,{catalog,behaviorEvidence:behavior,qbVersion:'4.1.4',locale:'zh_CN'});
assert.equal(result.mode,'blocked-unsafe-fallback','4.1.4 must fail closed when a translation is missing because upstream source has no explicit source fallback');
assert.equal(result.text,marker);
result=emulateQbtDocument(marker,{catalog,behaviorEvidence:behavior,qbVersion:'4.6.4',locale:'zh_CN'});
assert.equal(result.text,marker,'4.5.0-4.6.4 Alternative WebUI family must remain visibly blocked instead of being falsely emulated as native');
assert.equal(result.mode,'blocked-by-upstream');
result=emulateQbtDocument('QBT_TR(Missing)QBT_TR[CONTEXT=OptionsDialog]',{catalog,behaviorEvidence:behavior,qbVersion:'5.2.3',locale:'zh_CN'});
assert.equal(result.text,'Missing');assert.equal(result.fallback,1,'native-capable families fall back to source when frozen translation evidence has no message');
result=emulateQbtDocument("QBT_TR(Owner's label)QBT_TR[CONTEXT=OptionsDialog]",{catalog,behaviorEvidence:behavior,qbVersion:'5.2.3',locale:'zh_CN'});
assert.equal(result.text,'所有者“标签”');
result=emulateQbtDocument(marker,{catalog,behaviorEvidence:behavior,qbVersion:'5.2.3',locale:'zh_CN'});
assert.ok(!result.text.includes('QBT_TR('));
const stale=catalog.map(item=>({...item}));stale[3].sourceSha='d'.repeat(40);
result=emulateQbtDocument(marker,{catalog:stale,behaviorEvidence:behavior,qbVersion:'5.2.3',locale:'zh_CN'});
assert.equal(result.mode,'blocked-missing-evidence','source-SHA drift must fail closed');
console.log('QBT_TR emulator contract passed: Pages only emulates native-capable exact source-SHA profiles and reuses frozen official translation sets.');

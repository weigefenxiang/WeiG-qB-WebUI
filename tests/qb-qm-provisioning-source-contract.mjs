import assert from 'node:assert/strict';
import {buildQmProvisioningPlan} from '../tools/qb-qm-provisioning-source.mjs';
import {buildQbNativeQmRecoveryEvidence,compareQbStableVersions,materializeQbNativeQmRecoveryUnion,mergeQbNativeQmRecoveryEvidence} from '../tools/qb-native-qm-recovery.mjs';
const behavior={schemaVersion:1,families:{
  'qapp-native':{altWebuiTranslation:true,translatorResource:'application-installed-translator',missingTranslationFallback:'qt-application-translator'},
  'dedicated-native-no-explicit-fallback':{altWebuiTranslation:true,translatorResource:'active-webui-root/translations/webui_<locale>.qm',missingTranslationFallback:'none-explicit'},
  'dedicated-native-explicit-fallback':{altWebuiTranslation:true,translatorResource:'active-webui-root/translations/webui_<locale>.qm',missingTranslationFallback:'explicit-source'},
  'dedicated-alt-disabled':{altWebuiTranslation:false,translatorResource:'active-webui-root/translations/webui_<locale>.qm',missingTranslationFallback:'explicit-source'}
},profiles:[
  {qbVersion:'4.1.3',sourceSha:'a'.repeat(40),family:'qapp-native'},
  {qbVersion:'4.1.4',sourceSha:'b'.repeat(40),family:'dedicated-native-no-explicit-fallback'},
  {qbVersion:'4.6.4',sourceSha:'c'.repeat(40),family:'dedicated-alt-disabled'},
  {qbVersion:'5.2.3',sourceSha:'d'.repeat(40),family:'dedicated-native-explicit-fallback'}
]};
const catalog=[
  {qbVersion:'4.1.3',sourceSha:'a'.repeat(40),webuiLocales:[{value:'en'},{value:'zh'}]},
  {qbVersion:'4.1.4',sourceSha:'b'.repeat(40),webuiLocales:[{value:'en'},{value:'de_DE'}]},
  {qbVersion:'4.6.4',sourceSha:'c'.repeat(40),webuiLocales:[{value:'en'},{value:'zh_CN'}]},
  {qbVersion:'5.2.3',sourceSha:'d'.repeat(40),webuiLocales:[{value:'en'},{value:'zh_CN'},{value:'zh_TW'}]}
];
const sources={
  '4.1.4':{paths:['src/lang/qbittorrent_de.ts'],source:{'src/lang/qbittorrent_de.ts':'<TS language="de"></TS>'}},
  '5.2.3':{paths:['src/webui/www/translations/webui_zh_CN.ts','src/webui/www/translations/webui_zh_TW.ts'],source:{'src/webui/www/translations/webui_zh_CN.ts':'<TS language="zh_CN"></TS>','src/webui/www/translations/webui_zh_TW.ts':'<TS language="zh_TW"></TS>'}}
};
const load=({qbVersion})=>({paths:sources[qbVersion]?.paths||[],readSource:path=>sources[qbVersion]?.source?.[path]||''});
const plan=buildQmProvisioningPlan(catalog,behavior,load);
assert.equal(plan.profileCount,4);
assert.equal(plan.profiles[0].strategy,'application-translator','4.1.0-4.1.3 must not be forced to ship active-root QM');
assert.equal(plan.profiles[0].resources.length,0);
assert.equal(plan.profiles[1].strategy,'active-root-qm-strict','4.1.4 must be treated as strict because source has no explicit fallback');
assert.deepEqual(plan.profiles[1].resources[0],{locale:'de_DE',sourceTs:'src/lang/qbittorrent_de.ts',targetPath:'translations/webui_de_DE.qm',lreleaseArgs:['src/lang/qbittorrent_de.ts','-qm','translations/webui_de_DE.qm']});
assert.equal(plan.profiles[2].strategy,'compatibility-bridge-required','4.5.0-4.6.4 cannot be fixed by merely provisioning QM');
assert.equal(plan.profiles[3].strategy,'active-root-qm');
assert.deepEqual(plan.profiles[3].resources.map(x=>x.targetPath),['translations/webui_zh_CN.qm','translations/webui_zh_TW.qm']);
const stale=structuredClone(behavior);stale.profiles[3].sourceSha='e'.repeat(40);
assert.throws(()=>buildQmProvisioningPlan(catalog,stale,load),/does not match exact source SHA/,'QM plan must be source-SHA bound');

const sha=(digit)=>String(digit).repeat(40);
const ts=(language,body)=>`<?xml version="1.0" encoding="utf-8"?><TS version="2.1" language="${language}">${body}</TS>`;
const context=(name,messages)=>`<context><name>${name}</name>${messages}</context>`;
const scalar=(source,translation,attrs='')=>`<message><source>${source}</source><translation${attrs}>${translation}</translation></message>`;
const plural=(source,...forms)=>`<message numerus="yes"><source>${source}</source><translation>${forms.map((form)=>`<numerusform>${form}</numerusform>`).join('')}</translation></message>`;
assert.ok(compareQbStableVersions('5.0.0','4.6.5')>0);
assert.ok(compareQbStableVersions('4.3.0.1','4.3.0')>0);
assert.throws(()=>compareQbStableVersions('5.2.3-rc1','5.2.3'),/Invalid exact qB stable version/);
const recoverySources=[
  ['4.1.0',sha(1),ts('zh_CN',context('Ctx',scalar('Winner','旧译')+scalar('NewestTie','甲')+scalar('Ignored unfinished','', ' type="unfinished"')+scalar('Ignored vanished','旧值',' type="vanished"')+plural('%n file(s)','%n 个文件','%n 个文件')))],
  ['4.2.0',sha(2),ts('zh_CN',context('Ctx',scalar('Winner','旧译')+scalar('NewestTie','乙')+plural('%n file(s)','%n 个文件','%n 个文件')))],
  ['5.0.0',sha(3),ts('zh_CN',context('Ctx',scalar('Winner','新译')+scalar('NewestTie','甲')+plural('%n file(s)','%n 份文件','%n 份文件')))],
  ['5.1.0',sha(4),ts('zh_CN',context('Ctx',scalar('Winner','新译')+scalar('NewestTie','乙')+plural('%n file(s)','%n 份文件','%n 份文件')))]
].map(([qbVersion,sourceSha,translationSource])=>buildQbNativeQmRecoveryEvidence([{qbVersion,sourceSha,locale:'zh_CN',translationSource}]));
const recoveryMerged=mergeQbNativeQmRecoveryEvidence([recoverySources[3],recoverySources[1],recoverySources[0],recoverySources[2]]);
const recoveryReversed=mergeQbNativeQmRecoveryEvidence([recoverySources[2],recoverySources[0],recoverySources[1],recoverySources[3]]);
assert.deepEqual(recoveryMerged,recoveryReversed,'parallel recovery evidence merge must not depend on shard completion/input order');
const recoveryUnion=materializeQbNativeQmRecoveryUnion(recoveryMerged);
const recoveryMessages=new Map(recoveryUnion.locales.zh_CN.map((item)=>[item.source,item]));
assert.equal(recoveryMessages.get('Winner').translation,'新译','equal occurrence counts must use the newest exact qB release as the first tie-break');
assert.equal(recoveryMessages.get('NewestTie').translation,'乙','candidate present in the newest exact release must win equal occurrence counts');
assert.deepEqual(recoveryMessages.get('%n file(s)'),{context:'Ctx',source:'%n file(s)',translation:['%n 份文件','%n 份文件'],numerus:true},'full recovery evidence must preserve plural forms instead of stringifying arrays');
assert.ok(!recoveryMessages.has('Ignored unfinished')&&!recoveryMessages.has('Ignored vanished'),'unfinished/vanished official TS messages must not enter recovery evidence');
const lexical=buildQbNativeQmRecoveryEvidence([{qbVersion:'5.2.3',sourceSha:sha('d'),locale:'de',translationSource:ts('de',context('Ctx',scalar('Same source','Zed')+scalar('Same source','Alpha')))}]);
assert.equal(materializeQbNativeQmRecoveryUnion(lexical).locales.de[0].translation,'Alpha','when count and newest exact release tie, lexical translation order must be deterministic');
const oldMajority=buildQbNativeQmRecoveryEvidence([
  {qbVersion:'4.1.0',sourceSha:sha('a'),locale:'de_DE',translationSource:ts('de_DE',context('Ctx',scalar('Mode','Alt')))},
  {qbVersion:'4.1.1',sourceSha:sha('b'),locale:'de_DE',translationSource:ts('de_DE',context('Ctx',scalar('Mode','Alt')))},
  {qbVersion:'5.2.3',sourceSha:sha('c'),locale:'de_DE',translationSource:ts('de_DE',context('Ctx',scalar('Mode','Neu')))}
]);
assert.equal(materializeQbNativeQmRecoveryUnion(oldMajority).locales.de_DE[0].translation,'Alt','occurrence count must outrank release recency');
const recoveryNested=mergeQbNativeQmRecoveryEvidence([mergeQbNativeQmRecoveryEvidence([recoverySources[0],recoverySources[2]]),recoverySources[1],recoverySources[3]]);
assert.deepEqual(recoveryNested,recoveryMerged,'recovery evidence merge must stay associative across pre-merged parallel shard groups');
const englishUnfinished=buildQbNativeQmRecoveryEvidence([{qbVersion:'5.2.3',sourceSha:sha('e'),locale:'en',translationSource:ts('en',context('Ctx',scalar('Ignored English unfinished','', ' type="unfinished"')))}]);
assert.deepEqual(materializeQbNativeQmRecoveryUnion(englishUnfinished).locales.en,[],'recovery votes must include finished official translations only, including for English TS');
assert.throws(()=>buildQbNativeQmRecoveryEvidence([{qbVersion:'5.2.3',sourceSha:'abc',locale:'de',translationSource:ts('de','')}]),/exact sourceSha/);
assert.throws(()=>buildQbNativeQmRecoveryEvidence([{qbVersion:'5.2.3',sourceSha:sha('f'),locale:'fr',translationSource:ts('de','')}]),/language mismatch/);
assert.throws(()=>mergeQbNativeQmRecoveryEvidence([recoverySources[0],recoverySources[0]]),/duplicate exact recovery release evidence/,'duplicate exact release/locale shards must fail closed instead of double-counting votes');
assert.throws(()=>buildQbNativeQmRecoveryEvidence([
  {qbVersion:'5.2.3',sourceSha:sha('f'),locale:'de',translationSource:ts('de',context('Ctx',scalar('A','A')))},
  {qbVersion:'5.2.3',sourceSha:sha('a'),locale:'fr',translationSource:ts('fr',context('Ctx',scalar('A','A')))}
]),/conflicting exact source SHA/,'one exact qB version cannot bind two source SHAs');
console.log('qB QM provisioning/recovery contract passed: source-bound routing plus deterministic full official TS recovery votes are enforced without weakening the Alternative WebUI gap.');

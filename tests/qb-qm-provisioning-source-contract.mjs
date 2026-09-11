import assert from 'node:assert/strict';
import {buildQmProvisioningPlan} from '../tools/qb-qm-provisioning-source.mjs';
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
console.log('qB QM provisioning contract passed: qApp family reuses application translator, dedicated native families map official TS to active-root QM, and the Alt-disabled family requires a compatibility bridge.');

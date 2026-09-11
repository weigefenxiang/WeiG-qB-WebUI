import assert from 'node:assert/strict';
import {buildQbOwnedStringInventory,collectSourceProvenQbRefs,extractQbtRefs,extractWeiGI18nKeys,hasQbSettingBridgeConsumer} from '../tools/qb-qbt-owned-string-inventory.mjs';
const catalog=[
  {qbVersion:'4.1.0',sourceSha:'a'.repeat(40),settingsUi:{locale:{title:{source:'Language:',context:'OptionsDialog'}}}},
  {qbVersion:'5.2.3',sourceSha:'b'.repeat(40),settingsUi:{locale:{title:{source:'Language:',context:'OptionsDialog'}},save_path:{title:{source:'Default Save Path:',context:'OptionsDialog'},description:{source:'Save files here',context:'OptionsDialog'}}}}
];
const refs=collectSourceProvenQbRefs(catalog);
assert.equal(refs.length,3,'source/context duplicates across releases must collapse without losing provenance');
const language=refs.find(item=>item.source==='Language:');
assert.deepEqual(language.preferenceKeys,['locale']);assert.deepEqual(language.versions,['4.1.0','5.2.3']);assert.equal(language.sourceShas.length,2);
const source=`W.I18n.qbSetting(key); W.I18n.t('app.close'); W.t("nav.settings"); <span data-i18n="settings.save"></span>\nQBT_TR(Language:)QBT_TR[CONTEXT=OptionsDialog]\nQBT_TR(Not Proven)QBT_TR[CONTEXT=OptionsDialog]`;
assert.equal(hasQbSettingBridgeConsumer(source),true);
assert.equal(extractQbtRefs(source,'settings.js').length,2);
assert.deepEqual(extractWeiGI18nKeys(source,'settings.js').map(item=>item.key),['app.close','nav.settings','settings.save']);
const inventory=buildQbOwnedStringInventory([{file:'private/scripts/settings.js',source}],catalog);
assert.equal(inventory.stats.provenQbRefs,3);
assert.equal(inventory.stats.formalQbtMarkers,2);
assert.equal(inventory.stats.provenFormalQbtMarkers,1);
assert.equal(inventory.stats.uncertainQbtMarkers,1,'QBT_TR without exact source/context proof must stay uncertain');
assert.deepEqual(inventory.bridgeConsumers,['private/scripts/settings.js']);
assert.deepEqual(inventory.classification.B_weiGNamespaceKeys,['app.close','nav.settings','settings.save']);
assert.equal(inventory.classification.C_uncertainQbtMarkers[0].source,'Not Proven');
console.log('qB-owned string inventory contract passed: exact upstream source/context is A, WeiG namespace calls are B, unproven QBT_TR markers fail closed to C.');

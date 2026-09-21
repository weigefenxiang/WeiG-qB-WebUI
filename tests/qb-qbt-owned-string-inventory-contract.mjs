import assert from 'node:assert/strict';
import {buildQbOwnedStringInventory,collectSourceProvenQbRefs,extractQbtRefs,extractWeiGI18nKeys,hasQbSettingBridgeConsumer} from '../tools/qb-qbt-owned-string-inventory.mjs';
import {auditQbEntityText,auditQbtSourceEntities,qbSourceRefKey} from '../tools/qb-source-text.mjs';

const sourceSha410='a'.repeat(40);
const sourceSha523='b'.repeat(40);
const catalog=[
  {qbVersion:'4.1.0',sourceSha:sourceSha410,settingsUi:{locale:{title:{source:'Language:',context:'OptionsDialog'}}}},
  {qbVersion:'5.2.3',sourceSha:sourceSha523,settingsUi:{locale:{title:{source:'Language:',context:'OptionsDialog'}},save_path:{title:{source:'Default Save Path:',context:'OptionsDialog'},description:{source:'Save files here',context:'OptionsDialog'}}}}
];

const refs=collectSourceProvenQbRefs(catalog);
assert.equal(refs.length,3,'canonical source/context duplicates across releases must collapse to one ref');
const language=refs.find(item=>item.source==='Language:');
assert.deepEqual(language.preferenceKeys,['locale']);
assert.deepEqual(language.uiKeys,[]);
assert.deepEqual(language.roles,['title']);
assert.deepEqual(language.versions,['4.1.0','5.2.3']);
assert.deepEqual(language.sourceShas,[sourceSha410,sourceSha523],'canonical dedupe must union both release source SHAs');
assert.ok(refs.some(item=>item.context==='OptionsDialog'&&item.source==='Default Save Path:'),'save_path title must remain a distinct canonical ref');
assert.ok(refs.some(item=>item.context==='OptionsDialog'&&item.source==='Save files here'),'save_path description must remain a distinct canonical ref');

const canonicalI2p='I2P (Experimental) (requires libtorrent >= 2.0)';
assert.equal(
  qbSourceRefKey('OptionsDialog','I2P (Experimental) (requires libtorrent &gt;= 2.0)'),
  qbSourceRefKey('OptionsDialog','I2P (Experimental) (requires libtorrent &amp;gt;= 2.0)'),
  'single- and multi-layer entity encodings must resolve to one canonical identity'
);
assert.notEqual(
  qbSourceRefKey('OptionsDialog','A &lt; B'),
  qbSourceRefKey('OptionsDialog','A &gt; B'),
  'different semantic text must not collide after canonicalization'
);
const unknownEntity=auditQbEntityText('Not &qbunknown; Proven');
assert.deepEqual(unknownEntity.unresolved,['&qbunknown;'],'unknown named entities must remain explicitly unresolved');
assert.equal(unknownEntity.canonical,'Not &qbunknown; Proven','unknown named entities must not be guessed or erased');
const contextlessAudit=auditQbtSourceEntities('QBT_TR(Contextless &amp; entity)QBT_TR');
assert.equal(contextlessAudit.markers,1,'entity census must include historical contextless QBT_TR markers');
assert.equal(contextlessAudit.entityBearing,1);
assert.deepEqual(contextlessAudit.unresolved,[]);

catalog[1].qbOwnedUi={
  'settings.preferences.copy.i2p':{context:'OptionsDialog',source:'I2P (Experimental) (requires libtorrent &amp;gt;= 2.0)'}
};
const source=`W.I18n.qbSetting(key); W.I18n.t('app.close'); W.t("nav.settings"); <span data-i18n="settings.save"></span>
QBT_TR(Language:)QBT_TR[CONTEXT=OptionsDialog]
QBT_TR(I2P (Experimental) (requires libtorrent &gt;= 2.0))QBT_TR[CONTEXT=OptionsDialog]
QBT_TR(Not &qbunknown; Proven)QBT_TR[CONTEXT=OptionsDialog]`;
assert.equal(hasQbSettingBridgeConsumer(source),true);
assert.equal(extractQbtRefs(source,'settings.js').length,3);
assert.equal(extractQbtRefs(source,'settings.js')[1].source,canonicalI2p);
assert.deepEqual(extractWeiGI18nKeys(source,'settings.js').map(item=>item.key),['app.close','nav.settings','settings.save']);

const inventory=buildQbOwnedStringInventory([{file:'private/scripts/settings.js',source}],catalog);
assert.equal(inventory.stats.provenQbRefs,4);
assert.equal(inventory.stats.formalQbtMarkers,3);
assert.equal(inventory.stats.provenFormalQbtMarkers,2);
assert.equal(inventory.stats.uncertainQbtMarkers,1,'QBT_TR without exact source/context proof must stay uncertain');
assert.deepEqual(inventory.bridgeConsumers,['private/scripts/settings.js']);
assert.deepEqual(inventory.classification.B_weiGNamespaceKeys,['app.close','nav.settings','settings.save']);
assert.equal(inventory.classification.C_uncertainQbtMarkers[0].source,'Not &qbunknown; Proven');
const i2p=inventory.classification.A_qbOwnedSourceRefs.find(item=>item.source===canonicalI2p);
assert.deepEqual(i2p.uiKeys,['settings.preferences.copy.i2p'],'entity-equivalent qB-owned refs must retain their source UI provenance');
console.log('qB-owned string inventory contract passed: canonical refs dedupe with provenance union, entity-equivalent refs share identity, and unresolved entities fail closed.');

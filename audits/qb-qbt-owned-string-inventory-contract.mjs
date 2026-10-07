import assert from 'node:assert/strict';
import {buildQbOwnedStringInventory,collectSourceProvenQbRefs,extractQbtRefs,extractWeiGI18nKeys,hasQbSettingBridgeConsumer} from '../tools/qb-qbt-owned-string-inventory.mjs';
import {extractQbOwnedUiFacts} from '../tools/qb-owned-ui-source.mjs';
import {auditQbEntityText,auditQbtSourceEntities,qbSourceRefKey} from '../tools/qb-source-text.mjs';

const addUi=extractQbOwnedUiFacts({
  addTorrentSource:'<title>QBT_TR(Add torrent)QBT_TR[CONTEXT=AddNewTorrentDialog]</title><legend>QBT_TR(Save at)QBT_TR[CONTEXT=AddNewTorrentDialog]</legend><button>QBT_TR(Add Torrent)QBT_TR[CONTEXT=AddNewTorrentDialog]</button>',
  downloadSource:'<h2>QBT_TR(Add torrent links)QBT_TR[CONTEXT=DownloadFromURLDialog]</h2><textarea aria-label="QBT_TR(URLs)QBT_TR[CONTEXT=DownloadFromURLDialog]"></textarea>',
  indexSource:'<img alt="QBT_TR(Add Torrent File...)QBT_TR[CONTEXT=MainWindow]">'
});
assert.deepEqual(addUi['add.title'],{source:'Add torrent',context:'AddNewTorrentDialog'});
assert.deepEqual(addUi['add.links'],{source:'Add torrent links',context:'DownloadFromURLDialog'});
assert.deepEqual(addUi['add.files'],{source:'Add Torrent File...',context:'MainWindow'});
assert.deepEqual(addUi['add.submit'],{source:'Add Torrent',context:'AddNewTorrentDialog'});
assert.ok(Object.keys(addUi).some(key=>key.startsWith('add.copy.')),'Add Torrent source family must be retained in qB-owned runtime copy facts');

const filterUi=extractQbOwnedUiFacts({
  filtersSource:'<span>QBT_TR(Status)QBT_TR[CONTEXT=TransferListFiltersWidget]</span><span>QBT_TR(Categories)QBT_TR[CONTEXT=TransferListFiltersWidget]</span><li id="stalled_downloading_filter"><span>QBT_TR(Stalled Downloading (0))QBT_TR[CONTEXT=StatusFilterWidget]</span></li>',
  clientSource:'updateFilter("stalled_downloading", "QBT_TR(Stalled Downloading (%1))QBT_TR[CONTEXT=StatusFilterWidget]"); QBT_TR(All)QBT_TR[CONTEXT=CategoryFilterModel] QBT_TR(Uncategorized)QBT_TR[CONTEXT=CategoryFilterModel] QBT_TR(All)QBT_TR[CONTEXT=TagFilterModel] QBT_TR(Untagged)QBT_TR[CONTEXT=TagFilterModel]',
  dynamicTableSource:'var TorrentsTable=new Class({Extends:DynamicTable,initColumns:function(){this.newColumn("status","","QBT_TR(Status)QBT_TR[CONTEXT=TransferListWidget]",100,true);}}); this.columns["status"].updateTd = function() { switch(row.full_data.state) { case "moving": status = "QBT_TR(Moving)QBT_TR[CONTEXT=TransferListDelegate]"; } }; // priority'
});
assert.deepEqual(filterUi['filter.stalled_downloading'],{source:'Stalled Downloading (%1)',context:'StatusFilterWidget'},'visible status filter copy must come from the native runtime updater instead of static zero-count bootstrap markup');
assert.deepEqual(filterUi['facet.category.all'],{source:'All',context:'CategoryFilterModel'});
assert.deepEqual(filterUi['facet.category.uncategorized'],{source:'Uncategorized',context:'CategoryFilterModel'});
assert.deepEqual(filterUi['facet.tag.all'],{source:'All',context:'TagFilterModel'});
assert.deepEqual(filterUi['facet.tag.untagged'],{source:'Untagged',context:'TagFilterModel'});
assert.equal(filterUi['sidebar.trackers'],undefined,'missing upstream Trackers surface must remain absent');
assert.equal(filterUi['filter.moving'],undefined,'torrent state copy must not be promoted into a native filter when the release has no moving filter');

const routeUi=extractQbOwnedUiFacts({indexSource:'<span>QBT_TR(RSS)QBT_TR[CONTEXT=MainWindow]</span><span>QBT_TR(Execution Log)QBT_TR[CONTEXT=MainWindow]</span><span>QBT_TR(Statistics)QBT_TR[CONTEXT=MainWindow]</span><img title="QBT_TR(Options)QBT_TR[CONTEXT=OptionsDialog]">'});
assert.deepEqual(routeUi['route.rss'],{source:'RSS',context:'MainWindow'});
assert.deepEqual(routeUi['route.logs'],{source:'Execution Log',context:'MainWindow'});
assert.deepEqual(routeUi['route.settings'],{source:'Options',context:'OptionsDialog'},'route header copy must be source-owned by exact qB index markup instead of a WeiG hand translation');
assert.equal(routeUi['transfer.statistics'],undefined,'Statistics title must be owned by the Statistics source descriptor, not duplicated in the generic qB-owned copy registry');

const legacyAddUi=extractQbOwnedUiFacts({
  downloadSource:'<title>QBT_TR(Download Torrents from their URLs or Magnet links)QBT_TR[CONTEXT=DownloadFromURLDialog]</title>',
  indexSource:'<a>QBT_TR(&Add Torrent File...)QBT_TR[CONTEXT=MainWindow]</a><a>QBT_TR(&Add Torrent Link...)QBT_TR[CONTEXT=MainWindow]</a>'
});
assert.deepEqual(legacyAddUi['add.files'],{source:'&Add Torrent File...',context:'MainWindow'},'qB 4.1 mnemonic-bearing Add Torrent File source must remain official-copy addressable');
assert.deepEqual(legacyAddUi['add.links'],{source:'&Add Torrent Link...',context:'MainWindow'},'qB 4.1 mnemonic-bearing Add Torrent Link fallback must remain official-copy addressable');

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

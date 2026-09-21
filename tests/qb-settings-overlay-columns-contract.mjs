import assert from 'node:assert/strict';
import {applyQbSettingsTranslationOverlay,buildQbSettingsTranslationOverlay} from '../tools/qb-settings-translation-overlay.mjs';

const sourceSha='a'.repeat(40);
const catalog=[{qbVersion:'4.1.0',sourceSha,tag:'release-4.1.0',webuiLocales:[{value:'en'}],preferenceDescriptors:[]}];
const dynamicTableSource=`var TorrentsTable = new Class({Extends: DynamicTable,initColumns:function(){this.newColumn('name','','QBT_TR(Name)QBT_TR[CONTEXT=TorrentModel]',200,true);this.newColumn('size','','QBT_TR(Size)QBT_TR[CONTEXT=TorrentModel]',100,false);}}); var TorrentPeersTable = new Class({});`;
const overlay=buildQbSettingsTranslationOverlay(catalog,()=>({preferencesSource:'',dynamicTableSource,translationSource:()=>''}));
assert.deepEqual(overlay.profiles[0].torrentTableColumns.map(item=>item.key),['name','size'],'exact dynamicTable source must enter the Settings/source overlay as native Torrent columns');
assert.deepEqual(overlay.profiles[0].torrentTableColumns[1],{key:'size',caption:'Size',defaultWidth:100,defaultVisible:false,translation:{source:'Size',context:'TorrentModel'},dataProperties:['size']});
const enriched=applyQbSettingsTranslationOverlay(catalog,overlay);
assert.deepEqual(enriched[0].torrentTableColumns,overlay.profiles[0].torrentTableColumns,'applying the source overlay must preserve exact native Torrent columns for LKG v2 certification');
assert.throws(()=>buildQbSettingsTranslationOverlay(catalog,()=>({preferencesSource:'',dynamicTableSource:'',translationSource:()=>''})),/unable to locate TorrentsTable implementation/,'an explicitly owned but unreadable dynamicTable source must fail closed rather than synthesize columns');

console.log('qB Settings overlay native-column contract passed: exact dynamicTable source columns flow through overlay materialization and missing owned source fails closed.');

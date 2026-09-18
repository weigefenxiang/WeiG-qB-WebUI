import assert from 'node:assert/strict';
import {settingsTabRefs} from '../tools/qb-owned-ui-source.mjs';
import {readSettingsRuntime} from '../tools/qb-compact-runtime.mjs';
import {extractQbPreferencesNativeSurface,mergeQbPreferencesSourceCatalogShards,selectQbPreferencesCatalogShard} from '../tools/qb-preferences-surface-source.mjs';
import {compileQbPreferencesCompact,expandQbPreferencesCompact} from '../tools/qb-preferences-compact.mjs';
import {extractQbPreferenceValueProjection} from '../tools/qb-preferences-value-projection.mjs';
import {catalogIdentity} from '../tools/qb-catalog-identity.mjs';

const toolbar=`
<menu>
  <li id="PrefBehaviorLink">QBT_TR(Behavior)QBT_TR[CONTEXT=OptionsDialog]</li>
  <li id="PrefFutureNetworkLink">QBT_TR(Future Network)QBT_TR[CONTEXT=OptionsDialog]</li>
</menu>`;
assert.deepEqual(settingsTabRefs(toolbar).map(item=>item.tab),['behavior','futurenetwork'],'new upstream Settings tabs must auto-admit from source IDs without a hard-coded allowlist');

const preferences=`
<div id="BehaviorTab" class="PrefTab">
  <fieldset class="settings">
    <legend>QBT_TR(Localization)QBT_TR[CONTEXT=OptionsDialog]</legend>
    <label for="locale_select">QBT_TR(User interface language:)QBT_TR[CONTEXT=OptionsDialog]</label>
    <select id="locale_select">
      <option value="en">QBT_TR(English)QBT_TR[CONTEXT=OptionsDialog]</option>
      <option value="fr">QBT_TR(French)QBT_TR[CONTEXT=OptionsDialog]</option>
    </select>
  </fieldset>
</div>
<div id="FutureNetworkTab" class="PrefTab invisible">
  <fieldset class="settings">
    <legend>
      <input type="checkbox" id="future_gate" onclick="updateFutureGate();">
      <label for="future_gate">QBT_TR(Future mode)QBT_TR[CONTEXT=OptionsDialog]</label>
    </legend>
    <label for="future_limit">QBT_TR(Future limit:)QBT_TR[CONTEXT=OptionsDialog]</label>
    <input id="future_limit" type="number" min="0" max="9000" step="1">QBT_TR(KiB)QBT_TR[CONTEXT=OptionsDialog]
  </fieldset>
</div>
<script>
  document.getElementById("locale_select").value = pref.locale;
  document.getElementById("future_gate").checked = pref.future_gate;
  document.getElementById("future_limit").value = pref.future_limit / 1024;
  settings["locale"] = document.getElementById("locale_select").value;
  settings["future_gate"] = document.getElementById("future_gate").checked;
  settings["future_limit"] = Number(document.getElementById("future_limit").value) * 1024;
</script>`;
const descriptors=[
  {key:'locale',getterPresent:true,setterPresent:true,readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true},
  {key:'future_gate',getterPresent:true,setterPresent:true,readType:'boolean',writeType:'boolean',typeAgreement:'EXACT',writable:true},
  {key:'future_limit',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true}
];
const manifest=extractQbPreferencesNativeSurface({preferencesSource:preferences,toolbarSource:toolbar,preferenceDescriptors:descriptors});
assert.deepEqual(manifest.tabs.map(tab=>tab.id),['behavior','futurenetwork']);
assert.equal(manifest.mappedPreferences,3);
assert.equal(manifest.totalPreferences,3);
assert.equal(manifest.preferences.locale.tab,'behavior');
assert.equal(manifest.preferences.locale.sectionOrder,0);
assert.equal(manifest.preferences.locale.control.semantic,'select');
assert.deepEqual(manifest.preferences.locale.control.options.map(item=>item.value),['en','fr']);
assert.equal(manifest.preferences.locale.control.options[1].label.source,'French');
assert.deepEqual(manifest.preferences.locale.projection,{kind:'identity',safeWrite:true},'identity source read/write must remain explicitly proven');
const localeReadNormalized=preferences.replace('document.getElementById("locale_select").value = pref.locale;','document.getElementById("locale_select").value = normalizeLocale(pref.locale);');
const localeWriteManifest=extractQbPreferencesNativeSurface({preferencesSource:localeReadNormalized,toolbarSource:toolbar,preferenceDescriptors:descriptors});
assert.deepEqual(localeWriteManifest.preferences.locale.projection,{kind:'unproven',safeWrite:true,writeFactor:1,writeIdentity:true},'EXACT writable string controls with a source-direct setter must keep safe writes when only the native read normalization is unresolved');
const numericReadUnknown=preferences.replace('document.getElementById("future_limit").value = pref.future_limit / 1024;','document.getElementById("future_limit").value = formatLimit(pref.future_limit);').replace('settings["future_limit"] = Number(document.getElementById("future_limit").value) * 1024;','settings["future_limit"] = Number(document.getElementById("future_limit").value);');
const numericUnknownManifest=extractQbPreferencesNativeSurface({preferencesSource:numericReadUnknown,toolbarSource:toolbar,preferenceDescriptors:descriptors});
assert.equal(numericUnknownManifest.preferences.future_limit.projection.safeWrite,false,'numeric direct setters must remain fail-closed when the source read projection is not proven');
assert.equal(manifest.preferences.future_gate.control.semantic,'checkbox');
assert.deepEqual(manifest.preferences.future_gate.projection,{kind:'identity',safeWrite:true},'checkbox identity projection must prove checked-value writes without a manual exception');
assert.equal(manifest.preferences.future_limit.tab,'futurenetwork');
assert.equal(manifest.preferences.future_limit.control.semantic,'number');
assert.equal(manifest.preferences.future_limit.control.attributes.max,'9000');
assert.deepEqual(manifest.preferences.future_limit.control.unit,{source:'KiB',context:'OptionsDialog'});
assert.equal(manifest.preferences.future_limit.descriptor.writeType,'number');
assert.deepEqual(manifest.preferences.future_limit.projection,{kind:'scale',scale:1024,safeWrite:true},'source-derived raw/UI unit conversion must stay attached to the preference fact');
assert.equal(manifest.preferences.future_limit.dependencies.gates[0].preferenceKey,'future_gate');
assert.equal(manifest.preferences.future_limit.dependencies.gates[0].handlers.onclick,'updateFutureGate();');
assert.deepEqual(manifest.tabs[1].preferences,['future_gate','future_limit'],'native preference order must follow upstream source order');
assert.equal(manifest.tabs[1].sections[0].title.source,'Future mode');

const legacyAltLimitSource=`
$('alt_dl_limit_value').setProperty('value', (pref.alt_dl_limit.toInt() / 1024));
const alt_dl_limit = $('alt_dl_limit_value').getProperty('value').toInt() * 1024;
settings.set('alt_dl_limit', alt_dl_limit);
`;
assert.deepEqual(
  extractQbPreferenceValueProjection(legacyAltLimitSource,'alt_dl_limit','alt_dl_limit_value'),
  {kind:'scale',scale:1024,safeWrite:true},
  'legacy qB 4.x variable-backed rate-limit projection must resolve linearly without catastrophic regex backtracking'
);

const shardBase=Array.from({length:5},(_value,index)=>({qbVersion:`5.0.${index}`,sourceSha:String(index+1).repeat(40)}));
const shardIdentity=catalogIdentity(shardBase),shard0=selectQbPreferencesCatalogShard(shardBase,0,2),shard1=selectQbPreferencesCatalogShard(shardBase,1,2);
assert.deepEqual(shard0.map(item=>item.qbVersion),['5.0.0','5.0.2','5.0.4']);
assert.deepEqual(shard1.map(item=>item.qbVersion),['5.0.1','5.0.3']);
const shardCatalog=(rows,index)=>({schemaVersion:1,source:'qb-upstream-preferences-native-surface',catalogIdentity:shardIdentity,shard:{index,count:2},profiles:rows.map(item=>({...item,tag:`release-${item.qbVersion}`,manifest:{tabs:[{id:'behavior'}],preferences:{},mappedPreferences:1,totalPreferences:1}}))});
const mergedShardCatalog=mergeQbPreferencesSourceCatalogShards(shardBase,[shardCatalog(shard0,0),shardCatalog(shard1,1)]);
assert.deepEqual(mergedShardCatalog.profiles.map(item=>item.qbVersion),shardBase.map(item=>item.qbVersion),'Preferences shard aggregate must restore canonical release order');
assert.throws(()=>mergeQbPreferencesSourceCatalogShards(shardBase,[shardCatalog(shard0,0)]),/missing=\[5\.0\.1,5\.0\.3\]/,'Preferences shard aggregate must fail closed on missing releases');
assert.throws(()=>mergeQbPreferencesSourceCatalogShards(shardBase,[shardCatalog(shard0,0),shardCatalog(shard0,0),shardCatalog(shard1,1)]),/duplicate=\[/,'Preferences shard aggregate must fail closed on duplicate releases');

const sourceCatalog={schemaVersion:1,profiles:[
  {qbVersion:'5.2.3',sourceSha:'1111111111111111111111111111111111111111',manifest},
  {qbVersion:'5.2.4',sourceSha:'2222222222222222222222222222222222222222',manifest}
]};
const compact=compileQbPreferencesCompact(sourceCatalog);
assert.equal(compact.schemaVersion,2);
assert.equal(compact.releases.length,2,'compact contract must retain exact release/source-SHA identity');
assert.equal(compact.tabs.length,1,'unchanged native tabs must deduplicate to one change point');
assert.equal(Object.keys(compact.preferences).length,3,'compact contract must be keyed by source-mapped preference identity instead of repeating whole manifests');
assert.ok(Array.isArray(compact.refs)&&compact.refs.some(ref=>ref[1]==='Future limit:'),'source/context identities must be interned once');
assert.equal(compact.format.preference.at(-1),'projection','compact format must make source value projection an explicit keyed preference fact');
const expanded=expandQbPreferencesCompact(compact,'5.2.3');
assert.deepEqual(expanded.tabs.map(tab=>tab.id),['behavior','futurenetwork']);
assert.equal(expanded.preferences.future_limit.tab,'futurenetwork');
assert.equal(expanded.preferences.future_limit.control.semantic,'number');
assert.equal(expanded.preferences.future_limit.control.attributes.max,'9000');
assert.deepEqual(expanded.preferences.future_limit.control.unit,{context:'OptionsDialog',source:'KiB'});
assert.equal(expanded.preferences.future_limit.descriptor.writeType,'number');
assert.deepEqual(expanded.preferences.future_limit.projection,{kind:'scale',safeWrite:true,scale:1024},'compact expansion must preserve exact source value projection');
assert.equal(expanded.preferences.future_limit.dependencies.gates[0].preferenceKey,'future_gate');
assert.deepEqual(expanded.tabs[1].preferences,['future_gate','future_limit']);
const changed=structuredClone(manifest);changed.preferences.future_limit.control.attributes.max='10000';
const compactChanged=compileQbPreferencesCompact({schemaVersion:1,profiles:[sourceCatalog.profiles[0],{qbVersion:'5.2.4',sourceSha:'2222222222222222222222222222222222222222',manifest:changed}]});
assert.equal(compactChanged.preferences.future_limit.length,2,'one preference change must create one keyed change point instead of duplicating every other native setting');
assert.equal(compactChanged.preferences.locale.length,1,'unrelated native preferences must remain deduplicated');

const runtimeSettings=readSettingsRuntime();
assert.equal(runtimeSettings.settingsData.schemaVersion,2,'formal Settings runtime must consume the source-native compact schema');
assert.equal(runtimeSettings.settingsData.source,'qb-upstream-preferences-native-surface-compact','formal Settings runtime must not rebuild a legacy descriptor/nativeTabs shape');
assert.equal(runtimeSettings.settingsData.catalogIdentity.releaseCount,65,'formal Settings runtime must remain bound to the admitted Frozen release set');
assert.equal(runtimeSettings.manifest.payload.sha256,'2784279c685ffc3df3cd4bb5bcdcb3838e50940ccdc2cb83d32e7a3cf04b326f','formal Settings runtime must consume the accepted exact source-native IR');
assert.equal(Object.prototype.hasOwnProperty.call(runtimeSettings.settingsData,'nativeTabs'),false,'legacy runtime-generated nativeTabs truth must stay retired');

console.log('qB Preferences native source contract passed: future tabs auto-admit through source extraction/compact IR; formal browser runtime consumes the accepted source-native envelope without rebuilding a second Settings truth.');

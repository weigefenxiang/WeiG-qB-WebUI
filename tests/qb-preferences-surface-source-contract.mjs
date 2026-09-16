import assert from 'node:assert/strict';
import {settingsTabRefs} from '../tools/qb-owned-ui-source.mjs';
import {compileCompactRuntime} from '../tools/qb-compact-runtime.mjs';
import {extractQbPreferencesNativeSurface} from '../tools/qb-preferences-surface-source.mjs';
import {compileQbPreferencesCompact,expandQbPreferencesCompact} from '../tools/qb-preferences-compact.mjs';

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
  document.getElementById("future_limit").value = pref.future_limit;
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
assert.equal(manifest.preferences.future_gate.control.semantic,'checkbox');
assert.equal(manifest.preferences.future_limit.tab,'futurenetwork');
assert.equal(manifest.preferences.future_limit.control.semantic,'number');
assert.equal(manifest.preferences.future_limit.control.attributes.max,'9000');
assert.deepEqual(manifest.preferences.future_limit.control.unit,{source:'KiB',context:'OptionsDialog'});
assert.equal(manifest.preferences.future_limit.descriptor.writeType,'number');
assert.equal(manifest.preferences.future_limit.dependencies.gates[0].preferenceKey,'future_gate');
assert.equal(manifest.preferences.future_limit.dependencies.gates[0].handlers.onclick,'updateFutureGate();');
assert.deepEqual(manifest.tabs[1].preferences,['future_gate','future_limit'],'native preference order must follow upstream source order');
assert.equal(manifest.tabs[1].sections[0].title.source,'Future mode');

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
const expanded=expandQbPreferencesCompact(compact,'5.2.3');
assert.deepEqual(expanded.tabs.map(tab=>tab.id),['behavior','futurenetwork']);
assert.equal(expanded.preferences.future_limit.tab,'futurenetwork');
assert.equal(expanded.preferences.future_limit.control.semantic,'number');
assert.equal(expanded.preferences.future_limit.control.attributes.max,'9000');
assert.deepEqual(expanded.preferences.future_limit.control.unit,{context:'OptionsDialog',source:'KiB'});
assert.equal(expanded.preferences.future_limit.descriptor.writeType,'number');
assert.equal(expanded.preferences.future_limit.dependencies.gates[0].preferenceKey,'future_gate');
assert.deepEqual(expanded.tabs[1].preferences,['future_gate','future_limit']);
const changed=structuredClone(manifest);changed.preferences.future_limit.control.attributes.max='10000';
const compactChanged=compileQbPreferencesCompact({schemaVersion:1,profiles:[sourceCatalog.profiles[0],{qbVersion:'5.2.4',sourceSha:'2222222222222222222222222222222222222222',manifest:changed}]});
assert.equal(compactChanged.preferences.future_limit.length,2,'one preference change must create one keyed change point instead of duplicating every other native setting');
assert.equal(compactChanged.preferences.locale.length,1,'unrelated native preferences must remain deduplicated');

const runtimeCompact=compileCompactRuntime([{qbVersion:'5.2.3',webApiVersion:'2.15.1',sourceSha:'1111111111111111111111111111111111111111',stable:true,officialWeiGSupport:true,qbOwnedUi:{'settings.tab.behavior':{source:'Behavior',context:'OptionsDialog'},'settings.tab.futurenetwork':{source:'Future Network',context:'OptionsDialog'}},apiActions:[],preferenceDescriptors:[]}]);
assert.deepEqual(runtimeCompact.settingsData.nativeTabs[0].value,['behavior','futurenetwork'],'compact runtime must preserve every source-admitted native Settings tab instead of filtering through a fixed known-tab allowlist');
assert.equal(runtimeCompact.catalogIdentity.releaseCount,1,'compact runtime must carry a common Frozen catalog identity foundation');
assert.deepEqual(runtimeCompact.capabilityData.catalogIdentity,runtimeCompact.settingsData.catalogIdentity,'compact domains compiled from one catalog must carry identical catalog identity');

console.log('qB Preferences native source contract passed: tabs auto-admit through extraction and compact runtime, source order/sections/controls/options/units/dependencies are preserved, and keyed compact IR expands losslessly without whole-manifest duplication.');

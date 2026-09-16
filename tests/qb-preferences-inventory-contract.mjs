import assert from 'node:assert/strict';
import {extractQbPreferencesNativeSurface} from '../tools/qb-preferences-surface-source.mjs';
import {extractQbPreferencesInventory,auditQbPreferencesInventory} from '../tools/qb-preferences-inventory.mjs';
import {assertCompleteSourceCensus} from '../tools/qb-source-census.mjs';

const toolbar=`
<menu>
  <li id="PrefBehaviorLink">QBT_TR(Behavior)QBT_TR[CONTEXT=OptionsDialog]</li>
  <li id="PrefFutureNetworkLink">QBT_TR(Future Network)QBT_TR[CONTEXT=OptionsDialog]</li>
</menu>`;
const source=`
<div id="BehaviorTab" class="PrefTab">
  <fieldset><legend>QBT_TR(Localization)QBT_TR[CONTEXT=OptionsDialog]</legend>
    <label for="locale_select">QBT_TR(User interface language:)QBT_TR[CONTEXT=OptionsDialog]</label>
    <select id="locale_select"><option value="en">QBT_TR(English)QBT_TR[CONTEXT=OptionsDialog]</option></select>
  </fieldset>
</div>
<div id="FutureNetworkTab" class="PrefTab invisible">
  <fieldset><legend><input type="checkbox" id="future_gate"><label for="future_gate">QBT_TR(Future mode)QBT_TR[CONTEXT=OptionsDialog]</label></legend>
    <label for="future_limit">QBT_TR(Future limit:)QBT_TR[CONTEXT=OptionsDialog]</label>
    <input id="future_limit" type="number" min="0" max="9000" step="1">
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
const manifest=extractQbPreferencesNativeSurface({preferencesSource:source,toolbarSource:toolbar,preferenceDescriptors:descriptors});
const inventory=extractQbPreferencesInventory({preferencesSource:source,preferenceDescriptors:descriptors});
assert.deepEqual(inventory.tabs.map(item=>item.key),['behavior','futurenetwork'],'independent raw tab inventory must discover source tabs without using semantic tab extraction');
assert.deepEqual(inventory.preferenceRefs.map(item=>item.key),['locale','future_gate','future_limit'],'independent raw preference inventory must discover current upstream dot syntax');
assert.deepEqual(inventory.controls.map(item=>item.key),['locale_select','future_gate','future_limit'],'independent raw control inventory must enumerate native form controls');
const complete=auditQbPreferencesInventory({inventory,manifest});
assertCompleteSourceCensus(complete.tabs,'Preferences tab inventory');
assertCompleteSourceCensus(complete.preferences,'Preferences preference inventory');
assertCompleteSourceCensus(complete.controls,'Preferences control inventory');

const bracketSource=source.replace('pref.future_gate','pref["future_gate"]');
const bracketInventory=extractQbPreferencesInventory({preferencesSource:bracketSource,preferenceDescriptors:descriptors});
assert.deepEqual(bracketInventory.preferenceRefs.map(item=>item.key),['locale','future_gate','future_limit'],'independent raw preference inventory must recognize bracket syntax even when semantic extraction has not admitted it');
const bracketManifest=extractQbPreferencesNativeSurface({preferencesSource:bracketSource,toolbarSource:toolbar,preferenceDescriptors:descriptors});
const bracketAudit=auditQbPreferencesInventory({inventory:bracketInventory,manifest:bracketManifest});
assert.deepEqual(bracketAudit.preferences.unaccounted,['future_gate'],'an unadmitted new source binding syntax must be visible to the independent census');
assert.throws(()=>assertCompleteSourceCensus(bracketAudit.preferences,'Preferences preference inventory'),/unaccounted=future_gate/,'new binding syntax must fail closed until the semantic extractor explicitly admits it');

const futureSource=source.replace('</div>\n<script>',`    <label for="future_unmapped">QBT_TR(Future unmapped:)QBT_TR[CONTEXT=OptionsDialog]</label>\n    <input id="future_unmapped" type="number">\n  </div>\n<script>`).replace('</script>','  document.getElementById("future_unmapped").value = pref.future_unmapped;\n</script>');
const futureDescriptors=[...descriptors,{key:'future_unmapped',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true}];
const futureInventory=extractQbPreferencesInventory({preferencesSource:futureSource,preferenceDescriptors:futureDescriptors});
const missed=auditQbPreferencesInventory({inventory:futureInventory,manifest});
assert.deepEqual(missed.preferences.unaccounted,['future_unmapped'],'a newly referenced upstream preference must remain unaccounted until semantic extraction admits it');
assert.deepEqual(missed.controls.unaccounted,['future_unmapped'],'a newly introduced native control must remain unaccounted until semantic extraction admits it');
assert.throws(()=>assertCompleteSourceCensus(missed.preferences,'Preferences preference inventory'),/unaccounted=future_unmapped/,'future source controls must fail closed instead of silently lowering a mapping ratio');

const helperSource=source.replace('<script>','<input id="helper_only" type="text">\n<script>');
const helperInventory=extractQbPreferencesInventory({preferencesSource:helperSource,preferenceDescriptors:descriptors});
const reviewed=auditQbPreferencesInventory({inventory:helperInventory,manifest,exclusions:{controls:[{key:'helper_only',reason:'reviewed synthetic non-preference helper control'}]}});
assertCompleteSourceCensus(reviewed.controls,'Preferences reviewed helper control inventory');

console.log('qB Preferences independent inventory contract passed: raw tabs, pref references, and native controls are censused independently; new binding syntax or upstream additions fail closed until mapped or explicitly reviewed.');

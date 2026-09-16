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
assert.deepEqual(inventory.controls.map(item=>item.key),['locale_select','future_gate','future_limit'],'raw form-control inventory remains available for diagnostics');
assert.deepEqual(inventory.bindings.map(item=>item.key),['locale_select','future_gate','future_limit'],'hard-gated binding inventory must include only controls independently proven to consume app/preferences');
const complete=auditQbPreferencesInventory({inventory,manifest});
assertCompleteSourceCensus(complete.tabs,'Preferences tab inventory');
assertCompleteSourceCensus(complete.preferences,'Preferences preference inventory');
assertCompleteSourceCensus(complete.bindings,'Preferences source binding inventory');

const multiRefSource=source.replace('document.getElementById("future_limit").value = pref.future_limit;','document.getElementById("future_limit").value = (pref.future_gate ? pref.future_limit : 1);');
const multiRefManifest=extractQbPreferencesNativeSurface({preferencesSource:multiRefSource,toolbarSource:toolbar,preferenceDescriptors:descriptors});
assert.equal(multiRefManifest.preferences.future_gate.control.id,'future_gate','gate preference must keep its direct checkbox owner when the value assignment also references it');
assert.equal(multiRefManifest.preferences.future_limit.control.id,'future_limit','every pref identity in one native assignment must remain source-mapped, not only the first ternary reference');
const multiRefAudit=auditQbPreferencesInventory({inventory:extractQbPreferencesInventory({preferencesSource:multiRefSource,preferenceDescriptors:descriptors}),manifest:multiRefManifest});
assertCompleteSourceCensus(multiRefAudit.preferences,'Preferences multi-reference inventory');
assertCompleteSourceCensus(multiRefAudit.bindings,'Preferences multi-reference binding inventory');

const bracketSource=source.replace('pref.future_gate','pref["future_gate"]');
const bracketInventory=extractQbPreferencesInventory({preferencesSource:bracketSource,preferenceDescriptors:descriptors});
assert.deepEqual(bracketInventory.preferenceRefs.map(item=>item.key),['locale','future_gate','future_limit'],'independent raw preference inventory must recognize bracket syntax even when semantic extraction has not admitted it');
const bracketManifest=extractQbPreferencesNativeSurface({preferencesSource:bracketSource,toolbarSource:toolbar,preferenceDescriptors:descriptors});
const bracketAudit=auditQbPreferencesInventory({inventory:bracketInventory,manifest:bracketManifest});
assert.deepEqual(bracketAudit.preferences.unaccounted,['future_gate'],'an unadmitted new source binding syntax must be visible to the independent preference census');
assert.deepEqual(bracketAudit.bindings.unaccounted,['future_gate'],'an unadmitted source binding syntax must also leave its source-proven control unaccounted');
assert.throws(()=>assertCompleteSourceCensus(bracketAudit.preferences,'Preferences preference inventory'),/unaccounted=future_gate/,'new binding syntax must fail closed until the semantic extractor explicitly admits it');

const futureSource=source.replace('</div>\n<script>',`    <label for="future_unmapped">QBT_TR(Future unmapped:)QBT_TR[CONTEXT=OptionsDialog]</label>\n    <input id="future_unmapped" type="number">\n  </div>\n<script>`).replace('</script>','  document.getElementById("future_unmapped").value = pref.future_unmapped;\n</script>');
const futureDescriptors=[...descriptors,{key:'future_unmapped',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true}];
const futureInventory=extractQbPreferencesInventory({preferencesSource:futureSource,preferenceDescriptors:futureDescriptors});
const missed=auditQbPreferencesInventory({inventory:futureInventory,manifest});
assert.deepEqual(missed.preferences.unaccounted,['future_unmapped'],'a newly referenced upstream preference must remain unaccounted until semantic extraction admits it');
assert.deepEqual(missed.bindings.unaccounted,['future_unmapped'],'a newly introduced source-bound control must remain unaccounted until semantic extraction admits it');
assert.throws(()=>assertCompleteSourceCensus(missed.preferences,'Preferences preference inventory'),/unaccounted=future_unmapped/,'future source controls must fail closed instead of silently lowering a mapping ratio');

const writeOnlySource=source.replace('document.getElementById("future_limit").value = pref.future_limit;','').replace('</script>','  settings["future_limit"] = Number(document.getElementById("future_limit").value);\n</script>');
const writeOnlyInventory=extractQbPreferencesInventory({preferencesSource:writeOnlySource,preferenceDescriptors:descriptors});
assert.ok(writeOnlyInventory.preferenceRefs.some(item=>item.key==='future_limit'&&item.syntax==='write:indexed-settings'),'write-side settings identity must enter the independent preference census even without a pref read');
assert.ok(writeOnlyInventory.bindings.some(item=>item.key==='future_limit'&&item.preferenceKeys.includes('future_limit')),'write-only native controls must enter the hard binding census');
const writeOnlyManifest=extractQbPreferencesNativeSurface({preferencesSource:writeOnlySource,toolbarSource:toolbar,preferenceDescriptors:descriptors});
assert.equal(writeOnlyManifest.preferences.future_limit.control.id,'future_limit','semantic extractor must retain a write-only source owner');
const writeOnlyAudit=auditQbPreferencesInventory({inventory:writeOnlyInventory,manifest:writeOnlyManifest});
assertCompleteSourceCensus(writeOnlyAudit.preferences,'Preferences write-only preference inventory');
assertCompleteSourceCensus(writeOnlyAudit.bindings,'Preferences write-only binding inventory');

const helperSource=source.replace('<script>','<input id="helper_only" type="text">\n<script>');
const helperInventory=extractQbPreferencesInventory({preferencesSource:helperSource,preferenceDescriptors:descriptors});
assert.ok(helperInventory.controls.some(item=>item.key==='helper_only'),'raw diagnostics must still see helper/client-only controls');
assert.ok(!helperInventory.bindings.some(item=>item.key==='helper_only'),'a helper control with no app/preferences source binding must not enter the hard completeness census');
const helperAudit=auditQbPreferencesInventory({inventory:helperInventory,manifest});
assertCompleteSourceCensus(helperAudit.bindings,'Preferences helper-safe binding inventory');
assert.ok(helperAudit.rawControls.unmappedControls.includes('helper_only'),'helper/client-only controls stay visible as diagnostics without masquerading as app/preferences omissions');

const legacyComposite=`
<div id="FutureNetworkTab" class="PrefTab">
  <fieldset><legend>QBT_TR(Transfer limits)QBT_TR[CONTEXT=OptionsDialog]</legend>
    <table><tr><td><input id="rate_gate" type="checkbox"><label for="rate_gate">QBT_TR(Upload:)QBT_TR[CONTEXT=OptionsDialog]</label></td><td><input id="rate_value" type="text"> QBT_TR(KiB/s)QBT_TR[CONTEXT=OptionsDialog]</td></tr></table>
    <textarea id="notes_value"></textarea>
  </fieldset>
</div>
<script>
  var rate = pref.rate_limit.toInt() / 1024;
  $('rate_value').setProperty('value', rate);
  $('notes_value').setProperty('value', pref.notes);
</script>`;
const legacyDescriptors=[
  {key:'rate_limit',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true},
  {key:'notes',getterPresent:true,setterPresent:true,readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true}
];
const legacyManifest=extractQbPreferencesNativeSurface({preferencesSource:legacyComposite,toolbarSource:toolbar,preferenceDescriptors:legacyDescriptors});
assert.equal(legacyManifest.preferences.rate_limit.control.id,'rate_value','legacy pref -> local variable -> value control must remain semantic source evidence');
assert.equal(legacyManifest.preferences.rate_limit.title.source,'Upload:','row label must beat an unrelated translated unit when labeling a composite value control');
assert.equal(legacyManifest.preferences.notes.control.id,'notes_value','direct binding without label[for] must survive through its native fieldset legend');
assert.equal(legacyManifest.preferences.notes.title.source,'Transfer limits','fieldset legend fallback must remain exact qB-owned source copy');
const legacyInventory=extractQbPreferencesInventory({preferencesSource:legacyComposite,preferenceDescriptors:legacyDescriptors});
assert.ok(legacyInventory.bindings.some(item=>item.key==='rate_value'&&item.preferenceKeys.includes('rate_limit')),'independent inventory must follow pref -> local variable -> native control without calling the semantic parser');
const legacyAudit=auditQbPreferencesInventory({inventory:legacyInventory,manifest:legacyManifest});
assertCompleteSourceCensus(legacyAudit.preferences,'Preferences legacy composite preference inventory');
assertCompleteSourceCensus(legacyAudit.bindings,'Preferences legacy composite binding inventory');

console.log('qB Preferences independent inventory contract passed: native tabs, read/write app/preferences identities and source-proven controls are censused independently; helper controls stay diagnostic-only, multi-reference/write-only/local-variable bindings remain mapped, and row/fieldset source copy fallback preserves source ownership.');

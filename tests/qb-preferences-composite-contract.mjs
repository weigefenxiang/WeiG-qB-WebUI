import assert from 'node:assert/strict';
import {extractQbPreferencesNativeSurface} from '../tools/qb-preferences-surface-source.mjs';
import {extractQbPreferencesInventory,auditQbPreferencesInventory} from '../tools/qb-preferences-inventory.mjs';
import {reviewedQbPreferencesExclusions} from '../tools/qb-preferences-reviewed-exclusions.mjs';
import {assertCompleteSourceCensus} from '../tools/qb-source-census.mjs';

const toolbar='<li id="PrefNetworkLink">QBT_TR(Network)QBT_TR[CONTEXT=OptionsDialog]</li>';
const source=`
<div id="NetworkTab" class="PrefTab">
  <label>QBT_TR(Enabled protocol:)QBT_TR[CONTEXT=OptionsDialog]</label>
  <select id="protocol_select"><option value="0">QBT_TR(Both)QBT_TR[CONTEXT=OptionsDialog]</option></select>
  <label for="proxy_select">QBT_TR(Type:)QBT_TR[CONTEXT=OptionsDialog]</label>
  <select id="proxy_select"><option value="none">QBT_TR((None))QBT_TR[CONTEXT=OptionsDialog]</option></select>
</div>
<script>
  $('protocol_select').setProperty('value', pref.protocol);
  switch (pref.proxy_type.toInt()) {
    case 1: $('proxy_select').setProperty('value', 'http'); break;
    default: $('proxy_select').setProperty('value', 'none');
  }
  updateNetworkInterfaces(pref.network_interface, pref.current_interface_name);
</script>`;
const descriptors=[
  {key:'protocol',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true},
  {key:'proxy_type',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true},
  {key:'network_interface',getterPresent:true,setterPresent:true,readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true},
  {key:'current_interface_name',getterPresent:true,setterPresent:false,readType:'string',writeType:null,typeAgreement:'READ_ONLY',writable:false}
];
const manifest=extractQbPreferencesNativeSurface({preferencesSource:source,toolbarSource:toolbar,preferenceDescriptors:descriptors});
assert.equal(manifest.preferences.protocol.control.id,'protocol_select','adjacent native label without for= must still identify the exact direct preference control');
assert.equal(manifest.preferences.protocol.title.source,'Enabled protocol:','adjacent source copy must label the native control');
assert.equal(manifest.preferences.proxy_type.control.id,'proxy_select','switch(pref.*) composite reads must resolve their unique native control');
assert.equal(manifest.preferences.proxy_type.title.source,'Type:','switch-mapped control title must stay source-owned');
assert.ok(!manifest.preferences.current_interface_name,'helper metadata must not be fabricated as an independent native preference control');

const inventory=extractQbPreferencesInventory({preferencesSource:source,preferenceDescriptors:descriptors});
assert.ok(inventory.bindings.some(item=>item.key==='protocol_select'&&item.preferenceKeys.includes('protocol')),'independent census must see the direct protocol binding');
assert.ok(inventory.bindings.some(item=>item.key==='proxy_select'&&item.preferenceKeys.includes('proxy_type')),'independent census must separately see the switch composite binding');
const exclusions=reviewedQbPreferencesExclusions({source,preferenceDescriptors:descriptors,inventory,manifest});
assert.deepEqual(exclusions.preferences.map(item=>item.key),['current_interface_name'],'getter-only helper metadata must require an explicit reviewed exclusion');
assert.match(exclusions.preferences[0].reason,/getter-only/,'reviewed exclusion must carry a concrete audit reason');
const audit=auditQbPreferencesInventory({inventory,manifest,exclusions});
assertCompleteSourceCensus(audit.tabs,'composite Preferences tabs');
assertCompleteSourceCensus(audit.preferences,'composite Preferences identities');
assertCompleteSourceCensus(audit.bindings,'composite Preferences bindings');

const writableDescriptors=descriptors.map(item=>item.key==='current_interface_name'?{...item,setterPresent:true,writeType:'string',typeAgreement:'EXACT',writable:true}:item);
const noExclusion=reviewedQbPreferencesExclusions({source,preferenceDescriptors:writableDescriptors,inventory,manifest});
assert.equal(noExclusion.preferences.length,0,'reviewed helper exclusion must fail closed if upstream ever makes the field writable');

console.log('qB Preferences composite contract passed: sibling-label controls and switch mappings are independently accounted, while getter-only helper metadata uses a source-guarded reviewed exclusion.');

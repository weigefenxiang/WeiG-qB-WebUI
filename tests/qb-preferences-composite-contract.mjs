import assert from 'node:assert/strict';
import {extractQbPreferencesNativeSurface} from '../tools/qb-preferences-surface-source.mjs';
import {extractQbPreferencesInventory,auditQbPreferencesInventory} from '../tools/qb-preferences-inventory.mjs';
import {reviewedQbPreferencesExclusions} from '../tools/qb-preferences-reviewed-exclusions.mjs';
import {extractQbPreferenceValueProjection} from '../tools/qb-preferences-value-projection.mjs';
import {assertCompleteSourceCensus} from '../tools/qb-source-census.mjs';

const toolbar='<li id="PrefNetworkLink">QBT_TR(Network)QBT_TR[CONTEXT=OptionsDialog]</li>';
const source=`
<div id="NetworkTab" class="PrefTab">
  <label>QBT_TR(Enabled protocol:)QBT_TR[CONTEXT=OptionsDialog]</label>
  <select id="protocol_select"><option value="0">QBT_TR(Both)QBT_TR[CONTEXT=OptionsDialog]</option></select>
  <label for="proxy_select">QBT_TR(Type:)QBT_TR[CONTEXT=OptionsDialog]</label>
  <select id="proxy_select"><option value="none">QBT_TR((None))QBT_TR[CONTEXT=OptionsDialog]</option></select>
  <label for="network_interface_select">QBT_TR(Network interface:)QBT_TR[CONTEXT=OptionsDialog]</label>
  <select id="network_interface_select"><option value="any">QBT_TR(Any interface)QBT_TR[CONTEXT=OptionsDialog]</option></select>
</div>
<script>
  $('protocol_select').setProperty('value', pref.protocol);
  switch (pref.proxy_type.toInt()) {
    case 1: $('proxy_select').setProperty('value', 'http'); break;
    default: $('proxy_select').setProperty('value', 'none');
  }
  $('network_interface_select').setProperty('value', pref.network_interface);
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
assert.equal(manifest.preferences.network_interface.control.id,'network_interface_select','the actual network-interface preference must remain independently source-mapped');
assert.ok(!manifest.preferences.current_interface_name,'helper metadata must not be fabricated as an independent native preference control');

const inventory=extractQbPreferencesInventory({preferencesSource:source,preferenceDescriptors:descriptors});
assert.ok(inventory.bindings.some(item=>item.key==='protocol_select'&&item.preferenceKeys.includes('protocol')),'independent census must see the direct protocol binding');
assert.ok(inventory.bindings.some(item=>item.key==='proxy_select'&&item.preferenceKeys.includes('proxy_type')),'independent census must separately see the switch composite binding');
assert.ok(inventory.bindings.some(item=>item.key==='network_interface_select'&&item.preferenceKeys.includes('network_interface')),'fixture must model the real independently-owned network-interface preference alongside its display metadata');
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

const scaled=`
<input id="rate" type="number">
<script>
  document.getElementById("rate").value = (Number(pref.rate_limit) / 1024);
  const rateLimit = Number(document.getElementById("rate").value) * 1024;
  settings["rate_limit"] = rateLimit;
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(scaled,'rate_limit','rate'),{kind:'scale',scale:1024,safeWrite:true},'inverse source read/write scale must compile into a safe scale projection');

const mib=`
<input id="size" type="text">
<script>
  document.getElementById("size").value = (pref.size_limit / 1024 / 1024);
  settings["size_limit"] = (document.getElementById("size").value * 1024 * 1024);
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(mib,'size_limit','size'),{kind:'scale',scale:1048576,safeWrite:true},'chained source scale must preserve the exact raw/UI unit ratio');

const mapped=`
<select id="proxy"></select>
<script>
  switch (pref.proxy_type.toInt()) {
    case 5:
      $('proxy').setProperty('value', 'socks4');
      break;
    case 2:
    case 4:
      $('proxy').setProperty('value', 'socks5');
      break;
    case 1:
    case 3:
      $('proxy').setProperty('value', 'http');
      break;
    default:
      $('proxy').setProperty('value', 'none');
  }
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(mapped,'proxy_type','proxy'),{kind:'switch-map',values:[['5','socks4'],['2','socks5'],['4','socks5'],['1','http'],['3','http']],defaultValue:'none',safeWrite:false},'source switch map may drive display but must stay non-writable when an independent inverse cannot be proven');

const sentinel=`
<input id="maxConnectionsCheckbox" type="checkbox">
<input id="maxConnectionsValue" type="text">
<script>
  const maxConnec = Number(pref.max_connec);
  if (maxConnec <= 0) {
    document.getElementById("maxConnectionsCheckbox").checked = false;
    document.getElementById("maxConnectionsValue").value = 500;
  }
  else {
    document.getElementById("maxConnectionsCheckbox").checked = true;
    document.getElementById("maxConnectionsValue").value = maxConnec;
  }
  let maxConnecWrite = -1;
  if (document.getElementById("maxConnectionsCheckbox").checked) {
    maxConnecWrite = Number(document.getElementById("maxConnectionsValue").value);
  }
  settings["max_connec"] = maxConnecWrite;
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(sentinel,'max_connec','maxConnectionsValue'),{kind:'sentinel-gate',gateControlId:'maxConnectionsCheckbox',disabledValue:-1,defaultValue:500,enabledWhen:{kind:'gt',value:0},safeWrite:true},'source-proven disabled sentinel + checkbox/value pair must compile into one generic safe sentinel projection');

const mismatch=`
<input id="value" type="number">
<script>
  document.getElementById("value").value = pref.example / 1024;
  settings["example"] = document.getElementById("value").value * 1000;
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(mismatch,'example','value'),{kind:'unproven',safeWrite:false,readFactor:1/1024,writeFactor:1000},'mismatched source transforms must fail closed instead of inventing a reversible projection');

const selectedIndexIdentity=`
<select id="content_layout"><option value="Original">Original</option><option value="Subfolder">Subfolder</option><option value="NoSubfolder">NoSubfolder</option></select>
<script>
let index = 0;
switch (pref.torrent_content_layout) {
  case "Subfolder": index = 1; break;
  case "NoSubfolder": index = 2; break;
}
document.getElementById("content_layout").getChildren("option")[index].selected = true;
settings["torrent_content_layout"] = document.getElementById("content_layout").getSelected()[0].value;
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(selectedIndexIdentity,'torrent_content_layout','content_layout'),{kind:'identity',safeWrite:true},'MooTools getChildren/getSelected select identity must be reversible from exact option values');

const selectedNumericIdentity=`
<select id="encryption"><option value="0">Prefer</option><option value="1">Force on</option><option value="2">Force off</option></select>
<script>
const encryption = Number(pref.encryption);
document.getElementById("encryption").getChildren("option")[encryption].selected = true;
settings["encryption"] = Number(document.getElementById("encryption").getSelected()[0].value);
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(selectedNumericIdentity,'encryption','encryption'),{kind:'identity',safeWrite:true},'numeric option indexes must prove exact select identity without a key whitelist');

const reorderedSelectIdentity=`
<select id="ratio_act"><option value="0">Pause</option><option value="1">Remove</option><option value="3">Delete files</option><option value="2">Enable super seeding</option></select>
<script>
const maxRatioAct = Number(pref.max_ratio_act);
let ratioLimitActIndex = 0;
switch (maxRatioAct) {
  case 1: ratioLimitActIndex = 1; break;
  case 2: ratioLimitActIndex = 3; break;
  case 3: ratioLimitActIndex = 2; break;
}
document.getElementById("ratio_act").getChildren("option")[ratioLimitActIndex].selected = true;
settings["max_ratio_act"] = Number(document.getElementById("ratio_act").value);
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(reorderedSelectIdentity,'max_ratio_act','ratio_act'),{kind:'identity',safeWrite:true},'reordered select indices must prove identity only when every exact option value round-trips');

const sourceActionToolbar='<li id="PrefRSSLink">QBT_TR(RSS)QBT_TR[CONTEXT=OptionsDialog]</li>';
const sourceActionMarkup=`
<div id="RSSTab" class="PrefTab">
  <div class="formRow">
    <input type="password" id="secret_value"><label for="secret_value">QBT_TR(Password:)QBT_TR[CONTEXT=OptionsDialog]</label>
    <button id="rss_rules" onclick="window.qBittorrent.Rss.openRssDownloader();">QBT_TR(Edit auto downloading rules...)QBT_TR[CONTEXT=OptionsDialog]</button>
  </div>
  <div class="formRow">
    <select id="networkInterface"></select>
    <select id="optionalIPAddressToBind"></select>
  </div>
</div>
<script>
const secret_value = document.getElementById("secret_value").value;
if (secret_value.length > 0)
  settings["write_only_secret"] = secret_value;
const updateNetworkInterfaces = (default_iface, default_iface_name) => {
  fetch("api/v2/app/networkInterfaceList", {method:"GET"}).then(async response => {
    const ifaces = await response.json();
    document.getElementById("networkInterface").options.add(new Option("QBT_TR(Any interface)QBT_TR[CONTEXT=OptionsDialog]", ""));
    for (const item of ifaces) document.getElementById("networkInterface").options.add(new Option(item.name, item.value));
  });
};
const updateInterfaceAddresses = (iface, default_addr) => {
  const url = new URL("api/v2/app/networkInterfaceAddressList", window.location);
  url.search = new URLSearchParams({iface: iface});
  fetch(url).then(async response => {
    const addresses = await response.json();
    document.getElementById("optionalIPAddressToBind").options.add(new Option("QBT_TR(All addresses)QBT_TR[CONTEXT=OptionDialog]", ""));
    document.getElementById("optionalIPAddressToBind").options.add(new Option("QBT_TR(All IPv4 addresses)QBT_TR[CONTEXT=OptionDialog]", "0.0.0.0"));
    document.getElementById("optionalIPAddressToBind").options.add(new Option("QBT_TR(All IPv6 addresses)QBT_TR[CONTEXT=OptionDialog]", "::"));
    for (const item of addresses) document.getElementById("optionalIPAddressToBind").options.add(new Option(item, item));
  });
};
document.getElementById("networkInterface").addEventListener("change", function() {
  updateInterfaceAddresses(this.value, "");
});
</script>`;
const graphFacts=extractQbPreferencesNativeSurface({preferencesSource:sourceActionMarkup,toolbarSource:sourceActionToolbar,preferenceDescriptors:[],writeOnlyDescriptors:[{key:'write_only_secret',getterPresent:false,setterPresent:true,readType:null,writeType:'string',typeAgreement:'WRITE_ONLY',writable:true}]});
const rssGraphItems=graphFacts.controlGraph.tabs.rss.rows.flatMap(row=>row.items);
assert.deepEqual(rssGraphItems.find(item=>item.id==='rss_rules').action,{kind:'source-action',owner:'Rss',name:'openRssDownloader'},'qualified qB helper must compile to a bounded source action');
assert.deepEqual(rssGraphItems.find(item=>item.id==='secret_value').writeOnly,{key:'write_only_secret',writeType:'string',safeWrite:true,omitEmpty:true},'exact setter-only password must bind to its direct native control without entering readable preferences');
assert.deepEqual(rssGraphItems.find(item=>item.id==='networkInterface').dynamicOptions,{kind:'api-options',endpoint:'app/networkInterfaceList',responseShape:'object-array',labelField:'name',valueField:'value',queryParam:null,dependsOnControlId:null,staticOptions:[{value:'',label:{source:'Any interface',context:'OptionsDialog'}}]},'network interface options must retain exact endpoint and response fields');
assert.equal(rssGraphItems.find(item=>item.id==='optionalIPAddressToBind').dynamicOptions.endpoint,'app/networkInterfaceAddressList');
assert.equal(rssGraphItems.find(item=>item.id==='optionalIPAddressToBind').dynamicOptions.queryParam,'iface');
assert.equal(rssGraphItems.find(item=>item.id==='optionalIPAddressToBind').dynamicOptions.dependsOnControlId,'networkInterface');

console.log('qB Preferences composite/value contract passed: sibling labels and switch bindings are censused independently, helper metadata is reviewed explicitly, inverse source scales are writable, and unproven transforms fail closed.');

import assert from 'node:assert/strict';
import {extractQbPreferencesNativeSurface} from '../tools/qb-preferences-surface-source.mjs';
import {extractQbPreferencesInventory,auditQbPreferencesInventory} from '../tools/qb-preferences-inventory.mjs';
import {reviewedQbPreferencesExclusions} from '../tools/qb-preferences-reviewed-exclusions.mjs';
import {extractQbPreferenceValueProjection} from '../tools/qb-preferences-value-projection.mjs';
import {assertCompleteSourceCensus} from '../tools/qb-source-census.mjs';
import {compileQbPreferencesCompact,expandQbPreferencesCompact} from '../tools/qb-preferences-compact.mjs';

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

const boundaryToolbar='<li id="PrefDownloadsLink">QBT_TR(Downloads)QBT_TR[CONTEXT=OptionsDialog]</li><li id="PrefConnectionLink">QBT_TR(Connection)QBT_TR[CONTEXT=OptionsDialog]</li>';
const boundarySource=`
<div id="DownloadsTab" class="PrefTab">
  <div class="formRow"><input id="dontstartdownloads_checkbox" type="checkbox"><label for="dontstartdownloads_checkbox">QBT_TR(Do not start the download automatically)QBT_TR[CONTEXT=OptionsDialog]</label></div>
</div>
<div id="ConnectionTab" class="PrefTab invisible">
  <div class="formRow">
    <label>QBT_TR(Peer connection protocol:)QBT_TR[CONTEXT=OptionsDialog]</label>
    <select id="enable_protocol_combobox"><option value="0">QBT_TR(TCP and μTP)QBT_TR[CONTEXT=OptionsDialog]</option><option value="1">TCP</option><option value="2">μTP</option></select>
  </div>
</div>
<script>
  $('enable_protocol_combobox').setProperty('value', pref.bittorrent_protocol);
  settings.set('bittorrent_protocol', $('enable_protocol_combobox').getProperty('value'));
</script>`;
const boundaryDescriptor=[{key:'bittorrent_protocol',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true}];
const boundaryFacts=extractQbPreferencesNativeSurface({preferencesSource:boundarySource,toolbarSource:boundaryToolbar,preferenceDescriptors:boundaryDescriptor});
assert.equal(boundaryFacts.preferences.bittorrent_protocol?.control?.id,'enable_protocol_combobox','bounded resolver must retain the exact Connection control');
assert.equal(boundaryFacts.preferences.bittorrent_protocol?.tab,'connection','Downloads source copy must never move a Connection preference across tabs');
assert.deepEqual(boundaryFacts.preferences.bittorrent_protocol?.title,{source:'Peer connection protocol:',context:'OptionsDialog'},'same-row native no-for label must outrank unrelated prior source copy');
assert.equal(boundaryFacts.ownershipCensus.crossTabOwnershipMismatch,0);
assert.equal(boundaryFacts.ownershipCensus.crossRowOwnershipMismatch,0);
assert.equal(boundaryFacts.ownershipCensus.wrongSourceRef,0);
assert.equal(boundaryFacts.ownershipCensus.ambiguousBinding,0);
assert.equal(boundaryFacts.ownershipCensus.complete,true,'bounded source fixture must close every ownership census dimension');

const missingPeerLabel=boundarySource.replace('<label>QBT_TR(Peer connection protocol:)QBT_TR[CONTEXT=OptionsDialog]</label>','');
const missingPeerFacts=extractQbPreferencesNativeSurface({preferencesSource:missingPeerLabel,toolbarSource:boundaryToolbar,preferenceDescriptors:boundaryDescriptor});
assert.equal(missingPeerFacts.preferences.bittorrent_protocol,undefined,'missing Connection copy must fail closed instead of borrowing the Downloads label');
assert.ok(missingPeerFacts.ownershipCensus.missingRequiredLabel>0,'fail-closed ownership must expose the unresolved native label in the census');

const ambiguousGroupSource=`
<div id="ConnectionTab" class="PrefTab"><fieldset class="settings"><legend>QBT_TR(Connections)QBT_TR[CONTEXT=OptionsDialog]</legend>
  <select id="first_control"><option value="0">zero</option></select>
  <select id="second_control"><option value="0">zero</option></select>
</fieldset></div>
<script>document.getElementById("first_control").value = pref.first_setting;</script>`;
const ambiguousGroupFacts=extractQbPreferencesNativeSurface({preferencesSource:ambiguousGroupSource,toolbarSource:'<li id="PrefConnectionLink">Connection</li>',preferenceDescriptors:[{key:'first_setting',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true}]});
assert.equal(ambiguousGroupFacts.preferences.first_setting,undefined,'fieldset legend must not be fabricated as an individual control label when multiple direct controls make group ownership ambiguous');
assert.ok(ambiguousGroupFacts.ownershipCensus.missingRequiredLabel>0,'unproven E3 group ownership must fail closed and remain visible in the census');

const inlineCopySource=`
<div id="SpeedTab" class="PrefTab"><table>
  <tr><td><input type="checkbox" id="ratio_gate"><label for="ratio_gate">QBT_TR(Ratio gate)QBT_TR[CONTEXT=OptionsDialog]</label></td></tr>
  <tr><td><input type="checkbox" id="time_gate"><label for="time_gate">QBT_TR(Time gate)QBT_TR[CONTEXT=OptionsDialog]</label></td></tr>
  <tr><td>QBT_TR(then)QBT_TR[CONTEXT=OptionsDialog]</td><td><select id="max_ratio_act"><option value="0">QBT_TR(Pause them)QBT_TR[CONTEXT=OptionsDialog]</option><option value="1">QBT_TR(Remove them)QBT_TR[CONTEXT=OptionsDialog]</option></select></td></tr>
</table></div>
<script>
function updateRatioActionEnabled() {
  const disabled = !($('ratio_gate').getProperty('checked') || $('time_gate').getProperty('checked'));
  $('max_ratio_act').setProperty('disabled', disabled);
}
$('max_ratio_act').setProperty('value', pref.max_ratio_act);
</script>`;
const inlineCopyFacts=extractQbPreferencesNativeSurface({preferencesSource:inlineCopySource,toolbarSource:'<li id="PrefSpeedLink">Speed</li>',preferenceDescriptors:[{key:'max_ratio_act',getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true}]});
assert.equal(inlineCopyFacts.preferences.max_ratio_act?.control?.id,'max_ratio_act');
assert.deepEqual(inlineCopyFacts.preferences.max_ratio_act?.title,{source:'then',context:'OptionsDialog'},'unique row-local source copy must own its control before multiple behavior-gate labels can make E3 ambiguous');
assert.equal(inlineCopyFacts.ownershipCensus.missingRequiredLabel,0);
assert.equal(inlineCopyFacts.ownershipCensus.ambiguousSourceRef,0);
assert.equal(inlineCopyFacts.ownershipCensus.complete,true,'historical inline-copy control ownership must close without a version/key exception');

const danglingForSource=`
<div id="DownloadsTab" class="PrefTab"><div class="formRow">
  <input type="checkbox" id="dontstartdownloads_checkbox">
  <label for="stale_control_id">QBT_TR(Do not start the download automatically)QBT_TR[CONTEXT=OptionsDialog]</label>
</div></div>
<script>document.getElementById("dontstartdownloads_checkbox").checked = pref.start_paused_enabled;</script>`;
const danglingForFacts=extractQbPreferencesNativeSurface({preferencesSource:danglingForSource,toolbarSource:'<li id="PrefDownloadsLink">Downloads</li>',preferenceDescriptors:[{key:'start_paused_enabled',getterPresent:true,setterPresent:true,readType:'boolean',writeType:'boolean',typeAgreement:'EXACT',writable:true}]});
assert.equal(danglingForFacts.preferences.start_paused_enabled?.control?.id,'dontstartdownloads_checkbox');
assert.deepEqual(danglingForFacts.preferences.start_paused_enabled?.title,{source:'Do not start the download automatically',context:'OptionsDialog'},'a unique row-local dangling for= label must recover its actual source control without a key exception');
assert.equal(danglingForFacts.ownershipCensus.missingRequiredLabel,0);
assert.equal(danglingForFacts.ownershipCensus.complete,true,'historical dangling label ownership must close only when row structure is unique');

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

const compoundMapped=`
<select id="mode_select"><option value="none">None</option><option value="a">A</option><option value="b">B</option><option value="c">C</option></select>
<input id="mode_auth" type="checkbox">
<script>
switch (pref.mode.toInt()) {
  case 5: $('mode_select').setProperty('value', 'a'); break;
  case 2:
  case 4: $('mode_select').setProperty('value', 'b'); break;
  case 1:
  case 3: $('mode_select').setProperty('value', 'c'); break;
  default: $('mode_select').setProperty('value', 'none');
}
$('mode_auth').setProperty('checked', pref.mode_auth);
const mode_shadow = $('mode_select').getProperty('value');
var mode_str = $('mode_select').getProperty('value');
var mode_raw = 0;
if (mode_str == "b") {
  if ($('mode_auth').getProperty('checked')) {
    mode_raw = 4;
  }
  else {
    mode_raw = 2;
  }
}
else {
  if (mode_str == "a") {
    mode_raw = 5;
  }
  else {
    if (mode_str == "c") {
      if ($('mode_auth').getProperty('checked')) {
        mode_raw = 3;
      }
      else {
        mode_raw = 1;
      }
    }
  }
}
settings.set('mode', mode_raw);
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(compoundMapped,'mode','mode_select'),{
  kind:'compound-switch-map',
  values:[['5','a'],['2','b'],['4','b'],['1','c'],['3','c']],
  defaultValue:'none',
  auxiliary:{controlId:'mode_auth',preferenceKey:'mode_auth',semantic:'checkbox'},
  writeCases:[
    {value:'none',raw:0},
    {value:'a',raw:5},
    {value:'b',aux:true,raw:4},
    {value:'b',aux:false,raw:2},
    {value:'c',aux:true,raw:3},
    {value:'c',aux:false,raw:1}
  ],
  safeWrite:true
},'compound source switch writes must become writable only when the select domain, auxiliary checkbox and every raw value round-trip exactly');

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

const booleanSelect=`
<select id="management_mode"><option value="false">Manual</option><option value="true">Automatic</option></select>
<script>
  document.getElementById("management_mode").value = pref.management_enabled;
  settings["management_enabled"] = (document.getElementById("management_mode").value === "true");
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(booleanSelect,'management_enabled','management_mode'),{kind:'boolean-select',trueValue:'true',falseValue:'false',safeWrite:true},'boolean-valued native selects must prove the exact true/false inverse without confusing equality comparisons with later read assignments');

const preferenceSentinel=`
<input id="limit_enabled" type="checkbox">
<input id="limit_value" type="text">
<script>
  document.getElementById("limit_enabled").checked = pref.limit_enabled;
  document.getElementById("limit_value").value = (pref.limit_enabled ? Number(pref.limit_value) : 1440);
  let limitWrite = -1;
  if (document.getElementById("limit_enabled").checked) {
    limitWrite = Number(document.getElementById("limit_value").value);
  }
  settings["limit_enabled"] = document.getElementById("limit_enabled").checked;
  settings["limit_value"] = limitWrite;
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(preferenceSentinel,'limit_value','limit_value'),{kind:'sentinel-gate',gateControlId:'limit_enabled',gatePreferenceKey:'limit_enabled',disabledValue:-1,defaultValue:1440,enabledWhen:{kind:'preference-truthy',key:'limit_enabled'},safeWrite:true},'a separate writable boolean Preference may source-prove a numeric sentinel gate only when the checkbox read/write owner and numeric inverse are exact');

const legacyPreferenceSentinel=`
<input id="limit_enabled" type="checkbox">
<input id="limit_value" type="text">
<script>
  $('limit_enabled').setProperty('checked', pref.limit_enabled);
  if (pref.limit_enabled)
    $('limit_value').setProperty('value', pref.limit_value.toInt());
  else
    $('limit_value').setProperty('value', 1440);
  var limitWrite = -1;
  if ($('limit_enabled').getProperty('checked')) {
    limitWrite = $('limit_value').getProperty('value').toInt();
  }
  settings.set('limit_enabled', $('limit_enabled').getProperty('checked'));
  settings.set('limit_value', limitWrite);
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(legacyPreferenceSentinel,'limit_value','limit_value'),{kind:'sentinel-gate',gateControlId:'limit_enabled',gatePreferenceKey:'limit_enabled',disabledValue:-1,defaultValue:1440,enabledWhen:{kind:'preference-truthy',key:'limit_enabled'},safeWrite:true},'legacy unbraced if/else presentation must prove the same preference-backed sentinel family without a preference-key exception');

const transitionalPreferenceSentinel=`
<input id="limit_enabled" type="checkbox">
<input id="limit_value" type="text">
<script>
  $("limit_enabled").checked = pref.limit_enabled;
  $("limit_value").value = (pref.limit_enabled ? Number(pref.limit_value) : 1440);
  let limitWrite = -1;
  if (document.getElementById("limitEnabled").checked) {
    limitWrite = Number(document.getElementById("limitValue").value);
  }
  settings["limit_enabled"] = $("limit_enabled").checked;
  settings["limit_value"] = limit_write;
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(transitionalPreferenceSentinel,'limit_value','limit_value'),{kind:'sentinel-gate',gateControlId:'limit_enabled',gatePreferenceKey:'limit_enabled',disabledValue:-1,defaultValue:1440,enabledWhen:{kind:'preference-truthy',key:'limit_enabled'},safeWrite:true},'a transitional source rename may resolve stale camel/snake control and local-variable aliases only when normalized identifiers are unique and the exact preference gate + numeric inverse remain source-proven');

const mismatch=`
<input id="value" type="number">
<script>
  document.getElementById("value").value = pref.example / 1024;
  settings["example"] = document.getElementById("value").value * 1000;
</script>`;
assert.deepEqual(extractQbPreferenceValueProjection(mismatch,'example','value'),{kind:'unproven',safeWrite:false,readFactor:1/1024,writeFactor:1000},'mismatched source transforms must fail closed instead of inventing a reversible projection');

const legacyBooleanAliasMarkup=`
<div id="AdvancedTab" class="PrefTab"><div class="formRow"><label for="flag_control">QBT_TR(Flag:)QBT_TR[CONTEXT=OptionsDialog]</label><input id="flag_control" type="checkbox"></div></div>
<script>
$('flag_control').setProperty('checked', pref.legacy_flag_name);
settings.set('current_flag_name', $('flag_control').getProperty('checked'));
</script>`;
const legacyBooleanAliasFacts=extractQbPreferencesNativeSurface({
  preferencesSource:legacyBooleanAliasMarkup,
  toolbarSource:'<li id="PrefAdvancedLink">Advanced</li>',
  preferenceDescriptors:[{key:'current_flag_name',getterPresent:true,setterPresent:true,readType:'boolean',writeType:'boolean',typeAgreement:'EXACT',writable:true}]
});
assert.deepEqual(legacyBooleanAliasFacts.preferences.current_flag_name?.projection,{kind:'identity',safeWrite:true},'exact API boolean getter/setter plus direct checkbox write must prove identity even when historical native UI read copy used a stale alias');

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

const templateOptionsMarkup='<div id="WebUITab" class="PrefTab"><label for="locale_select">QBT_TR(User Interface Language:)QBT_TR[CONTEXT=OptionsDialog]</label><select id="locale_select">${LANGUAGE_OPTIONS}</select></div><script>document.getElementById("locale_select").value = pref.locale;</script>';
const templateOptionsFacts=extractQbPreferencesNativeSurface({preferencesSource:templateOptionsMarkup,toolbarSource:'<li id="PrefWebUILink">Web UI</li>',preferenceDescriptors:[{key:'locale',getterPresent:true,setterPresent:true,readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true}]});
const templateOptionsItem=templateOptionsFacts.controlGraph.tabs.webui.rows.flatMap(row=>row.items).find(item=>item.id==='locale_select');
assert.deepEqual(templateOptionsItem?.dynamicOptions,{kind:'server-template-options',token:'LANGUAGE_OPTIONS'},'server-rendered select placeholders must enter the canonical option-provider IR without a locale key exception');
assert.equal(templateOptionsFacts.ownershipCensus.missingOptions,0);
assert.equal(templateOptionsFacts.ownershipCensus.complete,true,'server-template option providers must satisfy source option accounting');



const structuredToolbar='<li id="PrefDownloadsLink">QBT_TR(Downloads)QBT_TR[CONTEXT=OptionsDialog]</li>';
const structuredMarkup=[
  '<div id="DownloadsTab" class="PrefTab">',
  '<fieldset class="settings"><legend>QBT_TR(Automatically add items from:)QBT_TR[CONTEXT=OptionsDialog]</legend>',
  '<table id="futureFolders"><thead><tr>',
  '<th>QBT_TR(Monitored Folder)QBT_TR[CONTEXT=ScanFoldersModel]</th>',
  '<th>QBT_TR(Override Save Location)QBT_TR[CONTEXT=ScanFoldersModel]</th>',
  '</tr></thead><tbody></tbody></table></fieldset></div><script>',
  'const addFutureFolder = (folder = "", sel = "default_folder", other = "") => {',
  '  const pos = document.getElementById("futureFolders").rows.length;',
  '  const html = "<option value=\x27watch_folder\x27>QBT_TR(Monitored folder)QBT_TR[CONTEXT=ScanFoldersModel]</option>"',
  '    + "<option value=\x27default_folder\x27>QBT_TR(Default save location)QBT_TR[CONTEXT=ScanFoldersModel]</option>"',
  '    + "<option value=\x27other\x27>QBT_TR(Other...)QBT_TR[CONTEXT=ScanFoldersModel]</option>";',
  '};',
  'const getFutureFolders = () => {',
  '  const folders = {};',
  '  const count = document.getElementById("futureFolders").rows.length;',
  '  let sel = ""; let other;',
  '  switch (sel) {',
  '    case "watch_folder": other = 0; break;',
  '    case "default_folder": other = 1; break;',
  '    case "other": other = rowOverride.value.trim(); break;',
  '  }',
  '  return folders;',
  '};',
  'for (const folder in pref.future_folders) { addFutureFolder(folder, "default_folder", ""); }',
  'addFutureFolder();',
  'settings["future_folders"] = getFutureFolders();',
  '</script>'
].join('\n');
const structuredFacts=extractQbPreferencesNativeSurface({
  preferencesSource:structuredMarkup,
  toolbarSource:structuredToolbar,
  preferenceDescriptors:[{key:'future_folders',getterPresent:true,setterPresent:true,readType:'object',writeType:'object',typeAgreement:'EXACT',writable:true}]
});
const structuredPref=structuredFacts.preferences.future_folders;
assert.ok(structuredPref,'structured helper-return preference must bind to its source table without a key whitelist');
assert.equal(structuredPref.control.id,'futureFolders');
assert.equal(structuredPref.control.semantic,'structured');
assert.equal(structuredPref.control.structured.kind,'keyed-map');
assert.deepEqual(structuredPref.control.structured.columns.map(item=>item.source),['Monitored Folder','Override Save Location']);
assert.deepEqual(structuredPref.control.structured.modes.map(item=>({id:item.id,value:item.value,custom:item.custom===true})),[
  {id:'watch_folder',value:0,custom:false},
  {id:'default_folder',value:1,custom:false},
  {id:'other',value:undefined,custom:true}
]);
assert.equal(structuredPref.control.structured.defaultMode,'default_folder');
assert.deepEqual(structuredPref.projection,{kind:'identity',safeWrite:true},'source-proven object table serializer must admit exact object writeback');
assert.equal(structuredFacts.controlGraph.tabs.downloads.rows.flatMap(row=>row.items).find(item=>item.id==='futureFolders')?.preferenceKey,'future_folders','structured table must enter the same source-native Control Graph as ordinary preferences');
const structuredCompact=compileQbPreferencesCompact({schemaVersion:1,profiles:[{qbVersion:'9.9.9',sourceSha:'9999999999999999999999999999999999999999',manifest:structuredFacts}]});
assert.equal(structuredCompact.format.preference.at(-1),'structured','compact preference transport must explicitly own structured table metadata');
const structuredExpanded=expandQbPreferencesCompact(structuredCompact,'9.9.9');
assert.deepEqual(structuredExpanded.preferences.future_folders.control.structured,structuredPref.control.structured,'structured table metadata must survive compact roundtrip losslessly');

const legacyStructuredMarkup=structuredMarkup.replace('settings["future_folders"] = getFutureFolders();','settings.set("future_folders", getFutureFolders());');
const legacyStructuredFacts=extractQbPreferencesNativeSurface({
  preferencesSource:legacyStructuredMarkup,
  toolbarSource:structuredToolbar,
  preferenceDescriptors:[{key:'future_folders',getterPresent:true,setterPresent:true,readType:'object',writeType:'object',typeAgreement:'EXACT',writable:true}]
});
assert.equal(legacyStructuredFacts.preferences.future_folders?.control?.structured?.kind,'keyed-map','legacy settings.set serializer must compile into the same canonical structured metadata');
assert.deepEqual(legacyStructuredFacts.preferences.future_folders?.projection,{kind:'identity',safeWrite:true},'canonical structured metadata plus exact object getter/setter proof must admit legacy structured writeback without relying on legacy evidence names');

const structuredLocalCopyMarkup=structuredMarkup
  .replace('QBT_TR(Automatically add items from:)QBT_TR[CONTEXT=OptionsDialog]</legend>','QBT_TR(Hard Disk)QBT_TR[CONTEXT=OptionsDialog]</legend>')
  .replace('<table id="futureFolders">','QBT_TR(Automatically add items from:)QBT_TR[CONTEXT=OptionsDialog]<br><table id="futureFolders">');
const structuredLocalCopyFacts=extractQbPreferencesNativeSurface({
  preferencesSource:structuredLocalCopyMarkup,
  toolbarSource:structuredToolbar,
  preferenceDescriptors:[{key:'future_folders',getterPresent:true,setterPresent:true,readType:'object',writeType:'object',typeAgreement:'EXACT',writable:true}]
});
assert.deepEqual(structuredLocalCopyFacts.preferences.future_folders?.title,{source:'Automatically add items from:',context:'OptionsDialog'},'a bounded standalone copy immediately owning a structured table must outrank its broader fieldset legend');

const timePresentationToolbar='<li id="PrefSpeedLink">QBT_TR(Speed)QBT_TR[CONTEXT=OptionsDialog]</li>';
const timePresentationMarkup=[
  '<div id="SpeedTab" class="PrefTab"><div class="formRow">',
  '<label for="schedule_from_hour">QBT_TR(From:)QBT_TR[CONTEXT=OptionsDialog]</label>',
  '<input type="text" id="schedule_from_hour">:<input type="text" id="schedule_from_min">',
  '<label for="schedule_to_hour">QBT_TR(To:)QBT_TR[CONTEXT=OptionsDialog]</label>',
  '<input type="text" id="schedule_to_hour">:<input type="text" id="schedule_to_min">',
  '</div></div><script>',
  'const time_padding = (val) => {',
  '  let ret = val.toString();',
  '  if (ret.length === 1)',
  '    ret = `0${ret}`;',
  '  return ret;',
  '};',
  'document.getElementById("schedule_from_hour").value = time_padding(pref.schedule_from_hour);',
  'document.getElementById("schedule_from_min").value = time_padding(pref.schedule_from_min);',
  'document.getElementById("schedule_to_hour").value = time_padding(pref.schedule_to_hour);',
  'document.getElementById("schedule_to_min").value = time_padding(pref.schedule_to_min);',
  'settings["schedule_from_hour"] = Number(document.getElementById("schedule_from_hour").value);',
  'settings["schedule_from_min"] = Number(document.getElementById("schedule_from_min").value);',
  'settings["schedule_to_hour"] = Number(document.getElementById("schedule_to_hour").value);',
  'settings["schedule_to_min"] = Number(document.getElementById("schedule_to_min").value);',
  '</script>'
].join('\n');
const timeDescriptors=['schedule_from_hour','schedule_from_min','schedule_to_hour','schedule_to_min'].map(key=>({key,getterPresent:true,setterPresent:true,readType:'number',writeType:'number',typeAgreement:'EXACT',writable:true}));
const timeFacts=extractQbPreferencesNativeSurface({preferencesSource:timePresentationMarkup,toolbarSource:timePresentationToolbar,preferenceDescriptors:timeDescriptors});
const timeRow=timeFacts.controlGraph.tabs.speed.rows.find(row=>row.family?.kind==='time-range');
assert.ok(timeRow,'four source-owned zero-padded controls with two bounded colon pairs must classify as a generic time-range family; rows='+JSON.stringify(timeFacts.controlGraph.tabs.speed.rows));
assert.equal(timeRow.family.display,'HH:mm');
assert.deepEqual(timeRow.family.from,{label:{source:'From:',context:'OptionsDialog'},hourPreference:'schedule_from_hour',minutePreference:'schedule_from_min'});
assert.deepEqual(timeRow.family.to,{label:{source:'To:',context:'OptionsDialog'},hourPreference:'schedule_to_hour',minutePreference:'schedule_to_min'});
const timeItems=timeRow.items.filter(item=>item.kind==='control');
for(const id of ['schedule_from_hour','schedule_from_min','schedule_to_hour','schedule_to_min']){
  assert.equal(timeItems.find(item=>item.id===id)?.displayFormat,'zero-pad-2',id+' must retain source-proven two-digit presentation without a key whitelist');
  assert.deepEqual(extractQbPreferenceValueProjection(timePresentationMarkup,id,id),{kind:'identity',safeWrite:true},id+' must prove zero-pad read + numeric write as a reversible source presentation');
}
const timeCompact=compileQbPreferencesCompact({schemaVersion:1,profiles:[{qbVersion:'9.9.9',sourceSha:'9999999999999999999999999999999999999999',manifest:timeFacts}]});
assert.equal(timeCompact.format.graph.row.at(-1),'family','compact Control Graph row transport must own semantic family metadata');
assert.ok(timeCompact.format.graph.families.includes('time-range'));
const timeExpanded=expandQbPreferencesCompact(timeCompact,'9.9.9');
const expandedTimeRow=timeExpanded.controlGraph.tabs.speed.rows.find(row=>row.family?.kind==='time-range');
assert.deepEqual(expandedTimeRow.family,timeRow.family,'time-range semantic family must survive compact roundtrip losslessly');
console.log('qB Preferences composite/value contract passed: sibling labels and switch bindings are censused independently, generic source-proven time-range rows survive compact transport, helper metadata is reviewed explicitly, inverse source scales are writable, and unproven transforms fail closed.');

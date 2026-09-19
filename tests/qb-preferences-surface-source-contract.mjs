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
    <div class="formRow"><input type="button" id="future_test_button" value="QBT_TR(Test future action)QBT_TR[CONTEXT=OptionsDialog]" onclick="qBittorrent.Preferences.testFuture();"></div>
    <div style="font-style: italic;">QBT_TR(Supported parameters (case sensitive):)QBT_TR[CONTEXT=OptionsDialog]
      <ul><li>QBT_TR(%N: Torrent name)QBT_TR[CONTEXT=OptionsDialog]</li><li>QBT_TR(%D: Save path)QBT_TR[CONTEXT=OptionsDialog]</li></ul>
      QBT_TR(Tip: quote parameters with spaces)QBT_TR[CONTEXT=OptionsDialog]
    </div>
  </fieldset>
</div>
<script>
  document.getElementById("locale_select").value = pref.locale;
  document.getElementById("future_gate").checked = pref.future_gate;
  document.getElementById("future_limit").value = pref.future_limit / 1024;
  settings["locale"] = document.getElementById("locale_select").value;
  settings["future_gate"] = document.getElementById("future_gate").checked;
  settings["future_limit"] = Number(document.getElementById("future_limit").value) * 1024;
const updateFutureHelper=()=>{const enabled=document.getElementById("future_gate").checked;document.getElementById("future_test_button").disabled=!enabled;};
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
const textNumericPreferences=preferences.replace('id="future_limit" type="number"','id="future_limit" type="text"');
const textNumericManifest=extractQbPreferencesNativeSurface({preferencesSource:textNumericPreferences,toolbarSource:toolbar,preferenceDescriptors:descriptors});
assert.equal(textNumericManifest.preferences.future_limit.control.semantic,'text','upstream numeric Preferences may use text inputs');
assert.deepEqual(textNumericManifest.preferences.future_limit.control.unit,{source:'KiB',context:'OptionsDialog'},'numeric descriptor + source scale must preserve immediate units even when upstream uses input type=text');
assert.equal(manifest.preferences.future_limit.descriptor.writeType,'number');
assert.deepEqual(manifest.preferences.future_limit.projection,{kind:'scale',scale:1024,safeWrite:true},'source-derived raw/UI unit conversion must stay attached to the preference fact');
assert.equal(manifest.preferences.future_limit.dependencies.gates[0].preferenceKey,'future_gate');
assert.equal(manifest.preferences.future_limit.dependencies.gates[0].handlers.onclick,'updateFutureGate();');
assert.deepEqual(manifest.tabs[1].preferences,['future_gate','future_limit'],'native preference order must follow upstream source order');
assert.equal(manifest.tabs[1].sections[0].title.source,'Future mode');


assert.equal(manifest.controlGraph.schemaVersion,1,'source extraction must emit a structural Control Graph alongside preference facts');
assert.equal(manifest.structuralCensus.complete,true,'every source control in admitted Settings tabs must be represented by the Control Graph');
assert.equal(manifest.controlGraph.tabs.futurenetwork.fieldsets[0].template,'nested-gated-fieldset','fieldset legend gates must remain structural graph nodes');
assert.deepEqual(manifest.controlGraph.tabs.futurenetwork.rows.find(row=>row.items.some(item=>item.preferenceKey==='future_limit')).items[0].condition,{kind:'truthy',key:'future_gate'},'fieldset gates must compile into declarative predicates');
const futureItems=manifest.controlGraph.tabs.futurenetwork.rows.flatMap(row=>row.items);
const futureHelper=futureItems.find(item=>item.kind==='helper'&&item.id==='future_test_button');
assert.ok(futureHelper,'input type=button must be represented as a source helper rather than a fake text control');
assert.equal(futureHelper.label.source,'Test future action');
assert.deepEqual(futureHelper.action,{kind:'source-helper',name:'testFuture'});
assert.deepEqual(futureHelper.condition,{kind:'truthy',key:'future_gate'},'helper disabled behavior must stay in the source graph');
const futureNote=futureItems.find(item=>item.kind==='content'&&item.contentKind==='note');
const futureList=futureItems.find(item=>item.kind==='content'&&item.contentKind==='list');
const futureHint=futureItems.find(item=>item.kind==='content'&&item.contentKind==='hint');
assert.equal(futureNote.label.source,'Supported parameters (case sensitive):','source note copy must survive the Control Graph');
assert.deepEqual(futureList.items.map(item=>item.source),['%N: Torrent name','%D: Save path'],'source list copy must survive without screenshot-key exceptions');
assert.equal(futureHint.label.source,'Tip: quote parameters with spaces','source trailing hint copy must survive the Control Graph');
assert.equal(manifest.structuralCensus.sourceContents,3);
assert.equal(manifest.structuralCensus.representedContents,3);
assert.equal(manifest.structuralCensus.sourceCopyNodes,3);
assert.equal(manifest.structuralCensus.representedCopyNodes,3);
assert.equal(manifest.structuralCensus.sourceActions,manifest.structuralCensus.sourceHelpers);
assert.equal(manifest.structuralCensus.representedActions,manifest.structuralCensus.representedHelpers);

const structuralToolbar='<menu><li id="PrefConnectionLink">QBT_TR(Connection)QBT_TR[CONTEXT=OptionsDialog]</li><li id="PrefSpeedLink">QBT_TR(Speed)QBT_TR[CONTEXT=OptionsDialog]</li><li id="PrefAdvancedLink">QBT_TR(Advanced)QBT_TR[CONTEXT=OptionsDialog]</li></menu>';
const structuralSource='<div id="ConnectionTab" class="PrefTab">'
+'<fieldset class="settings"><legend>QBT_TR(Listening Port)QBT_TR[CONTEXT=OptionsDialog]</legend><div class="formRow"><label for="portValue">QBT_TR(Port used for incoming connections:)QBT_TR[CONTEXT=OptionsDialog]</label><input type="text" id="portValue"><button type="button" onclick="qBittorrent.Preferences.generateRandomPort();">QBT_TR(Random)QBT_TR[CONTEXT=OptionsDialog]</button></div></fieldset>'
+'<fieldset class="settings"><legend>QBT_TR(Connections Limits)QBT_TR[CONTEXT=OptionsDialog]</legend><table><tbody><tr><td><input type="checkbox" id="maxConnectionsCheckbox" onclick="qBittorrent.Preferences.updateMaxConnecEnabled();"><label for="maxConnectionsCheckbox">QBT_TR(Global maximum number of connections:)QBT_TR[CONTEXT=OptionsDialog]</label></td><td><input type="text" id="maxConnectionsValue"></td></tr></tbody></table></fieldset>'
+'<fieldset class="settings"><legend>QBT_TR(Proxy Server)QBT_TR[CONTEXT=OptionsDialog]</legend><table><tbody><tr><td><label for="peer_proxy_type_select">QBT_TR(Type:)QBT_TR[CONTEXT=OptionsDialog]</label></td><td><select id="peer_proxy_type_select"><option value="None">QBT_TR((None))QBT_TR[CONTEXT=OptionsDialog]</option><option value="SOCKS4">SOCKS4</option><option value="SOCKS5">SOCKS5</option></select></td><td><label for="peer_proxy_host_text">QBT_TR(Host:)QBT_TR[CONTEXT=OptionsDialog]</label></td><td><input type="text" id="peer_proxy_host_text"></td></tr></tbody></table><fieldset class="settings"><legend><input type="checkbox" id="peer_proxy_auth_checkbox"><label for="peer_proxy_auth_checkbox">QBT_TR(Authentication)QBT_TR[CONTEXT=OptionsDialog]</label></legend><div class="formRow"><label for="peer_proxy_username_text">QBT_TR(Username:)QBT_TR[CONTEXT=OptionsDialog]</label><input type="text" id="peer_proxy_username_text"></div></fieldset></fieldset>'
+'</div>'
+'<div id="SpeedTab" class="PrefTab invisible"><fieldset class="settings"><legend><input type="checkbox" id="limitSchedulingCheckbox"><label for="limitSchedulingCheckbox">QBT_TR(Schedule the use of alternative rate limits)QBT_TR[CONTEXT=OptionsDialog]</label></legend><div class="formRow"><label id="fromLabel">QBT_TR(From:)QBT_TR[CONTEXT=OptionsDialog]</label><input type="text" id="schedule_from_hour" aria-labelledby="fromLabel">:<input type="text" id="schedule_from_min" aria-labelledby="fromLabel"><label id="toLabel">QBT_TR(To:)QBT_TR[CONTEXT=OptionsDialog]</label><input type="text" id="schedule_to_hour" aria-labelledby="toLabel">:<input type="text" id="schedule_to_min" aria-labelledby="toLabel"></div></fieldset></div>'
+'<div id="AdvancedTab" class="PrefTab invisible"><div class="formRow"><label for="sendBufferWatermarkFactor">QBT_TR(Send buffer watermark factor:)QBT_TR[CONTEXT=OptionsDialog]</label><input type="number" id="sendBufferWatermarkFactor">&nbsp;&nbsp;%</div></div>'
+'<script>'
+'document.getElementById("portValue").value=Number(pref.listen_port);const maxConnections=Number(pref.max_connec);if(maxConnections<=0){document.getElementById("maxConnectionsCheckbox").checked=false;document.getElementById("maxConnectionsValue").value=500;}else{document.getElementById("maxConnectionsCheckbox").checked=true;document.getElementById("maxConnectionsValue").value=maxConnections;}document.getElementById("peer_proxy_type_select").value=pref.proxy_type;document.getElementById("peer_proxy_host_text").value=pref.proxy_ip;document.getElementById("peer_proxy_auth_checkbox").checked=pref.proxy_auth_enabled;document.getElementById("peer_proxy_username_text").value=pref.proxy_username;document.getElementById("limitSchedulingCheckbox").checked=pref.scheduler_enabled;document.getElementById("schedule_from_hour").value=pref.schedule_from_hour;document.getElementById("schedule_from_min").value=pref.schedule_from_min;document.getElementById("schedule_to_hour").value=pref.schedule_to_hour;document.getElementById("schedule_to_min").value=pref.schedule_to_min;document.getElementById("sendBufferWatermarkFactor").value=pref.send_buffer_watermark_factor;'
+'settings["listen_port"]=Number(document.getElementById("portValue").value);let maxConnectionsWrite=-1;if(document.getElementById("maxConnectionsCheckbox").checked){maxConnectionsWrite=Number(document.getElementById("maxConnectionsValue").value);}settings["max_connec"]=maxConnectionsWrite;settings["proxy_type"]=document.getElementById("peer_proxy_type_select").value;settings["proxy_ip"]=document.getElementById("peer_proxy_host_text").value;settings["proxy_auth_enabled"]=document.getElementById("peer_proxy_auth_checkbox").checked;settings["proxy_username"]=document.getElementById("peer_proxy_username_text").value;settings["scheduler_enabled"]=document.getElementById("limitSchedulingCheckbox").checked;settings["schedule_from_hour"]=Number(document.getElementById("schedule_from_hour").value);settings["schedule_from_min"]=Number(document.getElementById("schedule_from_min").value);settings["schedule_to_hour"]=Number(document.getElementById("schedule_to_hour").value);settings["schedule_to_min"]=Number(document.getElementById("schedule_to_min").value);settings["send_buffer_watermark_factor"]=Number(document.getElementById("sendBufferWatermarkFactor").value);'
+'const updateMaxConnecEnabled=()=>{const enabled=document.getElementById("maxConnectionsCheckbox").checked;document.getElementById("maxConnectionsValue").disabled=!enabled;};'
+'const updatePeerProxySettings=()=>{const proxyType=document.getElementById("peer_proxy_type_select").value;const isProxyDisabled=(proxyType==="None");const isProxySocks4=(proxyType==="SOCKS4");document.getElementById("peer_proxy_host_text").disabled=isProxyDisabled;document.getElementById("peer_proxy_auth_checkbox").disabled=(isProxyDisabled||isProxySocks4);};'
+'const updatePeerProxyAuthSettings=()=>{const proxyType=document.getElementById("peer_proxy_type_select").value;const isProxyDisabled=(proxyType==="None");const authEnabled=(!document.getElementById("peer_proxy_auth_checkbox").disabled&&document.getElementById("peer_proxy_auth_checkbox").checked);document.getElementById("peer_proxy_username_text").disabled=(isProxyDisabled||!authEnabled);};'
+'const updateSchedulingEnabled=()=>{const enabled=document.getElementById("limitSchedulingCheckbox").checked;document.getElementById("schedule_from_hour").disabled=!enabled;document.getElementById("schedule_from_min").disabled=!enabled;document.getElementById("schedule_to_hour").disabled=!enabled;document.getElementById("schedule_to_min").disabled=!enabled;};'
+'const generateRandomPort=()=>{const buffer=new Uint16Array(1);let port=crypto.getRandomValues(buffer)[0];while(port<1024)port=crypto.getRandomValues(buffer)[0];document.getElementById("portValue").value=port;};'
+'</script>';
const structuralDescriptors=[
  ['listen_port','number'],['max_connec','number'],['proxy_type','string'],['proxy_ip','string'],['proxy_auth_enabled','boolean'],['proxy_username','string'],
  ['scheduler_enabled','boolean'],['schedule_from_hour','number'],['schedule_from_min','number'],['schedule_to_hour','number'],['schedule_to_min','number'],['send_buffer_watermark_factor','number']
].map(([key,type])=>({key,getterPresent:true,setterPresent:true,readType:type,writeType:type,typeAgreement:'EXACT',writable:true}));
const structural=extractQbPreferencesNativeSurface({preferencesSource:structuralSource,toolbarSource:structuralToolbar,preferenceDescriptors:structuralDescriptors});
const structuralTabs=Object.values(structural.controlGraph.tabs),structuralRows=structuralTabs.flatMap(tab=>tab.rows),structuralControls=structuralRows.flatMap(row=>row.items).concat(structuralTabs.flatMap(tab=>tab.fieldsets.flatMap(field=>field.legendControls||[]))),rowFor=key=>structuralRows.find(row=>row.items.some(item=>item.preferenceKey===key)),itemFor=key=>structuralControls.find(item=>item.preferenceKey===key);
assert.equal(structural.structuralCensus.complete,true,'structural source census must account for controls, helpers, adornments and behavior targets independently of preference mapping');
assert.equal(structural.structuralCensus.sourceControls,structural.structuralCensus.representedControls);
assert.equal(structural.structuralCensus.sourceHelpers,structural.structuralCensus.representedHelpers);
assert.equal(structural.structuralCensus.sourceActions,structural.structuralCensus.representedActions);
assert.equal(structural.structuralCensus.sourceCopyNodes,structural.structuralCensus.representedCopyNodes);
assert.equal(structural.structuralCensus.sourceAdornments,structural.structuralCensus.representedAdornments);
assert.equal(structural.structuralCensus.behaviorControls,structural.structuralCensus.representedBehaviorControls);
assert.equal(rowFor('listen_port').template,'control-helper','Listening Port + Random must be represented as a generic control/helper row');
assert.deepEqual(rowFor('listen_port').items.find(item=>item.kind==='helper').action,{kind:'random-int',targetControlId:'portValue',min:1024,max:65535},'source helper behavior must compile to bounded random-int IR instead of arbitrary upstream JS execution');
assert.equal(rowFor('max_connec').template,'gated-sentinel','unmapped native gate + mapped value must preserve the generic sentinel row shape');
assert.deepEqual(structural.preferences.max_connec.projection,{kind:'sentinel-gate',gateControlId:'maxConnectionsCheckbox',disabledValue:-1,defaultValue:500,enabledWhen:{kind:'gt',value:0},safeWrite:true},'auxiliary checkbox ownership must be source-proven by the same Preference sentinel projection');
assert.deepEqual(itemFor('max_connec').condition,{kind:'gt',key:'max_connec',value:0},'sentinel gate behavior must resolve against the proven raw Preference threshold instead of checkbox truthiness');
assert.equal(rowFor('schedule_from_hour').template,'inline-multi-control','same source row must stay one inline multi-control cluster');
assert.equal(structural.controlGraph.tabs.speed.rows.some(row=>row.items.some(item=>item.id==='limitSchedulingCheckbox')),false,'legend-owned gate controls must not be duplicated as standalone rows');
assert.deepEqual(rowFor('schedule_from_hour').items.filter(item=>item.preferenceKey).map(item=>item.preferenceKey),['schedule_from_hour','schedule_from_min','schedule_to_hour','schedule_to_min']);
assert.deepEqual(rowFor('schedule_from_hour').items.filter(item=>item.preferenceKey).map(item=>item.suffix&&item.suffix.literal),[':',null,':',null],'time-range punctuation must stay source-owned instead of being reconstructed from preference names');
const speedScheduleField=structural.controlGraph.tabs.speed.fieldsets.find(field=>field.legendControls.some(control=>control.preferenceKey==='scheduler_enabled'));
const speedScheduleRow=rowFor('schedule_from_hour');
assert.ok(Number.isInteger(speedScheduleField.sourceOrder)&&Number.isInteger(speedScheduleRow.sourceOrder),'fieldset/row source order must be explicit structural data');
assert.deepEqual(itemFor('proxy_ip').condition,{kind:'notEquals',key:'proxy_type',value:'None'},'source disabled expressions must compile to a declarative proxy predicate');
assert.deepEqual(itemFor('proxy_auth_enabled').condition,{kind:'allOf',items:[{kind:'notEquals',key:'proxy_type',value:'None'},{kind:'notEquals',key:'proxy_type',value:'SOCKS4'}]},'compound proxy conditions must preserve exact source behavior without key-specific runtime code');
assert.deepEqual(structural.preferences.send_buffer_watermark_factor.control.unit,{literal:'%'},'display adornments must be source-owned even when they are not tied to a numeric scale projection');
assert.equal(structural.preferences.proxy_type.control.unit,undefined,'select option copy must never be misclassified as a control adornment');

const presenceGateSource=`
if (pref.export_dir !== "") {
  document.getElementById("exportdir_checkbox").checked = true;
  document.getElementById("exportdir_text").value = pref.export_dir;
}
else {
  document.getElementById("exportdir_checkbox").checked = false;
  document.getElementById("exportdir_text").value = "";
}
if (document.getElementById("exportdir_checkbox").checked)
  settings["export_dir"] = document.getElementById("exportdir_text").value;
else
  settings["export_dir"] = "";
`;
assert.deepEqual(
  extractQbPreferenceValueProjection(presenceGateSource,'export_dir','exportdir_text'),
  {kind:'presence-gate',gateControlId:'exportdir_checkbox',disabledValue:'',enabledWhen:{kind:'non-empty'},safeWrite:true},
  'empty-string/presence Preferences must compile a generic auxiliary gate projection from exact read+write source'
);
const legacyPresenceGateSource=`
if (pref.export_dir != '') {
  $('exportdir_checkbox').setProperty('checked', true);
  $('exportdir_text').setProperty('value', pref.export_dir);
}
else {
  $('exportdir_checkbox').setProperty('checked', false);
  $('exportdir_text').setProperty('value', '');
}
if ($('exportdir_checkbox').getProperty('checked'))
  settings.set('export_dir', $('exportdir_text').getProperty('value'));
else
  settings.set('export_dir', '');
`;
assert.deepEqual(
  extractQbPreferenceValueProjection(legacyPresenceGateSource,'export_dir','exportdir_text'),
  {kind:'presence-gate',gateControlId:'exportdir_checkbox',disabledValue:'',enabledWhen:{kind:'non-empty'},safeWrite:true},
  'presence gate proof must cover the admitted legacy qB syntax without a version-specific whitelist'
);

const behaviorToolbar='<menu><li id="PrefBehaviorLink">QBT_TR(Behavior)QBT_TR[CONTEXT=OptionsDialog]</li></menu>';
const behaviorSource='<div id="BehaviorTab" class="PrefTab"><fieldset class="settings"><legend><input type="checkbox" id="filelog_checkbox"><label for="filelog_checkbox">QBT_TR(Log Files)QBT_TR[CONTEXT=OptionsDialog]</label></legend><div class="formRow"><input type="checkbox" id="filelog_backup_checkbox"><label for="filelog_backup_checkbox">QBT_TR(Backup)QBT_TR[CONTEXT=OptionsDialog]</label><input type="number" id="filelog_max_size_input"></div></fieldset></div><script>'
+'document.getElementById("filelog_checkbox").checked=pref.file_log_enabled;document.getElementById("filelog_backup_checkbox").checked=pref.file_log_backup_enabled;document.getElementById("filelog_max_size_input").value=pref.file_log_max_size;'
+'settings["file_log_enabled"]=document.getElementById("filelog_checkbox").checked;settings["file_log_backup_enabled"]=document.getElementById("filelog_backup_checkbox").checked;settings["file_log_max_size"]=Number(document.getElementById("filelog_max_size_input").value);'
+'const updateFileLogEnabled=()=>{const enabled=document.getElementById("filelog_checkbox").checked;document.getElementById("filelog_backup_checkbox").disabled=!enabled;};'
+'const updateFileLogBackupEnabled=()=>{const pros=document.getElementById("filelog_backup_checkbox").getProperties("disabled","checked");document.getElementById("filelog_max_size_input").disabled=pros.disabled||!pros.checked;};'
+'</script>';
const behaviorDescriptors=[['file_log_enabled','boolean'],['file_log_backup_enabled','boolean'],['file_log_max_size','number']].map(([key,type])=>({key,getterPresent:true,setterPresent:true,readType:type,writeType:type,typeAgreement:'EXACT',writable:true}));
const behaviorManifest=extractQbPreferencesNativeSurface({preferencesSource:behaviorSource,toolbarSource:behaviorToolbar,preferenceDescriptors:behaviorDescriptors});
const behaviorItems=behaviorManifest.controlGraph.tabs.behavior.rows.flatMap(row=>row.items).concat(behaviorManifest.controlGraph.tabs.behavior.fieldsets.flatMap(field=>field.legendControls||[]));
assert.deepEqual(behaviorItems.find(item=>item.preferenceKey==='file_log_max_size').condition,{kind:'allOf',items:[{kind:'truthy',key:'file_log_enabled'},{kind:'truthy',key:'file_log_backup_enabled'}]},'getProperties(disabled, checked) chains must compile into nested declarative predicates');
assert.equal(behaviorManifest.structuralCensus.complete,true,'resolved nested source predicates must keep the structural census complete');
const unknownBehaviorSource=behaviorSource.replace('pros.disabled||!pros.checked','runtimeMystery(pros)');
const unknownBehaviorManifest=extractQbPreferencesNativeSurface({preferencesSource:unknownBehaviorSource,toolbarSource:behaviorToolbar,preferenceDescriptors:behaviorDescriptors});
assert.equal(unknownBehaviorManifest.structuralCensus.complete,false,'any unresolved source behavior must fail structural completeness instead of false-green');
assert.ok(unknownBehaviorManifest.structuralCensus.unknownBehaviors.includes('filelog_max_size_input'),'unresolved behavior target must be named in the census');

const dollarIdentitySource=`
$("direct_value").value = pref.direct_value;
settings["direct_value"] = $("direct_value").value;
`;
assert.deepEqual(
  extractQbPreferenceValueProjection(dollarIdentitySource,'direct_value','direct_value'),
  {kind:'identity',safeWrite:true},
  'MooTools direct value properties must remain source-proven identity projections'
);

const dollarSentinelSource=`
const max_connec = Number(pref.max_connec);
if (max_connec <= 0) {
  $("max_connec_checkbox").checked = false;
  $("max_connec_value").value = 500;
}
else {
  $("max_connec_checkbox").checked = true;
  $("max_connec_value").value = max_connec;
}
let max_connec = -1;
if ($("max_connec_checkbox").checked) {
  max_connec = Number($("max_connec_value").value);
}
settings["max_connec"] = max_connec;
`;
assert.deepEqual(
  extractQbPreferenceValueProjection(dollarSentinelSource,'max_connec','max_connec_value'),
  {kind:'sentinel-gate',gateControlId:'max_connec_checkbox',disabledValue:-1,defaultValue:500,enabledWhen:{kind:'gt',value:0},safeWrite:true},
  'MooTools direct checked/value syntax must prove modern sentinel gates without a version whitelist'
);

const legacyScaledSentinelSource=`
var up_limit = pref.up_limit.toInt() / 1024;
if (up_limit <= 0) {
  $('up_limit_checkbox').setProperty('checked', false);
}
else {
  $('up_limit_checkbox').setProperty('checked', true);
  $('up_limit_value').setProperty('value', up_limit);
}
var up_limit = -1;
if ($('up_limit_checkbox').getProperty('checked')) {
  up_limit = $('up_limit_value').getProperty('value').toInt() * 1024;
}
settings.set('up_limit', up_limit);
`;
assert.deepEqual(
  extractQbPreferenceValueProjection(legacyScaledSentinelSource,'up_limit','up_limit_value'),
  {kind:'sentinel-gate',gateControlId:'up_limit_checkbox',disabledValue:-1,defaultValue:null,enabledWhen:{kind:'gt',value:0},safeWrite:true,scale:1024},
  'legacy scaled sentinel gates must preserve raw threshold + UI scale without inventing an enable default'
);

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
assert.ok(Array.isArray(compact.graphStrings)&&compact.graphs?.futurenetwork,'compact contract must carry interned Control Graph transport');
assert.deepEqual(expanded.controlGraph.tabs.futurenetwork,manifest.controlGraph.tabs.futurenetwork,'compact expansion must losslessly restore structural rows/fieldsets/helper/content/predicate facts');
const changed=structuredClone(manifest);changed.preferences.future_limit.control.attributes.max='10000';
const compactChanged=compileQbPreferencesCompact({schemaVersion:1,profiles:[sourceCatalog.profiles[0],{qbVersion:'5.2.4',sourceSha:'2222222222222222222222222222222222222222',manifest:changed}]});
assert.equal(compactChanged.preferences.future_limit.length,2,'one preference change must create one keyed change point instead of duplicating every other native setting');
assert.equal(compactChanged.preferences.locale.length,1,'unrelated native preferences must remain deduplicated');

const runtimeSettings=readSettingsRuntime();
assert.equal(runtimeSettings.settingsData.schemaVersion,2,'formal Settings runtime must consume the source-native compact schema');
assert.equal(runtimeSettings.settingsData.source,'qb-upstream-preferences-native-surface-compact','formal Settings runtime must not rebuild a legacy descriptor/nativeTabs shape');
assert.equal(runtimeSettings.settingsData.catalogIdentity.releaseCount,65,'formal Settings runtime must remain bound to the admitted Frozen release set');
assert.equal(runtimeSettings.manifest.payload.sha256,'41c60f301eb419b5bb9b861737884be85f62e248528867cb472229c561226f9e','formal Settings runtime must consume the accepted exact source-native IR');
assert.equal(Object.prototype.hasOwnProperty.call(runtimeSettings.settingsData,'nativeTabs'),false,'legacy runtime-generated nativeTabs truth must stay retired');

const transportManifest=structuredClone(manifest);
transportManifest.controlGraph.tabs.futurenetwork.rows[0].items.push({kind:'helper',id:'source-action-helper',role:'helper',label:{literal:'Rules'},action:{kind:'source-action',owner:'Rss',name:'openRssDownloader'},condition:null});
transportManifest.controlGraph.tabs.futurenetwork.rows[0].items.push({kind:'control',id:'dynamic-select',preferenceKey:null,role:'auxiliary',semantic:'select',staticDisabled:false,label:{literal:'Interface'},adornment:null,suffix:null,condition:null,dynamicOptions:{kind:'api-options',endpoint:'app/networkInterfaceList',responseShape:'object-array',labelField:'name',valueField:'value',queryParam:null,dependsOnControlId:null,staticOptions:[]},writeOnly:{key:'secret',writeType:'string',safeWrite:true,omitEmpty:true}});
const transportCompact=compileQbPreferencesCompact({schemaVersion:1,profiles:[{qbVersion:'5.2.3',sourceSha:'3333333333333333333333333333333333333333',manifest:transportManifest}]});
const transportExpanded=expandQbPreferencesCompact(transportCompact,'5.2.3');
const transported=transportExpanded.controlGraph.tabs.futurenetwork.rows.flatMap(row=>row.items);
assert.deepEqual(transported.find(item=>item.id==='source-action-helper').action,{kind:'source-action',owner:'Rss',name:'openRssDownloader'},'compact IR must preserve bounded source actions');
assert.equal(transported.find(item=>item.id==='dynamic-select').dynamicOptions.endpoint,'app/networkInterfaceList','compact IR must preserve dynamic option provenance');
assert.equal(transported.find(item=>item.id==='dynamic-select').writeOnly.key,'secret','compact IR must preserve write-only control provenance');

console.log('qB Preferences native source contract passed: future tabs auto-admit through source extraction/compact IR; formal browser runtime consumes the accepted source-native envelope without rebuilding a second Settings truth.');

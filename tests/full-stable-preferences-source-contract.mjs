import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {compileQbPreferencesCompact,expandQbPreferencesCompact} from '../tools/qb-preferences-compact.mjs';
import {assertCatalogIdentity,catalogIdentity} from '../tools/qb-catalog-identity.mjs';
import {buildQbPreferencesCensus} from '../tools/qb-preferences-census-source.mjs';

const sourcePath=path.resolve(process.argv[2]||'qb-preferences-source-catalog.json');
const catalogPath=path.resolve(process.argv[3]||'qb-releases.json');
const qbRoot=path.resolve(process.argv[4]||process.env.QB_UPSTREAM_DIR||'upstream-qb');
assert.ok(fs.existsSync(sourcePath),`missing Preferences source catalog: ${sourcePath}`);
assert.ok(fs.existsSync(catalogPath),`missing exact qB release catalog: ${catalogPath}`);
assert.ok(fs.existsSync(qbRoot),`missing exact qB upstream checkout for independent Preferences census: ${qbRoot}`);
const source=JSON.parse(fs.readFileSync(sourcePath,'utf8')),catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),expectedIdentity=catalogIdentity(catalog);
assert.equal(source.schemaVersion,1);
assert.equal(source.source,'qb-upstream-preferences-native-surface');
assert.ok(Array.isArray(source.profiles)&&source.profiles.length>0);
assert.equal(source.profiles.length,catalog.length,'Preferences source admission must cover every admitted stable qB release');

const census=buildQbPreferencesCensus(catalog,source,qbRoot);
assert.equal(census.schemaVersion,1,'Preferences independent census schema drift');
assert.equal(census.source,'qb-upstream-preferences-independent-census','Preferences independent census source identity drift');
assertCatalogIdentity(census.catalogIdentity,expectedIdentity,'Preferences independent census Frozen catalog identity');
assert.equal(census.profiles.length,source.profiles.length,'Preferences census/source release-set size drift');
fs.writeFileSync(path.resolve(process.env.QB_PREFERENCES_CENSUS_OUTPUT||'qb-preferences-census.json'),JSON.stringify(census,null,2)+'\n','utf8');
function censusProblem(result){
  if(result?.complete)return'';
  const parts=[];
  if(result?.unaccounted?.length)parts.push(`unaccounted=${result.unaccounted.join(',')}`);
  if(result?.overlap?.length)parts.push(`mapped/excluded overlap=${result.overlap.join(',')}`);
  if(result?.escaped?.length)parts.push(`escaped=${result.escaped.join(',')}`);
  for(const kind of ['inventory','mapped','excluded'])if(result?.duplicates?.[kind]?.length)parts.push(`duplicate ${kind}=${result.duplicates[kind].join(',')}`);
  return parts.join('; ')||'unknown accounting failure';
}
const censusFailures=[];
for(let i=0;i<census.profiles.length;i++){
  const profile=census.profiles[i],semantic=source.profiles[i];
  assert.equal(profile.qbVersion,semantic.qbVersion,`${semantic.qbVersion}: independent census release order drift`);
  assert.equal(profile.sourceSha,semantic.sourceSha,`${semantic.qbVersion}: independent census source SHA drift`);
  for(const domain of ['tabs','preferences','bindings']){
    const result=profile.census?.[domain];
    if(!result?.complete)censusFailures.push(`${profile.qbVersion} ${domain}: ${censusProblem(result)}`);
  }
}
assert.equal(censusFailures.length,0,`Preferences independent source census is incomplete across the Frozen release set:\n${censusFailures.join('\n')}`);

let previousRatio=null,minimumRatio=1,scaleProjectionCount=0,switchProjectionCount=0,sentinelProjectionCount=0,presenceProjectionCount=0,unprovenProjectionCount=0;
for(let i=0;i<catalog.length;i++){
  const base=catalog[i],profile=source.profiles[i];
  assert.equal(profile.qbVersion,base.qbVersion,`${base.qbVersion}: release order drift`);
  assert.equal(profile.sourceSha,base.sourceSha,`${base.qbVersion}: source SHA drift`);
  assert.match(String(profile.sourceSha||''),/^[0-9a-f]{40}$/i,`${base.qbVersion}: exact source SHA missing`);
  const manifest=profile.manifest||{};
  assert.ok(Array.isArray(manifest.tabs)&&manifest.tabs.length>0,`${base.qbVersion}: native Settings tabs unresolved`);
  assert.ok(manifest.preferences&&typeof manifest.preferences==='object',`${base.qbVersion}: native preference map unresolved`);
  assert.equal(manifest.controlGraph?.schemaVersion,1,base.qbVersion+': structural Control Graph missing');
  assert.equal(manifest.structuralCensus?.complete,true,base.qbVersion+': structural source census incomplete');
  assert.equal(manifest.structuralCensus.sourceControls,manifest.structuralCensus.representedControls,base.qbVersion+': source control coverage drift');
  assert.equal(manifest.structuralCensus.sourceHelpers,manifest.structuralCensus.representedHelpers,base.qbVersion+': source helper coverage drift');
  assert.equal(manifest.structuralCensus.sourceActions,manifest.structuralCensus.representedActions,base.qbVersion+': source action coverage drift');
  assert.equal(manifest.structuralCensus.sourceContents,manifest.structuralCensus.representedContents,base.qbVersion+': source content coverage drift');
  assert.equal(manifest.structuralCensus.sourceCopyNodes,manifest.structuralCensus.representedCopyNodes,base.qbVersion+': source copy coverage drift');
  assert.equal(manifest.structuralCensus.sourceAdornments,manifest.structuralCensus.representedAdornments,base.qbVersion+': source adornment coverage drift');
  assert.equal(manifest.structuralCensus.behaviorControls,manifest.structuralCensus.representedBehaviorControls,base.qbVersion+': source behavior coverage drift');
  assert.deepEqual(manifest.structuralCensus.unknownBehaviors,[],base.qbVersion+': runtime-relevant source behavior must not remain unknown in a structurally complete profile');
  assert.ok(Number(manifest.mappedPreferences)>0,`${base.qbVersion}: no source-mapped native preferences`);
  assert.equal(Number(manifest.totalPreferences),Array.isArray(base.preferenceDescriptors)?base.preferenceDescriptors.length:0,`${base.qbVersion}: preference surface size drift`);
  const total=Number(manifest.totalPreferences)||0,mapped=Number(manifest.mappedPreferences)||0,ratio=total?mapped/total:0;
  assert.ok(ratio>=0.60,`${base.qbVersion}: native Preferences source mapping collapsed to ${mapped}/${total} (${(ratio*100).toFixed(1)}%); source syntax must be admitted before runtime use`);
  if(previousRatio!==null)assert.ok(previousRatio-ratio<=0.20,`${base.qbVersion}: native Preferences mapping dropped ${(100*(previousRatio-ratio)).toFixed(1)} percentage points from the previous stable release`);
  previousRatio=ratio;minimumRatio=Math.min(minimumRatio,ratio);
  const allowed=new Set((base.preferenceDescriptors||[]).map(item=>String(item?.key||'')));
  for(const tab of manifest.tabs){
    assert.equal(typeof tab.id,'string');assert.ok(tab.id);assert.ok(Number.isInteger(tab.order));
    let previous=-1;
    for(const key of tab.preferences||[]){const item=manifest.preferences[key];assert.ok(item,`${base.qbVersion}: tab ${tab.id} references missing ${key}`);assert.ok(allowed.has(key),`${base.qbVersion}: native manifest escaped app/preferences: ${key}`);assert.equal(item.tab,tab.id);assert.ok(item.order>previous,`${base.qbVersion}: ${tab.id} preference order is not source monotonic`);previous=item.order;assert.ok(item.title?.source&&item.title?.context,`${base.qbVersion}: ${key} lacks source/context title identity`);assert.ok(item.control?.id&&item.control?.semantic,`${base.qbVersion}: ${key} lacks native control semantics`);assert.ok(item.descriptor&&Object.prototype.hasOwnProperty.call(item.descriptor,'writable'),`${base.qbVersion}: ${key} lacks API read/write provenance`);assert.ok(item.projection&&typeof item.projection==='object'&&typeof item.projection.safeWrite==='boolean',`${base.qbVersion}: ${key} lacks source value-projection accounting`);if(item.projection.kind==='scale')scaleProjectionCount+=1;else if(item.projection.kind==='switch-map')switchProjectionCount+=1;else if(item.projection.kind==='sentinel-gate')sentinelProjectionCount+=1;else if(item.projection.kind==='presence-gate')presenceProjectionCount+=1;else if(item.projection.kind==='unproven')unprovenProjectionCount+=1;if(item.control.semantic==='select')for(const option of item.control.options||[])assert.ok(option.label&&(option.label.source||Object.prototype.hasOwnProperty.call(option.label,'literal')),`${base.qbVersion}: ${key} select option lacks source identity`);}
  }
}
assert.ok(scaleProjectionCount>0,'Frozen Preferences source must prove at least one native raw/UI numeric scale instead of relying on manual runtime metadata');
assert.ok(switchProjectionCount>0,'Frozen Preferences source must retain at least one historical switch-map composite projection');
assert.ok(presenceProjectionCount>0,'Frozen Preferences source must prove at least one empty-string/presence gate instead of requiring a Downloads key exception');
const legacyRandomManifest=source.profiles.find(profile=>profile.qbVersion==='4.1.9.1')?.manifest;
const legacyRandomRows=Object.values(legacyRandomManifest?.controlGraph?.tabs||{}).flatMap(tab=>tab.rows||[]);
const legacyListeningRow=legacyRandomRows.find(row=>(row.items||[]).some(item=>item.preferenceKey==='listen_port'));
assert.equal(legacyListeningRow?.template,'control-helper','qB 4.1.9.1 Listening Port must preserve its source helper sibling');
assert.deepEqual(legacyListeningRow?.items?.find(item=>item.kind==='helper')?.action,{kind:'random-int',targetControlId:'port_value',min:1024,max:65535},'qB 4.1.9.1 Math.random/MooTools helper must compile to the same bounded random-int IR without helper-name special casing');
const latestManifest=source.profiles.at(-1).manifest;
const latestRows=Object.values(latestManifest.controlGraph.tabs||{}).flatMap(tab=>tab.rows||[]);
const latestRowFor=key=>latestRows.find(row=>(row.items||[]).some(item=>item.preferenceKey===key));
const latestControls=latestRows.flatMap(row=>row.items||[]).concat(Object.values(latestManifest.controlGraph.tabs||{}).flatMap(tab=>(tab.fieldsets||[]).flatMap(field=>field.legendControls||[]))),latestItemFor=key=>latestControls.find(item=>item.preferenceKey===key);
const latestContent=latestRows.flatMap(row=>row.items||[]).filter(item=>item.kind==='content');
const latestSupportedNote=latestContent.find(item=>item.contentKind==='note'&&item.label?.source==='Supported parameters (case sensitive):');
const latestParameterList=latestContent.find(item=>item.contentKind==='list'&&(item.items||[]).some(ref=>ref?.source==='%N: Torrent name'));
const latestParameterHint=latestContent.find(item=>item.contentKind==='hint'&&String(item.label?.source||'').startsWith('Tip: Encapsulate parameter'));
assert.ok(latestSupportedNote,'latest Run external program source note must be present in the Control Graph');
assert.ok((latestParameterList?.items||[]).length>=10,'latest Run external program source parameter list must retain upstream entries');
assert.ok(latestParameterHint,'latest Run external program trailing source hint must be retained');
const listeningRow=latestRowFor('listen_port');
assert.equal(listeningRow?.template,'control-helper','latest Listening Port must preserve the source helper sibling');
assert.deepEqual(listeningRow?.items?.find(item=>item.kind==='helper')?.action,{kind:'random-int',targetControlId:'portValue',min:1024,max:65535},'latest Random helper must compile exact bounded helper semantics');
assert.equal(latestRowFor('max_connec')?.template,'gated-sentinel','latest connection limit must preserve the checkbox/sentinel row shape');
for(const [tabId,graphTab] of Object.entries(latestManifest.controlGraph.tabs||{})){
  const legendIds=new Set((graphTab.fieldsets||[]).flatMap(field=>(field.legendControls||[]).map(control=>control.id)));
  const duplicateRows=(graphTab.rows||[]).flatMap(row=>(row.items||[]).filter(item=>item.kind==='control'&&legendIds.has(item.id)).map(item=>item.id));
  assert.deepEqual(duplicateRows,[],'latest '+tabId+': legend-owned controls must have exactly one structural placement');
}

for(const [key,gate,defaultValue] of [
  ['max_connec','maxConnectionsCheckbox',500],
  ['max_connec_per_torrent','maxConnectionsPerTorrentCheckbox',100],
  ['max_uploads','maxUploadsCheckbox',8],
  ['max_uploads_per_torrent','maxUploadsPerTorrentCheckbox',4]
]){
  assert.deepEqual(latestManifest.preferences[key]?.projection,{kind:'sentinel-gate',gateControlId:gate,disabledValue:-1,defaultValue,enabledWhen:{kind:'gt',value:0},safeWrite:true},'latest '+key+' sentinel UI/value projection must be source-proven and generic');
}

const scheduleRow=latestRowFor('schedule_from_hour');
assert.equal(scheduleRow?.template,'inline-multi-control','latest scheduler range must stay one source row');
assert.deepEqual((scheduleRow?.items||[]).filter(item=>item.preferenceKey).map(item=>item.preferenceKey),['schedule_from_hour','schedule_from_min','schedule_to_hour','schedule_to_min'],'latest scheduler range controls must preserve source order');
assert.deepEqual((scheduleRow?.items||[]).filter(item=>item.preferenceKey).map(item=>item.suffix?.literal||null),[':',null,':',null],'latest scheduler range punctuation must remain source-owned');
for(const [tabId,graphTab] of Object.entries(latestManifest.controlGraph.tabs||{})){
  for(const parentId of [null,...graphTab.fieldsets.map(field=>field.id)]){
    const orders=[...graphTab.fieldsets.filter(field=>field.parentId===parentId),...graphTab.rows.filter(row=>row.parentFieldsetId===parentId)].map(node=>node.sourceOrder).sort((a,b)=>a-b);
    assert.deepEqual(orders,orders.map((_value,index)=>index),'latest '+tabId+': parent-local Control Graph source order must be contiguous and deterministic');
  }
}

assert.deepEqual(latestItemFor('proxy_ip')?.condition,{kind:'notEquals',key:'proxy_type',value:'None'},'latest proxy host gate must be source-derived');
assert.deepEqual(latestItemFor('proxy_auth_enabled')?.condition,{kind:'allOf',items:[{kind:'notEquals',key:'proxy_type',value:'None'},{kind:'notEquals',key:'proxy_type',value:'SOCKS4'}]},'latest proxy authentication gate must preserve compound source behavior');
assert.deepEqual(latestManifest.preferences.send_buffer_watermark?.control?.unit,{source:'KiB',context:'OptionsDialog'},'latest send buffer watermark must retain KiB adornment');
assert.deepEqual(latestManifest.preferences.send_buffer_watermark_factor?.control?.unit,{literal:'%'},'latest send buffer watermark factor must retain percent adornment');
assert.deepEqual(latestManifest.preferences.checking_memory_use?.control?.unit,{source:'MiB',context:'OptionsDialog'},'latest checking-memory control must retain MiB adornment');
assert.deepEqual(latestManifest.preferences.refresh_interval?.control?.unit,{source:'ms',context:'OptionsDialog'},'latest refresh interval must retain the native millisecond adornment');

assert.deepEqual(latestManifest.preferences.dl_limit?.projection,{kind:'scale',scale:1024,safeWrite:true},'latest native download limit must source-prove bytes/s ↔ KiB/s projection');
assert.deepEqual(latestManifest.preferences.torrent_file_size_limit?.projection,{kind:'scale',scale:1048576,safeWrite:true},'latest native torrent size limit must source-prove bytes ↔ MiB projection');
assert.equal(source.profiles[0].manifest.preferences.proxy_type?.projection?.kind,'switch-map','oldest admitted proxy type must retain its source composite read map');
assert.equal(source.profiles[0].manifest.preferences.proxy_type?.projection?.safeWrite,false,'historical proxy composite write must remain fail-closed until an inverse is source-proven');
const compact=compileQbPreferencesCompact(source,catalog),packed=JSON.stringify(compact),bytes=Buffer.byteLength(packed);
assert.equal(compact.schemaVersion,2,'compact Preferences IR must use the keyed source-native schema');
assertCatalogIdentity(compact.catalogIdentity,expectedIdentity,'Preferences compact Frozen catalog identity');
assert.equal(compact.releases.length,catalog.length,'compact Preferences release identity must remain exact');
assert.ok(compact.tabs.length>0&&compact.tabs.length<=catalog.length,'compact Preferences tab change-point count is invalid');
assert.equal(compact.format.preference.at(-2),'projection','compact Preferences format must keep value projection as a first-class source fact');
assert.equal(compact.format.preference.at(-1),'structured','compact Preferences format must expose optional source-proven structured editor metadata after projection');
assert.ok(bytes<640*1024,`compact Preferences + Control Graph runtime IR is ${bytes} bytes; source graph transport must stay bounded instead of duplicating full manifests`);
assert.equal(compact.releases.at(-1)[0],catalog.at(-1).qbVersion);
assert.equal(compact.releases.at(-1)[1],catalog.at(-1).sourceSha);
for(const profile of source.profiles){
  const expanded=expandQbPreferencesCompact(compact,profile.qbVersion),manifest=profile.manifest;
  assert.deepEqual(expanded.tabs.map(tab=>tab.id),manifest.tabs.map(tab=>tab.id),`${profile.qbVersion}: compact native tab order is not lossless`);
  assert.equal(Object.keys(expanded.preferences).length,Object.keys(manifest.preferences).length,`${profile.qbVersion}: compact mapped Preference count is not lossless`);
  assert.deepEqual(Object.keys(expanded.controlGraph?.tabs||{}).sort(),Object.keys(manifest.controlGraph?.tabs||{}).sort(),`${profile.qbVersion}: compact Control Graph tab set drift`);
  for(const tabId of Object.keys(manifest.controlGraph?.tabs||{}))assert.deepEqual(expanded.controlGraph.tabs[tabId],manifest.controlGraph.tabs[tabId],`${profile.qbVersion}: compact Control Graph drift in ${tabId}`);
  for(const [key,item] of Object.entries(manifest.preferences)){
    const actual=expanded.preferences[key];assert.ok(actual,`${profile.qbVersion}: compact IR lost ${key}`);
    assert.equal(actual.tab,item.tab,`${profile.qbVersion}: ${key} tab drift`);assert.equal(actual.sectionId,item.sectionId,`${profile.qbVersion}: ${key} section drift`);assert.equal(actual.order,item.order,`${profile.qbVersion}: ${key} order drift`);assert.equal(actual.control.id,item.control.id,`${profile.qbVersion}: ${key} control id drift`);assert.equal(actual.control.semantic,item.control.semantic,`${profile.qbVersion}: ${key} control semantic drift`);assert.deepEqual(actual.control.attributes,item.control.attributes||{},`${profile.qbVersion}: ${key} control attributes drift`);assert.equal(actual.title?.source,item.title?.source,`${profile.qbVersion}: ${key} source title drift`);assert.equal(actual.title?.context,item.title?.context,`${profile.qbVersion}: ${key} source title context drift`);assert.deepEqual(actual.descriptor,item.descriptor,`${profile.qbVersion}: ${key} API descriptor drift`);assert.deepEqual(actual.projection,item.projection,`${profile.qbVersion}: ${key} source value projection drift`);
  }
}
console.log(`Full stable qB Preferences source contract passed: ${catalog.length} exact releases, structural control/action/adornment/copy/behavior census complete with unknown=0, Frozen catalog ${expectedIdentity.releaseSetSha256.slice(0,12)}, ${(minimumRatio*100).toFixed(1)}% minimum native mapping, ${scaleProjectionCount} scale / ${switchProjectionCount} switch / ${sentinelProjectionCount} sentinel / ${presenceProjectionCount} presence / ${unprovenProjectionCount} unproven value projections, ${bytes} byte keyed + structural compact IR, and lossless tab/section/control/API/value/Control-Graph provenance.`);

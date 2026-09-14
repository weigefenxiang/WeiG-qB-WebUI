import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const app=read('webui/private/scripts/app.js');
const client=read('webui/private/scripts/qb-client.js');
const releaseProfile=read('webui/private/scripts/release-profile.js');
const layout=read('webui/private/scripts/layout.js');
const ui=read('webui/private/scripts/ui.js');
const core=read('webui/private/scripts/core.js');
const index=read('webui/private/index.html');
const tableCss=read('webui/private/css/table.css');
const retiredGeneralRuntime=path.join(root,'webui/private/scripts/detail-general.js');

const details=[
  ['properties','propertiesAction','torrents/properties'],
  ['files','filesAction','torrents/files'],
  ['trackers','trackersAction','torrents/trackers'],
  ['webseeds','webseedsAction','torrents/webseeds']
];
for(const [method,action,pathName] of details){
  const pattern=new RegExp(`Client\\.prototype\\.${method}=function\\(hash\\)\\{requireSourceAction\\('torrentscontroller\\.h:${action}','${pathName.replace('/','\\/')}'\\);return this\\.request`);
  assert.match(client,pattern,`${method} must reject before HTTP unless its own source action is present`);
}

for(const owner of ['torrentPropertiesFields','torrentTrackerFields','torrentFileFields','torrentWebSeedFields']){
  assert.match(releaseProfile,new RegExp(`function ${owner}\\(\\)`),`${owner} must remain a ReleaseProfile runtime owner`);
}
assert.match(releaseProfile,/function hasTorrentDetailField\(surface,name\)/,'ReleaseProfile must own per-field Detail provenance');
assert.match(releaseProfile,/function torrentDetailUi\(\)\{if\(!current\|\|current\.fallback\|\|!isCertified\(\)\)return null;/,'ReleaseProfile must expose Detail UI facts only for exact/equivalent certified profiles');
assert.match(releaseProfile,/torrentPropertiesFields:\[\],torrentTrackerFields:\[\],torrentFileFields:\[\],torrentWebSeedFields:\[\]/,'unknown/fallback releases must expose no guessed Detail response fields');

assert.match(index,/<div id="detail-tabs" class="detail-tabs" role="tablist"><\/div>/,'HTML must contain only an empty Detail tab host');
assert.doesNotMatch(index,/data-tab="(?:overview|files|trackers|peers|webseeds)"/,'HTML must not hard-code Torrent Detail tabs');
assert.match(app,/function detailUi\(\)\{var R=W\.ReleaseProfile;return R&&typeof R\.torrentDetailUi==='function'\?R\.torrentDetailUi\(\):null;\}/,'app must consume the canonical ReleaseProfile Detail manifest owner');
assert.match(app,/function detailTabKeys\(\).*Array\.isArray\(ui&&ui\.tabOrder\)\?ui\.tabOrder:Object\.keys\(tabs\)/s,'Detail tab existence and order must come from the source-generated manifest');
assert.match(app,/function defaultDetailTab\(\)\{var keys=detailTabKeys\(\);return keys\.length\?keys\[0\]:'';\}/,'default Detail tab must be the first source-proven tab');
assert.doesNotMatch(app,/\bdetailActions\s*=|DetailTabsV2/,'app must not retain a fixed or parallel Detail-tab/action truth');
assert.match(app,/var tabs=detailTabKeys\(\),requested=String\(r\.tab\|\|''\),tab=requested&&tabs\.indexOf\(requested\)>=0\?requested:\(tabs\[0\]\|\|''\)/,'invalid/missing Detail routes must converge to the first source-proven tab');

assert.match(app,/function detailValue\(surface,item,name,fallback\)\{if\(!hasDetailField\(surface,name\)\)return fallback;/,'Detail response values must be gated by source-proven field ownership');
assert.match(app,/requireDetailArray\(await app\.client\.files\(app\.detailHash\),'Files API'\)/,'Files malformed responses must not become empty lists');
assert.match(app,/requireDetailArray\(await app\.client\.trackers\(app\.detailHash\),'Trackers API'\)/,'Trackers malformed responses must not become empty lists');
assert.match(app,/requireDetailArray\(await app\.client\.webseeds\(app\.detailHash\),'Web Seeds API'\)/,'WebSeed malformed responses must not become empty lists');
assert.doesNotMatch(app,/app\.client\.webseeds\([^\n]*\.catch\(function\(\)\{return \[\];\}\)/,'WebSeed transport errors must never become a fake empty result');
assert.match(app,/if\(!items\.length\)\{root\.appendChild\(C\.sectionTitle\('HTTP Sources','当前种子没有 Web Seed \/ HTTP Source。'\)\);return;\}/,'only a real source-proven empty WebSeed array may render the empty state');
assert.match(app,/p\.textContent='加载失败：'\+e\.message/,'transport or malformed-response errors must remain visible');

assert.match(app,/async function renderOverview\(root\)\{var p=await app\.client\.properties\(app\.detailHash\);.*W\.QbUiEvidence\.renderGeneral\(root,p,app\.detailHash\).*throw new Error/s,'Overview must pass its single Properties response to source-driven General and fail closed when the layout is unresolved');
assert.equal((app.match(/app\.client\.properties\(app\.detailHash\)/g)||[]).length,1,'Overview must issue exactly one Properties request');
assert.doesNotMatch(app,/保存路径|总大小|已下载|已上传|连接数|privacyType|discoveryType|sourceDetailObject/,'app must not retain a hand-written General field/layout fallback');
assert.doesNotMatch(app,/GeneralDetailRuntime|__weiggGeneralEvidenceWrapper|client\.properties=wrapped|requestAnimationFrame\(tryRender\)/,'app must not recreate a post-render General owner');

assert.match(app,/function detailControl\(name\).*ui&&ui\.controls/s,'Detail controls must come from the source-generated manifest');
assert.match(app,/async function renderFiles\(root\).*detailControl\('filePriority'\).*sourceOptions=.*control&&control\.options/s,'File priority choices must come from source-proven per-release control options');
assert.match(app,/writeActionSupported\('torrentscontroller\.h:filePrioAction'\)/,'File priority writes must require exact write provenance plus source action presence');
assert.match(app,/app\.client\.setFilePriority\(app\.detailHash,fileId,value\)/,'File priority writes must use the existing QBClient owner');
assert.doesNotMatch(app,/\[\s*\{value:'0'.*value:'1'.*value:'6'.*value:'7'/s,'runtime must not hard-code modern file-priority values');

assert.match(app,/function writeActionSupported\(action\).*R\.hasWriteProvenance&&R\.hasWriteProvenance\(\).*R\.hasAction&&R\.hasAction\(action\)/s,'Detail writes must require exact/equivalent write provenance and exact source action presence');
assert.match(app,/function mutableTrackerUrl\(url\).*url\.startsWith\('\*\* \['\).*url\.startsWith\('endpoint\|'\)/s,'Tracker row mutation availability must follow qB static tracker semantics');
assert.match(app,/torrentActionSupported\('editTracker'\).*app\.client\.editTracker\(app\.detailHash,trackerUrl,v\)/s,'Tracker Edit must be source-gated and call QBClient directly');
assert.match(app,/torrentActionSupported\('removeTrackers'\).*app\.client\.removeTrackers\(app\.detailHash,trackerUrl\)/s,'Tracker Remove must be source-gated and call QBClient directly');
assert.match(app,/detailContextItems:trackerContext/,'Tracker permanent row actions must be supplied to the shared right-click context menu');
assert.doesNotMatch(app,/renderTrackers\([^]*?button[^]*?(?:Edit|删除|Remove tracker)/,'Tracker Edit/Remove must not be rendered as inline row buttons');
assert.match(app,/detailActionLabel\('tracker\.edit','Edit tracker URL\.\.\.','TrackerListWidget'\)/,'Tracker Edit must reuse the exact qB source string/context');
assert.match(app,/detailActionLabel\('tracker\.remove','Remove tracker','TrackerListWidget'\)/,'Tracker Remove must reuse the exact qB source string/context');

assert.match(app,/writeActionSupported\('transfercontroller\.h:banPeersAction'\)/,'Peer ban must require exact write provenance plus source action presence');
assert.match(app,/detailActionLabel\('peer\.ban','Ban peer permanently','PeerListWidget'\)/,'Peer ban must reuse the exact qB source string/context');
assert.match(app,/app\.client\.banPeers\(address\)/,'Peer ban must use the existing QBClient owner');
assert.match(app,/detailContextItems:peerContext/,'Peer permanent action must be supplied to the shared right-click context menu');
assert.doesNotMatch(app,/speed\.style\.cursor='pointer'|textContent='×'/,'Peer runtime must not expose an inline permanent-action affordance');

for(const unsafe of [
  /\bp\.save_path\b/,/\bp\.total_size\b/,/\bp\.total_downloaded\b/,/\bp\.total_uploaded\b/,/\bp\.share_ratio\b/,/\bp\.nb_connections\b/,/\bp\.seeds\b/,/\bp\.peers\b/,/\bp\.addition_date\b/,/\bp\.completion_date\b/,/\bp\.created_by\b/,/\bp\.pieces_num\b/,/\bp\.piece_size\b/,
  /\bf\.name\b/,/\bf\.size\b/,/\bf\.progress\b/,/\bf\.priority\b/,/\bf\.index\b/,
  /\bt\.url\b/,/\bt\.status\b/,/\bt\.num_seeds\b/,
  /\bx\.url\s*\|\|\s*x/
])assert.doesNotMatch(app,unsafe,`Detail UI must not directly consume an unproven response field: ${unsafe}`);

assert.match(layout,/function exactProfile\(\)\{var R=W\.ReleaseProfile;if\(!R\|\|typeof R\.current!=='function'\|\|typeof R\.isCertified!=='function'\|\|!R\.isCertified\(\)\)return null;/,'rendered General identity must fail closed outside certified ReleaseProfile');
assert.match(layout,/function exactDetailUi\(\)\{var R=W\.ReleaseProfile,ui=R&&typeof R\.torrentDetailUi==='function'\?R\.torrentDetailUi\(\):null;/,'layout must consume Torrent Detail UI only through ReleaseProfile.torrentDetailUi()');
assert.doesNotMatch(layout,/profile&&profile\.torrentDetailUi/,'layout must not bypass the ReleaseProfile Detail owner');
assert.match(layout,/W\.I18n\.qbText\(String\(key\|\|''\),source\|\|String\(key\|\|''\)\)/,'Detail labels must flow through the existing official qB translation resolver');
assert.ok(layout.includes("function detailTranslationKey(surface,key){return'detail.'+String(surface||'')+'.'+String(key||'');}"),'Detail columns must use the source-generated translation keyspace');
assert.match(layout,/W\.SharedColumns=\{resolve:resolveColumns,commit:commitColumns,reset:resetColumns,read:tableState/,'all Detail tables must share one user-override column owner');
assert.match(layout,/function renderGeneral\(root,data,hash\).*Array\.isArray\(layout\).*return false;/s,'General must fail closed without a source-generated propertyLayout');
assert.match(layout,/field&&field\.valueSource==='torrentHash'/,'legacy Torrent Hash rows must consume their source-proven current-torrent-hash binding');
assert.match(layout,/Array\.isArray\(field&&field\.dataProperties\)/,'General values must come from parser-derived field bindings');
assert.match(layout,/keys\.some\(function\(key\)\{return!R\.hasTorrentDetailField\('properties',key\);\}\)/,'every General Properties binding must remain gated by exact response provenance');
assert.match(layout,/title\.textContent=detailGroupLabel\(key\)/,'General group labels must use official translation evidence');
assert.match(layout,/name\.textContent=detailPropertyLabel\(row\.id\)/,'General field labels must use official translation evidence');
assert.doesNotMatch(layout,/detail-general\.js|GeneralDetailRuntime|__weiggGeneralEvidenceWrapper|client\.properties=wrapped|requestAnimationFrame\(tryRender\)/,'layout must not recreate the retired General owner');
assert.doesNotMatch(layout,/MutationObserver/,'Detail schema/column state must not rely on MutationObserver repair');
assert.equal(fs.existsSync(retiredGeneralRuntime),false,'retired detail-general.js must remain deleted');

assert.match(core,/U\.countryFlag=function\(code\).*String\.fromCodePoint\(0x1F1E6/s,'shared core utilities must own ISO alpha-2 flag rendering without a country mapping table');
assert.match(ui,/U\.countryFlag\?U\.countryFlag\(item\[codeKey\]\):''/,'Peer country rendering must reuse the shared flag utility');
assert.doesNotMatch(ui,/function countryFlag\(|country(?:Code|Map)\s*=\s*\{/,'Detail UI must not own a duplicate country-code renderer or mapping table');

assert.match(ui,/function installSharedColumnInteraction\(\)/,'one shared pointer interaction engine must own table resize/reorder');
assert.match(ui,/global\.addEventListener\('pointermove',move,true\).*global\.addEventListener\('pointerup',up,true\).*global\.addEventListener\('pointercancel',up,true\)/s,'shared resize drag must keep a window-level pointer lifecycle');
assert.match(ui,/global\.removeEventListener\('pointermove',move,true\).*global\.removeEventListener\('pointerup',up,true\).*global\.removeEventListener\('pointercancel',up,true\)/s,'shared resize drag must release its global pointer lifecycle');
assert.match(ui,/W\.DataGrid\.addResizeHandles=function\(head,columns,onChange,options\)\{return attach\(head,columns,onChange,options\);\}/,'Main Torrent and Detail tables must share one interaction engine');
assert.match(ui,/e\.pointerType==='touch'.*longPress=setTimeout/s,'shared column reorder must include touch long-press support');
assert.match(ui,/if\(!drag\.armed\)\{if\(distance>8\)\{clearTimeout\(longPress\);drag=null;\}return;\}/,'ordinary touch scrolling must cancel reorder before long-press capture');
assert.match(ui,/function detailSurface\(tab\).*\['files','trackers','peers','webseeds'\]/s,'all four Detail table surfaces must enter the same shared table adapter');
assert.match(ui,/W\.QbUiEvidence&&W\.QbUiEvidence\.detailColumns\?W\.QbUiEvidence\.detailColumns\(surface\):\[\]/,'Detail table schemas must come from exact per-release source evidence');
assert.match(ui,/W\.SharedColumns\.resolve\(tableId,source\)/,'Detail table layout must merge current official schema with user overrides');
assert.match(ui,/next\.staticHead=head;next\.renderRow=function\(item,index\)\{return detailRow\(item,index,ctx\);\};/,'Detail header and rows must share the same VirtualList scroll container');
assert.match(ui,/W\.DataGrid\.addResizeHandles\(ctx\.head,ctx\.visible,function\(visible,_save,reason\)/,'Detail resize/reorder must reuse the shared interaction engine');
assert.match(ui,/W\.SharedColumns\.commit\(ctx\.tableId,ctx\.source,ctx\.resolved\)/,'Detail column persistence must commit only through SharedColumns');
assert.match(ui,/W\.SharedColumnSettings=\{open:openSharedColumnDialog\}/,'one shared column settings dialog must serve Detail tables');
assert.match(ui,/toolbar=root\.querySelector\(':scope > \.inline-form'\)\|\|root\.querySelector\(':scope > \.shared-table__toolbar'\)/,'Detail Columns must join the existing first toolbar row when present');
assert.match(ui,/ctx\.apply=function\(rebuild\)\{applyDetailColumns\(ctx,rebuild\);\};/,'Detail column settings must live-apply through the canonical renderer');
assert.match(ui,/function syncDetailTabLabels\(\).*W\.QbUiEvidence\.detailTab\(key\)/s,'Detail tab names must update from official per-release translation evidence');
assert.match(ui,/function detailTabKeys\(\).*Array\.isArray\(ui&&ui\.tabOrder\)\?ui\.tabOrder:Object\.keys\(tabs\)/s,'UI tab order must consume the same source manifest');
assert.doesNotMatch(ui,/legacyRow|sourceActionSupported|\.click\(\).*remove|\.click\(\).*edit/s,'Detail presentation must not bridge actions through synthesized legacy rows/buttons');
assert.match(ui,/contextItems:options&&options\.detailContextItems,cellRenderer:options&&options\.detailCellRenderer/,'Detail UI must receive actions and interactive cells from the app owner instead of inventing write semantics');
assert.doesNotMatch(ui,/MutationObserver/,'shared table runtime must not chase DOM changes with MutationObserver');
assert.match(ui,/function detailValueSource\(surface,column\).*if\(key&&keys\.indexOf\(key\)>=0\)return'response';.*return scalar\.length===1\?'projection':'derived';/s,'Detail runtime must distinguish response, bounded projection, and derived values');
assert.match(ui,/function propertyValue\(surface,item,column\).*if\(valueSource==='derived'\)return derivedDetailValue\(surface,item,column\);.*if\(valueSource==='projection'\)return projectedDetailValue\(item,column\);.*if\(keys\.indexOf\(key\)<0\|\|!owns\(item,key\)\)return\{key:key,value:null\};/s,'response columns must read only proven keys; projection/derived paths must remain bounded');
assert.doesNotMatch(ui,/function propertyValue\([^}]*keys\.push\(column\.key\)/s,'Detail runtime must never append an unproven key into response candidates');
assert.match(ui,/surface==='files'&&key==='checked'.*keys\[0\]==='priority'.*priority!==0/s,'Content checked state must derive only from source-proven priority');
assert.match(ui,/surface==='files'&&key==='remaining'.*keys\.indexOf\('size'\)>=0.*keys\.indexOf\('progress'\)>=0.*\(priorityValue===0\)\?0:Math\.max\(0,size\*\(1-ratio\)\)/s,'Content remaining must follow source-proven qB semantics');
assert.match(ui,/return\{key:key,value:null,derived:true\};/,'unknown derived columns must fail closed');
assert.match(ui,/column\.key==='checked'&&found\.format==='checkbox'.*checkbox\.style\.pointerEvents='none'/s,'source-derived checked state must render as a non-writing checkbox');
assert.match(ui,/if\(isUrl\)\{cell\.style\.whiteSpace='nowrap';cell\.style\.overflow='hidden';cell\.style\.textOverflow='ellipsis';\}/,'Tracker/WebSeed URL cells must be single-line ellipsis');
assert.match(ui,/cell\.title=cell\.textContent/,'Detail cells must retain exact displayed value in a tooltip');

assert.match(tableCss,/#detail-view\.is-active\{display:flex;flex:1 1 0;flex-direction:column;min-height:0;height:100%;max-height:100%;overflow:hidden\}/,'Detail workspace must be a full-height flex owner');
assert.match(tableCss,/#detail-content\{display:flex;flex:1 1 0;flex-direction:column;min-height:0!important;height:auto!important;max-height:none!important;overflow:auto/,'Tabs-to-statusbar Detail content must consume remaining workspace height');
assert.match(tableCss,/\.general-detail__grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(250px,1fr\)\)/,'General source groups must use responsive layout');
assert.doesNotMatch(tableCss,/#detail-content[^}]*height:\s*(?:480|500)px/,'Detail workspace must not regress to a fixed 480/500px height');

console.log('Torrent Detail runtime contract passed: source manifest owns tabs/General/controls, QBClient owns writes, UI owns shared table presentation, and no parallel static/legacy Detail truth remains.');

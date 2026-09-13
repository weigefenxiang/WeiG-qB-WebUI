import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'webui/private/scripts/app.js'),'utf8');
const client=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const releaseProfile=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const layout=fs.readFileSync(path.join(root,'webui/private/scripts/layout.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'webui/private/scripts/ui.js'),'utf8');
const tableCss=fs.readFileSync(path.join(root,'webui/private/css/table.css'),'utf8');

const details=[
  ['properties','propertiesAction','torrents/properties'],
  ['files','filesAction','torrents/files'],
  ['trackers','trackersAction','torrents/trackers'],
  ['webseeds','webseedsAction','torrents/webseeds']
];
for(const [method,action,pathName] of details){
  const pattern=new RegExp(`Client\\.prototype\\.${method}=function\\(hash\\)\\{requireSourceAction\\('torrentscontroller\\.h:${action}','${pathName.replace('/','\\/')}'\\);return this\\.request`);
  assert.match(client,pattern,`${method} must reject before HTTP unless its own exact source action is present`);
}

for(const owner of ['torrentPropertiesFields','torrentTrackerFields','torrentFileFields','torrentWebSeedFields']){
  assert.match(releaseProfile,new RegExp(`function ${owner}\\(\\)`),`${owner} must be a ReleaseProfile runtime owner`);
}
assert.match(releaseProfile,/function hasTorrentDetailField\(surface,name\)/,'ReleaseProfile must own per-field detail provenance');
assert.match(releaseProfile,/torrentPropertiesFields:\[\],torrentTrackerFields:\[\],torrentFileFields:\[\],torrentWebSeedFields:\[\]/,'unknown/fallback releases must expose no guessed detail response fields');

assert.match(app,/var detailActions=\{overview:'torrentscontroller\.h:propertiesAction',files:'torrentscontroller\.h:filesAction',trackers:'torrentscontroller\.h:trackersAction',webseeds:'torrentscontroller\.h:webseedsAction'\}/,'Detail tabs must map to exact upstream source actions');
assert.match(app,/if\(action&&!detailActionSupported\(action\)\)\{renderDetailUnsupported\(root\);return;\}/,'unsupported detail surfaces must be rendered before any transport call');
assert.match(app,/function detailValue\(surface,item,name,fallback\)\{if\(!hasDetailField\(surface,name\)\)return fallback;/,'detail response values must be gated by source-proven field ownership');
assert.match(app,/function sourceDetailObject\(surface,item\)/,'Overview evidence must be projected through source-proven Properties fields');
assert.match(app,/requireDetailArray\(await app\.client\.files\(app\.detailHash\),'Files API'\)/,'Files malformed responses must not become empty lists');
assert.match(app,/requireDetailArray\(await app\.client\.trackers\(app\.detailHash\),'Trackers API'\)/,'Trackers malformed responses must not become empty lists');
assert.match(app,/requireDetailArray\(await app\.client\.webseeds\(app\.detailHash\),'Web Seeds API'\)/,'WebSeed malformed responses must not become empty lists');
assert.doesNotMatch(app,/app\.client\.webseeds\([^\n]*\.catch\(function\(\)\{return \[\];\}\)/,'WebSeed transport errors must never be converted to a fake empty result');
assert.match(app,/if\(!items\.length\)\{root\.appendChild\(C\.sectionTitle\('HTTP Sources','当前种子没有 Web Seed \/ HTTP Source。'\)\);return;\}/,'only a real source-proven empty WebSeed array may render the empty state');
assert.match(app,/p\.textContent='加载失败：'\+e\.message/,'transport or malformed-response errors must remain visible as failures');

for(const unsafe of [
  /\bp\.save_path\b/,/\bp\.total_size\b/,/\bp\.total_downloaded\b/,/\bp\.total_uploaded\b/,/\bp\.share_ratio\b/,/\bp\.nb_connections\b/,/\bp\.seeds\b/,/\bp\.peers\b/,/\bp\.addition_date\b/,/\bp\.completion_date\b/,/\bp\.created_by\b/,/\bp\.pieces_num\b/,/\bp\.piece_size\b/,
  /\bf\.name\b/,/\bf\.size\b/,/\bf\.progress\b/,/\bf\.priority\b/,/\bf\.index\b/,
  /\bt\.url\b/,/\bt\.status\b/,/\bt\.num_seeds\b/,
  /\bx\.url\s*\|\|\s*x/
])assert.doesNotMatch(app,unsafe,`Detail UI must not directly consume an unproven response field: ${unsafe}`);

assert.match(layout,/function exactProfile\(\)\{var R=W\.ReleaseProfile;if\(!R\|\|typeof R\.current!=='function'\|\|typeof R\.isCertified!=='function'\|\|!R\.isCertified\(\)\)return null;/,'native detail UI schema must fail closed outside an exact/equivalent certified ReleaseProfile');
assert.match(layout,/var profile=R\.current\(\);return profile&&!profile\.fallback\?profile:null;/,'fallback profiles must never masquerade as exact native detail UI evidence');
assert.match(layout,/function exactDetailUi\(\)\{var profile=exactProfile\(\),ui=profile&&profile\.torrentDetailUi;/,'runtime detail UI must consume the source-generated per-release torrentDetailUi catalog fact');
assert.match(layout,/W\.I18n\.qbText\(String\(key\|\|''\),source\|\|String\(key\|\|''\)\)/,'detail labels must flow through the existing official qB translation resolver');
assert.match(layout,/function detailTranslationKey\(surface,key\)\{return'detail\.'\+String\(surface\|\|''\)\+'\.'\+String\(key\|\|''\);\}/,'detail table columns must use the source-generated translation keyspace');
assert.match(layout,/W\.SharedColumns=\{resolve:resolveColumns,commit:commitColumns,reset:resetColumns,read:tableState/,'all detail tables must share one user-override column state owner');
assert.doesNotMatch(layout,/MutationObserver/,'detail schema/column state must not rely on MutationObserver repair');

assert.match(ui,/function installSharedColumnInteraction\(\)/,'one shared pointer interaction engine must own table resize/reorder');
assert.match(ui,/W\.DataGrid\.addResizeHandles=function\(head,columns,onChange,options\)\{return attach\(head,columns,onChange,options\);\}/,'the main Torrent table must delegate to the same shared interaction engine used by detail tables');
assert.match(ui,/e\.pointerType==='touch'.*longPress=setTimeout/s,'shared column reorder must include touch long-press support');
assert.match(ui,/if\(!drag\.armed\)\{if\(distance>8\)\{clearTimeout\(longPress\);drag=null;\}return;\}/,'ordinary touch scrolling must cancel reorder before long-press capture');
assert.match(ui,/function detailSurface\(tab\).*\['files','trackers','peers','webseeds'\]/s,'all four detail table surfaces must enter the same shared table adapter');
assert.match(ui,/W\.QbUiEvidence&&W\.QbUiEvidence\.detailColumns\?W\.QbUiEvidence\.detailColumns\(surface\):\[\]/,'detail table schemas must come from exact per-version qB source evidence');
assert.match(ui,/W\.SharedColumns\.resolve\(tableId,source\)/,'detail table layout must merge current official schema with user overrides');
assert.match(ui,/next\.staticHead=head;next\.renderRow=function\(item,index\)\{return detailRow\(item,index,ctx\);\};/,'detail header and rows must be owned by the same native VirtualList scroll container');
assert.match(ui,/W\.DataGrid\.addResizeHandles\(ctx\.head,ctx\.visible,function\(visible,_save,reason\)/,'detail resize/reorder must reuse the shared interaction engine');
assert.match(ui,/W\.SharedColumns\.commit\(ctx\.tableId,ctx\.source,ctx\.resolved\)/,'detail column persistence must commit only through the shared user-override store');
assert.match(ui,/W\.SharedColumnSettings=\{open:openSharedColumnDialog\}/,'one shared column settings dialog must serve detail tables');
assert.match(ui,/function syncDetailTabLabels\(\).*W\.QbUiEvidence\.detailTab\(key\)/s,'detail tab names must update from the current qB release official translation evidence');
assert.doesNotMatch(ui,/MutationObserver/,'shared table runtime must not chase DOM changes with MutationObserver');

assert.match(tableCss,/#detail-view\.is-active\{display:flex;flex:1 1 0;flex-direction:column;min-height:0;height:100%;max-height:100%;overflow:hidden\}/,'detail workspace must be a full-height flex owner rather than a fixed pixel panel');
assert.match(tableCss,/#detail-content\{display:flex;flex:1 1 0;flex-direction:column;min-height:0!important;height:auto!important;max-height:none!important;overflow:auto/,'Tabs-to-Statusbar detail content must consume all remaining workspace height');
assert.doesNotMatch(tableCss,/#detail-content[^}]*height:\s*(?:480|500)px/,'detail workspace must not regress to fixed 480/500px heights');

console.log('Torrent detail runtime contract passed: source-proven transport/fields remain fail-closed, exact per-version qB UI/translation evidence drives shared detail tables, and one pointer/column toolkit owns desktop+touch interactions without fixed-height or MutationObserver repair.');

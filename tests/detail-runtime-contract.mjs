import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const app=fs.readFileSync(path.join(root,'webui/private/scripts/app.js'),'utf8');
const client=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const releaseProfile=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');

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

console.log('Torrent detail runtime contract passed: exact source actions gate transport, exact response fields gate rendering, unsupported/empty/error remain distinct, and WebSeed errors cannot become fake-empty.');

import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/release-profile.js',import.meta.url),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
const catalog=[
  {qbVersion:'4.1.0',webApiVersion:'2.0.0',officialWeiGSupport:true,apiActions:['torrentscontroller.h:resumeAction','torrentscontroller.h:pauseAction','torrentscontroller.h:recheckAction','torrentscontroller.h:addTrackersAction','torrentscontroller.h:propertiesAction','torrentscontroller.h:filesAction','torrentscontroller.h:trackersAction','torrentscontroller.h:webseedsAction'],apiActionParameters:{'torrentscontroller.h:resumeAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:pauseAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:recheckAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:addTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','paused','resumed'],torrentInfoParameters:['filter','category'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags'],torrentStates:['downloading','stalledDL','uploading','stalledUP','pausedDL','pausedUP','checkingDL','checkingUP','error','missingFiles'],torrentPropertiesFields:['save_path','total_size','share_ratio'],torrentTrackerFields:['url','status','num_peers'],torrentFileFields:['name','size','progress','priority'],torrentWebSeedFields:['url'],preferenceDescriptors:[{key:'save_path',writable:true,setterPresent:true,writeType:'string',typeAgreement:'EXACT'}]},
  {qbVersion:'5.2.3',webApiVersion:'2.15.1',sourceSha:'0b63c3d17373f6132ea211c9dcd4241284ccdfaf',officialWeiGSupport:true,settingsNativeLocales:['zh_CN'],apiActions:['torrentscontroller.h:startAction','torrentscontroller.h:stopAction','torrentscontroller.h:tagsAction','torrentscontroller.h:reannounceAction','torrentscontroller.h:removeTrackersAction','torrentscontroller.h:propertiesAction','torrentscontroller.h:filesAction','torrentscontroller.h:trackersAction','torrentscontroller.h:webseedsAction'],apiActionParameters:{'torrentscontroller.h:reannounceAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:removeTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','stopped','running','stalled'],torrentInfoParameters:['filter','tag'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','private'],torrentStates:['downloading','stalledDL','uploading','stalledUP','stoppedDL','stoppedUP','checkingDL','checkingUP','moving','error','missingFiles'],torrentPropertiesFields:['save_path','download_path','private','pieces_num','piece_size'],torrentTrackerFields:['url','status','num_seeds','tier'],torrentFileFields:['index','name','size','progress','priority'],torrentWebSeedFields:['url'],preferenceDescriptors:[]}
];
let responseCatalog=catalog;
const events=[];
const window={WeiG:{buildAssetUrl:x=>x},console,dispatchEvent:event=>events.push(event)};window.window=window;
const context={window,console,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},fetch:async()=>({ok:true,status:200,json:async()=>responseCatalog})};
vm.runInNewContext(source,context,{filename:'release-profile.js'});
const R=window.WeiG.ReleaseProfile;
assert(R&&typeof R.bind==='function'&&typeof R.resolveTorrentActionDescriptor==='function','W.ReleaseProfile must be the exact source-fact runtime owner');
assert(typeof R.detailFields==='function'&&typeof R.hasTorrentDetailField==='function','W.ReleaseProfile must expose exact Torrent detail response-field provenance');
assert(typeof R.resolutionInfo==='function','W.ReleaseProfile must expose profile resolution provenance');

let client={qbVersion:'v4.1.0',webApiVersion:'2.0.0',major:4};
await R.bind(client);
assert(R.isCertified(),'qB 4.1.0 exact catalog entry must be certified');
assert(R.current().qbVersion==='4.1.0','exact qB version must bind its exact stable profile');
assert(R.resolutionInfo().mode==='EXACT'&&R.resolutionInfo().resolvedFrom==='4.1.0','exact qB profile must report exact resolution provenance');
assert(JSON.stringify(R.torrentFilters())===JSON.stringify(['all','downloading','seeding','stopped','running']),'qB4 paused/resumed aliases must canonicalize exactly once for UI consumers');
assert(R.upstreamTorrentFilter('stopped')==='paused'&&R.upstreamTorrentFilter('running')==='resumed','canonical qB4 filters must map back to exact upstream names at the HTTP boundary');
assert(R.resolveTorrentAction('start')==='resume'&&R.resolveTorrentAction('stop')==='pause','qB4 start/stop intents must resolve from exact action provenance');
assert(R.resolveTorrentAction('reannounce')===null&&!R.supportsTorrentAction('removeTrackers'),'qB4 must fail closed for actions absent from exact upstream source');
const recheck=R.resolveTorrentActionDescriptor('recheck');
assert(recheck?.sourceAction==='torrentscontroller.h:recheckAction'&&recheck.endpoint==='recheck'&&recheck.required.includes('hashes'),'action descriptor must preserve exact source and required parameter facts');
assert(R.hasTorrentInfoField('category')&&R.hasTorrentInfoField('tags')&&!R.hasTorrentInfoField('private'),'qB4 field facts must expose category/tags without inventing private');
assert(R.torrentStates().includes('stalledDL')&&R.torrentStates().includes('checkingUP'),'exact Torrent states must be queryable');
assert(R.preferenceDescriptor('save_path')?.writable===true,'exact preference descriptor lookup failed');
assert(!R.hasInfoParameter('private'),'qB4 must not invent later torrents/info parameters');
assert(R.hasTorrentDetailField('properties','save_path')&&!R.hasTorrentDetailField('properties','private'),'qB4 Properties fields must follow exact response surface');
assert(R.hasTorrentDetailField('trackers','num_peers')&&!R.hasTorrentDetailField('trackers','num_seeds'),'qB4 Tracker fields must not inherit modern counters');
assert(R.hasTorrentDetailField('files','priority')&&!R.hasTorrentDetailField('files','index'),'qB4 File fields must not invent later response indexes');
assert(JSON.stringify(R.torrentWebSeedFields())===JSON.stringify(['url']),'qB4 WebSeed response surface must expose only source-proven url');

client={qbVersion:'5.2.3',webApiVersion:'2.15.1',major:5};
await R.bind(client);
assert(R.resolveTorrentAction('start')==='start'&&R.resolveTorrentAction('stop')==='stop','qB5 start/stop must resolve exact modern action names');
assert(R.resolveTorrentAction('reannounce')==='reannounce'&&R.resolveTorrentAction('removeTrackers')==='removeTrackers','qB5 exact actions must resolve when source proves them');
assert(R.supportsTorrentFilter('stalled')&&R.hasTorrentInfoField('private')&&R.hasAction('torrentscontroller.h:tagsAction'),'qB5 source-derived filter/field/action facts must be queryable');
assert(R.hasTorrentDetailField('properties','private')&&R.hasTorrentDetailField('properties','download_path'),'qB5 Properties additions must be exact-profile facts');
assert(R.hasTorrentDetailField('trackers','num_seeds')&&R.hasTorrentDetailField('files','index'),'qB5 Tracker/File response additions must be exact-profile facts');

client={qbVersion:'5.2.3-r1',webApiVersion:'2.15.1',major:5};
await R.bind(client);
assert(R.isCertified()&&R.current().qbVersion==='5.2.3','packaging suffix must resolve to the exact canonical stable profile');
assert(R.resolutionInfo().mode==='EQUIVALENT'&&R.resolutionInfo().detectedQbVersion==='5.2.3-r1','canonical packaging suffix must retain equivalent resolution provenance');

client={qbVersion:'5.2.3.1',webApiVersion:'2.15.1',major:5};
await R.bind(client);
assert(!R.isCertified()&&R.current().qbVersion==='5.2.3','unknown fourth-component patch must inherit the nearest certified lower profile in the same major.minor series');
assert(R.resolutionInfo().mode==='INHERITED'&&R.resolutionInfo().resolvedFrom==='5.2.3','fourth-component inheritance must expose its source profile');
assert(R.current().sourceSha===catalog[1].sourceSha&&R.current().settingsNativeLocales.includes('zh_CN'),'inherited profile must retain source-bound translation routing assets');
assert(R.hasAction('torrentscontroller.h:tagsAction')&&R.hasTorrentInfoField('private'),'inherited patch must retain already-proven capabilities without inventing new ones');

client={qbVersion:'5.2.4',webApiVersion:'2.15.1',major:5};
await R.bind(client);
assert(R.current().qbVersion==='5.2.3'&&R.resolutionInfo().mode==='INHERITED','future qB patch must provisionally inherit the nearest certified lower patch in the same series');
assert(R.resolveTorrentAction('start')==='start'&&R.hasAction('torrentscontroller.h:tagsAction'),'future patch inheritance must keep proven qB5 actions usable');

client={qbVersion:'5.2.4',webApiVersion:'2.14.0',major:5};
await R.bind(client);
assert(R.current().fallback===true&&R.resolutionInfo().mode==='FALLBACK','future patch with an older WebAPI than its candidate base must not inherit incompatible source facts');

client={qbVersion:'4.9.99',webApiVersion:'2.9.3',major:4};
await R.bind(client);
assert(!R.isCertified(),'unknown qB stable/version must not be falsely certified');
assert(R.resolveTorrentAction('start')==='resume'&&R.upstreamTorrentFilter('stopped')==='paused','catalog miss may use conservative qB4 protocol-generation fallback');
assert(R.resolveTorrentAction('reannounce')===null&&!R.hasTorrentInfoField('tags'),'catalog miss must not invent later action/field provenance');
assert(R.supportsTorrentFilter('stalled')===false,'catalog miss must not invent non-floor filters');
assert(R.preferenceDescriptor('save_path')===null,'catalog miss must not invent preference setter provenance');
assert(R.detailFields('properties').length===0&&R.detailFields('trackers').length===0&&R.detailFields('files').length===0&&R.detailFields('webseeds').length===0,'catalog miss must not invent Torrent detail response-field provenance');
assert(events.some(event=>event.type==='weigg:release-profile'),'release profile binding must publish one semantic event');

console.log('Release profile contract passed: exact/equivalent stable facts remain certified, same-series future patches inherit the nearest lower certified profile, translation routes stay source-bound, and incompatible/unknown series remain fail-closed.');

import assert from 'node:assert/strict';
import {createCompactRuntime} from '../tools/qb-compact-runtime.mjs';

const sha4='1111111111111111111111111111111111111111';
const sha5='0b63c3d17373f6132ea211c9dcd4241284ccdfaf';
const profiles=[
  {qbVersion:'4.1.0',webApiVersion:'2.0.0',sourceSha:sha4,stable:true,officialWeiGSupport:true,apiActions:['appcontroller.h:preferencesAction','appcontroller.h:setPreferencesAction','torrentscontroller.h:resumeAction','torrentscontroller.h:pauseAction','torrentscontroller.h:recheckAction','torrentscontroller.h:addTrackersAction','torrentscontroller.h:propertiesAction','torrentscontroller.h:filesAction','torrentscontroller.h:trackersAction','torrentscontroller.h:webseedsAction'],apiActionParameters:{'torrentscontroller.h:resumeAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:pauseAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:recheckAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:addTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','paused','resumed'],torrentInfoParameters:['filter','category'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags'],torrentStates:['downloading','stalledDL','uploading','stalledUP','pausedDL','pausedUP','checkingDL','checkingUP','error','missingFiles'],torrentPropertiesFields:['save_path','total_size','share_ratio'],torrentTrackerFields:['url','status','num_peers'],torrentFileFields:['name','size','progress','priority'],torrentWebSeedFields:['url'],preferenceDescriptors:[{key:'save_path',getterPresent:true,setterPresent:true,readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true}]},
  {qbVersion:'5.2.3',webApiVersion:'2.15.1',sourceSha:sha5,stable:true,officialWeiGSupport:true,apiActions:['appcontroller.h:preferencesAction','appcontroller.h:setPreferencesAction','torrentscontroller.h:startAction','torrentscontroller.h:stopAction','torrentscontroller.h:tagsAction','torrentscontroller.h:reannounceAction','torrentscontroller.h:removeTrackersAction','torrentscontroller.h:propertiesAction','torrentscontroller.h:filesAction','torrentscontroller.h:trackersAction','torrentscontroller.h:webseedsAction'],apiActionParameters:{'torrentscontroller.h:startAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:stopAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:reannounceAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:removeTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','stopped','running','stalled'],torrentInfoParameters:['filter','tag'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','private'],torrentStates:['downloading','stalledDL','uploading','stalledUP','stoppedDL','stoppedUP','checkingDL','checkingUP','moving','error','missingFiles'],torrentPropertiesFields:['save_path','download_path','private','pieces_num','piece_size'],torrentTrackerFields:['url','status','num_seeds','tier'],torrentFileFields:['index','name','size','progress','priority'],torrentWebSeedFields:['url'],preferenceDescriptors:[{key:'save_path',getterPresent:true,setterPresent:true,readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true}]}
];
const rt=createCompactRuntime(profiles,{owners:['settings-schema.js','capabilities.js']});
const C=rt.W.CapabilityRegistry,S=rt.W.SettingsSchema;
assert.ok(C&&typeof C.bind==='function'&&typeof C.resolveTorrentActionDescriptor==='function','CapabilityRegistry must own compact release/source compatibility facts');
assert.equal(rt.requests.length,0,'compact contracts must load lazily');

let client={qbVersion:'v4.1.0',webApiVersion:'2.0.0',capabilities:{}};
await C.bind(client);
let release=C.releaseIdentity();
assert(C.isCertified()&&C.hasWriteProvenance(),'qB 4.1.0 exact compact release must be certified for writes');
assert.equal(release.qbVersion,'4.1.0');
assert.equal(release.resolutionMode,'EXACT');
assert.equal(release.resolvedFrom,'4.1.0');
assert(C.hasAction('appcontroller.h:preferencesAction')&&C.hasAction('appcontroller.h:setPreferencesAction'));
assert.deepEqual(Array.from(C.torrentFilters()),['all','downloading','seeding','stopped','running']);
assert.equal(C.upstreamTorrentFilter('stopped'),'paused');
assert.equal(C.upstreamTorrentFilter('running'),'resumed');
assert.equal(C.resolveTorrentActionDescriptor('start')?.endpoint,'resume');
assert.equal(C.resolveTorrentActionDescriptor('stop')?.endpoint,'pause');
assert.equal(C.resolveTorrentActionDescriptor('reannounce'),null);
assert.equal(C.supportsTorrentAction('removeTrackers'),false);
assert(C.hasTorrentInfoField('category')&&C.hasTorrentInfoField('tags')&&!C.hasTorrentInfoField('private'));
assert(C.torrentStates().includes('stalledDL')&&C.torrentStates().includes('checkingUP'));
assert(C.hasTorrentDetailField('properties','save_path')&&!C.hasTorrentDetailField('properties','private'));
assert(C.hasTorrentDetailField('trackers','num_peers')&&!C.hasTorrentDetailField('trackers','num_seeds'));
assert(C.hasTorrentDetailField('files','priority')&&!C.hasTorrentDetailField('files','index'));
assert.equal(S.descriptor('save_path')?.writable,true);

client={qbVersion:'5.2.3',webApiVersion:'2.15.1',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert(C.isCertified()&&release.qbVersion==='5.2.3'&&release.sourceSha===sha5);
assert.equal(C.resolveTorrentActionDescriptor('start')?.endpoint,'start');
assert.equal(C.resolveTorrentActionDescriptor('stop')?.endpoint,'stop');
assert.equal(C.resolveTorrentActionDescriptor('reannounce')?.endpoint,'reannounce');
assert.equal(C.resolveTorrentActionDescriptor('removeTrackers')?.endpoint,'removeTrackers');
assert(C.supportsTorrentFilter('stalled')&&C.hasTorrentInfoField('private')&&C.hasAction('torrentscontroller.h:tagsAction'));
assert(C.hasTorrentDetailField('properties','private')&&C.hasTorrentDetailField('properties','download_path'));
assert(C.hasTorrentDetailField('trackers','num_seeds')&&C.hasTorrentDetailField('files','index'));

client={qbVersion:'5.2.3-r1',webApiVersion:'2.15.1',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert(C.isCertified()&&C.hasWriteProvenance()&&release.qbVersion==='5.2.3');
assert.equal(release.resolutionMode,'EQUIVALENT');
assert.equal(release.detectedQbVersion,'5.2.3-r1');

client={qbVersion:'5.2.3.1',webApiVersion:'2.15.1',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert(!C.isCertified()&&!C.hasWriteProvenance()&&release.qbVersion==='5.2.3');
assert.equal(release.resolutionMode,'INHERITED');
assert.equal(release.resolvedFrom,'5.2.3');
assert(C.hasAction('torrentscontroller.h:tagsAction')&&C.hasTorrentInfoField('private'));
assert(!C.supportsTorrentAction('start'));
assert.equal(S.descriptor('save_path')?.writable,false);

client={qbVersion:'5.2.4',webApiVersion:'2.15.1',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert.equal(release.qbVersion,'5.2.3');
assert.equal(release.resolutionMode,'INHERITED');
assert(!C.hasWriteProvenance()&&!C.supportsTorrentAction('start'));

client={qbVersion:'5.2.4',webApiVersion:'2.14.0',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert.equal(release.fallback,true);
assert.equal(release.resolutionMode,'FALLBACK');
assert(!C.hasWriteProvenance());

client={qbVersion:'4.9.99',webApiVersion:'2.9.3',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert.equal(release.fallback,true);
assert(!C.isCertified()&&!C.hasWriteProvenance());
assert.equal(C.resolveTorrentActionDescriptor('start'),null);
assert.equal(C.upstreamTorrentFilter('stopped'),null);
assert.equal(C.hasTorrentInfoField('tags'),false);
assert.equal(C.supportsTorrentFilter('stalled'),false);
assert.equal(S.descriptor('save_path'),null);

assert.equal(rt.requests.filter(url=>url.includes('capabilities.json')).length,1);
assert.equal(rt.requests.filter(url=>url.includes('torrent-compat.json')).length,1);
assert.equal(rt.requests.filter(url=>url.includes('detail-compat.json')).length,1);
assert.equal(rt.requests.filter(url=>url.includes('source-actions.json')).length,1);
assert.equal(rt.requests.filter(url=>url.includes('settings-compat.json')).length,1);
assert.equal(rt.requests.some(url=>url.includes('qb-releases.json')||url.includes('qb-release-profiles/')),false,'browser compatibility resolution must not fetch retired release catalogs or profile shards');

console.log('Capability release-resolution contract passed: exact/equivalent releases own writes, inherited releases retain proven read facts while writes close, fallback is source-empty, and runtime loads compact contracts only.');

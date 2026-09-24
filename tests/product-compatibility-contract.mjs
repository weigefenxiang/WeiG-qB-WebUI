import assert from 'node:assert/strict';
import {createCompactRuntime} from '../tools/qb-compact-runtime.mjs';

const catalog=[
 {qbVersion:'4.1.0',webApiVersion:'2.0.0',sourceSha:'1'.repeat(40),stable:true,officialWeiGSupport:true,apiActions:['torrentscontroller.h:resumeAction','torrentscontroller.h:pauseAction','torrentscontroller.h:recheckAction','torrentscontroller.h:addTrackersAction'],apiActionParameters:{'torrentscontroller.h:resumeAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:pauseAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:addTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','completed','paused','resumed','active','inactive','errored'],torrentInfoParameters:['filter','category','sort','reverse','limit','offset'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','tracker','save_path'],torrentStates:['downloading','stalledDL','uploading','stalledUP','pausedDL','pausedUP','checkingDL','checkingUP','error','missingFiles'],preferenceDescriptors:[]},
 {qbVersion:'5.2.3',webApiVersion:'2.15.1',sourceSha:'2'.repeat(40),stable:true,officialWeiGSupport:true,apiActions:['torrentscontroller.h:startAction','torrentscontroller.h:stopAction','torrentscontroller.h:reannounceAction','torrentscontroller.h:removeTrackersAction'],apiActionParameters:{'torrentscontroller.h:startAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:stopAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:reannounceAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:removeTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','completed','stopped','running','active','inactive','stalled','errored'],torrentInfoParameters:['filter','category','tag','sort','reverse','limit','offset'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','private','tracker','save_path'],torrentStates:['downloading','stalledDL','uploading','stalledUP','stoppedDL','stoppedUP','checkingDL','checkingUP','moving','error','missingFiles'],preferenceDescriptors:[]}
];
const {W}=createCompactRuntime(catalog,{owners:['capabilities.js','torrent-semantics.js','qb-client.js']});
const C=W.CapabilityRegistry,T=W.TorrentSemantics,Client=W.QBClient;
const visual=t=>JSON.parse(JSON.stringify(T.progressVisual(t)));

let client=new Client();client.qbVersion='4.1.0';client.webApiVersion='2.0.0';client.major=4;await C.bind(client);
assert(C.isCertified(),'qB4 exact stable compact release must bind');
assert(C.hasTorrentInfoField('category')&&C.hasTorrentInfoField('tags'));
assert.equal(T.filterMode('stalled'),'local');
assert.equal(T.filterMode('checking'),'local');
assert(T.matchesStatus({state:'stalledDL',progress:.4,dlspeed:0,upspeed:0},'stalled',[]));
assert(T.matchesStatus({state:'checkingUP',progress:1,dlspeed:0,upspeed:0},'checking',[]));assert.deepEqual(visual({state:'pausedUP',progress:1,upspeed:0}),{state:'paused',active:false,percent:100});assert.deepEqual(visual({state:'stalledUP',progress:1,upspeed:0}),{state:'seed-idle',active:false,percent:100});assert.deepEqual(visual({state:'uploading',progress:1,upspeed:240}),{state:'seed',active:true,percent:100});
assert(!T.isSupportedFilter('private'));
let requests=[];client.request=(path,options)=>{requests.push({path,options});return Promise.resolve(null);};
await assert.rejects(client.reannounce('a'));await assert.rejects(client.removeTrackers('a','https://tracker.example/announce'));assert.equal(requests.length,0);

client=new Client();client.qbVersion='5.2.3';client.webApiVersion='2.15.1';client.major=5;await C.bind(client);requests=[];client.request=(path,options)=>{requests.push({path,options});return Promise.resolve(null);};await client.reannounce('b');await client.removeTrackers('b','https://tracker.example/announce');
assert.equal(requests.length,2);assert.equal(requests[0].path,'torrents/reannounce');assert.equal(requests[1].path,'torrents/removeTrackers');
assert.equal(T.filterMode('stalled'),'native');
assert(T.isSupportedFilter('private'));assert.deepEqual(visual({state:'stoppedUP',progress:1,upspeed:0}),{state:'paused',active:false,percent:100});assert.deepEqual(visual({state:'stalledUP',progress:1,upspeed:0}),{state:'seed-idle',active:false,percent:100});assert.deepEqual(visual({state:'downloading',progress:.4,dlspeed:0}),{state:'download-idle',active:false,percent:40});
console.log('Product compatibility contract passed: TorrentSemantics and QBClient consume source-compiled compact CapabilityRegistry facts; qB4 local derivation/fail-closed writes converge with qB5 native semantics.');

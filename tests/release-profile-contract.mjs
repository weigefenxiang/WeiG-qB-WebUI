import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/release-profile.js',import.meta.url),'utf8');
function assert(ok,msg){if(!ok)throw new Error(msg);}
const catalog=[
  {qbVersion:'4.1.0',webApiVersion:'2.0.0',officialWeiGSupport:true,apiActions:['torrentscontroller.h:resumeAction','torrentscontroller.h:pauseAction'],torrentFilters:['all','downloading','seeding','paused','resumed'],torrentInfoParameters:['filter','category'],preferenceDescriptors:[{key:'save_path',writable:true,setterPresent:true,writeType:'string',typeAgreement:'EXACT'}]},
  {qbVersion:'5.2.3',webApiVersion:'2.15.1',officialWeiGSupport:true,apiActions:['torrentscontroller.h:startAction','torrentscontroller.h:stopAction','torrentscontroller.h:tagsAction'],torrentFilters:['all','downloading','seeding','stopped','running','stalled'],torrentInfoParameters:['filter','tag','private'],preferenceDescriptors:[]}
];
let responseCatalog=catalog;
const events=[];
const window={WeiG:{buildAssetUrl:x=>x},console,dispatchEvent:event=>events.push(event)};window.window=window;
const context={window,console,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},fetch:async()=>({ok:true,status:200,json:async()=>responseCatalog})};
vm.runInNewContext(source,context,{filename:'release-profile.js'});
const R=window.WeiG.ReleaseProfile;
assert(R&&typeof R.bind==='function'&&typeof R.resolveTorrentAction==='function','W.ReleaseProfile must be the exact source-fact runtime owner');

let client={qbVersion:'v4.1.0',major:4};
await R.bind(client);
assert(R.isCertified(),'qB 4.1.0 exact catalog entry must be certified');
assert(R.current().qbVersion==='4.1.0','exact qB version must bind its exact stable profile');
assert(JSON.stringify(R.torrentFilters())===JSON.stringify(['all','downloading','seeding','stopped','running']),'qB4 paused/resumed aliases must canonicalize exactly once for UI consumers');
assert(R.upstreamTorrentFilter('stopped')==='paused'&&R.upstreamTorrentFilter('running')==='resumed','canonical qB4 filters must map back to exact upstream names at the HTTP boundary');
assert(R.resolveTorrentAction('start')==='resume'&&R.resolveTorrentAction('stop')==='pause','qB4 start/stop intents must resolve from exact action provenance');
assert(R.preferenceDescriptor('save_path')?.writable===true,'exact preference descriptor lookup failed');
assert(!R.hasInfoParameter('private'),'qB4 must not invent later torrents/info private support');

client={qbVersion:'5.2.3',major:5};
await R.bind(client);
assert(R.resolveTorrentAction('start')==='start'&&R.resolveTorrentAction('stop')==='stop','qB5 start/stop must resolve exact modern action names');
assert(R.supportsTorrentFilter('stalled')&&R.hasInfoParameter('private')&&R.hasAction('torrentscontroller.h:tagsAction'),'qB5 source-derived filter/parameter/action facts must be queryable');

client={qbVersion:'4.9.99',major:4};
await R.bind(client);
assert(!R.isCertified(),'unknown qB stable/version must not be falsely certified');
assert(R.resolveTorrentAction('start')==='resume'&&R.upstreamTorrentFilter('stopped')==='paused','catalog miss may use conservative qB4 protocol-generation fallback');
assert(R.supportsTorrentFilter('stalled')===false,'catalog miss must not invent non-floor filters');
assert(R.preferenceDescriptor('save_path')===null,'catalog miss must not invent preference setter provenance');
assert(events.some(event=>event.type==='weigg:release-profile'),'release profile binding must publish one semantic event');

console.log('Release profile contract passed: exact stable facts own aliases/actions/parameters/preferences, qB 4.1.0 is certifiable, and catalog misses degrade conservatively without inventing provenance.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const src=await fs.readFile(new URL('../webui/private/scripts/app.js',import.meta.url),'utf8');
function extract(start,end){const a=src.indexOf(start),b=src.indexOf(end,a);assert(a>=0&&b>a,'Missing owner boundary '+start);return src.slice(a,b);}
const pollSrc=extract('  var pollActive=false;','  async function setFilter(');
const queued=[];let wake,transferCalls=0,statusCalls=0;
const pollContext={app:{pollTimer:null,detailDockOpen:true},cfg:{refresh:2000},document:{hidden:false},
 W:{Router:{route:()=>({name:'home'})}},Number,console:{error(){}},clearTimeout(){},
 setTimeout(fn){queued.push(fn);return queued.length;},
 torrentScrollInteracting:()=>false,shouldRefreshTorrentPage:()=>false,
 loadPage:async()=>{},loadTransfer:async()=>{transferCalls++;},
 refreshDetailDock:()=>new Promise(resolve=>{wake=resolve;}),setStatus(){statusCalls++;},tr:k=>k};
vm.runInNewContext(pollSrc+';globalThis.startPoll=schedulePoll;',pollContext);
pollContext.startPoll();assert.equal(queued.length,1);
const first=queued.shift()();
pollContext.startPoll();assert.equal(queued.length,0,'No new timer during pending poll');
wake();await first;
assert.equal(queued.length,1,'Finally must reschedule after a pending poll');
pollContext.refreshDetailDock=async()=>{throw new Error('injected failure');};
await queued.shift()();
assert.equal(statusCalls,1,'Poll error should be contained');
assert.equal(queued.length,1,'Failed refresh must not stop future polling');
pollContext.refreshDetailDock=async()=>true;
await queued.shift()();
assert.equal(transferCalls,2,'Successful refresh must recover after a prior failure');

const routeSrc=extract('  async function route(){','  function showUnsupported(');
const location={hash:'#/settings',reload(){throw Error('unexpected reload');}};
let settingsReject,settingsEntered,toastCount=0,homeCalls=0;const rendered=[];
const settingsReady=new Promise(resolve=>{settingsEntered=resolve;});
const W={Router:{route(){return{ name:location.hash==='#/settings'?'settings':location.hash==='#/rss'?'rss':'home'};},home(){homeCalls++;location.hash='#/';}},
 Navigation:{loadRouteModule:async()=>{}},SettingsRenderer:{open:()=>new Promise((_resolve,reject)=>{settingsReject=reject;settingsEntered();})},
 toast(){toastCount++;}};
const routeContext={location,W,console:{error(){}},setView:v=>rendered.push(v),app:{torrents:[{}],detailDockOpen:false,client:{capabilities:{rss:true}}},
 capabilitySupported:()=>true,loadRSS:async()=>{throw new Error('RSS failed');},tr:k=>k};
vm.runInNewContext('var routeGeneration=0;'+routeSrc+';globalThis.runRoute=route;',routeContext);
const stale=routeContext.runRoute();await settingsReady;
location.hash='#/';await routeContext.runRoute();settingsReject(new Error('stale Settings failure'));await stale;
assert.equal(toastCount,0,'Stale route failure must remain invisible');
assert.equal(homeCalls,0,'Stale route must not navigate away from current home');
location.hash='#/rss';await routeContext.runRoute();
assert.equal(homeCalls,1,'Current RSS failure must recover to home');
assert.equal(toastCount,1,'Current route failure must surface one feedback event');
console.log('App async lifecycle contract passed: poll recovery/no overlap and stale-route error isolation.');

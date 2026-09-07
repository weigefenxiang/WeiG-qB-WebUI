import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let profile=null;
const calls=[];
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  const item=profile.apiActionParameters?.[action]||{};
  return{
    sourceAction:action,
    endpoint:(action.split(':')[1]||'').replace(/Action$/,''),
    parameters:Array.isArray(item.parameters)?item.parameters:[],
    required:Array.isArray(item.required)?item.required:[],
    optional:Array.isArray(item.optional)?item.optional:[]
  };
}
const releaseProfile={
  current:()=>profile,
  actionDescriptor:descriptor,
  hasAction:action=>!!descriptor(action),
  isCertified:()=>!!(profile&&profile.fallback!==true)
};
const WeiG={
  util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:releaseProfile
};
const window={WeiG};
const fetchMock=async(url,init={})=>{
  calls.push({url:String(url),init});
  if(String(url).endsWith('api/v2/app/preferences'))return new Response(JSON.stringify({save_path:'/downloads'}),{status:200,headers:{'content-type':'application/json'}});
  return new Response('',{status:200});
};
const context={window,fetch:fetchMock,URLSearchParams,FormData,Response,Blob,console};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const Client=window.WeiG.QBClient;
const client=new Client();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;

const PREF_READ='appcontroller.h:preferencesAction';
const PREF_WRITE='appcontroller.h:setPreferencesAction';
const EDIT='torrentscontroller.h:editTrackerAction';
const SEARCH_PLUGINS='searchcontroller.h:pluginsAction';
const SEARCH_START='searchcontroller.h:startAction';
const SEARCH_STATUS='searchcontroller.h:statusAction';
const SEARCH_RESULTS='searchcontroller.h:resultsAction';
const SEARCH_STOP='searchcontroller.h:stopAction';
const RSS_ITEMS='rsscontroller.h:itemsAction';
const RSS_ADD_FEED='rsscontroller.h:addFeedAction';
const RSS_REMOVE_ITEM='rsscontroller.h:removeItemAction';
const RSS_REFRESH='rsscontroller.h:refreshItemAction';
const RSS_RULES='rsscontroller.h:rulesAction';
const LOG_MAIN='logcontroller.h:mainAction';
const LOG_PEERS='logcontroller.h:peersAction';
profile={
  qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,
  apiActions:[PREF_READ,PREF_WRITE,EDIT],
  apiActionParameters:{
    [PREF_READ]:{parameters:[],required:[],optional:[]},
    [PREF_WRITE]:{parameters:['json'],required:['json'],optional:[]},
    [EDIT]:{parameters:['hash','url','newUrl','tier'],required:['hash','url'],optional:['newUrl','tier']}
  }
};
let value=await client.getPreferences();
assert.equal(value.save_path,'/downloads','source-proven future-major preference read must remain usable');
assert.equal(calls.at(-1).url,'api/v2/app/preferences');
await client.setPreferences({save_path:'/future'});
assert.equal(calls.at(-1).url,'api/v2/app/setPreferences');
assert.match(String(calls.at(-1).init.body),/(^|&)json=/,'setPreferences must preserve the canonical JSON form field');
await client.editTracker('abc','https://old.invalid/announce','https://new.invalid/announce');
let editCall=calls.at(-1),editForm=new URLSearchParams(String(editCall.init.body||''));
assert.equal(editCall.url,'api/v2/torrents/editTracker');
assert.equal(editForm.get('hash'),'abc');
assert.equal(editForm.get('url'),'https://old.invalid/announce','modern exact descriptor must select url from source parameters');
assert.equal(editForm.get('newUrl'),'https://new.invalid/announce');
assert.equal(editForm.has('origUrl'),false,'modern exact descriptor must not leak the legacy origUrl parameter');

let before=calls.length;
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[PREF_READ],apiActionParameters:{}};
await assert.rejects(client.setPreferences({save_path:'/blocked'}),/source-proven/,'missing future setPreferences action must fail closed');
assert.equal(calls.length,before,'unknown dangerous Settings write must fail before HTTP');

before=calls.length;
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[],apiActionParameters:{}};
await assert.rejects(client.getPreferences(),/source-proven/,'exact source profile without preferences action must not invent read support');
assert.equal(calls.length,before,'source-unproven Settings read must fail before HTTP');

before=calls.length;
profile={qbVersion:'6.0.0',webApiVersion:'99.0.0',fallback:true,apiActions:[],apiActionParameters:{}};
await assert.rejects(client.setPreferences({save_path:'/blocked-by-fallback'}),/source-proven/,'high future version alone must not inherit the latest known write semantics');
assert.equal(calls.length,before,'future fallback dangerous Settings write must make zero HTTP requests');

profile={
  qbVersion:'5.1.4',webApiVersion:'2.11.4',fallback:false,apiActions:[EDIT],
  apiActionParameters:{[EDIT]:{parameters:['hash','origUrl','newUrl'],required:['hash','origUrl','newUrl'],optional:[]}}
};
await client.editTracker('legacy','https://legacy-old.invalid/announce','https://legacy-new.invalid/announce');
editCall=calls.at(-1);editForm=new URLSearchParams(String(editCall.init.body||''));
assert.equal(editForm.get('origUrl'),'https://legacy-old.invalid/announce','legacy exact descriptor must select origUrl from source parameters');
assert.equal(editForm.has('url'),false,'legacy exact descriptor must not send the modern url parameter');

before=calls.length;
profile={
  qbVersion:'6.1.0',webApiVersion:'3.1.0',fallback:false,apiActions:[EDIT],
  apiActionParameters:{[EDIT]:{parameters:['hash','url','tier'],required:['hash','url'],optional:['tier']}}
};
await assert.rejects(client.editTracker('future','https://old.invalid/announce','https://new.invalid/announce'),/cannot prove URL editing/,'unknown future editTracker form must fail closed when newUrl is not source-proven');
assert.equal(calls.length,before,'unknown future editTracker form must fail before HTTP');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[SEARCH_PLUGINS],apiActionParameters:{}};
before=calls.length;
await client.searchPlugins();
assert.equal(calls.length,before+1,'source-proven Search plugins read must issue exactly one HTTP request');
assert.equal(calls.at(-1).url,'api/v2/search/plugins');
before=calls.length;
await assert.rejects(Promise.resolve().then(()=>client.searchStart('linux','enabled','all')),/source-proven/,'Search start must not inherit from top-level Search availability');
assert.equal(calls.length,before,'missing Search start action must fail before HTTP');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[SEARCH_START,SEARCH_STATUS,SEARCH_RESULTS,SEARCH_STOP],apiActionParameters:{}};
before=calls.length;
await assert.rejects(Promise.resolve().then(()=>client.searchPlugins()),/source-proven/,'Search plugins must fail when its own source action is absent');
assert.equal(calls.length,before,'missing Search plugins action must fail before HTTP');
await client.searchStart('linux','enabled','all');
await client.searchStatus(7);
await client.searchResults(7,10,0);
await client.searchStop(7);
assert.equal(calls.length,before+4,'source-proven Search lifecycle actions must remain usable on future major profiles');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[RSS_ITEMS,RSS_RULES],apiActionParameters:{}};
before=calls.length;
await client.rssItems(true);
await client.rssRules();
assert.equal(calls.length,before+2,'source-proven RSS reads must issue their own requests');
before=calls.length;
for(const action of [
  ()=>client.rssAddFeed('https://feed.invalid/rss',''),
  ()=>client.rssRemoveItem('missing'),
  ()=>client.rssRefreshItem('missing')
]){
  await assert.rejects(Promise.resolve().then(action),/source-proven/,'missing RSS child write action must fail closed');
  assert.equal(calls.length,before,'missing RSS child write action must fail before HTTP');
}
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[RSS_ADD_FEED,RSS_REMOVE_ITEM,RSS_REFRESH],apiActionParameters:{}};
await client.rssAddFeed('https://feed.invalid/rss','');
await client.rssRemoveItem('missing');
await client.rssRefreshItem('missing');
assert.equal(calls.length,before+3,'source-proven RSS child writes must remain usable independently of rss/items');

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[LOG_MAIN],apiActionParameters:{}};
before=calls.length;
await client.logs(-1);
assert.equal(calls.length,before+1,'source-proven main log read must issue one HTTP request');
before=calls.length;
await assert.rejects(Promise.resolve().then(()=>client.peerLogs(-1)),/source-proven/,'peer logs must not inherit from log/main availability');
assert.equal(calls.length,before,'missing peer log action must fail before HTTP');
profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:[LOG_PEERS],apiActionParameters:{}};
await client.peerLogs(-1);
assert.equal(calls.length,before+1,'source-proven peer logs must remain independently usable');

console.log(`QBClient provenance contract passed: ${calls.length} allowed HTTP calls; future-major exact source facts survive, while unproven Settings, Search, RSS, Logs and editTracker operations make zero HTTP requests.`);

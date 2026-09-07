import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const catalogPath=path.resolve(process.argv[2]||'');
assert.ok(catalogPath&&fs.existsSync(catalogPath),'Usage: node tests/full-stable-core-write-compat.mjs <qb-releases.json>');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'frozen core write matrix requires a non-empty release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','frozen core write matrix floor must remain qB 4.1.0');

const releaseSource=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const clientSource=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const W={buildAssetUrl:x=>x,util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
const window={WeiG:W,window:null,dispatchEvent(){}};window.window=window;
const context={window,console,URLSearchParams,FormData,Blob,CustomEvent:class{},fetch:async url=>{if(String(url).includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};throw new Error(`Unexpected fetch ${url}`);}};
vm.runInNewContext(releaseSource,context,{filename:'release-profile.js'});
vm.runInNewContext(clientSource,context,{filename:'qb-client.js'});
const R=W.ReleaseProfile,Client=W.QBClient;
assert.ok(R&&Client,'ReleaseProfile and QBClient must load');
const operations=[
  ['delete','delete',['hash-a',true]],
  ['recheck','recheck',['hash-a']],
  ['force','forceStart',['hash-a',true]],
  ['autotmm','setAutoManagement',['hash-a',true]],
  ['sequential','toggleSequential',['hash-a']],
  ['firstlast','toggleFirstLast',['hash-a']],
  ['top','topPriority',['hash-a']],
  ['bottom','bottomPriority',['hash-a']],
  ['location','setLocation',['hash-a','/downloads/new']],
  ['rename','renameTorrent',['hash-a','Renamed']],
  ['dllimit','setDownloadLimit',['hash-a',1024]],
  ['uplimit','setUploadLimit',['hash-a',2048]]
];
let calls=0;
for(const profile of catalog){
  assert.equal(profile.stable,true,`${profile.qbVersion}: stable profile required`);
  assert.notEqual(profile.officialWeiGSupport,false,`${profile.qbVersion}: official support required`);
  await R.bind({qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion});
  assert.equal(R.isCertified(),true,`${profile.qbVersion}: frozen profile must bind certified`);
  const client=new Client();client.qbVersion=profile.qbVersion;client.webApiVersion=profile.webApiVersion;
  for(const [kind,method,args] of operations){
    const desc=R.resolveTorrentActionDescriptor(kind);
    assert.ok(desc&&desc.sourceAction,`${profile.qbVersion}: ${kind} must retain exact source action provenance`);
    assert.ok(profile.apiActions.includes(desc.sourceAction),`${profile.qbVersion}: ${kind} resolved missing source action ${desc.sourceAction}`);
    const seen=[];client.request=async(reqPath,options={})=>{seen.push({path:reqPath,options});return null;};
    await client[method](...args);
    assert.equal(seen.length,1,`${profile.qbVersion}: ${method} must emit exactly one HTTP request`);
    assert.equal(seen[0].path,`torrents/${desc.endpoint}`,`${profile.qbVersion}: ${method} endpoint must follow ReleaseProfile source owner`);
    calls++;
  }
}
console.log(`Frozen core Torrent write compatibility passed: ${catalog.length} official stable releases executed ${operations.length} source-owned QBClient write methods each (${calls} dispatch checks total).`);

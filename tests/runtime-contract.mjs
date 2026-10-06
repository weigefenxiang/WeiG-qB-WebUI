import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const runtimeBase=path.join(root,'webui/private');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
function walk(abs,rel=''){
  return fs.readdirSync(abs,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
    ?walk(path.join(abs,entry.name),path.join(rel,entry.name))
    :[path.join(rel,entry.name).replaceAll('\\','/')]);
}

// Global product identity belongs here; feature gates must not duplicate version policy.
const version=read('VERSION').trim();
const webVersion=read('webui/VERSION').trim();
const packageVersion=JSON.parse(read('package.json')).version;
const productIdentity=JSON.parse(read('webui/private/product-identity.json'));
assert(version===webVersion&&version===packageVersion&&productIdentity?.version===version,`Version sources diverged: VERSION=${version}, webui/VERSION=${webVersion}, package.json=${packageVersion}, productIdentity=${productIdentity?.version||'missing'}`);

const required=[
  'webui/public/scripts/select-geometry.js',
  'webui/private/index.html',
  'webui/private/scripts/core.js',
  'webui/private/scripts/runtime-assets.js',
  'webui/private/scripts/qb-client.js',
  'webui/private/scripts/components.js',
  'webui/private/scripts/floating.js',
  'webui/private/scripts/rss.js',
  'webui/private/scripts/app.js'
];
for(const rel of required)assert(fs.existsSync(path.join(root,rel)),`Missing global runtime asset ${rel}`);

const index=read('webui/private/index.html');
assert(!/(?:src|href)=["'][^"']*(?:\/v\d+|-[vV]\d+\.)/i.test(index),'Private index references a version-labelled runtime asset');
assert(index.indexOf('scripts/core.js')<index.indexOf('scripts/app.js'),'core.js must load before app.js');
assert(index.indexOf('scripts/qb-client.js')<index.indexOf('scripts/app.js'),'qb-client.js must load before app.js');
assert(index.indexOf('scripts/rss.js')<index.indexOf('scripts/app.js'),'rss.js must load before app.js because App delegates RSS routes to W.RSSWorkspace');

const runtimeAssetSource=read('webui/private/scripts/runtime-assets.js');
const capabilitiesSource=read('webui/private/scripts/capabilities.js');
assert(index.indexOf('scripts/runtime-assets.js')<index.indexOf('scripts/i18n.js'),'RuntimeAssets must load before i18n');
assert(index.indexOf('scripts/runtime-assets.js')<index.indexOf('scripts/capabilities.js'),'RuntimeAssets must load before capability consumers');
assert(runtimeAssetSource.includes("DB_NAME='weig-runtime-assets'")&&runtimeAssetSource.includes('global.indexedDB'),'runtime asset persistence must use one IndexedDB owner');
assert(runtimeAssetSource.includes('SCHEMA,BUILD,namespace(options),identity(options)'),'runtime asset cache identity must include schema/build/namespace/exact caller identity');
assert(runtimeAssetSource.includes("cache:'no-store'"),'network miss must bypass qB no-store ambiguity because RuntimeAssets owns persistence explicitly');
assert(!runtimeAssetSource.includes('local'+'Storage')&&!runtimeAssetSource.includes('session'+'Storage')&&!runtimeAssetSource.includes('serviceWorker'),'runtime asset owner must not create a second StorageRuntime or Service Worker path');
assert(capabilitiesSource.includes('W.RuntimeAssets')&&capabilitiesSource.includes('.readJson('),'capability contracts must consume the shared runtime asset owner');
assert(!capabilitiesSource.includes("fetch(asset(path),{credentials:'same-origin',cache:'no-store'})"),'capabilities must retire its feature-local no-store loader');

let runtimeAssetFetches=0;
const runtimeAssetDocument={querySelector(sel){return sel==='meta[name="weig-build-sha"]'?{getAttribute(){return'abc123';}}:null;}};
const runtimeAssetWindow={WeiG:{},document:runtimeAssetDocument,location:{href:'http://nas.local/private/index.html'},URL,Map,Promise,Date,fetch(){runtimeAssetFetches++;return Promise.resolve({ok:true,text:()=>Promise.resolve('{"value":7}')});}};
const runtimeAssetContext=vm.createContext({window:runtimeAssetWindow,document:runtimeAssetDocument,URL,Map,Promise,Date,JSON,setTimeout,clearTimeout});
vm.runInContext(runtimeAssetSource,runtimeAssetContext,{filename:'runtime-assets.js'});
const RuntimeAssets=runtimeAssetWindow.WeiG.RuntimeAssets;
assert(RuntimeAssets&&RuntimeAssets.build==='abc123','RuntimeAssets must bind cache identity to injected exact BUILD');
const runtimeAssetFirst=await RuntimeAssets.readJson('data/example.json',{namespace:'test',identity:'qB@sha'});
const runtimeAssetSecond=await RuntimeAssets.readJson('data/example.json',{namespace:'test',identity:'qB@sha'});
assert(runtimeAssetFirst.value===7&&runtimeAssetSecond.value===7&&runtimeAssetFetches===1,'same-page duplicate runtime asset reads must coalesce/cache without a second network request');
await RuntimeAssets.invalidate('data/example.json',{namespace:'test',identity:'qB@sha'});
await RuntimeAssets.readJson('data/example.json',{namespace:'test',identity:'qB@sha'});
assert(runtimeAssetFetches===2,'explicit RuntimeAssets invalidation must force one fresh network read');

const runtimeFiles=walk(runtimeBase).filter(rel=>rel.startsWith('scripts/')&&rel.endsWith('.js'));
const qbClientCreators=[];
const noNativeHoverOwners=new Set(['scripts/app.js','scripts/components.js','scripts/floating.js','scripts/i18n.js','scripts/layout.js','scripts/settings.js','scripts/ui.js']);
for(const rel of runtimeFiles){
  const source=read('webui/private/'+rel);
  assert(!source.includes('MutationObserver'),`${rel} contains observer-driven runtime repair/ownership`);
  assert(!/(?:window|globalThis|global)\.fetch\s*=|\.prototype\.(?:open|send|fetch)\s*=/.test(source),`${rel} contains fetch/prototype monkey patching`);
  assert(!source.includes('local'+'Storage')&&!source.includes('session'+'Storage'),`${rel} must use the shared optional persistence owner`);
  if(noNativeHoverOwners.has(rel))assert(!/\.title\s*=|setAttribute\(\s*['\"]title['\"]|\.dataset\.tooltip\s*=|setAttribute\(\s*['\"]data-tooltip['\"]/.test(source),`${rel} recreates retired native title/data-tooltip hover metadata`);
  assert(!/(?:scripts|css)\/[A-Za-z0-9._-]*-[vV]\d+\.(?:js|css)/.test(source),`${rel} contains a hidden version-labelled runtime loader`);
  const count=(source.match(/new W\.QBClient\s*\(/g)||[]).length;
  if(count)qbClientCreators.push([rel,count]);
}
assert(qbClientCreators.length===1&&qbClientCreators[0][0]==='scripts/app.js'&&qbClientCreators[0][1]===1,`Exactly app.js may create one QBClient: ${JSON.stringify(qbClientCreators)}`);


const timeSource=read('webui/private/scripts/time.js');
assert(!timeSource.includes('System / Browser'),'Timezone presentation must not expose the retired System / Browser copy');
assert(timeSource.includes("if(zone==='system')return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'"),'Timezone system sentinel must continue resolving from the browser/system IANA zone');
assert(timeSource.includes('LOCAL_STORE.set(KEY,zone)'),'Timezone explicit selection must remain persisted through the shared optional persistence owner');
assert(timeSource.includes("return off+' · '+r;"),'Timezone labels must present only UTC offset plus resolved IANA zone');

// Browser fixtures may read VERSION but must not pin a WeiG 0.3.x product version.
for(const rel of walk(path.join(root,'tests')).filter(rel=>/^browser-.*\.mjs$/.test(path.basename(rel)))){
  const source=read('tests/'+rel);
  assert(!/\b0\.3\.\d+\b/.test(source),`${rel} hard-codes a WeiG product version; read canonical VERSION instead`);
}

console.log(`Runtime contract passed for WeiG ${version}: global ownership, no repair/monkey-patch runtime, one QBClient owner, and version-neutral browser fixtures.`);

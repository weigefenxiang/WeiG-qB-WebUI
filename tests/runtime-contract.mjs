import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';

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
const bootstrapPlan=JSON.parse(read('webui/private/bootstrap-plan.json'));
const startupScripts=bootstrapPlan.phases.flatMap(phase=>phase.scripts);
const startupIndex=path=>startupScripts.indexOf(path);
assert(!/(?:src|href)=["'][^"']*(?:\/v\d+|-[vV]\d+\.)/i.test(index),'Private index references a version-labelled runtime asset');
assert(index.includes("SEED='scripts/runtime-assets.js'")&&index.includes("PLAN='bootstrap-plan.json'"),'Private index must seed RuntimeAssets then hand off to the canonical bootstrap plan');
assert(!startupScripts.includes('scripts/runtime-assets.js'),'RuntimeAssets seed must not duplicate itself inside the bootstrap plan');
assert(startupIndex('scripts/core.js')>=0&&startupIndex('scripts/core.js')<startupIndex('scripts/app.js'),'core.js must load before app.js');
assert(startupIndex('scripts/qb-client.js')>=0&&startupIndex('scripts/qb-client.js')<startupIndex('scripts/app.js'),'qb-client.js must load before app.js');
for(const deferred of ['scripts/settings.js','scripts/rss.js','scripts/logs.js'])assert(!startupScripts.includes(deferred),deferred+' must remain route-demand loaded instead of leaking into startup');
assert(startupIndex('scripts/i18n.js')>=0&&startupIndex('scripts/capabilities.js')>=0,'i18n and capability consumers must remain inside the RuntimeAssets-owned startup plan');

const runtimeAssetSource=read('webui/private/scripts/runtime-assets.js');
const capabilitiesSource=read('webui/private/scripts/capabilities.js');
assert(runtimeAssetSource.includes("DB_NAME='weig-runtime-assets'")&&runtimeAssetSource.includes('global.indexedDB'),'runtime asset persistence must use one IndexedDB owner');
assert(runtimeAssetSource.includes('readBytes:readBytes')&&runtimeAssetSource.includes('readGzipJson:readGzipJson')&&runtimeAssetSource.includes('decodeDeflateJson:decodeDeflateJson'),'RuntimeAssets must be the binary/gzip/deflate transport owner');
assert(runtimeAssetSource.includes('SCHEMA,BUILD,namespace(options),identity(options)'),'runtime asset cache identity must include schema/build/namespace/exact caller identity');
assert(runtimeAssetSource.includes("cache:'no-store'"),'network miss must bypass qB no-store ambiguity because RuntimeAssets owns persistence explicitly');
assert(!runtimeAssetSource.includes('local'+'Storage')&&!runtimeAssetSource.includes('session'+'Storage')&&!runtimeAssetSource.includes('serviceWorker'),'runtime asset owner must not create a second StorageRuntime or Service Worker path');
assert(capabilitiesSource.includes('W.RuntimeAssets')&&capabilitiesSource.includes('.readJson('),'capability contracts must consume the shared runtime asset owner');
assert(capabilitiesSource.includes('decodeDeflateJson')&&!capabilitiesSource.includes('function inflateRaw')&&!capabilitiesSource.includes('function base64Bytes'),'CapabilityRegistry must consume RuntimeAssets compression decoding instead of owning a second inflater');
assert(!capabilitiesSource.includes("fetch(asset(path),{credentials:'same-origin',cache:'no-store'})"),'capabilities must retire its feature-local no-store loader');

let runtimeAssetFetches=0;
const runtimeAssetDocument={querySelector(sel){return sel==='meta[name="weig-build-sha"]'?{getAttribute(){return'abc123';}}:null;}};
const runtimeAssetGzip=gzipSync(Buffer.from('{"gzip":9}','utf8'));const runtimeAssetWindow={WeiG:{},document:runtimeAssetDocument,location:{href:'http://nas.local/private/index.html'},URL,Map,Promise,Date,atob:value=>Buffer.from(String(value),'base64').toString('binary'),fetch(input){runtimeAssetFetches++;if(String(input).includes('example.json.gz')){const bytes=runtimeAssetGzip;return Promise.resolve({ok:true,status:200,arrayBuffer:()=>Promise.resolve(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))});}return Promise.resolve({ok:true,status:200,text:()=>Promise.resolve('{"value":7}')});}};
const runtimeAssetContext=vm.createContext({window:runtimeAssetWindow,document:runtimeAssetDocument,URL,Map,Promise,Date,JSON,TextDecoder,Uint8Array,ArrayBuffer,setTimeout,clearTimeout});
vm.runInContext(runtimeAssetSource,runtimeAssetContext,{filename:'runtime-assets.js'});
const RuntimeAssets=runtimeAssetWindow.WeiG.RuntimeAssets;
assert(RuntimeAssets&&RuntimeAssets.build==='abc123','RuntimeAssets must bind cache identity to injected exact BUILD');
const runtimeAssetFirst=await RuntimeAssets.readJson('data/example.json',{namespace:'test',identity:'qB@sha'});
const runtimeAssetSecond=await RuntimeAssets.readJson('data/example.json',{namespace:'test',identity:'qB@sha'});
assert(runtimeAssetFirst.value===7&&runtimeAssetSecond.value===7&&runtimeAssetFetches===1,'same-page duplicate runtime asset reads must coalesce/cache without a second network request');
await RuntimeAssets.invalidate('data/example.json',{namespace:'test',identity:'qB@sha'});
await RuntimeAssets.readJson('data/example.json',{namespace:'test',identity:'qB@sha'});
assert(runtimeAssetFetches===2,'explicit RuntimeAssets invalidation must force one fresh network read');
const runtimeGzipFirst=await RuntimeAssets.readGzipJson('data/example.json.gz',{namespace:'test-gzip',identity:'qB@route'});const runtimeGzipSecond=await RuntimeAssets.readGzipJson('data/example.json.gz',{namespace:'test-gzip',identity:'qB@route'});
assert(runtimeGzipFirst.gzip===9&&runtimeGzipSecond.gzip===9&&runtimeAssetFetches===3,'same-page gzip JSON reads must decode once and reuse the RuntimeAssets binary cache');

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

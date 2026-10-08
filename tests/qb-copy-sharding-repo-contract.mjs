import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dataDir=path.join(root,'webui/private/data');
const stable=value=>Array.isArray(value)?value.map(stable):(value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value);
const contentId=(prefix,value)=>prefix+crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex').slice(0,20);
const files=(dir,suffix)=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?files(file,suffix):(entry.isFile()&&entry.name.endsWith(suffix)?[file]:[]);}):[];
const routeDir=path.join(dataDir,'qb-copy-routes'),bindingDir=path.join(dataDir,'qb-copy-bindings'),fallbackDir=path.join(dataDir,'qb-copy-fallback'),profileDir=path.join(dataDir,'qb-copy-profiles');
const capabilities=JSON.parse(fs.readFileSync(path.join(dataDir,'capabilities.json'),'utf8'));
const certifiedPrefixCount=65,appended=capabilities.releases.length-certifiedPrefixCount;
assert.ok(appended>=0,'Certified Copy release prefix was truncated');
assert.equal(new Set(capabilities.releases.slice(0,certifiedPrefixCount).map(x=>x.copyRouteId)).size,58,'Historic 65-release semantic routes changed');
const allRouteIds=new Set(capabilities.releases.map(x=>x.copyRouteId));
assert.equal(fs.existsSync(profileDir),false,'A62.7.3 must retire the 65 sourceSha copy-profile owner');
const routeFiles=files(routeDir,'.json.gz').sort(),bindingFiles=files(bindingDir,'.txt').sort(),packFiles=files(fallbackDir,'.json.gz').sort();
assert.equal(routeFiles.length,allRouteIds.size,'Copy route shards must correspond to all officially admitted releases');
assert.ok(bindingFiles.length>=33&&bindingFiles.length<=33+appended,'Certified binding baseline must be preserved with bounded appended bindings');
assert.ok(packFiles.length>=133&&packFiles.length<=133+64*appended,'Certified fallback baseline must be preserved with bounded additions');

const packs=new Map();let fallbackBytes=0;
for(const file of packFiles){const id=path.basename(file,'.json.gz'),body=fs.readFileSync(file),pack=JSON.parse(gunzipSync(body).toString('utf8'));fallbackBytes+=body.length;assert.match(id,/^p[0-9a-f]{20}$/);assert.equal(contentId('p',pack),id,'fallback path must be semantic content identity');assert.equal(pack.schemaVersion,4);assert.equal(pack.source,'qB-exact-official-fallback-pack');assert.equal(JSON.stringify(pack),JSON.stringify(stable(pack)),'fallback pack body must use canonical stable key order');assert.equal(Object.hasOwn(pack,'major'),false,'major must not remain a physical fallback owner');assert.equal(typeof pack.locale,'string');assert.equal(typeof pack.refs,'string');assert.equal(pack.refs.length%24,0);assert.equal(typeof pack.runs,'string');assert.ok(Array.isArray(pack.values)&&pack.values.every(v=>typeof v==='string'));const runs=pack.runs?pack.runs.split(',').map(v=>Number.parseInt(v,36)):[];assert.equal(runs.length,pack.refs.length/24);assert.equal(runs.reduce((sum,v)=>sum+v,0),pack.values.length);for(const def of Object.values(pack.sets||{}))assert.ok(Array.isArray(def)&&def.length===3);packs.set(id,pack);}
assert.ok(fallbackBytes<1978408+appended*1048576,'Copy fallback bytes exceeded approved per-release growth budget');
assert.ok(fallbackBytes<4733945,'fallback owner must stay below the pre-gzip green budget');

const routes=new Map();let routeBytes=0;
for(const file of routeFiles){const id=path.basename(file,'.json.gz'),body=fs.readFileSync(file),route=JSON.parse(gunzipSync(body).toString('utf8'));routeBytes+=body.length;assert.match(id,/^r[0-9a-f]{20}$/);assert.equal(route.routeId,id);assert.equal(route.schemaVersion,2);assert.equal(route.source,'qB-copy-semantic-runtime-route');assert.match(route.bindingId,/^b[0-9a-f]{20}$/);assert.ok(fs.existsSync(path.join(bindingDir,route.bindingId+'.txt')));assert.ok(Array.isArray(route.nativeLocales));assert.ok(route.fallback&&typeof route.fallback==='object'&&!Array.isArray(route.fallback));const fallbackLocales=Object.keys(route.fallback).sort(),fallbackSets={};for(const locale of fallbackLocales){const value=route.fallback[locale];assert.ok(Array.isArray(value)&&value.length===2);const [setId,packId]=value;fallbackSets[locale]=setId;if(setId===null){assert.equal(packId,null);continue;}assert.match(setId,/^t[0-9a-f]{20}$/);assert.match(packId,/^p[0-9a-f]{20}$/);const pack=packs.get(packId);assert.ok(pack,'route points to missing fallback pack '+packId);assert.equal(pack.locale,locale);assert.ok(pack.sets&&pack.sets[setId],'route points to fallback set absent from selected pack');}const descriptor={schemaVersion:1,source:'qB-copy-semantic-route',family:String(route.family||''),bindingId:route.bindingId,nativeLocales:[...route.nativeLocales].sort(),fallbackLocales,fallbackSets};assert.equal(contentId('r',descriptor),id,'route path must equal its semantic fingerprint');routes.set(id,route);}
assert.ok(routeBytes<118615+appended*8192,'Copy route bytes exceeded bounded added-release budget');

let bindingBytes=0;for(const file of bindingFiles){const id=path.basename(file,'.txt'),body=fs.readFileSync(file,'utf8');bindingBytes+=Buffer.byteLength(body);assert.match(id,/^b[0-9a-f]{20}$/);assert.ok(body.includes('@@BINDING\t'+id));assert.equal(body.includes('@@VAL\t'),false);assert.equal(body.includes('@@SET\t'),false);assert.equal(body.includes('@@BRIDGE\t'),false);}
const copyBytes=routeBytes+bindingBytes+fallbackBytes;assert.ok(copyBytes<5331818+appended*1048576,'Copy overall bytes exceeded bounded added-release budget');

assert.ok(capabilities.releases.length>=certifiedPrefixCount,'Historic 65 Copy releases must remain present');assert.equal(allRouteIds.size,routes.size,'Every route shard must have an admitted source owner');for(const row of capabilities.releases){assert.match(String(row.copyRouteId||''),/^r[0-9a-f]{20}$/);assert.ok(routes.has(row.copyRouteId),row.qbVersion+' points to missing semantic route');}
const i18n=fs.readFileSync(path.join(root,'webui/private/scripts/i18n.js'),'utf8');assert.ok(i18n.includes("data/qb-copy-routes/")&&i18n.includes("data/qb-copy-bindings/")&&i18n.includes("data/qb-copy-fallback/")&&i18n.includes('readGzipJson'));assert.equal(i18n.includes('data/qb-copy-profiles/'),false);assert.equal(i18n.includes("expectedVersion.split('.')[0]"),false,'browser runtime must not use qB major as copy routing identity');
const dist=fs.readFileSync(path.join(root,'tools/build-webui-dist.mjs'),'utf8');assert.ok(dist.includes("ownedCopyLayout:'private/data/qb-copy-{routes,bindings,fallback}'")&&dist.includes("ownedCopyCompression:'gzip-routes+fallback'"));
const copyProduct=fs.readFileSync(path.join(root,'tools/qb-runtime-copy-product.mjs'),'utf8');
const copyAdmission=fs.readFileSync(path.join(root,'tools/qb-runtime-copy-admission.mjs'),'utf8');
const ciSource=fs.readFileSync(path.join(root,'.github/workflows/ci.yml'),'utf8');
assert.ok(copyAdmission.includes('reconcileRuntimeCopyReleaseSet')&&copyAdmission.includes('appendRuntimeCopyRelease(source,target,id)'),'automatic Copy owner must be certified append-only admission');
assert.ok(ciSource.includes('node tools/qb-runtime-copy-admission.mjs check')&&ciSource.includes('node tools/qb-runtime-copy-admission.mjs admit')&&ciSource.includes('--historical=webui/private/data/capabilities.json'),'Copy materializer must preserve historical Copy source IDs');
assert.equal(ciSource.includes('node tools/qb-runtime-copy-product.mjs sync "$GENERATED/private/data" webui/private/data'),false,'automatic Copy materializer must never replace entire historic owner');
assert.ok(copyProduct.includes("Retired sourceSha qB copy profile owner reappeared.")&&copyProduct.includes("fs.rmSync(path.join(target,'qb-copy-profiles'),{recursive:true,force:true})"),'canonical copy-tree sync must reject and self-retire the old sourceSha profile owner');
for(const installer of ['installers/install.sh','installers/install.ps1']){const body=fs.readFileSync(path.join(root,installer),'utf8');for(const dir of ['qb-copy-routes','qb-copy-bindings','qb-copy-fallback'])assert.ok(body.includes(dir));assert.equal(body.includes('qb-copy-profiles'),false);}
console.log(JSON.stringify({kind:'A62_7_ROUTE_OWNER',releases:capabilities.releases.length,routes:routeFiles.length,bindings:bindingFiles.length,packs:packFiles.length,bytes:{routes:routeBytes,bindings:bindingBytes,fallback:fallbackBytes,total:copyBytes}},null,2));
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildWebuiDist} from '../tools/build-webui-dist.mjs';
import {pagesVerifyLanes} from '../tools/pages-verify-plan.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),privateRoot=path.join(root,'webui/private'),publicRoot=path.join(root,'webui/public');
const plan=JSON.parse(fs.readFileSync(path.join(privateRoot,'bootstrap-plan.json'),'utf8'));
const startup=['scripts/runtime-assets.js',...plan.phases.flatMap(phase=>phase.scripts)],deferred=['scripts/settings.js','scripts/rss.js','scripts/logs.js'];
const assetFile=relative=>{for(const base of [privateRoot,publicRoot]){const file=path.join(base,relative);if(fs.existsSync(file)&&fs.statSync(file).isFile())return file;}throw new Error('Bootstrap asset missing from private/public qB namespace: '+relative);};
const bytes=relative=>fs.statSync(assetFile(relative)).size;
const startupBytes=startup.reduce((sum,file)=>sum+bytes(file),0),deferredBytes=deferred.reduce((sum,file)=>sum+bytes(file),0),i18nBytes=bytes('scripts/i18n.js');
const baseline={sha:'ade2ebde4586667edc43624fc356e7b929c552c4',initialJsBytes:1176681,i18nBytes:326395};
for(const file of deferred)assert.equal(startup.includes(file),false,'route-only module leaked back into initial bootstrap: '+file);
assert.ok(deferredBytes>150000,'route sharding must defer at least 150 KiB of Settings/RSS/Logs JavaScript');
assert.ok(startupBytes<=Math.floor(baseline.initialJsBytes*.70),`Startup JavaScript budget regressed: ${startupBytes} > 70% of historical baseline ${baseline.initialJsBytes}`);
assert.ok(i18nBytes<=Math.floor(baseline.i18nBytes*.25),`I18n core budget regressed: ${i18nBytes} > 25% of historical baseline ${baseline.i18nBytes}`);

const localeDir=path.join(privateRoot,'data/weig-i18n'),localeFiles=fs.readdirSync(localeDir).filter(name=>name.endsWith('.json')).sort(),expected=['de','es','fr','ja','ko','pt','ru','zh-CN','zh-HK','zh-TW'].map(x=>x+'.json').sort();
assert.deepEqual(localeFiles,expected);
const localeBytes=localeFiles.reduce((sum,name)=>sum+fs.statSync(path.join(localeDir,name)).size,0),maxLocaleBytes=Math.max(...localeFiles.map(name=>fs.statSync(path.join(localeDir,name)).size));
assert.ok(maxLocaleBytes<64*1024,'one WeiG locale overlay became too large');
assert.ok(localeBytes<baseline.i18nBytes,'all non-English WeiG locale overlays combined should stay below the old monolithic i18n.js baseline');
for(const profile of ['payload','ui','full'])assert.ok(pagesVerifyLanes(profile).some(lane=>lane.name==='startup-performance'&&lane.script==='tests/pages-live-startup-performance.mjs'),profile+' Pages verification must retain the deployed startup-performance owner');

const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),out=fs.mkdtempSync(path.join(os.tmpdir(),'weig-runtime-dist-'));
try{
  const result=buildWebuiDist({webuiRoot:path.join(root,'webui'),outDir:out,sha:'f'.repeat(40),version});
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
  assert.equal(manifest.weigLocaleFiles,10);assert.equal(manifest.weigLocaleBytes,localeBytes);assert.equal(manifest.sizeReport.weigLocaleFiles,10);assert.equal(manifest.sizeReport.weigLocaleBytes,localeBytes);
  assert.equal(manifest.sizeReport.redundantBytes,0);assert.ok(manifest.sizeReport.zipBytes>0&&manifest.sizeReport.tarGzBytes>0);
  assert.equal(manifest.ownedCopyLayout,'private/data/qb-copy-{routes,bindings,fallback}');assert.equal(manifest.ownedCopyCompression,'gzip-routes+fallback');assert.equal(manifest.ownedCopyFiles,224,'materialized qB copy inventory must be 58 routes + 33 bindings + 133 packs');assert.ok(manifest.ownedCopyBytes<5331818,'semantic route owner must improve the previous gzip profile-owner total-copy budget');
  console.log(JSON.stringify({kind:'RUNTIME_ASSET_BUDGET',baseline,startup:{files:startup.length,bytes:startupBytes,reductionBytes:baseline.initialJsBytes-startupBytes,reductionPct:Number(((baseline.initialJsBytes-startupBytes)*100/baseline.initialJsBytes).toFixed(1))},i18n:{bytes:i18nBytes,reductionBytes:baseline.i18nBytes-i18nBytes},deferredRouteBytes:deferredBytes,locale:{files:localeFiles.length,totalBytes:localeBytes,maxBytes:maxLocaleBytes},distribution:{files:manifest.sizeReport.fileCount,uncompressedBytes:manifest.sizeReport.totalUncompressedBytes,zipBytes:manifest.sizeReport.zipBytes,tarGzBytes:manifest.sizeReport.tarGzBytes,qmAssets:manifest.qmAssets,qbCopyFiles:manifest.ownedCopyFiles,qbCopyBytes:manifest.ownedCopyBytes,qbCopyCompression:manifest.ownedCopyCompression}},null,2));
}finally{fs.rmSync(out,{recursive:true,force:true});}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {runtimeCopySnapshot} from '../tools/qb-runtime-copy-product.mjs';
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
assert.ok(fs.statSync(path.join(localeDir,'zh-HK.json')).size<8*1024,'Hong Kong differences must remain sparse; never duplicate the Taiwan locale');
assert.ok(localeBytes<baseline.i18nBytes,'all non-English WeiG locale overlays combined should stay below the old monolithic i18n.js baseline');
for(const profile of ['payload','ui','full'])assert.ok(pagesVerifyLanes(profile).some(lane=>lane.name==='startup-performance'&&lane.script==='tests/pages-live-startup-performance.mjs'),profile+' Pages verification must retain the deployed startup-performance owner');

// Real-qB automated hosting must consume the SAME installer archive as Pages/dist.
// A raw webui/ stage would pass browser smoke while bypassing A67 physical bundling.
const realQbStage=fs.readFileSync(path.join(root,'tests/real-qb-docker.sh'),'utf8');
const realQbBrowser=fs.readFileSync(path.join(root,'tests/real-qb-browser.mjs'),'utf8');
const realQbWorkflow=fs.readFileSync(path.join(root,'.github/workflows/real-qb-weig-product-add.yml'),'utf8');
assert.ok(realQbStage.includes('node tools/build-webui-dist.mjs --webui-root=webui')
  &&realQbStage.includes('tar -xzf "$STAGE/.dist/weig-qb-webui.tar.gz"')
  &&realQbStage.includes('--strip-components=1')
  &&realQbStage.includes('chmod 0755 "$STAGE"')
  &&realQbStage.includes('-v "$STAGE:/weig-webui:ro"')
  &&!realQbStage.includes('cp -a webui/. "$STAGE/"'),
  'Real-qB browser must mount the canonical materialized distribution rather than raw source');
assert.ok(realQbBrowser.includes("real-qb-materialized-assets")
  &&realQbBrowser.includes("data-weig-runtime-style")
  &&realQbBrowser.includes("data-weig-runtime-module")
  &&realQbBrowser.includes("resource.exactSha===weigSha")
  &&realQbBrowser.includes("resource.status===200"),
  'Real-qB browser must prove exact-SHA materialized JS/CSS and static hosting status');
for(const owner of ['webui/private/bootstrap-plan.json','tools/build-webui-dist.mjs',
  'tools/css-bundle-materializer.mjs','tools/js-bundle-materializer.mjs',
  'webui/private/scripts/runtime-assets.js'])
  assert.ok(realQbWorkflow.includes('- '+owner),
    'Real-qB product smoke must rerun when canonical bundle owner changes: '+owner);


const version=fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),out=fs.mkdtempSync(path.join(os.tmpdir(),'weig-runtime-dist-'));
try{
  const result=buildWebuiDist({webuiRoot:path.join(root,'webui'),outDir:out,sha:'f'.repeat(40),version});
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'));
  const tar=rel=>{
    const result=spawnSync('tar',['-xOzf',path.join(out,'weig-qb-webui.tar.gz'),'weig-qb-webui/'+rel],{encoding:'utf8'});
    assert.equal(result.status,0,'Materialized tar must contain '+rel+': '+result.stderr);
    return result.stdout;
  };
  const builtPlan=JSON.parse(tar('private/bootstrap-plan.json'));
  assert.ok(builtPlan.styles.length>=2&&builtPlan.styles.length<=5,'Installed artifact must use CSS bundles, not 19 source files');
  assert.ok(builtPlan.styles.every(name=>/^css\/startup-[0-9]+\.css$/.test(name)),'Installed stylesheet paths must be materialized');
  const groupedScripts=builtPlan.phases.flatMap(phase=>phase.scripts);
  assert.ok(groupedScripts.length>=14&&groupedScripts.length<=28,'Installed runtime must preserve bounded dependency-grouped JavaScript');
  assert.deepEqual(builtPlan.phases.map(x=>x.name),plan.phases.map(x=>x.name),'bundling must not alter logical phase ownership');
  for(const name of builtPlan.styles){
    const body=tar('private/'+name);
    assert.ok(body.startsWith('@charset "UTF-8";\n')&&(body.match(/@charset/g)||[]).length===1,'Bundled UTF-8 stylesheet must retain one first-byte charset');
  }
  const packageEntries=spawnSync('tar',['-tzf',path.join(out,'weig-qb-webui.tar.gz')],{encoding:'utf8'});
  assert.equal(packageEntries.status,0);
  for(const old of plan.styles)assert.equal(packageEntries.stdout.split('\n').includes('weig-qb-webui/private/'+old),false,'Source CSS must be retired from materialized ZIP/TAR runtime: '+old);

  assert.equal(manifest.weigLocaleFiles,10);assert.equal(manifest.weigLocaleBytes,localeBytes);assert.equal(manifest.sizeReport.weigLocaleFiles,10);assert.equal(manifest.sizeReport.weigLocaleBytes,localeBytes);
  assert.equal(manifest.sizeReport.redundantBytes,0);assert.ok(manifest.sizeReport.zipBytes>0&&manifest.sizeReport.tarGzBytes>0);
  assert.equal(manifest.ownedCopyLayout,'private/data/qb-copy-{routes,bindings,fallback}');assert.equal(manifest.ownedCopyCompression,'gzip-routes+fallback');const sourceCopyGroups=[['qb-copy-routes',/\.json\.gz$/],['qb-copy-bindings',/\.txt$/],['qb-copy-fallback',/\.json\.gz$/]];
  const sourceCopyCounts=sourceCopyGroups.map(([name,extension])=>{
    const folder=path.join(privateRoot,'data',name);
    const files=fs.readdirSync(folder).filter(file=>extension.test(file));
    assert.equal(files.length,fs.readdirSync(folder).length,'Source Copy shard directory must contain only recognized runtime assets: '+name);
    assert.ok(files.length>0,'No source Copy assets found in '+name);
    return files.length;
  });
  assert.equal(manifest.ownedCopyFiles,sourceCopyCounts.reduce((sum,value)=>sum+value,0),'Distribution Copy count must match canonical source-owned content-addressed shards');
  // Budget the immutable certified prefix separately from official new-release
  // dependencies. A source-proven appended route may need new bindings/packs;
  // it must not invalidate the former 65-release performance guarantee.
  const copyDir=path.join(privateRoot,'data'),copyInventory=runtimeCopySnapshot(copyDir);
  const copyFilesByPath=new Map(copyInventory.files.map(file=>[file.path,file]));
  const caps=JSON.parse(fs.readFileSync(path.join(copyDir,'capabilities.json'),'utf8'));
  const baselineCount=65,certifiedBaselineBytes=5281916;
  assert.ok(caps.releases.length>=baselineCount,'Certified Copy baseline was truncated');
  function copyReferences(profiles){
    const needed=new Set();
    function requireAsset(name){
      assert.ok(copyFilesByPath.has(name),'Missing source-proven Copy dependency '+name);
      needed.add(name);
    }
    for(const profile of profiles){
      const routeId=String(profile.copyRouteId||'');
      assert.match(routeId,/^r[0-9a-f]{20}$/,'Every admitted release must have a source-proven Copy route');
      const routeName='qb-copy-routes/'+routeId+'.json.gz';
      requireAsset(routeName);
      const route=JSON.parse(gunzipSync(fs.readFileSync(path.join(copyDir,routeName))).toString('utf8'));
      assert.equal(route.routeId,routeId,'Copy route descriptor must match the admitted source route ID');
      assert.match(String(route.bindingId||''),/^b[0-9a-f]{20}$/);
      requireAsset('qb-copy-bindings/'+route.bindingId+'.txt');
      for(const pair of Object.values(route.fallback||{})){
        assert.ok(Array.isArray(pair)&&pair.length===2,'Official Copy fallback entry must have source-set and pack slots');
        // The canonical generator intentionally uses [null,null] for a
        // locale without a source-proven fallback set. It requires no pack.
        if(pair[0]===null&&pair[1]===null)continue;
        assert.ok(/^t[0-9a-f]{20}$/.test(String(pair[0]||''))&&/^p[0-9a-f]{20}$/.test(String(pair[1]||'')),'Official Copy fallback dependency is incomplete');
        requireAsset('qb-copy-fallback/'+pair[1]+'.json.gz');
      }
    }
    return needed;
  }
  const historicalCopy=copyReferences(caps.releases.slice(0,baselineCount));
  const allCopy=copyReferences(caps.releases);
  assert.equal(allCopy.size,copyInventory.files.length,'Distribution must not carry unreferenced or duplicate Copy shards');
  const bytesFor=names=>[...names].reduce((total,name)=>total+copyFilesByPath.get(name).bytes,0);
  const historicalBytes=bytesFor(historicalCopy);
  const newlyRequired=[...allCopy].filter(name=>!historicalCopy.has(name));
  const addedBytes=bytesFor(newlyRequired),newReleases=caps.releases.length-baselineCount;
  assert.equal(historicalBytes,certifiedBaselineBytes,'Immutable historical Copy owner changed size');
  assert.ok(historicalBytes<5331818,'Original 65-release Copy performance budget regressed');
  assert.equal(manifest.ownedCopyBytes,historicalBytes+addedBytes,'Distribution Copy bytes must be fully explained by old plus official new source dependencies');
  assert.ok(addedBytes<=certifiedBaselineBytes*0.2*newReleases,'New official Copy dependencies exceeded the bounded per-release growth budget');
  console.log(JSON.stringify({kind:'RUNTIME_ASSET_BUDGET',baseline,startup:{files:startup.length,bytes:startupBytes,reductionBytes:baseline.initialJsBytes-startupBytes,reductionPct:Number(((baseline.initialJsBytes-startupBytes)*100/baseline.initialJsBytes).toFixed(1))},i18n:{bytes:i18nBytes,reductionBytes:baseline.i18nBytes-i18nBytes},deferredRouteBytes:deferredBytes,locale:{files:localeFiles.length,totalBytes:localeBytes,maxBytes:maxLocaleBytes},distribution:{files:manifest.sizeReport.fileCount,uncompressedBytes:manifest.sizeReport.totalUncompressedBytes,zipBytes:manifest.sizeReport.zipBytes,tarGzBytes:manifest.sizeReport.tarGzBytes,qmAssets:manifest.qmAssets,qbCopyFiles:manifest.ownedCopyFiles,qbCopyBytes:manifest.ownedCopyBytes,qbCopyCompression:manifest.ownedCopyCompression}},null,2));
}finally{fs.rmSync(out,{recursive:true,force:true});}

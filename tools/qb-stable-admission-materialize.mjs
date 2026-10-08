#!/usr/bin/env node
// A64 isolated official-source admission materializer. This script writes only
// canonical generated owners; the caller owns preflight, validation, and SAFE-REF.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {assertFrozenPrefix,verifyLkg,promotedManifest} from './qb-stable-admission.mjs';
import {catalogIdentity,assertCatalogIdentity} from './qb-catalog-identity.mjs';
import {packSettingsRuntime,compileCompactRuntime} from './qb-compact-runtime.mjs';
import {appendRuntimeCopyRelease} from './qb-runtime-copy-product.mjs';
import {rebindCopyRoutes} from './qb-copy-route-control-plane.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const write=(file,value,indent=2)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,indent)+'\n','utf8');};
const ensure=(condition,reason)=>{if(!condition)throw new Error(reason);};
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stageArg=process.argv.slice(2);
const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));

export function appendExactLocaleOverlay(previous,candidate,enriched,catalogSha256,evidence){
  ensure(previous?.schemaVersion===1&&previous.profileCount===candidate.length-1,'Existing certified Locale owner must match the immutable Frozen prefix.');
  ensure(previous.profiles.length===previous.profileCount,'Existing certified Locale records are missing.');
  for(let i=0;i<previous.profileCount;i++){
    ensure(previous.profiles[i].qbVersion===candidate[i].qbVersion&&previous.profiles[i].sourceSha===candidate[i].sourceSha,'Existing Locale source owner diverged at '+i);
  }
  const newest=enriched.at(-1),release=candidate.at(-1);
  ensure(newest.qbVersion===release.qbVersion&&newest.sourceSha===release.sourceSha,'New Locale source identity changed during enrichment.');
  const locales=(newest.webuiLocales||[]).map(x=>String(x&&typeof x==='object'?x.value:x)).filter(Boolean);
  ensure(locales.length>0&&new Set(locales).size===locales.length,'Newest stable official locale inventory is incomplete or duplicated.');
  const sets=structuredClone(previous.localeSets),existing=Object.keys(sets).find(key=>eq(sets[key],locales));
  const numeric=Object.keys(sets).map(key=>Number(key.slice(1))).filter(Number.isFinite);
  const name=existing||'s'+(Math.max(0,...numeric)+1);
  if(!existing)sets[name]=locales;
  return {...previous,profileCount:candidate.length,latestAdmittedStable:release.qbVersion,baseCatalogSha256:catalogSha256,sourceEvidence:evidence,
    localeSets:sets,profiles:[...previous.profiles,{qbVersion:release.qbVersion,sourceSha:release.sourceSha,source:String(newest.webuiLocaleSource||'unresolved'),localeSet:name}]};
}

function materialize(stage,prefCompactPath,generatedDataDir,generatedQmDir,stagedCompactDir){
  const oldCatalogPath=path.join(root,'tests/fixtures/qb-release-catalog.lkg.json'),oldManifestPath=path.join(root,'tools/data/qb-stable-lkg.json');
  const existing=read(oldCatalogPath),oldManifest=read(oldManifestPath);
  const sourcePath=path.join(stage,'qb-release-catalog.lkg.json'),sourceManifestPath=path.join(stage,'qb-stable-lkg.json');
  const candidate=read(sourcePath),staged=read(sourceManifestPath),enriched=read(path.join(stage,'qb-releases.enriched.json'));
  verifyLkg({catalog:candidate,manifest:staged,catalogPath:sourcePath});
  const delta=assertFrozenPrefix(existing,candidate,'A64 exact-source product materialization');
  ensure(delta.length===1,'A64 materializer admits only one new official stable release at a time.');
  ensure(staged.lastAdmission?.status==='PENDING_DOMAIN_ADMISSION','Cannot consume a falsely pre-admitted candidate.');
  ensure(enriched.length===candidate.length,'Native Locale/Settings/Copy extraction must cover every Frozen release.');
  for(let i=0;i<candidate.length;i++)ensure(enriched[i].qbVersion===candidate[i].qbVersion&&enriched[i].sourceSha===candidate[i].sourceSha,'Source-enriched catalog identity mismatch at '+i);
  const behavior=read(path.join(stage,'qb-translator-behavior.json'));
  ensure(behavior.profileCount===candidate.length&&behavior.profiles.length===candidate.length,'Official translator behavior release count is incomplete.');
  for(let i=0;i<candidate.length;i++)ensure(behavior.profiles[i].qbVersion===candidate[i].qbVersion&&behavior.profiles[i].sourceSha===candidate[i].sourceSha&&behavior.families[behavior.profiles[i].family],'Official translator source mismatch at '+i);
  const identity=catalogIdentity(candidate);
  const proof=read(path.join(stagedCompactDir,'source-only-proof.json'));
  assertCatalogIdentity(proof.catalogIdentity,identity,'Verified source compact stage');
  ensure(proof.profileCount===candidate.length&&proof.latestStable===candidate.at(-1).qbVersion,'Staged compact source set differs from Frozen.');
  ensure(proof.independentDomainCensusComplete===false,'Source-only stage must not pretend product validation completed.');
  const prefs=read(prefCompactPath);
  ensure(prefs.releases?.length===candidate.length,'Independent Settings Preferences source is incomplete.');
  assertCatalogIdentity(prefs.catalogIdentity,identity,'Independent native Preferences compact source');
  const settings=packSettingsRuntime(prefs,identity).manifest;
  const admitted=promotedManifest(oldManifest,existing,candidate,{validationCommit:process.env.GITHUB_SHA||null,admittedAt:new Date().toISOString()});
  admitted.catalogSha256=sha(sourcePath);
  admitted.seedEvidence={weiGCommit:process.env.GITHUB_SHA,ciRunId:Number(process.env.WEIG_SOURCE_RUN_ID||0),
    artifactName:String(process.env.WEIG_SOURCE_ARTIFACT||''),verifiedDate:new Date().toISOString().slice(0,10),mode:'official-new-stable-source-admission'};
  const locale=appendExactLocaleOverlay(read(path.join(root,'tools/data/qb-locale-lkg.json')),candidate,enriched,admitted.catalogSha256,admitted.seedEvidence);
  // Generated files are built within immutable, explicitly allowed product owners.
  write(path.join(root,'tests/fixtures/qb-release-catalog.lkg.json'),candidate);
  ensure(sha(oldCatalogPath)===admitted.catalogSha256,'Written Frozen release JSON diverged from source-stage hash.');
  write(oldManifestPath,admitted);
  write(path.join(root,'tools/data/qb-locale-lkg.json'),locale,0);
  write(path.join(root,'tools/data/qb-translator-behavior-lkg.json'),behavior);
  const dataDir=path.join(root,'webui/private/data');
  const historicalCopyReleases=read(path.join(dataDir,'capabilities.json')).releases;
  write(path.join(dataDir,'settings-compat.json'),settings,0);
  const compact=compileCompactRuntime(candidate,{includeSettings:true});
  for(const [filename,value] of Object.entries({'capabilities.json':compact.capabilityData,'torrent-compat.json':compact.torrentData,
    'detail-compat.json':compact.detailData,'source-actions.json':compact.actionData})){
    assertCatalogIdentity(value.catalogIdentity,identity,'Staged '+filename);
    write(path.join(dataDir,filename),value);
  }
  const rss=read(path.join(stagedCompactDir,'rss.json'));
  ensure(rss.releaseSet?.count===candidate.length&&rss.releaseSet.last===candidate.at(-1).qbVersion,'Staged RSS release boundary mismatch.');
  write(path.join(dataDir,'rss-compat.json'),rss);
  const index=path.join(generatedDataDir,'qb-releases.json');
  ensure(fs.existsSync(index),'Source-packaged Copy index must exist.');
  const newestExact=read(index).at(-1);
  ensure(newestExact?.qbVersion===candidate.at(-1).qbVersion&&newestExact?.sourceSha===candidate.at(-1).sourceSha,'New Copy source identity differs from the official newest Frozen release.');
  const copy=appendRuntimeCopyRelease(generatedDataDir,dataDir,newestExact.copyRouteId);
  const boundCopy=rebindCopyRoutes(read(index),read(path.join(dataDir,'capabilities.json')),{write:true,capabilityPath:path.join(dataDir,'capabilities.json'),historicalReleases:historicalCopyReleases});
  ensure(boundCopy.releaseCount===candidate.length,'Materialized Copy control plane does not cover every stable release.');
  // The source catalog is offline provenance only; runtime uses compact
  // Frozen-derived contracts and content-addressed qB Copy shards.
  ensure(fs.existsSync(generatedQmDir),'Source-owned qB QM directory is missing.');
  const qms=fs.readdirSync(generatedQmDir).filter(name=>/^webui_[^/]+\.qm$/.test(name));
  ensure(qms.length>0,'No source-derived native QM translations were materialized.');
  const qmDestination=path.join(root,'webui/translations');
  fs.mkdirSync(qmDestination,{recursive:true});
  for(const name of qms)fs.copyFileSync(path.join(generatedQmDir,name),path.join(qmDestination,name));
  return {source:'exact-official-stable-source-materializer',admitted:candidate.at(-1).qbVersion,profileCount:candidate.length,
    frozenSha256:admitted.catalogSha256,catalogIdentity:identity,settingsPayload:settings.payload.sha256,qmCount:qms.length,copyCounts:copy.target.counts,copyRoutes:boundCopy.routeCount,copyFilesAdded:copy.appendedFiles,historicalSourceDrift:boundCopy.historicalSourceDrift,
    status:'MATERIALIZED_PENDING_EXACT_SHA_REAL_QB_AND_CI'};
}

if(isMain){
  try{
    ensure(stageArg.length===5,'Usage: node tools/qb-stable-admission-materialize.mjs <source-stage> <preferences-settings-compact.json> <generated-data-dir> <generated-qm-dir> <source-compact-dir>');
    ensure(process.cwd()===root,'Run materializer only at the public repository root.');
    const paths=stageArg.map(p=>path.resolve(p));
    for(const p of paths)ensure(fs.existsSync(p),'Missing canonical source evidence: '+p);
    const out=materialize(...paths);
    console.log(JSON.stringify(out));
  }catch(e){console.error(e?.stack||e);process.exitCode=1;}
}

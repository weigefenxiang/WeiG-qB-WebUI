#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyLkg,assertEnrichedCatalogBinding} from './qb-stable-admission.mjs';
import {compileCompactRuntime} from './qb-compact-runtime.mjs';
import {catalogIdentity,assertCatalogIdentity} from './qb-catalog-identity.mjs';
import {compileRssCompat} from './qb-rss-compact.mjs';

const assert=(ok,message)=>{if(!ok)throw new Error(message);};

export function verifyStagedCompactSourceIdentity(manifest,catalog,core,rss){
  const identity=core?.catalogIdentity||{};
  assertCatalogIdentity(identity,catalogIdentity(catalog),'Frozen-derived staged compact runtime');
  assert(identity.releaseCount===catalog.length&&identity.latestAdmittedStable===manifest.latestAdmittedStable,'Staged compact release identity does not match candidate Frozen.');
  assert(identity.supportFloor===manifest.supportFloor,'Staged compact support floor changed.');
  const sources=[core.capabilityData,core.torrentData,core.detailData,core.actionData];
  for(const value of sources){
    assert(value&&JSON.stringify(value.catalogIdentity)===JSON.stringify(identity),'One staged compact runtime domain diverged from the canonical source identity.');
  }
  const releases=core.capabilityData?.releases||[];
  assert(releases.length===catalog.length,'Staged compact release count mismatch.');
  for(let i=0;i<catalog.length;i++){
    assert(releases[i].qbVersion===catalog[i].qbVersion&&releases[i].sourceSha===catalog[i].sourceSha,'Staged compact release SHA mismatch at '+i);
  }
  assert(rss?.releaseSet?.count===catalog.length&&rss?.releaseSet?.last===manifest.latestAdmittedStable,'Staged RSS source boundary diverged from Frozen.');
  return{schemaVersion:1,status:'SOURCE_COMPACT_STAGED_NOT_PRODUCT_ADMITTED',profileCount:catalog.length,latestStable:manifest.latestAdmittedStable,catalogIdentity:identity,domains:['capabilities','torrent','detail','actions','rss'],settingsCompactCertified:false,independentDomainCensusComplete:false,realWeiGAddTorrentPassed:false};
}

const self=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(self){
  try{
    const stage=path.resolve(process.argv[2]||''),out=path.resolve(process.argv[3]||'');
    assert(fs.existsSync(stage)&&out,'Usage: node tools/qb-stable-stage-compact.mjs <staged-candidate-directory> <new-output-directory>');
    assert(!fs.existsSync(out),'Staged compact output directory must not exist (no overwriting).');
    const catalogPath=path.join(stage,'qb-release-catalog.lkg.json');
    const manifest=JSON.parse(fs.readFileSync(path.join(stage,'qb-stable-lkg.json'),'utf8'));
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
    verifyLkg({catalog,manifest,catalogPath});
    assert(manifest.lastAdmission?.status==='PENDING_DOMAIN_ADMISSION','Staged compact proof must not consume an admitted product manifest.');
    const enriched=JSON.parse(fs.readFileSync(path.join(stage,'qb-releases.enriched.json'),'utf8'));
    assertEnrichedCatalogBinding(catalog,enriched);
    const core=compileCompactRuntime(catalog,{includeSettings:false});
    const rss=compileRssCompat(enriched);
    const proof=verifyStagedCompactSourceIdentity(manifest,catalog,core,rss);
    fs.mkdirSync(out);
    for(const [name,value] of [['capabilities',core.capabilityData],['torrent',core.torrentData],['detail',core.detailData],['actions',core.actionData],['rss',rss]]){
      fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value)+'\n','utf8');
    }
    fs.writeFileSync(path.join(out,'source-only-proof.json'),JSON.stringify(proof,null,2)+'\n','utf8');
    console.log(JSON.stringify({status:proof.status,count:proof.profileCount,domains:proof.domains}));
  }catch(e){console.error(e?.stack||e);process.exitCode=1;}
}

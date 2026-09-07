import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {compareVersions,readLedger,summarizeLedger,validateLedger,validateModernChangelogCoverage} from './qb-webapi-evolution.mjs';

const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
const catalogPath=path.resolve(process.argv[3]||process.env.QB_RELEASE_CATALOG||'');
if(!qbRoot||!fs.existsSync(qbRoot)||!catalogPath||!fs.existsSync(catalogPath)){console.error('Usage: node tools/qb-webapi-evolution-audit.mjs <qBittorrent-clone> <catalog.json>');process.exit(2);}
const ledger=readLedger(new URL('./data/qb-webapi-evolution-ledger.json',import.meta.url));validateLedger(ledger);
const summary=summarizeLedger(ledger),catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
if(!Array.isArray(catalog)||!catalog.length)throw new Error('empty qB release catalog');
function git(...args){return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function releaseSection(changelog,qbVersion){
  const escaped=String(qbVersion).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),match=new RegExp(`^.* - v${escaped}\\s*$`,'m').exec(changelog);
  if(!match)return null;const start=match.index,tail=changelog.slice(start+match[0].length),next=/^.* - v\d+\.\d+(?:\.\d+){1,2}\s*$/m.exec(tail);
  return changelog.slice(start,next?start+match[0].length+next.index:changelog.length);
}
const official=catalog.filter(item=>item?.stable===true&&item?.officialWeiGSupport!==false);
if(!official.length)throw new Error('catalog has no supported stable profiles');
if(String(official[0].qbVersion)!==ledger.scope.floorQb||String(official[0].webApiVersion)!==ledger.scope.floorApi)throw new Error(`support floor drifted: ${official[0].qbVersion}/${official[0].webApiVersion}`);
let previous=null;const spine=new Set(ledger.spine);
for(const profile of official){
  const version=String(profile.webApiVersion||'');
  if(compareVersions(version,ledger.scope.ceiling)>0)throw new Error(`${profile.qbVersion}: WebAPI ${version} exceeds audited ceiling ${ledger.scope.ceiling}`);
  if(compareVersions(version,ledger.scope.floorApi)<0)throw new Error(`${profile.qbVersion}: WebAPI ${version} predates support floor`);
  if(!spine.has(version))throw new Error(`${profile.qbVersion}: stable WebAPI ${version} is absent from ledger spine`);
  if(previous&&previous.webApiVersion!==version&&!Object.prototype.hasOwnProperty.call(ledger.revisions,version))throw new Error(`${profile.qbVersion}: WebAPI boundary ${previous.webApiVersion} -> ${version} has no revision evidence`);
  previous=profile;
}
const modernFile=path.join(qbRoot,'WebAPI_Changelog.md');if(!fs.existsSync(modernFile))throw new Error('upstream WebAPI_Changelog.md is missing');
const modern=validateModernChangelogCoverage(ledger,fs.readFileSync(modernFile,'utf8'));
for(const [version,raw] of Object.entries(ledger.revisions)){
  for(const record of (Array.isArray(raw)?raw:[raw])){
    if(record.t!=='source_commit')continue;
    git('cat-file','-e',`${record.sha}^{commit}`);
    const header=git('show',`${record.sha}:src/webui/webapplication.h`),expected=version.replaceAll('.','\\s*,\\s*');
    if(!new RegExp(`API_VERSION\\s*\\{\\s*${expected}\\s*\\}`).test(header))throw new Error(`${version}: source commit does not expose WebAPI ${version}`);
  }
}
const changelogFile=path.join(qbRoot,'Changelog');if(!fs.existsSync(changelogFile))throw new Error('upstream Changelog is missing');
const changelog=fs.readFileSync(changelogFile,'utf8');
const releaseEvidence=[];
for(const [version,raw] of Object.entries(ledger.revisions)){
  for(const record of (Array.isArray(raw)?raw:[raw]))if(record.t==='release_changelog'&&record.q&&record.x)releaseEvidence.push({q:record.q,v:version,x:record.x});
}
for(const item of ledger.supplements||[])releaseEvidence.push({q:item.q,v:item.v,x:item.x});
for(const item of releaseEvidence){
  const section=releaseSection(changelog,item.q);if(!section)throw new Error(`cannot locate qB ${item.q} release section`);
  if(!section.includes(item.x))throw new Error(`qB ${item.q}/WebAPI ${item.v}: release evidence text not found: ${item.x}`);
}
console.log(`WebAPI evolution audit passed: ${official.length} supported stable profiles; ${summary.evidenceEntries} evidence entries / ${summary.changes} classified changes; SOURCE_DERIVED=${summary.classifications.SOURCE_DERIVED}, CONTRACT_COVERED=${summary.classifications.CONTRACT_COVERED}, MISSING=${summary.classifications.MISSING}, NOT_APPLICABLE=${summary.classifications.NOT_APPLICABLE}, UNCLASSIFIED=${summary.classifications.UNCLASSIFIED}; modern changelog PRs=${modern.pullRequests}; ceiling=${summary.ceiling}.`);

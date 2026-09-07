import fs from 'node:fs';

export const CLASSIFICATIONS=Object.freeze(['SOURCE_DERIVED','CONTRACT_COVERED','NOT_APPLICABLE','MISSING','UNCLASSIFIED']);
const OWNER_BY_CODE=Object.freeze({S:'tools/qb-release-catalog.mjs',C:'simulator/protocol/endpoint-contracts.js',M:null,N:null});
function fail(message){throw new Error(message);}
function parts(version){return String(version||'').split('.').map(value=>Number.parseInt(value,10)||0);}
export function compareVersions(left,right){const a=parts(left),b=parts(right),n=Math.max(a.length,b.length);for(let i=0;i<n;i++){const d=(a[i]||0)-(b[i]||0);if(d)return Math.sign(d);}return 0;}
export function readLedger(file){return JSON.parse(fs.readFileSync(file,'utf8'));}

function allChanges(ledger){
  const rows=[];
  for(const [version,raw] of Object.entries(ledger.revisions||{})){
    const records=Array.isArray(raw)?raw:[raw];
    for(const record of records)for(const change of record?.c||[])rows.push({version,code:change[0],subject:change[1],kind:'revision'});
  }
  for(const row of ledger.modern||[])for(const change of row[2]||[])rows.push({version:row[0],code:change[0],subject:change[1],kind:'modern',pullRequest:Number(row[1])});
  for(const item of ledger.supplements||[])for(const change of item.c||[])rows.push({version:item.v,code:change[0],subject:change[1],kind:'stable-supplement',qbVersion:item.q});
  return rows;
}
export function validateLedger(ledger){
  if(!ledger||ledger.schemaVersion!==1)fail('unsupported WebAPI evolution ledger schema');
  const codes=ledger.codes||{};
  for(const [code,name] of Object.entries({S:'SOURCE_DERIVED',C:'CONTRACT_COVERED',M:'MISSING',N:'NOT_APPLICABLE'}))if(codes[code]!==name)fail(`classification code ${code} drifted`);
  if(Object.values(codes).includes('UNCLASSIFIED'))fail('UNCLASSIFIED must not be a terminal ledger code');
  const floor=String(ledger?.scope?.floorApi||''),ceiling=String(ledger?.scope?.ceiling||'');
  const spine=Array.isArray(ledger.spine)?ledger.spine.map(String):[];
  if(!spine.length||spine[0]!==floor||spine.at(-1)!==ceiling)fail('spine must begin at floorApi and end at ceiling');
  if(new Set(spine).size!==spine.length)fail('duplicate WebAPI revision in spine');
  for(let i=1;i<spine.length;i++)if(compareVersions(spine[i-1],spine[i])>=0)fail(`non-increasing spine at ${spine[i]}`);
  for(const revision of spine)if(!Object.prototype.hasOwnProperty.call(ledger.revisions||{},revision))fail(`spine revision ${revision} has no revision evidence`);
  for(const [version,raw] of Object.entries(ledger.revisions||{})){
    if(!spine.includes(version))fail(`revision ${version} escaped spine`);
    const records=Array.isArray(raw)?raw:[raw];
    for(const record of records){
      if(!record||!record.t||!Array.isArray(record.prs)||!Array.isArray(record.c)||record.c.length===0)fail(`${version}: malformed revision evidence`);
      if(record.t==='source_commit'&&!/^[0-9a-f]{40}$/.test(String(record.sha||'')))fail(`${version}: invalid source commit anchor`);
    }
  }
  const modernKeys=new Set();
  for(const row of ledger.modern||[]){
    if(!Array.isArray(row)||row.length!==3||!spine.includes(String(row[0]))||!Number.isInteger(Number(row[1]))||!Array.isArray(row[2])||!row[2].length)fail('malformed modern ledger row');
    const key=`${row[0]}#${Number(row[1])}`;
    if(modernKeys.has(key))fail(`duplicate modern PR evidence ${key}`);
    modernKeys.add(key);
  }
  for(const item of ledger.supplements||[]){
    if(!item?.q||!spine.includes(String(item.v))||!item.x||!Array.isArray(item.prs)||!Array.isArray(item.c)||!item.c.length)fail('malformed stable supplement');
  }
  for(const change of allChanges(ledger)){
    if(!Object.prototype.hasOwnProperty.call(codes,change.code))fail(`${change.version}: invalid classification code ${change.code}`);
    if(!change.subject)fail(`${change.version}: empty change subject`);
    if(change.code==='U')fail(`${change.version}: UNCLASSIFIED is forbidden`);
  }
  return true;
}
export function expandChanges(ledger){validateLedger(ledger);return allChanges(ledger).map(item=>({...item,classification:ledger.codes[item.code],owner:OWNER_BY_CODE[item.code]}));}
export function summarizeLedger(ledger){
  const changes=expandChanges(ledger),classifications={SOURCE_DERIVED:0,CONTRACT_COVERED:0,NOT_APPLICABLE:0,MISSING:0,UNCLASSIFIED:0};
  for(const item of changes)classifications[item.classification]++;
  return{evidenceEntries:Object.keys(ledger.revisions).length+(ledger.modern?.length||0)+(ledger.supplements?.length||0),changes:changes.length,classifications,unclassified:classifications.UNCLASSIFIED,floor:ledger.scope.floorApi,ceiling:ledger.scope.ceiling};
}
export function extractWebApiChangelogPulls(markdown,{minVersion='2.11.6',maxVersion='2.15.1'}={}){
  const found=[];let version=null;
  for(const line of String(markdown||'').split(/\r?\n/)){
    const heading=line.match(/^##\s+(\d+\.\d+\.\d+)\s*$/);if(heading){version=heading[1];continue;}
    if(!version||compareVersions(version,minVersion)<0||compareVersions(version,maxVersion)>0)continue;
    const pull=line.match(/^\*\s+\[#(\d+)\]\(/);if(pull)found.push({version,pullRequest:Number(pull[1])});
  }
  return found;
}
export function validateModernChangelogCoverage(ledger,markdown,{minVersion='2.11.6'}={}){
  validateLedger(ledger);
  const maxVersion=ledger.scope.ceiling;
  const upstream=extractWebApiChangelogPulls(markdown,{minVersion,maxVersion});
  const ledgerKeys=new Set((ledger.modern||[]).map(row=>`${row[0]}#${Number(row[1])}`));
  const missing=upstream.filter(item=>!ledgerKeys.has(`${item.version}#${item.pullRequest}`));
  if(missing.length)fail(`WebAPI changelog coverage missing: ${missing.map(item=>`${item.version}#${item.pullRequest}`).join(', ')}`);
  const upstreamKeys=new Set(upstream.map(item=>`${item.version}#${item.pullRequest}`));
  const extras=[...ledgerKeys].filter(key=>!upstreamKeys.has(key));
  if(extras.length)fail(`ledger contains unsupported modern changelog evidence: ${extras.join(', ')}`);
  return{pullRequests:upstream.length,minVersion,maxVersion};
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function rebindCopyRoutes(index,capability,{write=false,capabilityPath=''}={}){
  if(!Array.isArray(index)||!index.length)throw new Error('Copy route control-plane rebind requires a non-empty generated release index.');
  if(!capability||capability.schemaVersion!==2||!Array.isArray(capability.releases)||!capability.releases.length)throw new Error('Copy route control-plane rebind requires capabilities schemaVersion 2 with releases.');
  if(index.length!==capability.releases.length)throw new Error('Copy route release-set length mismatch.');
  const bySource=new Map();
  for(const row of index){
    const sourceSha=String(row?.sourceSha||'').toLowerCase(),routeId=String(row?.copyRouteId||'');
    if(!/^[0-9a-f]{40}$/.test(sourceSha)||!/^r[0-9a-f]{20}$/.test(routeId))throw new Error('Generated copy route index row is missing exact sourceSha/copyRouteId.');
    if(bySource.has(sourceSha))throw new Error('Generated copy route index contains duplicate sourceSha '+sourceSha);
    bySource.set(sourceSha,row);
  }
  let changed=0;
  for(const row of capability.releases){
    const sourceSha=String(row?.sourceSha||'').toLowerCase(),generated=bySource.get(sourceSha);
    if(!generated)throw new Error('Capability release has no generated copy route: '+String(row?.qbVersion||sourceSha));
    if(String(generated.qbVersion||'')!==String(row?.qbVersion||'')||String(generated.webApiVersion||'')!==String(row?.webApiVersion||''))throw new Error('Generated copy route exact release identity mismatch: '+String(row?.qbVersion||sourceSha));
    const next=String(generated.copyRouteId||'');
    if(String(row.copyRouteId||'')!==next){changed++;if(write)row.copyRouteId=next;}
  }
  if(new Set(capability.releases.map(row=>String(write?row.copyRouteId:(bySource.get(String(row.sourceSha||'').toLowerCase())?.copyRouteId||'')))).size!==58)throw new Error('65 admitted releases must resolve to exactly 58 semantic copy routes.');
  if(write&&changed){if(!capabilityPath)throw new Error('Capability path is required for write mode.');fs.writeFileSync(capabilityPath,JSON.stringify(capability,null,2)+'\n','utf8');}
  return{releaseCount:capability.releases.length,routeCount:58,changed};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const [indexArg,capabilityArg]=process.argv.slice(2).filter(value=>!value.startsWith('--')),write=process.argv.includes('--write');
    if(!indexArg||!capabilityArg)throw new Error('Usage: node tools/qb-copy-route-control-plane.mjs <generated-qb-releases.json> <capabilities.json> [--write]');
    const indexPath=path.resolve(indexArg),capabilityPath=path.resolve(capabilityArg),index=JSON.parse(fs.readFileSync(indexPath,'utf8')),capability=JSON.parse(fs.readFileSync(capabilityPath,'utf8')),result=rebindCopyRoutes(index,capability,{write,capabilityPath});
    if(!write&&result.changed)throw new Error('Capability copyRouteId projection differs from canonical generated index: '+result.changed+' rows.');
    console.log(JSON.stringify({kind:'QB_COPY_ROUTE_CONTROL_PLANE',mode:write?'write':'check',...result}));
  }catch(error){console.error(error?.stack||error);process.exitCode=1;}
}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {admittedCatalogRows,catalogIdentity} from './qb-catalog-identity.mjs';
import {packSettingsRuntime,readSettingsRuntime} from './qb-compact-runtime.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');

export function rebindSettingsRuntime(canonicalCatalog){
  const runtime=readSettingsRuntime(),rows=admittedCatalogRows(canonicalCatalog),releases=runtime.settingsData?.releases||[];
  if(releases.length!==rows.length)throw new Error(`Settings runtime release count mismatch: ${releases.length} != ${rows.length}`);
  for(let i=0;i<rows.length;i++){
    const actual=releases[i],expected=rows[i];
    if(!Array.isArray(actual)||String(actual[0])!==expected.qbVersion||String(actual[1]||'').toLowerCase()!==expected.sourceSha)
      throw new Error(`Settings runtime release identity mismatch at ${i}: ${JSON.stringify(actual)} != ${expected.qbVersion}/${expected.sourceSha}`);
  }
  const identity=catalogIdentity(canonicalCatalog),settingsData=structuredClone(runtime.settingsData);
  settingsData.catalogIdentity=identity;
  return packSettingsRuntime(settingsData,identity).manifest;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const output=path.resolve(process.argv[2]||'');
    const catalogPath=path.resolve(process.argv[3]||path.join(root,'tests/fixtures/qb-release-catalog.lkg.json'));
    if(!output)throw new Error('Usage: node tools/qb-settings-runtime-rebind.mjs <output.json> [canonical-catalog.json]');
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),manifest=rebindSettingsRuntime(catalog);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(manifest)+'\n','utf8');
    console.log(`Rebound Settings runtime to Frozen catalog identity ${manifest.catalogIdentity.sourceCatalogSha256.slice(0,12)}; payload ${manifest.payload.sha256.slice(0,12)}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

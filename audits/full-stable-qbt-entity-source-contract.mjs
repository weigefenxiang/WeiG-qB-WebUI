import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {auditQbtSourceEntities} from '../tools/qb-source-text.mjs';

const catalogPath=path.resolve(process.argv[2]||'qb-releases.json');
const qbRoot=path.resolve(process.argv[3]||process.env.QB_UPSTREAM_DIR||'upstream-qb');
const outputPath=path.resolve(process.argv[4]||process.env.QB_QBT_ENTITY_CENSUS_OUTPUT||'qb-qbt-entity-census.json');
assert.ok(fs.existsSync(catalogPath),`missing exact qB release catalog: ${catalogPath}`);
assert.ok(fs.existsSync(qbRoot),`missing qB upstream checkout: ${qbRoot}`);
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
assert.ok(Array.isArray(catalog)&&catalog.length>0,'entity census requires a non-empty admitted release catalog');

function git(args,{allowNoMatch=false}={}){
  const result=spawnSync('git',['-C',qbRoot,...args],{encoding:'utf8',maxBuffer:128*1024*1024});
  if(result.error)throw result.error;
  if(result.status===0)return String(result.stdout||'');
  if(allowNoMatch&&result.status===1)return'';
  throw new Error(`git ${args.join(' ')} failed (${result.status}): ${String(result.stderr||'').trim()}`);
}
function markerFiles(sourceSha){
  const raw=git(['grep','-l','-I','-F','QBT_TR(',sourceSha,'--','src/webui/www'],{allowNoMatch:true});
  const prefix=sourceSha+':';
  return raw.split(/\r?\n/).filter(Boolean).map(line=>line.startsWith(prefix)?line.slice(prefix.length):line);
}
function readAt(sourceSha,file){return git(['show',sourceSha+':'+file]);}

const profiles=[],failures=[];
const totals={releases:catalog.length,markerFiles:0,markers:0,entityBearing:0,multiLayer:0,unresolved:0};
for(const profile of catalog){
  const qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim();
  assert.ok(qbVersion,`catalog profile lacks qbVersion: ${JSON.stringify(profile)}`);
  assert.match(sourceSha,/^[0-9a-f]{40}$/i,`${qbVersion}: exact source SHA missing`);
  git(['cat-file','-e',sourceSha+'^{commit}']);
  const files=markerFiles(sourceSha),entityFiles=[];
  let markers=0,entityBearing=0,multiLayer=0,unresolvedCount=0;
  for(const file of files){
    const audit=auditQbtSourceEntities(readAt(sourceSha,file));
    markers+=audit.markers;entityBearing+=audit.entityBearing;multiLayer+=audit.multiLayer;
    if(audit.unresolved.length){
      unresolvedCount+=audit.unresolved.length;
      failures.push(`${qbVersion} ${file}: ${audit.unresolved.join(', ')}`);
    }
    if(audit.entityBearing||audit.multiLayer||audit.unresolved.length)entityFiles.push({file,...audit});
  }
  assert.ok(markers>0,`${qbVersion}: no QBT_TR markers found under src/webui/www at ${sourceSha}`);
  totals.markerFiles+=files.length;totals.markers+=markers;totals.entityBearing+=entityBearing;totals.multiLayer+=multiLayer;totals.unresolved+=unresolvedCount;
  profiles.push({qbVersion,sourceSha,markerFiles:files.length,markers,entityBearing,multiLayer,unresolved:unresolvedCount,entityFiles});
}
assert.ok(totals.entityBearing>0,'admitted WebUI entity census found no entity-bearing QBT_TR markers; census path is likely incomplete');
const census={schemaVersion:1,source:'qb-upstream-webui-qbt-entity-census',scope:'src/webui/www',totals,profiles};
fs.writeFileSync(outputPath,JSON.stringify(census,null,2)+'\n','utf8');
assert.equal(failures.length,0,`unresolved qB WebUI QBT_TR entities across admitted source SHAs:\n${failures.join('\n')}`);
console.log(`qB WebUI QBT_TR entity census passed: ${totals.releases} releases, ${totals.markerFiles} marker files, ${totals.markers} markers, ${totals.entityBearing} entity-bearing, ${totals.multiLayer} multi-layer, 0 unresolved.`);

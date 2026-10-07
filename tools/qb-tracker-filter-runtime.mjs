#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function assert(ok,message){if(!ok)throw new Error(message);}
function clone(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=stable(value[key]);return out;}return value;}
function stableJson(value){return JSON.stringify(stable(value));}

function compactTimeline(catalog,key,validate){
  assert(Array.isArray(catalog)&&catalog.length,'Tracker runtime materializer requires a non-empty exact source catalog.');
  const timeline=[];let previous=null,initialized=false;
  for(const profile of catalog){
    const from=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim(),value=clone(profile?.[key]);
    assert(from&&/^[0-9a-f]{40}$/.test(sourceSha),`${from||'unknown'}: exact source identity is missing.`);
    validate(value,from);
    const marker=stableJson(value);
    if(!initialized||marker!==previous){timeline.push({from,value});previous=marker;initialized=true;}
  }
  return timeline;
}
export function compactTrackerFilterTimeline(catalog){
  const timeline=compactTimeline(catalog,'trackerFilters',(value,version)=>assert(Array.isArray(value),`${version}: source-derived trackerFilters are missing.`));
  assert(timeline.some(item=>item.value.length),'Tracker runtime materializer found no source-proven Tracker filters.');
  return timeline;
}
export function compactTrackerFacetModeTimeline(catalog){
  return compactTimeline(catalog,'trackerFacetMode',(value,version)=>assert(['none','url','hostname'].includes(String(value||'')),`${version}: source-derived trackerFacetMode is invalid.`));
}
export function materializeTrackerRuntime(catalog,template){
  assert(template&&template.schemaVersion===1&&template.sourceFacts&&typeof template.sourceFacts==='object','Tracker runtime materializer requires torrent-compat schema v1.');
  const out=clone(template);
  out.sourceFacts.trackerFilters=compactTrackerFilterTimeline(catalog);
  out.sourceFacts.trackerFacetMode=compactTrackerFacetModeTimeline(catalog);
  return out;
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const catalogPath=path.resolve(process.argv[2]||''),templatePath=path.resolve(process.argv[3]||''),outputPath=path.resolve(process.argv[4]||'');
    if(!catalogPath||!fs.existsSync(catalogPath)||!templatePath||!fs.existsSync(templatePath)||!outputPath)throw new Error('Usage: node tools/qb-tracker-filter-runtime.mjs <source-enriched-catalog.json> <torrent-compat-template.json> <output.json>');
    const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8')),template=JSON.parse(fs.readFileSync(templatePath,'utf8')),out=materializeTrackerRuntime(catalog,template);
    fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(out)+'\n','utf8');
    console.log(`Materialized Tracker runtime source facts: filters=${out.sourceFacts.trackerFilters.length}, facet-mode=${out.sourceFacts.trackerFacetMode.length} change points.`);
  }catch(error){console.error(error?.stack||error);process.exitCode=1;}
}

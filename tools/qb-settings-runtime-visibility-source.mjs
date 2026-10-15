#!/usr/bin/env node
// Source-derived Settings environment visibility. One row/control owner and exact release identity.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const PATHS=['src/webui/www/private/views/preferences.html','src/webui/www/private/preferences_content.html','src/webui/www/private/preferences.html'];
const escapeRegexp=value=>String(value).replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');

export function extractQbSettingsRuntimeVisibility(markup){
  const source=String(markup||''),rules=[];
  if(!source.includes('libtorrentVersion.major'))return rules;
  if(!source.includes('buildInfo')||!source.includes('libtorrentVersion'))throw Error('Source runtime condition has no proven buildInfo owner');
  const blocks=[...source.matchAll(/if\s*\(\s*libtorrentVersion\.major\s*>=\s*(\d+)\s*\)\s*\{([\s\S]{0,1500}?)\}/g)];
  for(const [,threshold,body] of blocks){
    const rowIds=[...body.matchAll(/(?:document\.getElementById|\$)\(["'](row[A-Za-z0-9_]+)["']\)\.style\.display\s*=\s*["']none["']/g)].map(match=>match[1]);
    for(const rowId of rowIds){
      const row=source.match(new RegExp('<tr\\b[^>]*\\bid=["\\\']'+escapeRegexp(rowId)+'["\\\'][^>]*>([\\s\\S]*?)<\\/tr>','i'));
      if(!row)throw Error('Unowned runtime-hidden row '+rowId);
      const controls=[...row[1].matchAll(/<(?:input|select|textarea)\b[^>]*\bid=["']([^"']+)["']/gi)].map(match=>match[1]);
      if(controls.length!==1)throw Error('Ambiguous hidden-row control '+rowId);
      const rule={controlId:controls[0],rowId,when:{kind:'libtorrent-major-at-least',value:Number(threshold)},effect:'hidden'};
      if(rules.some(x=>x.controlId===rule.controlId))throw Error('Duplicate runtime visibility owner '+rule.controlId);
      rules.push(rule);
    }
  }
  if(source.includes('rowDiskCache')&&source.includes('libtorrentVersion.major')&&!rules.length)throw Error('Unaccounted upstream runtime visibility condition');
  return rules;
}

function readSource(qbRoot,tag){
  for(const path of PATHS){
    try{
      const value=execFileSync('git',['-C',qbRoot,'show',tag+':'+path],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
      if(value)return value;
    }catch(_e){}
  }
  throw Error('Missing exact upstream source '+tag);
}

export function compileQbSettingsRuntimeVisibility(capabilities,qbRoot,versions){
  if(!capabilities||!Array.isArray(capabilities.releases)||!capabilities.catalogIdentity||!Array.isArray(versions))throw Error('Incomplete runtime visibility inputs');
  const releases=[];
  for(const qbVersion of versions){
    const exact=capabilities.releases.find(row=>row.qbVersion===qbVersion);
    if(!exact||!/^[a-f0-9]{40}$/.test(String(exact.sourceSha||'')))throw Error('Uncertified qB release '+qbVersion);
    const rules=extractQbSettingsRuntimeVisibility(readSource(qbRoot,'release-'+qbVersion));
    if(rules.length)releases.push({qbVersion,sourceSha:exact.sourceSha,rules});
  }
  return{schemaVersion:1,source:'qb-upstream-settings-runtime-visibility',catalogIdentity:capabilities.catalogIdentity,releases};
}

if(process.argv[1]&&process.argv[1].endsWith('/qb-settings-runtime-visibility-source.mjs')){
  try{
    const [catalogFile,qbRoot,manifestFile,outputFile]=process.argv.slice(2);
    if(!catalogFile||!qbRoot||!manifestFile||!outputFile)throw Error('Usage: node tools/qb-settings-runtime-visibility-source.mjs <capabilities.json> <qB-root> <previous-manifest.json> <output.json>');
    const catalog=JSON.parse(fs.readFileSync(catalogFile,'utf8')),previous=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
    const output=compileQbSettingsRuntimeVisibility(catalog,qbRoot,previous.releases.map(row=>String(row.qbVersion||'')));
    fs.writeFileSync(outputFile,JSON.stringify(output,null,2)+'\n','utf8');
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

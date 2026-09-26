#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {compileCompactRuntime} from './qb-compact-runtime.mjs';
import {applyLocaleOverlay} from './qb-locale-overlay.mjs';

const args=process.argv.slice(2);
const check=args.includes('--check');
const positional=args.filter(arg=>!arg.startsWith('--'));
const catalogPath=path.resolve(positional[0]||'tests/fixtures/qb-release-catalog.lkg.json');
const torrentPath=path.resolve('webui/private/data/torrent-compat.json');
const actionPath=path.resolve('webui/private/data/source-actions.json');
const localeOverlayPath=path.resolve('tools/data/qb-locale-lkg.json');

if(!fs.existsSync(catalogPath))throw new Error('Torrent runtime rebind catalog not found: '+catalogPath);
if(!fs.existsSync(localeOverlayPath))throw new Error('Torrent runtime locale overlay not found: '+localeOverlayPath);
const catalogText=fs.readFileSync(catalogPath,'utf8').replace(/\r\n?/g,'\n');
const catalog=JSON.parse(catalogText);
if(!Array.isArray(catalog)||!catalog.length)throw new Error('Torrent runtime rebind requires a non-empty exact source catalog.');
const localeOverlay=JSON.parse(fs.readFileSync(localeOverlayPath,'utf8'));
const catalogSha256=crypto.createHash('sha256').update(Buffer.from(catalogText,'utf8')).digest('hex');
const localeCatalog=applyLocaleOverlay(catalog,localeOverlay,{catalogSha256});
const hasTorrentMenuFact=catalog.every(profile=>Object.prototype.hasOwnProperty.call(profile,'torrentContextMenu'));
const {torrentData,actionData}=compileCompactRuntime(catalog,{includeSettings:false});
function compactTimeline(rows){const out=[];let prior=null,hasPrior=false;for(const row of rows){const signature=JSON.stringify(row.value);if(!hasPrior||signature!==prior){out.push({from:String(row.from||''),value:structuredClone(row.value)});prior=signature;hasPrior=true;}}return out;}
torrentData.sourceFacts.webuiLocales=compactTimeline(localeCatalog.map(profile=>({from:String(profile.qbVersion||''),value:Array.isArray(profile.webuiLocales)?profile.webuiLocales:[]})));
if(!hasTorrentMenuFact)delete torrentData.sourceFacts.torrentContextMenu;
else if(!catalog.some(profile=>Array.isArray(profile.torrentContextMenu)&&profile.torrentContextMenu.length))throw new Error('Refreshed Frozen exact source catalog contains no source-proven Torrent context-menu facts; refusing empty materialization.');
const renderedTorrent=JSON.stringify(torrentData)+'\n';
const renderedActions=JSON.stringify(actionData)+'\n';

function verify(file,rendered,label){
  if(!fs.existsSync(file))throw new Error(label+' runtime file is missing: '+file);
  const actual=fs.readFileSync(file,'utf8');
  if(actual!==rendered)throw new Error(label+' runtime is stale against the Frozen exact source catalog.');
}
if(check){
  verify(torrentPath,renderedTorrent,'Torrent');
  verify(actionPath,renderedActions,'Action');
  console.log('Torrent/Action compact runtime check passed for '+catalog.length+' Frozen profiles; torrentContextMenu='+String(hasTorrentMenuFact));
}else{
  fs.writeFileSync(torrentPath,renderedTorrent,'utf8');
  fs.writeFileSync(actionPath,renderedActions,'utf8');
  console.log('Materialized Torrent/Action compact runtime for '+catalog.length+' Frozen profiles; torrentContextMenu='+String(hasTorrentMenuFact));
}

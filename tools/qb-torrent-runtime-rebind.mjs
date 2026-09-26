#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {compileCompactRuntime} from './qb-compact-runtime.mjs';

const args=process.argv.slice(2);
const check=args.includes('--check');
const positional=args.filter(arg=>!arg.startsWith('--'));
const catalogPath=path.resolve(positional[0]||'tests/fixtures/qb-release-catalog.lkg.json');
const torrentPath=path.resolve('webui/private/data/torrent-compat.json');
const actionPath=path.resolve('webui/private/data/source-actions.json');

if(!fs.existsSync(catalogPath))throw new Error('Torrent runtime rebind catalog not found: '+catalogPath);
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
if(!Array.isArray(catalog)||!catalog.length)throw new Error('Torrent runtime rebind requires a non-empty exact source catalog.');

const {torrentData,actionData}=compileCompactRuntime(catalog,{includeSettings:false});
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
  console.log('Torrent/Action compact runtime check passed for '+catalog.length+' Frozen profiles.');
}else{
  fs.writeFileSync(torrentPath,renderedTorrent,'utf8');
  fs.writeFileSync(actionPath,renderedActions,'utf8');
  console.log('Materialized Torrent/Action compact runtime for '+catalog.length+' Frozen profiles.');
}

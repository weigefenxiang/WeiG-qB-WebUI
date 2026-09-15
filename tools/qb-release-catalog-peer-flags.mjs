#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const QB_PEER_FLAGS_SOURCE={
  repository:'https://github.com/qbittorrent/qBittorrent.git',
  tag:'release-5.2.3',
  commit:'0b63c3d17373f6132ea211c9dcd4241284ccdfaf',
  renderer:'src/webui/www/private/scripts/dynamicTable.js',
  flags:'src/webui/www/private/images/flags'
};

function run(command,args,options={}){
  const result=spawnSync(command,args,{stdio:'pipe',encoding:'utf8',...options});
  if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed: ${(result.stderr||result.stdout||'').trim()}`);
  return String(result.stdout||'').trim();
}
function ensurePinnedSource(){
  const cache=path.join(os.tmpdir(),`weigg-qb-peer-flags-${QB_PEER_FLAGS_SOURCE.commit}`);
  const gitDir=path.join(cache,'.git');
  if(!fs.existsSync(gitDir)){
    fs.rmSync(cache,{recursive:true,force:true});
    run('git',['clone','--depth','1','--filter=blob:none','--sparse','--branch',QB_PEER_FLAGS_SOURCE.tag,QB_PEER_FLAGS_SOURCE.repository,cache]);
    run('git',['-C',cache,'sparse-checkout','set','src/webui/www/private/scripts','src/webui/www/private/images/flags']);
  }
  const head=run('git',['-C',cache,'rev-parse','HEAD']).toLowerCase();
  if(head!==QB_PEER_FLAGS_SOURCE.commit)throw new Error(`qB peer flag source drift: ${head} != ${QB_PEER_FLAGS_SOURCE.commit}`);
  return cache;
}
function rendererProvesLocalFlags(source){
  const text=String(source||'');
  return /images\/flags\//.test(text)&&/country_code/.test(text)&&/\.svg/.test(text);
}
function sourceFlagFiles(sourceRoot){
  const dir=path.join(sourceRoot,QB_PEER_FLAGS_SOURCE.flags);
  if(!fs.existsSync(dir))throw new Error(`Missing qB peer flag source directory: ${dir}`);
  const files=fs.readdirSync(dir).filter(name=>/^[a-z]{2}\.svg$/i.test(name)).sort();
  for(const required of ['cn.svg','de.svg','jp.svg','sg.svg','us.svg'])if(!files.includes(required))throw new Error(`qB peer flag source is missing ${required}`);
  if(files.length<200)throw new Error(`qB peer flag source is unexpectedly small: ${files.length} ISO SVGs`);
  return{dir,files};
}
function renderCss(files){
  return `/* Generated from qBittorrent ${QB_PEER_FLAGS_SOURCE.tag}@${QB_PEER_FLAGS_SOURCE.commit}; do not hand-edit. */\n`+files.map(name=>{
    const iso=name.slice(0,-4).toLowerCase();
    return `.peer-country-flag.flag.${iso}{display:inline-block;background-image:url('../images/flags/${name}');background-size:16px 11px;background-position:center;background-repeat:no-repeat}.peer-country-flag.flag.${iso}+.peer-country-code{display:none}`;
  }).join('\n')+'\n';
}
function failClosedIndex(privateRoot){
  const file=path.join(privateRoot,'index.html');
  if(!fs.existsSync(file))throw new Error(`Missing WebUI private index: ${file}`);
  const before=fs.readFileSync(file,'utf8');
  let after=before;
  if(/<html\b[^>]*\bdata-country-flags=/.test(after))after=after.replace(/(<html\b[^>]*\bdata-country-flags=)["'][^"']*["']/,'$1"failed"');
  else after=after.replace(/<html\b/,'<html data-country-flags="failed"');
  if(after===before&&!before.includes('data-country-flags="failed"'))throw new Error('Unable to install fail-closed peer flag bootstrap state.');
  fs.writeFileSync(file,after,'utf8');
}

export function materializeQbPeerFlags(privateRoot,{sourceRoot=null}={}){
  privateRoot=path.resolve(privateRoot);
  const uiFile=path.join(privateRoot,'scripts/ui.js');
  if(!fs.existsSync(uiFile))return{materialized:false,reason:'no-ui-runtime'};
  const ui=fs.readFileSync(uiFile,'utf8');
  if(!ui.includes('peer-country-flag'))return{materialized:false,reason:'no-peer-flag-runtime'};
  const upstream=sourceRoot?path.resolve(sourceRoot):ensurePinnedSource();
  const rendererFile=path.join(upstream,QB_PEER_FLAGS_SOURCE.renderer);
  if(!fs.existsSync(rendererFile))throw new Error(`Missing qB peer renderer source: ${rendererFile}`);
  const renderer=fs.readFileSync(rendererFile,'utf8');
  if(!rendererProvesLocalFlags(renderer))throw new Error('Pinned qB Peers source no longer proves local images/flags/<country_code>.svg rendering.');
  const {dir,files}=sourceFlagFiles(upstream),target=path.join(privateRoot,'images/flags');
  fs.rmSync(target,{recursive:true,force:true});fs.mkdirSync(target,{recursive:true});
  for(const name of files)fs.copyFileSync(path.join(dir,name),path.join(target,name));
  const cssFile=path.join(privateRoot,'css/qb-peer-flags.css');fs.writeFileSync(cssFile,renderCss(files),'utf8');
  failClosedIndex(privateRoot);
  return{materialized:true,sourceCommit:QB_PEER_FLAGS_SOURCE.commit,sourceTag:QB_PEER_FLAGS_SOURCE.tag,flagCount:files.length,cssBytes:fs.statSync(cssFile).size};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const root=process.argv[2];if(!root)throw new Error('Usage: node tools/qb-release-catalog-peer-flags.mjs <webui-private-root> [upstream-qb-root]');
    console.log(JSON.stringify(materializeQbPeerFlags(root,{sourceRoot:process.argv[3]||null})));
  }catch(error){console.error(error?.stack||error);process.exit(1);}
}

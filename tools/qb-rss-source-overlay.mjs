#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertRssSurfaceBindings,extractRssDownloaderGuiSurface,extractRssDownloaderSurface} from './qb-rss-surface-source.mjs';

function git(root,...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function showMaybe(root,tag,file){try{return git(root,'show',`${tag}:${file}`);}catch{return'';}}
export function rssDownloaderSource(root,tag){
  return showMaybe(root,tag,'src/webui/www/private/views/rssDownloader.html')
    ||showMaybe(root,tag,'src/webui/www/private/rssDownloader.html')
    ||showMaybe(root,tag,'src/webui/www/private/rssdownloader.html');
}
export function enrichCatalogRssSurface(catalog,qbRoot){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('RSS source enrichment requires a non-empty exact release catalog.');
  return catalog.map(profile=>{
    const qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim(),tag=String(profile?.tag||`release-${qbVersion}`).trim();
    if(!qbVersion||!sourceSha||!tag)throw new Error('RSS source enrichment requires qbVersion + sourceSha + tag identity.');
    const source=rssDownloaderSource(qbRoot,tag),ui=source?'':showMaybe(qbRoot,tag,'src/gui/rss/automatedrssdownloader.ui'),rule=source?'':showMaybe(qbRoot,tag,'src/base/rss/rss_autodownloadrule.cpp'),api=source?'':showMaybe(qbRoot,tag,'src/webui/api/rsscontroller.cpp');
    const rssDownloaderUi=assertRssSurfaceBindings(source?extractRssDownloaderSurface(source):extractRssDownloaderGuiSurface(ui,rule,api),`${qbVersion} RSS Downloader`);
    return{...profile,rssDownloaderUiSource:source?'qb-upstream-rss-downloader':(rssDownloaderUi.available?'qb-upstream-rss-downloader-gui-api':'qb-upstream-native-surface-absent'),rssDownloaderUi};
  });
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||''),input=path.resolve(process.argv[3]||''),output=path.resolve(process.argv[4]||'');
    if(!qbRoot||!fs.existsSync(qbRoot)||!input||!fs.existsSync(input)||!output)throw new Error('Usage: node tools/qb-rss-source-overlay.mjs <qBittorrent-clone> <catalog.json> <output.json>');
    const catalog=JSON.parse(fs.readFileSync(input,'utf8')),enriched=enrichCatalogRssSurface(catalog,qbRoot);
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(enriched,null,2)+'\n','utf8');
    const native=enriched.filter(item=>item.rssDownloaderUi?.available).length,fields=enriched.reduce((sum,item)=>sum+(item.rssDownloaderUi?.fields?.length||0),0);
    console.log(`Enriched exact RSS Downloader source facts for ${enriched.length} releases; native surface present in ${native}; extracted field bindings ${fields}.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

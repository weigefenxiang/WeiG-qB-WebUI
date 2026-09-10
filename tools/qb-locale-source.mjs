#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

function unique(values){const out=[];for(const value of values||[]){const item=String(value||'').trim();if(item&&!out.includes(item))out.push(item);}return out;}
function decodeHtml(value){return String(value||'').replace(/&quot;|&#34;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function plainText(value){return decodeHtml(String(value||'').replace(/<[^>]*>/g,'').trim());}

export function parseExplicitLocaleOptions(source=''){
  const match=String(source).match(/<select\b[^>]*\bid=["']locale_select["'][^>]*>([\s\S]*?)<\/select>/i);
  if(!match||match[1].includes('${LANGUAGE_OPTIONS}'))return[];
  const options=[];
  for(const option of match[1].matchAll(/<option\b[^>]*\bvalue=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)){
    const value=String(option[1]||'').trim();
    if(!value)continue;
    const rawLabel=plainText(option[2]);
    options.push({value,label:rawLabel&&!rawLabel.includes('QBT_TR(')?rawLabel:null});
  }
  return options;
}

export function localeCodesFromPaths(paths=[]){
  const webui=[];
  for(const file of paths){
    const match=String(file).match(/(?:^|\/)src\/webui\/www\/translations\/webui_(.+)\.ts$/);
    if(match)webui.push(match[1]);
  }
  return unique(webui).sort((a,b)=>a.localeCompare(b));
}

export function extractWebuiLocaleFacts({preferencesSource='',paths=[]}={}){
  const explicit=parseExplicitLocaleOptions(preferencesSource);
  if(explicit.length)return{webuiLocales:explicit,webuiLocaleSource:'preferences-html'};
  const codes=localeCodesFromPaths(paths);
  return{webuiLocales:codes.map(value=>({value,label:null})),webuiLocaleSource:codes.length?'translation-resources':'unresolved'};
}

function git(qbRoot,...args){return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function showMaybe(qbRoot,tag,file){try{return git(qbRoot,'show',`${tag}:${file}`);}catch{return'';}}

export function extractProfileWebuiLocaleFacts(qbRoot,tag){
  const source=showMaybe(qbRoot,tag,'src/webui/www/private/views/preferences.html')||showMaybe(qbRoot,tag,'src/webui/www/private/preferences_content.html');
  const paths=git(qbRoot,'ls-tree','-r','--name-only',tag,'src/webui/www/translations').split(/\r?\n/).filter(Boolean);
  return extractWebuiLocaleFacts({preferencesSource:source,paths});
}

export function enrichCatalogWebuiLocales(catalog,qbRoot){
  if(!Array.isArray(catalog))throw new Error('qB release catalog must be an array.');
  return catalog.map(profile=>{
    const qbVersion=String(profile?.qbVersion||'').trim();
    const tag=String(profile?.tag||`release-${qbVersion}`).trim();
    if(!qbVersion||!tag)return{...profile,webuiLocales:[],webuiLocaleSource:'unresolved'};
    return{...profile,...extractProfileWebuiLocaleFacts(qbRoot,tag)};
  });
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
    const input=path.resolve(process.argv[3]||'');
    const output=path.resolve(process.argv[4]||process.argv[3]||'');
    if(!qbRoot||!fs.existsSync(qbRoot)||!input||!fs.existsSync(input))throw new Error('Usage: node tools/qb-locale-source.mjs <qBittorrent-clone> <catalog.json> [output.json]');
    const catalog=JSON.parse(fs.readFileSync(input,'utf8'));
    const enriched=enrichCatalogWebuiLocales(catalog,qbRoot);
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,JSON.stringify(enriched,null,2)+'\n','utf8');
    const resolved=enriched.filter(item=>Array.isArray(item.webuiLocales)&&item.webuiLocales.length).length;
    console.log(`Enriched WebUI locale facts for ${resolved}/${enriched.length} qB release profiles.`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

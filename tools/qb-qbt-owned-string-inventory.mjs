#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const QBT_TR_RE=/QBT_TR\(([\s\S]*?)\)QBT_TR\[CONTEXT=([A-Za-z_][A-Za-z0-9_]*)\]/g;
const TEXT_EXTENSIONS=new Set(['.html','.htm','.js','.mjs','.css']);
function refKey(context,source){return `${context}\u0000${source}`;}
function uniqueSorted(values){return [...new Set(values)].sort((a,b)=>a.localeCompare(b));}

export function extractQbtRefs(source,file=''){
  const out=[];
  for(const match of String(source||'').matchAll(new RegExp(QBT_TR_RE.source,'g'))){
    out.push({file,source:match[1],context:match[2]});
  }
  return out;
}

export function collectSourceProvenQbRefs(catalog){
  const index=new Map();
  for(const profile of Array.isArray(catalog)?catalog:[]){
    const version=String(profile?.qbVersion||'');
    const sourceSha=String(profile?.sourceSha||'');
    for(const [preferenceKey,entry] of Object.entries(profile?.settingsUi||{})){
      for(const role of ['title','description']){
        const ref=entry?.[role];
        if(!ref?.source||!ref?.context)continue;
        const key=refKey(ref.context,ref.source);
        let item=index.get(key);
        if(!item){item={source:ref.source,context:ref.context,preferenceKeys:new Set(),versions:new Set(),sourceShas:new Set(),roles:new Set()};index.set(key,item);}
        item.preferenceKeys.add(preferenceKey);item.versions.add(version);if(sourceSha)item.sourceShas.add(sourceSha);item.roles.add(role);
      }
    }
  }
  return [...index.values()].map(item=>({
    source:item.source,
    context:item.context,
    preferenceKeys:uniqueSorted(item.preferenceKeys),
    roles:uniqueSorted(item.roles),
    versions:uniqueSorted(item.versions),
    sourceShas:uniqueSorted(item.sourceShas)
  })).sort((a,b)=>refKey(a.context,a.source).localeCompare(refKey(b.context,b.source)));
}

export function extractWeiGI18nKeys(source,file=''){
  const keys=[];
  const text=String(source||'');
  const patterns=[/\bW\.I18n\.t\(\s*['"]([^'"]+)['"]/g,/\bW\.t\(\s*['"]([^'"]+)['"]/g,/\bdata-i18n\s*=\s*['"]([^'"]+)['"]/g];
  for(const re of patterns)for(const match of text.matchAll(re))keys.push({file,key:match[1]});
  return keys;
}

export function hasQbSettingBridgeConsumer(source){return /\bW\.I18n\.qbSetting\s*\(/.test(String(source||''));}

export function buildQbOwnedStringInventory(files,catalog){
  const entries=Array.isArray(files)?files:[];
  const proven=collectSourceProvenQbRefs(catalog);
  const provenIndex=new Map(proven.map(item=>[refKey(item.context,item.source),item]));
  const markers=[];const weiGKeys=[];const bridgeConsumers=[];
  for(const file of entries){
    const filename=String(file?.file||file?.path||'');
    const source=String(file?.source||file?.content||'');
    markers.push(...extractQbtRefs(source,filename));
    weiGKeys.push(...extractWeiGI18nKeys(source,filename));
    if(hasQbSettingBridgeConsumer(source))bridgeConsumers.push(filename);
  }
  const qbOwnedMarkers=[],uncertain=[];
  for(const marker of markers){
    const proof=provenIndex.get(refKey(marker.context,marker.source));
    if(proof)qbOwnedMarkers.push({...marker,preferenceKeys:proof.preferenceKeys});
    else uncertain.push(marker);
  }
  return{
    schemaVersion:1,
    source:'formal-webui+source-derived-qb-settings-ui',
    classification:{
      A_qbOwnedSourceRefs:proven,
      B_weiGNamespaceKeys:uniqueSorted(weiGKeys.map(item=>item.key)),
      C_uncertainQbtMarkers:uncertain
    },
    currentFormalQbtMarkers:markers,
    provenFormalQbtMarkers:qbOwnedMarkers,
    bridgeConsumers:uniqueSorted(bridgeConsumers),
    stats:{
      formalFiles:entries.length,
      provenQbRefs:proven.length,
      formalQbtMarkers:markers.length,
      provenFormalQbtMarkers:qbOwnedMarkers.length,
      uncertainQbtMarkers:uncertain.length,
      weiGNamespaceKeys:uniqueSorted(weiGKeys.map(item=>item.key)).length,
      bridgeConsumers:uniqueSorted(bridgeConsumers).length
    }
  };
}

function walk(root){
  const out=[];
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const full=path.join(root,entry.name);
    if(entry.isDirectory()){out.push(...walk(full));continue;}
    if(!entry.isFile()||!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))continue;
    out.push({file:path.relative(root,full).replaceAll('\\','/'),source:fs.readFileSync(full,'utf8')});
  }
  return out;
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const webuiRoot=path.resolve(process.argv[2]||'webui');
    const catalogPath=path.resolve(process.argv[3]||'tests/fixtures/qb-release-catalog.lkg.json');
    const outputArg=process.argv[4]?path.resolve(process.argv[4]):null;
    if(!fs.existsSync(webuiRoot))throw new Error(`WebUI root not found: ${webuiRoot}`);
    if(!fs.existsSync(catalogPath))throw new Error(`qB source-derived catalog not found: ${catalogPath}`);
    const inventory=buildQbOwnedStringInventory(walk(webuiRoot),JSON.parse(fs.readFileSync(catalogPath,'utf8')));
    if(!inventory.stats.provenQbRefs)throw new Error('No source-proven qB Settings refs found; catalog is not translation-enriched.');
    const rendered=JSON.stringify(inventory,null,2)+'\n';
    if(outputArg){fs.mkdirSync(path.dirname(outputArg),{recursive:true});fs.writeFileSync(outputArg,rendered,'utf8');}
    else process.stdout.write(rendered);
    console.error(`qB-owned inventory: ${inventory.stats.provenQbRefs} proven source/context refs; ${inventory.stats.formalQbtMarkers} formal QBT_TR markers (${inventory.stats.uncertainQbtMarkers} uncertain); ${inventory.stats.bridgeConsumers} qbSetting bridge consumer file(s).`);
  }catch(error){console.error(error?.message||error);process.exitCode=1;}
}

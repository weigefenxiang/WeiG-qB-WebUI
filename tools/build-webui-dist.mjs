#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {packCatalog} from './qb-webui-catalog.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'..');
function arg(name,fallback=''){const prefix=`--${name}=`;const hit=process.argv.find(value=>value.startsWith(prefix));return hit?hit.slice(prefix.length):fallback;}
function required(name){const value=arg(name);if(!value)throw new Error(`Missing --${name}=...`);return value;}
function assert(ok,message){if(!ok)throw new Error(message);}
function replaceBuildSha(root,sha){
  const textExt=new Set(['.html','.js','.css','.json']);
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const file=path.join(root,entry.name);
    if(entry.isDirectory()){replaceBuildSha(file,sha);continue;}
    if(!entry.isFile())continue;
    if(!textExt.has(path.extname(entry.name))&&entry.name!=='GIT_SHA')continue;
    const source=fs.readFileSync(file,'utf8');
    if(source.includes('__WEIGG_GIT_SHA__'))fs.writeFileSync(file,source.replaceAll('__WEIGG_GIT_SHA__',sha),'utf8');
  }
}
function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}

export function buildWebuiDist({webuiRoot,catalogPath,outDir,sha,version}){
  webuiRoot=path.resolve(webuiRoot);catalogPath=path.resolve(catalogPath);outDir=path.resolve(outDir);
  assert(/^[0-9a-f]{40}$/i.test(sha),'Distribution requires an exact 40-character Git SHA.');
  assert(fs.existsSync(path.join(webuiRoot,'public/index.html'))&&fs.existsSync(path.join(webuiRoot,'private/index.html')),'Distribution source is not a valid WebUI root.');
  const sourceVersion=fs.readFileSync(path.join(webuiRoot,'VERSION'),'utf8').trim();
  assert(sourceVersion===version,`Distribution VERSION mismatch: ${sourceVersion} != ${version}`);

  fs.rmSync(outDir,{recursive:true,force:true});
  fs.mkdirSync(outDir,{recursive:true});
  const stage=path.join(outDir,'.stage');
  const root=path.join(stage,'WeiG-qB-WebUI');
  fs.mkdirSync(stage,{recursive:true});
  fs.cpSync(webuiRoot,root,{recursive:true,force:true});

  const packed=packCatalog(catalogPath,path.join(root,'private/data/qb-releases.json'));
  replaceBuildSha(root,sha);
  fs.writeFileSync(path.join(root,'GIT_SHA'),`${sha}\n`,'utf8');

  const runtimeCatalog=JSON.parse(fs.readFileSync(path.join(root,'private/data/qb-releases.json'),'utf8'));
  assert(Array.isArray(runtimeCatalog)&&runtimeCatalog.length>0,'Materialized distribution catalog is empty.');
  assert(fs.existsSync(path.join(root,'private/data/qb-settings-native.txt')),'Materialized distribution is missing native Settings QBT_TR registry.');
  const translations=path.join(root,'translations');
  const qms=fs.existsSync(translations)?fs.readdirSync(translations).filter(name=>/^webui_.+\.qm$/i.test(name)):[];
  assert(qms.length>0,'Materialized distribution is missing official qB WebUI QM assets.');

  const zipPath=path.join(outDir,'WeiG-qB-WebUI.zip');
  const zipped=spawnSync('zip',['-qr',zipPath,'WeiG-qB-WebUI'],{cwd:stage,stdio:'inherit'});
  if(zipped.status!==0)throw new Error(`zip failed with status ${zipped.status}`);
  const digest=sha256(zipPath);
  fs.writeFileSync(path.join(outDir,'SHA256SUMS'),`${digest}  WeiG-qB-WebUI.zip\n`,'utf8');
  fs.writeFileSync(path.join(outDir,'GIT_SHA'),`${sha}\n`,'utf8');
  fs.writeFileSync(path.join(outDir,'VERSION'),`${version}\n`,'utf8');
  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify({schemaVersion:1,kind:'materialized-webui-dist',gitSha:sha,version,profiles:runtimeCatalog.length,qmAssets:qms.length,nativeRegistry:true,packedCatalogBytes:packed.packedBytes},null,2)+'\n','utf8');
  fs.rmSync(stage,{recursive:true,force:true});
  return{zipPath,digest,profiles:runtimeCatalog.length,qmAssets:qms.length};
}

const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){
  try{
    const result=buildWebuiDist({
      webuiRoot:path.resolve(projectRoot,required('webui-root')),
      catalogPath:path.resolve(projectRoot,required('catalog')),
      outDir:path.resolve(projectRoot,required('out')),
      sha:required('sha'),
      version:required('version')
    });
    console.log(`Built materialized WebUI distribution: ${result.profiles} profiles, ${result.qmAssets} QM assets, sha256 ${result.digest}`);
  }catch(error){console.error(error?.stack||error);process.exit(1);}
}

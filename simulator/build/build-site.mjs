import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'../..');
function arg(name,fallback=''){const prefix=`--${name}=`;const hit=process.argv.find(x=>x.startsWith(prefix));return hit?hit.slice(prefix.length):fallback}
function required(name){const value=arg(name);if(!value)throw new Error(`Missing --${name}=...`);return value}
function runNode(file,args){const result=spawnSync(process.execPath,[file,...args],{cwd:projectRoot,stdio:'inherit'});if(result.status!==0)throw new Error(`${path.basename(file)} failed with status ${result.status}`)}

const out=path.resolve(required('out'));
const catalog=path.resolve(required('catalog'));
const simulatorSha=required('simulator-sha');
const branches=[
  {name:'dev',webuiRoot:path.resolve(required('dev-webui')),sha:required('dev-sha'),version:required('dev-version')},
  {name:'main',webuiRoot:path.resolve(required('main-webui')),sha:required('main-sha'),version:required('main-version')}
];

await fs.rm(out,{recursive:true,force:true});
await fs.mkdir(out,{recursive:true});
const buildPages=path.join(here,'build-pages.mjs');
for(const branch of branches){
  runNode(buildPages,[
    `--branch=${branch.name}`,
    `--webui-root=${branch.webuiRoot}`,
    `--out=${path.join(out,branch.name,'app')}`,
    `--catalog=${catalog}`,
    `--exact-sha=${branch.sha}`,
    `--product-version=${branch.version}`,
    `--simulator-sha=${simulatorSha}`
  ]);
}

await fs.cp(path.join(projectRoot,'simulator/lab'),path.join(out,'lab'),{recursive:true,force:true});
await fs.mkdir(path.join(out,'metadata'),{recursive:true});
await fs.copyFile(catalog,path.join(out,'metadata','qb-releases.json'));
for(const branch of branches){
  const meta={branch:branch.name,exactSha:branch.sha,productVersion:branch.version,simulatorSha,webuiSource:`refs/heads/${branch.name}:webui/**`};
  await fs.writeFile(path.join(out,'metadata',`${branch.name}.json`),JSON.stringify(meta,null,2)+'\n','utf8');
}
const catalogData=JSON.parse(await fs.readFile(catalog,'utf8'));
const descriptorTotals=(Array.isArray(catalogData)?catalogData:[]).reduce((sum,item)=>{
  const stats=item?.preferenceDescriptorStats||{};
  sum.preferences+=Number(stats.total)||0;
  sum.typed+=Number(stats.typed)||0;
  sum.highConfidence+=Number(stats.highConfidence)||0;
  sum.unresolved+=Number(stats.unresolved)||0;
  return sum;
},{preferences:0,typed:0,highConfidence:0,unresolved:0});
const latestProfile=Array.isArray(catalogData)&&catalogData.length?catalogData.at(-1):null;
const preferenceCatalog={
  profiles:Array.isArray(catalogData)?catalogData.length:0,
  ...descriptorTotals,
  latest:latestProfile?{
    qbVersion:latestProfile.qbVersion,
    preferenceCount:latestProfile.preferenceDescriptorStats?.total||0,
    typed:latestProfile.preferenceDescriptorStats?.typed||0,
    unresolved:latestProfile.preferenceDescriptorStats?.unresolved||0
  }:null
};
const siteMeta={simulatorSha,builtAt:new Date().toISOString(),stableProfiles:Array.isArray(catalogData)?catalogData.length:0,preferenceCatalog,branches:Object.fromEntries(branches.map(x=>[x.name,{exactSha:x.sha,productVersion:x.version}]))};
await fs.writeFile(path.join(out,'metadata','site.json'),JSON.stringify(siteMeta,null,2)+'\n','utf8');
await fs.writeFile(path.join(out,'.nojekyll'),'','utf8');
await fs.writeFile(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=./lab/"><title>WeiG Virtual qB Lab</title></head><body><p><a href="./lab/">进入 WeiG Virtual qB Lab</a></p></body></html>','utf8');
console.log(`Assembled WeiG Virtual qB Pages artifact: ${out}`);

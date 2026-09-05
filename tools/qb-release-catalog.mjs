import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {extractPreferenceDescriptors,extractPreferenceKeys} from './qb-source-parsers.mjs';
import {annotateCatalogEvolution,validateCatalogEvolution} from './qb-catalog-evolution.mjs';

const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
const outputArg=process.argv.find(x=>x.startsWith('--output='));
const output=path.resolve(outputArg?outputArg.slice('--output='.length):'simulator/versions/catalog.generated.json');
if(!qbRoot||!fs.existsSync(qbRoot)){
  console.error('Usage: node tools/qb-release-catalog.mjs <qBittorrent-clone> [--output=path]');
  process.exit(2);
}

function git(...args){return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function parts(v){return String(v).replace(/^release-/,'').split('.').map(x=>Number.parseInt(x,10)||0);}
function cmp(a,b){const aa=parts(a),bb=parts(b),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return Math.sign(d);}return 0;}
function show(ref,file){return git('show',`${ref}:${file}`);}
function parseApi(source,tag){const m=source.match(/API_VERSION\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/);if(!m)throw new Error(`${tag}: cannot parse API_VERSION`);return`${m[1]}.${m[2]}.${m[3]}`;}
function preferenceSurface(ref){
  const source=show(ref,'src/webui/api/appcontroller.cpp');
  const preferenceKeys=extractPreferenceKeys(source,ref);
  const preferenceDescriptors=extractPreferenceDescriptors(source,ref);
  if(preferenceDescriptors.length!==preferenceKeys.length)throw new Error(`${ref}: descriptor/key count mismatch ${preferenceDescriptors.length}/${preferenceKeys.length}`);
  const expected=new Set(preferenceKeys);
  const seen=new Set();
  for(const descriptor of preferenceDescriptors){
    if(!expected.has(descriptor.key))throw new Error(`${ref}: descriptor escaped Preferences surface: ${descriptor.key}`);
    if(seen.has(descriptor.key))throw new Error(`${ref}: duplicate descriptor: ${descriptor.key}`);
    seen.add(descriptor.key);
    if(descriptor.writable&&!descriptor.type)throw new Error(`${ref}: writable descriptor lacks high-confidence type: ${descriptor.key}`);
  }
  const typed=preferenceDescriptors.filter(item=>item.type).length;
  const setterPresent=preferenceDescriptors.filter(item=>item.setterPresent).length;
  const highConfidence=preferenceDescriptors.filter(item=>item.sourceConfidence==='HIGH').length;
  const structured=preferenceDescriptors.filter(item=>item.type==='array'||item.type==='object').length;
  return{
    preferenceKeys,
    preferenceDescriptors,
    preferenceDescriptorStats:{
      total:preferenceKeys.length,
      setterPresent,
      typed,
      highConfidence,
      unresolved:preferenceKeys.length-highConfidence,
      structured
    }
  };
}
function apiActions(ref){
  const names=git('ls-tree','-r','--name-only',ref,'src/webui/api').split(/\r?\n/).filter(x=>x.endsWith('controller.h'));
  const actions=new Set();
  for(const file of names){const source=show(ref,file);for(const m of source.matchAll(/\bvoid\s+([A-Za-z0-9_]+Action)\s*\(/g))actions.add(`${path.basename(file)}:${m[1]}`);}
  return [...actions].sort();
}

const tags=git('tag','--list','release-*').split(/\r?\n/).filter(Boolean)
  .filter(tag=>/^release-(?:4|5)\.\d+\.\d+(?:\.\d+)?$/.test(tag))
  .filter(tag=>cmp(tag,'release-4.1.0')>=0)
  .sort(cmp);
if(!tags.length)throw new Error('No stable qBittorrent release tags found from 4.1.0.');

const catalog=[];
for(const tag of tags){
  const qbVersion=tag.slice('release-'.length);
  const webApiVersion=parseApi(show(tag,'src/webui/webapplication.h'),tag);
  const sourceSha=git('rev-list','-n','1',tag);
  const preferences=preferenceSurface(tag);
  catalog.push({
    qbVersion,webApiVersion,tag,sourceSha,stable:true,
    officialWeiGSupport:cmp(qbVersion,'4.1.9.1')>=0,
    protocolGeneration:parts(qbVersion)[0]>=5?'qb5':'qb4',
    ...preferences,
    apiActions:apiActions(tag)
  });
}

annotateCatalogEvolution(catalog);
validateCatalogEvolution(catalog);

fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(catalog,null,2)+'\n','utf8');
const totals=catalog.reduce((sum,item)=>{
  sum.preferences+=item.preferenceDescriptorStats.total;
  sum.typed+=item.preferenceDescriptorStats.typed;
  sum.unresolved+=item.preferenceDescriptorStats.unresolved;
  return sum;
},{preferences:0,typed:0,unresolved:0});
console.log(`Generated ${catalog.length} stable qB profiles: ${catalog[0].qbVersion} -> ${catalog.at(-1).qbVersion}; preference descriptors ${totals.typed}/${totals.preferences} high-confidence typed, ${totals.unresolved} unresolved/fail-closed.`);

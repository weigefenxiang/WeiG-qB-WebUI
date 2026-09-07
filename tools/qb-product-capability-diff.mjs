import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const getArg=name=>{const item=process.argv.find(x=>x.startsWith(`${name}=`));return item?item.slice(name.length+1):null;};
const diff=(a,b)=>{const rhs=new Set(b);return [...new Set(a)].filter(x=>!rhs.has(x)).sort();};
const ACTIONS=['start','stop','delete','force','recheck','sequential','firstlast','autotmm','top','bottom','rename','location','category','dllimit','uplimit','addTrackers','reannounce','removeTrackers','editTracker','tags'];
const PRODUCT_OWNERS=['release-profile.js','capabilities.js','torrent-semantics.js','torrent-fields.js'];

function runtime(catalog){
  const capabilityData=readJson(path.join(root,'webui/private/data/capabilities.json'));
  const sources={};for(const name of PRODUCT_OWNERS)sources[name]=fs.readFileSync(path.join(root,'webui/private/scripts',name),'utf8');
  const document={addEventListener(){},querySelectorAll(){return[];},createElement(){return{className:'',dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},querySelector(){return null;},querySelectorAll(){return[];},remove(){}};},body:{appendChild(){}}};
  const W={buildAssetUrl:x=>x,t:key=>key,util:{parseScalar:value=>value},I18n:{getLocale:()=> 'en-US'}};
  const window={WeiG:W,window:null,dispatchEvent(){},addEventListener(){},requestAnimationFrame:fn=>fn()};window.window=window;
  const context={window,document,console,URL,URLSearchParams,CustomEvent:class{},requestAnimationFrame:fn=>fn(),fetch:async url=>{const value=String(url);if(value.includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};if(value.includes('capabilities.json'))return{ok:true,status:200,json:async()=>capabilityData};throw new Error(`Unexpected fetch ${value}`);}};
  for(const name of PRODUCT_OWNERS)vm.runInNewContext(sources[name],context,{filename:name});
  return{W,featureIds:Object.keys(capabilityData.features||{}).sort()};
}
export async function summarizeProductProfile(profile,catalog,shared=null){
  const rt=shared||runtime(catalog),R=rt.W.ReleaseProfile,C=rt.W.CapabilityRegistry,T=rt.W.TorrentSemantics,F=rt.W.TorrentFieldRegistry;
  const client={qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion,applyCapabilityRegistry(){return this;}};
  await C.bind(client);
  if(R.current()?.qbVersion!==profile.qbVersion)throw new Error(`${profile.qbVersion}: ReleaseProfile exact bind failed during product diff.`);
  if(!F||!Array.isArray(F.fields))throw new Error(`${profile.qbVersion}: TorrentFieldRegistry is unavailable during product diff.`);
  return{qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion,capabilities:rt.featureIds.filter(id=>C.supports(id)),filters:T.statusFilters().map(String).sort(),actions:ACTIONS.filter(action=>R.supportsTorrentAction(action)),fieldProvenance:F.fields.map(field=>`${field.key}=${F.provenance(field.key,profile).mode}`).sort(),writablePreferences:(profile.preferenceDescriptors||[]).filter(item=>item?.writable===true).map(item=>String(item.key)).sort()};
}
export function renderProductDiff(rows){
  if(rows.length<2)return '# Product Capability Diff\n\nNo new official stable profiles to compare.\n';
  const lines=['# Product Capability Diff',''];
  for(let i=1;i<rows.length;i++){
    const before=rows[i-1],now=rows[i];lines.push(`## qB ${before.qbVersion} -> ${now.qbVersion}`,'');
    for(const [label,key] of [['Capabilities','capabilities'],['Canonical filters','filters'],['Canonical Torrent actions','actions'],['Torrent field provenance','fieldProvenance'],['Writable Preferences','writablePreferences']]){const added=diff(now[key],before[key]),removed=diff(before[key],now[key]);lines.push(`- ${label}: +${added.length} / -${removed.length}`);if(added.length)lines.push(`  - added: ${added.map(x=>`\`${x}\``).join(', ')}`);if(removed.length)lines.push(`  - removed: ${removed.map(x=>`\`${x}\``).join(', ')}`);}lines.push('');
  }
  return lines.join('\n')+'\n';
}
async function main(){
  const basePath=path.resolve(getArg('--base')||''),candidatePath=path.resolve(getArg('--candidate')||'');if(!fs.existsSync(basePath)||!fs.existsSync(candidatePath))throw new Error('Usage: node tools/qb-product-capability-diff.mjs --base=path --candidate=path [--output=path]');
  const base=readJson(basePath),candidate=readJson(candidatePath);if(!Array.isArray(base)||!base.length||!Array.isArray(candidate)||candidate.length<base.length)throw new Error('Invalid product diff catalogs.');for(let i=0;i<base.length;i++)if(JSON.stringify(base[i])!==JSON.stringify(candidate[i]))throw new Error(`Candidate mutated frozen profile ${base[i]?.qbVersion||i}.`);
  const fresh=candidate.slice(base.length);if(!fresh.length){const text=renderProductDiff([]),output=getArg('--output');if(output)fs.writeFileSync(path.resolve(output),text,'utf8');process.stdout.write(text);return;}
  const shared=runtime(candidate),profiles=[base.at(-1),...fresh],rows=[];for(const profile of profiles)rows.push(await summarizeProductProfile(profile,candidate,shared));const text=renderProductDiff(rows),output=getArg('--output');if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(path.resolve(output),text,'utf8');}process.stdout.write(text);
}
const isMain=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;if(isMain){main().catch(error=>{console.error(error?.stack||error);process.exit(1);});}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {supportedStableReleaseTags} from './qb-release-tags.mjs';

const SURFACES=['torrentFilters','torrentInfoParameters','torrentInfoFields','torrentStates','torrentPropertiesFields','torrentTrackerFields','torrentFileFields','torrentWebSeedFields'];
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const sha256File=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const getArg=(name,args=process.argv.slice(2))=>{const item=args.find(x=>x.startsWith(`${name}=`));return item?item.slice(name.length+1):null;};
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n','utf8');};

export function catalogTags(catalog){return (Array.isArray(catalog)?catalog:[]).map(item=>String(item?.tag||''));}
export function assertFrozenPrefix(base,candidate,label='candidate'){
  assert(Array.isArray(base)&&base.length>0,'Frozen LKG catalog must be non-empty.');
  assert(Array.isArray(candidate)&&candidate.length>=base.length,`${label} catalog is shorter than frozen LKG.`);
  for(let i=0;i<base.length;i++)assert(JSON.stringify(candidate[i])===JSON.stringify(base[i]),`${label} mutated frozen LKG profile ${base[i]?.qbVersion||i}.`);
  return candidate.slice(base.length);
}
export function stableAdmissionDelta(frozenCatalog,upstreamTags){
  const frozen=catalogTags(frozenCatalog),upstream=supportedStableReleaseTags(upstreamTags);
  assert(frozen[0]==='release-4.1.0',`Frozen LKG floor must be release-4.1.0, got ${frozen[0]||'empty'}.`);
  assert(upstream.length>=frozen.length,`Upstream stable set shrank below LKG: ${upstream.length} < ${frozen.length}.`);
  for(let i=0;i<frozen.length;i++)assert(upstream[i]===frozen[i],`Upstream stable history changed before LKG boundary at ordinal ${i}: ${frozen[i]} -> ${upstream[i]||'missing'}.`);
  return upstream.slice(frozen.length);
}
export function verifyLkg({catalog,manifest,catalogPath}){
  assert(Array.isArray(catalog)&&catalog.length>0,'LKG catalog must be a non-empty array.');
  assert(manifest&&manifest.schemaVersion===1,'LKG manifest schemaVersion must be 1.');
  assert(catalog[0]?.qbVersion===manifest.supportFloor,`LKG floor mismatch: ${catalog[0]?.qbVersion} vs ${manifest.supportFloor}.`);
  assert(catalog.at(-1)?.qbVersion===manifest.latestAdmittedStable,`LKG latest mismatch: ${catalog.at(-1)?.qbVersion} vs ${manifest.latestAdmittedStable}.`);
  assert(catalog.length===manifest.profileCount,`LKG profile count mismatch: ${catalog.length} vs ${manifest.profileCount}.`);
  assert(catalog.every(item=>item?.stable===true&&item?.officialWeiGSupport!==false),'LKG contains a non-official or non-stable profile.');
  assert(new Set(catalogTags(catalog)).size===catalog.length,'LKG contains duplicate release tags.');
  if(catalogPath)assert(sha256File(catalogPath)===manifest.catalogSha256,`LKG catalog SHA-256 mismatch for ${catalogPath}.`);
  return true;
}
export function renderAdmissionReport(base,candidate){
  const fresh=assertFrozenPrefix(base,candidate,'Admission candidate');
  if(!fresh.length)return '# qB Stable Admission\n\nNo new official stable tags were discovered. Frozen LKG remains unchanged.\n';
  const lines=['# qB Stable Admission','',`Frozen LKG: qB ${base.at(-1).qbVersion} (${base.length} profiles)`,`Candidate: qB ${candidate.at(-1).qbVersion} (${candidate.length} profiles)`,`New stable profiles: ${fresh.map(x=>x.qbVersion).join(', ')}`,''];
  for(const profile of fresh){
    lines.push(`## qB ${profile.qbVersion} / WebAPI ${profile.webApiVersion}`,'',`- tag: \`${profile.tag}\``,`- source SHA: \`${profile.sourceSha}\``);
    const action=profile.apiActionChanges||{added:[],removed:[]},params=profile.apiActionParameterChanges?.changed||[],prefs=profile.preferenceChanges||{added:[],removed:[]};
    lines.push(`- API actions: +${action.added?.length||0} / -${action.removed?.length||0}; parameter changes: ${params.length}`);
    lines.push(`- Preferences: +${prefs.added?.length||0} / -${prefs.removed?.length||0}`);
    if(action.added?.length)lines.push(`  - added actions: ${action.added.map(x=>`\`${x}\``).join(', ')}`);
    if(action.removed?.length)lines.push(`  - removed actions: ${action.removed.map(x=>`\`${x}\``).join(', ')}`);
    if(prefs.added?.length)lines.push(`  - added Preferences: ${prefs.added.map(x=>`\`${x}\``).join(', ')}`);
    if(prefs.removed?.length)lines.push(`  - removed Preferences: ${prefs.removed.map(x=>`\`${x}\``).join(', ')}`);
    for(const field of SURFACES){const change=profile.surfaceChanges?.[field]||{added:[],removed:[]};if(change.added?.length||change.removed?.length){lines.push(`- ${field}: +${change.added?.length||0} / -${change.removed?.length||0}`);if(change.added?.length)lines.push(`  - added: ${change.added.map(x=>`\`${x}\``).join(', ')}`);if(change.removed?.length)lines.push(`  - removed: ${change.removed.map(x=>`\`${x}\``).join(', ')}`);}}
    if(params.length){lines.push('- action parameter changes:');for(const item of params)lines.push(`  - \`${item.action}\`: ${JSON.stringify(item.from)} -> ${JSON.stringify(item.to)}`);}
    lines.push('');
  }
  return lines.join('\n')+'\n';
}
export function promotedManifest(oldManifest,base,candidate,{validationCommit=null,admittedAt=null}={}){
  const fresh=assertFrozenPrefix(base,candidate,'Promotion candidate');
  assert(fresh.length>0,'Promotion requires at least one new stable profile.');
  return{...oldManifest,latestAdmittedStable:candidate.at(-1).qbVersion,profileCount:candidate.length,catalogSha256:null,lastAdmission:{validationCommit,admittedAt,tags:fresh.map(x=>x.tag),sourceShas:Object.fromEntries(fresh.map(x=>[x.tag,x.sourceSha]))}};
}
function gitTags(qbRoot){return execFileSync('git',['-C',qbRoot,'tag','--list','release-*'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim().split(/\r?\n/).filter(Boolean);}
function main(){
  const args=process.argv.slice(2),command=args[0],catalogPath=path.resolve(getArg('--catalog',args)||'tests/fixtures/qb-release-catalog.lkg.json'),manifestPath=path.resolve(getArg('--manifest',args)||'tools/data/qb-stable-lkg.json');
  const catalog=readJson(catalogPath),manifest=readJson(manifestPath);verifyLkg({catalog,manifest,catalogPath});
  if(command==='verify'){console.log(`Frozen LKG verified: ${catalog.length} profiles ${catalog[0].qbVersion} -> ${catalog.at(-1).qbVersion}; sha256 ${manifest.catalogSha256}.`);return;}
  if(command==='discover'){
    const qbRoot=path.resolve(args[1]||'');assert(qbRoot&&fs.existsSync(qbRoot),'Usage: node tools/qb-stable-admission.mjs discover <qB-clone> [--catalog=...] [--manifest=...] [--output=...]');
    const newTags=stableAdmissionDelta(catalog,gitTags(qbRoot)),result={supportFloor:manifest.supportFloor,latestAdmittedStable:manifest.latestAdmittedStable,profileCount:manifest.profileCount,newTags,newVersions:newTags.map(x=>x.replace(/^release-/,'')),hasNew:newTags.length>0};
    const output=getArg('--output',args);if(output)writeJson(path.resolve(output),result);console.log(JSON.stringify(result));return;
  }
  if(command==='report'){
    const candidatePath=path.resolve(getArg('--candidate',args)||'');assert(candidatePath&&fs.existsSync(candidatePath),'report requires --candidate=path');const candidate=readJson(candidatePath),text=renderAdmissionReport(catalog,candidate),output=getArg('--output',args);if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(path.resolve(output),text,'utf8');}process.stdout.write(text);return;
  }
  if(command==='promote-manifest'){
    const candidatePath=path.resolve(getArg('--candidate',args)||''),outputPath=path.resolve(getArg('--output',args)||'');assert(candidatePath&&fs.existsSync(candidatePath),'promote-manifest requires --candidate=path');assert(outputPath,'promote-manifest requires --output=path');const candidate=readJson(candidatePath),next=promotedManifest(manifest,catalog,candidate,{validationCommit:process.env.WEIGG_VALIDATION_SHA||process.env.GITHUB_SHA||null,admittedAt:new Date().toISOString()});next.catalogSha256=sha256File(candidatePath);writeJson(outputPath,next);console.log(`Prepared LKG manifest for ${next.latestAdmittedStable}; ${next.profileCount} profiles; sha256 ${next.catalogSha256}.`);return;
  }
  throw new Error('Usage: node tools/qb-stable-admission.mjs <verify|discover|report|promote-manifest> ...');
}
const isMain=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;if(isMain){try{main();}catch(error){console.error(error?.stack||error);process.exit(1);}}

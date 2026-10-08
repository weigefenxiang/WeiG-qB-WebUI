import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {supportedStableReleaseTags} from './qb-release-tags.mjs';

const SURFACES=['torrentFilters','torrentInfoParameters','torrentInfoFields','torrentStates','torrentPropertiesFields','torrentTrackerFields','torrentFileFields','torrentWebSeedFields'];
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const readTagsFile=file=>fs.readFileSync(file,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
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
export function verifyCandidateSourceIdentity(frozen,candidate,upstreamTags,resolveTagCommit){
  if(typeof resolveTagCommit!=='function')throw new Error('Candidate source identity requires an independent official Git tag resolver.');
  const newTags=stableAdmissionDelta(frozen,upstreamTags),fresh=assertFrozenPrefix(frozen,candidate,'Official source candidate');
  assert(newTags.length>0,'Official source candidate has no new upstream stable tag.');
  assert(fresh.length===newTags.length,'Official source candidate count does not match newly discovered stable tags.');
  return fresh.map((profile,index)=>{
    const tag=newTags[index],sha=String(profile?.sourceSha||'').toLowerCase(),actual=String(resolveTagCommit(tag)||'').trim().toLowerCase();
    assert(profile?.tag===tag&&profile?.qbVersion===tag.replace(/^release-/,''),'Candidate tag/version identity is not the official upstream stable sequence: '+tag);
    assert(profile?.stable===true&&profile?.officialWeiGSupport===true,'Candidate release must be marked official stable: '+tag);
    assert(/^[0-9a-f]{40}$/.test(sha),'Candidate source commit must be exact 40-hex SHA: '+tag);
    assert(/^[0-9a-f]{40}$/.test(actual),'Official upstream tag resolver returned no exact commit SHA: '+tag);
    assert(actual===sha,'Candidate source SHA diverges from the peeled official upstream release tag '+tag+': '+sha+' != '+actual);
    assert(/^\d+\.\d+(?:\.\d+){0,2}$/.test(String(profile?.webApiVersion||'')),'Candidate is missing a valid source WebAPI identity: '+tag);
    return {tag,qbVersion:profile.qbVersion,webApiVersion:profile.webApiVersion,sourceSha:sha,identity:'OFFICIAL_TAG_COMMIT_EXACT'};
  });
}

export function admissionProductCatalog(base,candidate){
  const fresh=assertFrozenPrefix(base,candidate,'Admission candidate');
  assert(fresh.length>0,'Admission product catalog requires at least one new stable profile.');
  const selected=[base[0]];
  if(base.length>1)selected.push(base.at(-1));
  selected.push(...fresh);
  return selected;
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
const leafMap=function leafMap(value,path="",out=new Map()){
  if(Array.isArray(value)&&value.length){value.forEach((entry,i)=>leafMap(entry,`${path}[${i}]`,out));return out;}
  if(value&&typeof value==="object"&&Object.keys(value).length){for(const key of Object.keys(value).sort())leafMap(value[key],path?`${path}.${key}`:key,out);return out;}
  out.set(path||"(root)",JSON.stringify(value??null));
  return out;
};
export const semanticFieldReview=function semanticFieldReview(previous,current){
  const names=["torrentVisibleFilters","facetSpecialRows","torrentContextMenu","torrentDetailUi","statisticsUi","torrentTableColumns","trackerFilters","trackerFacetMode"];
  const result=[];
  for(const name of names){
    const lhs=leafMap(previous?.[name]),rhs=leafMap(current?.[name]),paths=[...new Set([...lhs.keys(),...rhs.keys()])].sort();
    const changed=paths.filter(path=>lhs.get(path)!==rhs.get(path));
    if(changed.length)result.push({field:name,count:changed.length,previousPresent:Object.prototype.hasOwnProperty.call(previous||{},name),currentPresent:Object.prototype.hasOwnProperty.call(current||{},name),sample:changed.slice(0,16)});
  }
  return result;
};

export function renderAdmissionReport(base,candidate){
  const fresh=assertFrozenPrefix(base,candidate,'Admission candidate');
  if(!fresh.length)return '# qB Stable Admission\n\nNo new official stable tags were discovered. Frozen LKG remains unchanged.\n';
  const lines=['# qB Stable Admission','',`Frozen LKG: qB ${base.at(-1).qbVersion} (${base.length} profiles)`,`Candidate: qB ${candidate.at(-1).qbVersion} (${candidate.length} profiles)`,`New stable profiles: ${fresh.map(x=>x.qbVersion).join(', ')}`,''];
  for(const [index,profile] of fresh.entries()){
    const previous=candidate[base.length+index-1];
    const review=semanticFieldReview(previous,profile);
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
    if(review.length){
      lines.push('- Source UI/domain review (candidate extraction; independent upstream census still required):');
      for(const change of review){
        lines.push(`  - \`${change.field}\`: ${change.count} changed leaf paths; presence ${change.previousPresent?'present':'absent'} -> ${change.currentPresent?'present':'absent'}`);
        for(const key of change.sample)lines.push(`    - \`${key}\``);
        if(change.count>change.sample.length)lines.push(`    - ... and ${change.count-change.sample.length} additional changed leaf paths`);
      }
    }
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
function discoveryResult(catalog,manifest,tags){const newTags=stableAdmissionDelta(catalog,tags);return{supportFloor:manifest.supportFloor,latestAdmittedStable:manifest.latestAdmittedStable,profileCount:manifest.profileCount,newTags,newVersions:newTags.map(x=>x.replace(/^release-/,'')),hasNew:newTags.length>0};}
function main(){
  const args=process.argv.slice(2),command=args[0],catalogPath=path.resolve(getArg('--catalog',args)||'tests/fixtures/qb-release-catalog.lkg.json'),manifestPath=path.resolve(getArg('--manifest',args)||'tools/data/qb-stable-lkg.json');
  const catalog=readJson(catalogPath),manifest=readJson(manifestPath);verifyLkg({catalog,manifest,catalogPath});
  if(command==='verify'){console.log(`Frozen LKG verified: ${catalog.length} profiles ${catalog[0].qbVersion} -> ${catalog.at(-1).qbVersion}; sha256 ${manifest.catalogSha256}.`);return;}
  if(command==='discover'||command==='discover-tags'){
    const source=path.resolve(args[1]||'');assert(source&&fs.existsSync(source),command==='discover'?'Usage: node tools/qb-stable-admission.mjs discover <qB-clone> [--output=...]':'Usage: node tools/qb-stable-admission.mjs discover-tags <tag-file> [--output=...]');
    const result=discoveryResult(catalog,manifest,command==='discover'?gitTags(source):readTagsFile(source)),output=getArg('--output',args);if(output)writeJson(path.resolve(output),result);console.log(JSON.stringify(result));return;
  }
  if(command==='verify-candidate-source'){
    const source=path.resolve(args[1]||''),candidatePath=path.resolve(getArg('--candidate',args)||'');
    assert(fs.existsSync(source),'verify-candidate-source requires an upstream qBittorrent Git clone.');
    assert(candidatePath&&fs.existsSync(candidatePath),'verify-candidate-source requires --candidate=path');
    const rows=verifyCandidateSourceIdentity(catalog,readJson(candidatePath),gitTags(source),tag=>execFileSync('git',['-C',source,'rev-parse',tag+'^{commit}'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim());
    const result={source:'official-qb-tag-commit',frozenProfiles:catalog.length,verifiedNew:rows.length,releases:rows,independentDomainCensusComplete:false};
    const output=getArg('--output',args);if(output)writeJson(path.resolve(output),result);
    console.log(JSON.stringify(result));return;
  }
  if(command==='product-catalog'){
    const candidatePath=path.resolve(getArg('--candidate',args)||''),outputPath=path.resolve(getArg('--output',args)||'');assert(candidatePath&&fs.existsSync(candidatePath),'product-catalog requires --candidate=path');assert(outputPath,'product-catalog requires --output=path');const selected=admissionProductCatalog(catalog,readJson(candidatePath));writeJson(outputPath,selected);console.log(`Prepared focused admission product catalog: ${selected.map(x=>x.qbVersion).join(', ')}.`);return;
  }
  if(command==='report'){
    const candidatePath=path.resolve(getArg('--candidate',args)||'');assert(candidatePath&&fs.existsSync(candidatePath),'report requires --candidate=path');const candidate=readJson(candidatePath),text=renderAdmissionReport(catalog,candidate),output=getArg('--output',args);if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(path.resolve(output),text,'utf8');}process.stdout.write(text);return;
  }
  if(command==='promote-manifest'){
    const candidatePath=path.resolve(getArg('--candidate',args)||''),outputPath=path.resolve(getArg('--output',args)||'');assert(candidatePath&&fs.existsSync(candidatePath),'promote-manifest requires --candidate=path');assert(outputPath,'promote-manifest requires --output=path');const candidate=readJson(candidatePath),next=promotedManifest(manifest,catalog,candidate,{validationCommit:process.env.WEIG_VALIDATION_SHA||process.env.GITHUB_SHA||null,admittedAt:new Date().toISOString()});next.catalogSha256=sha256File(candidatePath);writeJson(outputPath,next);console.log(`Prepared LKG manifest for ${next.latestAdmittedStable}; ${next.profileCount} profiles; sha256 ${next.catalogSha256}.`);return;
  }
  throw new Error('Usage: node tools/qb-stable-admission.mjs <verify|discover|discover-tags|verify-candidate-source|product-catalog|report|promote-manifest> ...');
}
const isMain=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;if(isMain){try{main();}catch(error){console.error(error?.stack||error);process.exit(1);}}

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CATEGORY_ORDER=['feature','fix','performance','compatibility'];
const CATEGORY_TITLES={feature:'Features / UI',fix:'Fixes',performance:'Performance',compatibility:'Compatibility'};
const CATEGORY_SCORE={feature:40,fix:30,performance:20,compatibility:10};
const SEMVER_TAG=/^v\d+\.\d+\.\d+$/;
const PRESENTATION_MODES=new Set(['latest','archive']);
export function normalizePresentation(value='latest'){
  const mode=String(value||'latest').trim().toLowerCase();
  if(!PRESENTATION_MODES.has(mode))throw new Error(`Unsupported Release presentation: ${value}`);
  return mode;
}
const RELEASE_VISIBLE_EXACT=new Set([
  'webui/private/index.html',
  'webui/public/index.html',
  'webui/public/login.html',
  'webui/public/session-contract.js',
  'webui/public/storage-migration.js'
]);
const RELEASE_VISIBLE_PREFIXES=[
  'webui/private/scripts/',
  'webui/private/css/',
  'webui/private/views/',
  'webui/public/scripts/'
];

export function isReleaseVisiblePath(value=''){
  const file=String(value).replaceAll('\\','/');
  return RELEASE_VISIBLE_EXACT.has(file)||RELEASE_VISIBLE_PREFIXES.some(prefix=>file.startsWith(prefix));
}
function cleanSubject(subject=''){
  return String(subject).trim().replace(/^\[[^\]]+\]\s*/,'');
}
function normalizeCategory(value=''){
  const v=String(value).trim().toLowerCase().replace(/\s+/g,'');
  if(['功能/ui','功能','ui','feature','features','feat'].includes(v))return'feature';
  if(['修复','fix','fixes','bugfix','bug'].includes(v))return'fix';
  if(['性能','perf','performance'].includes(v))return'performance';
  if(['兼容','compat','compatibility'].includes(v))return'compatibility';
  return null;
}
function inferCategory(subject=''){
  const prefix=(String(subject).trim().match(/^([a-zA-Z]+)(?:\([^)]*\))?[!:]/)||[])[1]?.toLowerCase()||'';
  if(['feat','feature','ui'].includes(prefix))return'feature';
  if(['fix','bugfix'].includes(prefix))return'fix';
  if(['perf','performance'].includes(prefix))return'performance';
  if(['compat','compatibility'].includes(prefix))return'compatibility';
  return'internal';
}
function displaySubject(subject=''){
  const cleaned=cleanSubject(subject).replace(/^[a-zA-Z]+(?:\([^)]*\))?[!:]\s*/,'').trim();
  return cleaned||cleanSubject(subject)||'Untitled change';
}
const LETTER_CHAR=/\p{L}/u;
const LATIN_CHAR=/\p{Script=Latin}/u;
export function containsNonLatinLetter(value=''){
  for(const ch of String(value)){
    if(LETTER_CHAR.test(ch)&&!LATIN_CHAR.test(ch))return true;
  }
  return false;
}
function markdownText(value=''){
  return String(value).replace(/\\/g,'\\\\').replace(/([\`*_\[\]<>])/g,'\\$1');
}
function releaseNoteMetadata(body=''){
  const match=String(body).match(/^Release-Note:\s*(.+)$/im);
  if(!match)return null;
  const raw=match[1].trim();
  if(/^skip$/i.test(raw))return{skip:true};
  const categorized=raw.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
  if(categorized){
    const category=normalizeCategory(categorized[1]);
    if(category)return{category,text:categorized[2].trim(),explicit:true};
  }
  return{category:'feature',text:raw,explicit:true};
}
export function normalizeCommit(commit){
  const paths=Array.isArray(commit?.paths)?commit.paths:[];
  if(paths.length&&!paths.some(isReleaseVisiblePath))return null;
  const subject=String(commit?.subject||'').trim(),body=String(commit?.body||''),meta=releaseNoteMetadata(body);
  if(meta?.skip)return null;
  const category=meta?.category||inferCategory(subject);
  if(category==='internal'&&!meta?.explicit)return null;
  let text=(meta?.text||displaySubject(subject)).trim();
  if(containsNonLatinLetter(text)){
    const fallback=displaySubject(subject).trim();
    if(!fallback||containsNonLatinLetter(fallback))return null;
    text=fallback;
  }
  if(!text)return null;
  return{hash:String(commit?.hash||''),subject,body,paths,category,text,explicit:!!meta?.explicit};
}
function dedupe(items){
  const seen=new Set(),out=[];
  for(const item of items){
    const key=`${item.category}|${item.text.toLowerCase().replace(/\s+/g,' ').trim()}`;
    if(seen.has(key))continue;
    seen.add(key);out.push(item);
  }
  return out;
}
export function buildReleaseNotes({commits=[],fromTag='',toSha='',maxHighlights=8,maxDetails=24,imageUrl='',presentation='latest'}={}){
  const mode=normalizePresentation(presentation);
  const normalized=dedupe(commits.map(normalizeCommit).filter(Boolean));
  const ranked=normalized.map((item,index)=>({item,index,score:(item.explicit?100:0)+(CATEGORY_SCORE[item.category]||0)}))
    .sort((a,b)=>b.score-a.score||a.index-b.index);
  const highlights=ranked.slice(0,Math.max(0,Number(maxHighlights)||8)).map(row=>row.item);
  const details=normalized.slice(0,Math.max(0,Number(maxDetails)||24));
  const grouped=Object.fromEntries(CATEGORY_ORDER.map(key=>[key,[]]));
  details.forEach(item=>(grouped[item.category]||grouped.feature).push(item));
  const lines=[];
  if(mode==='latest'&&imageUrl)lines.push(`![WeiG qB WebUI preview](${imageUrl})`,'');
  lines.push('## Highlights','');
  if(highlights.length)highlights.forEach(item=>lines.push(`- ${markdownText(item.text)}`));
  else lines.push('- No user-visible WebUI changes are available for this release range.');
  lines.push('','<details>',`<summary>View WebUI changes (showing ${details.length} of ${normalized.length})</summary>`,'');
  for(const category of CATEGORY_ORDER){
    const items=grouped[category];
    if(!items.length)continue;
    lines.push(`### ${CATEGORY_TITLES[category]}`,'');
    for(const item of items){
      const short=/^[0-9a-f]{7,40}$/i.test(item.hash)?item.hash.slice(0,7):'';
      lines.push(`- ${markdownText(item.text)}${short?` (\`${short}\`)`:''}`);
    }
    lines.push('');
  }
  if(normalized.length>details.length)lines.push(`${normalized.length-details.length} additional WebUI changes are omitted to keep this release page concise.`,'');
  lines.push('</details>','');
  if(fromTag||toSha)lines.push(`_Range: ${fromTag||'repository start'} → ${toSha||'current release'}_`,'');
  const markdown=lines.join('\n');
  if(containsNonLatinLetter(markdown))throw new Error('Public Release Notes must use Latin-script public text.');
  return{markdown,highlights,items:normalized,details,grouped,presentation:mode};
}
function runGit(args,{cwd=process.cwd()}={}){
  return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
export function resolvePreviousStableTag({to,currentTag='',cwd=process.cwd()}={}){
  if(!/^[0-9a-f]{40}$/i.test(String(to||'')))throw new Error('Release notes require an exact 40-character target SHA.');
  const tags=runGit(['tag','--merged',to,'--sort=-version:refname'],{cwd}).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return tags.find(tag=>SEMVER_TAG.test(tag)&&tag!==currentTag)||'';
}
function changedPaths(hash,cwd){
  const raw=runGit(['diff-tree','--root','--no-commit-id','--name-only','-r',hash],{cwd});
  return raw?raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean):[];
}
export function readGitCommits({fromTag='',to,cwd=process.cwd()}={}){
  if(!/^[0-9a-f]{40}$/i.test(String(to||'')))throw new Error('Release notes require an exact 40-character target SHA.');
  const range=fromTag?`${fromTag}..${to}`:to;
  const raw=runGit(['log','--no-merges','--format=%H%x1f%s%x1f%b%x1e',range],{cwd});
  if(!raw)return[];
  return raw.split('\x1e').map(record=>record.trim()).filter(Boolean).map(record=>{
    const [hash='',subject='',...body]=record.split('\x1f'),cleanHash=hash.trim();
    return{hash:cleanHash,subject:subject.trim(),body:body.join('\x1f').trim(),paths:changedPaths(cleanHash,cwd)};
  });
}
function releaseImage({cwd,version,ref,repository}){
  const rel=`assets/screenshots/weig-qb-webui-desktop-overview-v${version}.gif`;
  if(!fs.existsSync(path.join(cwd,rel)))return'';
  if(!/^[\w.-]+\/[\w.-]+$/.test(repository)||!ref)return'';
  return `https://raw.githubusercontent.com/${repository}/${ref}/${rel}`;
}
function arg(name,fallback=''){
  const prefix=`--${name}=`,inline=process.argv.find(value=>value.startsWith(prefix));
  if(inline)return inline.slice(prefix.length);
  const index=process.argv.indexOf(`--${name}`);
  return index>=0&&process.argv[index+1]!==undefined?process.argv[index+1]:fallback;
}
export function generateFromGit({to,currentTag='',out='',cwd=process.cwd(),repository=process.env.GITHUB_REPOSITORY||'',imageRef='',presentation='latest'}={}){
  const mode=normalizePresentation(presentation);
  const fromTag=resolvePreviousStableTag({to,currentTag,cwd}),commits=readGitCommits({fromTag,to,cwd});
  let imageUrl='';
  if(mode==='latest'){
    const taggedVersion=SEMVER_TAG.test(currentTag)?currentTag.slice(1):'';
    const version=taggedVersion||fs.readFileSync(path.join(cwd,'VERSION'),'utf8').trim();
    const ref=imageRef||currentTag||to;
    imageUrl=releaseImage({cwd,version,ref,repository});
  }
  const result=buildReleaseNotes({commits,fromTag,toSha:to,imageUrl,presentation:mode});
  if(out)fs.writeFileSync(out,result.markdown,'utf8');
  return{...result,fromTag,toSha:to,imageUrl};
}
const isCli=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isCli){
  const to=String(arg('to',process.env.GITHUB_SHA||'')).trim().toLowerCase();
  const currentTag=String(arg('current-tag',process.env.GITHUB_REF_NAME||'')).trim();
  const out=String(arg('out','')).trim();
  const repository=String(arg('repository',process.env.GITHUB_REPOSITORY||'')).trim();
  const imageRef=String(arg('image-ref','')).trim();
  const presentation=String(arg('presentation','latest')).trim();
  const result=generateFromGit({to,currentTag,out,repository,imageRef,presentation});
  if(!out)process.stdout.write(result.markdown);
  else console.log(`Release notes: ${result.fromTag||'repository start'} -> ${result.toSha}; ${result.items.length} WebUI entries; ${result.highlights.length} highlights; image=${result.imageUrl||'none'}; wrote ${out}`);
}

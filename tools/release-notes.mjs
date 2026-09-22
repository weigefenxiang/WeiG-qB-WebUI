#!/usr/bin/env node
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const CATEGORY_ORDER=['feature','fix','performance','compatibility','internal'];
const CATEGORY_TITLES={
  feature:'功能 / UI',
  fix:'修复',
  performance:'性能',
  compatibility:'兼容',
  internal:'内部工程'
};
const SEMVER_TAG=/^v\d+\.\d+\.\d+$/;

function cleanSubject(subject=''){
  return String(subject).trim().replace(/^\[[^\]]+\]\s*/,'');
}
function normalizeCategory(value=''){
  const v=String(value).trim().toLowerCase().replace(/\s+/g,'');
  if(['功能/ui','功能','ui','feature','features','feat'].includes(v))return'feature';
  if(['修复','fix','fixes','bugfix','bug'].includes(v))return'fix';
  if(['性能','perf','performance'].includes(v))return'performance';
  if(['兼容','compat','compatibility'].includes(v))return'compatibility';
  if(['内部工程','内部','internal','engineering','infra'].includes(v))return'internal';
  return null;
}
function inferCategory(subject=''){
  const s=String(subject).trim();
  const prefix=(s.match(/^([a-zA-Z]+)(?:\([^)]*\))?[!:]/)||[])[1]?.toLowerCase()||'';
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
  return{text:raw,explicit:true};
}
export function normalizeCommit(commit){
  const subject=String(commit?.subject||'').trim(),body=String(commit?.body||''),meta=releaseNoteMetadata(body);
  if(meta?.skip)return null;
  const category=meta?.category||inferCategory(subject);
  const text=(meta?.text||displaySubject(subject)).trim();
  if(!text)return null;
  return{hash:String(commit?.hash||''),subject,body,category,text,explicit:!!meta?.explicit};
}
export function buildReleaseNotes({commits=[],fromTag='',toSha='',maxHighlights=8}={}){
  const normalized=commits.map(normalizeCommit).filter(Boolean);
  const grouped=Object.fromEntries(CATEGORY_ORDER.map(key=>[key,[]]));
  normalized.forEach(item=>(grouped[item.category]||grouped.internal).push(item));
  const userFacing=normalized.filter(item=>item.category!=='internal');
  const highlights=userFacing.slice(0,Math.max(0,Number(maxHighlights)||8));
  const lines=['## 主要更新',''];
  if(highlights.length)highlights.forEach(item=>lines.push(`- ${markdownText(item.text)}`));
  else if(normalized.length)lines.push('- 本次版本以内部工程与维护更新为主，完整记录见下方。');
  else lines.push('- 本次范围没有可列出的更新。');
  lines.push('','<details>',`<summary>查看完整更新记录（${normalized.length} 项）</summary>`,'');
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
  lines.push('</details>','');
  if(fromTag||toSha)lines.push(`_范围：${fromTag||'repository start'} → ${toSha||'current release'}_`,'');
  return{markdown:lines.join('\n'),highlights,items:normalized,grouped};
}
function runGit(args,{cwd=process.cwd()}={}){
  return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
export function resolvePreviousStableTag({to,currentTag='',cwd=process.cwd()}={}){
  if(!/^[0-9a-f]{40}$/i.test(String(to||'')))throw new Error('Release notes require an exact 40-character target SHA.');
  const tags=runGit(['tag','--merged',to,'--sort=-version:refname'],{cwd}).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  return tags.find(tag=>SEMVER_TAG.test(tag)&&tag!==currentTag)||'';
}
export function readGitCommits({fromTag='',to,cwd=process.cwd()}={}){
  if(!/^[0-9a-f]{40}$/i.test(String(to||'')))throw new Error('Release notes require an exact 40-character target SHA.');
  const range=fromTag?`${fromTag}..${to}`:to;
  const raw=runGit(['log','--no-merges','--format=%H%x1f%s%x1f%b%x1e',range],{cwd});
  if(!raw)return[];
  return raw.split('\x1e').map(record=>record.trim()).filter(Boolean).map(record=>{
    const [hash='',subject='',...body]=record.split('\x1f');
    return{hash:hash.trim(),subject:subject.trim(),body:body.join('\x1f').trim()};
  });
}
function arg(name,fallback=''){
  const prefix=`--${name}=`,inline=process.argv.find(value=>value.startsWith(prefix));
  if(inline)return inline.slice(prefix.length);
  const index=process.argv.indexOf(`--${name}`);
  return index>=0&&process.argv[index+1]!==undefined?process.argv[index+1]:fallback;
}
export function generateFromGit({to,currentTag='',out='',cwd=process.cwd()}={}){
  const fromTag=resolvePreviousStableTag({to,currentTag,cwd}),commits=readGitCommits({fromTag,to,cwd}),result=buildReleaseNotes({commits,fromTag,toSha:to});
  if(out)fs.writeFileSync(out,result.markdown,'utf8');
  return{...result,fromTag,toSha:to};
}
const isCli=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isCli){
  const to=String(arg('to',process.env.GITHUB_SHA||'')).trim().toLowerCase();
  const currentTag=String(arg('current-tag',process.env.GITHUB_REF_NAME||'')).trim();
  const out=String(arg('out','')).trim();
  const result=generateFromGit({to,currentTag,out});
  if(!out)process.stdout.write(result.markdown);
  else console.log(`Release notes: ${result.fromTag||'repository start'} -> ${result.toSha}; ${result.items.length} entries; ${result.highlights.length} highlights; wrote ${out}`);
}

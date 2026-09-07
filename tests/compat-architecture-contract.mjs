import assert from 'node:assert/strict';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const centralizedOwners=new Set(['webui/private/scripts/release-profile.js']);
const frozenLegacyOwners=new Map([
  ['webui/private/scripts/qb-client.js','e4b8f9a806beb6ed5b70540521f0ea3e1d4f5358'],
  ['webui/private/scripts/spatial.js','e489e6e463f1855a1e54a17e47bebde54a733d49']
]);
const patterns=[
  ['qB major comparison',/\b(?:this\.|self\.)?major\s*(?:===|!==|==|!=|>=|<=|>|<)\s*\d+/g],
  ['qB version comparison',/(?:\b[A-Za-z_$][\w$]*\.)*qbVersion(?:\.replace\([^;\n]*?\))?\s*(?:===|!==|==|!=|>=|<=|>|<)\s*['"`]\d/g],
  ['qB version prefix branch',/(?:\b[A-Za-z_$][\w$]*\.)*qbVersion\.(?:startsWith|includes)\(\s*['"`]\d/g],
  ['qB version helper branch',/\b(?:atLeast|versionAtLeast)\s*\(\s*(?:\b[A-Za-z_$][\w$]*\.)*qbVersion\s*,/g]
];
function git(...args){return execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']});}
function trackedScripts(){
  const out=[];
  for(const line of git('ls-files','-s','--','webui/private/scripts').split(/\r?\n/)){
    if(!line.trim())continue;
    const match=line.match(/^(\d+)\s+([0-9a-f]+)\s+\d+\t(.+)$/i);
    assert.ok(match,`Unable to parse Git index entry: ${line}`);
    const rel=match[3].replaceAll('\\','/');
    if(rel.endsWith('.js'))out.push({rel,sha:match[2]});
  }
  return out.sort((a,b)=>a.rel.localeCompare(b.rel));
}
function blobSource(sha){return git('cat-file','blob',sha);}
function findings(source){const out=[];for(const [kind,re] of patterns){re.lastIndex=0;for(const match of source.matchAll(re))out.push({kind,text:match[0],index:match.index});}return out.sort((a,b)=>a.index-b.index);}
function bodyEnd(text,open,label){
  let depth=0,quote='',escape=false,lineComment=false,blockComment=false;
  for(let i=open;i<text.length;i++){
    const ch=text[i],next=text[i+1]||'';
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(escape){escape=false;continue;}if(ch==='\\'){escape=true;continue;}if(ch===quote)quote='';continue;}
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    else if(ch==='}'&&--depth===0)return i;
  }
  throw new Error(`${label}: unterminated Client prototype function`);
}
function clientMethods(source){
  const text=String(source||''),out=[];
  const re=/\bClient\.prototype\.([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\s*\([^)]*\)\s*\{/g;
  let match;
  while((match=re.exec(text))){
    const open=text.indexOf('{',match.index+match[0].length-1),end=bodyEnd(text,open,match[1]);
    out.push({name:match[1],body:text.slice(open+1,end)});
    re.lastIndex=end+1;
  }
  return out;
}
const files=trackedScripts(),violations=[],legacySeen=[];
for(const file of files){
  const source=blobSource(file.sha),hits=findings(source);
  if(!hits.length)continue;
  if(centralizedOwners.has(file.rel))continue;
  const expected=frozenLegacyOwners.get(file.rel);
  if(expected){
    assert.equal(file.sha,expected,`${file.rel} contains legacy qB version branches and changed from frozen reviewed blob ${expected}; migrate/review those branches before updating the baseline.`);
    legacySeen.push(file.rel);
    continue;
  }
  violations.push(`${file.rel}: ${hits.map(hit=>`${hit.kind}=${JSON.stringify(hit.text)}`).join('; ')}`);
}
assert.equal(violations.length,0,`Scattered qB version-if detected outside centralized/frozen owners:\n${violations.join('\n')}`);

const sources=new Map(files.map(file=>[file.rel,blobSource(file.sha)]));
const apiRootOwners=files.filter(file=>sources.get(file.rel).includes('api/v2/')).map(file=>file.rel);
assert.deepEqual(apiRootOwners,['webui/private/scripts/qb-client.js'],'Direct qB WebAPI transport root must remain centralized in QBClient.');
const qbSource=sources.get('webui/private/scripts/qb-client.js');
assert.ok(qbSource,'QBClient source must be present in the tracked product script set.');
assert.equal([...qbSource.matchAll(/\bfetch\s*\(\s*['"]api\/v2\//g)].length,1,'QBClient must retain exactly one raw api/v2 fetch transport root.');
const methods=clientMethods(qbSource),postPattern=/\bmethod\s*:\s*['"]POST['"]/;
const directPosts=methods.filter(method=>postPattern.test(method.body));
const transportOwners=new Set(['_torrentAction','_guardedTorrentAction']);
const safePostExceptions=new Set(['logout']);
const unowned=[];
for(const method of directPosts){
  const postIndex=method.body.search(postPattern),guardIndex=method.body.indexOf('requireSourceAction(');
  if(guardIndex>=0&&guardIndex<postIndex)continue;
  if(transportOwners.has(method.name))continue;
  if(safePostExceptions.has(method.name))continue;
  unowned.push(method.name);
}
assert.deepEqual(unowned,[],`QBClient direct state-changing POST methods must source-guard before transport; unowned: ${unowned.join(', ')}`);
for(const name of transportOwners)assert.ok(qbSource.includes(`Client.prototype.${name}=function`),`Reviewed Torrent dispatch owner ${name} must remain present.`);
const logout=directPosts.find(method=>method.name==='logout');
assert.ok(logout,'Logout must remain an explicit safe unguarded POST exception so users can terminate a session even when ReleaseProfile is unavailable.');
assert.match(logout.body,/this\.request\(\s*['"]auth\/logout['"]\s*,\s*\{\s*method\s*:\s*['"]POST['"]\s*,\s*type\s*:\s*['"]void['"]\s*\}\s*\)/,'Logout exception must remain narrowly scoped to POST auth/logout with a void response.');
assert.doesNotMatch(logout.body,/\b(?:form|json|body)\s*:/,'Logout safe exception must not grow a request payload.');
console.log(`Compatibility architecture contract passed: scanned ${files.length} complete Git-indexed product script blobs; scattered qB version-if is blocked, API transport remains centralized in QBClient, ${directPosts.length} direct POST method(s) have source ownership or reviewed transport/safety exceptions, and ${legacySeen.length} legacy owner blob(s) remain frozen for explicit migration/review.`);

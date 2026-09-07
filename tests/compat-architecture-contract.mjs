import assert from 'node:assert/strict';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const centralizedOwners=new Set(['webui/private/scripts/release-profile.js']);
const frozenLegacyOwners=new Map([
  ['webui/private/scripts/qb-client.js','88ef6f49963172d5047216dcd6f06d2b4c30f837'],
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
console.log(`Compatibility architecture contract passed: scanned ${files.length} complete Git-indexed product script blobs; scattered qB version-if is blocked, centralized ReleaseProfile remains allowed, and ${legacySeen.length} legacy owner blob(s) are frozen for explicit migration/review.`);

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const scriptsRoot=path.join(root,'webui/private/scripts');
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
function walk(dir){const out=[];for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())out.push(...walk(full));else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(full);}return out.sort();}
function gitBlobSha(source){const body=Buffer.from(source,'utf8'),hash=crypto.createHash('sha1');hash.update(Buffer.from(`blob ${body.length}\0`,'utf8'));hash.update(body);return hash.digest('hex');}
function findings(source){const out=[];for(const [kind,re] of patterns){re.lastIndex=0;for(const match of source.matchAll(re))out.push({kind,text:match[0],index:match.index});}return out.sort((a,b)=>a.index-b.index);}
const files=walk(scriptsRoot),violations=[],legacySeen=[];
for(const file of files){const rel=path.relative(root,file).replaceAll('\\','/'),source=fs.readFileSync(file,'utf8'),hits=findings(source);if(!hits.length)continue;if(centralizedOwners.has(rel))continue;const expected=frozenLegacyOwners.get(rel);if(expected){const actual=gitBlobSha(source);assert.equal(actual,expected,`${rel} contains legacy qB version branches and changed from frozen reviewed blob ${expected}; migrate/review those branches before updating the baseline.`);legacySeen.push(rel);continue;}violations.push(`${rel}: ${hits.map(hit=>`${hit.kind}=${JSON.stringify(hit.text)}`).join('; ')}`);}
assert.equal(violations.length,0,`Scattered qB version-if detected outside centralized/frozen owners:\n${violations.join('\n')}`);
console.log(`Compatibility architecture contract passed: scanned ${files.length} complete product script files; scattered qB version-if is blocked, centralized ReleaseProfile remains allowed, and ${legacySeen.length} legacy owner blob(s) are frozen for explicit migration/review.`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readmePath} from '../tools/readme-language-navigation.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-5.2.4-readme-languages.json'),'utf8'));
const canonical=fs.readFileSync(path.join(root,'translations/README.zh-CN.md'),'utf8');
function executableExamples(markdown){
  const counts=new Map();
  for(const match of markdown.matchAll(/```(sh|powershell|yaml)\n([\s\S]*?)\n```/g)){
    const key=match[1]+'\n'+match[2];
    counts.set(key,(counts.get(key)||0)+1);
  }
  return [...counts].sort(([a],[b])=>a.localeCompare(b));
}
const baseline=executableExamples(canonical);
assert.equal(baseline.reduce((sum,[,n])=>sum+n,0),24,'Canonical Chinese installer-example inventory changed');
let pages=0;
for(const lang of inventory.languages){
  const target=path.join(root,readmePath(lang));
  assert.ok(fs.existsSync(target), 'Missing completed official README: '+target);
  const text=fs.readFileSync(target,'utf8');
  assert.deepEqual(executableExamples(text),baseline,
    'Installer command, Docker mapping or PowerShell example changed in '+lang.code+'; localize prose, never CLI bytes');
  pages++;
}
assert.equal(pages,61,'All 61 official language READMEs must preserve executable examples');
console.log('README executable provenance passed for '+pages+' official languages: 24 canonical sh/PowerShell/YAML examples each.');

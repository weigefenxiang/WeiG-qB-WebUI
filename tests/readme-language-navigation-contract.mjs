import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readmePath,renderNavigation,updateAll} from '../tools/readme-language-navigation.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inventory=JSON.parse(fs.readFileSync(path.join(base,'tools/data/qb-5.2.4-readme-languages.json'),'utf8'));
assert.equal(inventory.languages.length,61);
assert.equal(inventory.languages.filter(lang=>lang.primary).length,10);
assert.equal(new Set(inventory.languages.map(readmePath)).size,61);
assert.equal(updateAll(false),0,'generated multilingual navigation has drifted');
for(const lang of inventory.languages){
  const markup=renderNavigation(lang);
  assert.equal((markup.match(/<a href=/g)||[]).length,51);
  assert.equal((markup.match(/&lrm;·&lrm;/g)||[]).length,50);
  assert.equal((markup.match(/&#x2067;/g)||[]).length,3);
  assert.equal((markup.match(/&#x2069;/g)||[]).length,3);
  assert.match(markup,/<div dir="ltr">/);
  const target=readmePath(lang);
  assert.ok(target==='README.md'||target.startsWith('translations/README.'));
  if(lang.primary)assert.ok(fs.existsSync(path.join(base,target)));
}
console.log('Official qB 5.2.4 README locale navigation passed: 61 official variants, 10 primary, 51 complete links and RTL isolates.');

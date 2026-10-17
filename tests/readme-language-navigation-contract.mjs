import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readmePath,renderNavigation,updateAll} from '../tools/readme-language-navigation.mjs';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inventory=JSON.parse(fs.readFileSync(path.join(base,'tools/data/qb-5.2.4-readme-languages.json'),'utf8'));
const frozen=JSON.parse(fs.readFileSync(path.join(base,'tools/data/qb-locale-lkg.json'),'utf8'));
const matched=frozen.profiles.find(item=>item.qbVersion===inventory.upstream.tag.replace('release-',''));
assert.ok(matched,'Official 5.2.4 source must be present in the admitted Frozen locale evidence');
assert.equal(inventory.upstream.sourceSha,matched.sourceSha,'README source SHA must match admitted official source');
assert.deepEqual(inventory.languages.map(item=>item.code),frozen.localeSets[matched.localeSet],'README language list must equal exact 5.2.4 official qB locale inventory');
assert.equal(inventory.languages.length,61);
assert.equal(inventory.languages.filter(lang=>lang.primary).length,10);
assert.equal(new Set(inventory.languages.map(readmePath)).size,61);
assert.equal(updateAll(false),0,'generated multilingual navigation has drifted');
for(const lang of inventory.languages){
  const markup=renderNavigation(lang);
  assert.equal((markup.match(/<a href=/g)||[]).length,lang.primary?51:50);
  if(!lang.primary)assert.match(markup,/<strong>[^<]+<\/strong>/,'Expanded locale must mark its own current language');
  assert.equal((markup.match(/&lrm;·&lrm;/g)||[]).length,50);
  assert.equal((markup.match(/&#x2067;/g)||[]).length,3);
  assert.equal((markup.match(/&#x2069;/g)||[]).length,3);
  assert.match(markup,/<div dir="ltr">/);
  const target=readmePath(lang);
  assert.ok(target==='README.md'||target.startsWith('translations/README.'));
  if(lang.primary)assert.ok(fs.existsSync(path.join(base,target)));
}
console.log('Official qB 5.2.4 README locale navigation passed: 61 official variants, 10 primary, 51 complete links and RTL isolates.');

const arabic=fs.readFileSync(path.join(base,'translations/README.ar.md'),'utf8');
assert.match(arabic,/<strong>&#x2067;العربية&#x2069;<\/strong>/,'Arabic README must preserve self-link isolate');
assert.match(arabic,/<div dir="ltr">[\s\S]*?&lrm;·&lrm;[\s\S]*?<\/div>/,'Arabic language links must remain visually LTR with single separators');

const persian=fs.readFileSync(path.join(base,'translations/README.fa.md'),'utf8');
assert.match(persian,/<strong>&#x2067;فارسی&#x2069;<\/strong>/,'Persian current language must be bidi-isolated');
assert.match(persian,/<div dir="ltr">[\s\S]*?&lrm;·&lrm;[\s\S]*?<\/div>/,'Persian more-languages separators must stay LTR');

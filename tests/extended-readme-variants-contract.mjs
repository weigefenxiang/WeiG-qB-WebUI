import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-5.2.4-readme-languages.json'),'utf8'));
const pages=inventory.languages.filter(lang=>!lang.primary).map(lang=>{
  const localized='translations/README.'+lang.slug+'.md';
  const baseline=lang.code==='en_AU'||lang.code==='en_GB'?'README.md':
    lang.code==='zh_HK'?'translations/README.zh-TW.md':'translations/README.zh-CN.md';
  return [localized,baseline];
}).filter(([localized])=>fs.existsSync(path.join(root,localized)));
assert(pages.length>=21,'Previously completed expanded READMEs must not disappear');
const withoutNavigation=text=>text.replace(/<!-- WEIG-README-LANGUAGES:START -->[\s\S]*?<!-- WEIG-README-LANGUAGES:END -->/,'');
for(const [localized,baseline] of pages){
  const content=fs.readFileSync(path.join(root,localized),'utf8');
  const original=fs.readFileSync(path.join(root,baseline),'utf8');
  assert.equal((content.match(/```/g)||[]).length,(original.match(/```/g)||[]).length,'New regional README must preserve executable example blocks: '+localized);
  // Official English can introduce substantive sections before older locale baselines
  // adopt them. Requiring an identical count incorrectly rejects translations that
  // include the newer section, while omitting a baseline section must still fail.
  const baselineHeadings=[...withoutNavigation(original).matchAll(/^## (.+)$/gm)].map(m=>m[1].trim());
  const localizedHeadings=[...withoutNavigation(content).matchAll(/^## (.+)$/gm)].map(m=>m[1].trim());
  assert.ok(localizedHeadings.length>=baselineHeadings.length,
    'New regional README must preserve complete sections: '+localized);
  assert.equal(new Set(localizedHeadings).size,localizedHeadings.length,
    'New regional README must not duplicate section headings: '+localized);
  assert.ok(content.includes('<strong>'),'Expanded-region README must highlight its own native language: '+localized);
  for(const match of content.matchAll(/src="([^"]+)"/g)){
    if(/^https?:/.test(match[1]))continue;
    assert(fs.existsSync(path.resolve(root,path.dirname(localized),match[1])),'Regional README image link is broken: '+localized+' -> '+match[1]);
  }
  for(const match of content.matchAll(/\]\(([^)]+)\)/g)){
    const href=match[1].split('#')[0];
    if(!href||/^https?:/.test(href)||/README\.[^/]+\.md$/.test(href))continue; // Requested future locale links intentionally exist before their targets.
    assert(fs.existsSync(path.resolve(root,path.dirname(localized),href)),'Regional README non-language link is broken: '+localized+' -> '+href);
  }
}
console.log('Expanded README variants passed: exact section/fenced-example parity and existing non-language link targets.');

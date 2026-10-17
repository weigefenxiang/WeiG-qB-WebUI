import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pages=[
  ['translations/README.en-AU.md','README.md'],
  ['translations/README.en-GB.md','README.md'],
  ['translations/README.zh-HK.md','translations/README.zh-TW.md'],
  ['translations/README.pt-BR.md','translations/README.zh-CN.md'],
  ['translations/README.it.md','translations/README.zh-CN.md'],
  ['translations/README.ca.md','translations/README.zh-CN.md'],
  ['translations/README.nl.md','translations/README.zh-CN.md'],
  ['translations/README.ar.md','translations/README.zh-CN.md'],
  ['translations/README.vi.md','translations/README.zh-CN.md'],
  ['translations/README.id.md','translations/README.zh-CN.md'],
  ['translations/README.tr.md','translations/README.zh-CN.md'],
  ['translations/README.uk.md','translations/README.zh-CN.md'],
  ['translations/README.sv.md','translations/README.zh-CN.md'],
  ['translations/README.nb.md','translations/README.zh-CN.md'],
  ['translations/README.da.md','translations/README.zh-CN.md'],
  ['translations/README.fi.md','translations/README.zh-CN.md']
];
const withoutNavigation=text=>text.replace(/<!-- WEIG-README-LANGUAGES:START -->[\s\S]*?<!-- WEIG-README-LANGUAGES:END -->/,'');
for(const [localized,baseline] of pages){
  const content=fs.readFileSync(path.join(root,localized),'utf8');
  const original=fs.readFileSync(path.join(root,baseline),'utf8');
  assert.equal((content.match(/```/g)||[]).length,(original.match(/```/g)||[]).length,'New regional README must preserve executable example blocks: '+localized);
  assert.equal((withoutNavigation(content).match(/^## /gm)||[]).length,(withoutNavigation(original).match(/^## /gm)||[]).length,'New regional README must preserve complete sections: '+localized);
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

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exists=rel=>fs.existsSync(path.join(root,rel));
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const requiredRoot=['README.md','ARCHITECTURE.md','CONTRIBUTING.md','DESIGN.md'];
for(const rel of requiredRoot)assert.ok(exists(rel),`missing public document: ${rel}`);

const requiredSubsystem=[
  'webui/ARCHITECTURE.md',
  'simulator/ARCHITECTURE.md',
  'tests/README.md',
  'tools/README.md',
  'installers/README.md'
];
for(const rel of requiredSubsystem)assert.ok(exists(rel),`missing subsystem documentation: ${rel}`);

const docsDir=path.join(root,'docs');
const expected=['COMPATIBILITY.md','DEVELOPMENT.md','RELEASE.md','WEBAPI-EVOLUTION.md'];
const actual=fs.readdirSync(docsDir).filter(name=>name.endsWith('.md')).sort();
assert.deepEqual(actual,expected,'docs/ must contain only the current long-lived English developer documents');

const englishDeveloperDocs=['ARCHITECTURE.md','CONTRIBUTING.md','DESIGN.md',...requiredSubsystem,...expected.map(name=>`docs/${name}`)];
const cjk=/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
for(const rel of englishDeveloperDocs)assert.equal(cjk.test(read(rel)),false,`${rel} must remain English-only developer documentation`);

const translated=[
  'translations/README.de.md','translations/README.es.md','translations/README.fr.md','translations/README.ja.md',
  'translations/README.ko.md','translations/README.pt.md','translations/README.ru.md','translations/README.zh-CN.md','translations/README.zh-TW.md',
  'translations/installation-guide/deployment-guide.de.md','translations/installation-guide/deployment-guide.en.md',
  'translations/installation-guide/deployment-guide.es.md','translations/installation-guide/deployment-guide.fr.md',
  'translations/installation-guide/deployment-guide.ja.md','translations/installation-guide/deployment-guide.ko.md',
  'translations/installation-guide/deployment-guide.pt.md','translations/installation-guide/deployment-guide.ru.md',
  'translations/installation-guide/deployment-guide.zh-CN.md','translations/installation-guide/deployment-guide.zh-TW.md'
];
assert.equal(translated.length,19);
for(const rel of translated)assert.ok(exists(rel),`missing user-facing translated documentation: ${rel}`);
assert.equal(fs.readdirSync(path.join(root,'translations')).filter(name=>name.endsWith('.md')).length,9,'translations/ root must contain the nine README translations');
assert.equal(fs.readdirSync(path.join(root,'translations/installation-guide')).filter(name=>name.endsWith('.md')).length,10,'installation-guide must contain ten localized deployment guides');

const readme=read('README.md');
for(const rel of translated.slice(0,9))assert.ok(readme.includes(rel),`README language navigation must link ${rel}`);
assert.ok(exists('webui/translations'),'runtime qB translation assets must remain under webui/translations');
assert.ok(read('ARCHITECTURE.md').includes('webui/ARCHITECTURE.md')&&read('ARCHITECTURE.md').includes('simulator/ARCHITECTURE.md'),'root architecture must link to subsystem architecture');

console.log('Documentation authority contract passed: developer/architecture docs remain English-only while README.md + translations/** own multilingual user documentation independently from runtime webui/translations.');

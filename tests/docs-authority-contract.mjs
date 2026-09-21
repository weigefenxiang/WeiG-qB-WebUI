import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exists=rel=>fs.existsSync(path.join(root,rel));
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const requiredRoot=['README.md','ARCHITECTURE.md','CONTRIBUTING.md','DESIGN.md'];
for(const rel of requiredRoot)assert.ok(exists(rel),`missing public developer document: ${rel}`);

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

const publicDocs=[...requiredRoot,...requiredSubsystem,...expected.map(name=>`docs/${name}`)];
const cjk=/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;
for(const rel of publicDocs)assert.equal(cjk.test(read(rel)),false,`${rel} must remain English-only public documentation`);

assert.equal(exists('translations'),false,'repository-level translated documentation must not return');
assert.ok(exists('webui/translations'),'runtime qB translation assets must remain under webui/translations');
assert.ok(read('ARCHITECTURE.md').includes('webui/ARCHITECTURE.md')&&read('ARCHITECTURE.md').includes('simulator/ARCHITECTURE.md'),'root architecture must link to subsystem architecture');
assert.ok(read('README.md').includes('Developer Documentation'),'README must expose the developer documentation entry points');

console.log('Documentation authority contract passed: public docs are English-only, long-lived, subsystem-oriented and separate from runtime translation assets.');

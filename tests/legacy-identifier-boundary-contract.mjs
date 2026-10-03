import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exts=new Set(['.md','.mjs','.js','.json','.yml','.yaml','.sh','.ps1']);
const ignored=new Set(['.git','node_modules','release']);
const allowed=new Set([
  'installers/install.sh',
  'installers/install.ps1',
  '.github/workflows/release.yml',
  'tests/installer-lifecycle.sh',
  'tests/install-path-migration-contract.mjs',
  'tests/installer-state-namespace-contract.mjs',
  'tests/distribution-artifact-set-contract.mjs',
  'tests/windows-distribution-artifact-contract.mjs',
  'tests/release-publish-contract.mjs',
  'tests/release-compat-evidence-contract.mjs',
  'tests/platform-contract.mjs',
  'tests/legacy-identifier-boundary-contract.mjs'
]);

const patterns=[
  /weig_qb-webui/i,
  /WeiG-qB-WebUI\.zip/,
  /weig_qb-webui_install\.(?:sh|ps1)/i,
  /weig-install\.(?:sh|ps1)/i
];
const violations=[];
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.isDirectory()&&ignored.has(ent.name))continue;
    const abs=path.join(dir,ent.name);
    if(ent.isDirectory()){walk(abs);continue}
    if(!exts.has(path.extname(ent.name).toLowerCase()))continue;
    const rel=path.relative(root,abs).replaceAll('\\','/');
    if(allowed.has(rel))continue;
    const source=fs.readFileSync(abs,'utf8');
    if(patterns.some(re=>re.test(source)))violations.push(rel);
  }
}
walk(root);
assert.deepEqual(violations,[],`Legacy machine identifiers escaped their bounded migration/history owners:\n${violations.join('\n')}`);
console.log('Legacy identifier boundary contract passed.');

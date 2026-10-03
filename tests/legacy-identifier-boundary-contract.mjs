import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exts=new Set(['.md','.mjs','.js','.json','.yml','.yaml','.sh','.ps1']);
const ignored=new Set(['.git','node_modules','release']);

const guardOwners=new Set([
  'tests/legacy-identifier-boundary-contract.mjs',
  'tests/deployment-naming-contract.mjs',
  'tests/ci-contract.mjs',
  'tests/windows-distribution-artifact-contract.mjs'
]);

const migrationOrHistoryOwners=new Set([
  'installers/install.sh',
  'installers/install.ps1',
  '.github/workflows/release.yml',
  'tests/installer-lifecycle.sh',
  'tests/installer-lifecycle.ps1',
  'tests/installer-docker-lifecycle.sh',
  'tests/install-path-migration-contract.mjs',
  'tests/installer-state-namespace-contract.mjs',
  'tests/distribution-artifact-set-contract.mjs',
  'tests/release-publish-contract.mjs',
  'tests/platform-contract.mjs',
  'tests/installer-single-owner-contract.mjs'
]);

const allowed=new Set([...guardOwners,...migrationOrHistoryOwners]);
const patterns=[
  /weig_qb-webui/i,
  /WeiG-qB-WebUI\.zip/,
  /weig_qb-webui_install\.(?:sh|ps1)/i,
  /weig-install\.(?:sh|ps1)/i
];

assert.ok([...guardOwners].every(rel=>rel.startsWith('tests/')),'Legacy identifier guard exemptions must stay test-only.');
assert.ok([...allowed].every(rel=>!rel.startsWith('webui/')),'Formal WebUI runtime must never be exempted from legacy machine-identifier retirement.');

const violations=[];
const matchingFiles=new Set();
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(ent.isDirectory()&&ignored.has(ent.name))continue;
    const abs=path.join(dir,ent.name);
    if(ent.isDirectory()){walk(abs);continue}
    if(!exts.has(path.extname(ent.name).toLowerCase()))continue;
    const rel=path.relative(root,abs).replaceAll('\\','/');
    const source=fs.readFileSync(abs,'utf8');
    if(!patterns.some(re=>re.test(source)))continue;
    matchingFiles.add(rel);
    if(!allowed.has(rel))violations.push(rel);
  }
}
walk(root);

assert.deepEqual(violations,[],`Legacy machine identifiers escaped explicit guard/migration/history owners:\n${violations.join('\n')}`);
for(const rel of allowed){
  assert.ok(matchingFiles.has(rel),`${rel}: stale legacy identifier allowance; remove it from the boundary owner set`);
}

console.log(`Legacy identifier boundary contract passed: ${guardOwners.size} guard owners + ${migrationOrHistoryOwners.size} bounded migration/history owners; no formal WebUI runtime exemptions.`);

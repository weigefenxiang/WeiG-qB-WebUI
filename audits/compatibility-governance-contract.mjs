import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8').replace(/\r\n?/g,'\n');
const exists=rel=>fs.existsSync(path.join(root,rel));
const readGitBlob=rel=>execFileSync('git',['-C',root,'show',`HEAD:${rel}`],{stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024});
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const retiredWorkflows=[
  '.github/workflows/stable-watch.yml',
  '.github/workflows/frozen-stable-compat.yml',
  '.github/workflows/upstream-compat.yml',
  '.github/workflows/real-qb.yml',
  '.github/workflows/real-qb-source-build-probe.yml',
  '.github/workflows/install-lifecycle.yml'
];
for(const rel of retiredWorkflows)assert(!exists(rel),`${rel} is retired and must not return as an active workflow`);

const pkg=JSON.parse(read('package.json'));
const manifest=JSON.parse(read('tools/data/qb-stable-lkg.json'));
const catalogPath=path.join(root,manifest.catalogPath);
const gfm=read('.github/workflows/real-qb-full.yml');
const locale=read('.github/workflows/real-qb-locale.yml');
const promote=read('.github/workflows/promote.yml');

assert(pkg.scripts.test==='npm run test:core','ordinary npm test must stay on the bounded Core owner');
for(const owner of ['audits/compat-architecture-contract.mjs','audits/compatibility-governance-contract.mjs','audits/qb-stable-admission-contract.mjs','audits/qb-product-capability-diff-contract.mjs','audits/real-qb-full-matrix-contract.mjs']){
  assert(String(pkg.scripts['test:compat']||'').includes(owner),`Compatibility Audit entry point missing ${owner}`);
}

for(const [name,workflow] of [['Full Frozen',gfm],['Locale',locale]]){
  assert(workflow.includes('workflow_dispatch:'),`${name} Compatibility Audit must remain manually runnable`);
  assert(!/\n\s*push:\s*/.test(workflow),`${name} Compatibility Audit must not run on ordinary pushes`);
  assert(workflow.startsWith('name: Compatibility Audit'),`${name} workflow must remain visibly labeled as a Compatibility Audit`);
}
assert(gfm.includes('real-qb-full-aggregate-${{ github.sha }}'),'Full Frozen audit must retain exact-SHA aggregate evidence');
assert(locale.includes('real-qb-current-locale-aggregate-${{ github.sha }}'),'Locale audit must retain exact-SHA aggregate evidence');

for(const retired of ['real-qb-full.yml','real-qb-locale.yml','compat_evidence_sha','release-compat-evidence.mjs','real-qb-full-aggregate-','real-qb-current-locale-aggregate-']){
  assert(!promote.includes(retired),`Promotion must not depend on Compatibility Audit owner ${retired}`);
}
assert(promote.includes("workflow_id: 'ci.yml'")&&promote.includes('release-candidate-${sha}'),'Promotion must require exact-SHA Candidate CI artifact evidence');
assert(promote.includes("workflow_id: 'candidate-deployment-only.yml'")&&promote.includes('candidate-deployment-${sha}'),'Promotion must require exact-SHA Candidate Deployment evidence');
assert(promote.includes('devSha !== sha')&&promote.includes('compare.data.behind_by !== 0'),'Promotion must fresh-check current dev identity and safe fast-forward ancestry');
assert(promote.includes('Compatibility Audits are independent and are not Promotion prerequisites.'),'Promotion summary must state the independent Compatibility Audit boundary');

assert(manifest.schemaVersion===1&&manifest.supportFloor==='4.1.0','LKG manifest schema/floor drifted');
assert(fs.existsSync(catalogPath),'committed single-file LKG catalog is missing');
const catalogBlob=readGitBlob(manifest.catalogPath);
const digest=crypto.createHash('sha256').update(catalogBlob).digest('hex');
assert(digest===manifest.catalogSha256,`committed LKG SHA-256 mismatch: ${digest} vs ${manifest.catalogSha256}`);
const catalog=JSON.parse(catalogBlob.toString('utf8'));
assert(catalog.length===manifest.profileCount&&catalog.at(-1)?.qbVersion===manifest.latestAdmittedStable,'LKG manifest does not describe committed catalog exactly');

const catalogTool=read('tools/qb-release-catalog.mjs');
assert(catalogTool.includes('--base-catalog=')&&catalogTool.includes('Incremental extraction must not re-parse frozen stable tag')&&catalogTool.includes('Incremental annotation mutated frozen LKG profile'),'catalog generator must protect frozen history during incremental admission');
const productDiff=read('tools/qb-product-capability-diff.mjs');
for(const owner of ['capabilities.js','torrent-semantics.js','torrent-fields.js'])assert(productDiff.includes(`'${owner}'`),`product capability diff must execute compact formal owner ${owner}`);
assert(!productDiff.includes("'release-profile.js'"),'product capability diff must not execute retired ReleaseProfile runtime owner');

console.log(`Compatibility governance contract passed: Frozen LKG ${catalog.length} profiles ${catalog[0].qbVersion} -> ${catalog.at(-1)?.qbVersion} stays hash-bound; Full Frozen/Locale remain explicit manual audits, while Promotion is Candidate + Deployment + current-dev/safe-FF only.`);

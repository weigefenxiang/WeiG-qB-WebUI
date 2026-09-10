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
const promote=read('.github/workflows/promote.yml');

assert(gfm.includes('workflow_dispatch:'),'full real matrix must remain manually runnable');
assert(!/\n\s*push:\s*\n/.test(gfm),'full real matrix must not run automatically on ordinary pushes');
assert(/max-parallel:\s*16/.test(gfm),'full real matrix must keep the 16-way concurrency cap');
assert(gfm.includes('real-qb-full-aggregate-${{ github.sha }}'),'full real matrix must publish exact-SHA aggregate evidence');
assert(promote.includes("workflow_id: 'real-qb-full.yml'"),'promotion must require the full real matrix workflow');
assert(promote.includes("run.event === 'workflow_dispatch'"),'promotion must require a manually dispatched full real matrix run');
assert(promote.includes('real-qb-full-aggregate-${sha}'),'promotion must resolve exact-SHA G-FM aggregate evidence');
assert(promote.includes('expected_stable_count !== 65')&&promote.includes('executed_runtime_count !== 65'),'promotion must require an exact 65-version matrix');
assert(promote.includes('evidence.PASS !== 65')&&promote.includes('evidence.FAIL !== 0')&&promote.includes('evidence.BLOCKED !== 0'),'promotion must fail closed unless G-FM is 65/65 PASS');
assert(promote.includes('result.qb_version !== result.runtime_version'),'promotion must reject inexact qB runtime identity');

assert(manifest.schemaVersion===1&&manifest.supportFloor==='4.1.0','LKG manifest schema/floor drifted');
assert(fs.existsSync(catalogPath),'committed single-file LKG catalog is missing');
const catalogBlob=readGitBlob(manifest.catalogPath);
const digest=crypto.createHash('sha256').update(catalogBlob).digest('hex');
assert(digest===manifest.catalogSha256,`committed LKG SHA-256 mismatch: ${digest} vs ${manifest.catalogSha256}`);
const catalog=JSON.parse(catalogBlob.toString('utf8'));
assert(catalog.length===manifest.profileCount&&catalog.at(-1)?.qbVersion===manifest.latestAdmittedStable,'LKG manifest does not describe committed catalog exactly');

for(const test of ['tests/compat-architecture-contract.mjs','tests/qb-stable-admission-contract.mjs','tests/qb-product-capability-diff-contract.mjs','tests/phase-d-automation-contract.mjs'])assert(pkg.scripts.test.includes(test),`npm test must include compatibility governance guard ${test}`);
const catalogTool=read('tools/qb-release-catalog.mjs');
assert(catalogTool.includes('--base-catalog=')&&catalogTool.includes('Incremental extraction must not re-parse frozen stable tag')&&catalogTool.includes('Incremental annotation mutated frozen LKG profile'),'catalog generator must protect source and byte-level frozen history during incremental admission');
const productDiff=read('tools/qb-product-capability-diff.mjs');
for(const owner of ['release-profile.js','capabilities.js','torrent-semantics.js'])assert(productDiff.includes(`'${owner}'`),`product capability diff must execute formal owner ${owner}`);

console.log(`Compatibility governance contract passed: retired legacy workflows stay removed; frozen LKG ${catalog.length} profiles ${catalog[0].qbVersion} -> ${catalog.at(-1).qbVersion} remains hash-bound; release promotion requires a manually dispatched exact-SHA 65/65 G-FM with 16-way matrix concurrency.`);

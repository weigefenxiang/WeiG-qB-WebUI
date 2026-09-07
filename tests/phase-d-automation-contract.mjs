import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8').replace(/\r\n?/g,'\n');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
const watch=read('.github/workflows/stable-watch.yml'),pkg=JSON.parse(read('package.json')),manifest=JSON.parse(read('tools/data/qb-stable-lkg.json')),catalogPath=path.join(root,manifest.catalogPath);

assert(/schedule:\s*\n\s*- cron:/m.test(watch)&&watch.includes('workflow_dispatch:'),'future stable watch must define scheduled + manual entry points');
assert(/push:\s*\n\s*branches:\s*\n\s*- dev\s*\n\s*paths:/m.test(watch),'future stable watch must be directly testable from dev by path-scoped push');
assert(/permissions:\s*\n\s*contents:\s*write/m.test(watch),'future stable admission needs narrowly scoped contents:write for LKG fast-forward only');
assert(watch.includes("ref: ${{ github.event_name == 'push' && github.sha || 'dev' }}")&&watch.includes('Capture exact dev source SHA'),'scheduled/manual runs must explicitly checkout dev and bind evidence to the actual dev SHA rather than default-branch context');
assert(watch.includes('qb-stable-admission.mjs verify')&&watch.includes('qb-stable-admission.mjs discover upstream-qb'),'stable watch must verify LKG before discovery');
assert(watch.includes('--base-catalog=tests/fixtures/qb-release-catalog.lkg.json'),'new stable extraction must append onto frozen catalog instead of re-parsing old profiles');
assert(watch.includes('upstream-release-audit.mjs upstream-qb --refs=${{ steps.discover.outputs.audit_refs }}'),'new stable source audit must be scoped to the support floor plus newly discovered refs');
assert(watch.includes('full-stable-product-compat.mjs "$RUNNER_TEMP/qb-release-catalog.candidate.json"'),'candidate must pass the full formal product matrix before admission');
assert(watch.includes('qb-stable-admission.mjs report')&&watch.includes('qb-product-capability-diff.mjs'),'admission evidence must include upstream added/removed facts and formal product capability diff');
assert(watch.includes('WEIGG_VALIDATION_SHA: ${{ steps.source.outputs.sha }}'),'LKG admission manifest must record the exact dev SHA actually validated by scheduled/manual runs');
assert(watch.indexOf('Full PRODUCT compatibility matrix')<watch.indexOf('Prepare next LKG manifest'),'LKG manifest must not be prepared before product compatibility passes');
assert(watch.indexOf('Repository contracts and architecture guard before admission')<watch.indexOf('Safe fast-forward admission to dev'),'repository contracts must pass before any LKG write');
assert(watch.includes('git fetch origin dev')&&watch.includes('git rev-parse origin/dev')&&watch.includes('${{ steps.source.outputs.sha }}'),'stable admission must fresh-check exact dev immediately before write');
assert(watch.includes('git add tests/fixtures/qb-release-catalog.lkg.json tools/data/qb-stable-lkg.json'),'stable admission write set must be limited to catalog + manifest');
assert(watch.includes('git push origin HEAD:dev')&&!/git\s+push[^\n]*--force/.test(watch),'stable admission must use a normal fast-forward push and never force');
assert(watch.includes("has_new != 'true'")&&watch.includes('no source history was re-parsed'),'no-new-stable path must run frozen regression without old upstream source extraction');

assert(manifest.schemaVersion===1&&manifest.supportFloor==='4.1.0','LKG manifest schema/floor drifted');
assert(fs.existsSync(catalogPath),'committed single-file LKG catalog is missing');
const digest=crypto.createHash('sha256').update(fs.readFileSync(catalogPath)).digest('hex');assert(digest===manifest.catalogSha256,`committed LKG SHA-256 mismatch: ${digest} vs ${manifest.catalogSha256}`);
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));assert(catalog.length===manifest.profileCount&&catalog.at(-1)?.qbVersion===manifest.latestAdmittedStable,'LKG manifest does not describe committed catalog exactly');

for(const test of ['tests/compat-architecture-contract.mjs','tests/qb-stable-admission-contract.mjs','tests/qb-product-capability-diff-contract.mjs','tests/phase-d-automation-contract.mjs'])assert(pkg.scripts.test.includes(test),`npm test must include Phase D guard ${test}`);
const catalogTool=read('tools/qb-release-catalog.mjs');assert(catalogTool.includes('--base-catalog=')&&catalogTool.includes('Incremental extraction must not re-parse frozen stable tag')&&catalogTool.includes('Incremental annotation mutated frozen LKG profile'),'catalog generator must protect source and byte-level frozen history during incremental admission');
const productDiff=read('tools/qb-product-capability-diff.mjs');for(const owner of ['release-profile.js','capabilities.js','torrent-semantics.js'])assert(productDiff.includes(`'${owner}'`),`product capability diff must execute formal owner ${owner}`);

console.log(`Phase D automation contract passed: frozen LKG ${catalog.length} profiles ${catalog[0].qbVersion} -> ${catalog.at(-1).qbVersion} is hash-bound; future stable discovery is incremental, diff-producing, fail-closed, and safe-fast-forward only.`);

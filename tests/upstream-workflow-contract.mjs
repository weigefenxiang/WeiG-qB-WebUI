import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8').replace(/\r\n?/g,'\n');
const exists=rel=>fs.existsSync(path.join(root,rel));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

for(const rel of [
  '.github/workflows/upstream-compat.yml',
  '.github/workflows/frozen-stable-compat.yml',
  '.github/workflows/stable-watch.yml',
  '.github/workflows/real-qb.yml',
  '.github/workflows/real-qb-source-build-probe.yml'
])assert(!exists(rel),`${rel} is obsolete and must stay retired`);

const ci=read('.github/workflows/ci.yml');
const gfm=read('.github/workflows/real-qb-full.yml');
const promote=read('.github/workflows/promote.yml');
const release=read('.github/workflows/release.yml');
const compatVerifier=read('tests/release-compat-evidence.mjs');

assert(ci.includes('qb-release-catalog.mjs upstream-qb --output=qb-releases.json'),'candidate CI must regenerate exact supported stable source facts');
assert(ci.includes('tests/upstream-release-audit.mjs upstream-qb'),'candidate CI must audit every supported stable upstream release');
assert(ci.includes('tests/full-stable-product-compat.mjs qb-releases.json'),'candidate CI must execute formal product compatibility across the generated stable catalog');
assert(ci.includes('name: qb-release-catalog-${{ github.sha }}'),'candidate CI must publish an exact-SHA stable catalog artifact');

assert(gfm.includes('workflow_dispatch:'),'real qB Full Frozen Matrix must remain manually runnable for release-grade Exhaustive evidence');
assert(!/\n\s*push:\s*/.test(gfm),'G-FM must not start 65 real runtimes on ordinary dev pushes');
assert(/max-parallel:\s*16/.test(gfm),'real qB Full Frozen Matrix must keep max-parallel 16 for intentional final validation');
assert(gfm.includes('Resolve Exhaustive mode and all Frozen stable versions')&&gfm.includes('= "65"'),'G-FM final plan must resolve exactly 65 Frozen stable runtimes');
assert(gfm.includes('mode=exhaustive')&&gfm.includes('real-qb-capability-plan.mjs --matrix "$mode"'),'G-FM final-only route must use planner-owned Exhaustive assignments');
assert(gfm.includes('Run isolated exact-version real qB evidence'),'G-FM must execute real exact-version qB evidence');
assert(!gfm.includes('real-qb-fast-aggregate-${{ github.sha }}'),'Fast 65-version evidence must not be part of ordinary development automation');
assert(gfm.includes('Require Exhaustive complete 65/65 Frozen real-qB evidence')&&gfm.includes('real-qb-full-aggregate-${{ github.sha }}'),'manual Exhaustive G-FM must preserve strict 65/65 aggregate evidence');

assert(promote.includes("resolveManualAggregate('real-qb-full.yml', gfmArtifactName")&&promote.includes('workflow_id: workflowId')&&promote.includes("run.event === 'workflow_dispatch'"),'promotion must require the manually dispatched exact-SHA Exhaustive G-FM through the shared resolver');
assert(promote.includes('real-qb-full-aggregate-${sha}')&&promote.includes('node tests/release-compat-evidence.mjs'),'promotion must require and centrally revalidate exact-SHA Exhaustive G-FM aggregate evidence');
assert(!promote.includes('real-qb-fast-aggregate-${sha}'),'promotion must never substitute Fast G-FM evidence for Exhaustive evidence');
assert(compatVerifier.includes('gfm.expected_stable_count!==65||gfm.executed_runtime_count!==65')&&compatVerifier.includes('gfm.PASS!==65||gfm.FAIL!==0||gfm.BLOCKED!==0'),'central release compatibility verifier must enforce Exhaustive 65/65 G-FM');
assert(!release.includes("workflow_id: 'upstream-compat.yml'"),'Release must not depend on the retired upstream compatibility workflow');
assert(!release.includes("workflow_id: 'frozen-stable-compat.yml'"),'Release must not depend on the retired frozen compatibility workflow');
assert(release.includes("resolveManualAggregate('real-qb-full.yml', gfmArtifactName")&&release.includes('node tests/release-compat-evidence.mjs'),'Release must independently resolve and revalidate exact-SHA manual Full Frozen Matrix evidence');

console.log('Upstream validation workflow contract passed: ordinary dev pushes stay on lightweight CI; candidate CI owns source/product audit; promotion/release accept only centrally revalidated exact-SHA manually dispatched Exhaustive 65/65 evidence.');

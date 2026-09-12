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

assert(ci.includes('qb-release-catalog.mjs upstream-qb --output=qb-releases.json'),'candidate CI must regenerate exact supported stable source facts');
assert(ci.includes('tests/upstream-release-audit.mjs upstream-qb'),'candidate CI must audit every supported stable upstream release');
assert(ci.includes('tests/full-stable-product-compat.mjs qb-releases.json'),'candidate CI must execute formal product compatibility across the generated stable catalog');
assert(ci.includes('name: qb-release-catalog-${{ github.sha }}'),'candidate CI must publish an exact-SHA stable catalog artifact');

assert(gfm.includes('workflow_dispatch:'),'real qB Frozen Matrix must remain manually runnable for Exhaustive evidence');
assert(/\n\s*push:\s*\n\s*branches:\s*\n\s*- dev\s*\n/.test(gfm),'real qB Frozen Matrix must automatically run Fast mode on dev pushes');
assert(/max-parallel:\s*16/.test(gfm),'real qB Frozen Matrix must keep max-parallel 16');
assert(gfm.includes('Resolve G-FM mode and all Frozen stable versions')&&gfm.includes('= "65"'),'G-FM plan must resolve exactly 65 Frozen stable runtimes in both modes');
assert(gfm.includes('mode=fast')&&gfm.includes('mode=exhaustive')&&gfm.includes('real-qb-capability-plan.mjs --matrix "$mode"'),'G-FM must use one planner-owned Fast/Exhaustive execution path');
assert(gfm.includes('Run isolated exact-version real qB evidence'),'G-FM must execute real exact-version qB evidence');
assert(gfm.includes('Require Fast 65/65 runtime smoke plus family Full evidence')&&gfm.includes('real-qb-fast-aggregate-${{ github.sha }}'),'dev push Fast G-FM must require 65 real runtime smoke witnesses plus family Full evidence');
assert(gfm.includes('Require Exhaustive complete 65/65 Frozen real-qB evidence')&&gfm.includes('real-qb-full-aggregate-${{ github.sha }}'),'manual Exhaustive G-FM must preserve strict 65/65 aggregate evidence');

assert(promote.includes("workflow_id: 'real-qb-full.yml'")&&promote.includes("run.event === 'workflow_dispatch'"),'promotion must require the manually dispatched exact-SHA Exhaustive G-FM');
assert(promote.includes('real-qb-full-aggregate-${sha}'),'promotion must require exact-SHA Exhaustive G-FM aggregate evidence');
assert(!promote.includes('real-qb-fast-aggregate-${sha}'),'promotion must never substitute Fast G-FM evidence for Exhaustive evidence');
assert(!release.includes("workflow_id: 'upstream-compat.yml'"),'Release must not depend on the retired upstream compatibility workflow');
assert(!release.includes("workflow_id: 'frozen-stable-compat.yml'"),'Release must not depend on the retired frozen compatibility workflow');

console.log('Upstream validation workflow contract passed: obsolete split workflows stay retired; candidate CI owns source/product audit; one 16-way G-FM runs Fast on dev pushes and Exhaustive on manual dispatch; promotion accepts only exact-SHA Exhaustive aggregate evidence.');

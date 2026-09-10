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

assert(gfm.includes('workflow_dispatch:'),'full real qB matrix must remain manually runnable');
assert(!/\n\s*push:\s*\n/.test(gfm),'full real qB matrix must not run on ordinary pushes');
assert(/max-parallel:\s*16/.test(gfm),'full real qB matrix must keep max-parallel 16');
assert(gfm.includes('Resolve all Frozen stable versions')&&gfm.includes('= "65"'),'G-FM plan must resolve exactly 65 frozen stable versions');
assert(gfm.includes('Run isolated exact-version real qB evidence'),'G-FM must execute real exact-version qB evidence');
assert(gfm.includes('Require complete 65/65 Frozen real-qB evidence'),'G-FM aggregate must require complete 65/65 evidence');
assert(gfm.includes('real-qb-full-aggregate-${{ github.sha }}'),'G-FM must publish exact-SHA aggregate evidence');

assert(promote.includes("workflow_id: 'real-qb-full.yml'")&&promote.includes("run.event === 'workflow_dispatch'"),'promotion must require the manually dispatched exact-SHA G-FM');
assert(promote.includes('real-qb-full-aggregate-${sha}'),'promotion must require exact-SHA G-FM aggregate evidence');
assert(!release.includes("workflow_id: 'upstream-compat.yml'"),'Release must not depend on the retired upstream compatibility workflow');
assert(!release.includes("workflow_id: 'frozen-stable-compat.yml'"),'Release must not depend on the retired frozen compatibility workflow');

console.log('Upstream validation workflow contract passed: obsolete split workflows stay retired; candidate CI owns source/product audit, manual 16-way G-FM owns all 65 exact real runtimes, and promotion requires exact-SHA aggregate evidence before main can move.');

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
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
const compat=read('tests/release-compat-evidence.mjs');

assert(ci.includes('qb-release-catalog.mjs upstream-qb --output=qb-release-catalog-shard-${{ matrix.shard }}.json --shard-index=${{ matrix.shard }} --shard-count=15'),'settings-evidence CI must retain exact supported source extraction');
const evidenceLane=ci.slice(ci.indexOf('  release_catalog_extract:'),ci.indexOf('  settings_bundle_materialize:'));
assert(evidenceLane.includes("inputs.validation_mode == 'settings-evidence'")&&!evidenceLane.includes("inputs.validation_mode == 'candidate'"),'expensive upstream source/locale extraction must not run on every release candidate');
assert(!ci.includes('\n  release_upstream_audit:\n')&&!ci.includes('\n  release_product_matrix:\n')&&!ci.includes('\n  release_fixture:\n'),'slim candidate must not duplicate Frozen/product/upstream owners');
assert(ci.includes('node tests/full-stable-product-compat.mjs tests/fixtures/qb-release-catalog.lkg.json'),'cheap smoke must retain the frozen formal product compatibility contract');

assert(gfm.includes('workflow_dispatch:')&&!/\n\s*push:\s*/.test(gfm),'G-FM must remain manual release-grade evidence');
assert(/max-parallel:\s*16/.test(gfm)&&gfm.includes('= "65"')&&gfm.includes('real-qb-full-aggregate-${{ github.sha }}'),'G-FM must preserve exhaustive 65-version evidence and bounded concurrency');
assert(promote.includes('real-qb-full-aggregate-${compatSha}')&&promote.includes('node tests/release-compat-evidence.mjs')&&promote.includes('Compatibility evidence reuse refused'),'Promotion must centrally revalidate guarded Full Frozen/Locale evidence before main moves');
assert(compat.includes('gfm.expected_stable_count!==65||gfm.executed_runtime_count!==65')&&compat.includes('gfm.PASS!==65||gfm.FAIL!==0||gfm.BLOCKED!==0'),'central compatibility verifier must remain fail-closed at 65/65');

assert(release.includes("workflow_id:'promote.yml'")&&release.includes('release-certification-${sha}'),'Release must consume successful Promotion certification');
assert(!release.includes("workflow_id: 'real-qb-full.yml'")&&!release.includes('node tests/release-compat-evidence.mjs'),'Release must not repeat exhaustive evidence discovery/verification');

console.log('Upstream workflow contract passed: source extraction is settings-evidence maintenance, release candidates stay bounded, Full Frozen remains intentional 65/65 evidence, Promotion certifies it once, and Release consumes that certification.');

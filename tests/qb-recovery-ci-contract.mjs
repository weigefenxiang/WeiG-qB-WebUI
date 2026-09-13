import assert from 'node:assert/strict';
import fs from 'node:fs';
import './qb-settings-overlay-columns-contract.mjs';
import './pages-relevance-contract.mjs';

const ci=fs.readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8').replace(/\r\n?/g,'\n');
function job(name,next){
  const marker=`\n  ${name}:\n`,start=ci.indexOf(marker);
  assert.ok(start>=0,`Missing CI job ${name}`);
  const end=next?ci.indexOf(`\n  ${next}:\n`,start+marker.length):ci.length;
  assert.ok(end>start,`Unable to bound CI job ${name}`);
  return ci.slice(start,end);
}

const enrich=job('release_locale_enrich','release_catalog_merge');
const merge=job('release_catalog_merge','release_upstream_audit');
const lkg=job('release_lkg','release_product_matrix');
const candidate=job('release_candidate','candidate_deployment');

assert.ok(enrich.includes('Upload enriched shard and full-TS recovery evidence')&&enrich.includes('qb-releases-shard-${{ matrix.shard }}.recovery.json'),'candidate source fanout must preserve every full official-TS recovery sidecar');
assert.ok(merge.includes('test -s qb-releases.recovery.json')&&merge.includes('qb-releases.recovery.json'),'candidate shard merge must fail closed unless deterministic recovery evidence is merged and uploaded beside the catalog');
assert.ok(lkg.includes('qb-settings-translation-lkg.mjs qb-releases.json tests/fixtures/qb-release-catalog.lkg.json qb-settings-translation-lkg.json qb-releases.recovery.json'),'candidate LKG owner must freeze v2 from the exact merged recovery sidecar');
assert.ok(lkg.includes('--settings-lkg=qb-settings-translation-lkg.json'),'candidate LKG validation packer must consume the same certified Settings/source LKG v2');
assert.ok(candidate.includes('qb-settings-translation-lkg-${{ github.sha }}')&&candidate.includes('path: settings-lkg'),'release candidate must download the certified exact-SHA Settings/source LKG v2 artifact');
assert.ok(candidate.includes('--settings-lkg=settings-lkg/qb-settings-translation-lkg.json'),'release candidate packaging must materialize full native QM recovery from the certified LKG rather than rebuilding or embedding recovery bodies in runtime catalog data');

console.log('qB recovery CI contract passed: exact source shards preserve build-only recovery evidence through deterministic merge, LKG v2 certification and candidate QM packaging.');

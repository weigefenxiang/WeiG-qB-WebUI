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
const merge=job('release_catalog_merge','release_lkg');
const lkg=job('release_lkg','settings_bundle_materialize');
const candidate=job('release_candidate','native_surface_source_base');

assert.ok(enrich.includes('Upload enriched shard and full-TS recovery evidence')&&enrich.includes('qb-releases-shard-${{ matrix.shard }}.recovery.json'),'settings-evidence source fanout must preserve every full official-TS recovery sidecar');
assert.ok(merge.includes('test -s qb-releases.recovery.json')&&merge.includes('qb-releases.recovery.json'),'settings-evidence shard merge must fail closed unless deterministic recovery evidence is merged and uploaded beside the catalog');
assert.ok(lkg.includes('qb-settings-translation-lkg.mjs qb-releases.json tests/fixtures/qb-release-catalog.lkg.json qb-settings-translation-lkg.json qb-releases.recovery.json'),'settings-evidence LKG owner must freeze v2 from the exact merged recovery sidecar');
assert.ok(lkg.includes('--settings-lkg=qb-settings-translation-lkg.json'),'candidate LKG validation packer must consume the same certified Settings/source LKG v2');
assert.ok(candidate.includes('node tools/build-webui-dist.mjs')&&candidate.includes('--webui-root=webui')&&candidate.includes('--sha="$GITHUB_SHA"'),'release candidate must package the already-certified self-contained compact runtime through the canonical exact-SHA distribution builder');
assert.ok(!candidate.includes('qb-settings-translation-lkg-${{ github.sha }}')&&!candidate.includes('--settings-lkg=settings-lkg/qb-settings-translation-lkg.json')&&!candidate.includes('qb-webui-catalog.mjs'),'release candidate must not rematerialize build-only recovery/LKG evidence into the formal browser runtime');
assert.ok(candidate.includes('qb-settings-native.txt')&&candidate.includes('translations/webui_*.qm'),'release candidate must verify the compact qB-owned copy registry and referenced official QMs already present in the self-contained runtime');

console.log('qB recovery CI contract passed: exact source shards preserve build-only recovery evidence through deterministic merge and LKG v2 certification, while candidate packaging reuses the certified compact self-contained runtime without rematerializing recovery bodies.');

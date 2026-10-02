import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  artifactSourceSha,
  settingsEvidenceChangedPaths
} from '../tools/settings-evidence-compat.mjs';
import {isSettingsEvidencePolicyPath,isSettingsSourcePath} from '../tools/change-classifier.mjs';

const resolver=fs.readFileSync(new URL('../tools/qb-settings-translation-artifact.mjs',import.meta.url),'utf8');
const pagesSource=fs.readFileSync(new URL('../.github/workflows/pages-source.yml',import.meta.url),'utf8');

const sha='0123456789abcdef0123456789abcdef01234567';
assert.equal(artifactSourceSha('qb-settings-translation-lkg-'+sha,'qb-settings-translation-lkg-'),sha);
assert.equal(artifactSourceSha('qb-settings-translation-lkg-not-a-sha','qb-settings-translation-lkg-'),'');
assert.deepEqual(settingsEvidenceChangedPaths([
  'installers/install.sh',
  'webui/private/scripts/app.js',
  'tools/qb-settings-translation-lkg.mjs',
  'tools/qb-settings-translation-lkg.mjs',
  'tests/fixtures/qb-release-catalog.lkg.json'
]),['tests/fixtures/qb-release-catalog.lkg.json','tools/qb-settings-translation-lkg.mjs']);
for(const owner of [
  'tools/qb-settings-translation-lkg.mjs',
  'tools/qb-locale-source.mjs',
  'tools/data/qb-stable-lkg.json',
  'tests/fixtures/qb-release-catalog.lkg.json'
])assert.equal(isSettingsSourcePath(owner),true,`Settings evidence content identity must include ${owner}`);
for(const policy of [
  'tools/change-classifier.mjs',
  'tools/settings-evidence-compat.mjs',
  'tools/qb-settings-translation-artifact.mjs',
  'tests/settings-evidence-reuse-contract.mjs'
]){
  assert.equal(isSettingsEvidencePolicyPath(policy),true,`Settings evidence policy owner missing ${policy}`);
  assert.equal(isSettingsSourcePath(policy),false,`Policy-only change must not invalidate certified Settings source bytes: ${policy}`);
}
for(const unrelated of ['installers/install.sh','webui/private/scripts/app.js','tests/browser-feature-parity.mjs'])assert.equal(isSettingsSourcePath(unrelated),false,`Unrelated change must not invalidate Settings evidence: ${unrelated}`);
assert.deepEqual(settingsEvidenceChangedPaths([
  'tools/change-classifier.mjs',
  'tools/settings-evidence-compat.mjs',
  'tools/qb-settings-translation-artifact.mjs',
  'tools/qb-settings-translation-lkg.mjs'
]),['tools/qb-settings-translation-lkg.mjs'],'reuse-policy changes must not force qB source extraction while actual LKG generation changes still do');

assert.ok(resolver.includes("compatibleArtifactCandidates(artifacts,'qb-settings-translation-lkg-')"),'resolver must search certified ancestor artifacts after exact SHA');
assert.ok(resolver.includes('localSettingsEvidenceCompatibility({ancestorSha:artifactSha,currentSha:sourceSha,cwd:projectRoot})'),'resolver must prove repository-history equivalence before reuse');
assert.ok(resolver.includes("compatibility.reason==='settings-source-changed'"),'resolver must explain the exact Settings-source owner that invalidated reuse');
assert.ok(pagesSource.includes('Probe exact-dev-SHA Settings evidence')&&pagesSource.includes('fetch-depth: 0'),'Pages evidence probe must have full history for ancestor compatibility proof');

console.log('Settings evidence reuse contract passed: certified source bytes are invalidated only by real Settings evidence inputs; classifier/resolver/reuse-policy changes remain Pages/workflow policy without forcing 16-shard re-extraction.');

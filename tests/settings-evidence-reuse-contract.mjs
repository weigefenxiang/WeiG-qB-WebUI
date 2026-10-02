import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  artifactSourceSha,
  settingsEvidenceChangedPaths
} from '../tools/settings-evidence-compat.mjs';
import {isSettingsSourcePath} from '../tools/change-classifier.mjs';

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
  'tools/change-classifier.mjs',
  'tools/settings-evidence-compat.mjs',
  'tools/qb-settings-translation-artifact.mjs',
  'tools/qb-settings-translation-lkg.mjs',
  'tools/qb-locale-source.mjs',
  'tools/data/qb-stable-lkg.json',
  'tests/fixtures/qb-release-catalog.lkg.json'
])assert.equal(isSettingsSourcePath(owner),true,`Settings evidence identity must include ${owner}`);
for(const unrelated of ['installers/install.sh','webui/private/scripts/app.js','tests/browser-feature-parity.mjs'])assert.equal(isSettingsSourcePath(unrelated),false,`Unrelated change must not invalidate Settings evidence: ${unrelated}`);

assert.ok(resolver.includes("compatibleArtifactCandidates(artifacts,'qb-settings-translation-lkg-')"),'resolver must search certified ancestor artifacts after exact SHA');
assert.ok(resolver.includes('localSettingsEvidenceCompatibility({ancestorSha:artifactSha,currentSha:sourceSha,cwd:projectRoot})'),'resolver must prove repository-history equivalence before reuse');
assert.ok(resolver.includes("compatibility.reason==='settings-source-changed'"),'resolver must explain the exact Settings-source owner that invalidated reuse');
assert.ok(pagesSource.includes('Probe exact-dev-SHA Settings evidence')&&pagesSource.includes('fetch-depth: 0'),'Pages evidence probe must have full history for ancestor compatibility proof');

console.log('Settings evidence reuse contract passed: exact artifacts remain preferred, ancestor artifacts are reusable only across zero Settings-source owner changes, and unrelated installer/UI changes do not invalidate certified source evidence.');

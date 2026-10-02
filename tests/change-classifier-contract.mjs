import assert from 'node:assert/strict';
import {
  classifyChangedPaths,
  isPagesPayloadPath,
  isSettingsEvidenceConsumerPath,
  isSettingsEvidencePolicyPath,
  isSettingsSourcePath
} from '../tools/change-classifier.mjs';

let result=classifyChangedPaths(['docs/guide.md','README.md']);
assert.equal(result.docsOnly,true);
assert.equal(result.ciRelevant,false);
assert.equal(result.pagesRelevant,false);

result=classifyChangedPaths(['installers/install.sh','tests/installer-lifecycle.sh']);
assert.equal(result.installer,true);
assert.equal(result.pagesPayload,true);
assert.equal(result.settingsSource,false);
assert.equal(result.settingsUi,false);

result=classifyChangedPaths(['webui/private/scripts/app.js']);
assert.equal(result.ui,true);
assert.equal(result.pagesPayload,true);
assert.equal(result.settingsSource,false);

result=classifyChangedPaths(['webui/private/scripts/settings.js']);
assert.equal(result.ui,true);
assert.equal(result.settingsUi,true);
assert.equal(result.settingsSource,false);

result=classifyChangedPaths(['tools/qb-settings-translation-lkg.mjs']);
assert.equal(result.settingsSource,true);
assert.equal(result.pagesPayload,true);

result=classifyChangedPaths(['tools/qb-detail-surface-parsers.mjs']);
assert.equal(result.nativeSource,true);
assert.equal(result.pagesPayload,true);
assert.equal(result.settingsSource,false);

result=classifyChangedPaths(['tests/pages-live-auth.mjs']);
assert.equal(result.pagesLive,true);
assert.equal(result.pagesPayload,false);
assert.equal(result.pagesRelevant,true);

result=classifyChangedPaths(['.github/workflows/ci.yml']);
assert.equal(result.workflowPolicy,true);
assert.equal(result.pagesPayload,true);
assert.equal(result.ciRelevant,true);

result=classifyChangedPaths(['tools/change-classifier.mjs']);
assert.equal(result.workflowPolicy,true);
assert.equal(result.pagesPayload,true);
assert.equal(result.settingsSource,false);

for(const policy of ['tools/settings-evidence-compat.mjs','tools/qb-settings-translation-artifact.mjs']){
  assert.equal(isSettingsEvidencePolicyPath(policy),true);
  assert.equal(isSettingsSourcePath(policy),false);
  const classified=classifyChangedPaths([policy]);
  assert.equal(classified.workflowPolicy,true);
  assert.equal(classified.pagesPayload,true);
  assert.equal(classified.settingsSource,false);
}
for(const consumer of ['tools/qb-settings-runtime-rebind.mjs','tools/qb-settings-native-bundle.mjs','tools/qb-webui-catalog.mjs']){
  assert.equal(isSettingsEvidenceConsumerPath(consumer),true);
  const classified=classifyChangedPaths([consumer]);
  assert.equal(classified.pagesPayload,true);
  assert.equal(classified.settingsSource,false);
}

assert.equal(isPagesPayloadPath('simulator/lab/lab.js'),true);
assert.equal(isSettingsSourcePath('tools/data/qb-stable-lkg.json'),true);
assert.equal(isSettingsSourcePath('installers/install.sh'),false);

console.log('Canonical change classifier contract passed: docs, installer, UI, Settings-source, native-source, live Pages and workflow-policy lanes have one repository-owned owner.');

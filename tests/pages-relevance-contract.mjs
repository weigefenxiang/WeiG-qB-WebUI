import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  classifyChangedPaths,
  isPagesPayloadPath
} from '../tools/change-classifier.mjs';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8').replace(/\r\n?/g,'\n');
const source=read('.github/workflows/pages-source.yml');
const pages=read('.github/workflows/pages.yml');

assert.ok(source.includes('node tools/change-classifier.mjs --stdin0'),'Pages source relay must consume the canonical repository change classifier.');
assert.ok(!source.includes('pages_materialization_relevant_path()'),'Pages source relay must retire its duplicate materialization path matcher.');
assert.ok(source.includes("field=pagesRelevant")&&source.includes("field=pagesPayload"),'Pages source relay must select live-verifier-inclusive vs payload-only relevance from the canonical classifier.');
assert.ok(source.includes('settings_source: ${{ steps.relevance.outputs.settings_source }}')&&source.includes('pages_live: ${{ steps.relevance.outputs.pages_live }}'),'Pages source relay must expose canonical change classes for downstream change-aware gating.');

for(const required of [
  '.github/workflows/pages-source.yml',
  '.github/workflows/pages.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/session-handshake.yml',
  'tests/real-qb-session-race.sh',
  'tests/qb-runtime-copy-materialization-contract.mjs',
  'tools/product-identity.mjs',
  'tools/qb-settings-translation-lkg.mjs',
  'tools/qb-native-qm-recovery.mjs',
  'tools/qb-detail-surface-parsers.mjs',
  'tools/qb-release-torrent-surface.mjs',
  'tools/qb-statistics-source.mjs',
  'tools/qb-torrent-fields-parser.mjs',
  'tools/qb-webui-catalog.mjs',
  'tools/change-classifier.mjs'
])assert.equal(isPagesPayloadPath(required),true,`Pages payload boundary missing ${required}`);

let classification=classifyChangedPaths(['tests/pages-live-auth.mjs']);
assert.equal(classification.pagesLive,true);
assert.equal(classification.pagesPayload,false);
assert.equal(classification.pagesRelevant,true);

classification=classifyChangedPaths(['docs/guide.md']);
assert.equal(classification.pagesRelevant,false);
assert.equal(classification.pagesPayload,false);

classification=classifyChangedPaths(['installers/install.sh']);
assert.equal(classification.pagesPayload,true);
assert.equal(classification.installer,true);
assert.equal(classification.settingsSource,false);

// B2b2b retires the remaining deploy-job matcher in pages.yml. Until then this assertion
// prevents accidentally claiming the cutover is complete.
assert.ok(pages.includes('Pages-relevant public payload/materialization head advance blocks stale deployment:'),'Pages stale-deploy guard must remain fail-closed until it consumes the canonical classifier in the next coherent batch.');

console.log('Pages relevance contract passed: Pages Source consumes one canonical change owner, live verifiers stay distinct from payload changes, and the remaining deploy guard is explicitly bounded for the next cutover.');

import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url),'utf8').replace(/\r\n?/g,'\n');
const source=read('.github/workflows/pages-source.yml');
const pages=read('.github/workflows/pages.yml');
const matcher='.github/workflows/pages-source.yml|.github/workflows/pages.yml|.github/workflows/ci.yml|webui/*|simulator/*|installers/*|VERSION|tools/build-webui-dist.mjs|tools/product-identity.mjs|tools/qb-settings-*.mjs|tools/qb-locale-*.mjs|tools/qb-native-qm-recovery.mjs|tools/qb-owned-ui-source.mjs|tools/qb-preference-semantics.mjs|tools/qb-qm-provisioning-source.mjs|tools/qb-release-catalog*.mjs|tools/qb-source-parsers.mjs|tools/qb-detail-surface-parsers.mjs|tools/qb-torrent-fields-parser.mjs|tools/qb-translator-behavior-source.mjs|tools/qb-cpp-literals.mjs|tools/qb-webui-catalog.mjs|tools/data/qb-stable-lkg.json|tools/data/qb-locale-lkg.json|tools/data/qb-translator-behavior-lkg.json|tests/fixtures/qb-release-catalog.lkg.json)';

assert.ok(source.includes(matcher),'Pages source relay must treat payload/materialization tooling as Pages-relevant');
assert.ok(pages.includes(matcher),'Pages stale-deploy guard must use the same payload/materialization relevance boundary');
assert.equal(source.split(matcher).length-1,1,'Pages source relay must own one canonical materialization matcher');
assert.equal(pages.split(matcher).length-1,1,'Pages stale-deploy guard must own one canonical materialization matcher');
for(const required of ['.github/workflows/pages-source.yml','.github/workflows/pages.yml','.github/workflows/ci.yml','tools/product-identity.mjs','tools/qb-settings-*.mjs','tools/qb-native-qm-recovery.mjs','tools/qb-detail-surface-parsers.mjs','tools/qb-torrent-fields-parser.mjs','tools/qb-webui-catalog.mjs'])assert.ok(matcher.includes(required),`Pages relevance boundary missing ${required}`);
assert.ok(source.includes('tests/pages-live-*.mjs'),'Pages source relay must rerun deployed-site acceptance when a live Pages verifier changes');
assert.ok(!matcher.includes('docs/*')&&!matcher.includes('tests/*|'),'Pages materialization relevance must not redeploy for generic docs/tests-only changes');
assert.ok(!pages.includes('tests/pages-live-*.mjs'),'Pages stale-deploy payload guard must not treat verifier-only edits as deployed-content changes');

console.log('Pages relevance contract passed: source relay and stale-deploy guard share the build-affecting materialization boundary, including Torrent detail source parsers, while live verifier edits explicitly rerun Pages acceptance.');

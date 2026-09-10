import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const ci=read('.github/workflows/ci.yml');
const pages=read('.github/workflows/pages.yml');
const relay=read('.github/workflows/pages-source.yml');
const probe=read('webui/private/views/preferences.html');
const schema=read('webui/private/scripts/settings-schema.js');

const generated='node tools/qb-release-catalog.mjs upstream-qb --output=qb-releases.json';
const enriched='node tools/qb-locale-source.mjs upstream-qb qb-releases.json';
const audited='node tests/full-stable-product-compat.mjs qb-releases.json';
assert.ok(ci.includes(generated)&&ci.includes(enriched)&&ci.includes(audited),'candidate pipeline must generate, locale-enrich, and audit the exact catalog');
assert.ok(ci.indexOf(generated)<ci.indexOf(enriched)&&ci.indexOf(enriched)<ci.indexOf(audited),'qB locale facts must be source-derived before the exact catalog crosses the candidate boundary');
assert.ok(probe.includes('${LANGUAGE_OPTIONS}')&&probe.includes('weigg-qb-locale-options'),'real qB runtime probe must delegate option enumeration to qB WebApplication');
assert.ok(!pages.includes('Checkout qBittorrent locale source')&&!pages.includes('node tools/qb-locale-source.mjs'),'Pages must not re-parse upstream qB history on every Lab deployment');
assert.ok(relay.includes("- 'tools/qb-locale-source.mjs'"),'Locale source extractor changes must invalidate Pages source evidence when frozen locale facts are refreshed');
assert.ok(schema.includes("description:known?'qBittorrent preference.'"),'qBittorrent preference. copy must remain untouched in this change');

console.log('qB locale pipeline contract passed: candidate owns upstream extraction, runtime delegates to qB, and Pages remains Frozen-LKG bounded.');

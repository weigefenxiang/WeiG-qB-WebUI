import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const ci=read('.github/workflows/ci.yml');
const pages=read('.github/workflows/pages.yml');
const relay=read('.github/workflows/pages-source.yml');
const buildSite=read('simulator/build/build-site.mjs');
const frozenLocale=JSON.parse(read('tools/data/qb-locale-lkg.json'));
const probe=read('webui/private/views/preferences.html');
const schema=read('webui/private/scripts/settings-schema.js');

const generated='node tools/qb-release-catalog.mjs upstream-qb --output=qb-releases.json';
const enriched='node tools/qb-locale-source.mjs upstream-qb qb-releases.json';
const audited='node tests/full-stable-product-compat.mjs qb-releases.json';
assert.ok(ci.includes(generated)&&ci.includes(enriched)&&ci.includes(audited),'candidate pipeline must generate, locale-enrich, and audit the exact catalog');
assert.ok(ci.indexOf(generated)<ci.indexOf(enriched)&&ci.indexOf(enriched)<ci.indexOf(audited),'qB locale facts must be source-derived before the exact catalog crosses the candidate boundary');
assert.ok(probe.includes('${LANGUAGE_OPTIONS}')&&probe.includes('weigg-qb-locale-options'),'real qB runtime probe must delegate option enumeration to qB WebApplication');
assert.ok(!pages.includes('Checkout qBittorrent locale source')&&!pages.includes('node tools/qb-locale-source.mjs'),'Pages must not re-parse upstream qB history on every Lab deployment');
assert.ok(buildSite.includes("tools/data/qb-locale-lkg.json")&&buildSite.includes('applyLocaleOverlay')&&buildSite.includes('baseCatalogSha256'),'Virtual qB build must apply the source-SHA/base-catalog-bound frozen Locale overlay');
assert.ok(relay.includes("- 'tools/data/qb-locale-lkg.json'")&&relay.includes("- 'tools/qb-locale-overlay.mjs'"),'Pages source relay must watch the frozen Locale facts and their merge owner');
assert.ok(!relay.includes("- 'tools/qb-locale-source.mjs'"),'candidate-only upstream Locale extraction must not redeploy unchanged frozen Pages data');
assert.equal(frozenLocale.profileCount,65);
assert.equal(frozenLocale.supportFloor,'4.1.0');
assert.equal(frozenLocale.latestAdmittedStable,'5.2.3');
assert.equal(frozenLocale.baseCatalogSha256,'8b91742ac8eee276b7994c84445c681913430f220325a10afc8c931c89645ddb');
assert.equal(frozenLocale.profiles.length,65);
assert.ok(Object.keys(frozenLocale.localeSets||{}).length>1,'frozen Locale facts must preserve historical option-set changes');
assert.ok(frozenLocale.profiles.every(item=>/^[0-9a-f]{40}$/.test(item.sourceSha)&&frozenLocale.localeSets[item.localeSet]?.length),'every frozen Locale profile must bind to an exact qB source SHA and resolved locale set');
assert.ok(schema.includes("description:known?'qBittorrent preference.'"),'qBittorrent preference. copy must remain untouched in this change');

console.log('qB locale pipeline contract passed: candidate owns upstream extraction, real qB owns runtime options, and Virtual qB consumes the 65-profile hash-bound frozen Locale overlay without upstream re-parsing.');

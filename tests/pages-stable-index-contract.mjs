import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {buildStableIndex,STABLE_INDEX_SCHEMA_VERSION} from '../simulator/build/stable-index.mjs';
import {PAGES_FULL_CATALOG_PATH} from './pages-live-catalog.mjs';

const read=rel=>fs.readFileSync(new URL(`../${rel}`,import.meta.url));
const canonical=read('tests/fixtures/qb-release-catalog.lkg.json').toString('utf8').replace(/\r\n?/g,'\n');
const sourceBytes=Buffer.byteLength(canonical,'utf8');
const sourceSha256=crypto.createHash('sha256').update(Buffer.from(canonical,'utf8')).digest('hex');
const catalog=JSON.parse(canonical);
const manifest=JSON.parse(read('tools/data/qb-stable-lkg.json').toString('utf8'));
const index=buildStableIndex(catalog,{sourceCatalogSha256:sourceSha256});
const expected=catalog.map(profile=>({
  qbVersion:String(profile.qbVersion||'').trim(),
  webApiVersion:String(profile.webApiVersion||'').trim(),
  tag:String(profile.tag||'').trim(),
  sourceSha:String(profile.sourceSha||'').trim(),
  officialWeiGSupport:profile.officialWeiGSupport===true
}));
const indexBytes=Buffer.byteLength(JSON.stringify(index)+'\n','utf8');

assert.equal(index.schemaVersion,STABLE_INDEX_SCHEMA_VERSION);
assert.equal(index.sourceCatalogSha256,manifest.catalogSha256,'stable index must bind to the exact Frozen LKG catalog digest');
assert.equal(index.profileCount,manifest.profileCount);
assert.equal(index.supportFloor,manifest.supportFloor);
assert.equal(index.latestAdmittedStable,manifest.latestAdmittedStable);
assert.deepEqual(index.profiles,expected,'compact index must be an order-preserving identity/facts projection of every Frozen LKG stable profile');
assert.equal(new Set(index.profiles.map(item=>item.qbVersion)).size,index.profileCount,'compact stable index must preserve one unique selector identity per qB release');
assert.ok(index.profiles.every((item,i)=>item.sourceSha===catalog[i].sourceSha&&item.webApiVersion===catalog[i].webApiVersion),'compact index must preserve exact source/API identity, not infer it from version strings');
assert.ok(indexBytes<64*1024,`stable index must stay comfortably below one small static payload; got ${indexBytes} bytes`);
assert.ok(indexBytes*100<sourceBytes,`stable index must reduce Lab bootstrap transfer by >100x; source=${sourceBytes}, index=${indexBytes}`);

const lab=read('simulator/lab/lab.js').toString('utf8');
const build=read('simulator/build/build-site.mjs').toString('utf8');
const pages=read('.github/workflows/pages.yml').toString('utf8');
assert.ok(lab.includes("../metadata/qb-stable-index.json")&&!lab.includes("../metadata/qb-releases.json"),'Lab must consume only the compact stable index and retire the full metadata catalog fetch');
assert.equal(PAGES_FULL_CATALOG_PATH,'dev/app/__simulator/versions/catalog.generated.json','Pages live full-catalog evidence must stay inside the deployed dev simulator artifact, not top-level Lab metadata');
for(const rel of ['tests/pages-live-acceptance.mjs','tests/pages-live-preferences.mjs','tests/pages-live-release-profile.mjs']){const source=read(rel).toString('utf8');assert.ok(source.includes("from './pages-live-catalog.mjs'")&&source.includes('fetchJson(PAGES_FULL_CATALOG_PATH)')&&!source.includes("fetchJson('metadata/qb-releases.json')"),`${rel} must consume the shared internal simulator catalog path and keep the retired top-level catalog fetch absent`);}
assert.ok(build.includes("buildStableIndex(catalogData,{sourceCatalogSha256:baseCatalogSha256})")&&build.includes("metadata','qb-stable-index.json")&&!build.includes("metadata','qb-releases.json"),'Pages site builder must publish the compact hash-bound index instead of duplicating full simulator evidence into top-level metadata');
assert.ok(pages.includes('test -s "$RUNNER_TEMP/virtual-qb-site/metadata/qb-stable-index.json"')&&pages.includes('test ! -e "$RUNNER_TEMP/virtual-qb-site/metadata/qb-releases.json"')&&!pages.includes("const catalog=JSON.parse(fs.readFileSync(`${process.env.RUNNER_TEMP}/virtual-qb-site/metadata/qb-releases.json`"),'Pages workflow must validate the compact top-level index, explicitly guard retirement of the full top-level catalog, and keep full evidence inside simulator artifacts only');

assert.ok(pages.includes("const admittedProfiles=manifest.profileCount;")&&pages.includes("site.localeCatalog?.profiles!==admittedProfiles")&&pages.includes("stableIndex.profileCount!==admittedProfiles")&&pages.includes("site.settingsTranslationCatalog?.profiles!==admittedProfiles"),'Pages Locale, stable-index and Settings exact-count gates must share the verified admitted Frozen manifest count instead of a release-specific integer');
assert.ok(pages.includes("stableIndex.sourceCatalogSha256!==manifest.catalogSha256")&&pages.includes("stableIndex.latestAdmittedStable!==manifest.latestAdmittedStable"),'Pages stable index must bind to the same admitted hash and highest stable as Frozen manifest');
assert.ok(!/(?:!==|===)\s*65\b/.test(pages),'Pages source must not hard-code the previous release count');

assert.ok(lab.includes("||catalog[0]")&&!lab.includes("catalog.at(-1)"),'Lab facts should use the highest certified profile whenever a stale selection disappears');
assert.ok(lab.includes("data.get('qb')||catalog[0]?.qbVersion||''")&&!lab.includes("data.get('qb')||'5.2.3'"),'Lab launch must fall back to the catalog highest certified release, not a release-specific version');

console.log(`Pages stable index contract passed: ${index.profileCount} exact qB identities preserve Frozen LKG order/source facts in ${indexBytes} bytes vs ${sourceBytes} source bytes (>100x smaller Lab bootstrap).`);

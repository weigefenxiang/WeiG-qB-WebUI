import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const ui=read('webui/private/scripts/ui.js');
const table=read('webui/private/css/table.css');
const dist=read('tools/build-webui-dist.mjs');
const catalog=read('tools/qb-webui-catalog.mjs');
const evidence=JSON.parse(read('tools/data/qb-peer-flag-hosting.json'));

assert.deepEqual(evidence.countryTruth,['country','country_code']);
assert.equal(evidence.status,'blocked');
assert.equal(evidence.builtinStaticFallback,false);
assert.deepEqual(evidence.evidence.map(item=>item.qbVersion),['4.6.7','5.2.3']);
assert.match(ui,/W\.QbFlagProvider=\{mode:'qB-alternative-ui-gap',assetRoute:null/);
assert.match(ui,/sourceColumnKeys\(column\).*country_code/s);
assert.doesNotMatch(ui,/images\/flags|peer-country-flag|countryFlag|GeoIP|geoip|emoji/i);
assert.doesNotMatch(table,/qb-peer-flags|images\/flags|peer-country-flag/);
assert.doesNotMatch(dist,/materializeQbPeerFlags|qb-release-catalog-peer-flags/);
assert.doesNotMatch(catalog,/materializeQbPeerFlags|qb-release-catalog-peer-flags/);
assert.equal(fs.existsSync(path.join(root,'tools/qb-release-catalog-peer-flags.mjs')),false);
assert.equal(fs.existsSync(path.join(root,'webui/private/css/qb-peer-flags.css')),false);
assert.equal(fs.existsSync(path.join(root,'webui/private/images/flags')),false);
console.log('Peer flag hosting contract passed: qB country/country_code remain the only country truth, while the unrouteable built-in flag assets stay explicitly blocked instead of being bundled or replaced by a fallback.');

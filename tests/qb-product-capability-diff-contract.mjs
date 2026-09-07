import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarizeProductProfile,renderProductDiff} from '../tools/qb-product-capability-diff.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const lkg=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/qb-release-catalog.lkg.json'),'utf8'));
assert.ok(Array.isArray(lkg)&&lkg.length>0,'product capability diff contract requires frozen LKG catalog');
const before=lkg.at(-1),future=structuredClone(before);future.qbVersion='6.0.0';future.webApiVersion='3.0.0';future.tag='release-6.0.0';future.sourceSha='synthetic-future-major-sentinel';future.releaseOrdinal=lkg.length;
const candidate=[...lkg,future];
const left=await summarizeProductProfile(before,candidate),right=await summarizeProductProfile(future,candidate);
for(const key of ['capabilities','filters','actions']){const now=new Set(right[key]);for(const value of left[key])assert.ok(now.has(value),`future-major sentinel regressed ${key} capability ${value} despite identical source facts`);}
assert.deepEqual(right.writablePreferences,left.writablePreferences,'future-major sentinel with identical source facts must retain writable Preference surface');
const report=renderProductDiff([left,right]);assert.ok(report.includes(`qB ${before.qbVersion} -> 6.0.0`)&&report.includes('Capabilities'),'product capability diff report must identify transition and capability delta');
console.log(`Product capability diff contract passed: future-major sentinel preserves source-proven product semantics across ${left.capabilities.length} capabilities, ${left.filters.length} filters, ${left.actions.length} actions, and ${left.writablePreferences.length} writable Preferences.`);

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const health=readFileSync(new URL('../webui/private/scripts/instance-health.js',import.meta.url),'utf8');
assert.ok(health.includes('function verifiedVersion(value)'));
assert.ok(health.includes('/^v?'), 'Recognize raw qB WebAPI version with v prefix.');
assert.ok(health.includes("verifiedVersion(client.qbVersion)"));
assert.ok(health.includes("verifiedVersion(text)"));
console.log('Instance qB version contract passed.');

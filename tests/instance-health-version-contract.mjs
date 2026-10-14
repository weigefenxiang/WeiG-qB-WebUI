import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const health=readFileSync(new URL('../webui/private/scripts/instance-health.js',import.meta.url),'utf8');
assert.ok(health.includes('function verifiedVersion(v)')&&health.includes('verifiedVersion(client.qbVersion)'), 'Only current qB WebAPI version can be trusted');
assert.ok(!health.includes('refreshShared')&&!health.includes('remoteGet(')&&!health.includes('fetch('), 'Retire all remote detection transports');
console.log('Instance local-version-only contract passed.');

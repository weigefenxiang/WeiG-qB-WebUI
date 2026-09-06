import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const engine=read('simulator/core/engine.js');
const peerView=read('simulator/core/peer-view.js');
const webseedView=read('simulator/core/webseed-view.js');
const virtualServices=read('simulator/core/virtual-services.js');
const torrentAuxiliary=read('simulator/core/torrent-auxiliary.js');
const router=read('simulator/protocol/router.js');
const auxiliaryRouter=read('simulator/protocol/auxiliary-router.js');
const peerContract=read('tests/simulator-peer-view-contract.mjs');

assert.doesNotMatch(engine,/export\s+function\s+peers\s*\(/,'engine.js must not regain the retired linear peer projection');
assert.doesNotMatch(virtualServices,/export\s+function\s+webseedList\s*\(/,'virtual-services.js must not regain the retired WebSeed projection');
assert.doesNotMatch(router,/path\s*===\s*['"]sync\/torrentPeers['"]/,'router.js must not regain the preempted torrentPeers fallback');
assert.doesNotMatch(router,/path\s*===\s*['"]torrents\/webseeds['"]/,'router.js must not regain the preempted WebSeed fallback');
assert.doesNotMatch(router,/\bfilterBannedPeers\b/,'router.js must not retain peer-overlay imports owned by auxiliary-router.js');
assert.doesNotMatch(router,/\bwebseedList\b/,'router.js must not import the retired WebSeed projection');

assert.match(auxiliaryRouter,/import\s*\{\s*generatedPeers\s*\}\s*from\s*['"]\.\.\/core\/peer-view\.js['"]/,'auxiliary-router.js must route torrentPeers through peer-view.js');
assert.match(auxiliaryRouter,/import\s*\{\s*indexedWebseedList\s*\}\s*from\s*['"]\.\.\/core\/webseed-view\.js['"]/,'auxiliary-router.js must route WebSeed reads through webseed-view.js');
assert.match(auxiliaryRouter,/generatedPeers\(world,hash\)/,'torrentPeers live route must call generatedPeers');
assert.match(auxiliaryRouter,/indexedWebseedList\(world,url\.searchParams\.get\('hash'\)\|\|''\)/,'WebSeed live route must call indexedWebseedList');
assert.match(torrentAuxiliary,/import\s*\{\s*indexedWebseedList\s+as\s+webseedList\s*\}\s*from\s*['"]\.\/webseed-view\.js['"]/,'WebSeed mutations must initialize through the canonical indexed projection');
assert.doesNotMatch(torrentAuxiliary,/import[^\n]*webseedList[^\n]*virtual-services\.js/,'WebSeed mutations must not depend on virtual-services legacy projection');

const ownershipSources={engine,peerView,webseedView,virtualServices,torrentAuxiliary,router,auxiliaryRouter};
const peerOwners=Object.entries(ownershipSources).filter(([,source])=>/export\s+function\s+generatedPeers\s*\(/.test(source)).map(([name])=>name);
const webseedOwners=Object.entries(ownershipSources).filter(([,source])=>/export\s+function\s+indexedWebseedList\s*\(/.test(source)).map(([name])=>name);
assert.deepEqual(peerOwners,['peerView'],'peer-view.js must remain the unique generated-peer projection owner');
assert.deepEqual(webseedOwners,['webseedView'],'webseed-view.js must remain the unique indexed WebSeed projection owner');

assert.doesNotMatch(peerContract,/\blegacyPeers\b/,'peer protocol contract must not use retired engine peers as an oracle');
assert.doesNotMatch(peerContract,/\blegacyWebseedList\b/,'peer protocol contract must not use retired WebSeed implementation as an oracle');
assert.doesNotMatch(peerContract,/peers\s+as\s+legacy/i,'peer protocol contract must not alias any peer implementation as a legacy oracle');
assert.doesNotMatch(peerContract,/webseedList\s+as\s+legacy/i,'peer protocol contract must not alias any WebSeed implementation as a legacy oracle');

console.log('Virtual qB detail projection ownership contract passed: peer-view/webseed-view are the unique live projection owners, router fallbacks stay retired, mutations reuse the canonical WebSeed projection, and tests contain no legacy oracle.');

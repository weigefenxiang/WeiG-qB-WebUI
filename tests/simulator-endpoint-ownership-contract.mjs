import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const endpointContracts=read('simulator/protocol/endpoint-contracts.js');
const transportContract=read('simulator/protocol/transport-contract.js');
const router=read('simulator/protocol/router.js');
const auxiliary=read('simulator/protocol/auxiliary-router.js');
const serviceWorker=read('simulator/service-worker/service-worker.js');
const authPolicy=read('simulator/core/auth-policy.js');
const metadata=read('simulator/core/torrent-metadata.js');
const runtimeView=read('simulator/core/runtime-view.js');
const peerView=read('simulator/core/peer-view.js');

assert.match(router,/resolveEndpointContract\(world\.profile,path\)/,'router must resolve the active endpoint semantic contract once per request');
assert.match(router,/resolveMissingEndpointContract\(world\.profile\)/,'router must resolve versioned missing-endpoint error projection without owning its revision literal');
assert.match(router,/tryAuthenticate\(world,String\(form\.username\?\?''\),String\(form\.password\?\?''\),now\)/,'router must delegate credential acceptance to the auth policy owner');
assert.match(router,/contract\?\.invalidCredentialsStatus/,'auth/login must consume Endpoint Contract failure semantics');
assert.match(router,/contract\?\.successBody==='empty'/,'auth/login must consume Endpoint Contract success-body semantics');
assert.match(router,/handleAuxiliaryApi\(world,request,path,method,url,contract\)/,'router must pass the already-resolved semantic contract into auxiliary endpoints');
assert.match(router,/mainDataSnapshot\(world,url\.searchParams\.get\('rid'\)\|\|0,now,contract\)/,'sync/maindata must consume the resolved contract');
assert.match(router,/propertiesForTorrent\(world,url\.searchParams\.get\('hash'\)\|\|'',now,contract\)/,'torrents/properties must consume the resolved contract');
assert.match(router,/trackersForTorrent\(world,url\.searchParams\.get\('hash'\)\|\|'',now,contract\)/,'torrents/trackers must consume the resolved contract');
assert.match(router,/trackerEditResponse\(world,f,contract\)/,'editTracker must consume the resolved contract');
assert.match(router,/contract\?\.pipeSeparatedHashes/,'tracker collection mutation must consume contract selector semantics');
assert.match(router,/contract\?\.missingResourceStatus===404/,'editCategory missing-resource behavior must consume contract status semantics');
assert.match(router,/contract\?\.noOp==='conflict'/,'editCategory no-op behavior must consume contract semantics');
assert.match(auxiliary,/handleAuxiliaryApi\(world,request,path,method,url,contract=null\)/,'auxiliary router must receive the router-resolved contract explicitly');
assert.match(auxiliary,/contract\?\.responseShape==='structured-result'/,'torrents/add must consume Endpoint Contract response/status semantics');
assert.match(auxiliary,/contract\?\.responseShape==='ordered-array'/,'parseMetadata must consume Endpoint Contract response-shape semantics');
assert.match(auxiliary,/projectPeerHostNames\(world,merged,contract\)/,'sync/torrentPeers must consume the router-resolved hostname contract');
assert.equal(auxiliary.includes("'2.13.0'"),false,'auxiliary router must not retain the migrated parseMetadata 2.13.0 semantic boundary');
assert.equal(auxiliary.includes("'2.14.0'"),false,'auxiliary router must not retain the migrated torrents/add 2.14.0 semantic boundary');
assert.equal(auxiliary.includes("'2.15.1'"),false,'auxiliary router must not own the peer host_name 2.15.1 boundary');
assert.equal(authPolicy.includes("'2.14.0'"),false,'credential acceptance policy must not own WebAPI response-version boundaries');
assert.equal(peerView.includes("'2.15.1'"),false,'peer projection must consume Endpoint Contract instead of owning the host_name revision literal');

for(const [label,source] of [['router',router],['metadata',metadata],['runtime-view',runtimeView]]){
  for(const version of ['2.11.9','2.13.0','2.14.0','2.15.0','2.15.1']){
    assert.equal(source.includes(`'${version}'`),false,`${label} must not retain migrated semantic boundary ${version}`);
  }
}
assert.match(endpointContracts,/'2\.11\.9'/,'Endpoint Contract must own tracker batch boundary');
assert.match(endpointContracts,/'2\.13\.0'/,'Endpoint Contract must own tracker/editTracker/parseMetadata semantic boundary');
assert.match(endpointContracts,/'2\.14\.0'/,'Endpoint Contract must own login, missing-endpoint and torrents/add result/status boundaries');
assert.match(endpointContracts,/'2\.15\.0'/,'Endpoint Contract must own sync/maindata use_subcategories boundary');
assert.match(endpointContracts,/'2\.15\.1'/,'Endpoint Contract must own properties/editCategory/peer hostname semantic boundaries');
assert.match(transportContract,/BASIC_AUTH_MIN_WEB_API='2\.15\.0'/,'Transport Contract must own the Basic-auth WebAPI boundary');
assert.match(transportContract,/X_FORWARDED_HOST_HARDENED_QB='5\.2\.2'/,'Transport Contract must own the qB patch-level X-Forwarded-Host hardening boundary');
assert.match(serviceWorker,/applyTransportPolicy\(world,event\.request\)/,'Service Worker must apply transport semantics before protocol routing');
assert.doesNotMatch(router,/addVirtualTorrent\(/,'router must not retain the preempted second torrents/add runtime path');

console.log('Virtual qB endpoint ownership contract passed: endpoint and transport semantic boundaries have explicit owners, auxiliary peer projection consumes Endpoint Contract, Service Worker owns HTTP transport enforcement, and duplicate runtime paths stay retired.');

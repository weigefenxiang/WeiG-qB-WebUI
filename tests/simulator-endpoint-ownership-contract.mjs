import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const endpointContracts=read('simulator/protocol/endpoint-contracts.js');
const router=read('simulator/protocol/router.js');
const auxiliary=read('simulator/protocol/auxiliary-router.js');
const metadata=read('simulator/core/torrent-metadata.js');
const runtimeView=read('simulator/core/runtime-view.js');

assert.match(router,/resolveEndpointContract\(world\.profile,path\)/,'router must resolve the active endpoint semantic contract once per request');
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
assert.equal(auxiliary.includes("'2.13.0'"),false,'auxiliary router must not retain the migrated parseMetadata 2.13.0 semantic boundary');
assert.equal(auxiliary.includes("'2.14.0'"),false,'auxiliary router must not retain the migrated torrents/add 2.14.0 semantic boundary');

for(const [label,source] of [['router',router],['metadata',metadata],['runtime-view',runtimeView]]){
  for(const version of ['2.11.9','2.13.0','2.14.0','2.15.0','2.15.1']){
    assert.equal(source.includes(`'${version}'`),false,`${label} must not retain migrated semantic boundary ${version}`);
  }
}
assert.match(endpointContracts,/'2\.11\.9'/,'Endpoint Contract must own tracker batch boundary');
assert.match(endpointContracts,/'2\.13\.0'/,'Endpoint Contract must own tracker/editTracker/parseMetadata semantic boundary');
assert.match(endpointContracts,/'2\.14\.0'/,'Endpoint Contract must own torrents/add result/status boundary');
assert.match(endpointContracts,/'2\.15\.0'/,'Endpoint Contract must own sync/maindata use_subcategories boundary');
assert.match(endpointContracts,/'2\.15\.1'/,'Endpoint Contract must own properties/editCategory semantic boundary');
assert.doesNotMatch(router,/addVirtualTorrent\(/,'router must not retain the preempted second torrents/add runtime path');

console.log('Virtual qB endpoint ownership contract passed: migrated semantic boundaries have one current owner, auxiliary endpoints consume the router-resolved contract, active callers consume it, and the preempted duplicate add route stays retired.');
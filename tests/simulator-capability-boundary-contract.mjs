import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

function world(qb,api){
  const value=createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true},count:24,seed:`capability-boundary-${qb}-${api}`,now:1700000000000});
  authenticate(value,'demo','demo',1700000000000);
  return value;
}
function formRequest(path,body={}){
  return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
}
function getRequest(path){return new Request(`https://example.invalid/api/v2/${path}`);}

{
  const before=world('4.1.9.1','2.2.1'),target=before.torrents[0],tag='boundary-add-tag';
  let response=await handleApi(before,formRequest('torrents/addTags',{hashes:target.hash,tags:tag}));
  assert.equal(response.status,404,'addTags must remain unavailable through qB 4.1.9.1 / WebAPI 2.2.1');
  assert.ok(!target.tags.includes(tag),'unavailable addTags must not mutate torrent state');

  const atBoundary=world('4.2.0','2.3.0'),boundaryTarget=atBoundary.torrents[0];
  response=await handleApi(atBoundary,formRequest('torrents/addTags',{hashes:boundaryTarget.hash,tags:tag}));
  assert.equal(response.status,200,'addTags must become available at qB 4.2.0 / WebAPI 2.3.0');
  assert.ok(boundaryTarget.tags.includes(tag),'available addTags must mutate persistent torrent state');
}

{
  const before=world('4.1.3','2.1.0');
  let response=await handleApi(before,getRequest('torrents/categories'));
  assert.equal(response.status,404,'categories must remain unavailable through qB 4.1.3 / WebAPI 2.1.0');

  const atBoundary=world('4.1.4','2.1.1');
  response=await handleApi(atBoundary,getRequest('torrents/categories'));
  assert.equal(response.status,200,'categories must become available at qB 4.1.4 / WebAPI 2.1.1');
  const categories=await response.json();
  assert.ok(Object.keys(categories).length>0,'available categories endpoint must expose the virtual category state');
}

console.log('Simulator capability boundary contract passed: Categories 4.1.4/2.1.1 and Tags 4.2.0/2.3.0 fallback behavior match source-backed stable release boundaries.');

import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

function world(qb,api,extra={}){
  const value=createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true,...extra},count:24,seed:`capability-boundary-${qb}-${api}`,now:1700000000000});
  authenticate(value,'demo','demo',1700000000000);
  return value;
}
function formRequest(path,body={}){
  return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
}
function getRequest(path){return new Request(`https://example.invalid/api/v2/${path}`);}

{
  const fallback=world('4.1.0','2.0.0');
  let response=await handleApi(fallback,getRequest('rss/items?withData=true'));
  assert.equal(response.status,404,'version-only synthetic qB 4.1.0 must retain the legacy WebAPI fallback boundary when exact source actions are unavailable');

  const exact=world('4.1.0','2.0.0',{apiActions:['rsscontroller.h:itemsAction']});
  response=await handleApi(exact,getRequest('rss/items?withData=true'));
  assert.equal(response.status,200,'exact qB 4.1.0 must expose RSS items from source action provenance despite WebAPI 2.0.0');
  const items=await response.json();
  assert.ok(items&&typeof items==='object'&&!Array.isArray(items),'exact qB 4.1.0 RSS must return the virtual RSS object shape');
  response=await handleApi(exact,getRequest('search/plugins'));
  assert.equal(response.status,404,'exact qB 4.1.0 must not infer Search when search/plugins source action is absent');

  const exactMissing=world('4.1.3','2.1.0',{apiActions:[]});
  response=await handleApi(exactMissing,getRequest('rss/items?withData=true'));
  assert.equal(response.status,404,'exact source profile must fail closed when RSS action is absent even if the version-only fallback would allow it');
}

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

console.log('Simulator capability boundary contract passed: exact RSS source actions override version fallback safely, while Categories 4.1.4/2.1.1 and Tags 4.2.0/2.3.0 fallback behavior retain source-backed stable release boundaries.');

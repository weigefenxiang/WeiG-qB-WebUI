import assert from 'node:assert/strict';
import {authenticate,createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

function world(){
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1',stable:true},count:24,seed:'search-protocol',now:1700000000000});
  authenticate(w,'demo','demo',1700000000000);return w;
}
function get(path){return new Request(`https://example.invalid/api/v2/${path}`);}
function post(path,body={}){return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});}

const w=world();

{
  let r=await handleApi(w,post('search/start',{pattern:'missing category',plugins:'enabled'}));
  assert.equal(r.status,400,'search/start must require pattern, category and plugins like upstream');
  r=await handleApi(w,post('search/stop',{}));assert.equal(r.status,400,'search/stop must require id');
  r=await handleApi(w,get('search/results?limit=10&offset=0'));assert.equal(r.status,400,'search/results must require id');
}

const ids=[];
for(let i=0;i<5;i++){
  const r=await handleApi(w,post('search/start',{pattern:`Concurrent ${i}`,category:'all',plugins:'enabled'}));
  assert.equal(r.status,200);ids.push((await r.json()).id);
}
{
  const r=await handleApi(w,post('search/start',{pattern:'Too many',category:'all',plugins:'enabled'}));
  assert.equal(r.status,409,'upstream limits Search to five concurrent jobs');
  assert.match(await r.text(),/5 concurrent searches/i);
}

{
  let r=await handleApi(w,get('search/status'));
  let status=await r.json();assert.equal(r.status,200);assert.equal(status.length,5);assert.ok(status.every(item=>item.status==='Running'));
  r=await handleApi(w,get('search/status?id=0'));status=await r.json();assert.equal(status.length,5,'id=0 must mean all searches');
  r=await handleApi(w,get('search/status?id=999999'));assert.equal(r.status,404,'unknown nonzero status id must be Not Found');
}

{
  let r=await handleApi(w,post('search/stop',{id:ids[0]}));assert.equal(r.status,200);
  r=await handleApi(w,post('search/start',{pattern:'Replacement',category:'all',plugins:'enabled'}));assert.equal(r.status,200,'stopped jobs must no longer consume the active-search limit');
  ids.push((await r.json()).id);
  r=await handleApi(w,post('search/stop',{id:999999}));assert.equal(r.status,404,'unknown stop id must be Not Found');
}

{
  const id=ids[1];
  let r=await handleApi(w,get(`search/results?id=${id}&limit=0&offset=0`));assert.equal(r.status,200);
  const all=await r.json();assert.ok(all.total>=6);assert.equal(all.results.length,all.total,'limit <= 0 must mean no limit');

  r=await handleApi(w,get(`search/results?id=${id}&limit=0&offset=-2`));assert.equal(r.status,200);
  const tail=await r.json();assert.equal(tail.results.length,2,'negative offset must count from the end of current results');
  assert.deepEqual(tail.results,all.results.slice(-2));

  r=await handleApi(w,get(`search/results?id=${id}&limit=10&offset=${all.total+1}`));assert.equal(r.status,409,'offset larger than result count must conflict');
  assert.match(await r.text(),/Offset is out of range/i);
  r=await handleApi(w,get(`search/results?id=${id}&limit=10&offset=-${all.total+1}`));assert.equal(r.status,409,'negative offset before start must conflict');
  r=await handleApi(w,get('search/results?id=999999&limit=10&offset=0'));assert.equal(r.status,404,'unknown results id must be Not Found');
}

{
  const id=ids[2];
  let r=await handleApi(w,post('search/delete',{id}));assert.equal(r.status,200);
  r=await handleApi(w,get(`search/status?id=${id}`));assert.equal(r.status,404,'deleted search must disappear from status');
  r=await handleApi(w,post('search/delete',{id}));assert.equal(r.status,404,'deleting an unknown job must be Not Found');
}

console.log('Virtual qB Search protocol contract passed: required params, five-job concurrency, id=0 status, Not Found handling, upstream offset normalization and unlimited-result semantics.');

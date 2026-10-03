import assert from 'node:assert/strict';
import {fetchJsonEvidence} from './browser-driver.mjs';

function response(status,payload){
  return{ok:status>=200&&status<300,status,async json(){if(payload instanceof Error)throw payload;return payload;}};
}

{
  let calls=0;
  const value=await fetchJsonEvidence('https://example.invalid/network',{attempts:3,delayMs:0,fetchImpl:async()=>{
    calls++;if(calls<3)throw new Error('synthetic network timeout');return response(200,{ok:true});
  }});
  assert.deepEqual(value,{ok:true});assert.equal(calls,3,'bounded evidence GET must retry transient network failures and then stop on success');
}
{
  let calls=0;
  const value=await fetchJsonEvidence('https://example.invalid/503',{attempts:3,delayMs:0,fetchImpl:async()=>{
    calls++;return calls<3?response(503,{error:true}):response(200,{ok:true});
  }});
  assert.deepEqual(value,{ok:true});assert.equal(calls,3,'bounded evidence GET must retry transient 5xx responses');
}
{
  let calls=0;
  await assert.rejects(()=>fetchJsonEvidence('https://example.invalid/404',{attempts:3,delayMs:0,fetchImpl:async()=>{calls++;return response(404,{error:true});}}),/HTTP 404/);
  assert.equal(calls,1,'non-retryable 4xx evidence failures must fail immediately');
}
{
  let calls=0;
  await assert.rejects(()=>fetchJsonEvidence('https://example.invalid/post',{init:{method:'POST'},attempts:3,delayMs:0,fetchImpl:async()=>{calls++;return response(200,{ok:true});}}),/restricted to idempotent GET/);
  assert.equal(calls,0,'shared evidence retry owner must never retry or issue non-GET requests');
}
console.log('Pages Node evidence fetch contract passed: static GET evidence has bounded transient retry, 4xx fail-fast semantics and no browser/WebAPI retry ownership.');

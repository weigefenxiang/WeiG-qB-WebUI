import assert from 'node:assert/strict';
import {recoverPageSession} from './pages-live-session.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const starts=[];
let navigations=0;
const handle={async jsonValue(){return'private';}};
const page={
  async waitForFunction(){return handle;},
  async waitForSelector(){return{};},
  async evaluate(){return{readyState:'complete'};},
  url(){return'https://example.invalid/dev/app/';},
  locator(){return{async click(){}};}
};

const recovered=await recoverPageSession(page,{
  label:'recovery contract',
  attempts:2,
  timeoutMs:1000,
  onAttemptStart:state=>starts.push({attempt:state.attempt,previous:state.previous}),
  navigate:async attempt=>{
    navigations++;
    if(attempt===1)throw new Error('synthetic bootstrap failure');
  }
});

assert.equal(recovered.attempt,2);
assert.equal(navigations,2);
assert.deepEqual(starts.map(item=>item.attempt),[1,2]);
assert.equal(starts[0].previous,null);
assert.equal(starts[1].previous?.attempt,1);
assert.match(starts[1].previous?.error||'',/synthetic bootstrap failure/);
const here=path.dirname(fileURLToPath(import.meta.url)),preferences=fs.readFileSync(path.join(here,'pages-live-preferences.mjs'),'utf8');
assert.ok(preferences.includes('onAttemptStart:resetVerifierLocaleBootstrap')&&preferences.includes("localStorage.removeItem(key)")&&preferences.includes("SessionContract?.clearLocaleIntent?.()"),'Preferences entity verifier must re-arm its locale-only precondition on every bounded recovery attempt instead of inheriting a failed attempt bootstrap record');
assert.ok(!preferences.includes('session retries keep that same sim and must not reset locale ownership'),'retired retry assumption must stay absent from the preferences verifier');
console.log('Pages session recovery contract passed: attempt-start lifecycle isolates failed bootstrap evidence and Preferences re-arms only its verifier locale precondition before retry.');

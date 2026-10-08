import assert from 'node:assert/strict';
import {recoverPageSession} from '../tests/pages-live-session.mjs';
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
const here=path.dirname(fileURLToPath(import.meta.url)),preferences=fs.readFileSync(path.join(here,'../tests/pages-live-preferences.mjs'),'utf8'),auth=fs.readFileSync(path.join(here,'../tests/pages-live-auth.mjs'),'utf8');
assert.ok(preferences.includes('onAttemptStart:resetVerifierLocaleBootstrap')&&preferences.includes("localStorage.removeItem(key)")&&preferences.includes("SessionContract?.clearLocaleIntent?.()"),'Preferences entity verifier must re-arm its locale-only precondition on every bounded recovery attempt instead of inheriting a failed attempt bootstrap record');
assert.ok(!preferences.includes('session retries keep that same sim and must not reset locale ownership'),'retired retry assumption must stay absent from the preferences verifier');
assert.ok(auth.includes('waitForPageSessionEntry,pageSessionDiagnostics,PAGE_SESSION_ATTEMPTS}')&&auth.includes('pages-live-session.mjs')&&auth.includes('waitForPageSessionEntry(page,')&&auth.includes('pageSessionDiagnostics(page)')&&auth.includes('recoverPageSession(page,{')&&auth.includes("label:'Pages auth fixed-credential login'")&&auth.includes("label:'Pages auth changed-password login'"),'Pages Auth must consume the canonical bounded session recovery owner for authenticated private entry.');
assert.ok(auth.includes('PAGE_SESSION_ATTEMPTS')&&auth.includes('Expected unauthenticated login entry')&&auth.includes('Virtual qB unauthenticated login entry failed'),'Pages Auth login shell must use bounded canonical recovery without bypassing unauthenticated checks');
assert.ok(!auth.includes('async function waitForPrivate')&&!auth.includes("waitForSelector('#torrent-list',{state:'attached',timeout:60000})"),'Pages Auth must retire its feature-local one-shot 60s private-session waiter.');
console.log('Pages session recovery contract passed: bounded bootstrap recovery is shared by Preferences and Auth while their feature-specific preconditions remain explicit.');

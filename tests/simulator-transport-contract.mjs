import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld} from '../simulator/core/engine.js';
import {applyTransportPolicy,isCrossSiteRequest,resolveTransportContract,selectTargetHost} from '../simulator/protocol/transport-contract.js';
import {adaptSessionContractSource} from '../simulator/core/session-contract-adapter.js';
import {consumePendingHandoffSession,durableSessionUrl,forgetPendingHandoffSession,hasHandoffSessionToken,rememberHandoffSession,rememberPendingHandoffSession,rememberSessionForEvent,sessionClientIds,sessionForEvent,sessionForHandoff,sessionForUrl} from '../simulator/core/session-identity.js';

function world(qb,api){
  const value=createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true},count:1,seed:'transport-contract',now:1700000000000});
  value.authenticationPolicy={acceptAny:false,username:'demo',password:'demo'};
  return value;
}
function request(url,{method='GET',headers={}}={}){return new Request(url,{method,headers});}
function basic(value){return `Basic ${btoa(value)}`;}

{
  assert.equal(resolveTransportContract({qbVersion:'5.2.0',webApiVersion:'2.14.1'}).basicAuth,false);
  assert.equal(resolveTransportContract({qbVersion:'5.2.0',webApiVersion:'2.15.0'}).basicAuth,true);
  assert.equal(resolveTransportContract({qbVersion:'5.2.1',webApiVersion:'2.15.1'}).xForwardedHostPolicy,'always');
  assert.equal(resolveTransportContract({qbVersion:'5.2.2',webApiVersion:'2.15.1'}).xForwardedHostPolicy,'reverse-proxy-only');
}

{
  const legacy=world('5.2.0','2.14.1');
  let result=applyTransportPolicy(legacy,request('https://lab.example/api/v2/app/version',{headers:{authorization:basic('demo:demo')}}));
  assert.equal(result.rejected,false);assert.equal(result.authentication,'unsupported');assert.equal(legacy.authenticated,false,'Basic auth must not authenticate before WebAPI 2.15.0');

  const modern=world('5.2.0','2.15.0');
  result=applyTransportPolicy(modern,request('https://lab.example/api/v2/app/version',{headers:{authorization:basic('wrong:wrong')}}));
  assert.equal(result.rejected,true);assert.equal(result.status,401);assert.equal(modern.authenticated,false,'invalid Basic credentials must not create a session');
  result=applyTransportPolicy(modern,request('https://lab.example/api/v2/app/version',{headers:{authorization:basic('demo:demo')}}));
  assert.equal(result.rejected,false);assert.equal(result.authentication,'basic');assert.equal(modern.authenticated,true,'valid Basic credentials must start the virtual session');
  result=applyTransportPolicy(modern,request('https://lab.example/api/v2/app/version',{headers:{authorization:basic('wrong:wrong')}}));
  assert.equal(result.rejected,false);assert.equal(result.authentication,'existing-session','an established session must take precedence over later Authorization headers');
}

{
  const headers={host:'lab.example','x-forwarded-host':'proxy.example',origin:'https://lab.example'};
  const before={qbVersion:'5.2.1',webApiVersion:'2.15.1'},after={qbVersion:'5.2.2',webApiVersion:'2.15.1'};
  const disabled={web_ui_reverse_proxy_enabled:false},enabled={web_ui_reverse_proxy_enabled:true};
  const probe=request('https://lab.example/api/v2/app/setPreferences',{method:'POST',headers});
  assert.equal(selectTargetHost(before,disabled,probe),'proxy.example','qB 5.2.1 must preserve legacy unconditional X-Forwarded-Host trust');
  assert.equal(isCrossSiteRequest(before,disabled,probe),true,'legacy X-Forwarded-Host trust must affect origin validation');
  assert.equal(selectTargetHost(after,disabled,probe),'lab.example','qB 5.2.2 must ignore X-Forwarded-Host when reverse proxy support is disabled');
  assert.equal(isCrossSiteRequest(after,disabled,probe),false,'qB 5.2.2 host hardening must prevent injected X-Forwarded-Host from changing target origin');
  assert.equal(selectTargetHost(after,enabled,probe),'proxy.example','qB 5.2.2 must still honor X-Forwarded-Host when reverse proxy support is enabled');
}

{
  const sessions=new Map();
  const initialNavigation={clientId:'',replacesClientId:'',resultingClientId:'client-a'};
  rememberSessionForEvent(sessions,initialNavigation,'sim-a');
  assert.equal(sessionForEvent(sessions,{clientId:'client-a'}),'sim-a','initial ?sim= navigation must bind the resulting client');

  const canonicalNavigation={clientId:'client-a',replacesClientId:'client-a',resultingClientId:'client-b'};
  assert.equal(sessionForEvent(sessions,canonicalNavigation),'sim-a','canonical login -> index navigation must inherit the authenticated virtual world');
  rememberSessionForEvent(sessions,canonicalNavigation,'sim-a');
  assert.equal(sessionForEvent(sessions,{clientId:'client-b'}),'sim-a','the resulting canonical client must retain the same virtual world');

  rememberSessionForEvent(sessions,{clientId:'client-b',resultingClientId:'client-c'},'sim-b');
  assert.equal(sessionForEvent(sessions,{clientId:'client-c'}),'sim-b','an explicit new virtual session must override inherited client identity');
  assert.deepEqual(sessionClientIds({clientId:'same',replacesClientId:'same',resultingClientId:'next'}),['same','next'],'client identity list must stay unique and ordered');

  assert.equal(sessionForUrl('https://lab.example/login.html?sim=sim-referrer'),'sim-referrer','same-origin login referrer must expose its explicit virtual world id');
  assert.equal(sessionForUrl('https://lab.example/index.html'),'','URLs without ?sim= must not invent a virtual world id');
  assert.equal(durableSessionUrl('https://lab.example/dev/app/index.html?__weig_handoff=nonce-a','sim-a'),'https://lab.example/dev/app/index.html?__weig_handoff=nonce-a&sim=sim-a','resolved handoff navigation must gain a durable simulator session marker before the one-time nonce is removed');
  assert.equal(durableSessionUrl('https://lab.example/dev/app/index.html?sim=sim-a','sim-a'),'','an explicit simulator session URL must not redirect again');
  assert.equal(durableSessionUrl('https://lab.example/dev/app/index.html','default'),'','the anonymous/default simulator world must not be frozen into a synthetic durable marker');

  const handoffs=new Map(),handoffUrl='https://lab.example/index.html?__weig_handoff=nonce-a',legacyHandoffUrl='https://lab.example/index.html?__weigg_handoff=nonce-b';
  rememberHandoffSession(handoffs,handoffUrl,'sim-a',1000);
  assert.equal(sessionForHandoff(handoffs,handoffUrl,2000),'sim-a','canonical handoff nonce must recover the virtual world before the new client id is known');
  rememberHandoffSession(handoffs,legacyHandoffUrl,'sim-legacy',1000);
  assert.equal(sessionForHandoff(handoffs,legacyHandoffUrl,2000),'sim-legacy','historical main __weigg_handoff nonce must recover its virtual world without rewriting the snapshot');
  assert.equal(sessionForHandoff(handoffs,handoffUrl,122001),'','handoff recovery must expire instead of becoming a second durable session owner');
  assert.equal(sessionForHandoff(handoffs,legacyHandoffUrl,122001),'','legacy handoff recovery must expire under the same bounded owner');

  const pending=new Map(),mainLogin='https://lab.example/main/app/api/v2/auth/login',mainLegacyTarget='https://lab.example/main/app/index.html?__weigg_handoff=nonce-main';
  assert.equal(hasHandoffSessionToken(mainLogin),false,'protected API probes must not be mistaken for handoff navigation and must preserve pending fallback identity');
  assert.equal(hasHandoffSessionToken(mainLegacyTarget),true,'historical and canonical handoff navigation tokens must be recognized by one session-identity owner');
  rememberPendingHandoffSession(pending,mainLogin,'sim-main',1000);
  assert.equal(consumePendingHandoffSession(pending,mainLegacyTarget,2000),'sim-main','historical main login must recover one unambiguous pending virtual world when navigation client/referrer identity is unavailable');
  assert.equal(consumePendingHandoffSession(pending,mainLegacyTarget,2001),'','pending login recovery must be one-shot after ownership transfers to the handoff token');

  const isolated=new Map();
  rememberPendingHandoffSession(isolated,'https://lab.example/dev/app/api/v2/auth/login','sim-dev',1000);
  assert.equal(consumePendingHandoffSession(isolated,mainLegacyTarget,2000),'','pending handoff recovery must never cross branch app roots');
  assert.equal(consumePendingHandoffSession(isolated,'https://lab.example/dev/app/index.html?__weig_handoff=nonce-dev',122001),'','pending handoff recovery must expire under the same bounded age as nonce recovery');

  const ambiguous=new Map(),mainCanonicalTarget='https://lab.example/main/app/index.html?__weig_handoff=nonce-canonical';
  rememberPendingHandoffSession(ambiguous,mainLogin,'sim-one',1000);
  rememberPendingHandoffSession(ambiguous,mainLogin,'sim-two',1001);
  assert.equal(consumePendingHandoffSession(ambiguous,mainCanonicalTarget,2000),'','multiple pending worlds for one app root must fail closed instead of guessing a session');
  assert.equal(forgetPendingHandoffSession(ambiguous,mainCanonicalTarget,'sim-one',2001),true,'a session recovered by stronger client/referrer identity must retire only its own stale pending handoff candidate');
  assert.equal(consumePendingHandoffSession(ambiguous,mainCanonicalTarget,2002),'sim-two','retiring a strongly resolved candidate must preserve the remaining unambiguous pending world');
  assert.equal(forgetPendingHandoffSession(ambiguous,mainCanonicalTarget,'sim-missing',2003),false,'retiring an unrelated session must not mutate the pending handoff owner');
}

{
  const canonical="(function(global){var BASE=new URL('./',global.location.href);function authenticatedEntryUrl(record){var url=new URL('index.html',BASE);if(record&&record.nonce)url.searchParams.set('__weig_handoff',record.nonce);return url;}})(window);";
  const legacy="(function(global){var BASE=new URL('./',global.location.href);function authenticatedEntryUrl(record){var url=new URL('index.html',BASE);if(record&&record.nonce)url.searchParams.set('__weigg_handoff',record.nonce);return url;}})(window);";
  for(const [name,source] of [['canonical',canonical],['legacy',legacy]]){
    const adapted=adaptSessionContractSource(source,'session-contract.js');
    assert.match(adapted,/searchParams\.get\('sim'\)/,name+' SessionContract adapter must preserve the explicit virtual sim id in authenticated navigation');
    assert.match(adapted,/searchParams\.set\('sim',virtualSim\)/,name+' SessionContract adapter must carry sim before the one-time handoff token is consumed');
    assert.equal(adaptSessionContractSource(adapted,'session-contract.js'),adapted,name+' SessionContract adaptation must be idempotent');
  }
  assert.equal(adaptSessionContractSource('var untouched=true;','other.js'),'var untouched=true;','only SessionContract may receive the simulator navigation adapter');
}

const sw=fs.readFileSync(new URL('../simulator/service-worker/service-worker.js',import.meta.url),'utf8');
assert.match(sw,/applyTransportPolicy\(world,event\.request\)/,'Service Worker must run the canonical transport policy before routing WebAPI requests');
assert.match(sw,/if\(transport\.rejected\)/,'Service Worker must enforce transport rejection outcomes');
assert.match(sw,/sessionForEvent\(clientSessions,event\)/,'Service Worker must inherit the virtual world across canonical navigation client replacement');
assert.match(sw,/rememberSessionForEvent\(clientSessions,event,/,'Service Worker must propagate the virtual world to resulting navigation clients');
assert.match(sw,/if\(hasHandoffSessionToken\(url\)\)forgetPendingHandoffSession\(pendingHandoffSessions,url,sessionId\)/,'only a resolved handoff navigation may retire its stale app-root pending fallback candidate; protected API probes must keep the fallback alive until navigation');
assert.match(sw,/rememberHandoffSession\(handoffSessions,url,sessionId\)/,'Service Worker must remember the canonical navigation nonce while its virtual world is known');
assert.match(sw,/sessionForHandoff\(handoffSessions,clientUrl\)/,'post-navigation dynamic assets must recover the virtual world from the client handoff nonce when resulting-client identity is unavailable');
assert.match(sw,/event\?\.request\?\.referrer/,'navigation identity recovery must inspect the initiating request referrer when client ids are unavailable');
assert.match(sw,/referrerUrl\.origin===url\.origin/,'referrer fallback must stay same-origin and never trust an external session identity');
assert.match(sw,/sessionForUrl\(referrerUrl\)\|\|sessionForHandoff\(handoffSessions,referrerUrl\)/,'same-origin referrer must recover either the explicit sim id or a bounded handoff identity before defaulting');
assert.match(sw,/rememberPendingHandoffSession\(pendingHandoffSessions,url,id\)/,'successful virtual auth/login must register one bounded app-root handoff candidate before legacy navigation drops ?sim=');
assert.match(sw,/const pending=consumePendingHandoffSession\(pendingHandoffSessions,url\)/,'handoff navigation must consume the bounded pending login only after direct client and referrer recovery fail');
assert.match(sw,/const durable=durableSessionUrl\(url,id,DEFAULT_SESSION\);[\s\S]*Response\.redirect\(durable,302\)/,'resolved non-default virtual sessions must become URL-durable before one-time handoff cleanup so locale reloads survive Service Worker restart');
assert.match(sw,/adaptSessionContractSource\(original,path\)/,'Virtual Pages must make the login handoff URL carry its explicit sim id before navigation, so a Service Worker restart between login and private entry cannot lose the world identity');
assert.match(sw,/world\.authenticated&&event\.request\.method\.toUpperCase\(\)==='POST'/,'pending handoff ownership must only be seeded by an authenticated POST login response');

console.log('Virtual qB transport contract passed: WebAPI transport semantics plus canonical and historical-main navigation handoff identity stay under explicit bounded Service Worker owners.');

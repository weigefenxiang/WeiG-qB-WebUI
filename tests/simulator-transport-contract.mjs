import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld} from '../simulator/core/engine.js';
import {applyTransportPolicy,isCrossSiteRequest,resolveTransportContract,selectTargetHost} from '../simulator/protocol/transport-contract.js';

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

const sw=fs.readFileSync(new URL('../simulator/service-worker/service-worker.js',import.meta.url),'utf8');
assert.match(sw,/applyTransportPolicy\(world,event\.request\)/,'Service Worker must run the canonical transport policy before routing WebAPI requests');
assert.match(sw,/if\(transport\.rejected\)/,'Service Worker must enforce transport rejection outcomes');

console.log('Virtual qB transport contract passed: WebAPI 2.15.0 Basic auth, qB 5.2.2 X-Forwarded-Host hardening, strict invalid-credential rejection, and Service Worker ownership are canonical.');

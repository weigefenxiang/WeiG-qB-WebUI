import {createWorld} from './__simulator/core/engine.js';
import {networkEnvironmentForSeed} from './__simulator/core/network-profile.js';
import {profileByVersion,BOOTSTRAP_RELEASES} from './__simulator/core/profiles.js';
import {reconcileWorldProfile} from './__simulator/core/world-profile.js';
import {upgradeWorldSchema} from './__simulator/core/world-schema.js';
import {applyScenario} from './__simulator/core/scenarios.js';
import {loadWorld,saveWorld,deleteWorld} from './__simulator/storage/indexeddb.js';
import {createWorldCache} from './__simulator/storage/world-cache.js';
import {handleApi} from './__simulator/protocol/router.js';
import {applyTransportPolicy} from './__simulator/protocol/transport-contract.js';
import {emulateQbtDocument} from './__simulator/qbt-tr-emulator.mjs';
import {adaptSessionContractSource} from './__simulator/core/session-contract-adapter.js';
import {virtualCatalogTermination} from './__simulator/core/catalog-scan-adapter.js';
import {consumePendingHandoffSession,durableSessionUrl,forgetPendingHandoffSession,hasHandoffSessionToken,rememberHandoffSession,rememberPendingHandoffSession,rememberSessionForEvent,sessionClientIds,sessionForEvent,sessionForHandoff,sessionForUrl} from './__simulator/core/session-identity.js';

const WEIG_BUILD_SHA="__WEIG_GIT_SHA__";
const SOURCE_PRIVATE='./__source/private/';
const SOURCE_PUBLIC='./__source/public/';
const LEGACY_CATALOG_URL='./__simulator/versions/catalog.generated.json';
const RUNTIME_PROFILE_BASE='./__simulator/runtime/profiles/';
const RUNTIME_COPY_BASE='./__simulator/runtime/copy/';
const PRIVATE_PREWARM_URL='./__simulator/runtime/private-prewarm.json';
const TRANSLATOR_BEHAVIOR_URL='./__simulator/versions/qb-translator-behavior-lkg.json';
const STATIC_CACHE_PREFIX='weig-virtual-static-';
const STATIC_CACHE=STATIC_CACHE_PREFIX+WEIG_BUILD_SHA;
const DEFAULT_SESSION='default';
const LAB_USERNAME='weigshare';
const LAB_PASSWORD='weigshare';
const LAB_AUTH_POLICY_VERSION=1;
const clientSessions=new Map();
const handoffSessions=new Map();
const pendingHandoffSessions=new Map();
const worlds=createWorldCache({load:loadWorld,save:saveWorld,remove:deleteWorld,maxEntries:6,readPersistMs:30000});
let queue=Promise.resolve();
const catalogPromises=new Map();
let translatorBehaviorPromise=null;
let prewarmManifestPromise=null;

function versionedAssetUrl(relative){
  const target=new URL(relative,self.registration.scope);
  target.searchParams.set('v',WEIG_BUILD_SHA);
  return target.toString();
}

async function immutableFetchUrl(url){
  const cache=await caches.open(STATIC_CACHE),cached=await cache.match(url);
  if(cached)return cached;
  const response=await fetch(url,{cache:'no-store'});
  if(response.ok){try{await cache.put(url,response.clone());}catch(_e){}}
  return response;
}

async function activateRuntime(){
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(STATIC_CACHE_PREFIX)&&key!==STATIC_CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
}

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(activateRuntime()));

function safeProfileKey(value){const key=String(value||'').trim();if(!key||!/^[0-9A-Za-z._-]+$/.test(key))throw new Error(`Unsafe Virtual qB profile key: ${value}`);return key;}

async function loadCatalog(qbVersion){
  const key=safeProfileKey(qbVersion);
  if(catalogPromises.has(key))return catalogPromises.get(key);
  const task=(async()=>{
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await immutableFetchUrl(versionedAssetUrl(RUNTIME_PROFILE_BASE+key+'.json'));
        if(response.ok){
          const profile=await response.json();
          if(profile&&String(profile.qbVersion||'')===key)return[profile];
        }
      }catch(_e){}
    }
    try{
      const response=await immutableFetchUrl(versionedAssetUrl(LEGACY_CATALOG_URL));
      if(response.ok){
        const data=await response.json(),profile=profileByVersion(data,key);
        if(profile)return[profile];
      }
    }catch(_e){}
    const bootstrap=profileByVersion(BOOTSTRAP_RELEASES,key);
    if(bootstrap)return[bootstrap];
    throw new Error(`Exact Virtual qB profile unavailable: ${key}`);
  })();
  catalogPromises.set(key,task);
  try{return await task;}catch(error){catalogPromises.delete(key);throw error;}
}

async function loadTranslatorBehavior(){
  if(translatorBehaviorPromise)return translatorBehaviorPromise;
  translatorBehaviorPromise=(async()=>{
    try{
      const response=await immutableFetchUrl(versionedAssetUrl(TRANSLATOR_BEHAVIOR_URL));
      if(response.ok){
        const data=await response.json();
        if(data?.schemaVersion===1)return data;
      }
    }catch(_e){}
    return null;
  })();
  return translatorBehaviorPromise;
}

async function loadPrivatePrewarmAssets(){
  if(prewarmManifestPromise)return prewarmManifestPromise;
  prewarmManifestPromise=(async()=>{
    try{
      const response=await immutableFetchUrl(versionedAssetUrl(PRIVATE_PREWARM_URL));
      if(response.ok){
        const data=await response.json(),assets=Array.isArray(data?.assets)?data.assets.map(String).filter(Boolean):[];
        return Array.from(new Set(assets));
      }
    }catch(_e){}
    return[];
  })();
  return prewarmManifestPromise;
}

async function fetchCopyProfileShard(world){
  const key=safeProfileKey(world?.profile?.qbVersion);
  try{
    const response=await immutableFetchUrl(versionedAssetUrl(RUNTIME_COPY_BASE+key+'.txt'));
    return response.ok?response:null;
  }catch(_e){return null;}
}

async function prewarmPrivateSource(world){
  const assets=await loadPrivatePrewarmAssets(),items=assets.slice();
  let next=0;
  async function worker(){
    while(next<items.length){
      const path=items[next++];
      try{await immutableFetchUrl(sourceUrl('private',path));}catch(_e){}
    }
  }
  const workers=[];for(let i=0;i<Math.min(6,items.length);i++)workers.push(worker());
  await Promise.all(workers);
  await fetchCopyProfileShard(world);
}

function configFromUrl(url){
  const q=url.searchParams;
  return{
    id:q.get('sim')||DEFAULT_SESSION,
    qb:q.get('qb')||'5.2.3',
    count:Math.max(1,Math.min(20000,Number(q.get('count'))||5000)),
    seed:q.get('seed')||'20260905',
    scenario:q.get('scenario')||'mixed',
    clean:q.get('clean')==='1',
    reset:q.get('reset')==='1'
  };
}

function rememberResolvedSession(event,url,sessionId){
  rememberSessionForEvent(clientSessions,event,sessionId);
  rememberHandoffSession(handoffSessions,url,sessionId);
  if(hasHandoffSessionToken(url))forgetPendingHandoffSession(pendingHandoffSessions,url,sessionId);
}

async function sessionIdForEvent(event,url){
  const direct=sessionForUrl(url);
  if(direct){
    rememberResolvedSession(event,url,direct);
    return direct;
  }
  const inherited=sessionForEvent(clientSessions,event);
  if(inherited){
    rememberResolvedSession(event,url,inherited);
    return inherited;
  }
  for(const clientId of sessionClientIds(event)){
    try{
      const client=await self.clients.get(clientId);
      if(!client)continue;
      const clientUrl=new URL(client.url),fromClient=sessionForUrl(clientUrl);
      if(fromClient){
        rememberResolvedSession(event,url,fromClient);
        return fromClient;
      }
      const fromHandoff=sessionForHandoff(handoffSessions,clientUrl);
      if(fromHandoff){
        rememberResolvedSession(event,url,fromHandoff);
        return fromHandoff;
      }
    }catch(_e){}
  }
  try{
    const rawReferrer=String(event?.request?.referrer||'').trim();
    if(rawReferrer){
      const referrerUrl=new URL(rawReferrer);
      if(referrerUrl.origin===url.origin){
        const fromReferrer=sessionForUrl(referrerUrl)||sessionForHandoff(handoffSessions,referrerUrl);
        if(fromReferrer){
          rememberResolvedSession(event,url,fromReferrer);
          return fromReferrer;
        }
      }
    }
  }catch(_e){}
  const pending=consumePendingHandoffSession(pendingHandoffSessions,url);
  if(pending){
    rememberResolvedSession(event,url,pending);
    return pending;
  }
  return DEFAULT_SESSION;
}

function networkSeedFor(id,seed){return `${String(seed||'20260905')}:${String(id||DEFAULT_SESSION)}`;}

function upgradeNetworkEnvironment(world,id,fallbackSeed){
  if(world.environment?.networkPlan)return false;
  const networkSeed=networkSeedFor(id,world.seed||fallbackSeed);
  const generated=networkEnvironmentForSeed(networkSeed);
  world.environment=world.environment||{};
  world.environment.networkPlan=generated.networkPlan;
  const preserveNetwork=['poor-network','offline'].includes(world.scenario);
  const preserveDisk=['disk-bottleneck','low-space'].includes(world.scenario);
  if(!preserveNetwork){
    world.environment.downCapacity=generated.downCapacity;
    world.environment.upCapacity=generated.upCapacity;
    world.environment.profile=generated.profile;
    world.environment.latencyMs=generated.latencyMs;
    world.environment.jitterMs=generated.jitterMs;
    world.environment.packetLoss=generated.packetLoss;
    world.environment.peerAvailability=generated.peerAvailability;
    delete world.environment.baseDownCapacity;
    delete world.environment.baseUpCapacity;
    delete world.environment.baseLatencyMs;
    delete world.environment.baseJitterMs;
    delete world.environment.basePacketLoss;
    delete world.environment.basePeerAvailability;
    delete world.environment.waveDownCapacity;
    delete world.environment.waveUpCapacity;
  }
  if(!preserveDisk){
    world.environment.diskWriteCapacity=generated.diskWriteCapacity;
    world.environment.diskReadCapacity=generated.diskReadCapacity;
    delete world.environment.baseDiskWriteCapacity;
    delete world.environment.baseDiskReadCapacity;
  }
  world.networkSeed=networkSeed;
  delete world.runtimePolicyBucket;
  return true;
}

function ensureLabAuthPolicy(world){
  if(Number(world.labAuthPolicyVersion)===LAB_AUTH_POLICY_VERSION)return false;
  world.preferences=world.preferences||{};
  world.preferences.web_ui_username=LAB_USERNAME;
  world.authenticationPolicy={acceptAny:false,username:LAB_USERNAME,password:LAB_PASSWORD};
  world.authenticated=false;
  world.virtualSid=null;
  world.labAuthPolicyVersion=LAB_AUTH_POLICY_VERSION;
  return true;
}

async function ensureWorld(event,url){
  const cfg=configFromUrl(url),id=await sessionIdForEvent(event,url);
  if(cfg.reset)await worlds.reset(id);
  let world=cfg.reset?null:await worlds.get(id);
  const requestedVersion=url.searchParams.has('qb')?cfg.qb:(world?.profile?.qbVersion||cfg.qb);
  const catalog=await loadCatalog(requestedVersion);
  if(!world){
    const profile=profileByVersion(catalog,cfg.qb);
    if(!profile||String(profile.qbVersion)!==String(cfg.qb))throw new Error(`Exact Virtual qB profile unavailable: ${cfg.qb}`);
    const networkSeed=networkSeedFor(id,cfg.seed);
    const environment=networkEnvironmentForSeed(networkSeed);
    world=createWorld({profile,count:cfg.count,seed:cfg.seed,scenario:cfg.scenario,environment});
    world.networkSeed=networkSeed;
    applyScenario(world,cfg.scenario);
    world.lab={clean:cfg.clean};
    ensureLabAuthPolicy(world);
    await worlds.seed(id,world,{persist:true});
  }else{
    let changed=false;
    const schemaMigration=upgradeWorldSchema(world,Date.now());
    changed=changed||schemaMigration.changed;
    const migration=reconcileWorldProfile(world,catalog,requestedVersion);
    changed=changed||migration.changed;
    changed=upgradeNetworkEnvironment(world,id,cfg.seed)||changed;
    changed=ensureLabAuthPolicy(world)||changed;
    world.lab=world.lab||{};
    if(url.searchParams.has('clean')&&world.lab.clean!==cfg.clean){world.lab.clean=cfg.clean;changed=true;}
    if(changed)await worlds.touch(id,world,{mutation:true});
  }
  return{id,world};
}

function sourceUrl(kind,path='index.html'){
  const safe=path.replace(/^\/+/, '').replace(/\.\.(?:\/|\\)/g,'');
  return versionedAssetUrl((kind==='public'?SOURCE_PUBLIC:SOURCE_PRIVATE)+safe);
}

function isQbtTextResponse(response,path){
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  return type.startsWith('text/')||/javascript|json|xml/.test(type)||/\.(?:html?|js|mjs|css|txt|svg)$/i.test(path);
}

async function emulateSourceTranslation(response,world,path){
  if(!world||!isQbtTextResponse(response,path))return response;
  const text=await response.clone().text();
  const materializeLanguageOptions=path==='views/preferences.html';
  if(!text.includes('QBT_TR(')&&!(materializeLanguageOptions&&text.includes('${LANGUAGE_OPTIONS}')))return response;
  const [catalog,behaviorEvidence]=await Promise.all([loadCatalog(world.profile?.qbVersion),loadTranslatorBehavior()]);
  const result=emulateQbtDocument(text,{catalog,behaviorEvidence,qbVersion:world.profile?.qbVersion,locale:world.preferences?.locale||'en',materializeLanguageOptions});
  const headers=new Headers();
  const contentType=response.headers.get('content-type');
  if(contentType)headers.set('content-type',contentType);
  headers.set('cache-control','no-store');
  headers.set('x-weig-qbt-emulation',result.mode);
  return new Response(result.text,{status:response.status,statusText:response.statusText,headers});
}

async function fetchSource(kind,path,options={}){
  let response=null;
  if(kind==='private'&&path==='data/qb-settings-native.txt'&&options.world)response=await fetchCopyProfileShard(options.world);
  if(!response)response=await immutableFetchUrl(sourceUrl(kind,path));
  if(!response.ok&&kind==='private')response=await immutableFetchUrl(sourceUrl('public',path));
  if(!response.ok)return response;
  if(path==='session-contract.js'){
    const original=await response.text(),adapted=adaptSessionContractSource(original,path);
    response=new Response(adapted,{status:response.status,statusText:response.statusText,headers:{'content-type':response.headers.get('content-type')||'text/javascript; charset=utf-8','cache-control':'no-store'}});
  }
  if(options.injectLabCredentials&&path==='index.html'){
    let html=await response.text();
    html=html.replace(
      /(<input\s+id="username"[^>]*)(\/>)/,
      (m,a,b)=>a.includes(' value=')?m:`${a} value="${LAB_USERNAME}"${b}`
    ).replace(
      /(<input\s+id="password"[^>]*)(\/>)/,
      (m,a,b)=>a.includes(' value=')?m:`${a} value="${LAB_PASSWORD}"${b}`
    );
    response=new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  return options.world?emulateSourceTranslation(response,options.world,path):response;
}

function relativePath(url){
  const scope=new URL(self.registration.scope);
  let path=url.pathname.slice(scope.pathname.length);
  if(!path||path.endsWith('/'))path+='index.html';
  return path.replace(/^\/+/,'');
}

function handleNavigation(event,url){
  const statePromise=ensureWorld(event,url);
  const responsePromise=statePromise.then(async({id,world})=>{
    if(event.clientId)clientSessions.set(event.clientId,id);
    const durable=durableSessionUrl(url,id,DEFAULT_SESSION);
    if(durable)return Response.redirect(durable,302);
    if(world.authenticated)return fetchSource('private','index.html',{world});
    return fetchSource('public','index.html',{injectLabCredentials:!world.lab?.clean,world});
  });
  event.waitUntil(responsePromise.then(()=>statePromise).then(({world})=>prewarmPrivateSource(world)).catch(()=>{}));
  return responsePromise;
}

async function handleAsset(event,url){
  const {world}=await ensureWorld(event,url);
  const path=relativePath(url);
  if(path==='weig-install.json'){
    return new Response(JSON.stringify({
      version:'virtual-lab',gitSha:'pages-artifact',qbPath:'/virtual',hostPath:'/virtual',simulator:true,
      qbVersion:world.profile.qbVersion,webApiVersion:world.profile.webApiVersion,
      networkPlan:world.environment?.networkPlan||null,networkSeed:world.networkSeed||null
    }),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  }
  return fetchSource(world.authenticated?'private':'public',path,{world});
}

async function handleApiQueued(event,url){
  const {id,world}=await ensureWorld(event,url);
  const transport=applyTransportPolicy(world,event.request);
  if(transport.rejected){
    return new Response(transport.body||'Unauthorized',{status:transport.status||401,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  const boundedCatalog=virtualCatalogTermination(world,event.request,url);
  const response=boundedCatalog
    ?new Response('[]',{status:200,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-weig-virtual-catalog-termination':'qb4-bounded-scan'}})
    :await handleApi(world,event.request,url);
  await worlds.touch(id,world,{mutation:event.request.method.toUpperCase()!=='GET'});
  if(world.authenticated&&event.request.method.toUpperCase()==='POST'&&/\/api\/v2\/auth\/login\/?$/.test(url.pathname))rememberPendingHandoffSession(pendingHandoffSessions,url,id);
  return response;
}

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='weig-sim-reset'){
    event.waitUntil((async()=>{
      const id=String(data.id||DEFAULT_SESSION);
      await worlds.reset(id);
      event.source?.postMessage?.({type:'weig-sim-reset-complete',id});
    })());
  }
  if(data.type==='weig-sim-flush')event.waitUntil(worlds.flush(data.id));
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  const scopePath=new URL(self.registration.scope).pathname;
  if(!url.pathname.startsWith(scopePath))return;

  const rel=relativePath(url);
  if(rel.startsWith('__source/')||rel.startsWith('__simulator/')||rel==='service-worker.js')return;

  if(url.pathname.includes('/api/v2/')){
    const task=()=>handleApiQueued(event,url);
    const responsePromise=queue.then(task,task);
    queue=responsePromise.then(()=>undefined,()=>undefined);
    event.respondWith(responsePromise);
    return;
  }
  if(event.request.mode==='navigate'){
    event.respondWith(handleNavigation(event,url));
    return;
  }
  event.respondWith(handleAsset(event,url));
});
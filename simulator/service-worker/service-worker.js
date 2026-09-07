import {createWorld} from './__simulator/core/engine.js';
import {networkEnvironmentForSeed} from './__simulator/core/network-profile.js';
import {profileByVersion,BOOTSTRAP_RELEASES} from './__simulator/core/profiles.js';
import {reconcileWorldProfile} from './__simulator/core/world-profile.js';
import {applyScenario} from './__simulator/core/scenarios.js';
import {loadWorld,saveWorld,deleteWorld} from './__simulator/storage/indexeddb.js';
import {createWorldCache} from './__simulator/storage/world-cache.js';
import {handleApi} from './__simulator/protocol/router.js';
import {applyTransportPolicy} from './__simulator/protocol/transport-contract.js';

const SOURCE_PRIVATE='./__source/private/';
const SOURCE_PUBLIC='./__source/public/';
const CATALOG_URL='./__simulator/versions/catalog.generated.json';
const DEFAULT_SESSION='default';
const clientSessions=new Map();
const worlds=createWorldCache({load:loadWorld,save:saveWorld,remove:deleteWorld,maxEntries:6,readPersistMs:30000});
let queue=Promise.resolve();
let catalogPromise=null;

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

async function loadCatalog(){
  if(catalogPromise)return catalogPromise;
  catalogPromise=(async()=>{
    try{
      const response=await fetch(CATALOG_URL,{cache:'no-store'});
      if(response.ok){
        const data=await response.json();
        if(Array.isArray(data)&&data.length)return data;
      }
    }catch(_e){}
    return BOOTSTRAP_RELEASES;
  })();
  return catalogPromise;
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

async function sessionIdForEvent(event,url){
  const direct=url.searchParams.get('sim');
  if(direct){
    if(event.clientId)clientSessions.set(event.clientId,direct);
    return direct;
  }
  if(event.clientId&&clientSessions.has(event.clientId))return clientSessions.get(event.clientId);
  if(event.clientId){
    try{
      const client=await self.clients.get(event.clientId);
      if(client){
        const fromClient=new URL(client.url).searchParams.get('sim');
        if(fromClient){clientSessions.set(event.clientId,fromClient);return fromClient;}
      }
    }catch(_e){}
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

async function ensureWorld(event,url){
  const cfg=configFromUrl(url),id=await sessionIdForEvent(event,url);
  if(cfg.reset)await worlds.reset(id);
  let world=cfg.reset?null:await worlds.get(id);
  const catalog=await loadCatalog();
  if(!world){
    const profile=profileByVersion(catalog,cfg.qb);
    const networkSeed=networkSeedFor(id,cfg.seed);
    const environment=networkEnvironmentForSeed(networkSeed);
    world=createWorld({profile,count:cfg.count,seed:cfg.seed,scenario:cfg.scenario,environment});
    world.networkSeed=networkSeed;
    applyScenario(world,cfg.scenario);
    world.lab={clean:cfg.clean};
    await worlds.seed(id,world,{persist:true});
  }else{
    let changed=false;
    const requestedVersion=url.searchParams.has('qb')?cfg.qb:(world.profile?.qbVersion||cfg.qb);
    const migration=reconcileWorldProfile(world,catalog,requestedVersion);
    changed=changed||migration.changed;
    changed=upgradeNetworkEnvironment(world,id,cfg.seed)||changed;
    world.lab=world.lab||{};
    if(url.searchParams.has('clean')&&world.lab.clean!==cfg.clean){world.lab.clean=cfg.clean;changed=true;}
    if(changed)await worlds.touch(id,world,{mutation:true});
  }
  return{id,world};
}

function sourceUrl(kind,path='index.html'){
  const safe=path.replace(/^\/+/,'').replace(/\.\.(?:\/|\\)/g,'');
  return new URL((kind==='public'?SOURCE_PUBLIC:SOURCE_PRIVATE)+safe,self.registration.scope).toString();
}

async function fetchSource(kind,path,options={}){
  const response=await fetch(sourceUrl(kind,path),{cache:'no-store'});
  if(!response.ok)return response;
  if(options.injectDemoCredentials&&path==='index.html'){
    let html=await response.text();
    html=html.replace(
      /(<input\s+id="username"[^>]*)(\/>)/,
      (m,a,b)=>a.includes(' value=')?m:`${a} value="demo"${b}`
    ).replace(
      /(<input\s+id="password"[^>]*)(\/>)/,
      (m,a,b)=>a.includes(' value=')?m:`${a} value="demo"${b}`
    );
    return new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
  }
  return response;
}

function relativePath(url){
  const scope=new URL(self.registration.scope);
  let path=url.pathname.slice(scope.pathname.length);
  if(!path||path.endsWith('/'))path+='index.html';
  return path.replace(/^\/+/,'');
}

async function handleNavigation(event,url){
  const {id,world}=await ensureWorld(event,url);
  if(event.clientId)clientSessions.set(event.clientId,id);
  if(world.authenticated)return fetchSource('private','index.html');
  return fetchSource('public','index.html',{injectDemoCredentials:!world.lab?.clean});
}

async function handleAsset(event,url){
  const {world}=await ensureWorld(event,url);
  const path=relativePath(url);
  if(path==='weigg-install.json'){
    return new Response(JSON.stringify({
      version:'virtual-lab',gitSha:'pages-artifact',qbPath:'/virtual',hostPath:'/virtual',simulator:true,
      qbVersion:world.profile.qbVersion,webApiVersion:world.profile.webApiVersion,
      networkPlan:world.environment?.networkPlan||null,networkSeed:world.networkSeed||null
    }),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  }
  return fetchSource(world.authenticated?'private':'public',path);
}

async function handleApiQueued(event,url){
  const {id,world}=await ensureWorld(event,url);
  const transport=applyTransportPolicy(world,event.request);
  if(transport.rejected){
    return new Response(transport.body||'Unauthorized',{status:transport.status||401,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
  }
  const response=await handleApi(world,event.request,url);
  await worlds.touch(id,world,{mutation:event.request.method.toUpperCase()!=='GET'});
  return response;
}

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='weigg-sim-reset'){
    event.waitUntil((async()=>{
      const id=String(data.id||DEFAULT_SESSION);
      await worlds.reset(id);
      event.source?.postMessage?.({type:'weigg-sim-reset-complete',id});
    })());
  }
  if(data.type==='weigg-sim-flush')event.waitUntil(worlds.flush(data.id));
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
import {createWorld} from './__simulator/core/engine.js';
import {profileByVersion,BOOTSTRAP_RELEASES} from './__simulator/core/profiles.js';
import {loadWorld,saveWorld,deleteWorld} from './__simulator/storage/indexeddb.js';
import {handleApi} from './__simulator/protocol/router.js';

const SOURCE_PRIVATE='./__source/private/';
const SOURCE_PUBLIC='./__source/public/';
const CATALOG_URL='./__simulator/versions/catalog.generated.json';
const DEFAULT_SESSION='default';
const clientSessions=new Map();
let queue=Promise.resolve();

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

async function loadCatalog(){
  try{
    const response=await fetch(CATALOG_URL,{cache:'no-store'});
    if(response.ok){
      const data=await response.json();
      if(Array.isArray(data)&&data.length)return data;
    }
  }catch(_e){}
  return BOOTSTRAP_RELEASES;
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

async function ensureWorld(event,url){
  const cfg=configFromUrl(url),id=await sessionIdForEvent(event,url);
  let world=cfg.reset?null:await loadWorld(id);
  if(!world){
    const catalog=await loadCatalog();
    const profile=profileByVersion(catalog,cfg.qb);
    world=createWorld({profile,count:cfg.count,seed:cfg.seed,scenario:cfg.scenario});
    world.lab={clean:cfg.clean};
    await saveWorld(id,world);
  }else if(cfg.clean!==undefined){
    world.lab=world.lab||{};
    if(url.searchParams.has('clean'))world.lab.clean=cfg.clean;
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
      version:'virtual-lab',
      gitSha:'pages-artifact',
      qbPath:'/virtual',
      hostPath:'/virtual',
      simulator:true,
      qbVersion:world.profile.qbVersion,
      webApiVersion:world.profile.webApiVersion
    }),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
  }
  return fetchSource(world.authenticated?'private':'public',path);
}

async function handleApiQueued(event,url){
  const id=await sessionIdForEvent(event,url);
  let world=await loadWorld(id);
  if(!world){
    const ensured=await ensureWorld(event,url);
    world=ensured.world;
  }
  const response=await handleApi(world,event.request,url);
  await saveWorld(id,world);
  return response;
}

self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='weigg-sim-reset'){
    event.waitUntil((async()=>{
      const id=String(data.id||DEFAULT_SESSION);
      await deleteWorld(id);
      event.source?.postMessage?.({type:'weigg-sim-reset-complete',id});
    })());
  }
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

import {atLeast} from '../core/profiles.js';
import {tryAuthenticate} from '../core/auth-policy.js';

const BASIC_AUTH_MIN_WEB_API='2.15.0';
const X_FORWARDED_HOST_HARDENED_QB='5.2.2';

function header(request,name){return String(request?.headers?.get?.(name)||'').trim();}
function requestHost(request){
  const explicit=header(request,'host');
  if(explicit)return explicit;
  try{return new URL(request.url).host;}catch{return'';}
}
function decodeBasicCredentials(value){
  const match=String(value||'').match(/^Basic\s+(.+)$/i);
  if(!match)return null;
  try{
    const binary=globalThis.atob(match[1].trim());
    const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
    const decoded=new TextDecoder().decode(bytes),separator=decoded.indexOf(':');
    if(separator<0)return null;
    return{username:decoded.slice(0,separator),password:decoded.slice(separator+1)};
  }catch{return null;}
}
function originHost(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  try{return new URL(raw).host;}catch{return null;}
}

export function resolveTransportContract(profile){
  const webApiVersion=String(profile?.webApiVersion||'0');
  const qbVersion=String(profile?.qbVersion||'0');
  return Object.freeze({
    basicAuth:atLeast(webApiVersion,BASIC_AUTH_MIN_WEB_API),
    xForwardedHostPolicy:atLeast(qbVersion,X_FORWARDED_HOST_HARDENED_QB)?'reverse-proxy-only':'always'
  });
}

export function selectTargetHost(profile,preferences,request){
  const contract=resolveTransportContract(profile),host=requestHost(request),forwarded=header(request,'x-forwarded-host');
  if(contract.xForwardedHostPolicy==='reverse-proxy-only'&&!preferences?.web_ui_reverse_proxy_enabled)return host;
  return forwarded||host;
}

export function isCrossSiteRequest(profile,preferences,request){
  const target=selectTargetHost(profile,preferences,request);
  if(!target)return false;
  const origin=originHost(header(request,'origin'));
  if(origin&&origin!==target)return true;
  const referer=originHost(header(request,'referer'));
  return !origin&&!!referer&&referer!==target;
}

export function applyTransportPolicy(world,request,now=Date.now()){
  const contract=resolveTransportContract(world?.profile);
  const targetHost=selectTargetHost(world?.profile,world?.preferences,request);
  if(world?.preferences?.web_ui_csrf_protection_enabled!==false&&isCrossSiteRequest(world?.profile,world?.preferences,request)){
    return{rejected:true,status:401,body:'Unauthorized',targetHost,authentication:'not-attempted'};
  }
  if(world?.authenticated)return{rejected:false,targetHost,authentication:'existing-session'};
  const authorization=header(request,'authorization');
  if(!/^Basic\s/i.test(authorization))return{rejected:false,targetHost,authentication:'not-attempted'};
  if(!contract.basicAuth)return{rejected:false,targetHost,authentication:'unsupported'};
  const credentials=decodeBasicCredentials(authorization);
  if(!credentials)return{rejected:true,status:401,body:'Unauthorized',targetHost,authentication:'invalid'};
  const accepted=tryAuthenticate(world,credentials.username,credentials.password,now);
  return accepted
    ?{rejected:false,targetHost,authentication:'basic'}
    :{rejected:true,status:401,body:'Unauthorized',targetHost,authentication:'invalid'};
}

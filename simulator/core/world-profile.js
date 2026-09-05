import {profileByVersion} from './profiles.js';

function sameList(a,b){
  if(a===b)return true;
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  for(let i=0;i<a.length;i++)if(String(a[i])!==String(b[i]))return false;
  return true;
}

function sameProfile(a,b){
  if(!a||!b)return false;
  return String(a.qbVersion||'')===String(b.qbVersion||'')
    && String(a.webApiVersion||'')===String(b.webApiVersion||'')
    && String(a.tag||'')===String(b.tag||'')
    && String(a.sourceSha||'')===String(b.sourceSha||'')
    && String(a.protocolGeneration||'')===String(b.protocolGeneration||'')
    && (a.stable!==false)===(b.stable!==false)
    && (a.officialWeiGSupport!==false)===(b.officialWeiGSupport!==false)
    && sameList(a.preferenceKeys,b.preferenceKeys)
    && sameList(a.apiActions,b.apiActions);
}

export function reconcileWorldProfile(world,catalog,requestedVersion=null){
  if(!world||typeof world!=='object')return{changed:false,profile:null};
  const version=String(requestedVersion||world.profile?.qbVersion||'').replace(/^v/,'');
  if(!version)return{changed:false,profile:world.profile||null};
  const next=profileByVersion(catalog,version);
  if(!next||String(next.qbVersion)!==version)return{changed:false,profile:world.profile||null};
  if(sameProfile(world.profile,next))return{changed:false,profile:world.profile};
  world.profile=next;
  return{changed:true,profile:next};
}

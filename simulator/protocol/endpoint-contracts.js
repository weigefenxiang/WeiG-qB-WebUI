import {atLeast,compareVersions} from '../core/profiles.js';

const MIN_SUPPORTED_WEB_API='2.0.0';
const MAX_AUDITED_WEB_API='2.15.1';

function normalizePath(path){
  return String(path||'').split(/[?#]/,1)[0].replace(/^\/+/, '').replace(/^api\/v2\//,'');
}

function semanticRevision(profile){
  const webApiVersion=String(profile?.webApiVersion??'').trim();
  if(!/^\d+\.\d+\.\d+$/.test(webApiVersion))return{webApiVersion:webApiVersion||null,classified:false};
  const classified=compareVersions(webApiVersion,MIN_SUPPORTED_WEB_API)>=0
    &&compareVersions(webApiVersion,MAX_AUDITED_WEB_API)<=0;
  return{webApiVersion,classified};
}

function trackerCollectionContract(version,path){
  const batch=atLeast(version,'2.11.9');
  if(path==='torrents/addTrackers')return{
    hashSelection:batch?'multi-or-all':'single',
    allSelector:batch,
    pipeSeparatedHashes:batch,
    ignoreMissingBatchMembers:batch
  };
  return{
    hashSelection:batch?'multi-or-all':'single-or-star-all',
    allSelector:batch,
    legacyStarSelector:true,
    pipeSeparatedHashes:batch,
    ignoreMissingBatchMembers:batch
  };
}

function editCategoryContract(version){
  const modern=atLeast(version,'2.15.1');
  return{
    requiredParameters:['category','savePath'],
    emptyCategoryStatus:400,
    missingResourceStatus:modern?404:409,
    noOp:modern?'success':'conflict'
  };
}

function editTrackerContract(version){
  const modern=atLeast(version,'2.13.0');
  return modern?{
    requiredParameters:['hash','url'],
    mutationParameters:['newUrl','tier'],
    mutationParameterRequirement:'at-least-one',
    trackerUrlParameter:'url',
    tierEdit:true,
    successStatus:204
  }:{
    requiredParameters:['hash','origUrl','newUrl'],
    mutationParameters:['newUrl'],
    mutationParameterRequirement:'required',
    trackerUrlParameter:'origUrl',
    tierEdit:false,
    successStatus:200
  };
}

function mainDataContract(version){
  return{
    categoriesShape:atLeast(version,'2.1.0')?'details-map':'name-list',
    freeSpaceOnDiskField:atLeast(version,'2.1.1'),
    useSubcategoriesField:atLeast(version,'2.9.2')&&!atLeast(version,'2.15.0'),
    useSubcategoriesPreference:'use_subcategories'
  };
}

const RESOLVERS=new Map([
  ['torrents/addTrackers',(version,path)=>trackerCollectionContract(version,path)],
  ['torrents/removeTrackers',(version,path)=>trackerCollectionContract(version,path)],
  ['torrents/trackers',version=>({trackerTimingFields:atLeast(version,'2.13.0')})],
  ['torrents/properties',version=>({availabilityField:atLeast(version,'2.15.1')})],
  ['sync/maindata',version=>mainDataContract(version)],
  ['torrents/editCategory',version=>editCategoryContract(version)],
  ['torrents/editTracker',version=>editTrackerContract(version)]
]);

export function resolveEndpointContract(profile,path){
  const normalizedPath=normalizePath(path);
  const resolve=RESOLVERS.get(normalizedPath);
  if(!resolve)return null;
  const revision=semanticRevision(profile);
  if(!revision.classified)return Object.freeze({
    path:normalizedPath,
    webApiVersion:revision.webApiVersion,
    semanticRevision:'unclassified'
  });
  return Object.freeze({
    path:normalizedPath,
    webApiVersion:revision.webApiVersion,
    semanticRevision:'classified',
    ...resolve(revision.webApiVersion,normalizedPath)
  });
}

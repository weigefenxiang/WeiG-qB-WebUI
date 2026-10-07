import {CANONICAL,deleteTorrents,recordTorrentChanges,schedule} from './engine.js';
import {deterministicUnit,hash32} from './random.js';
import {torrentIndex,torrentsByHashes} from './runtime-index.js';

const MiB=1024*1024;
const PIECE_SIZE=4*MiB;
const SHARE_ACTIONS=new Map([
  ['-1','Default'],['default','Default'],
  ['0','Stop'],['stop','Stop'],
  ['1','Remove'],['remove','Remove'],
  ['2','EnableSuperSeeding'],['enablesuperseeding','EnableSuperSeeding'],
  ['3','RemoveWithContent'],['removewithcontent','RemoveWithContent']
]);
const sharePolicyCandidatesCache=new WeakMap();
const sharePolicyDiagnostics=new WeakMap();

function selected(world,hashes){
  const text=String(hashes||'');
  if(text==='all')return world.torrents||[];
  return torrentsByHashes(world,text).torrents;
}

function torrent(world,hash){return torrentIndex(world).byHash.get(String(hash||''))||null;}
function progressOf(t){return t.size>0?Math.max(0,Math.min(1,Number(t.downloaded||0)/Number(t.size))):0;}
function pieceCount(t){return Math.max(1,Math.ceil(Math.max(1,Number(t.size)||1)/PIECE_SIZE));}

function hex40(seed){
  let out='';
  for(let i=0;i<5;i++)out+=hash32(`${seed}:${i}`).toString(16).padStart(8,'0');
  return out.slice(0,40);
}

function safeRelativePath(value){
  const path=String(value||'').replace(/\\/g,'/').replace(/^\.\//,'').replace(/\/{2,}/g,'/').replace(/\/$/,'');
  if(!path||path.startsWith('/')||path.split('/').some(part=>part==='..'||part==='.'||!part))return'';
  return path;
}

function actionName(value){
  const key=String(value??'Default').trim();
  return SHARE_ACTIONS.get(key)||SHARE_ACTIONS.get(key.toLowerCase())||'Default';
}

function effectiveRatioLimit(t,prefs){
  const raw=Number.isFinite(Number(t.ratioLimit))?Number(t.ratioLimit):-2;
  if(raw===-1)return -1;
  if(raw>=0)return raw;
  return prefs?.max_ratio_enabled&&Number(prefs.max_ratio)>0?Number(prefs.max_ratio):-1;
}

function effectiveSeedingTimeLimit(t,prefs){
  const raw=Number.isFinite(Number(t.seedingTimeLimit))?Number(t.seedingTimeLimit):-2;
  if(raw===-1)return -1;
  if(raw>=0)return raw;
  return prefs?.max_seeding_time_enabled&&Number(prefs.max_seeding_time)>0?Number(prefs.max_seeding_time):-1;
}

function effectiveInactiveSeedingTimeLimit(t,prefs){
  const raw=Number.isFinite(Number(t.inactiveSeedingTimeLimit))?Number(t.inactiveSeedingTimeLimit):-2;
  if(raw===-1)return -1;
  if(raw>=0)return raw;
  return prefs?.max_inactive_seeding_time_enabled&&Number(prefs.max_inactive_seeding_time)>0?Number(prefs.max_inactive_seeding_time):-1;
}

function actionForTorrent(t,prefs){
  const own=actionName(t.shareLimitAction);
  if(own!=='Default')return own;
  return actionName(prefs?.share_limit_action??prefs?.max_ratio_act??'Stop')==='Default'?'Stop':actionName(prefs?.share_limit_action??prefs?.max_ratio_act??'Stop');
}

function ensureShareDefaults(t){
  if(!Number.isFinite(Number(t.ratioLimit)))t.ratioLimit=-2;
  if(!Number.isFinite(Number(t.seedingTimeLimit)))t.seedingTimeLimit=-2;
  if(!Number.isFinite(Number(t.inactiveSeedingTimeLimit)))t.inactiveSeedingTimeLimit=-2;
  if(!t.shareLimitAction)t.shareLimitAction='Default';
  if(typeof t.superSeeding!=='boolean')t.superSeeding=false;
}

function sharePolicyStatsFor(world){
  let stats=sharePolicyDiagnostics.get(world);
  if(!stats){stats={candidateBuilds:0,candidateBuildRows:0,candidateCacheHits:0,torrentsVisited:0};sharePolicyDiagnostics.set(world,stats);}
  return stats;
}

function sharePolicyPreferenceSignature(prefs={}){
  return[
    prefs.max_ratio_enabled?1:0,Number(prefs.max_ratio)||0,
    prefs.max_seeding_time_enabled?1:0,Number(prefs.max_seeding_time)||0,
    prefs.max_inactive_seeding_time_enabled?1:0,Number(prefs.max_inactive_seeding_time)||0
  ].join('|');
}

function thresholdEnabled(raw,globalEnabled,globalLimit){
  const value=Number(raw);
  if(Number.isFinite(value)){
    if(value===-1)return false;
    if(value>=0)return true;
  }
  return !!globalEnabled&&Number(globalLimit)>0;
}

function hasSharePolicyThreshold(t,prefs){
  return thresholdEnabled(t.ratioLimit,prefs?.max_ratio_enabled,prefs?.max_ratio)
    ||thresholdEnabled(t.seedingTimeLimit,prefs?.max_seeding_time_enabled,prefs?.max_seeding_time)
    ||thresholdEnabled(t.inactiveSeedingTimeLimit,prefs?.max_inactive_seeding_time_enabled,prefs?.max_inactive_seeding_time);
}

function sharePolicyCandidates(world){
  const torrents=world.torrents||[],prefs=world.preferences||{},signature=sharePolicyPreferenceSignature(prefs);
  const cached=sharePolicyCandidatesCache.get(world),stats=sharePolicyStatsFor(world);
  if(cached&&cached.source===torrents&&cached.length===torrents.length&&cached.signature===signature){
    stats.candidateCacheHits++;
    return cached.candidates;
  }
  const candidates=[];
  for(const t of torrents)if(!t.shareLimitTriggered&&hasSharePolicyThreshold(t,prefs))candidates.push(t);
  sharePolicyCandidatesCache.set(world,{source:torrents,length:torrents.length,signature,candidates});
  stats.candidateBuilds++;
  stats.candidateBuildRows+=torrents.length;
  return candidates;
}

function invalidateSharePolicyCandidates(world){sharePolicyCandidatesCache.delete(world);}

export function shareLimitPolicyStats(world){
  const stats=sharePolicyStatsFor(world),cached=sharePolicyCandidatesCache.get(world);
  return{...stats,candidateCount:cached?.candidates?.length||0};
}

export function filesForTorrent(world,hash,indexes=null){
  const t=torrent(world,hash);if(!t||!t.has_metadata)return null;
  let files=(t.files||[]).map(file=>({
    ...file,
    progress:Number.isFinite(Number(file.progress))?Number(file.progress):progressOf(t),
    is_seed:!!t.completed,
    availability:Number.isFinite(Number(file.availability))?Number(file.availability):Number((.45+deterministicUnit(world.seed,`${t.hash}:file-availability:${file.index}`)*.55).toFixed(3))
  }));
  if(indexes!=null&&String(indexes)!==''){
    const wanted=new Set(String(indexes).split('|').map(x=>Number(x)).filter(Number.isFinite));
    files=files.filter(file=>wanted.has(Number(file.index)));
  }
  if(!world.profile||!world.profile.webApiVersion)return files;
  const parts=String(world.profile.webApiVersion).split('.').map(x=>Number(x)||0);
  const hasIndexes=parts[0]>2||(parts[0]===2&&(parts[1]>8||(parts[1]===8&&parts[2]>=2)));
  if(!hasIndexes)files=files.map(({index,...file})=>file);
  return files;
}

export function pieceStates(world,hash){
  const t=torrent(world,hash);if(!t||!t.has_metadata)return null;
  const count=pieceCount(t),progress=progressOf(t),complete=Math.floor(progress*count),states=new Array(count).fill(0);
  for(let i=0;i<Math.min(count,complete);i++)states[i]=2;
  if(complete<count&&t.effectiveDownloadRate>0)states[complete]=1;
  return states;
}

export function pieceHashes(world,hash){
  const t=torrent(world,hash);if(!t||!t.has_metadata)return null;
  return Array.from({length:pieceCount(t)},(_,i)=>hex40(`${t.hash}:piece:${i}`));
}

export function renameFile(world,hash,oldPath,newPath){
  const t=torrent(world,hash);if(!t||!t.has_metadata)return false;
  const oldName=safeRelativePath(oldPath),next=safeRelativePath(newPath);if(!oldName||!next)return false;
  const file=(t.files||[]).find(x=>safeRelativePath(x.name)===oldName);if(!file)return false;
  file.name=next;recordTorrentChanges(world,[t.hash],[]);return true;
}

export function renameFolder(world,hash,oldPath,newPath){
  const t=torrent(world,hash);if(!t||!t.has_metadata)return false;
  const oldName=safeRelativePath(oldPath),next=safeRelativePath(newPath);if(!oldName||!next)return false;
  let changed=false;
  for(const file of t.files||[]){
    const name=safeRelativePath(file.name);
    if(name===oldName){file.name=next;changed=true;}
    else if(name.startsWith(`${oldName}/`)){file.name=`${next}/${name.slice(oldName.length+1)}`;changed=true;}
  }
  if(changed)recordTorrentChanges(world,[t.hash],[]);
  return changed;
}

export function setShareLimits(world,hashes,options={}){
  const ratio=Number(options.ratioLimit),seeding=Number(options.seedingTimeLimit),inactive=Number(options.inactiveSeedingTimeLimit);
  const action=actionName(options.shareLimitAction),changed=[];
  for(const t of selected(world,hashes)){
    ensureShareDefaults(t);
    if(Number.isFinite(ratio))t.ratioLimit=ratio;
    if(Number.isFinite(seeding))t.seedingTimeLimit=Math.trunc(seeding);
    if(Number.isFinite(inactive))t.inactiveSeedingTimeLimit=Math.trunc(inactive);
    t.shareLimitAction=action;
    t.shareLimitTriggered=false;
    changed.push(t.hash);
  }
  if(changed.length)invalidateSharePolicyCandidates(world);
  recordTorrentChanges(world,changed,[]);return changed.length;
}

export function setSuperSeeding(world,hashes,value){
  const changed=[];
  for(const t of selected(world,hashes)){
    ensureShareDefaults(t);
    const next=!!value;
    if(t.superSeeding!==next){t.superSeeding=next;changed.push(t.hash);}
  }
  recordTorrentChanges(world,changed,[]);return changed.length;
}

export function shareLimitProjection(world,t){
  ensureShareDefaults(t);
  const prefs=world.preferences||{};
  return{
    super_seeding:!!t.superSeeding,
    ratio_limit:t.ratioLimit,
    seeding_time_limit:t.seedingTimeLimit,
    inactive_seeding_time_limit:t.inactiveSeedingTimeLimit,
    share_limit_action:t.shareLimitAction,
    max_ratio:effectiveRatioLimit(t,prefs),
    max_seeding_time:effectiveSeedingTimeLimit(t,prefs),
    max_inactive_seeding_time:effectiveInactiveSeedingTimeLimit(t,prefs)
  };
}

export function enrichTorrentRows(world,rows){
  const list=Array.isArray(rows)?rows:Object.values(rows||{});
  const byHash=torrentIndex(world).byHash;
  for(const row of list){
    const t=byHash.get(String(row.hash||''));if(!t)continue;
    Object.assign(row,shareLimitProjection(world,t));
  }
  return rows;
}

export function enrichMainData(world,data){
  if(data&&data.torrents)enrichTorrentRows(world,data.torrents);
  return data;
}

export function applyShareLimitPolicies(world,now=Date.now()){
  const prefs=world.preferences||{},changed=[],remove=[],candidates=sharePolicyCandidates(world),stats=sharePolicyStatsFor(world);
  let triggered=0;
  stats.torrentsVisited+=candidates.length;
  for(const t of candidates){
    if(!t.completed)continue;
    ensureShareDefaults(t);
    if(t.effectiveUploadRate>0)t.lastUploadActivity=now;
    else if(!Number.isFinite(Number(t.lastUploadActivity)))t.lastUploadActivity=Math.max(0,Number(t.completionOn)>0?Number(t.completionOn)*1000:now);
    if(t.shareLimitTriggered)continue;
    const ratio=t.downloaded>0?t.uploaded/t.downloaded:0;
    const ratioLimit=effectiveRatioLimit(t,prefs),seedLimit=effectiveSeedingTimeLimit(t,prefs),inactiveLimit=effectiveInactiveSeedingTimeLimit(t,prefs);
    const ratioReached=ratioLimit>=0&&ratio>=ratioLimit;
    const seedReached=seedLimit>=0&&Number(t.seedTime||0)>=seedLimit*60;
    const inactiveMinutes=Math.max(0,(now-Number(t.lastUploadActivity||now))/60000);
    const inactiveReached=inactiveLimit>=0&&inactiveMinutes>=inactiveLimit;
    if(!ratioReached&&!seedReached&&!inactiveReached)continue;
    t.shareLimitTriggered=true;triggered++;
    const action=actionForTorrent(t,prefs);
    if(action==='Remove'||action==='RemoveWithContent')remove.push(t.hash);
    else if(action==='EnableSuperSeeding'){
      if(!t.superSeeding){t.superSeeding=true;changed.push(t.hash);}
    }else{
      t.canonicalState=CANONICAL.SEED_PAUSED;t.effectiveUploadRate=0;changed.push(t.hash);
    }
  }
  if(remove.length)deleteTorrents(world,remove.join('|'),now);
  if(changed.length){
    const scheduled=schedule(world,now,0);
    recordTorrentChanges(world,[...changed,...scheduled.changed],[]);
  }
  if(triggered)invalidateSharePolicyCandidates(world);
  return{changed:changed.length,removed:remove.length};
}
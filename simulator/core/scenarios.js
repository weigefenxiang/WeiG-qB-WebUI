import {CANONICAL,schedule} from './engine.js';

const MiB=1024*1024;

function restoreInitialStates(world){
  for(const t of world.torrents){
    if(t.resumeState)t.canonicalState=t.resumeState;
  }
}

function prioritizeCoverage(world){
  const dlSlots=Math.max(1,Number(world.preferences.max_active_downloads)||8);
  const ulSlots=Math.max(1,Number(world.preferences.max_active_uploads)||24);
  const dlStalledCount=Math.min(2,Math.max(1,Math.floor(dlSlots/4)));
  const ulStalledCount=Math.min(5,Math.max(1,Math.floor(ulSlots/5)));
  const dlStalled=world.torrents.filter(t=>t.resumeState===CANONICAL.DOWNLOAD_STALLED).slice(0,dlStalledCount);
  const dlActive=world.torrents.filter(t=>t.resumeState===CANONICAL.DOWNLOAD_ACTIVE).slice(0,Math.max(1,dlSlots-dlStalled.length));
  const upStalled=world.torrents.filter(t=>t.resumeState===CANONICAL.SEED_STALLED).slice(0,ulStalledCount);
  const upActive=world.torrents.filter(t=>t.resumeState===CANONICAL.SEED_ACTIVE).slice(0,Math.max(1,ulSlots-upStalled.length));
  let pos=-10000;
  for(const t of [...dlStalled,...dlActive,...upStalled,...upActive])t.queuePosition=pos++;
}

function makeDownloadHeavy(world){
  let changed=0;
  for(const t of world.torrents){
    if(changed>=Math.floor(world.torrents.length*.18))break;
    if(!t.completed)continue;
    t.completed=false;t.downloaded=Math.floor(t.size*(.15+(changed%65)/100));t.completionOn=-1;
    t.canonicalState=CANONICAL.DOWNLOAD_QUEUED;t.resumeState=CANONICAL.DOWNLOAD_ACTIVE;
    t.seeders=Math.max(4,t.seeders);t.leechers=Math.max(3,t.leechers);changed++;
  }
  Object.assign(world.preferences,{max_active_downloads:18,max_active_uploads:8,max_active_torrents:24});
}

function makeSeedHeavy(world){
  let changed=0;
  for(const t of world.torrents){
    if(changed>=Math.floor(world.torrents.length*.18))break;
    if(t.completed)continue;
    t.completed=true;t.downloaded=t.size;t.completionOn=Math.floor(world.lastTick/1000)-changed;
    t.canonicalState=CANONICAL.SEED_QUEUED;t.resumeState=CANONICAL.SEED_ACTIVE;
    t.leechers=Math.max(1,t.leechers);changed++;
  }
  Object.assign(world.preferences,{max_active_downloads:4,max_active_uploads:32,max_active_torrents:34});
}

export function applyScenario(world,name='mixed',now=Date.now()){
  const scenario=String(name||'mixed');
  world.scenario=scenario;
  if(!Number.isFinite(world.environment.basePeerAvailability))world.environment.basePeerAvailability=world.environment.peerAvailability;
  restoreInitialStates(world);
  if(scenario==='download-heavy')makeDownloadHeavy(world);
  else if(scenario==='seed-heavy')makeSeedHeavy(world);
  else if(scenario==='queue-stress')Object.assign(world.preferences,{queueing_enabled:true,max_active_downloads:2,max_active_uploads:3,max_active_torrents:5});
  else if(scenario==='poor-network')Object.assign(world.environment,{downCapacity:22*MiB,upCapacity:5*MiB,latencyMs:190,jitterMs:75,packetLoss:.025,trackerFailureRate:.16,peerAvailability:.55,basePeerAvailability:.55});
  else if(scenario==='disk-bottleneck')Object.assign(world.environment,{diskWriteCapacity:18*MiB,diskReadCapacity:30*MiB});
  prioritizeCoverage(world);
  schedule(world,now,0);
  return world;
}

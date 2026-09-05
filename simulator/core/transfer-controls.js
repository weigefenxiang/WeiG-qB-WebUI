import {recordTorrentChanges,schedule} from './engine.js';

export function parseSpeedLimitsMode(value){
  const text=String(value??'').trim();
  if(!/^[+-]?\d+$/.test(text))return null;
  const mode=Number(text);
  return Number.isSafeInteger(mode)?mode:null;
}

export function setVirtualSpeedLimitsMode(world,mode,now=Date.now()){
  world.altSpeedMode=Number(mode)!==0;
  const scheduled=schedule(world,now,0);
  recordTorrentChanges(world,[...scheduled.changed],[]);
  return world.altSpeedMode;
}

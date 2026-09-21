import {deterministicUnit} from './random.js';

const MiB=1024*1024;

export const NETWORK_DOWN_TIERS_MBPS=Object.freeze([100,200,500,600,1000,1500,2000,3000,5000,10000]);
export const NETWORK_TIER_WEIGHTS=Object.freeze([7,10,18,12,25,8,8,5,4,3]);

const RESIDENTIAL_UPLOAD_MBPS=Object.freeze({
  100:20,
  200:30,
  500:50,
  600:60,
  1000:100,
  1500:150,
  2000:200,
  3000:300,
  5000:500,
  10000:1000
});

const SYMMETRIC_CHANCE=Object.freeze({
  100:.04,
  200:.05,
  500:.07,
  600:.08,
  1000:.14,
  1500:.18,
  2000:.22,
  3000:.32,
  5000:.45,
  10000:.60
});

export function mbpsToBytesPerSecond(mbps){
  return Math.max(0,Number(mbps)||0)*1000000/8;
}

function weightedTier(seed){
  const total=NETWORK_TIER_WEIGHTS.reduce((sum,value)=>sum+value,0);
  let roll=deterministicUnit(seed,'network-plan:tier')*total;
  for(let i=0;i<NETWORK_DOWN_TIERS_MBPS.length;i++){
    roll-=NETWORK_TIER_WEIGHTS[i];
    if(roll<0)return NETWORK_DOWN_TIERS_MBPS[i];
  }
  return NETWORK_DOWN_TIERS_MBPS.at(-1);
}

function provisionFactor(seed,direction){
  const magnitude=.05+deterministicUnit(seed,`network-plan:${direction}:magnitude`)*.05;
  const sign=deterministicUnit(seed,`network-plan:${direction}:sign`)<.5?-1:1;
  return 1+sign*magnitude;
}

function roundedMbps(value){return Math.round(value*10)/10;}

export function createNetworkPlan(seed='virtual'){
  const key=String(seed||'virtual');
  const nominalDownMbps=weightedTier(key);
  const symmetric=deterministicUnit(key,'network-plan:class')<(SYMMETRIC_CHANCE[nominalDownMbps]||.1);
  const nominalUpMbps=symmetric?nominalDownMbps:RESIDENTIAL_UPLOAD_MBPS[nominalDownMbps];
  const downFactor=provisionFactor(key,'down');
  const upFactor=provisionFactor(key,'up');
  const provisionedDownMbps=roundedMbps(nominalDownMbps*downFactor);
  const provisionedUpMbps=roundedMbps(nominalUpMbps*upFactor);
  return{
    modelVersion:2,
    class:symmetric?'symmetric':'residential',
    nominalDownMbps,
    nominalUpMbps,
    provisionedDownMbps,
    provisionedUpMbps,
    downProvisionFactor:downFactor,
    upProvisionFactor:upFactor
  };
}

function storageHeadroom(seed,downCapacity,upCapacity){
  const writeFactor=1.12+deterministicUnit(seed,'network-plan:disk-write-headroom')*.28;
  const readFactor=1.2+deterministicUnit(seed,'network-plan:disk-read-headroom')*.35;
  return{
    diskWriteCapacity:Math.max(220*MiB,Math.floor(downCapacity*writeFactor)),
    diskReadCapacity:Math.max(300*MiB,Math.floor(upCapacity*readFactor))
  };
}

function qualityForPlan(seed,plan){
  if(plan.class==='symmetric'){
    return{
      profile:'seedbox',
      latencyMs:3+Math.round(deterministicUnit(seed,'network-plan:latency')*15),
      jitterMs:1+Math.round(deterministicUnit(seed,'network-plan:jitter')*7),
      packetLoss:.0001+deterministicUnit(seed,'network-plan:loss')*.0014,
      peerAvailability:.94+deterministicUnit(seed,'network-plan:peers')*.05
    };
  }
  return{
    profile:'residential',
    latencyMs:10+Math.round(deterministicUnit(seed,'network-plan:latency')*35),
    jitterMs:3+Math.round(deterministicUnit(seed,'network-plan:jitter')*15),
    packetLoss:.0003+deterministicUnit(seed,'network-plan:loss')*.0037,
    peerAvailability:.86+deterministicUnit(seed,'network-plan:peers')*.10
  };
}

export function networkEnvironmentForSeed(seed='virtual'){
  const key=String(seed||'virtual');
  const networkPlan=createNetworkPlan(key);
  const downCapacity=Math.floor(mbpsToBytesPerSecond(networkPlan.provisionedDownMbps));
  const upCapacity=Math.floor(mbpsToBytesPerSecond(networkPlan.provisionedUpMbps));
  return{
    networkPlan,
    downCapacity,
    upCapacity,
    ...storageHeadroom(key,downCapacity,upCapacity),
    ...qualityForPlan(key,networkPlan)
  };
}

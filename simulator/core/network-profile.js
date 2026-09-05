import {deterministicUnit} from './random.js';

export const NETWORK_DOWN_TIERS_MBPS=Object.freeze([100,200,500,600,1000,1500,2000,3000,5000,10000]);

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

export function mbpsToBytesPerSecond(mbps){
  return Math.max(0,Number(mbps)||0)*1000000/8;
}

function provisionFactor(seed,direction){
  const magnitude=.05+deterministicUnit(seed,`network-plan:${direction}:magnitude`)*.05;
  const sign=deterministicUnit(seed,`network-plan:${direction}:sign`)<.5?-1:1;
  return 1+sign*magnitude;
}

function roundedMbps(value){return Math.round(value*10)/10;}

export function createNetworkPlan(seed='virtual'){
  const key=String(seed||'virtual');
  const tierIndex=Math.min(
    NETWORK_DOWN_TIERS_MBPS.length-1,
    Math.floor(deterministicUnit(key,'network-plan:tier')*NETWORK_DOWN_TIERS_MBPS.length)
  );
  const nominalDownMbps=NETWORK_DOWN_TIERS_MBPS[tierIndex];
  const symmetric=deterministicUnit(key,'network-plan:class')<.28;
  const nominalUpMbps=symmetric?nominalDownMbps:RESIDENTIAL_UPLOAD_MBPS[nominalDownMbps];
  const downFactor=provisionFactor(key,'down');
  const upFactor=provisionFactor(key,'up');
  const provisionedDownMbps=roundedMbps(nominalDownMbps*downFactor);
  const provisionedUpMbps=roundedMbps(nominalUpMbps*upFactor);
  return{
    class:symmetric?'symmetric':'residential',
    nominalDownMbps,
    nominalUpMbps,
    provisionedDownMbps,
    provisionedUpMbps,
    downProvisionFactor:downFactor,
    upProvisionFactor:upFactor
  };
}

export function networkEnvironmentForSeed(seed='virtual'){
  const networkPlan=createNetworkPlan(seed);
  return{
    networkPlan,
    downCapacity:Math.floor(mbpsToBytesPerSecond(networkPlan.provisionedDownMbps)),
    upCapacity:Math.floor(mbpsToBytesPerSecond(networkPlan.provisionedUpMbps))
  };
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld} from '../simulator/core/engine.js';
import {applyRuntimePolicies} from '../simulator/core/torrent-actions.js';
import {
  NETWORK_DOWN_TIERS_MBPS,createNetworkPlan,mbpsToBytesPerSecond,networkEnvironmentForSeed
} from '../simulator/core/network-profile.js';

const MiB=1024*1024;
const baseNow=1700000000000;

assert.deepEqual(
  NETWORK_DOWN_TIERS_MBPS,
  [100,200,500,600,1000,1500,2000,3000,5000,10000],
  'network plan must include 100M through 10G tiers, including 3G and 5G'
);

{
  const seenTiers=new Set(),seenClasses=new Set();
  for(let i=0;i<5000;i++){
    const plan=createNetworkPlan(`network-tier-contract-${i}`);
    seenTiers.add(plan.nominalDownMbps);
    seenClasses.add(plan.class);
    assert.ok(NETWORK_DOWN_TIERS_MBPS.includes(plan.nominalDownMbps),'selected tier must come from the supported catalog');
    const downDelta=Math.abs(plan.downProvisionFactor-1);
    const upDelta=Math.abs(plan.upProvisionFactor-1);
    assert.ok(downDelta>=.05&&downDelta<=.1000001,'download provisioning must differ from nominal by 5-10%');
    assert.ok(upDelta>=.05&&upDelta<=.1000001,'upload provisioning must differ from nominal by 5-10%');
    if(plan.class==='symmetric')assert.equal(plan.nominalUpMbps,plan.nominalDownMbps,'symmetric hosts must use equal nominal up/down tiers');
    else assert.ok(plan.nominalUpMbps<plan.nominalDownMbps,'residential hosts must remain realistically asymmetric');
  }
  assert.deepEqual([...seenTiers].sort((a,b)=>a-b),NETWORK_DOWN_TIERS_MBPS,'deterministic seed sweep must be able to reach every supported line tier');
  assert.deepEqual([...seenClasses].sort(),['residential','symmetric'],'network plan must cover residential and symmetric seedbox/VPS classes');
}

{
  const seed='stable-network-plan';
  assert.deepEqual(createNetworkPlan(seed),createNetworkPlan(seed),'same seed must reproduce the exact same nominal and provisioned line');
  assert.deepEqual(networkEnvironmentForSeed(seed),networkEnvironmentForSeed(seed),'same seed must reproduce the exact same capacity environment');
}

{
  let tenGigSeed='';
  for(let i=0;i<10000;i++){
    const seed=`ten-gig-search-${i}`;
    if(createNetworkPlan(seed).nominalDownMbps===10000){tenGigSeed=seed;break;}
  }
  assert.ok(tenGigSeed,'test seed search must find a deterministic 10G profile');
  const env=networkEnvironmentForSeed(tenGigSeed);
  assert.ok(env.downCapacity>1000*1000*1000,'10G provisioned link must expose more than 1 GB/s of physical download capacity');
  assert.ok(env.diskWriteCapacity>env.downCapacity,'default host storage must leave headroom for the selected physical network tier');
  assert.ok(env.diskReadCapacity>env.upCapacity,'default host read path must leave headroom for the selected upload tier');
  assert.equal(env.downCapacity,Math.floor(mbpsToBytesPerSecond(env.networkPlan.provisionedDownMbps)),'environment capacity must use decimal Mbps-to-bytes conversion');
}

{
  const plans=new Set();
  for(let i=0;i<32;i++){
    const plan=createNetworkPlan(`20260905:virtual-session-${i}`);
    plans.add(`${plan.class}:${plan.nominalDownMbps}:${plan.nominalUpMbps}:${plan.provisionedDownMbps}:${plan.provisionedUpMbps}`);
  }
  assert.ok(plans.size>8,'different Virtual qB session ids must produce varied but deterministic network plans even with the same user seed');
}

{
  const networkSeed='runtime-network-wave';
  const environment=networkEnvironmentForSeed(networkSeed);
  const world=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:24,seed:'20260905',now:baseNow,environment});
  world.networkSeed=networkSeed;
  const baseDown=environment.downCapacity,trace=[];
  for(let i=0;i<80;i++){
    applyRuntimePolicies(world,baseNow+i*500);
    trace.push(world.environment.downCapacity);
  }
  assert.ok(new Set(trace).size>20,'physical link must fluctuate smoothly during a session instead of staying fixed');
  assert.ok(Math.max(...trace)<=baseDown*1.031,'normal physical-link overshoot must stay bounded');
  assert.ok(Math.min(...trace)>=baseDown*.879,'physical-link runtime variation must stay within the modeled safety floor');
}

{
  const environment=networkEnvironmentForSeed('qbit-limit-vs-physical-link');
  const world=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:24,seed:'20260905',now:baseNow,environment});
  world.networkSeed='qbit-limit-vs-physical-link';
  world.globalDownloadLimit=140*MiB;
  for(let i=0;i<30;i++){
    applyRuntimePolicies(world,baseNow+i*500);
    assert.ok(world.environment.downCapacity<=140*MiB,'qB global download limit must remain a hard cap distinct from the physical line capacity');
  }
}

{
  const source=fs.readFileSync(new URL('../simulator/service-worker/service-worker.js',import.meta.url),'utf8');
  assert.match(source,/networkEnvironmentForSeed/,'Service Worker must install a generated network environment for real Lab sessions');
  assert.match(source,/networkSeedFor\(id,cfg\.seed\)/,'Lab network randomness must include the Virtual qB session id rather than only the visible user seed');
  assert.match(source,/upgradeNetworkEnvironment/,'persisted pre-network-profile worlds must migrate without requiring users to clear IndexedDB');
}

console.log('Virtual qB network-profile contract passed: 100M-10G tiers, asymmetric/symmetric plans, 5-10% provisioning, session-specific randomness and bounded runtime variation are deterministic.');

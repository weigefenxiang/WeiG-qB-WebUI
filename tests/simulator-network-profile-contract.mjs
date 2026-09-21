import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createWorld,transferInfo} from '../simulator/core/engine.js';
import {applyRuntimePolicies} from '../simulator/core/torrent-actions.js';
import {applyScenario} from '../simulator/core/scenarios.js';
import {
  NETWORK_DOWN_TIERS_MBPS,NETWORK_TIER_WEIGHTS,createNetworkPlan,mbpsToBytesPerSecond,networkEnvironmentForSeed
} from '../simulator/core/network-profile.js';

const MiB=1024*1024;
const baseNow=1700000000000;

assert.deepEqual(
  NETWORK_DOWN_TIERS_MBPS,
  [100,200,500,600,1000,1500,2000,3000,5000,10000],
  'network plan must include 100M through 10G tiers, including 3G and 5G'
);
assert.equal(NETWORK_TIER_WEIGHTS.reduce((sum,value)=>sum+value,0),100,'network tier weights must form a readable 100-point distribution');

{
  const seenTiers=new Set(),seenClasses=new Set(),counts=new Map();
  for(let i=0;i<20000;i++){
    const plan=createNetworkPlan(`network-tier-contract-${i}`);
    seenTiers.add(plan.nominalDownMbps);
    seenClasses.add(plan.class);
    counts.set(plan.nominalDownMbps,(counts.get(plan.nominalDownMbps)||0)+1);
    assert.equal(plan.modelVersion,2,'new network plans must advertise the weighted model generation');
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
  assert.ok((counts.get(1000)||0)>(counts.get(10000)||0)*5,'1G should be substantially more common than 10G in random demo sessions');
  assert.ok((counts.get(500)||0)>(counts.get(5000)||0)*3,'500M should be substantially more common than 5G in random demo sessions');
}

{
  const seed='stable-network-plan';
  assert.deepEqual(createNetworkPlan(seed),createNetworkPlan(seed),'same seed must reproduce the exact same nominal and provisioned line');
  assert.deepEqual(networkEnvironmentForSeed(seed),networkEnvironmentForSeed(seed),'same seed must reproduce the exact same capacity environment');
}

{
  let residentialSeed='',symmetricSeed='';
  for(let i=0;i<10000&&(!residentialSeed||!symmetricSeed);i++){
    const seed=`quality-class-${i}`,plan=createNetworkPlan(seed);
    if(plan.class==='residential'&&!residentialSeed)residentialSeed=seed;
    if(plan.class==='symmetric'&&!symmetricSeed)symmetricSeed=seed;
  }
  const residential=networkEnvironmentForSeed(residentialSeed),symmetric=networkEnvironmentForSeed(symmetricSeed);
  assert.equal(residential.profile,'residential');
  assert.ok(residential.latencyMs>=10&&residential.latencyMs<=45,'residential latency must stay in its modeled range');
  assert.ok(residential.jitterMs>=3&&residential.jitterMs<=18,'residential jitter must stay in its modeled range');
  assert.ok(residential.packetLoss>=.0003&&residential.packetLoss<=.004001,'residential packet loss must stay bounded');
  assert.ok(residential.peerAvailability>=.86&&residential.peerAvailability<=.961,'residential peer availability must stay bounded');
  assert.equal(symmetric.profile,'seedbox');
  assert.ok(symmetric.latencyMs>=3&&symmetric.latencyMs<=18,'symmetric seedbox/VPS latency must stay in its modeled range');
  assert.ok(symmetric.jitterMs>=1&&symmetric.jitterMs<=8,'symmetric seedbox/VPS jitter must stay in its modeled range');
  assert.ok(symmetric.packetLoss>=.0001&&symmetric.packetLoss<=.001501,'symmetric seedbox/VPS packet loss must stay bounded');
  assert.ok(symmetric.peerAvailability>=.94&&symmetric.peerAvailability<=.991,'symmetric seedbox/VPS peer availability must stay bounded');
}

{
  let tenGigSeed='';
  for(let i=0;i<20000;i++){
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
  for(let i=0;i<48;i++){
    const plan=createNetworkPlan(`20260905:virtual-session-${i}`);
    plans.add(`${plan.class}:${plan.nominalDownMbps}:${plan.nominalUpMbps}:${plan.provisionedDownMbps}:${plan.provisionedUpMbps}`);
  }
  assert.ok(plans.size>10,'different Virtual qB session ids must produce varied but deterministic network plans even with the same user seed');
}

{
  const networkSeed='runtime-network-wave';
  const environment=networkEnvironmentForSeed(networkSeed);
  const world=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:120,seed:'20260905',now:baseNow,environment});
  world.networkSeed=networkSeed;
  const baseDown=environment.downCapacity,capacityTrace=[],speedTrace=[];
  for(let i=0;i<80;i++){
    const now=baseNow+i*500;
    applyRuntimePolicies(world,now);
    capacityTrace.push(world.environment.downCapacity);
    speedTrace.push(transferInfo(world,now+1).dl_info_speed);
  }
  assert.ok(new Set(capacityTrace).size>20,'physical link must fluctuate smoothly during a session instead of staying fixed');
  assert.ok(Math.max(...capacityTrace)<=baseDown,'runtime physical capacity must not exceed the provisioned line');
  assert.ok(Math.min(...capacityTrace)>=baseDown*.879,'physical-link runtime variation must stay within the modeled safety floor');
  assert.ok(new Set(speedTrace.filter(value=>value>0)).size>8,'physical capacity changes must propagate into transfer/info rather than remaining environment-only data');
}

{
  const environment=networkEnvironmentForSeed('qbit-limit-vs-physical-link');
  const world=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:120,seed:'20260905',now:baseNow,environment});
  world.networkSeed='qbit-limit-vs-physical-link';
  world.globalDownloadLimit=140*MiB;
  const speeds=[];
  for(let i=0;i<30;i++){
    const now=baseNow+i*500;
    applyRuntimePolicies(world,now);
    assert.ok(world.environment.downCapacity<=140*MiB,'qB global download limit must remain a hard cap distinct from the physical line capacity');
    speeds.push(transferInfo(world,now+1).dl_info_speed);
  }
  assert.ok(speeds.every(value=>value<=140*MiB),'transfer/info must never report aggregate download above the qB hard cap');
  assert.ok(new Set(speeds.filter(value=>value>0)).size>4,'a saturated qB cap should still expose non-flat deterministic transfer samples');
}

{
  const environment=networkEnvironmentForSeed('scenario-compat');
  const poor=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:24,seed:'scenario-compat',now:baseNow,environment});
  applyScenario(poor,'poor-network',baseNow);
  assert.equal(poor.environment.downCapacity,22*MiB,'poor-network scenario must intentionally override the generated physical line');
  assert.equal(poor.environment.upCapacity,5*MiB,'poor-network scenario must intentionally override generated upload capacity');
  const disk=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:24,seed:'scenario-compat-disk',now:baseNow,environment:networkEnvironmentForSeed('scenario-compat-disk')});
  applyScenario(disk,'disk-bottleneck',baseNow);
  assert.equal(disk.environment.diskWriteCapacity,18*MiB,'disk-bottleneck scenario must remain an explicit bottleneck even on multi-gigabit network plans');
}

{
  const source=fs.readFileSync(new URL('../simulator/service-worker/service-worker.js',import.meta.url),'utf8');
  assert.match(source,/networkEnvironmentForSeed/,'Service Worker must install a generated network environment for real Lab sessions');
  assert.match(source,/networkSeedFor\(id,cfg\.seed\)/,'Lab network randomness must include the Virtual qB session id rather than only the visible user seed');
  assert.match(source,/upgradeNetworkEnvironment/,'persisted pre-network-profile worlds must migrate without requiring users to clear IndexedDB');
  assert.match(source,/networkPlan:world\.environment\?\.networkPlan/,'Lab diagnostics must expose the selected network plan without inventing a qBittorrent WebAPI field');
}

console.log('Virtual qB network-profile contract passed: weighted 100M-10G tiers, class-specific quality, 5-10% provisioning, session-specific randomness, scenario overrides and real transfer propagation are deterministic.');

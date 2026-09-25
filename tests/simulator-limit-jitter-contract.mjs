import assert from 'node:assert/strict';
import {createWorld,setPreferences} from '../simulator/core/engine.js';
import {applyRuntimePolicies} from '../simulator/core/torrent-actions.js';

const MiB=1024*1024;
const baseNow=1700000000000;
const downLimit=140*MiB;
const upLimit=40*MiB;

function make(seed='limit-jitter-contract'){
  const world=createWorld({
    profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},
    count:24,
    seed,
    now:baseNow
  });
  setPreferences(world,{queueing_enabled:false,dl_limit:downLimit,up_limit:upLimit},baseNow);
  return world;
}

function sampleTrace(seed,times){
  const world=make(seed);
  const trace=[];
  for(const now of times){
    applyRuntimePolicies(world,now);
    trace.push([world.environment.downCapacity,world.environment.upCapacity]);
  }
  return trace;
}

{
  const times=Array.from({length:81},(_,i)=>baseNow+i*500);
  const first=sampleTrace('repeatable-jitter',times);
  const second=sampleTrace('repeatable-jitter',times);
  assert.deepEqual(first,second,'same seed and clock trace must reproduce identical configured-limit jitter');
  assert.ok(new Set(first.map(([down])=>down)).size>8,'140 MiB/s limit must produce frequent small download-capacity variation');
  assert.ok(new Set(first.map(([,up])=>up)).size>8,'upload limit must produce frequent small capacity variation');
  assert.ok(first.every(([down,up])=>down<=downLimit&&up<=upLimit),'configured qB speed limits must remain hard upper bounds');
  assert.ok(first.some(([down])=>down<downLimit*.90),'normal seeded pacing must visibly traverse at least the requested 5–10% band below the hard cap');
  const downValues=first.map(([down])=>down),span=(Math.max(...downValues)-Math.min(...downValues))/downLimit;
  assert.ok(span>=.05,`short trace must show at least 5% configured-limit variation; observed ${span}`);
}

{
  const startBucket=Math.floor(baseNow/45000);
  const times=Array.from({length:240},(_,i)=>(startBucket+i)*45000+22500);
  const trace=sampleTrace('rare-limit-dip',times);
  const minimum=Math.min(...trace.map(([down])=>down));
  assert.ok(minimum<downLimit*.80,'long deterministic trace must contain an occasional 20%+ download excursion');
  assert.ok(trace.every(([down])=>down<=downLimit),'rare excursions must not violate the configured hard download cap');
}

{
  const world=createWorld({
    profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},
    count:24,
    seed:'unlimited-physical-link',
    now:baseNow
  });
  applyRuntimePolicies(world,baseNow+15000);
  assert.ok(world.environment.downCapacity>140*MiB,'without a qB download limit the seedbox physical network wave must retain substantial high-capacity headroom');
  assert.ok(world.environment.upCapacity>40*MiB,'without a qB upload limit the physical upload wave must retain substantial scenario capacity');
}

{
  const world=make('alternate-limit-jitter');
  world.altSpeedMode=true;
  world.preferences.alt_dl_limit=96*1024;
  world.preferences.alt_up_limit=24*1024;
  applyRuntimePolicies(world,baseNow+5000);
  assert.ok(world.environment.downCapacity<=96*MiB,'alternate download limit must own the jittered hard cap while alternate mode is active');
  assert.ok(world.environment.upCapacity<=24*MiB,'alternate upload limit must own the jittered hard cap while alternate mode is active');
}

console.log('Virtual qB limit-jitter contract passed: seeded 3–30s 5–10% waves plus rare 20–40% excursions remain deterministic and bounded by qB/physical hard caps.');

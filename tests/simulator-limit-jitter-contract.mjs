import assert from 'node:assert/strict';
import {createWorld,effectiveAltSpeedMode,setPreferences} from '../simulator/core/engine.js';
import {applyRuntimePolicies} from '../simulator/core/torrent-actions.js';
import {transferSnapshot} from '../simulator/core/runtime-view.js';

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



{
  const monday0900=new Date(2026,8,21,9,0,0,0).getTime();
  const monday1100=new Date(2026,8,21,11,0,0,0).getTime();
  const world=createWorld({
    profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},
    count:24,
    seed:'scheduled-alt-runtime',
    now:monday0900
  });
  setPreferences(world,{
    scheduler_enabled:true,
    scheduler_days:3,
    schedule_from_hour:8,
    schedule_from_min:30,
    schedule_to_hour:10,
    schedule_to_min:0,
    alt_dl_limit:32*1024,
    alt_up_limit:8*1024
  },monday0900);
  assert.equal(effectiveAltSpeedMode(world,monday0900),true,'Monday schedule must activate alternate limits inside the configured hour/minute window');
  applyRuntimePolicies(world,monday0900);
  assert.ok(world.environment.downCapacity<=32*MiB&&world.environment.upCapacity<=8*MiB,'scheduled alternate limits must own the same bounded runtime capacity path as manual ALT mode');
  assert.equal(effectiveAltSpeedMode(world,monday1100),false,'scheduled alternate limits must deactivate outside the configured window without mutating manual ALT state');
  applyRuntimePolicies(world,monday1100);
  assert.equal(world.altSpeedMode,false,'schedule evaluation must not overwrite the manual alternate-speed toggle owner');
}

function fiveMinuteTransferTrace(seed){
  const world=createWorld({
    profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},
    count:80,
    seed,
    now:baseNow
  });
  setPreferences(world,{queueing_enabled:false},baseNow);
  const raw=[];
  for(let i=1;i<=150;i++){
    const now=baseNow+i*2000;
    applyRuntimePolicies(world,now);
    const snapshot=transferSnapshot(world,now);
    raw.push({t:now,dl:snapshot.dl_info_speed,up:snapshot.up_info_speed});
  }
  const buckets=[];
  for(const sample of raw){
    const index=Math.floor((sample.t-baseNow-1)/15000);
    const row=buckets[index]||(buckets[index]={dl:0,up:0,count:0});
    row.dl+=sample.dl;row.up+=sample.up;row.count++;
  }
  return buckets.filter(Boolean).map(row=>({dl:row.dl/row.count,up:row.up/row.count}));
}
function turningPoints(values){
  let count=0,previous=0;
  for(let i=1;i<values.length;i++){
    const delta=values[i]-values[i-1],sign=delta>0?1:delta<0?-1:0;
    if(sign&&previous&&sign!==previous)count++;
    if(sign)previous=sign;
  }
  return count;
}

{
  const first=fiveMinuteTransferTrace('irregular-transfer-chart');
  const second=fiveMinuteTransferTrace('irregular-transfer-chart');
  assert.deepEqual(first,second,'five-minute virtual transfer trace must be reproducible for the same seed and clock');
  const dl=first.map(row=>row.dl),up=first.map(row=>row.up);
  assert.ok(dl.every(value=>value>0),'five-minute realism trace must retain active download traffic');
  assert.ok(up.some(value=>value>0),'five-minute realism trace must retain active upload traffic');
  assert.ok(turningPoints(dl)>=3,`15-second averaged download trace must retain several non-monotonic turns; got ${turningPoints(dl)}`);
  assert.ok(turningPoints(up)>=3,`15-second averaged upload trace must retain several non-monotonic turns; got ${turningPoints(up)}`);
  const dlSpan=(Math.max(...dl)-Math.min(...dl))/Math.max(...dl);
  const upSpan=(Math.max(...up)-Math.min(...up))/Math.max(...up);
  assert.ok(dlSpan>=.15,`15-second averaged download trace must keep clearly visible bounded variation; got ${dlSpan}`);
  assert.ok(upSpan>=.12,`15-second averaged upload trace must keep clearly visible bounded variation; got ${upSpan}`);
}

console.log('Virtual qB limit-jitter contract passed: seeded 3–30s 5–10% waves plus rare 20–40% excursions remain deterministic and bounded by qB/physical hard caps.');

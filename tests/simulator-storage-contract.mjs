import assert from 'node:assert/strict';
import {createWorldCache} from '../simulator/storage/world-cache.js';

let clock=1000,loads=0,saves=0,removes=0;
const persisted=new Map([['alpha',{value:1}]]);
const cache=createWorldCache({
  load:async id=>{loads++;return persisted.has(id)?structuredClone(persisted.get(id)):null;},
  save:async(id,world)=>{saves++;persisted.set(id,structuredClone(world));},
  remove:async id=>{removes++;persisted.delete(id);},
  maxEntries:2,
  readPersistMs:3000,
  now:()=>clock
});

{
  const a=await cache.get('alpha');assert.equal(a.value,1);
  const again=await cache.get('alpha');assert.equal(again,a,'hot world must stay in memory instead of reloading a 5000-Torrent payload');
  assert.equal(loads,1,'same session must load from IndexedDB only once while resident');

  a.value=2;clock=2000;await cache.touch('alpha',a,{mutation:false});
  assert.equal(saves,0,'routine GET-driven world advancement must not serialize the full world before the persistence interval');
  clock=4100;await cache.touch('alpha',a,{mutation:false});
  assert.equal(saves,1,'dirty read-driven world must checkpoint after the bounded interval');
  assert.equal(persisted.get('alpha').value,2);

  a.value=3;clock=4200;await cache.touch('alpha',a,{mutation:true});
  assert.equal(saves,2,'POST/action mutations must persist immediately');
  assert.equal(persisted.get('alpha').value,3);

  a.value=4;clock=4300;await cache.touch('alpha',a,{mutation:false});
  assert.equal(saves,2,'a fresh GET mutation should remain dirty until checkpoint/eviction');
  await cache.seed('beta',{value:10},{persist:false});
  await cache.seed('gamma',{value:20},{persist:false});
  assert.ok(cache.stats().entries<=2,'resident world cache must stay bounded');
  assert.equal(persisted.get('alpha').value,4,'dirty LRU eviction must checkpoint the evicted session before dropping it');
  assert.equal(saves,3,'dirty LRU eviction must perform exactly one additional persistence write');
}

{
  await cache.seed('reset-me',{value:99},{persist:true});
  const beforeRemove=removes;await cache.reset('reset-me');
  assert.equal(removes,beforeRemove+1,'reset must delete persistent IndexedDB state');
  assert.equal(persisted.has('reset-me'),false);
}

{
  const delta={value:7};await cache.seed('flush-me',delta,{persist:false});delta.value=8;await cache.touch('flush-me',delta,{mutation:false});
  await cache.flush('flush-me');assert.equal(persisted.get('flush-me').value,8,'explicit flush must checkpoint dirty state');
}

console.log('Virtual qB world-cache contract passed: hot reads avoid repeated IndexedDB loads, GET checkpoints are throttled, mutations persist immediately, LRU eviction flushes dirty state and reset/flush remain durable.');

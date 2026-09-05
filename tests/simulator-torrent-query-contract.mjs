import assert from 'node:assert/strict';
import {CANONICAL,createWorld} from '../simulator/core/engine.js';
import {listTorrentsSnapshot} from '../simulator/core/runtime-view.js';

const now=1700000000000;
function make(version,seed=`filters-${version}`){
  return createWorld({profile:{qbVersion:version,webApiVersion:version.startsWith('5.')?'2.15.1':'2.10.4'},count:100,seed,now});
}
function states(world,query){return listTorrentsSnapshot(world,query,now).map(row=>row.hash);}

{
  const world=make('4.6.7');
  const paused=new Set(world.torrents.filter(t=>[CANONICAL.DOWNLOAD_PAUSED,CANONICAL.SEED_PAUSED].includes(t.canonicalState)).map(t=>t.hash));
  const pausedRows=states(world,{filter:'paused'});
  assert.deepEqual(new Set(pausedRows),paused,'qB4 paused filter must match paused DL/UP canonical states');
  assert.equal(states(world,{filter:'resumed'}).length,world.torrents.length-paused.size,'qB4 resumed must be the non-paused complement');
  assert.equal(states(world,{filter:'stopped'}).length,world.torrents.length,'qB4 must treat unknown qB5 stopped filter as All, matching upstream filter parser fallback');
  assert.equal(states(world,{filter:'running'}).length,world.torrents.length,'qB4 must treat unknown qB5 running filter as All');
}

{
  const world=make('5.2.3');
  const stopped=new Set(world.torrents.filter(t=>[CANONICAL.DOWNLOAD_PAUSED,CANONICAL.SEED_PAUSED].includes(t.canonicalState)).map(t=>t.hash));
  assert.deepEqual(new Set(states(world,{filter:'stopped'})),stopped,'qB5 stopped filter must replace paused semantics');
  assert.equal(states(world,{filter:'running'}).length,world.torrents.length-stopped.size,'qB5 running must be the non-stopped complement');
  assert.equal(states(world,{filter:'paused'}).length,world.torrents.length,'qB5 must treat old paused filter as All');
  assert.equal(states(world,{filter:'resumed'}).length,world.torrents.length,'qB5 must treat old resumed filter as All');
}

{
  const world=make('5.2.3','state-filters');
  const checking=world.torrents.filter(t=>t.canonicalState===CANONICAL.CHECKING).map(t=>t.hash);
  const moving=world.torrents.filter(t=>t.canonicalState===CANONICAL.MOVING).map(t=>t.hash);
  const errored=world.torrents.filter(t=>t.canonicalState===CANONICAL.ERROR).map(t=>t.hash);
  assert.deepEqual(states(world,{filter:'checking'}),checking,'checking filter must map canonical checking states');
  assert.deepEqual(states(world,{filter:'moving'}),moving,'moving filter must map canonical moving state');
  assert.deepEqual(states(world,{filter:'errored'}),errored,'errored filter must map canonical error state');
}

{
  const world=make('5.2.3','facet-empty');
  world.torrents[0].category='';
  world.torrents[1].category='';
  world.torrents[0].tags=[];
  world.torrents[2].tags=[];
  const uncategorized=states(world,{category:''});
  const untagged=states(world,{tag:''});
  assert.ok(uncategorized.includes(world.torrents[0].hash)&&uncategorized.includes(world.torrents[1].hash));
  assert.ok(uncategorized.every(hash=>world.torrents.find(t=>t.hash===hash).category===''),'explicit empty qB category must mean uncategorized, not AnyCategory');
  assert.ok(untagged.includes(world.torrents[0].hash)&&untagged.includes(world.torrents[2].hash));
  assert.ok(untagged.every(hash=>world.torrents.find(t=>t.hash===hash).tags.length===0),'explicit empty qB tag must mean untagged, not AnyTag');
}

{
  const world=make('5.2.3','private-filter');
  const privateRows=states(world,{private:'true'}),publicRows=states(world,{private:'false'});
  assert.ok(privateRows.length>0&&publicRows.length>0);
  assert.ok(privateRows.every(hash=>world.torrents.find(t=>t.hash===hash).private===true));
  assert.ok(publicRows.every(hash=>world.torrents.find(t=>t.hash===hash).private===false));
  assert.equal(privateRows.length+publicRows.length,world.torrents.length,'qB5 private=true/false must partition the torrent library');
  const qB4=make('4.6.7','private-qb4');
  assert.equal(states(qB4,{private:'true'}).length,qB4.torrents.length,'qB4 ignores the later private query parameter');
}

{
  const qB4=make('4.6.7','window-qb4');
  const all4=states(qB4,{});
  assert.deepEqual(states(qB4,{offset:-3,limit:3}),all4.slice(-3),'negative qB offset must address from the end');
  assert.deepEqual(states(qB4,{offset:999,limit:2}),all4.slice(0,2),'qB4 out-of-range positive offset historically resets to zero');
  assert.equal(states(qB4,{limit:0}).length,all4.length,'non-positive qB limit means unlimited');

  const qB5=make('5.2.3','window-qb5');
  const all5=states(qB5,{});
  assert.deepEqual(states(qB5,{offset:-3,limit:3}),all5.slice(-3));
  assert.equal(states(qB5,{offset:999,limit:2}).length,0,'qB5 QList mid semantics keep an out-of-range positive offset empty');
}

console.log('Virtual qB torrent query contract passed: qB4 paused/resumed and qB5 stopped/running generations, checking/moving/error, empty facets, private filtering, and historical pagination windows follow upstream semantics.');

import assert from 'node:assert/strict';
import {createWorld,transferInfo,setPreferences} from '../simulator/core/engine.js';
import {applyRuntimePolicies,peerLogItems} from '../simulator/core/torrent-actions.js';
import {applyScenario} from '../simulator/core/scenarios.js';
import {normalizeProfile,profileByVersion} from '../simulator/core/profiles.js';

const MiB=1024*1024;
const baseNow=1700000000000;

{
  const profile=normalizeProfile({
    qbVersion:'5.9.9',webApiVersion:'2.99.0',tag:'release-5.9.9',sourceSha:'abc123',
    preferenceKeys:['max_active_downloads','future_setting'],apiActions:['appcontroller.h:preferencesAction']
  });
  assert.deepEqual(profile.preferenceKeys,['max_active_downloads','future_setting'],'normalized profile must preserve upstream preference facts');
  assert.deepEqual(profile.apiActions,['appcontroller.h:preferencesAction'],'normalized profile must preserve upstream API action facts');
  const selected=profileByVersion([profile],'5.9.9');
  assert.deepEqual(selected.preferenceKeys,profile.preferenceKeys,'profile selection must not discard generated upstream facts');
}

{
  const make=()=>createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:1200,seed:'realism-wave',now:baseNow});
  const a=make(),b=make();
  applyRuntimePolicies(a,baseNow+15000);
  applyRuntimePolicies(b,baseNow+15000);
  assert.equal(a.environment.downCapacity,b.environment.downCapacity,'network wave must be deterministic for the same seed/time bucket');
  assert.equal(a.environment.diskWriteCapacity,b.environment.diskWriteCapacity,'disk wave must be deterministic for the same seed/time bucket');
  assert.equal(a.stats.dht_nodes,b.stats.dht_nodes,'DHT node fluctuation must be deterministic');
  assert.deepEqual(
    a.torrents.slice(0,100).map(t=>[t.seeders,t.leechers,t.trackers?.[0]?.status,t.trackers?.[0]?.msg]),
    b.torrents.slice(0,100).map(t=>[t.seeders,t.leechers,t.trackers?.[0]?.status,t.trackers?.[0]?.msg]),
    'swarm/tracker event projection must be reproducible'
  );
  assert.ok(a.environment.downCapacity<=a.environment.baseDownCapacity,'dynamic network capacity must never exceed its scenario baseline');
  assert.ok(a.environment.diskWriteCapacity<=a.environment.baseDiskWriteCapacity,'dynamic disk capacity must never exceed its scenario baseline');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:800,seed:'discovery-policy',now:baseNow});
  setPreferences(w,{dht:false,pex:false,lsd:false},baseNow);
  applyRuntimePolicies(w,baseNow+15000);
  assert.equal(w.stats.dht_nodes,0,'DHT disabled must expose zero DHT nodes');
  assert.ok(w.environment.peerAvailability<w.environment.basePeerAvailability*.6,'disabling DHT/PeX/LSD must materially reduce peer discovery');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:1000,seed:'tracker-failure',now:baseNow});
  applyScenario(w,'tracker-failure',baseNow);
  applyRuntimePolicies(w,baseNow+15000);
  const failed=w.torrents.flatMap(t=>t.trackers||[]).filter(t=>t.status===4&&t.msg==='Virtual tracker timeout').length;
  assert.ok(failed>0,'tracker-failure scenario must produce observable tracker timeouts');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:500,seed:'low-space',now:baseNow});
  applyScenario(w,'low-space',baseNow);
  w.stats.alltime_dl=80*MiB;
  applyRuntimePolicies(w,baseNow+15000);
  assert.ok(w.environment.freeSpace<=16*MiB,'virtual free space must fall as session downloads accumulate');
  assert.ok(w.torrents.some(t=>t.error==='Virtual disk is full'),'low-space scenario must cause a real torrent error when the virtual disk is exhausted');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:500,seed:'offline',now:baseNow});
  applyScenario(w,'offline',baseNow);
  applyRuntimePolicies(w,baseNow+15000);
  const transfer=transferInfo(w,baseNow+16000);
  assert.equal(transfer.connection_status,'disconnected','offline scenario must expose disconnected transfer state');
  assert.equal(transfer.dl_info_speed,0,'offline scenario must not download');
  assert.equal(transfer.up_info_speed,0,'offline scenario must not upload');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:5000,seed:'peer-events',now:baseNow});
  for(let i=1;i<=8;i++)applyRuntimePolicies(w,baseNow+i*15000);
  assert.ok(peerLogItems(w,-1).length>0,'large virtual worlds must emit bounded deterministic peer connection events over time');
  assert.ok(peerLogItems(w,-1).length<=500,'peer event history must stay bounded');
}

console.log('Virtual qB realism contract passed: upstream profile facts survive normalization and deterministic network/disk/swarm/tracker/DHT/disk-space policies remain bounded and observable.');

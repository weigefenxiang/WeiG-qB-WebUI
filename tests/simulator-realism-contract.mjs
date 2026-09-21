import assert from 'node:assert/strict';
import {
  CANONICAL,addTags,createCategory,createTags,createWorld,deleteTags,listTorrents,mainData,removeCategories,
  setCategory,setForceStart,setPreferences,transferInfo
} from '../simulator/core/engine.js';
import {applyRuntimePolicies,movePriority,peerLogItems,setAutoManagement} from '../simulator/core/torrent-actions.js';
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

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:300,seed:'scenario-queue-rank',now:baseNow});
  applyScenario(w,'mixed',baseNow);
  const priorities=listTorrents(w,{sort:'priority',now:baseNow}).map(x=>x.priority);
  assert.deepEqual(priorities,Array.from({length:300},(_,i)=>i+1),'scenario coverage reordering must normalize back to stable positive queue ranks');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:40,seed:'forced-state',now:baseNow});
  const dl=w.torrents[0],up=w.torrents[1];
  dl.completed=false;dl.canonicalState=CANONICAL.DOWNLOAD_QUEUED;dl.seeders=10;dl.leechers=5;
  up.completed=true;up.downloaded=up.size;up.canonicalState=CANONICAL.SEED_QUEUED;up.leechers=5;
  setForceStart(w,dl.hash,true,baseNow);
  setForceStart(w,up.hash,true,baseNow);
  const views=listTorrents(w,{hashes:`${dl.hash}|${up.hash}`,now:baseNow});
  const dlView=views.find(x=>x.hash===dl.hash),upView=views.find(x=>x.hash===up.hash);
  assert.equal(dlView.state,'forcedDL','forced incomplete torrent must expose qB forcedDL state');
  assert.equal(upView.state,'forcedUP','forced completed torrent must expose qB forcedUP state');
  assert.equal(dlView.force_start,true,'forced state projection must keep force_start truth');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:12,seed:'queue-rank',now:baseNow});
  const target=w.torrents.at(-1);
  movePriority(w,target.hash,'top',baseNow);
  let views=listTorrents(w,{sort:'priority',now:baseNow});
  assert.equal(views[0].hash,target.hash,'top priority must move selected torrent to queue rank 1');
  assert.deepEqual(views.map(x=>x.priority),Array.from({length:12},(_,i)=>i+1),'queue ranks must stay contiguous and positive');
  movePriority(w,target.hash,'bottom',baseNow);
  views=listTorrents(w,{sort:'priority',now:baseNow});
  assert.equal(views.at(-1).hash,target.hash,'bottom priority must move selected torrent to the last positive queue rank');
  movePriority(w,target.hash,'increase',baseNow);
  views=listTorrents(w,{sort:'priority',now:baseNow});
  assert.equal(views.at(-2).hash,target.hash,'increase priority must move a torrent exactly one rank upward');
  movePriority(w,target.hash,'decrease',baseNow);
  views=listTorrents(w,{sort:'priority',now:baseNow});
  assert.equal(views.at(-1).hash,target.hash,'decrease priority must move a torrent exactly one rank downward');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:500,seed:'facet-delta',now:baseNow});
  let snapshot=mainData(w,0,baseNow),rid=snapshot.rid;
  createCategory(w,'Lab','/lab');
  let delta=mainData(w,rid,baseNow);
  assert.equal(delta.full_update,false,'category create must remain a partial sync update');
  assert.equal(delta.categories?.Lab?.savePath,'/lab','category delta must publish the created category');
  assert.equal(Object.keys(delta.torrents||{}).length,0,'category definition changes must not resend the torrent world');
  rid=delta.rid;
  removeCategories(w,'Lab');
  delta=mainData(w,rid,baseNow);
  assert.ok(delta.categories_removed?.includes('Lab'),'category removal must publish categories_removed');
  assert.equal(Object.keys(delta.torrents||{}).length,0,'unused category removal must not resend torrents');
  rid=delta.rid;
  createTags(w,'lab-tag');
  delta=mainData(w,rid,baseNow);
  assert.ok(delta.tags?.includes('lab-tag'),'tag create must publish tags delta');
  assert.equal(Object.keys(delta.torrents||{}).length,0,'tag definition create must not resend torrents');
  rid=delta.rid;
  deleteTags(w,'lab-tag');
  delta=mainData(w,rid,baseNow);
  assert.ok(delta.tags_removed?.includes('lab-tag'),'tag delete must publish tags_removed');
  assert.equal(Object.keys(delta.torrents||{}).length,0,'unused tag removal must not resend torrents');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:500,seed:'facet-affected-only',now:baseNow});
  const a=w.torrents[0],b=w.torrents[1];
  createTags(w,'obsolete');
  addTags(w,`${a.hash}|${b.hash}`,'obsolete');
  let snapshot=mainData(w,0,baseNow),rid=snapshot.rid;
  deleteTags(w,'obsolete');
  const delta=mainData(w,rid,baseNow);
  assert.ok(delta.tags_removed?.includes('obsolete'),'global tag delete must publish tags_removed');
  assert.deepEqual(new Set(Object.keys(delta.torrents||{})),new Set([a.hash,b.hash]),'global tag delete must resend only affected torrents');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:100,seed:'auto-tmm',now:baseNow});
  const t=w.torrents[0];
  createCategory(w,'Managed','/managed-a');
  setCategory(w,t.hash,'Managed');
  setAutoManagement(w,t.hash,true);
  let view=listTorrents(w,{hashes:t.hash,now:baseNow})[0];
  assert.equal(view.auto_tmm,true,'torrent serialization must expose auto_tmm');
  assert.equal(view.save_path,'/managed-a','enabling automatic management must apply the category save path');
  assert.ok(view.content_path.startsWith('/managed-a/'),'managed content path must move with save path');
  createCategory(w,'Managed','/managed-b');
  view=listTorrents(w,{hashes:t.hash,now:baseNow})[0];
  assert.equal(view.save_path,'/managed-b','editing category save path must relocate managed torrents');
  removeCategories(w,'Managed');
  view=listTorrents(w,{hashes:t.hash,now:baseNow})[0];
  assert.equal(view.category,'','removing a category must clear it from affected torrents');
  assert.equal(view.save_path,w.preferences.save_path,'managed torrent must fall back to global save path after category removal');
}

console.log('Virtual qB realism contract passed: upstream profile facts survive normalization; deterministic environment policies remain bounded; forced states, queue ranks, facet deltas and automatic management stay coherent.');

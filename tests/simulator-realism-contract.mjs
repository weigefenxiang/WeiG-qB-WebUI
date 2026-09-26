import assert from 'node:assert/strict';
import {
  CANONICAL,addTags,createCategory,createTags,createWorld,deleteTags,effectiveAltSpeedMode,listTorrents,mainData,removeCategories,
  logs,setCategory,setForceStart,setPreferences,transferInfo,VIRTUAL_PT_CATEGORIES
} from '../simulator/core/engine.js';
import {applyRuntimePolicies,movePriority,peerLogItems,setAutoManagement} from '../simulator/core/torrent-actions.js';
import {applyScenario} from '../simulator/core/scenarios.js';
import {normalizeProfile,profileByVersion} from '../simulator/core/profiles.js';
import {torrentStatusMatches} from '../simulator/core/torrent-query.js';
import {TORRENT_NAME_POOL} from '../simulator/data/torrent-name-pool.js';

const MiB=1024*1024;
const baseNow=1700000000000;

{
  assert.equal(TORRENT_NAME_POOL.length,1000,'simulator name pool must expose exactly 1000 reusable names');
  const nonAscii=TORRENT_NAME_POOL.filter(name=>/[^\x00-\x7F]/.test(name)).length;
  assert.ok(nonAscii>=100,'simulator name pool must retain a meaningful multilingual minority');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:5000,seed:'first-page-coverage',now:baseNow});
  assert.ok(w.torrents.filter(t=>t.canonicalState===CANONICAL.CHECKING).length<=w.preferences.max_active_checking_torrents,'fresh 5000-Torrent world must honor checking concurrency before any action');
  applyScenario(w,'mixed',baseNow);
  assert.ok(w.torrents.filter(t=>t.canonicalState===CANONICAL.CHECKING).length<=w.preferences.max_active_checking_torrents,'scenario restore must not reintroduce excess generated CHECKING state');
  const top=[...w.torrents].sort((a,b)=>b.addedOn-a.addedOn).slice(0,50);
  for(const filter of ['downloading','seeding','completed','stopped','running','active','inactive','stalled','stalled_uploading','stalled_downloading','checking','moving','errored']){
    assert.ok(top.some(t=>torrentStatusMatches(t,filter,w.profile)),`mixed first page must contain a representative torrent for ${filter}`);
  }
  const rows=listTorrents(w,{sort:'added_on',reverse:'true',limit:5000,now:baseNow});
  assert.ok(rows.some(row=>row.trackers_count===0),'virtual catalog must contain trackerless torrents');
  assert.ok(rows.some(row=>row.has_tracker_error),'virtual catalog must contain Tracker error samples');
  assert.ok(rows.some(row=>row.has_other_announce_error),'virtual catalog must contain Other error samples');
  assert.ok(rows.some(row=>row.has_tracker_warning),'virtual catalog must contain Warning samples');
  const privateCategories=new Set(rows.filter(row=>row.private===true).map(row=>row.category));
  for(const category of VIRTUAL_PT_CATEGORIES)assert.ok(privateCategories.has(category),`Private/PT category pool must expose ${category}`);
  assert.ok(rows.some(row=>/[^\x00-\x7F]/.test(row.name)),'5000-torrent world must expose multilingual torrent names');
  assert.deepEqual(new Set(logs(w,-1).map(item=>item.type)),new Set([1,2,4,8]),'initial virtual log history must cover Normal/Info/Warning/Critical');
}

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
  const discoveryOn=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:200,seed:'discovery-components',now:baseNow});
  const discoveryOff=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:200,seed:'discovery-components',now:baseNow});
  setPreferences(discoveryOn,{dht:false,pex:true,lsd:true},baseNow);
  setPreferences(discoveryOff,{dht:false,pex:false,lsd:false},baseNow);
  applyRuntimePolicies(discoveryOn,baseNow+15000);
  applyRuntimePolicies(discoveryOff,baseNow+15000);
  assert.ok(discoveryOn.environment.peerAvailability>discoveryOff.environment.peerAvailability,'PeX/LSD enabled state must materially increase virtual peer discovery availability');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:80,seed:'scheduler-window',now:baseNow});
  const date=new Date(baseNow),start=date.getHours()*60+date.getMinutes(),end=(start+2)%1440;
  setPreferences(w,{
    scheduler_enabled:true,
    schedule_from_hour:Math.floor(start/60),
    schedule_from_min:start%60,
    schedule_to_hour:Math.floor(end/60),
    schedule_to_min:end%60
  },baseNow);
  applyRuntimePolicies(w,baseNow+30000);
  assert.equal(effectiveAltSpeedMode(w,baseNow+30000),true,'enabled scheduler must activate effective alternate speed limits inside its configured time window');
  applyRuntimePolicies(w,baseNow+180000);
  assert.equal(effectiveAltSpeedMode(w,baseNow+180000),false,'enabled scheduler must leave effective alternate speed limits outside its configured time window');
  assert.equal(w.altSpeedMode,false,'scheduled ALT must not overwrite the manual alternate-speed toggle owner');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:1,seed:'encryption-compatibility',now:baseNow});
  const t=w.torrents[0];
  t.completed=false;
  t.canonicalState=CANONICAL.DOWNLOAD_ACTIVE;
  t.resumeState=CANONICAL.DOWNLOAD_ACTIVE;
  t.downloaded=Math.floor(t.size*.5);
  t.seeders=100;
  t.leechers=100;
  w.environment.peerAvailability=1;
  setPreferences(w,{queueing_enabled:false,max_connec:1000,max_connec_per_torrent:1000,encryption:0},baseNow);
  const allow=t.connectedPeers;
  setPreferences(w,{encryption:1},baseNow+1);
  const requireEncrypted=t.connectedPeers;
  setPreferences(w,{encryption:2},baseNow+2);
  const requirePlain=t.connectedPeers;
  assert.ok(allow>requireEncrypted,'allow-encryption mode must retain peers that require either transport mode');
  assert.ok(allow>requirePlain,'allow-encryption mode must retain peers that require either transport mode');
  assert.ok(requireEncrypted>0&&requirePlain>0,'exclusive encryption modes must keep a plausible compatible peer subset');
  assert.notEqual(requireEncrypted,requirePlain,'encrypted/plaintext-only modes must project distinct deterministic peer populations');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:40,seed:'checking-normalization',now:baseNow});
  const forced=w.torrents.slice(0,6);
  for(const t of forced){
    t.canonicalState=CANONICAL.CHECKING;
    t.resumeState=CANONICAL.CHECKING;
    t.checkingUntil=baseNow+60000;
  }
  setPreferences(w,{max_active_checking_torrents:2},baseNow+1);
  const checking=w.torrents.filter(t=>t.canonicalState===CANONICAL.CHECKING);
  assert.equal(checking.length,2,'scheduler must normalize legacy/generated CHECKING population to the configured hard cap');
  assert.ok(forced.slice(2).every(t=>t.canonicalState!==CANONICAL.CHECKING),'excess CHECKING torrents must return to resumable queue state');
  assert.ok(forced.slice(2).every(t=>t.resumeState!==CANONICAL.CHECKING),'normalized baseline must not let a later scenario restore recreate excess CHECKING torrents');
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


{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:12,seed:'duplex-download-upload',now:baseNow});
  for(const t of w.torrents){
    t.canonicalState=CANONICAL.DOWNLOAD_PAUSED;
    t.resumeState=CANONICAL.DOWNLOAD_PAUSED;
    t.completed=false;
    t.effectiveDownloadRate=0;
    t.effectiveUploadRate=0;
    t.connectedPeers=0;
    t.uploadSlots=0;
  }
  const duplex=w.torrents[0],downloadOnly=w.torrents[1];
  for(const t of [duplex,downloadOnly]){
    t.canonicalState=CANONICAL.DOWNLOAD_ACTIVE;
    t.resumeState=CANONICAL.DOWNLOAD_ACTIVE;
    t.downloaded=Math.floor(t.size*.55);
    t.seeders=8;
    t.leechers=8;
    t.naturalDownloadRate=24*MiB;
    t.naturalUploadRate=6*MiB;
  }
  downloadOnly.leechers=0;
  setPreferences(w,{
    queueing_enabled:false,
    max_connec:6,
    max_connec_per_torrent:3,
    max_uploads:2,
    max_uploads_per_torrent:2
  },baseNow);

  assert.ok(duplex.effectiveDownloadRate>0,'an incomplete active Torrent must keep downloading');
  assert.ok(duplex.effectiveUploadRate>0,'an incomplete active Torrent with shareable pieces and interested leechers must upload concurrently');
  assert.equal(downloadOnly.effectiveUploadRate,0,'a downloading Torrent with no interested leechers may legitimately upload 0 B/s');
  assert.ok(w.torrents.reduce((sum,t)=>sum+t.connectedPeers,0)<=6,'global connection limit must remain a hard cap');
  assert.ok(w.torrents.every(t=>t.connectedPeers<=3),'per-Torrent connection limit must remain a hard cap');
  assert.ok(w.torrents.reduce((sum,t)=>sum+t.uploadSlots,0)<=2,'global upload-slot limit must include downloading Torrents');
  assert.ok(w.torrents.every(t=>t.uploadSlots<=2),'per-Torrent upload-slot limit must remain a hard cap');

  const uploadedBefore=duplex.uploaded;
  const transfer=transferInfo(w,baseNow+1000);
  assert.ok(duplex.uploaded>uploadedBefore,'elapsed runtime must account upload bytes while a Torrent is still incomplete');
  assert.ok(transfer.dl_info_speed>0&&transfer.up_info_speed>0,'global transfer projection must expose simultaneous download and upload');
}


{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:40,seed:'mixed-upload-slot-fairness',now:baseNow});
  w.torrents.forEach((t,index)=>{
    t.completed=index>=20;
    t.downloaded=t.completed?t.size:Math.floor(t.size*.6);
    t.canonicalState=t.completed?CANONICAL.SEED_QUEUED:CANONICAL.DOWNLOAD_QUEUED;
    t.resumeState=t.canonicalState;
    t.seeders=12;
    t.leechers=12;
    t.queuePosition=(index%20)+1;
  });
  setPreferences(w,{
    queueing_enabled:true,
    max_active_downloads:5,
    max_active_uploads:5,
    max_active_torrents:10,
    max_connec:40,
    max_connec_per_torrent:4,
    max_uploads:4,
    max_uploads_per_torrent:1
  },baseNow);
  assert.ok(w.torrents.some(t=>!t.completed&&t.effectiveDownloadRate>0&&t.effectiveUploadRate>0),'global upload-slot allocation must not let seeders starve every incomplete active downloader of concurrent upload');
  assert.ok(w.torrents.some(t=>t.completed&&t.effectiveUploadRate>0),'mixed upload-slot allocation must still leave active seeding traffic');
  assert.ok(w.torrents.reduce((sum,t)=>sum+t.uploadSlots,0)<=4,'mixed download/seeding upload-slot allocation must preserve the global hard cap');
}


{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:20,seed:'queue-limit-runtime',now:baseNow});
  w.torrents.forEach((t,index)=>{
    t.completed=index>=10;
    t.downloaded=t.completed?t.size:Math.floor(t.size*.5);
    t.canonicalState=t.completed?CANONICAL.SEED_QUEUED:CANONICAL.DOWNLOAD_QUEUED;
    t.resumeState=t.canonicalState;
    t.seeders=Math.max(8,t.seeders);
    t.leechers=Math.max(8,t.leechers);
    t.queuePosition=index+1;
  });
  setPreferences(w,{
    queueing_enabled:true,
    max_active_downloads:2,
    max_active_uploads:3,
    max_active_torrents:4,
    max_connec:500,
    max_connec_per_torrent:100
  },baseNow);
  const activeDownloads=w.torrents.filter(t=>t.canonicalState===CANONICAL.DOWNLOAD_ACTIVE).length;
  const activeUploads=w.torrents.filter(t=>t.canonicalState===CANONICAL.SEED_ACTIVE).length;
  assert.ok(activeDownloads<=2,'maximum active downloads must remain a hard upper bound');
  assert.ok(activeUploads<=3,'maximum active uploads must remain a hard upper bound');
  assert.ok(activeDownloads+activeUploads<=4,'maximum active Torrents must bound the unique active queue population');
}


{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:32,seed:'queue-target-fill-runtime',now:baseNow});
  w.torrents.forEach((t,index)=>{
    t.completed=index>=16;
    t.downloaded=t.completed?t.size:Math.floor(t.size*.5);
    t.canonicalState=t.completed?CANONICAL.SEED_QUEUED:CANONICAL.DOWNLOAD_QUEUED;
    t.resumeState=t.canonicalState;
    t.seeders=index<2?0:12;
    t.leechers=index>=16&&index<18?0:12;
    t.queuePosition=index+1;
  });
  setPreferences(w,{
    queueing_enabled:true,
    max_active_downloads:8,
    max_active_uploads:8,
    max_active_torrents:16,
    max_connec:64,
    max_connec_per_torrent:4,
    max_uploads:32,
    max_uploads_per_torrent:2
  },baseNow);
  assert.equal(w.torrents.filter(t=>t.effectiveDownloadRate>0).length,8,'eligible downloads later in the queue must backfill zero-peer entries until the configured active target is met');
  assert.equal(w.torrents.filter(t=>t.completed&&t.effectiveUploadRate>0).length,8,'eligible seeders later in the queue must backfill zero-peer entries until the configured upload target is met');

  setPreferences(w,{max_connec:3,max_connec_per_torrent:1,max_uploads:2,max_uploads_per_torrent:1},baseNow+1);
  assert.ok(w.torrents.filter(t=>t.effectiveDownloadRate>0||t.effectiveUploadRate>0).length<=3,'global connection capacity must bound the number of concurrently transferring Torrents when each needs a peer');
  assert.ok(w.torrents.filter(t=>t.effectiveUploadRate>0).length<=2,'global upload slots must remain a tighter bound than queue upload targets');
  assert.ok(w.torrents.every(t=>t.connectedPeers<=1),'per-Torrent connection limit must remain a hard cap');
  assert.ok(w.torrents.every(t=>t.uploadSlots<=1),'per-Torrent upload slot limit must remain a hard cap');

  setPreferences(w,{max_connec:0,max_uploads:0},baseNow+2);
  assert.equal(w.torrents.filter(t=>t.effectiveDownloadRate>0||t.effectiveUploadRate>0).length,0,'zero global connections must mean zero, not unlimited');
  assert.equal(w.torrents.reduce((sum,t)=>sum+t.uploadSlots,0),0,'zero global upload slots must mean zero, not unlimited');
}

console.log('Virtual qB realism contract passed: upstream profile facts survive normalization; deterministic environment policies remain bounded; forced states, queue ranks, facet deltas and automatic management stay coherent.');

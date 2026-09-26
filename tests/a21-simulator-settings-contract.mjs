import assert from 'node:assert/strict';
import {CANONICAL,createWorld,schedule,setPreferences} from '../simulator/core/engine.js';
import {applyShareLimitPolicies} from '../simulator/core/torrent-content.js';

const now=1700000000000;
const activeDownload=w=>w.torrents.filter(t=>!t.completed&&t.canonicalState===CANONICAL.DOWNLOAD_ACTIVE);

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:20,seed:'a21-slow-queue',now});
  for(const t of w.torrents){if(!t.completed){t.canonicalState=CANONICAL.DOWNLOAD_QUEUED;t.slowTorrentSince=0;t.queueSlow=false;}}
  const first=w.torrents.find(t=>!t.completed);assert.ok(first);
  first.canonicalState=CANONICAL.DOWNLOAD_ACTIVE;
  first.effectiveDownloadRate=512;
  first.effectiveUploadRate=0;
  first.slowTorrentSince=now-61000;
  first.naturalDownloadRate=512;
  first.naturalUploadRate=128;
  setPreferences(w,{queueing_enabled:true,max_active_downloads:1,max_active_torrents:1,dont_count_slow_torrents:true,slow_torrent_dl_rate_threshold:2,slow_torrent_ul_rate_threshold:2,slow_torrent_inactive_timer:60},now);
  schedule(w,now,0);
  assert.equal(first.queueSlow,true,'an active torrent below both thresholds for the inactivity window must become queue-slow');
  assert.ok(activeDownload(w).length>=2,'a queue-slow download must not consume the max-active download/total slot when exclusion is enabled');
  setPreferences(w,{dont_count_slow_torrents:false},now+1);
  schedule(w,now+1,0);
  assert.ok(activeDownload(w).length<=1,'disabling slow-torrent exclusion must immediately restore normal queue caps');
  setPreferences(w,{max_active_downloads:-1,max_active_torrents:-1},now+2);
  schedule(w,now+2,0);
  assert.ok(activeDownload(w).length>1,'qB -1 active queue limits must retain unlimited sentinel semantics');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:30,seed:'a21-share-action',now});
  const t=w.torrents.find(x=>x.completed);assert.ok(t);
  t.downloaded=t.size;t.uploaded=t.size;t.canonicalState=CANONICAL.SEED_ACTIVE;t.shareLimitTriggered=false;
  setPreferences(w,{max_ratio_enabled:true,max_ratio:.5,max_seeding_time_enabled:false,max_inactive_seeding_time_enabled:false,max_ratio_act:2},now);
  schedule(w,now,0);
  assert.notEqual(t.canonicalState,CANONICAL.SEED_PAUSED,'scheduler must not retain a duplicate Stop-only global share-limit owner');
  applyShareLimitPolicies(w,now+1);
  assert.equal(t.superSeeding,true,'global qB action 2 must enable super-seeding through the canonical share-limit owner');
  assert.notEqual(t.canonicalState,CANONICAL.SEED_PAUSED,'EnableSuperSeeding must not be pre-empted by a duplicate Stop owner');
}

{
  const w=createWorld({profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1'},count:30,seed:'a21-inactive-seed',now});
  const t=w.torrents.find(x=>x.completed);assert.ok(t);
  t.canonicalState=CANONICAL.SEED_STALLED;t.effectiveUploadRate=0;t.lastUploadActivity=now-2*60000;t.shareLimitTriggered=false;
  t.ratioLimit=-2;t.seedingTimeLimit=-2;t.inactiveSeedingTimeLimit=-2;
  setPreferences(w,{max_ratio_enabled:false,max_seeding_time_enabled:false,max_inactive_seeding_time_enabled:true,max_inactive_seeding_time:1,max_ratio_act:0},now);
  applyShareLimitPolicies(w,now);
  assert.equal(t.canonicalState,CANONICAL.SEED_PAUSED,'global inactive seeding limit must stop an inactive seed when action 0 is selected');
}
console.log('A21 B3 virtual Settings runtime contract passed.');

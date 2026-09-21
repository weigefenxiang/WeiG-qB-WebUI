import assert from 'node:assert/strict';
import {authenticate,CANONICAL,createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';

function makeWorld(profile,seed='add-transfer'){
  const w=createWorld({
    profile,
    count:120,
    seed,
    now:Date.now(),
    preferences:{queueing_enabled:false,alt_dl_limit:32,alt_up_limit:16},
    environment:{online:true,downCapacity:512*1024*1024,upCapacity:256*1024*1024,diskWriteCapacity:512*1024*1024,diskReadCapacity:512*1024*1024,peerAvailability:1}
  });
  authenticate(w,'demo','demo');return w;
}
function get(path){return new Request(`https://example.invalid/api/v2/${path}`);}
function post(path,body={}){return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});}
function postForm(path,form){return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',body:form});}

const modern=makeWorld({qbVersion:'5.2.3',webApiVersion:'2.15.1',stable:true});
const anchor=modern.torrents[0];anchor.completed=false;anchor.downloaded=0;anchor.canonicalState=CANONICAL.DOWNLOAD_QUEUED;anchor.seeders=50;anchor.leechers=50;anchor.naturalDownloadRate=8*1024*1024;

{
  const normal=await (await handleApi(modern,get('transfer/info'))).json();
  assert.ok(normal.dl_info_speed>32*1024,'normal mode should exceed the deliberately tiny alternate cap in this deterministic world');

  let r=await handleApi(modern,post('transfer/setSpeedLimitsMode',{}));
  assert.equal(r.status,400,'setSpeedLimitsMode must require a parseable mode');
  r=await handleApi(modern,post('transfer/setSpeedLimitsMode',{mode:'not-an-int'}));
  assert.equal(r.status,400,'setSpeedLimitsMode must reject invalid integer syntax');

  r=await handleApi(modern,post('transfer/setSpeedLimitsMode',{mode:'1'}));assert.equal(r.status,200);
  assert.equal(modern.altSpeedMode,true);
  const alternate=await (await handleApi(modern,get('transfer/info'))).json();
  assert.ok(alternate.dl_info_speed<=32*1024,'alternate download cap must constrain the live scheduler');
  assert.ok(alternate.up_info_speed<=16*1024,'alternate upload cap must constrain the live scheduler');

  r=await handleApi(modern,post('transfer/setSpeedLimitsMode',{mode:'0'}));assert.equal(r.status,200);assert.equal(modern.altSpeedMode,false);
  r=await handleApi(modern,post('transfer/setSpeedLimitsMode',{mode:'-2'}));assert.equal(r.status,200);assert.equal(modern.altSpeedMode,true,'any nonzero upstream mode selects alternate limits');
  await handleApi(modern,post('transfer/setSpeedLimitsMode',{mode:'0'}));
}

{
  const before=modern.torrents.length,form=new FormData();
  form.append('urls','magnet:?xt=urn:btih:1111111111111111111111111111111111111111&dn=Batch-One\nmagnet:?xt=urn:btih:2222222222222222222222222222222222222222&dn=Batch-Two');
  form.append('torrents',new File(['virtual-one'],'upload-one.torrent',{type:'application/x-bittorrent'}));
  form.append('torrents',new File(['virtual-two'],'upload-two.torrent',{type:'application/x-bittorrent'}));
  form.append('savepath','/virtual/add');
  form.append('downloadPath','/virtual/incomplete');
  form.append('useDownloadPath','true');
  form.append('category','Linux');
  form.append('tags','batch, lab');
  form.append('sequentialDownload','true');
  form.append('firstLastPiecePrio','true');
  form.append('forced','true');
  form.append('addToTopOfQueue','true');
  form.append('stopped','false');
  form.append('dlLimit','131072');
  form.append('upLimit','65536');
  form.append('ratioLimit','1.5');
  form.append('seedingTimeLimit','5');
  form.append('inactiveSeedingTimeLimit','2');
  form.append('shareLimitAction','0');
  form.append('autoTMM','false');
  form.append('contentLayout','NoSubfolder');
  form.append('filePriorities','1,0,7');
  form.append('ssl_certificate','virtual-cert');
  form.append('ssl_private_key','virtual-key');
  form.append('ssl_dh_params','virtual-dh');

  const r=await handleApi(modern,postForm('torrents/add',form));
  assert.equal(r.status,200);
  const body=await r.json();
  assert.equal(body.success_count,4,'two magnets plus two uploaded files must create four virtual torrents');
  assert.equal(body.failure_count,0);assert.equal(body.pending_count,0);
  assert.equal(body.added_torrent_ids.length,4,'structured add must return every added torrent id');
  assert.equal(modern.torrents.length,before+4);

  const added=body.added_torrent_ids.map(hash=>modern.torrents.find(t=>t.hash===hash));
  assert.ok(added.every(Boolean));
  assert.deepEqual(added.map(t=>t.queuePosition).sort((a,b)=>a-b),[1,2,3,4],'addToTopOfQueue must move the whole batch to the front');
  for(const t of added){
    assert.equal(t.savePath,'/virtual/add');assert.equal(t.downloadPath,'/virtual/incomplete');assert.equal(t.useDownloadPath,true);
    assert.equal(t.category,'Linux');assert.ok(t.tags.includes('batch')&&t.tags.includes('lab'));
    assert.equal(t.forceStart,true);assert.equal(t.sequential,true);assert.equal(t.firstLastPriority,true);
    assert.equal(t.downloadLimit,131072);assert.equal(t.uploadLimit,65536);
    assert.equal(t.ratioLimit,1.5);assert.equal(t.seedingTimeLimit,5);assert.equal(t.inactiveSeedingTimeLimit,2);assert.equal(t.shareLimitAction,'Stop');
    assert.equal(t.contentLayout,'NoSubfolder');assert.equal(t.contentPath,'/virtual/add');
    assert.deepEqual(t.files.map(file=>file.priority),[1,0,7]);
    assert.deepEqual(t.sslParameters,{certificate:'virtual-cert',privateKey:'virtual-key',dhParams:'virtual-dh'});
    assert.notEqual(t.canonicalState,CANONICAL.DOWNLOAD_QUEUED,'force-started additions must bypass ordinary queue slots');
    assert.ok(t.effectiveDownloadRate<=131072,'per-torrent download limit must be active immediately after add');
  }

  const rows=await (await handleApi(modern,get(`torrents/info?hashes=${body.added_torrent_ids.join('|')}`))).json();
  assert.equal(rows.length,4);assert.ok(rows.every(row=>row.ratio_limit===1.5&&row.share_limit_action==='Stop'));
  const props=await (await handleApi(modern,get(`torrents/properties?hash=${body.added_torrent_ids[0]}`))).json();
  assert.equal(props.download_path,'/virtual/incomplete','downloadPath must be observable through qB properties');
}

{
  const w=makeWorld({qbVersion:'5.2.3',webApiVersion:'2.15.1',stable:true},'add-result-status'),before=w.torrents.length,form=new FormData();
  form.append('urls','magnet:?xt=urn:btih:7777777777777777777777777777777777777777&dn=Immediate\nhttps://downloads.example.invalid/pending.torrent\nnot-a-valid-torrent-source');
  const r=await handleApi(w,postForm('torrents/add',form));
  assert.equal(r.status,202,'WebAPI 2.14+ add must return Accepted when any URL fetch remains pending');
  const body=await r.json();
  assert.deepEqual({success:body.success_count,pending:body.pending_count,failure:body.failure_count},{success:1,pending:1,failure:1});
  assert.equal(body.added_torrent_ids.length,1,'only immediate successes belong in added_torrent_ids');
  assert.equal(w.torrents.length,before+1,'pending and failed remote sources must not fabricate immediate torrents');
}

{
  const w=makeWorld({qbVersion:'5.2.3',webApiVersion:'2.15.1',stable:true},'add-all-failed'),before=w.torrents.length,form=new FormData();
  form.append('urls','not-a-valid-torrent-source');
  const r=await handleApi(w,postForm('torrents/add',form));
  assert.equal(r.status,409,'WebAPI 2.14+ add must return Conflict when every source fails');
  assert.equal(w.torrents.length,before,'all-failed add must not create a virtual torrent');
}

{
  const form=new FormData();
  form.append('urls','magnet:?xt=urn:btih:3333333333333333333333333333333333333333&dn=Pause-Me');
  form.append('rename','Paused Add');form.append('stopped','true');form.append('forced','true');form.append('contentLayout','Subfolder');
  const r=await handleApi(modern,postForm('torrents/add',form)),body=await r.json(),hash=body.added_torrent_ids[0];
  const t=modern.torrents.find(item=>item.hash===hash);
  assert.equal(t.name,'Paused Add');assert.equal(t.canonicalState,CANONICAL.DOWNLOAD_PAUSED);
  const rows=await (await handleApi(modern,get(`torrents/info?hashes=${hash}`))).json();
  assert.equal(rows[0].state,'stoppedDL','qB5 stopped add must project as stoppedDL even when forced=true');
}

{
  const form=new FormData();
  form.append('urls','magnet:?xt=urn:btih:4444444444444444444444444444444444444444&dn=Check-Me');
  form.append('stopCondition','FilesChecked');
  const r=await handleApi(modern,postForm('torrents/add',form)),body=await r.json(),t=modern.torrents.find(item=>item.hash===body.added_torrent_ids[0]);
  assert.equal(t.canonicalState,CANONICAL.CHECKING,'FilesChecked stop condition must enter checking');
  assert.equal(t.maintenanceResumeState,CANONICAL.DOWNLOAD_PAUSED,'FilesChecked must stop after the synthetic check completes');
  assert.ok(t.checkingUntil>Date.now());
}

{
  const before=modern.torrents.length,form=new FormData();
  const r=await handleApi(modern,postForm('torrents/add',form)),body=await r.json();
  assert.equal(r.status,200);assert.equal(body.success_count,1,'Virtual Lab keeps the product requirement that an empty add still succeeds synthetically');
  assert.equal(modern.torrents.length,before+1);
}

const legacy=makeWorld({qbVersion:'4.6.7',webApiVersion:'2.8.4',stable:true},'legacy-add-transfer');
{
  let r=await handleApi(legacy,post('transfer/setSpeedLimitsMode',{mode:'1'}));
  assert.equal(r.status,404,'setSpeedLimitsMode did not exist in the qB4 WebAPI surface');
  const before=legacy.torrents.length,form=new FormData();
  form.append('urls','magnet:?xt=urn:btih:5555555555555555555555555555555555555555&dn=Legacy-One\nmagnet:?xt=urn:btih:6666666666666666666666666666666666666666&dn=Legacy-Two');
  r=await handleApi(legacy,postForm('torrents/add',form));
  assert.equal(r.status,200);assert.equal(await r.text(),'Ok.','pre-structured WebAPI releases must retain the legacy plain-text add response');
  assert.equal(legacy.torrents.length,before+2,'legacy response shape must not reduce multi-source add behavior');

  const failedBefore=legacy.torrents.length,failed=new FormData();failed.append('urls','not-a-valid-torrent-source');
  r=await handleApi(legacy,postForm('torrents/add',failed));
  assert.equal(r.status,200);assert.equal(await r.text(),'Fails.','pre-2.14 all-failed add must retain the legacy Fails. body instead of 409');
  assert.equal(legacy.torrents.length,failedBefore);

  const pendingBefore=legacy.torrents.length,pending=new FormData();pending.append('urls','https://downloads.example.invalid/legacy-pending.torrent');
  r=await handleApi(legacy,postForm('torrents/add',pending));
  assert.equal(r.status,200);assert.equal(await r.text(),'Ok.','pre-2.14 accepted remote fetch must retain the legacy Ok. body');
  assert.equal(legacy.torrents.length,pendingBefore,'legacy Ok. may represent an accepted asynchronous fetch rather than an immediate torrent');
}

{
  const future=makeWorld({qbVersion:'5.2.3',webApiVersion:'2.15.2',stable:true},'future-add-contract'),before=future.torrents.length,form=new FormData();
  form.append('urls','magnet:?xt=urn:btih:8888888888888888888888888888888888888888&dn=Future');
  const r=await handleApi(future,postForm('torrents/add',form));
  assert.equal(r.status,501,'future unclassified add semantics must fail closed');
  assert.equal(future.torrents.length,before,'fail-closed future add must not mutate runtime state');
}

console.log('Virtual qB add/transfer contract passed: qB5 setSpeedLimitsMode, scheduler enforcement, multi-source add, AddTorrentParams execution, WebAPI 2.14 structured 200/202/409 result semantics, stopped/check conditions, legacy Ok./Fails. response gating and future fail-closed ownership.');
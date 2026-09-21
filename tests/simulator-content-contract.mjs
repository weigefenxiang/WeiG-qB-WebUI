import assert from 'node:assert/strict';
import {createWorld} from '../simulator/core/engine.js';
import {handleApi} from '../simulator/protocol/router.js';
import {
  applyShareLimitPolicies,filesForTorrent,pieceHashes,pieceStates,renameFile,renameFolder,
  setShareLimits,setSuperSeeding,shareLimitProjection
} from '../simulator/core/torrent-content.js';

const MiB=1024*1024;
const now=1700000000000;

function world(qb='5.2.3',api='2.15.1',count=80){
  const w=createWorld({profile:{qbVersion:qb,webApiVersion:api,stable:true},count,seed:`content-${qb}-${api}`,now});
  w.authenticated=true;
  return w;
}
function formRequest(path,body){
  return new Request(`https://example.invalid/api/v2/${path}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
}
function metadataTorrent(w){
  const t=w.torrents.find(x=>x.has_metadata);
  assert.ok(t,'content contract requires a torrent with metadata');
  return t;
}

{
  const w=world('4.1.0','2.0.0');
  const t=metadataTorrent(w);
  const states=pieceStates(w,t.hash),hashes=pieceHashes(w,t.hash);
  assert.equal(states.length,Math.max(1,Math.ceil(t.size/(4*MiB))),'piece state count must follow the virtual 4 MiB piece geometry');
  assert.equal(hashes.length,states.length,'piece hash count must match piece state count');
  assert.ok(hashes.every(x=>/^[0-9a-f]{40}$/.test(x)),'piece hashes must use qB-compatible 40 character hex strings');
  const files=filesForTorrent(w,t.hash);
  assert.ok(files.length>0,'metadata torrent must expose files');
  assert.equal('index' in files[0],false,'WebAPI before 2.8.2 must not expose the file index field');

  let response=await handleApi(w,new Request(`https://example.invalid/api/v2/torrents/pieceStates?hash=${t.hash}`));
  assert.equal(response.status,200,'qB 4.1 v2 API must expose pieceStates');
  assert.equal((await response.json()).length,states.length);
  response=await handleApi(w,new Request(`https://example.invalid/api/v2/torrents/pieceHashes?hash=${t.hash}`));
  assert.equal(response.status,200,'qB 4.1 v2 API must expose pieceHashes');
  assert.equal((await response.json()).length,hashes.length);
}

{
  const w=world('5.2.3','2.15.1');
  const t=metadataTorrent(w);
  const files=filesForTorrent(w,t.hash);
  assert.equal(files[0].index,0,'modern WebAPI must expose stable file indexes');
  assert.ok(files[0].availability>=0&&files[0].availability<=1,'file availability must be a bounded deterministic ratio');
  assert.ok(renameFile(w,t.hash,'content.bin','folder/content.bin'),'renameFile must mutate a valid relative torrent path');
  assert.equal(t.files[0].name,'folder/content.bin');
  assert.ok(renameFolder(w,t.hash,'folder','archive'),'renameFolder must mutate descendants by prefix');
  assert.equal(t.files[0].name,'archive/content.bin');
  assert.equal(renameFile(w,t.hash,'archive/content.bin','../escape.bin'),false,'content rename must reject traversal paths');
}

{
  const old=world('4.1.0','2.0.0');
  const t=metadataTorrent(old);
  let response=await handleApi(old,formRequest('torrents/renameFile',{hash:t.hash,oldPath:'content.bin',newPath:'renamed.bin'}));
  assert.equal(response.status,404,'renameFile must stay unavailable before WebAPI 2.4.0');

  const modern=world('5.2.3','2.15.1');
  const mt=metadataTorrent(modern);
  response=await handleApi(modern,formRequest('torrents/renameFile',{hash:mt.hash,oldPath:'content.bin',newPath:'folder/content.bin'}));
  assert.equal(response.status,200,'modern WebAPI must expose renameFile');
  response=await handleApi(modern,formRequest('torrents/renameFolder',{hash:mt.hash,oldPath:'folder',newPath:'renamed'}));
  assert.equal(response.status,200,'modern WebAPI must expose renameFolder');
  assert.equal(mt.files[0].name,'renamed/content.bin');

  const special=world('4.3.3','2.7.0');
  const st=metadataTorrent(special);st.files[0].name='folder/content.bin';
  response=await handleApi(special,formRequest('torrents/renameFolder',{hash:st.hash,oldPath:'folder',newPath:'special'}));
  assert.equal(response.status,200,'qB 4.3.3 compatibility profile must retain its renameFolder exception');
}

{
  const w=world();
  const t=w.torrents.find(x=>x.completed);assert.ok(t);
  t.downloaded=t.size;t.uploaded=t.size;t.seedTime=600;t.canonicalState='SEED_ACTIVE';
  setShareLimits(w,t.hash,{ratioLimit:0.5,seedingTimeLimit:-1,inactiveSeedingTimeLimit:-1,shareLimitAction:'Stop'});
  const projection=shareLimitProjection(w,t);
  assert.equal(projection.ratio_limit,0.5);
  assert.equal(projection.share_limit_action,'Stop');
  applyShareLimitPolicies(w,now+1000);
  assert.equal(t.canonicalState,'SEED_PAUSED','Stop share-limit action must stop a torrent whose ratio limit is reached');
}

{
  const w=world();
  const t=w.torrents.find(x=>x.completed);assert.ok(t);
  t.downloaded=t.size;t.uploaded=t.size;t.canonicalState='SEED_ACTIVE';
  setShareLimits(w,t.hash,{ratioLimit:0,seedingTimeLimit:-1,inactiveSeedingTimeLimit:-1,shareLimitAction:'EnableSuperSeeding'});
  applyShareLimitPolicies(w,now+1000);
  assert.equal(t.superSeeding,true,'EnableSuperSeeding share-limit action must mutate the torrent instead of removing it');
  setSuperSeeding(w,t.hash,false);assert.equal(t.superSeeding,false,'setSuperSeeding must also support explicit disable');
}

{
  const w=world();
  const t=w.torrents.find(x=>x.completed);assert.ok(t);
  const before=w.torrents.length;
  t.downloaded=t.size;t.uploaded=t.size;t.canonicalState='SEED_ACTIVE';
  setShareLimits(w,t.hash,{ratioLimit:0,seedingTimeLimit:-1,inactiveSeedingTimeLimit:-1,shareLimitAction:'Remove'});
  applyShareLimitPolicies(w,now+1000);
  assert.equal(w.torrents.length,before-1,'Remove share-limit action must remove the virtual torrent');
  assert.ok(!w.torrents.some(x=>x.hash===t.hash));
}

{
  const w=world();
  const t=w.torrents.find(x=>x.completed);assert.ok(t);
  let response=await handleApi(w,formRequest('torrents/setShareLimits',{hashes:t.hash,ratioLimit:'3.5',seedingTimeLimit:'45',inactiveSeedingTimeLimit:'12',shareLimitAction:'Stop'}));
  assert.equal(response.status,200,'router must expose setShareLimits');
  response=await handleApi(w,new Request(`https://example.invalid/api/v2/torrents/info?hashes=${t.hash}`));
  const rows=await response.json();
  assert.equal(rows[0].ratio_limit,3.5,'torrents/info must project per-torrent ratio limit state');
  assert.equal(rows[0].seeding_time_limit,45);
  assert.equal(rows[0].inactive_seeding_time_limit,12);
  assert.equal(rows[0].share_limit_action,'Stop');
  response=await handleApi(w,formRequest('torrents/setSuperSeeding',{hashes:t.hash,value:'true'}));
  assert.equal(response.status,200);
  response=await handleApi(w,new Request(`https://example.invalid/api/v2/torrents/info?hashes=${t.hash}`));
  assert.equal((await response.json())[0].super_seeding,true,'torrents/info must project explicit super-seeding state');
}

console.log('Virtual qB content contract passed: piece APIs, historical file-index shape, rename gates, share-limit actions and super-seeding are stateful and version-aware.');

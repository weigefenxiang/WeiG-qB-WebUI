import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// Immutable official qB source witnesses. These are an offline audit input,
// never runtime compatibility admission or permission to send a write request.
const names=['webapplication.h','api/appcontroller.h','api/torrentscontroller.h','api/rsscontroller.h'];
const refs=[
  {tag:'release-5.2.4',commit:'a1e4649cb8ae581925acc161dbab5cbc6584c542',webApi:'2.15.1',blobs:['3dedda7b9dfbb743e6f8419102c4bd305d6b4de2','e94c641d3ea1baa8bc300100261a6bbb0209f085','d3ef62a9dda9a2d421b12c293caadea86b458486','9c9e5f1fd585c717f3c093a1bf804d6c543858d4']},
  {tag:'release-5.3.0beta1',commit:'26663c60a4a772b9bb0661bc11a4577ca75a5db5',webApi:'2.16.2',blobs:['8bd23c2541be16387ba43ea5b46d2002ba32e7fc','8837458ebd274bfeade1b1df51956d8fcf844216','4eb102e89ff93de90a7fd93e94c88ea35dff3658','e370dde0d17f24dabde04a468cc8e749aea0afde']},
  {tag:'release-5.3.0rc1',commit:'b76f8383561283c29c9577554ea6127cfde8a4a4',webApi:'2.16.2',blobs:['1525325deb5112000994905a18ce42606558c840','8837458ebd274bfeade1b1df51956d8fcf844216','4eb102e89ff93de90a7fd93e94c88ea35dff3658','a4b1bfd7a31010b8e34b80477a475b1903cff0b9']}
];
function webApi(header){
  const match=/\bAPI_VERSION\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/.exec(header);
  if(!match)throw new Error('Official WebAPI source identity is absent');
  return match.slice(1).join('.');
}
function actions(header){
  return new Set(Array.from(header.matchAll(/\bvoid\s+(\w+Action)\s*\(/g),match=>match[1]));
}
function added(before,after){
  return [...after].filter(value=>!before.has(value)).sort();
}
function blobSha(buffer){
  return createHash('sha1').update('blob '+buffer.length+'\0').update(buffer).digest('hex');
}
assert.equal(webApi('inline const Utils::Version<3, 2> API_VERSION {2, 16, 2};'),'2.16.2');
assert.throws(()=>webApi('WebAPI version = 2.16.2'),/absent/);
assert.deepEqual(added(actions('void aAction();'),actions('void aAction(); void bAction();')),['bAction']);
assert(refs.length===3&&refs.every(item=>/^release-5\./.test(item.tag)&&/^[a-f0-9]{40}$/.test(item.commit)&&item.blobs.length===names.length&&item.blobs.every(sha=>/^[a-f0-9]{40}$/.test(sha))),'Official source witnesses must pin exact commit and Git blob identities');
assert.equal(refs[0].webApi,'2.15.1');
assert(refs.slice(1).every(row=>row.webApi==='2.16.2'),'Beta/RC WebAPI bump must remain explicit');
if(process.argv.includes('--upstream')){
  const upstream={};
  await Promise.all(refs.flatMap(row=>names.map(async (name,i)=>{
    const url='https://raw.githubusercontent.com/qbittorrent/qBittorrent/'+row.commit+'/src/webui/'+name;
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'user-agent':'WeiG-A72-pinned-source-audit'}});
    if(!response.ok)throw new Error(row.tag+': official upstream source HTTP '+response.status+' for '+name);
    const bytes=Buffer.from(await response.arrayBuffer());
    const actual=blobSha(bytes),expected=row.blobs[i];
    assert.equal(actual,expected,row.tag+': upstream Git blob identity changed: '+name);
    upstream[row.tag]??={};
    upstream[row.tag][name]=bytes.toString('utf8');
  })));
  for(const row of refs)assert.equal(webApi(upstream[row.tag][names[0]]),row.webApi,row.tag+': upstream WebAPI definition mismatch');
  function delta(from,to,name){
    return added(actions(upstream[from][name]),actions(upstream[to][name]));
  }
  const stable=refs[0].tag,beta=refs[1].tag,rc=refs[2].tag;
  assert.deepEqual(delta(stable,beta,names[1]),['getFreeSpaceAtPathAction'],'beta App API addition must be identified, not guessed');
  assert.deepEqual(delta(stable,beta,names[2]),['downloadFileAction'],'beta Torrent API addition must be identified, not guessed');
  assert.deepEqual(delta(stable,beta,names[3]),['cloneRuleAction'],'beta RSS API addition must be identified, not guessed');
  assert.deepEqual(delta(beta,rc,names[3]),['exportRulesAction','importRulesAction'],'RC RSS API additions must be identified, not guessed');
  assert.deepEqual(delta(beta,rc,names[1]),[],'Unexpected RC App action delta requires a fresh source review');
  assert.deepEqual(delta(beta,rc,names[2]),[],'Unexpected RC Torrent action delta requires a fresh source review');
  console.log('A72 official qB pinned source audit PASS: 3 exact commits, 12 Git blobs, stable WebAPI 2.15.1 vs Beta/RC 2.16.2; new App/Torrent/RSS APIs identified READ-ONLY as evidence (NOT admitted).');
}else{
  console.log('A72 prerelease source witness syntax PASS (offline); add --upstream for verified official Git blob/content census.');
}

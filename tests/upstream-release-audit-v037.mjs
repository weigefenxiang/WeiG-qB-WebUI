import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'..');
const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
assert.ok(qbRoot && fs.existsSync(qbRoot),'Usage: node tests/upstream-release-audit-v037.mjs <qBittorrent-clone> [--refs=release-4.1.9.1,release-5.2.0]');
const refsArg=process.argv.find(x=>x.startsWith('--refs='));
const requestedRefs=refsArg?refsArg.slice('--refs='.length).split(',').map(x=>x.trim()).filter(Boolean):[];
const fullAudit=requestedRefs.length===0;

const clientSource=fs.readFileSync(path.join(projectRoot,'webui/private/scripts/qb-client.js'),'utf8');
class TestFormData{constructor(){this.entries=[];}append(name,value,filename){this.entries.push({name,value,filename});}}
const sandbox={console,URLSearchParams,FormData:TestFormData,Blob,fetch:async()=>{throw new Error('Unexpected fetch');},window:{WeiG:{util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en'}}}};
sandbox.window.window=sandbox.window;
vm.runInNewContext(clientSource,sandbox,{filename:'qb-client.js'});
const Client=sandbox.window.WeiG.QBClient;

function git(...args){return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function parts(v){return String(v).replace(/^release-/,'').split('.').map(x=>Number.parseInt(x,10)||0);}
function cmp(a,b){const aa=parts(a),bb=parts(b),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return Math.sign(d);}return 0;}
function atLeast(v,min){return cmp(v,min)>=0;}
function parseApi(header,tag){const m=header.match(/API_VERSION\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/);assert.ok(m,`${tag}: cannot parse API_VERSION`);return `${m[1]}.${m[2]}.${m[3]}`;}
function show(ref,file){return git('show',`${ref}:${file}`);}
function capture(client){const calls=[];client.request=async(path,options={})=>{calls.push({path,options});return null;};return calls;}
async function detect(qbVersion,apiVersion){const c=new Client();c.request=async p=>{if(p==='app/version')return `v${qbVersion}`;if(p==='app/webapiVersion')return apiVersion;throw new Error(`Unexpected endpoint ${p}`);};await c.detect();return c;}

let tags;
if(fullAudit){
  tags=git('tag','--list','release-*').split(/\r?\n/).filter(Boolean)
    .filter(tag=>/^release-(?:4|5)\.\d+\.\d+(?:\.\d+)?$/.test(tag))
    .filter(tag=>cmp(tag,'release-4.1.9.1')>=0)
    .sort(cmp);
  assert.ok(tags.length>=30,`expected broad official 4.x/5.x tag coverage, got ${tags.length}`);
}else{
  tags=Array.from(new Set(requestedRefs)).sort(cmp);
  for(const tag of tags){
    assert.match(tag,/^release-(?:4|5)\.\d+\.\d+(?:\.\d+)?$/,`invalid release ref ${tag}`);
    git('rev-parse','--verify',`refs/tags/${tag}`);
  }
}

const audited=[];
for(const tag of tags){
  const qbVersion=tag.slice('release-'.length);
  const header=show(tag,'src/webui/webapplication.h');
  const apiVersion=parseApi(header,tag);
  const c=await detect(qbVersion,apiVersion);
  const major=parts(qbVersion)[0];
  const label=`${qbVersion} / WebAPI ${apiVersion}`;

  assert.equal(c.major,major,`${label}: major detection`);
  assert.equal(c.capabilities.certified,true,`${label}: official 4.x/5.x release must be certified`);
  assert.equal(c.capabilities.legacy4,major===4,`${label}: legacy4`);
  assert.equal(c.capabilities.modern5,major===5,`${label}: modern5`);
  assert.equal(c.capabilities.logs,atLeast(qbVersion,'4.1.0'),`${label}: logs`);
  assert.equal(c.capabilities.tags,atLeast(apiVersion,'2.3.0'),`${label}: tags`);
  assert.equal(c.capabilities.renameFile,atLeast(apiVersion,'2.4.0'),`${label}: renameFile`);
  assert.equal(c.capabilities.stalledFilter,atLeast(apiVersion,'2.4.1'),`${label}: stalled filter`);
  assert.equal(c.capabilities.contentPath,atLeast(apiVersion,'2.6.1'),`${label}: content path`);
  assert.equal(c.capabilities.addTags,atLeast(apiVersion,'2.6.2'),`${label}: addTags`);
  assert.equal(c.capabilities.renameFolder,(qbVersion==='4.3.3'||atLeast(apiVersion,'2.8.0')),`${label}: renameFolder`);
  assert.equal(c.capabilities.fileIndexes,atLeast(apiVersion,'2.8.2'),`${label}: file indexes`);
  assert.equal(c.capabilities.tagFilter,atLeast(apiVersion,'2.8.3'),`${label}: tag filter`);
  assert.equal(c.capabilities.cookies,atLeast(apiVersion,'2.11.3'),`${label}: cookies`);
  assert.equal(c.capabilities.trackerEditUrl,atLeast(apiVersion,'2.13.0'),`${label}: editTracker parameter generation`);
  assert.equal(c.capabilities.structuredTorrentAdd,atLeast(apiVersion,'2.14.0'),`${label}: structured torrent add`);
  assert.equal(c.capabilities.privateFlag,major>=5,`${label}: exact private field generation`);

  const actions=capture(c);await c.resume('abc');await c.pause('abc');
  assert.equal(actions[0].path,major>=5?'torrents/start':'torrents/resume',`${label}: start/resume bridge`);
  assert.equal(actions[1].path,major>=5?'torrents/stop':'torrents/pause',`${label}: stop/pause bridge`);

  const filters=capture(c);await c.getTorrents({filter:major>=5?'paused':'stopped'});
  assert.match(filters[0].path,major>=5?/filter=stopped/:/filter=paused/,`${label}: stopped/paused filter bridge`);

  const trackers=capture(c);await c.editTracker('hash','https://old.invalid/announce','https://new.invalid/announce');
  if(atLeast(apiVersion,'2.13.0')){
    assert.equal(trackers[0].options.form.url,'https://old.invalid/announce',`${label}: modern editTracker url`);
    assert.equal('origUrl' in trackers[0].options.form,false,`${label}: old editTracker key leaked`);
  }else{
    assert.equal(trackers[0].options.form.origUrl,'https://old.invalid/announce',`${label}: legacy editTracker origUrl`);
    assert.equal('url' in trackers[0].options.form,false,`${label}: new editTracker key leaked`);
  }
  audited.push({qbVersion,apiVersion});
}

assert.ok(audited.length>0,'no qB release refs were audited');
if(!fullAudit){
  assert.deepEqual(audited.map(x=>x.qbVersion),['4.1.9.1','5.2.0'],'daily representative audit must stay pinned to qB 4.1.9.1 and 5.2.0');
}
const masterHeader=show('origin/master','src/webui/webapplication.h');
const masterApi=parseApi(masterHeader,'origin/master');
assert.ok(cmp(masterApi,audited.at(-1).apiVersion)>=0,`master WebAPI ${masterApi} must not predate audited stable ${audited.at(-1).apiVersion}`);

const byMajor=audited.reduce((m,x)=>{const k=parts(x.qbVersion)[0];m[k]=(m[k]||0)+1;return m;},{});
if(fullAudit){
  console.log(`Full upstream qB Release audit passed: ${audited.length} official stable tags (${byMajor[4]||0} qB 4.x + ${byMajor[5]||0} qB 5.x), from ${audited[0].qbVersion}/WebAPI ${audited[0].apiVersion} through ${audited.at(-1).qbVersion}/WebAPI ${audited.at(-1).apiVersion}; master WebAPI ${masterApi}.`);
}else{
  console.log(`Representative upstream audit passed: ${audited.map(x=>`${x.qbVersion}/WebAPI ${x.apiVersion}`).join(' + ')}; master WebAPI ${masterApi}.`);
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'..');
const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
assert.ok(qbRoot&&fs.existsSync(qbRoot),'Usage: node tests/upstream-release-audit.mjs <qBittorrent-clone> [--refs=release-4.1.9.1,release-5.x.0]');
const refsArg=process.argv.find(x=>x.startsWith('--refs='));
const requestedRefs=refsArg?refsArg.slice('--refs='.length).split(',').map(x=>x.trim()).filter(Boolean):[];
const fullAudit=requestedRefs.length===0;

const clientSource=fs.readFileSync(path.join(projectRoot,'webui/private/scripts/qb-client.js'),'utf8');
class TestFormData{constructor(){this.entries=[];}append(name,value,filename){this.entries.push({name,value,filename});}}
const sandbox={console,URLSearchParams,FormData:TestFormData,Blob,fetch:async()=>{throw new Error('Unexpected fetch');},window:{WeiG:{util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en'}}}};
sandbox.window.window=sandbox.window;
vm.runInNewContext(clientSource,sandbox,{filename:'qb-client.js'});
const Client=sandbox.window.WeiG.QBClient;

const settingsSandbox={window:{WeiG:{t:key=>key,util:{parseScalar:value=>value},I18n:{getLocale:()=> 'en'}}}};
settingsSandbox.window.window=settingsSandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(projectRoot,'webui/private/scripts/settings-schema.js'),'utf8'),settingsSandbox,{filename:'settings-schema.js'});
const SettingsSchema=settingsSandbox.window.WeiG.SettingsSchema;

function git(...args){return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function parts(v){return String(v).replace(/^release-/,'').split('.').map(x=>Number.parseInt(x,10)||0);}
function cmp(a,b){const aa=parts(a),bb=parts(b),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return Math.sign(d);}return 0;}
function atLeast(v,min){return cmp(v,min)>=0;}
function parseApi(header,tag){const m=header.match(/API_VERSION\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/);assert.ok(m,`${tag}: cannot parse API_VERSION`);return `${m[1]}.${m[2]}.${m[3]}`;}
function show(ref,file){return git('show',`${ref}:${file}`);}
function capture(client){const calls=[];client.request=async(path,options={})=>{calls.push({path,options});return null;};return calls;}
async function detect(qbVersion,apiVersion){const c=new Client();c.request=async p=>{if(p==='app/version')return `v${qbVersion}`;if(p==='app/webapiVersion')return apiVersion;throw new Error(`Unexpected endpoint ${p}`);};await c.detect();return c;}

function preferenceKeys(ref){
  const source=show(ref,'src/webui/api/appcontroller.cpp');
  const start=source.indexOf('void AppController::preferencesAction()');
  const end=source.indexOf('void AppController::setPreferencesAction()',start);
  assert.ok(start>=0&&end>start,`${ref}: cannot isolate preferencesAction`);
  const body=source.slice(start,end),keys=new Set();
  for(const m of body.matchAll(/data\s*\[\s*(?:u)?["']([^"']+)["'](?:_s)?\s*\]/g))keys.add(m[1]);
  return [...keys].sort();
}
function apiActions(ref){
  const names=git('ls-tree','-r','--name-only',ref,'src/webui/api').split(/\r?\n/).filter(x=>x.endsWith('controller.h'));
  const actions=new Set();
  for(const file of names){
    const source=show(ref,file);
    for(const m of source.matchAll(/\bvoid\s+([A-Za-z0-9_]+Action)\s*\(/g))actions.add(`${path.basename(file)}:${m[1]}`);
  }
  return actions;
}

let tags;
if(fullAudit){
  tags=git('tag','--list','release-*').split(/\r?\n/).filter(Boolean)
    .filter(tag=>/^release-(?:4|5)\.\d+\.\d+(?:\.\d+)?$/.test(tag))
    .filter(tag=>cmp(tag,'release-4.1.9.1')>=0)
    .sort(cmp);
  assert.ok(tags.length>=30,`expected broad official 4.x/5.x tag coverage, got ${tags.length}`);
}else{
  tags=Array.from(new Set(requestedRefs)).sort(cmp);
  for(const tag of tags){assert.match(tag,/^release-(?:4|5)\.\d+\.\d+(?:\.\d+)?$/,`invalid release ref ${tag}`);git('rev-parse','--verify',`refs/tags/${tag}`);}
  assert.ok(tags.includes('release-4.1.9.1'),'representative audit must include minimum qB 4.1.9.1');
  assert.ok(tags.some(tag=>/^release-5\.\d+\.0$/.test(tag)),'representative audit must include a qB 5.x.0 generation');
}

const audited=[];
for(const tag of tags){
  const qbVersion=tag.slice('release-'.length),header=show(tag,'src/webui/webapplication.h'),apiVersion=parseApi(header,tag),c=await detect(qbVersion,apiVersion),major=parts(qbVersion)[0],label=`${qbVersion} / WebAPI ${apiVersion}`;
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
  if(atLeast(apiVersion,'2.13.0')){assert.equal(trackers[0].options.form.url,'https://old.invalid/announce',`${label}: modern editTracker url`);assert.equal('origUrl' in trackers[0].options.form,false,`${label}: old editTracker key leaked`);}
  else{assert.equal(trackers[0].options.form.origUrl,'https://old.invalid/announce',`${label}: legacy editTracker origUrl`);assert.equal('url' in trackers[0].options.form,false,`${label}: new editTracker key leaked`);}
  audited.push({qbVersion,apiVersion,tag});
}
assert.ok(audited.length>0,'no qB release refs were audited');

const fiveGeneration=audited.filter(x=>/^5\.\d+\.0$/.test(x.qbVersion)).sort((a,b)=>cmp(a.qbVersion,b.qbVersion));
if(fiveGeneration.length){
  const latest=fiveGeneration.at(-1),keys=preferenceKeys(latest.tag),allowed=new Set(['downloads','connection','speed','bittorrent','webui','advanced']);
  const routes=keys.map(key=>[key,SettingsSchema.describe(key)]);
  for(const [key,info] of routes)assert.ok(allowed.has(info.surface)&&info.section,`${latest.qbVersion}: preference ${key} has no safe Settings route`);
  const upstream=routes.filter(([,info])=>info.surface==='advanced'&&info.section==='upstream').map(([key])=>key);
  console.log(`Latest qB generation Settings coverage: ${latest.qbVersion} exposes ${keys.length} Preferences; ${upstream.length} use safe Advanced/Upstream fallback${upstream.length?`: ${upstream.join(', ')}`:'.'}`);
  if(fiveGeneration.length>=2){
    const previous=fiveGeneration.at(-2),prevPrefs=new Set(preferenceKeys(previous.tag)),newPrefs=keys.filter(key=>!prevPrefs.has(key));
    const prevActions=apiActions(previous.tag),latestActions=apiActions(latest.tag),newActions=[...latestActions].filter(x=>!prevActions.has(x)).sort();
    console.log(`qB generation delta ${previous.qbVersion} -> ${latest.qbVersion}: ${newPrefs.length} new Preferences${newPrefs.length?` (${newPrefs.map(key=>{const x=SettingsSchema.describe(key);return `${key}->${x.surface}/${x.section}`;}).join(', ')})`:''}; ${newActions.length} new API actions${newActions.length?` (${newActions.join(', ')})`:''}.`);
  }
}

const masterHeader=show('origin/master','src/webui/webapplication.h'),masterApi=parseApi(masterHeader,'origin/master');
assert.ok(cmp(masterApi,audited.at(-1).apiVersion)>=0,`master WebAPI ${masterApi} must not predate audited stable ${audited.at(-1).apiVersion}`);
const byMajor=audited.reduce((m,x)=>{const k=parts(x.qbVersion)[0];m[k]=(m[k]||0)+1;return m;},{});
if(fullAudit)console.log(`Full upstream qB Release audit passed: ${audited.length} official stable tags (${byMajor[4]||0} qB 4.x + ${byMajor[5]||0} qB 5.x), from ${audited[0].qbVersion}/WebAPI ${audited[0].apiVersion} through ${audited.at(-1).qbVersion}/WebAPI ${audited.at(-1).apiVersion}; master WebAPI ${masterApi}.`);
else console.log(`Representative upstream audit passed: ${audited.map(x=>`${x.qbVersion}/WebAPI ${x.apiVersion}`).join(' + ')}; master WebAPI ${masterApi}.`);

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extractPreferenceKeys} from '../tools/qb-source-parsers.mjs';
import {extractTorrentFilters,extractTorrentInfoParameters} from '../tools/qb-torrent-surface-parsers.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'..');
const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
assert.ok(qbRoot&&fs.existsSync(qbRoot),'Usage: node tests/upstream-release-audit.mjs <qBittorrent-clone> [--refs=release-4.1.0,release-5.x.x]');
const refsArg=process.argv.find(x=>x.startsWith('--refs='));
const requestedRefs=refsArg?refsArg.slice('--refs='.length).split(',').map(x=>x.trim()).filter(Boolean):[];
const fullAudit=requestedRefs.length===0;

const clientSource=fs.readFileSync(path.join(projectRoot,'webui/private/scripts/qb-client.js'),'utf8');
class TestFormData{constructor(){this.entries=[];}append(name,value,filename){this.entries.push({name,value,filename});}}
let activeTruth=null;
const releaseProfile={
  upstreamTorrentFilter(value){const name=String(value||'all'),filters=activeTruth?.filters||[];if(filters.includes(name))return name;if(name==='stopped'&&filters.includes('paused'))return'paused';if(name==='running'&&filters.includes('resumed'))return'resumed';return null;},
  resolveTorrentAction(kind){const actions=activeTruth?.actions||new Set();const choices=kind==='start'?[['torrentscontroller.h:startAction','start'],['torrentscontroller.h:resumeAction','resume']]:[['torrentscontroller.h:stopAction','stop'],['torrentscontroller.h:pauseAction','pause']];for(const [fact,action] of choices)if(actions.has(fact))return action;return null;},
  isCertified(){return !!activeTruth;}
};
const sandbox={console,URLSearchParams,FormData:TestFormData,Blob,fetch:async()=>{throw new Error('Unexpected fetch');},window:{WeiG:{ReleaseProfile:releaseProfile,util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en'}}}};
sandbox.window.window=sandbox.window;
vm.runInNewContext(clientSource,sandbox,{filename:'qb-client.js'});
const Client=sandbox.window.WeiG.QBClient;

const settingsSandbox={window:{WeiG:{t:key=>key,util:{parseScalar:value=>value},I18n:{getLocale:()=> 'en'}}}};settingsSandbox.window.window=settingsSandbox.window;
vm.runInNewContext(fs.readFileSync(path.join(projectRoot,'webui/private/scripts/settings-schema.js'),'utf8'),settingsSandbox,{filename:'settings-schema.js'});
const SettingsSchema=settingsSandbox.window.WeiG.SettingsSchema;

function git(...args){return execFileSync('git',['-C',qbRoot,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function parts(v){return String(v).replace(/^release-/,'').split('.').map(x=>Number.parseInt(x,10)||0);}
function cmp(a,b){const aa=parts(a),bb=parts(b),n=Math.max(aa.length,bb.length);for(let i=0;i<n;i++){const d=(aa[i]||0)-(bb[i]||0);if(d)return Math.sign(d);}return 0;}
function parseApi(header,tag){const m=header.match(/API_VERSION\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/);assert.ok(m,`${tag}: cannot parse API_VERSION`);return `${m[1]}.${m[2]}.${m[3]}`;}
function show(ref,file){return git('show',`${ref}:${file}`);}
function apiActions(ref){const names=git('ls-tree','-r','--name-only',ref,'src/webui/api').split(/\r?\n/).filter(x=>x.endsWith('controller.h'));const actions=new Set();for(const file of names){const source=show(ref,file);for(const m of source.matchAll(/\bvoid\s+([A-Za-z0-9_]+Action)\s*\(/g))actions.add(`${path.basename(file)}:${m[1]}`);}return actions;}
function torrentSurface(ref){const torrentsControllerSource=show(ref,'src/webui/api/torrentscontroller.cpp'),torrentFilterSource=show(ref,'src/base/torrentfilter.cpp');return{filters:extractTorrentFilters({torrentFilterSource,torrentsControllerSource},ref),infoParameters:extractTorrentInfoParameters(torrentsControllerSource,ref)};}
function capture(client){const calls=[];client.request=async(path,options={})=>{calls.push({path,options});return null;};return calls;}
async function detect(qbVersion,apiVersion){const c=new Client();c.request=async p=>{if(p==='app/version')return `v${qbVersion}`;if(p==='app/webapiVersion')return apiVersion;throw new Error(`Unexpected endpoint ${p}`);};await c.detect();return c;}

let tags;if(fullAudit){tags=git('tag','--list','release-*').split(/\r?\n/).filter(Boolean).filter(tag=>/^release-(?:4|5)\.\d+\.\d+(?:\.\d+)?$/.test(tag)).filter(tag=>cmp(tag,'release-4.1.0')>=0).sort(cmp);assert.ok(tags.length>=30,`expected broad official 4.x/5.x tag coverage, got ${tags.length}`);}else{tags=Array.from(new Set(requestedRefs)).sort(cmp);for(const tag of tags){assert.match(tag,/^release-(?:4|5)\.\d+\.\d+(?:\.\d+)?$/,`invalid release ref ${tag}`);git('rev-parse','--verify',`refs/tags/${tag}`);}assert.ok(tags.includes('release-4.1.0'),'representative audit must include minimum qB 4.1.0');}

const audited=[];
for(const tag of tags){
  const qbVersion=tag.slice('release-'.length),apiVersion=parseApi(show(tag,'src/webui/webapplication.h'),tag),major=parts(qbVersion)[0],actions=apiActions(tag),surface=torrentSurface(tag),prefs=extractPreferenceKeys(show(tag,'src/webui/api/appcontroller.cpp'),tag),label=`${qbVersion} / WebAPI ${apiVersion}`;
  assert.ok(actions.size>0,`${label}: empty WebAPI action surface`);assert.ok(surface.filters.includes('all'),`${label}: Torrent filter surface lacks all`);assert.ok(surface.infoParameters.includes('filter'),`${label}: torrents/info lacks filter`);
  activeTruth={actions,filters:surface.filters,infoParameters:surface.infoParameters};
  const c=await detect(qbVersion,apiVersion);assert.equal(c.major,major,`${label}: major detection`);assert.equal(c.capabilities.legacy4,major===4,`${label}: legacy4`);assert.equal(c.capabilities.modern5,major===5,`${label}: modern5`);assert.equal(c.capabilities.certified,false,`${label}: certification belongs to ReleaseProfile/CapabilityRegistry, not QBClient detect`);
  const actionCalls=capture(c);await c.resume('abc');await c.pause('abc');assert.equal(actionCalls[0].path,major>=5?'torrents/start':'torrents/resume',`${label}: source-derived start action`);assert.equal(actionCalls[1].path,major>=5?'torrents/stop':'torrents/pause',`${label}: source-derived stop action`);
  const filterCalls=capture(c);await c.getTorrents({filter:major>=5?'stopped':'stopped'});assert.match(filterCalls[0].path,major>=5?/filter=stopped/:/filter=paused/,`${label}: source-derived stopped alias`);
  const allowed=new Set(['downloads','connection','speed','bittorrent','webui','advanced']);for(const key of prefs){const info=SettingsSchema.describe(key);assert.ok(allowed.has(info.surface)&&info.section,`${label}: preference ${key} has no safe Settings route`);}
  audited.push({qbVersion,apiVersion,tag,prefs:prefs.length,actions:actions.size,filters:surface.filters.length,privateParam:surface.infoParameters.includes('private')});
}
activeTruth=null;
assert.ok(audited.length>0,'no qB release refs were audited');assert.equal(audited[0].qbVersion,'4.1.0','formal stable support floor must be qB 4.1.0');
const v461=audited.find(x=>x.qbVersion==='4.6.1');if(v461)assert.equal(v461.apiVersion,'2.9.3','qB 4.6.1 is the first audited 4.6.x WebAPI 2.9.3 anchor');
const latest=audited.at(-1);console.log(`Latest stable audited: ${latest.qbVersion}/WebAPI ${latest.apiVersion}; ${latest.prefs} Preferences, ${latest.actions} API actions, ${latest.filters} Torrent filters.`);
const masterHeader=show('origin/master','src/webui/webapplication.h'),masterApi=parseApi(masterHeader,'origin/master');assert.ok(cmp(masterApi,latest.apiVersion)>=0,`master WebAPI ${masterApi} must not predate audited stable ${latest.apiVersion}`);
const byMajor=audited.reduce((m,x)=>{const k=parts(x.qbVersion)[0];m[k]=(m[k]||0)+1;return m;},{});
if(fullAudit)console.log(`Full upstream qB release audit passed: ${audited.length} official stable tags (${byMajor[4]||0} qB 4.x + ${byMajor[5]||0} qB 5.x), ${audited[0].qbVersion} -> ${latest.qbVersion}; master WebAPI ${masterApi}.`);else console.log(`Representative upstream audit passed: ${audited.map(x=>`${x.qbVersion}/WebAPI ${x.apiVersion}`).join(' + ')}.`);

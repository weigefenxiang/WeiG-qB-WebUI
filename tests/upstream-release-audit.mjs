import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {extractPreferenceKeys} from '../tools/qb-source-parsers.mjs';
import {extractTorrentFilters,extractTorrentInfoParameters} from '../tools/qb-torrent-surface-parsers.mjs';
import {extractTorrentInfoFields,extractTorrentStates} from '../tools/qb-torrent-fields-parser.mjs';
import {extractTorrentDetailSurfaces} from '../tools/qb-detail-surface-parsers.mjs';
import {compareQbVersions,isSupportedStableReleaseTag,supportedStableReleaseTags} from '../tools/qb-release-tags.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const projectRoot=path.resolve(here,'..');
const qbRoot=path.resolve(process.argv[2]||process.env.QB_UPSTREAM_DIR||'');
assert.ok(qbRoot&&fs.existsSync(qbRoot),'Usage: node tests/upstream-release-audit.mjs <qBittorrent-clone> [--refs=release-4.1.0,release-x.x.x]');
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
function parseApi(header,tag){const m=header.match(/API_VERSION\s*\{\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\}/);assert.ok(m,`${tag}: cannot parse API_VERSION`);return `${m[1]}.${m[2]}.${m[3]}`;}
function show(ref,file){return git('show',`${ref}:${file}`);}
function apiActions(ref){const names=git('ls-tree','-r','--name-only',ref,'src/webui/api').split(/\r?\n/).filter(x=>x.endsWith('controller.h'));const actions=new Set();for(const file of names){const source=show(ref,file);for(const m of source.matchAll(/\bvoid\s+([A-Za-z0-9_]+Action)\s*\(/g))actions.add(`${path.basename(file)}:${m[1]}`);}return actions;}
function torrentSurface(ref){const torrentsControllerSource=show(ref,'src/webui/api/torrentscontroller.cpp'),torrentFilterSource=show(ref,'src/base/torrentfilter.cpp'),serializerSource=show(ref,'src/webui/api/serialize/serialize_torrent.cpp'),serializerHeaderSource=show(ref,'src/webui/api/serialize/serialize_torrent.h');return{filters:extractTorrentFilters({torrentFilterSource,torrentsControllerSource},ref),infoParameters:extractTorrentInfoParameters(torrentsControllerSource,ref),infoFields:extractTorrentInfoFields({headerSource:serializerHeaderSource,serializerSource},ref),states:extractTorrentStates(serializerSource,ref),...extractTorrentDetailSurfaces(torrentsControllerSource,ref)};}
function capture(client){const calls=[];client.request=async(path,options={})=>{calls.push({path,options});return null;};return calls;}
async function detect(qbVersion,apiVersion){const c=new Client();c.request=async p=>{if(p==='app/version')return `v${qbVersion}`;if(p==='app/webapiVersion')return apiVersion;throw new Error(`Unexpected endpoint ${p}`);};await c.detect();return c;}
function sourceAction(actions,modern,legacy){return actions.has(modern)?modern.split(':')[1].replace(/Action$/,'').replace(/^./,c=>c.toLowerCase()):actions.has(legacy)?legacy.split(':')[1].replace(/Action$/,'').replace(/^./,c=>c.toLowerCase()):null;}

let tags;
if(fullAudit){tags=supportedStableReleaseTags(git('tag','--list','release-*').split(/\r?\n/).filter(Boolean));assert.ok(tags.length>=30,`expected broad official stable coverage from 4.1.0, got ${tags.length}`);}else{tags=Array.from(new Set(requestedRefs)).sort(compareQbVersions);for(const tag of tags){assert.equal(isSupportedStableReleaseTag(tag),true,`invalid or unsupported release ref ${tag}`);git('rev-parse','--verify',`refs/tags/${tag}`);}assert.ok(tags.includes('release-4.1.0'),'representative audit must include minimum qB 4.1.0');}

const audited=[];
for(const tag of tags){
  const qbVersion=tag.slice('release-'.length),apiVersion=parseApi(show(tag,'src/webui/webapplication.h'),tag),actions=apiActions(tag),surface=torrentSurface(tag),prefs=extractPreferenceKeys(show(tag,'src/webui/api/appcontroller.cpp'),tag),label=`${qbVersion} / WebAPI ${apiVersion}`;
  assert.ok(actions.size>0,`${label}: empty WebAPI action surface`);assert.ok(surface.filters.includes('all'),`${label}: Torrent filter surface lacks all`);assert.ok(surface.infoParameters.includes('filter'),`${label}: torrents/info lacks filter`);assert.ok(surface.infoFields.length>0,`${label}: empty torrents/info response field surface`);assert.ok(surface.states.length>0,`${label}: empty Torrent state surface`);assert.ok(surface.torrentPropertiesFields.length>0,`${label}: empty properties field surface`);assert.ok(surface.torrentTrackerFields.length>0,`${label}: empty tracker field surface`);assert.ok(surface.torrentFileFields.length>0,`${label}: empty file field surface`);
  activeTruth={actions,filters:surface.filters,infoParameters:surface.infoParameters};
  const c=await detect(qbVersion,apiVersion);assert.equal(c.major,parts(qbVersion)[0],`${label}: major detection`);assert.equal(c.capabilities.certified,false,`${label}: certification belongs to ReleaseProfile/CapabilityRegistry, not QBClient detect`);
  const start=sourceAction(actions,'torrentscontroller.h:startAction','torrentscontroller.h:resumeAction'),stop=sourceAction(actions,'torrentscontroller.h:stopAction','torrentscontroller.h:pauseAction');
  if(start&&stop){const actionCalls=capture(c);await c.resume('abc');await c.pause('abc');assert.equal(actionCalls[0].path,`torrents/${start}`,`${label}: source-derived start action`);assert.equal(actionCalls[1].path,`torrents/${stop}`,`${label}: source-derived stop action`);}
  const stopped=surface.filters.includes('stopped')?'stopped':surface.filters.includes('paused')?'paused':null;if(stopped){const filterCalls=capture(c);await c.getTorrents({filter:'stopped'});assert.match(filterCalls[0].path,new RegExp(`filter=${stopped}`),`${label}: source-derived stopped alias`);}
  const allowed=new Set(['downloads','connection','speed','bittorrent','webui','advanced']);for(const key of prefs){const info=SettingsSchema.describe(key);assert.ok(allowed.has(info.surface)&&info.section,`${label}: preference ${key} has no safe Settings route`);}
  audited.push({qbVersion,apiVersion,tag,prefs:prefs.length,actions:actions.size,filters:surface.filters.length,infoFields:surface.infoFields.length,states:surface.states.length,privateParam:surface.infoParameters.includes('private')});
}
activeTruth=null;
assert.ok(audited.length>0,'no qB release refs were audited');assert.equal(audited[0].qbVersion,'4.1.0','formal stable support floor must be qB 4.1.0');
const v461=audited.find(x=>x.qbVersion==='4.6.1');if(v461)assert.equal(v461.apiVersion,'2.9.3','qB 4.6.1 is the first audited 4.6.x WebAPI 2.9.3 anchor');
const latest=audited.at(-1);console.log(`Latest stable audited: ${latest.qbVersion}/WebAPI ${latest.apiVersion}; ${latest.prefs} Preferences, ${latest.actions} API actions, ${latest.filters} Torrent filters, ${latest.infoFields} Torrent fields, ${latest.states} states.`);
const masterHeader=show('origin/master','src/webui/webapplication.h'),masterApi=parseApi(masterHeader,'origin/master');assert.ok(compareQbVersions(masterApi,latest.apiVersion)>=0,`master WebAPI ${masterApi} must not predate audited stable ${latest.apiVersion}`);
const byMajor=audited.reduce((m,x)=>{const k=parts(x.qbVersion)[0];m[k]=(m[k]||0)+1;return m;},{}),majorSummary=Object.entries(byMajor).sort((a,b)=>Number(a[0])-Number(b[0])).map(([major,count])=>`${count} qB ${major}.x`).join(' + ');
if(fullAudit)console.log(`Full upstream qB release audit passed: ${audited.length} official stable tags (${majorSummary}), ${audited[0].qbVersion} -> ${latest.qbVersion}; master WebAPI ${masterApi}.`);else console.log(`Representative upstream audit passed: ${audited.map(x=>`${x.qbVersion}/WebAPI ${x.apiVersion}`).join(' + ')}.`);

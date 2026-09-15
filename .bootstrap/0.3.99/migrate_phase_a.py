from pathlib import Path
import re

ROOT = Path.cwd()

def text(path):
    return (ROOT/path).read_text(encoding="utf-8")

def write(path, value):
    (ROOT/path).write_text(value, encoding="utf-8")

def replace_once(path, old, new):
    s = text(path)
    if old not in s:
        raise SystemExit(f"anchor missing in {path}: {old[:120]!r}")
    if s.count(old) != 1:
        raise SystemExit(f"anchor count {s.count(old)} in {path}: {old[:120]!r}")
    write(path, s.replace(old, new, 1))

def replace_all_checked(path, old, new, min_count=1):
    s = text(path)
    n = s.count(old)
    if n < min_count:
        raise SystemExit(f"expected >= {min_count} occurrences in {path}, got {n}: {old!r}")
    write(path, s.replace(old, new))

# 1) Correct QBClient release/audit fixtures to use the actual compatibility owner.
p = "tests/release-compat.mjs"
s = text(p)
s = s.replace("const releaseProfile={", "const capabilityRegistry={")
s = s.replace("WeiG:{ReleaseProfile:releaseProfile,", "WeiG:{CapabilityRegistry:capabilityRegistry,")
s = s.replace("releaseProfile.resolveTorrentAction", "capabilityRegistry.resolveTorrentAction")
old = "activeFixture=matrix.fixtures.find(x=>x.realRelease);assert.ok(activeFixture,'matrix must provide one real release for fail-closed contract checks');const contractClient=await detect(activeFixture),contractCalls=capture(contractClient),savedReleaseProfile=sandbox.window.WeiG.ReleaseProfile;sandbox.window.WeiG.ReleaseProfile=null;"
new = "activeFixture=matrix.fixtures.find(x=>x.realRelease);assert.ok(activeFixture,'matrix must provide one real release for fail-closed contract checks');const contractClient=await detect(activeFixture),contractCalls=capture(contractClient),savedCapabilityRegistry=sandbox.window.WeiG.CapabilityRegistry;sandbox.window.WeiG.CapabilityRegistry=null;"
if old not in s: raise SystemExit("release-compat fail-closed anchor missing")
s = s.replace(old,new)
s = s.replace("sandbox.window.WeiG.ReleaseProfile=savedReleaseProfile;", "sandbox.window.WeiG.CapabilityRegistry=savedCapabilityRegistry;")
if "ReleaseProfile" in s:
    raise SystemExit("release-compat still references ReleaseProfile")
write(p,s)

p = "tests/upstream-release-audit.mjs"
s = text(p)
s = s.replace("const releaseProfile={", "const capabilityRegistry={")
old = "  resolveTorrentAction(kind){const actions=activeTruth?.actions||new Set();const choices=kind==='start'?[['torrentscontroller.h:startAction','start'],['torrentscontroller.h:resumeAction','resume']]:[['torrentscontroller.h:stopAction','stop'],['torrentscontroller.h:pauseAction','pause']];for(const [fact,action] of choices)if(actions.has(fact))return action;return null;},\n  isCertified(){return !!activeTruth;}"
new = "  resolveTorrentAction(kind){const actions=activeTruth?.actions||new Set();const choices=kind==='start'?[['torrentscontroller.h:startAction','start'],['torrentscontroller.h:resumeAction','resume']]:[['torrentscontroller.h:stopAction','stop'],['torrentscontroller.h:pauseAction','pause']];for(const [fact,action] of choices)if(actions.has(fact))return action;return null;},\n  resolveTorrentActionDescriptor(kind){const endpoint=this.resolveTorrentAction(kind);return endpoint?{sourceAction:`source:${endpoint}`,endpoint,parameters:['hashes'],required:['hashes'],optional:[]}:null;},\n  isCertified(){return !!activeTruth;}"
if old not in s: raise SystemExit("upstream descriptor anchor missing")
s = s.replace(old,new)
s = s.replace("WeiG:{ReleaseProfile:releaseProfile,", "WeiG:{CapabilityRegistry:capabilityRegistry,")
s = s.replace("certification belongs to ReleaseProfile/CapabilityRegistry", "certification belongs to CapabilityRegistry")
if "ReleaseProfile" in s:
    raise SystemExit("upstream-release-audit still references ReleaseProfile")
write(p,s)

# 2) Browser/runtime contracts should observe CapabilityRegistry, the actual browser owner.
browser_repls = {
    "tests/browser-adaptive-ui.mjs":[
        ("WeiG.ReleaseProfile?.isCertified()","WeiG.CapabilityRegistry?.isCertified()"),
    ],
    "tests/browser-feature-parity.mjs":[
        ("WeiG.ReleaseProfile?.isCertified()","WeiG.CapabilityRegistry?.isCertified()"),
        ("WeiG.ReleaseProfile.current().qbVersion","WeiG.CapabilityRegistry.releaseIdentity().qbVersion"),
    ],
    "tests/browser-sidebar-capability-visual.mjs":[
        ("window.WeiG?.ReleaseProfile?.current()?.qbVersion","window.WeiG?.CapabilityRegistry?.releaseIdentity()?.qbVersion"),
        ("window.WeiG.ReleaseProfile.current().qbVersion","window.WeiG.CapabilityRegistry.releaseIdentity().qbVersion"),
    ],
}
for path, repls in browser_repls.items():
    s=text(path)
    for old,new in repls:
        if old not in s: raise SystemExit(f"{path}: missing {old}")
        s=s.replace(old,new)
    write(path,s)

# 3) Current-plan and Detail static contracts must protect Registry ownership, not the retired file.
p="tests/current-plan-contract.mjs"
s=text(p)
s=s.replace("const releaseProfile=read('webui/private/scripts/release-profile.js');", "const capabilities=read('webui/private/scripts/capabilities.js');")
s=s.replace("through ReleaseProfile source provenance", "through CapabilityRegistry source provenance")
s=s.replace("assert.match(releaseProfile,/superseeding:\\[\\['torrentscontroller\\.h:setSuperSeedingAction','setSuperSeeding'\\]\\]/,'ReleaseProfile must resolve Super Seeding from exact source actions.');",
            "assert.match(capabilities,/superseeding:\\[\\['torrentscontroller\\.h:setSuperSeedingAction','setSuperSeeding'\\]\\]/,'CapabilityRegistry must resolve Super Seeding from exact source actions.');")
s=s.replace("assert.match(releaseProfile,/increase:\\[\\['torrentscontroller\\.h:increasePrioAction','increasePrio'\\]\\]/,'ReleaseProfile must resolve queue-up from exact source actions.');",
            "assert.match(capabilities,/increase:\\[\\['torrentscontroller\\.h:increasePrioAction','increasePrio'\\]\\]/,'CapabilityRegistry must resolve queue-up from exact source actions.');")
s=s.replace("assert.match(releaseProfile,/decrease:\\[\\['torrentscontroller\\.h:decreasePrioAction','decreasePrio'\\]\\]/,'ReleaseProfile must resolve queue-down from exact source actions.');",
            "assert.match(capabilities,/decrease:\\[\\['torrentscontroller\\.h:decreasePrioAction','decreasePrio'\\]\\]/,'CapabilityRegistry must resolve queue-down from exact source actions.');")
if "releaseProfile" in s: raise SystemExit("current-plan still releaseProfile")
write(p,s)

p="tests/detail-runtime-contract.mjs"
s=text(p)
s=s.replace("const releaseProfile=read('webui/private/scripts/release-profile.js');", "const capabilities=read('webui/private/scripts/capabilities.js');")
old="""for(const owner of ['torrentPropertiesFields','torrentTrackerFields','torrentFileFields','torrentWebSeedFields'])assert.match(releaseProfile,new RegExp(`function ${owner}\\\\(\\\\)`),`${owner} must remain a ReleaseProfile runtime owner`);
assert.match(releaseProfile,/function hasTorrentDetailField\\(surface,name\\)/,'ReleaseProfile must own per-field Detail provenance');
assert.match(releaseProfile,/function torrentDetailUi\\(\\)\\{if\\(!isCertified\\(\\)\\|\\|!current\\|\\|current\\.fallback\\)return null;/,'ReleaseProfile must expose Detail UI only for exact/equivalent certified profiles');
assert.match(releaseProfile,/torrentPropertiesFields:\\[\\],torrentTrackerFields:\\[\\],torrentFileFields:\\[\\],torrentWebSeedFields:\\[\\],torrentDetailUi:null/,'fallback releases must expose no guessed Detail facts');"""
new="""assert.match(capabilities,/function detailFields\\(surface\\)/,'CapabilityRegistry must own per-surface Detail response-field provenance');
assert.match(capabilities,/function hasTorrentDetailField\\(surface,name\\)/,'CapabilityRegistry must own per-field Detail provenance');
assert.match(capabilities,/function torrentDetailUi\\(\\)\\{if\\(!isCertified\\(\\)\\)return null;/,'CapabilityRegistry must expose Detail UI only for exact/equivalent certified releases');
assert.match(capabilities,/function sourceFact\\(name\\)\\{if\\(!current\\|\\|current\\.fallback\\|\\|!data\\|\\|!data\\.sourceFacts\\)return null;/,'fallback releases must expose no guessed compact source facts');"""
if old not in s: raise SystemExit("detail-runtime legacy owner block missing")
s=s.replace(old,new)
write(p,s)

# 4) Compatibility architecture remains transitional until the orphan runtime file is physically deleted in Phase B.

# 5) Build a single offline source->compact compiler/runtime harness for release-grade tests.
helper = r"""import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const clone=value=>value==null?value:structuredClone(value);
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export const TORRENT_FACTS=['torrentFilters','torrentInfoParameters','torrentInfoFields','torrentStates','torrentPropertiesFields','torrentTrackerFields','torrentFileFields','torrentWebSeedFields','torrentTableColumns','webuiLocales'];

function releaseRows(catalog){return catalog.map(profile=>({qbVersion:String(profile.qbVersion||''),webApiVersion:String(profile.webApiVersion||''),sourceSha:String(profile.sourceSha||''),stable:profile.stable!==false,officialWeiGSupport:profile.officialWeiGSupport!==false}));}
function factTimeline(catalog,key){return catalog.map(profile=>({from:String(profile.qbVersion||''),value:clone(Object.prototype.hasOwnProperty.call(profile,key)?profile[key]:null)}));}
function actionValue(profile,action){if(!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;const raw=profile.apiActionParameters&&profile.apiActionParameters[action]||{};return{parameters:Array.isArray(raw.parameters)?raw.parameters.map(String):[],required:Array.isArray(raw.required)?raw.required.map(String):[],optional:Array.isArray(raw.optional)?raw.optional.map(String):[],parameterOptions:raw.parameterOptions&&typeof raw.parameterOptions==='object'?clone(raw.parameterOptions):{}};}
function descriptorValue(profile,key,fields){const item=(profile.preferenceDescriptors||[]).find(entry=>String(entry?.key||'')===key);if(!item)return null;const value={};for(const field of fields)value[field]=Object.prototype.hasOwnProperty.call(item,field)?clone(item[field]):null;return value;}

export function compileCompactRuntime(catalog){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Compact runtime compiler requires a non-empty source catalog.');
  const capabilityData=readJson(path.join(root,'webui/private/data/capabilities.json'));
  const torrentData=readJson(path.join(root,'webui/private/data/torrent-compat.json'));
  const detailData=readJson(path.join(root,'webui/private/data/detail-compat.json'));
  const actionData=readJson(path.join(root,'webui/private/data/source-actions.json'));
  const settingsData=readJson(path.join(root,'webui/private/data/settings-compat.json'));
  capabilityData.releases=releaseRows(catalog);
  torrentData.sourceFacts={};for(const key of TORRENT_FACTS)torrentData.sourceFacts[key]=factTimeline(catalog,key);
  detailData.sourceFacts={torrentDetailUi:factTimeline(catalog,'torrentDetailUi')};
  const names=new Set(Object.keys(actionData.sourceActions||{}));for(const profile of catalog)for(const action of profile.apiActions||[])names.add(String(action));
  actionData.sourceActions={};for(const action of names)actionData.sourceActions[action]=catalog.map(profile=>({from:String(profile.qbVersion||''),value:actionValue(profile,action)}));
  const prefNames=new Set(Object.keys(settingsData.preferences||{}));for(const profile of catalog)for(const item of profile.preferenceDescriptors||[])if(item?.key)prefNames.add(String(item.key));
  settingsData.preferences={};for(const key of prefNames)settingsData.preferences[key]=catalog.map(profile=>({from:String(profile.qbVersion||''),value:descriptorValue(profile,key,settingsData.fields||[])}));
  return{capabilityData,torrentData,detailData,actionData,settingsData};
}

function defaultDocument(){return{addEventListener(){},querySelectorAll(){return[];},createElement(){return{className:'',dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},querySelector(){return null;},querySelectorAll(){return[];},remove(){}};},body:{appendChild(){}}};}
function TestFormData(){this.entries=[];}TestFormData.prototype.append=function(name,value,filename){this.entries.push({name,value,filename});};TestFormData.prototype.get=function(name){const hit=this.entries.find(item=>item.name===name);return hit?hit.value:null;};

export function createCompactRuntime(catalog,{owners=['capabilities.js','torrent-semantics.js','torrent-fields.js'],W:providedW=null,document:providedDocument=null}={}){
  const compact=compileCompactRuntime(catalog),requests=[];
  const W=providedW||{buildAssetUrl:x=>x,t:key=>key,util:{parseScalar:value=>value,normalizeTracker:value=>String(value||''),form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
  if(!W.buildAssetUrl)W.buildAssetUrl=x=>x;if(!W.t)W.t=key=>key;if(!W.util)W.util={};if(!W.util.parseScalar)W.util.parseScalar=value=>value;if(!W.util.normalizeTracker)W.util.normalizeTracker=value=>String(value||'');if(!W.util.form)W.util.form=obj=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();};if(!W.I18n)W.I18n={getLocale:()=> 'en-US'};
  const window={WeiG:W,window:null,dispatchEvent(){},addEventListener(){},requestAnimationFrame:fn=>fn()};window.window=window;
  const document=providedDocument||defaultDocument();
  const responses=new Map([['capabilities.json',compact.capabilityData],['torrent-compat.json',compact.torrentData],['detail-compat.json',compact.detailData],['source-actions.json',compact.actionData],['settings-compat.json',compact.settingsData]]);
  const fetch=async url=>{const value=String(url);requests.push(value);for(const [name,data] of responses)if(value.includes(name))return{ok:true,status:200,json:async()=>clone(data),text:async()=>JSON.stringify(data)};throw new Error(`Unexpected compact-runtime fetch ${value}`);};
  const context={window,document,console,URL,URLSearchParams,FormData:globalThis.FormData||TestFormData,Blob:globalThis.Blob,CustomEvent:class{},requestAnimationFrame:fn=>fn(),fetch};
  for(const name of owners){const source=fs.readFileSync(path.join(root,'webui/private/scripts',name),'utf8');vm.runInNewContext(source,context,{filename:name});}
  return{W,window,document,context,compact,requests};
}
"""
write("tools/qb-compact-runtime.mjs", helper)

# Refactor the product-diff tool to consume the one offline compact compiler.
p="tools/qb-product-capability-diff.mjs"
s=text(p)
s=s.replace("import vm from 'node:vm';\n", "")
s=s.replace("import {fileURLToPath,pathToFileURL} from 'node:url';", "import {fileURLToPath,pathToFileURL} from 'node:url';\nimport {createCompactRuntime} from './qb-compact-runtime.mjs';")
start=s.index("const clone=value=>")
end=s.index("export async function summarizeProductProfile")
replacement="const ACTIONS=['start','stop','delete','force','recheck','sequential','firstlast','autotmm','top','bottom','rename','location','category','dllimit','uplimit','addTrackers','reannounce','removeTrackers','editTracker','tags'];\nconst PRODUCT_OWNERS=['capabilities.js','torrent-semantics.js','torrent-fields.js'];\n\n"
s=s[:start]+replacement+s[end:]
s=s.replace("const rt=shared||runtime(catalog)", "const rt=shared||createCompactRuntime(catalog,{owners:PRODUCT_OWNERS})")
s=s.replace("const shared=runtime(candidate)", "const shared=createCompactRuntime(candidate,{owners:PRODUCT_OWNERS})")
s=s.replace("capabilities:rt.featureIds.filter(id=>C.supports(id))", "capabilities:Object.keys(rt.compact.capabilityData.features||{}).sort().filter(id=>C.supports(id))")
write(p,s)

# 6) Rewrite the obsolete release-profile contract as a CapabilityRegistry release-resolution contract.
release_contract = r"""import assert from 'node:assert/strict';
import {createCompactRuntime} from '../tools/qb-compact-runtime.mjs';

const sha4='1111111111111111111111111111111111111111';
const sha5='0b63c3d17373f6132ea211c9dcd4241284ccdfaf';
const profiles=[
  {qbVersion:'4.1.0',webApiVersion:'2.0.0',sourceSha:sha4,stable:true,officialWeiGSupport:true,apiActions:['appcontroller.h:preferencesAction','appcontroller.h:setPreferencesAction','torrentscontroller.h:resumeAction','torrentscontroller.h:pauseAction','torrentscontroller.h:recheckAction','torrentscontroller.h:addTrackersAction','torrentscontroller.h:propertiesAction','torrentscontroller.h:filesAction','torrentscontroller.h:trackersAction','torrentscontroller.h:webseedsAction'],apiActionParameters:{'torrentscontroller.h:resumeAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:pauseAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:recheckAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:addTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','paused','resumed'],torrentInfoParameters:['filter','category'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags'],torrentStates:['downloading','stalledDL','uploading','stalledUP','pausedDL','pausedUP','checkingDL','checkingUP','error','missingFiles'],torrentPropertiesFields:['save_path','total_size','share_ratio'],torrentTrackerFields:['url','status','num_peers'],torrentFileFields:['name','size','progress','priority'],torrentWebSeedFields:['url'],preferenceDescriptors:[{key:'save_path',getterPresent:true,setterPresent:true,readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true}]},
  {qbVersion:'5.2.3',webApiVersion:'2.15.1',sourceSha:sha5,stable:true,officialWeiGSupport:true,apiActions:['appcontroller.h:preferencesAction','appcontroller.h:setPreferencesAction','torrentscontroller.h:startAction','torrentscontroller.h:stopAction','torrentscontroller.h:tagsAction','torrentscontroller.h:reannounceAction','torrentscontroller.h:removeTrackersAction','torrentscontroller.h:propertiesAction','torrentscontroller.h:filesAction','torrentscontroller.h:trackersAction','torrentscontroller.h:webseedsAction'],apiActionParameters:{'torrentscontroller.h:startAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:stopAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:reannounceAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:removeTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','stopped','running','stalled'],torrentInfoParameters:['filter','tag'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','private'],torrentStates:['downloading','stalledDL','uploading','stalledUP','stoppedDL','stoppedUP','checkingDL','checkingUP','moving','error','missingFiles'],torrentPropertiesFields:['save_path','download_path','private','pieces_num','piece_size'],torrentTrackerFields:['url','status','num_seeds','tier'],torrentFileFields:['index','name','size','progress','priority'],torrentWebSeedFields:['url'],preferenceDescriptors:[{key:'save_path',getterPresent:true,setterPresent:true,readType:'string',writeType:'string',typeAgreement:'EXACT',writable:true}]}
];
const rt=createCompactRuntime(profiles,{owners:['settings-schema.js','capabilities.js']});
const C=rt.W.CapabilityRegistry,S=rt.W.SettingsSchema;
assert.ok(C&&typeof C.bind==='function'&&typeof C.resolveTorrentActionDescriptor==='function','CapabilityRegistry must own compact release/source compatibility facts');
assert.equal(rt.requests.length,0,'compact contracts must load lazily');

let client={qbVersion:'v4.1.0',webApiVersion:'2.0.0',capabilities:{}};
await C.bind(client);
let release=C.releaseIdentity();
assert(C.isCertified()&&C.hasWriteProvenance(),'qB 4.1.0 exact compact release must be certified for writes');
assert.equal(release.qbVersion,'4.1.0');
assert.equal(release.resolutionMode,'EXACT');
assert.equal(release.resolvedFrom,'4.1.0');
assert(C.hasAction('appcontroller.h:preferencesAction')&&C.hasAction('appcontroller.h:setPreferencesAction'));
assert.deepEqual(Array.from(C.torrentFilters()),['all','downloading','seeding','stopped','running']);
assert.equal(C.upstreamTorrentFilter('stopped'),'paused');
assert.equal(C.upstreamTorrentFilter('running'),'resumed');
assert.equal(C.resolveTorrentActionDescriptor('start')?.endpoint,'resume');
assert.equal(C.resolveTorrentActionDescriptor('stop')?.endpoint,'pause');
assert.equal(C.resolveTorrentActionDescriptor('reannounce'),null);
assert.equal(C.supportsTorrentAction('removeTrackers'),false);
assert(C.hasTorrentInfoField('category')&&C.hasTorrentInfoField('tags')&&!C.hasTorrentInfoField('private'));
assert(C.torrentStates().includes('stalledDL')&&C.torrentStates().includes('checkingUP'));
assert(C.hasTorrentDetailField('properties','save_path')&&!C.hasTorrentDetailField('properties','private'));
assert(C.hasTorrentDetailField('trackers','num_peers')&&!C.hasTorrentDetailField('trackers','num_seeds'));
assert(C.hasTorrentDetailField('files','priority')&&!C.hasTorrentDetailField('files','index'));
assert.equal(S.descriptor('save_path')?.writable,true);

client={qbVersion:'5.2.3',webApiVersion:'2.15.1',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert(C.isCertified()&&release.qbVersion==='5.2.3'&&release.sourceSha===sha5);
assert.equal(C.resolveTorrentActionDescriptor('start')?.endpoint,'start');
assert.equal(C.resolveTorrentActionDescriptor('stop')?.endpoint,'stop');
assert.equal(C.resolveTorrentActionDescriptor('reannounce')?.endpoint,'reannounce');
assert.equal(C.resolveTorrentActionDescriptor('removeTrackers')?.endpoint,'removeTrackers');
assert(C.supportsTorrentFilter('stalled')&&C.hasTorrentInfoField('private')&&C.hasAction('torrentscontroller.h:tagsAction'));
assert(C.hasTorrentDetailField('properties','private')&&C.hasTorrentDetailField('properties','download_path'));
assert(C.hasTorrentDetailField('trackers','num_seeds')&&C.hasTorrentDetailField('files','index'));

client={qbVersion:'5.2.3-r1',webApiVersion:'2.15.1',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert(C.isCertified()&&C.hasWriteProvenance()&&release.qbVersion==='5.2.3');
assert.equal(release.resolutionMode,'EQUIVALENT');
assert.equal(release.detectedQbVersion,'5.2.3-r1');

client={qbVersion:'5.2.3.1',webApiVersion:'2.15.1',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert(!C.isCertified()&&!C.hasWriteProvenance()&&release.qbVersion==='5.2.3');
assert.equal(release.resolutionMode,'INHERITED');
assert.equal(release.resolvedFrom,'5.2.3');
assert(C.hasAction('torrentscontroller.h:tagsAction')&&C.hasTorrentInfoField('private'));
assert(!C.supportsTorrentAction('start'));
assert.equal(S.descriptor('save_path')?.writable,false);

client={qbVersion:'5.2.4',webApiVersion:'2.15.1',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert.equal(release.qbVersion,'5.2.3');
assert.equal(release.resolutionMode,'INHERITED');
assert(!C.hasWriteProvenance()&&!C.supportsTorrentAction('start'));

client={qbVersion:'5.2.4',webApiVersion:'2.14.0',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert.equal(release.fallback,true);
assert.equal(release.resolutionMode,'FALLBACK');
assert(!C.hasWriteProvenance());

client={qbVersion:'4.9.99',webApiVersion:'2.9.3',capabilities:{}};
await C.bind(client);release=C.releaseIdentity();
assert.equal(release.fallback,true);
assert(!C.isCertified()&&!C.hasWriteProvenance());
assert.equal(C.resolveTorrentActionDescriptor('start'),null);
assert.equal(C.upstreamTorrentFilter('stopped'),null);
assert.equal(C.hasTorrentInfoField('tags'),false);
assert.equal(C.supportsTorrentFilter('stalled'),false);
assert.equal(S.descriptor('save_path'),null);

assert.equal(rt.requests.filter(url=>url.includes('capabilities.json')).length,1);
assert.equal(rt.requests.filter(url=>url.includes('torrent-compat.json')).length,1);
assert.equal(rt.requests.filter(url=>url.includes('detail-compat.json')).length,1);
assert.equal(rt.requests.filter(url=>url.includes('source-actions.json')).length,1);
assert.equal(rt.requests.filter(url=>url.includes('settings-compat.json')).length,1);
assert.equal(rt.requests.some(url=>url.includes('qb-releases.json')||url.includes('qb-release-profiles/')),false,'browser compatibility resolution must not fetch retired release catalogs or profile shards');

console.log('Capability release-resolution contract passed: exact/equivalent releases own writes, inherited releases retain proven read facts while writes close, fallback is source-empty, and runtime loads compact contracts only.');
"""
write("tests/release-profile-contract.mjs", release_contract)

# 7) Migrate full-stable tests that used release-profile.js to the source->compact harness.
def migrate_full(path, harness_old, harness_new, body_repls):
    s=text(path)
    if harness_old not in s:
        raise SystemExit(f"{path}: full harness anchor missing")
    s=s.replace(harness_old,harness_new)
    for old,new in body_repls:
        if old not in s:
            raise SystemExit(f"{path}: missing body anchor {old!r}")
        s=s.replace(old,new)
    write(path,s)

common_import="import {createCompactRuntime} from '../tools/qb-compact-runtime.mjs';\n"

# core
p="tests/full-stable-core-write-compat.mjs"; s=text(p)
s=s.replace("import {fileURLToPath} from 'node:url';\n", "import {fileURLToPath} from 'node:url';\n"+common_import)
old="""const releaseSource=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const clientSource=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const W={buildAssetUrl:x=>x,util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
const window={WeiG:W,window:null,dispatchEvent(){}};window.window=window;
const context={window,console,URLSearchParams,FormData,Blob,CustomEvent:class{},fetch:async url=>{if(String(url).includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};throw new Error(`Unexpected fetch ${url}`);}};
vm.runInNewContext(releaseSource,context,{filename:'release-profile.js'});
vm.runInNewContext(clientSource,context,{filename:'qb-client.js'});
const R=W.ReleaseProfile,Client=W.QBClient;
assert.ok(R&&Client,'ReleaseProfile and QBClient must load');"""
new="""const {W}=createCompactRuntime(catalog,{owners:['capabilities.js','qb-client.js']});
const R=W.CapabilityRegistry,Client=W.QBClient;
assert.ok(R&&Client,'CapabilityRegistry and QBClient must load');"""
if old not in s: raise SystemExit("core harness missing")
s=s.replace(old,new)
s=s.replace("endpoint must follow ReleaseProfile source owner","endpoint must follow CapabilityRegistry source owner")
write(p,s)

# app aux
p="tests/full-stable-app-aux-compat.mjs"; s=text(p)
s=s.replace("import {fileURLToPath} from 'node:url';\n", "import {fileURLToPath} from 'node:url';\n"+common_import)
old="""const releaseSource=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const clientSource=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const W={buildAssetUrl:x=>x,util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
const window={WeiG:W,window:null,dispatchEvent(){}};window.window=window;
const context={window,console,URLSearchParams,FormData,Blob,CustomEvent:class{},fetch:async url=>{if(String(url).includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};throw new Error(`Unexpected fetch ${url}`);}};
vm.runInNewContext(releaseSource,context,{filename:'release-profile.js'});
vm.runInNewContext(clientSource,context,{filename:'qb-client.js'});
const R=W.ReleaseProfile,Client=W.QBClient;
assert.ok(R&&Client,'ReleaseProfile and QBClient must load');"""
new="""const {W}=createCompactRuntime(catalog,{owners:['capabilities.js','qb-client.js']});
const R=W.CapabilityRegistry,Client=W.QBClient;
assert.ok(R&&Client,'CapabilityRegistry and QBClient must load');"""
if old not in s: raise SystemExit("app aux harness missing")
s=s.replace(old,new)
write(p,s)

# baseline
p="tests/full-stable-baseline-write-compat.mjs"; s=text(p)
s=s.replace("import {fileURLToPath} from 'node:url';\n", "import {fileURLToPath} from 'node:url';\n"+common_import)
old="""const releaseSource=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const clientSource=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const W={buildAssetUrl:x=>x,util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
const window={WeiG:W,window:null,dispatchEvent(){}};window.window=window;
const context={window,console,URLSearchParams,FormData,Blob,CustomEvent:class{},fetch:async url=>{if(String(url).includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};throw new Error(`Unexpected fetch ${url}`);}};
vm.runInNewContext(releaseSource,context,{filename:'release-profile.js'});vm.runInNewContext(clientSource,context,{filename:'qb-client.js'});
const R=W.ReleaseProfile,Client=W.QBClient;"""
new="""const {W}=createCompactRuntime(catalog,{owners:['capabilities.js','qb-client.js']});
const R=W.CapabilityRegistry,Client=W.QBClient;"""
if old not in s: raise SystemExit("baseline harness missing")
s=s.replace(old,new)
write(p,s)

# detail
p="tests/full-stable-detail-compat.mjs"; s=text(p)
s=s.replace("import {fileURLToPath} from 'node:url';\n", "import {fileURLToPath} from 'node:url';\n"+common_import)
old="""const source=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const W={buildAssetUrl:x=>x};
const window={WeiG:W,dispatchEvent(){}};window.window=window;
const context={window,console,CustomEvent:class{},fetch:async()=>({ok:true,status:200,json:async()=>catalog})};
vm.runInNewContext(source,context,{filename:'release-profile.js'});
const R=W.ReleaseProfile;
assert.ok(R&&typeof R.detailFields==='function'&&typeof R.hasTorrentDetailField==='function','ReleaseProfile detail provenance owner must load');"""
new="""const {W}=createCompactRuntime(catalog,{owners:['capabilities.js']});
const R=W.CapabilityRegistry;
assert.ok(R&&typeof R.hasTorrentDetailField==='function','CapabilityRegistry detail provenance owner must load');"""
if old not in s: raise SystemExit("detail harness missing")
s=s.replace(old,new)
s=s.replace("const runtime=Array.from(R.detailFields(surface));\n    assert.deepEqual(runtime,expected,`${profile.qbVersion}: ${surface} response fields diverged from source-derived catalog`);\n    assert.equal(new Set(runtime).size,runtime.length,`${profile.qbVersion}: ${surface} response field surface contains duplicates`);\n    for(const field of runtime)assert.equal(R.hasTorrentDetailField(surface,field),true,`${profile.qbVersion}: ${surface}.${field} must be queryable through runtime owner`);",
"""const runtime=expected.filter(field=>R.hasTorrentDetailField(surface,field));
    assert.deepEqual(runtime,expected,`${profile.qbVersion}: ${surface} response fields diverged from source-derived compact contract`);
    assert.equal(new Set(runtime).size,runtime.length,`${profile.qbVersion}: ${surface} response field surface contains duplicates`);
    assert.equal(R.hasTorrentDetailField(surface,'__weigg_missing_field__'),false,`${profile.qbVersion}: ${surface} must fail closed for an unknown field`);""")
s=s.replace("R.current()?.qbVersion","R.releaseIdentity()?.qbVersion").replace("R.current()?.sourceSha","R.releaseIdentity()?.sourceSha")
write(p,s)

# torrent creator
p="tests/full-stable-torrent-creator-compat.mjs"; s=text(p)
s=s.replace("import {fileURLToPath} from 'node:url';\n", "import {fileURLToPath} from 'node:url';\n"+common_import)
old="""const releaseSource=fs.readFileSync(path.join(root,'webui/private/scripts/release-profile.js'),'utf8');
const clientSource=fs.readFileSync(path.join(root,'webui/private/scripts/qb-client.js'),'utf8');
const W={buildAssetUrl:x=>x,util:{form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
const window={WeiG:W,window:null,dispatchEvent(){}};window.window=window;
const context={window,console,URLSearchParams,FormData,Blob,CustomEvent:class{},fetch:async url=>{if(String(url).includes('qb-releases.json'))return{ok:true,status:200,json:async()=>catalog};throw new Error(`Unexpected fetch ${url}`);}};
vm.runInNewContext(releaseSource,context,{filename:'release-profile.js'});
vm.runInNewContext(clientSource,context,{filename:'qb-client.js'});
const R=W.ReleaseProfile,Client=W.QBClient;
assert.ok(R&&Client,'ReleaseProfile and QBClient must load');"""
new="""const {W}=createCompactRuntime(catalog,{owners:['capabilities.js','qb-client.js']});
const R=W.CapabilityRegistry,Client=W.QBClient;
assert.ok(R&&Client,'CapabilityRegistry and QBClient must load');"""
if old not in s: raise SystemExit("creator harness missing")
s=s.replace(old,new)
write(p,s)

# Product matrix
p="tests/full-stable-product-compat.mjs"; s=text(p)
s=s.replace("import {fileURLToPath} from 'node:url';\n", "import {fileURLToPath} from 'node:url';\n"+common_import)
start=s.index("const capabilityData=")
end=s.index("const currentColumnFields=")
newh="""const {W}=createCompactRuntime(catalog,{owners:['settings-schema.js','capabilities.js','torrent-fields.js','torrent-semantics.js','qb-client.js']});
const F=W.TorrentFieldRegistry,C=W.CapabilityRegistry,T=W.TorrentSemantics,S=W.SettingsSchema,Client=W.QBClient;
assert.ok(F&&C&&T&&S&&Client,'formal compact product compatibility owners must load');

"""
s=s[:start]+newh+s[end:]
s=s.replace("const desc=R.resolveTorrentActionDescriptor(kind);","const desc=C.resolveTorrentActionDescriptor(kind);")
s=s.replace("  assert.equal(R.current()?.qbVersion,profile.qbVersion,`${profile.qbVersion}: ReleaseProfile exact bind`);\n  assert.equal(R.current()?.sourceSha,profile.sourceSha,`${profile.qbVersion}: ReleaseProfile source SHA drift`);\n  assert.equal(R.isCertified(),true,`${profile.qbVersion}: official stable profile must certify`);",
"""  const release=C.releaseIdentity();
  assert.equal(release?.qbVersion,profile.qbVersion,`${profile.qbVersion}: CapabilityRegistry exact bind`);
  assert.equal(release?.sourceSha,profile.sourceSha,`${profile.qbVersion}: CapabilityRegistry source SHA drift`);
  assert.equal(C.isCertified(),true,`${profile.qbVersion}: official stable profile must certify`);""")
s=s.replace("`torrents/${R.resolveTorrentAction('start')}`","`torrents/${C.resolveTorrentActionDescriptor('start').endpoint}`")
s=s.replace("`torrents/${R.resolveTorrentAction('stop')}`","`torrents/${C.resolveTorrentActionDescriptor('stop').endpoint}`")
s=s.replace("diverged from ReleaseProfile","diverged from CapabilityRegistry")
s=s.replace("if(R.supportsTorrentAction('reannounce'))","if(C.supportsTorrentAction('reannounce'))")
s=s.replace("if(R.supportsTorrentAction('removeTrackers'))","if(C.supportsTorrentAction('removeTrackers'))")
s=s.replace("  S.bindProfile(R.current());","  await S.bindRelease(C.releaseIdentity());")
s=s.replace(".filter(x=>R.supportsTorrentAction(x)).length",".filter(x=>C.supportsTorrentAction(x)).length")
if "W.ReleaseProfile" in s or "release-profile.js" in s or "R." in s:
    raise SystemExit("full-stable-product still has ReleaseProfile/R refs")
write(p,s)

# Product compatibility focused contract: rebuild around the compact harness.
p="tests/product-compatibility-contract.mjs"
product_contract = r"""import assert from 'node:assert/strict';
import {createCompactRuntime} from '../tools/qb-compact-runtime.mjs';

const catalog=[
 {qbVersion:'4.1.0',webApiVersion:'2.0.0',sourceSha:'1'.repeat(40),stable:true,officialWeiGSupport:true,apiActions:['torrentscontroller.h:resumeAction','torrentscontroller.h:pauseAction','torrentscontroller.h:recheckAction','torrentscontroller.h:addTrackersAction'],apiActionParameters:{'torrentscontroller.h:resumeAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:pauseAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:addTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','completed','paused','resumed','active','inactive','errored'],torrentInfoParameters:['filter','category','sort','reverse','limit','offset'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','tracker','save_path'],torrentStates:['downloading','stalledDL','uploading','stalledUP','pausedDL','pausedUP','checkingDL','checkingUP','error','missingFiles'],preferenceDescriptors:[]},
 {qbVersion:'5.2.3',webApiVersion:'2.15.1',sourceSha:'2'.repeat(40),stable:true,officialWeiGSupport:true,apiActions:['torrentscontroller.h:startAction','torrentscontroller.h:stopAction','torrentscontroller.h:reannounceAction','torrentscontroller.h:removeTrackersAction'],apiActionParameters:{'torrentscontroller.h:startAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:stopAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:reannounceAction':{parameters:['hashes'],required:['hashes'],optional:[]},'torrentscontroller.h:removeTrackersAction':{parameters:['hash','urls'],required:['hash','urls'],optional:[]}},torrentFilters:['all','downloading','seeding','completed','stopped','running','active','inactive','stalled','errored'],torrentInfoParameters:['filter','category','tag','sort','reverse','limit','offset'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags','private','tracker','save_path'],torrentStates:['downloading','stalledDL','uploading','stalledUP','stoppedDL','stoppedUP','checkingDL','checkingUP','moving','error','missingFiles'],preferenceDescriptors:[]}
];
const {W}=createCompactRuntime(catalog,{owners:['capabilities.js','torrent-semantics.js','qb-client.js']});
const C=W.CapabilityRegistry,T=W.TorrentSemantics,Client=W.QBClient;

let client=new Client();client.qbVersion='4.1.0';client.webApiVersion='2.0.0';client.major=4;await C.bind(client);
assert(C.isCertified(),'qB4 exact stable compact release must bind');
assert(C.hasTorrentInfoField('category')&&C.hasTorrentInfoField('tags'));
assert.equal(T.filterMode('stalled'),'local');
assert.equal(T.filterMode('checking'),'local');
assert(T.matchesStatus({state:'stalledDL',progress:.4,dlspeed:0,upspeed:0},'stalled',[]));
assert(T.matchesStatus({state:'checkingUP',progress:1,dlspeed:0,upspeed:0},'checking',[]));
assert(!T.isSupportedFilter('private'));
let requests=[];client.request=(path,options)=>{requests.push({path,options});return Promise.resolve(null);};
await assert.rejects(client.reannounce('a'));await assert.rejects(client.removeTrackers('a','https://tracker.example/announce'));assert.equal(requests.length,0);

client=new Client();client.qbVersion='5.2.3';client.webApiVersion='2.15.1';client.major=5;await C.bind(client);requests=[];client.request=(path,options)=>{requests.push({path,options});return Promise.resolve(null);};await client.reannounce('b');await client.removeTrackers('b','https://tracker.example/announce');
assert.equal(requests.length,2);assert.equal(requests[0].path,'torrents/reannounce');assert.equal(requests[1].path,'torrents/removeTrackers');
assert.equal(T.filterMode('stalled'),'native');
assert(T.isSupportedFilter('private'));
console.log('Product compatibility contract passed: TorrentSemantics and QBClient consume source-compiled compact CapabilityRegistry facts; qB4 local derivation/fail-closed writes converge with qB5 native semantics.');
"""
write(p,product_contract)

# 8) Migrate pages live runtime observation to Registry while preserving the offline metadata catalog as the oracle.
p="tests/pages-live-release-profile.mjs"; s=text(p)
s=s.replace("window.WeiG?.ReleaseProfile?.current()?.qbVersion===version","window.WeiG?.CapabilityRegistry?.releaseIdentity()?.qbVersion===version")
s=s.replace("profile:window.WeiG.ReleaseProfile.current()","profile:window.WeiG.CapabilityRegistry.releaseIdentity()")
s=s.replace("certified:window.WeiG.ReleaseProfile.isCertified()","certified:window.WeiG.CapabilityRegistry.isCertified()")
write(p,s)

# 9) Browser synthetic field-provenance fixture must serve compact contracts, not a retired profile catalog.
p="tests/browser-torrent-field-provenance.mjs"; s=text(p)
s=s.replace("import {fileURLToPath} from 'node:url';", "import {fileURLToPath} from 'node:url';\nimport {compileCompactRuntime} from '../tools/qb-compact-runtime.mjs';")
anchor="const profiles=[\n  {...commonProfile,qbVersion:'6.0.0',torrentInfoFields:['hash',...productFields.filter(key=>key!=='ratio')]},\n  {...commonProfile,qbVersion:'6.0.1',torrentInfoFields:['hash',...productFields]}\n];"
if anchor not in s: raise SystemExit("field profiles anchor missing")
replacement=anchor+"\nconst compact=compileCompactRuntime(profiles);const compactByName=new Map([['capabilities.json',compact.capabilityData],['torrent-compat.json',compact.torrentData],['detail-compat.json',compact.detailData],['source-actions.json',compact.actionData],['settings-compat.json',compact.settingsData]]);"
s=s.replace(anchor,replacement)
s=s.replace("    if(rel==='data/qb-releases.json')return json(res,profiles);",
"""    if(rel.startsWith('data/')){const name=rel.slice('data/'.length),payload=compactByName.get(name);if(payload)return json(res,payload);}""")
s=s.replace("window.WeiG?.ReleaseProfile?.current?.()?.qbVersion==='6.0.0'","window.WeiG?.CapabilityRegistry?.releaseIdentity?.()?.qbVersion==='6.0.0'")
s=s.replace("window.WeiG?.ReleaseProfile?.current?.()?.qbVersion==='6.0.1'","window.WeiG?.CapabilityRegistry?.releaseIdentity?.()?.qbVersion==='6.0.1'")
write(p,s)

# 10) CI/source contracts should stop requiring the retired runtime owner in formal product matrices.
p="tests/ci-contract.mjs"; s=text(p)
s=s.replace("for(const owner of ['release-profile.js','torrent-fields.js','settings-schema.js','capabilities.js','torrent-semantics.js','qb-client.js'])",
            "for(const owner of ['torrent-fields.js','settings-schema.js','capabilities.js','torrent-semantics.js','qb-client.js'])")
write(p,s)

# 11) Remove stale ReleaseProfile mock keys from provenance fixtures where QBClient already reads CapabilityRegistry.
for p in [
    "tests/qb-app-aux-provenance-contract.mjs","tests/qb-baseline-write-provenance-contract.mjs",
    "tests/qb-client-provenance-contract.mjs","tests/qb-core-write-provenance-contract.mjs",
    "tests/qb-detail-write-provenance-contract.mjs","tests/qb-peer-provenance-contract.mjs",
    "tests/qb-taxonomy-provenance-contract.mjs","tests/qb-torrent-creator-provenance-contract.mjs"
]:
    s=text(p)
    s=re.sub(r"\s*ReleaseProfile:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\},?", "", s)
    s=s.replace("ReleaseProfile:releaseProfile,\n","").replace("ReleaseProfile:releaseProfile,","")
    write(p,s)

# Verify no positive test reads/executes the legacy runtime file. Negative string assertions may remain.
positive=[]
for f in (ROOT/"tests").glob("*.mjs"):
    s=f.read_text(encoding="utf-8")
    if "read('webui/private/scripts/release-profile.js')" in s or "readFileSync(path.join(root,'webui/private/scripts/release-profile.js')" in s or "['release-profile.js'" in s:
        positive.append(str(f))
if positive:
    raise SystemExit("positive release-profile readers remain: "+", ".join(positive))

print("Phase A migration applied.")

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {catalogIdentity} from './qb-catalog-identity.mjs';
import {compileDetailRuntime} from './qb-detail-runtime-rebind.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const clone=value=>value==null?value:structuredClone(value);
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const SETTINGS_RUNTIME_SOURCE='qb-upstream-preferences-native-surface-runtime';
const SETTINGS_PAYLOAD_SOURCE='qb-upstream-preferences-native-surface-compact';
export const TORRENT_FACTS=['torrentFilters','torrentInfoParameters','torrentInfoFields','trackerFilters','trackerFacetMode','torrentStates','torrentPropertiesFields','torrentTrackerFields','torrentFileFields','torrentWebSeedFields','torrentTableColumns','webuiLocales'];

function releaseRows(catalog){return catalog.map(profile=>({qbVersion:String(profile.qbVersion||''),webApiVersion:String(profile.webApiVersion||''),sourceSha:String(profile.sourceSha||''),stable:profile.stable!==false,officialWeiGSupport:profile.officialWeiGSupport!==false}));}
function factTimeline(catalog,key){return catalog.map(profile=>({from:String(profile.qbVersion||''),value:clone(Object.prototype.hasOwnProperty.call(profile,key)?profile[key]:null)}));}
function actionValue(profile,action){if(!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;const raw=profile.apiActionParameters&&profile.apiActionParameters[action]||{};return{parameters:Array.isArray(raw.parameters)?raw.parameters.map(String):[],required:Array.isArray(raw.required)?raw.required.map(String):[],optional:Array.isArray(raw.optional)?raw.optional.map(String):[],parameterOptions:raw.parameterOptions&&typeof raw.parameterOptions==='object'?clone(raw.parameterOptions):{}};}
function identityKey(value){value=value||{};return[String(value.supportFloor||''),String(value.latestAdmittedStable||''),Number(value.releaseCount)||0,String(value.releaseSetSha256||''),String(value.sourceCatalogSha256||'')].join('|');}
function sha256(bytes){return createHash('sha256').update(bytes).digest('hex');}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return('00000000'+((crc^0xffffffff)>>>0).toString(16)).slice(-8);}
function exactSettingsReleaseSet(settingsData,catalog){if(!Array.isArray(settingsData?.releases)||settingsData.releases.length!==catalog.length)throw new Error('Settings source-native release set length mismatch.');for(let i=0;i<catalog.length;i++){const row=settingsData.releases[i],profile=catalog[i];if(!Array.isArray(row)||String(row[0])!==String(profile?.qbVersion||'')||String(row[1]||'').toLowerCase()!==String(profile?.sourceSha||'').toLowerCase())throw new Error('Settings source-native exact release identity mismatch at index '+i);}}

export function packSettingsRuntime(settingsData,identity){
  if(!settingsData||settingsData.schemaVersion!==2||settingsData.source!==SETTINGS_PAYLOAD_SOURCE)throw new Error('Settings runtime packer requires source-native compact schema v2.');
  if(identityKey(settingsData.catalogIdentity)!==identityKey(identity))throw new Error('Settings runtime source/catalog identity mismatch.');
  const raw=Buffer.from(JSON.stringify(settingsData)+'\n','utf8'),compressed=deflateRawSync(raw,{level:9}),base64=compressed.toString('base64');
  const manifest={schemaVersion:3,source:SETTINGS_RUNTIME_SOURCE,encoding:'deflate-raw-base64-json',catalogIdentity:clone(identity),payload:{schemaVersion:2,source:SETTINGS_PAYLOAD_SOURCE,bytes:raw.length,compressedBytes:compressed.length,base64Chars:base64.length,sha256:sha256(raw),compressedSha256:sha256(compressed),crc32:crc32(raw),base64}};
  return{manifest,raw,compressed};
}

export function readSettingsRuntime(){
  const manifest=readJson(path.join(root,'webui/private/data/settings-compat.json'));
  if(manifest?.schemaVersion!==3||manifest?.source!==SETTINGS_RUNTIME_SOURCE||manifest?.encoding!=='deflate-raw-base64-json'||!manifest.payload)throw new Error('Invalid Settings runtime manifest.');
  const base64=String(manifest.payload.base64||'').replace(/\s+/g,'');if(base64.length!==manifest.payload.base64Chars)throw new Error('Settings runtime base64 length mismatch.');
  const compressed=Buffer.from(base64,'base64');if(compressed.length!==manifest.payload.compressedBytes||sha256(compressed)!==manifest.payload.compressedSha256)throw new Error('Settings compressed payload identity mismatch.');
  const raw=inflateRawSync(compressed);if(raw.length!==manifest.payload.bytes||sha256(raw)!==manifest.payload.sha256||crc32(raw)!==manifest.payload.crc32)throw new Error('Settings raw payload identity mismatch.');
  const settingsData=JSON.parse(raw.toString('utf8'));if(settingsData?.schemaVersion!==2||settingsData?.source!==manifest.payload.source||identityKey(settingsData.catalogIdentity)!==identityKey(manifest.catalogIdentity))throw new Error('Settings payload/catalog identity mismatch.');
  return{manifest,settingsData,raw,compressed};
}

export function compileCompactRuntime(catalog,{includeSettings=true}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Compact runtime compiler requires a non-empty source catalog.');
  const identity=catalogIdentity(catalog),settingsRuntime=includeSettings?readSettingsRuntime():null,settingsManifest=settingsRuntime?.manifest||null,settingsData=settingsRuntime?.settingsData||null;
  const capabilityData=readJson(path.join(root,'webui/private/data/capabilities.json'));
  const torrentData=readJson(path.join(root,'webui/private/data/torrent-compat.json'));
  const detailData=readJson(path.join(root,'webui/private/data/detail-compat.json'));
  const actionData=readJson(path.join(root,'webui/private/data/source-actions.json'));
  for(const data of [capabilityData,torrentData,detailData,actionData])data.catalogIdentity=clone(identity);
  if(includeSettings){
    if(identityKey(settingsManifest.catalogIdentity)!==identityKey(identity)||identityKey(settingsData.catalogIdentity)!==identityKey(identity))throw new Error('Settings runtime does not match the target Frozen catalog identity.');
    exactSettingsReleaseSet(settingsData,catalog);
  }
  capabilityData.releases=releaseRows(catalog);
  torrentData.sourceFacts={};for(const key of TORRENT_FACTS)torrentData.sourceFacts[key]=factTimeline(catalog,key);
  detailData.sourceFacts=clone(compileDetailRuntime(catalog).sourceFacts);
  const names=new Set(Object.keys(actionData.sourceActions||{}));for(const profile of catalog)for(const action of profile.apiActions||[])names.add(String(action));
  actionData.sourceActions={};for(const action of names)actionData.sourceActions[action]=catalog.map(profile=>({from:String(profile.qbVersion||''),value:actionValue(profile,action)}));
  return{catalogIdentity:identity,capabilityData,torrentData,detailData,actionData,settingsManifest,settingsData};
}

function defaultDocument(){return{addEventListener(){},querySelectorAll(){return[];},createElement(){return{className:'',dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},appendChild(){},querySelector(){return null;},querySelectorAll(){return[];},remove(){}};},body:{appendChild(){}}};}
function TestFormData(){this.entries=[];}TestFormData.prototype.append=function(name,value,filename){this.entries.push({name,value,filename});};TestFormData.prototype.get=function(name){const hit=this.entries.find(item=>item.name===name);return hit?hit.value:null;};

export function createCompactRuntime(catalog,{owners=['capabilities.js','torrent-semantics.js','torrent-fields.js'],W:providedW=null,document:providedDocument=null}={}){
  const includeSettings=owners.includes('settings-schema.js'),compact=compileCompactRuntime(catalog,{includeSettings}),requests=[];
  const W=providedW||{buildAssetUrl:x=>x,t:key=>key,util:{parseScalar:value=>value,normalizeTracker:value=>String(value||''),form(obj){const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();}},I18n:{getLocale:()=> 'en-US'}};
  if(!W.buildAssetUrl)W.buildAssetUrl=x=>x;if(!W.t)W.t=key=>key;if(!W.util)W.util={};if(!W.util.parseScalar)W.util.parseScalar=value=>value;if(!W.util.normalizeTracker)W.util.normalizeTracker=value=>String(value||'');if(!W.util.form)W.util.form=obj=>{const p=new URLSearchParams();for(const [k,v] of Object.entries(obj||{}))if(v!==undefined&&v!==null)p.append(k,String(v));return p.toString();};if(!W.I18n)W.I18n={getLocale:()=> 'en-US'};
  const window={WeiG:W,window:null,dispatchEvent(){},addEventListener(){},requestAnimationFrame:fn=>fn(),atob:value=>Buffer.from(String(value),'base64').toString('binary')};window.window=window;
  const document=providedDocument||defaultDocument(),responseEntries=[['capabilities.json',compact.capabilityData],['torrent-compat.json',compact.torrentData],['detail-compat.json',compact.detailData],['source-actions.json',compact.actionData]];if(compact.settingsManifest)responseEntries.push(['settings-compat.json',compact.settingsManifest]);const responses=new Map(responseEntries);
  const fetch=async url=>{const value=String(url);requests.push(value);for(const [name,data] of responses)if(value.includes(name))return{ok:true,status:200,json:async()=>clone(data),text:async()=>JSON.stringify(data)};throw new Error(`Unexpected compact-runtime fetch ${value}`);};
  const context={window,document,console,URL,URLSearchParams,FormData:globalThis.FormData||TestFormData,Blob:globalThis.Blob,TextDecoder:globalThis.TextDecoder,CustomEvent:class{},requestAnimationFrame:fn=>fn(),fetch};
  for(const name of owners){const owner=fs.readFileSync(path.join(root,'webui/private/scripts',name),'utf8');vm.runInNewContext(owner,context,{filename:name});}
  return{W,window,document,context,compact,requests};
}

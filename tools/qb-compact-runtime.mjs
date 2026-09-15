import fs from 'node:fs';
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

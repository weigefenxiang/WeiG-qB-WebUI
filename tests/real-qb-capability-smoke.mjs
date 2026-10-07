#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'..');
const norm=v=>String(v??'').trim().replace(/^v/i,'').split(/[+-]/)[0];
const canonical=value=>Array.isArray(value)?value.map(canonical):(value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value);
const stableJson=value=>JSON.stringify(canonical(value));
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const fail=message=>{throw new Error(message);};
export const SAFE_READ_ACTIONS={
  'appcontroller.h:preferencesAction':'/api/v2/app/preferences',
  'torrentscontroller.h:infoAction':'/api/v2/torrents/info',
  'transfercontroller.h:infoAction':'/api/v2/transfer/info',
  'logcontroller.h:mainAction':'/api/v2/log/main',
  'logcontroller.h:peersAction':'/api/v2/log/peers',
  'rsscontroller.h:itemsAction':'/api/v2/rss/items',
  'searchcontroller.h:pluginsAction':'/api/v2/search/plugins',
  'searchcontroller.h:statusAction':'/api/v2/search/status'
};

export function canonicalWebApiVersion(value){
  const raw=norm(value);
  const parts=raw.split('.');
  if(parts.length>=2&&parts.every(part=>/^\d+$/.test(part))){
    while(parts.length>2&&parts.at(-1)==='0')parts.pop();
    return parts.join('.');
  }
  return raw;
}

export function buildCapabilityWitnessSpec(profile){
  if(!profile||!profile.qbVersion)fail('Capability witness requires one Frozen qB profile.');
  const readablePreferences=(profile.preferenceDescriptors||[])
    .filter(row=>row&&typeof row.key==='string'&&row.getterPresent===true)
    .map(row=>row.key).sort();
  const safeReadActions=Object.keys(SAFE_READ_ACTIONS)
    .filter(action=>Array.isArray(profile.apiActions)&&profile.apiActions.includes(action))
    .filter(action=>((profile.apiActionParameters?.[action]?.required)||[]).length===0)
    .sort();
  return {
    qbVersion:String(profile.qbVersion),
    webApiVersion:canonicalWebApiVersion(profile.webApiVersion),
    readablePreferences,
    safeReadActions
  };
}
export function fingerprintCapabilityWitness(value){return sha256(`gfm-runtime-capability-witness\0${stableJson(value)}`);}

function frozen(root){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-stable-lkg.json'),'utf8'));
  const bytes=fs.readFileSync(path.join(root,manifest.catalogPath));
  const digest=sha256(bytes);
  if(digest!==manifest.catalogSha256)fail(`Frozen catalog digest mismatch: expected ${manifest.catalogSha256}, got ${digest}.`);
  const catalog=JSON.parse(bytes);
  if(!Array.isArray(catalog)||catalog.length!==manifest.profileCount)fail('Frozen catalog coverage mismatch.');
  return {manifest,catalog,digest};
}

export async function runCapabilitySmoke({root=repoRoot,env=process.env,fetchImpl=globalThis.fetch}={}){
  const expectedVersion=String(env.QB_VERSION||'').trim();
  const target=String(env.WEIG_QB_URL||'').trim();
  const user=String(env.WEIG_QB_USER||'').trim();
  const pass=String(env.WEIG_QB_PASS||'');
  const weigSha=String(env.WEIG_GIT_SHA||env.GITHUB_SHA||'').trim().toLowerCase();
  const evidenceDir=path.resolve(root,String(env.WEIG_REAL_QB_EVIDENCE_DIR||'artifacts/real-qb-full'));
  if(!/^\d+(?:\.\d+){2,3}$/.test(expectedVersion))fail('Capability smoke requires exact QB_VERSION.');
  if(!target||!user||!pass)fail('Capability smoke requires WEIG_QB_URL/USER/PASS.');
  if(!/^[0-9a-f]{40}$/.test(weigSha))fail('Capability smoke requires exact WeiG SHA.');
  if(typeof fetchImpl!=='function')fail('Capability smoke requires a fetch implementation.');
  const f=frozen(root);
  const profile=f.catalog.find(row=>String(row.qbVersion)===expectedVersion);
  if(!profile)fail(`qB ${expectedVersion} is outside Frozen LKG.`);
  const expected=buildCapabilityWitnessSpec(profile);
  const expectedFingerprint=fingerprintCapabilityWitness(expected);
  const out={
    schemaVersion:1,
    phase:'G-FM',
    module:'capability-smoke',
    status:'FAIL',
    expected_qb_version:expectedVersion,
    runtime_version:null,
    webapi_version:null,
    weig_sha:weigSha,
    frozen_catalog_sha256:f.digest,
    expected_capability_fingerprint:expectedFingerprint,
    actual_capability_fingerprint:null,
    expected_witness:expected,
    actual_witness:null,
    missing_readable_preferences:[],
    failed_safe_read_actions:[]
  };
  fs.mkdirSync(evidenceDir,{recursive:true});
  const file=path.join(evidenceDir,`${weigSha}-${expectedVersion}-capability-smoke.json`);
  let cookie='';
  const base=new URL(target.endsWith('/')?target:`${target}/`);
  async function http(method,endpoint,{form,auth=true}={}){
    const url=new URL(endpoint.replace(/^\/+/,''),base);
    const headers={Accept:'application/json, text/plain, */*'};
    if(auth&&cookie)headers.Cookie=cookie;
    let body;
    if(form){headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';body=new URLSearchParams(Object.entries(form));}
    return fetchImpl(url,{method,headers,body,redirect:'manual'});
  }
  const save=()=>fs.writeFileSync(file,`${JSON.stringify(out,null,2)}\n`);
  try{
    const login=await http('POST','/api/v2/auth/login',{form:{username:user,password:pass},auth:false});
    if(![200,204].includes(login.status))fail(`Capability smoke login HTTP ${login.status}.`);
    const cookies=typeof login.headers.getSetCookie==='function'?login.headers.getSetCookie():[login.headers.get('set-cookie')].filter(Boolean);
    for(const raw of cookies){const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);if(m){cookie=`${m[1]}=${m[2]}`;break;}}
    await login.text();
    if(!cookie)fail('Capability smoke login returned no session cookie.');

    const versionResponse=await http('GET','/api/v2/app/version');
    if(versionResponse.status!==200)fail(`Capability smoke app/version HTTP ${versionResponse.status}.`);
    const runtimeVersion=norm(await versionResponse.text());
    out.runtime_version=runtimeVersion;
    const apiResponse=await http('GET','/api/v2/app/webapiVersion');
    if(apiResponse.status!==200)fail(`Capability smoke app/webapiVersion HTTP ${apiResponse.status}.`);
    const webApiRaw=norm(await apiResponse.text());
    out.webapi_version=webApiRaw;
    const webApiVersion=canonicalWebApiVersion(webApiRaw);

    const preferencesResponse=await http('GET','/api/v2/app/preferences');
    if(preferencesResponse.status!==200)fail(`Capability smoke app/preferences HTTP ${preferencesResponse.status}.`);
    const preferences=JSON.parse(await preferencesResponse.text());
    const readablePreferences=expected.readablePreferences.filter(key=>Object.hasOwn(preferences,key));
    out.missing_readable_preferences=expected.readablePreferences.filter(key=>!Object.hasOwn(preferences,key));

    const safeReadActions=[];
    for(const action of expected.safeReadActions){
      const response=await http('GET',SAFE_READ_ACTIONS[action]);
      await response.text();
      if(response.status===200)safeReadActions.push(action);
      else out.failed_safe_read_actions.push({action,status:response.status});
    }
    const actual={qbVersion:runtimeVersion,webApiVersion,readablePreferences,safeReadActions};
    out.actual_witness=actual;
    out.actual_capability_fingerprint=fingerprintCapabilityWitness(actual);
    if(runtimeVersion!==expectedVersion)fail(`Capability smoke exact qB mismatch: expected ${expectedVersion}, got ${runtimeVersion}.`);
    if(out.actual_capability_fingerprint!==expectedFingerprint)fail(`Capability smoke fingerprint mismatch for qB ${expectedVersion}.`);
    out.status='PASS';
    save();
    console.log(`Real-qB capability smoke PASS: qB ${expectedVersion}, witness ${expectedFingerprint.slice(0,12)}.`);
    return out;
  }catch(error){
    out.reason=String(error?.message||error);
    save();
    throw error;
  }finally{
    if(cookie){try{await http('POST','/api/v2/auth/logout');}catch{}}
  }
}

const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked)await runCapabilitySmoke();

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const target=process.env.WEIG_QB_URL||'';
const locale=process.env.WEIG_QB_LOCALE||'';
const expectedVersion=process.env.WEIG_QB_EXPECTED_VERSION||'';
const user=process.env.WEIG_QB_USER||'admin';
const pass=process.env.WEIG_QB_PASS||'';
const sha=process.env.GITHUB_SHA||process.env.WEIG_GIT_SHA||'';
const evidenceDir=process.env.WEIG_QB_LOCALE_EVIDENCE_DIR||'artifacts/real-qb-locale';
if(!target||!locale||!expectedVersion||!pass)throw new Error('WEIG_QB_URL, WEIG_QB_LOCALE, WEIG_QB_EXPECTED_VERSION and WEIG_QB_PASS are required.');
if(!/^[0-9]+(?:\.[0-9]+){2,3}$/.test(expectedVersion))throw new Error('Exact qB stable version is required.');
if(!/^[0-9a-f]{40}$/i.test(sha))throw new Error('Exact Git SHA is required.');

const base=new URL(target.endsWith('/')?target:`${target}/`);
let cookie='';
const url=ep=>new URL(ep.replace(/^\/+/,''),base);
async function request(method,ep,{form,auth=true}={}){
  const headers={Accept:'application/json, text/plain, */*'};
  if(auth&&cookie)headers.Cookie=cookie;
  let body;
  if(form){headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';body=new URLSearchParams(Object.entries(form).map(([k,v])=>[k,String(v)]));}
  return fetch(url(ep),{method,headers,body,redirect:'manual'});
}
function requireStatus(res,label,codes=[200,204]){if(!codes.includes(res.status))throw new Error(`${label}: HTTP ${res.status}`);}
async function prefs(){
  const res=await request('GET','/api/v2/app/preferences');requireStatus(res,'app/preferences',[200]);
  return await res.json();
}
async function setLocale(value){
  const res=await request('POST','/api/v2/app/setPreferences',{form:{json:JSON.stringify({locale:value})}});
  requireStatus(res,'app/setPreferences',[200,204]);
}
function decodeHtml(text){return String(text).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function localeOptions(html){
  const source=String(html||'');
  const match=source.match(/<select\b[^>]*\bid=["'](?:locale_select|weigg-qb-locale-options)["'][^>]*>([\s\S]*?)<\/select>/i);
  if(!match||match[1].includes('${LANGUAGE_OPTIONS}'))return[];
  const out=[];
  for(const item of match[1].matchAll(/<option\b[^>]*\bvalue=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi))out.push({value:decodeHtml(item[1]),label:decodeHtml(String(item[2]).replace(/<[^>]*>/g,'').trim())});
  return out;
}
async function nativeOptions(){
  const res=await request('GET','/views/preferences.html?weigg_locale_probe=1');requireStatus(res,'native preferences locale surface',[200]);
  return localeOptions(await res.text());
}

fs.mkdirSync(evidenceDir,{recursive:true});
const safeLocale=locale.replace(/[^A-Za-z0-9@._-]/g,'_');
const safeVersion=expectedVersion.replace(/[^0-9.]/g,'_');
const evidencePath=path.join(evidenceDir,`${sha}-${safeVersion}-${safeLocale}.json`);
let original=null,restored=false,status='FAIL',reason=null,options=[];
try{
  const login=await request('POST','/api/v2/auth/login',{form:{username:user,password:pass},auth:false});
  requireStatus(login,'auth/login',[200,204]);
  const setCookies=typeof login.headers.getSetCookie==='function'?login.headers.getSetCookie():[login.headers.get('set-cookie')].filter(Boolean);
  for(const raw of setCookies){const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);if(m){cookie=`${m[1]}=${m[2]}`;break;}}
  await login.text();
  if(!cookie)throw new Error('Login returned no session cookie.');
  const vr=await request('GET','/api/v2/app/version');requireStatus(vr,'app/version',[200]);
  const version=(await vr.text()).trim().replace(/^v/i,'');
  if(version!==expectedVersion)throw new Error(`Expected exact qB ${expectedVersion}, got ${version}.`);

  options=await nativeOptions();
  if(!options.some(item=>item.value===locale))throw new Error(`Live qB ${expectedVersion} LANGUAGE_OPTIONS does not contain ${locale}.`);

  const before=await prefs();original=String(before.locale||'');
  if(!original)throw new Error('qB returned an empty initial locale; reversible test cannot continue.');
  await setLocale(locale);
  const changed=await prefs();
  if(String(changed.locale)!==locale)throw new Error(`Locale verification mismatch: expected ${locale}, got ${changed.locale}.`);
  const afterOptions=await nativeOptions();
  if(!afterOptions.some(item=>item.value===locale))throw new Error(`Locale ${locale} disappeared from native options after write.`);
  status='PASS';
}catch(error){
  reason=String(error&&error.message||error);
}finally{
  if(cookie&&original){
    try{
      await setLocale(original);
      const after=await prefs();
      restored=String(after.locale)===original;
      if(!restored){status='FAIL';reason=reason||`Restore verification mismatch: expected ${original}, got ${after.locale}.`;}
    }catch(error){status='FAIL';reason=reason||`Restore failed: ${error&&error.message||error}`;}
  }
  try{if(cookie)await request('POST','/api/v2/auth/logout');}catch{}
  const out={schemaVersion:1,module:'real-qb-current-locale',status,reason,qbVersion:expectedVersion,locale,initialLocale:original,restored,liveLocaleCount:options.length,liveLocalePresent:options.some(item=>item.value===locale),weigSha:sha,testTime:new Date().toISOString()};
  fs.writeFileSync(evidencePath,`${JSON.stringify(out,null,2)}\n`);
}
if(status!=='PASS')throw new Error(reason||`qB ${expectedVersion} locale ${locale} failed.`);
console.log(`qB ${expectedVersion} locale ${locale} PASS; restored ${original}.`);

#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const target=process.env.WEIG_QB_URL||'';
const username=process.env.WEIG_QB_USER||'admin';
const presetPassword=process.env.WEIG_QB_PASS||'';
const changedPassword=process.env.WEIG_QB_CHANGED_PASS||'';
const expectedVersion=String(process.env.WEIG_QB_VERSION||'').trim().replace(/^v/i,'');
const weigSha=String(process.env.WEIG_GIT_SHA||process.env.GITHUB_SHA||'').trim().toLowerCase();
const evidenceDir=process.env.WEIG_REAL_QB_EVIDENCE_DIR||'artifacts/real-qb-full';
const wrongPassword=`${presetPassword}.wrong`;
const die=msg=>{throw new Error(msg);};
if(!target||!presetPassword||!changedPassword)die('Auth lifecycle requires URL, preset password and changed password.');
if(presetPassword!=='Wei.G')die('G-FM preset password drifted from the approved Wei.G fixture.');
if(changedPassword.length<6)die('Changed password fixture must satisfy qB minimum length.');
if(!/^5\.2\.\d+$/.test(expectedVersion))die(`QBT_SID lifecycle is source-proven only for qB 5.2.x, got ${expectedVersion||'unknown'}.`);
if(!/^[0-9a-f]{40}$/.test(weigSha))die('Exact WeiG Git SHA is required.');
const base=new URL(target.endsWith('/')?target:`${target}/`);
const accepted=s=>s===200||s===204;

function sessionFrom(response){
  const values=typeof response.headers.getSetCookie==='function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  for(const raw of values){
    const m=String(raw).match(/^\s*([^=;\s]+)=([^;]+)/);
    if(m)return {name:m[1],pair:`${m[1]}=${m[2]}`};
  }
  return null;
}

async function request(method,endpoint,{cookie='',form=null}={}){
  const headers={Accept:'application/json, text/plain, */*'};
  if(cookie)headers.Cookie=cookie;
  let body;
  if(form){
    headers['Content-Type']='application/x-www-form-urlencoded; charset=UTF-8';
    body=new URLSearchParams(Object.entries(form).map(([k,v])=>[k,String(v)]));
  }
  return fetch(new URL(endpoint.replace(/^\/+/,''),base),{method,headers,body,redirect:'manual'});
}

async function login(password){
  const response=await request('POST','/api/v2/auth/login',{form:{username,password}});
  const session=sessionFrom(response);
  await response.text();
  return {status:response.status,session};
}

async function authenticatedVersion(session){
  const response=await request('GET','/api/v2/app/version',{cookie:session.pair});
  if(response.status!==200)die(`Authenticated app/version returned HTTP ${response.status}.`);
  return (await response.text()).trim().replace(/^v/i,'');
}

async function assertUnauthenticated(){
  const response=await request('GET','/api/v2/app/preferences');
  await response.text();
  if(accepted(response.status))die('Private preferences endpoint was accessible without a session cookie.');
  return response.status;
}

const evidence={
  schemaVersion:1,
  phase:'G-FM',
  module:'auth-lifecycle',
  status:'FAIL',
  weig_sha:weigSha,
  qb_version:expectedVersion,
  credential_fixture:{username,preset_password:'Wei.G',changed_password:'Wei.G1'},
  facts:{},
  test_time:new Date().toISOString()
};

try{
  evidence.facts.anonymous_preferences_status=await assertUnauthenticated();

  const wrongInitial=await login(wrongPassword);
  evidence.facts.wrong_password_status=wrongInitial.status;
  evidence.facts.wrong_password_rejected=!wrongInitial.session;
  if(wrongInitial.session)die('Wrong password unexpectedly produced a session cookie.');

  const preset=await login(presetPassword);
  evidence.facts.preset_login_status=preset.status;
  evidence.facts.preset_password_accepted=accepted(preset.status)&&Boolean(preset.session);
  if(!evidence.facts.preset_password_accepted)die(`Preset Wei.G login failed with HTTP ${preset.status}.`);
  evidence.facts.session_cookie_name=preset.session.name;
  evidence.facts.qbt_sid_prefix_verified=/^QBT_SID_/.test(preset.session.name);
  if(!evidence.facts.qbt_sid_prefix_verified)die(`qB 5.2.x session cookie was ${preset.session.name}, expected QBT_SID_*.`);
  const versionBefore=await authenticatedVersion(preset.session);
  evidence.facts.authenticated_version_before_change=versionBefore;
  if(versionBefore!==expectedVersion)die(`Authenticated qB version mismatch: expected ${expectedVersion}, got ${versionBefore}.`);

  const changed=await request('POST','/api/v2/app/setPreferences',{
    cookie:preset.session.pair,
    form:{json:JSON.stringify({web_ui_password:changedPassword})}
  });
  evidence.facts.password_change_status=changed.status;
  await changed.text();
  evidence.facts.password_change_applied=accepted(changed.status);
  if(!evidence.facts.password_change_applied)die(`Password change returned HTTP ${changed.status}.`);

  const oldAfterChange=await login(presetPassword);
  evidence.facts.old_password_after_change_status=oldAfterChange.status;
  evidence.facts.old_password_rejected_after_change=!oldAfterChange.session;
  if(oldAfterChange.session)die('Old Wei.G password still produced a fresh session after password change.');

  const fresh=await login(changedPassword);
  evidence.facts.changed_password_login_status=fresh.status;
  evidence.facts.changed_password_accepted=accepted(fresh.status)&&Boolean(fresh.session);
  if(!evidence.facts.changed_password_accepted)die(`Changed password login failed with HTTP ${fresh.status}.`);
  evidence.facts.changed_session_cookie_name=fresh.session.name;
  evidence.facts.changed_qbt_sid_prefix_verified=/^QBT_SID_/.test(fresh.session.name);
  if(!evidence.facts.changed_qbt_sid_prefix_verified)die(`Changed-password session cookie was ${fresh.session.name}, expected QBT_SID_*.`);
  const versionAfter=await authenticatedVersion(fresh.session);
  evidence.facts.authenticated_version_after_change=versionAfter;
  if(versionAfter!==expectedVersion)die(`Post-change qB version mismatch: expected ${expectedVersion}, got ${versionAfter}.`);

  const logout=await request('POST','/api/v2/auth/logout',{cookie:fresh.session.pair});
  evidence.facts.logout_status=logout.status;
  await logout.text();
  evidence.status='PASS';
} catch(error){
  evidence.error=String(error?.message||error);
  process.exitCode=1;
} finally {
  fs.mkdirSync(evidenceDir,{recursive:true});
  const out=path.join(evidenceDir,`${weigSha}-${expectedVersion}-auth.json`);
  fs.writeFileSync(out,`${JSON.stringify(evidence,null,2)}\n`);
  console.log(`G-FM auth lifecycle evidence: ${out}`);
  console.log(JSON.stringify({status:evidence.status,qb_version:expectedVersion,wrong_password_rejected:evidence.facts.wrong_password_rejected===true,preset_password_accepted:evidence.facts.preset_password_accepted===true,session_cookie_name:evidence.facts.session_cookie_name||null,password_change_applied:evidence.facts.password_change_applied===true,old_password_rejected_after_change:evidence.facts.old_password_rejected_after_change===true,changed_password_accepted:evidence.facts.changed_password_accepted===true}));
}

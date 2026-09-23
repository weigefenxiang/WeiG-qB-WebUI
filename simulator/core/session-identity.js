const LEGACY_HANDOFF_PARAM='__wei'+'gg_handoff';
const HANDOFF_PARAMS=['__weig_handoff',LEGACY_HANDOFF_PARAM];
const HANDOFF_MAX_AGE=120000;

export function sessionClientIds(event={}){
  const ids=[event.clientId,event.replacesClientId,event.resultingClientId];
  const unique=[];
  for(const raw of ids){
    const id=String(raw||'').trim();
    if(id&&!unique.includes(id))unique.push(id);
  }
  return unique;
}

export function rememberSessionForEvent(clientSessions,event,sessionId){
  const value=String(sessionId||'').trim();
  if(!value)return;
  for(const clientId of sessionClientIds(event))clientSessions.set(clientId,value);
}

export function sessionForEvent(clientSessions,event){
  for(const clientId of sessionClientIds(event)){
    const value=clientSessions.get(clientId);
    if(value)return value;
  }
  return '';
}

export function sessionForUrl(url){
  try{return String((url instanceof URL?url:new URL(String(url))).searchParams.get('sim')||'').trim();}
  catch(_e){return '';}
}

function handoffToken(url){
  try{
    const params=(url instanceof URL?url:new URL(String(url))).searchParams;
    for(const name of HANDOFF_PARAMS){
      const token=String(params.get(name)||'').trim();
      if(token)return token;
    }
    return '';
  }catch(_e){return '';}
}

function pruneHandoffs(handoffs,now,maxAge){
  for(const [token,record] of handoffs){
    if(!record||!record.sessionId||now-Number(record.createdAt||0)>maxAge)handoffs.delete(token);
  }
}

export function rememberHandoffSession(handoffs,url,sessionId,now=Date.now(),maxAge=HANDOFF_MAX_AGE){
  const value=String(sessionId||'').trim(),token=handoffToken(url);
  pruneHandoffs(handoffs,now,maxAge);
  if(value&&token)handoffs.set(token,{sessionId:value,createdAt:now});
}

export function sessionForHandoff(handoffs,url,now=Date.now(),maxAge=HANDOFF_MAX_AGE){
  const token=handoffToken(url);
  pruneHandoffs(handoffs,now,maxAge);
  const record=token&&handoffs.get(token);
  return record&&record.sessionId?String(record.sessionId):'';
}

function appRoot(url){
  try{
    const value=url instanceof URL?url:new URL(String(url));
    let path=value.pathname,api=path.indexOf('/api/v2/');
    if(api>=0)path=path.slice(0,api+1);
    else if(!path.endsWith('/'))path=path.replace(/[^/]*$/,'');
    return value.origin+path;
  }catch(_e){return '';}
}

function prunePendingHandoffs(pending,now,maxAge){
  for(const [root,records] of pending){
    if(!(records instanceof Map)){pending.delete(root);continue;}
    for(const [sessionId,createdAt] of records){
      if(!sessionId||now-Number(createdAt||0)>maxAge)records.delete(sessionId);
    }
    if(!records.size)pending.delete(root);
  }
}

export function rememberPendingHandoffSession(pending,url,sessionId,now=Date.now(),maxAge=HANDOFF_MAX_AGE){
  const value=String(sessionId||'').trim(),root=appRoot(url);
  prunePendingHandoffs(pending,now,maxAge);
  if(!value||!root)return;
  let records=pending.get(root);
  if(!(records instanceof Map)){records=new Map();pending.set(root,records);}
  records.set(value,now);
}

export function forgetPendingHandoffSession(pending,url,sessionId,now=Date.now(),maxAge=HANDOFF_MAX_AGE){
  const value=String(sessionId||'').trim(),root=appRoot(url);
  prunePendingHandoffs(pending,now,maxAge);
  if(!value||!root)return false;
  const records=pending.get(root);
  if(!(records instanceof Map))return false;
  const removed=records.delete(value);
  if(!records.size)pending.delete(root);
  return removed;
}

export function consumePendingHandoffSession(pending,url,now=Date.now(),maxAge=HANDOFF_MAX_AGE){
  const token=handoffToken(url),root=appRoot(url);
  prunePendingHandoffs(pending,now,maxAge);
  if(!token||!root)return '';
  const records=pending.get(root);
  if(!(records instanceof Map)||records.size!==1)return '';
  const sessionId=String(records.keys().next().value||'');
  pending.delete(root);
  return sessionId;
}

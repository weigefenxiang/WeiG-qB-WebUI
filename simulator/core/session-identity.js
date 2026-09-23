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

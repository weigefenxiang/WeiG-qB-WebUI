export const PAGE_SESSION_ATTEMPTS=3;

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function pageSessionDiagnostics(page){
  try{
    return await page.evaluate(()=>({
      url:location.href,
      readyState:document.readyState,
      bootstrap:document.documentElement.dataset.weigBootstrap||'',
      loginVisible:!!document.querySelector('#login-form')&&!document.querySelector('#login-form')?.hidden,
      torrentList:!!document.querySelector('#torrent-list'),
      fatalVisible:!!document.querySelector('#fatal:not(.is-hidden)'),
      body:String(document.body?.innerText||'').replace(/\s+/g,' ').slice(0,240)
    }));
  }catch(error){
    return{url:page.url(),diagnosticError:error?.message||String(error)};
  }
}

export async function waitForPageSessionEntry(page,{timeoutMs=20000}={}){
  const handle=await page.waitForFunction(()=>{
    if(document.querySelector('#torrent-list'))return'private';
    const login=document.querySelector('#login-form'),style=login&&getComputedStyle(login);
    if(login&&!login.hidden&&style?.display!=='none'&&style?.visibility!=='hidden')return'login';
    if(document.querySelector('#fatal:not(.is-hidden)')||document.documentElement.dataset.weigBootstrap==='failed')return'failed';
    return'';
  },null,{timeout:timeoutMs});
  return handle.jsonValue();
}

export async function recoverPageSession(page,{label='Pages session',qbVersion='',timeoutMs=20000,attempts=PAGE_SESSION_ATTEMPTS,navigate,onLogin}={}){
  if(typeof navigate!=='function')throw new TypeError('recoverPageSession requires navigate(attempt)');
  let last=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      await navigate(attempt);
      const entry=await waitForPageSessionEntry(page,{timeoutMs});
      if(entry==='failed')throw new Error('WeiG bootstrap entered failed/fatal state before session authentication');
      if(entry==='login'){
        if(typeof onLogin==='function')await onLogin(attempt);
        else await page.locator('#login-btn').click();
      }
      await page.waitForSelector('#torrent-list',{state:'attached',timeout:timeoutMs});
      if(qbVersion)await page.waitForFunction(version=>String(document.querySelector('#qb-version')?.textContent||'').includes(version),qbVersion,{timeout:timeoutMs});
      return{attempt,entry};
    }catch(error){
      last={attempt,error:error?.message||String(error),state:await pageSessionDiagnostics(page)};
      if(attempt<attempts)await sleep(500*attempt);
    }
  }
  throw new Error(`${label} bootstrap failed after ${attempts} attempts: ${JSON.stringify(last)}`);
}

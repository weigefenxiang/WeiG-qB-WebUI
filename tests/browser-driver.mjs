import {chromium} from 'playwright';

const DEFAULT_CHANNEL='chrome';
const DEFAULT_FETCH_TIMEOUT_MS=15000;
const fetchTimeoutMs=Number(process.env.WEIGG_BROWSER_FETCH_TIMEOUT_MS)||DEFAULT_FETCH_TIMEOUT_MS;

function resolveChannel(){
  const configured=process.env.WEIGG_BROWSER_CHANNEL;
  const channel=(configured===undefined?DEFAULT_CHANNEL:String(configured)).trim();
  if(channel!=='chrome'){
    throw new Error(`Unsupported browser channel "${channel}". WeiG browser gates use hosted Google Chrome Stable only.`);
  }
  return channel;
}

function timedFetchFactory(nativeFetch,timeoutMs,label){
  return async function timedFetch(input,init={}){
    if(init?.signal)return nativeFetch(input,init);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(new Error(`${label} timed out after ${timeoutMs} ms`)),timeoutMs);
    try{return await nativeFetch(input,{...init,signal:controller.signal});}
    finally{clearTimeout(timer);}
  };
}

if(typeof globalThis.fetch==='function'&&!globalThis.__weiggTimedFetchInstalled){
  globalThis.fetch=timedFetchFactory(globalThis.fetch.bind(globalThis),fetchTimeoutMs,'Node fetch');
  Object.defineProperty(globalThis,'__weiggTimedFetchInstalled',{value:true,configurable:false,enumerable:false,writable:false});
}

export async function launchBrowser(options={}){
  const launchOptions={...options};
  if(Object.hasOwn(launchOptions,'channel')||Object.hasOwn(launchOptions,'executablePath')){
    throw new Error('Browser callers must not override canonical channel/executablePath policy.');
  }
  const browser=await chromium.launch({
    headless:true,
    ...launchOptions,
    channel:resolveChannel()
  });
  const nativeNewContext=browser.newContext.bind(browser);
  browser.newContext=async function(options={}){
    const context=await nativeNewContext(options);
    await context.addInitScript(({timeoutMs})=>{
      if(typeof globalThis.fetch!=='function'||globalThis.__weiggTimedFetchInstalled)return;
      const nativeFetch=globalThis.fetch.bind(globalThis);
      globalThis.fetch=async function(input,init={}){
        if(init?.signal)return nativeFetch(input,init);
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(new Error(`Browser fetch timed out after ${timeoutMs} ms`)),timeoutMs);
        try{return await nativeFetch(input,{...init,signal:controller.signal});}
        finally{clearTimeout(timer);}
      };
      Object.defineProperty(globalThis,'__weiggTimedFetchInstalled',{value:true,configurable:false,enumerable:false,writable:false});
    },{timeoutMs:fetchTimeoutMs});
    return context;
  };
  return browser;
}

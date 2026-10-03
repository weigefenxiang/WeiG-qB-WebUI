import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CHANNEL='chrome';
const DEFAULT_FETCH_TIMEOUT_MS=15000;
const fetchTimeoutMs=Number(process.env.WEIG_BROWSER_FETCH_TIMEOUT_MS)||DEFAULT_FETCH_TIMEOUT_MS;

function resolveChannel(){
  const configured=process.env.WEIG_BROWSER_CHANNEL;
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

if(typeof globalThis.fetch==='function'&&!globalThis.__weigTimedFetchInstalled){
  globalThis.fetch=timedFetchFactory(globalThis.fetch.bind(globalThis),fetchTimeoutMs,'Node fetch');
  Object.defineProperty(globalThis,'__weigTimedFetchInstalled',{value:true,configurable:false,enumerable:false,writable:false});
}

function retryableEvidenceStatus(status){status=Number(status)||0;return status===408||status===429||status>=500;}
export async function fetchJsonEvidence(input,options={}){
  const attempts=Math.max(1,Math.min(5,Number(options.attempts)||3)),delayMs=Math.max(0,Number(options.delayMs)==null?250:Number(options.delayMs)),init={...(options.init||{})},method=String(init.method||'GET').toUpperCase(),fetchImpl=options.fetchImpl||globalThis.fetch;
  if(method!=='GET')throw new Error('fetchJsonEvidence is restricted to idempotent GET evidence reads.');
  if(typeof fetchImpl!=='function')throw new Error('fetchJsonEvidence requires a fetch implementation.');
  let last=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const response=await fetchImpl(input,init);
      if(!response||typeof response.ok!=='boolean')throw new Error('fetchJsonEvidence received an invalid Response.');
      if(!response.ok){
        const error=new Error(`${String(input)} returned HTTP ${response.status}`);error.status=Number(response.status)||0;
        if(!retryableEvidenceStatus(error.status))throw error;
        last=error;
      }else{
        try{return await response.json();}
        catch(error){last=error;}
      }
    }catch(error){
      if(error&&Number(error.status)&&!retryableEvidenceStatus(error.status))throw error;
      last=error;
    }
    if(attempt<attempts&&delayMs>0)await new Promise(resolve=>setTimeout(resolve,delayMs*attempt));
  }
  throw last||new Error(`Unable to fetch JSON evidence from ${String(input)}`);
}

export async function readWebuiStatic(roots,requested='index.html'){
  const targets=Array.isArray(roots)?roots:[roots],name=String(requested||'index.html').replace(/^\/+/, '');
  for(const rootValue of targets){
    const root=path.resolve(rootValue),file=path.resolve(root,name);
    if(!(file===root||file.startsWith(root+path.sep))){const error=new Error(`Static fixture path escapes root: ${requested}`);error.code='EACCES';throw error;}
    try{return{file,body:await fs.readFile(file)};}catch(error){if(error?.code!=='ENOENT')throw error;}
  }
  const error=new Error(`Static fixture file not found in private/public roots: ${requested}`);error.code='ENOENT';throw error;
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
      if(typeof globalThis.fetch!=='function'||globalThis.__weigTimedFetchInstalled)return;
      const nativeFetch=globalThis.fetch.bind(globalThis);
      globalThis.fetch=async function(input,init={}){
        if(init?.signal)return nativeFetch(input,init);
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(new Error(`Browser fetch timed out after ${timeoutMs} ms`)),timeoutMs);
        try{return await nativeFetch(input,{...init,signal:controller.signal});}
        finally{clearTimeout(timer);}
      };
      Object.defineProperty(globalThis,'__weigTimedFetchInstalled',{value:true,configurable:false,enumerable:false,writable:false});
    },{timeoutMs:fetchTimeoutMs});
    return context;
  };
  return browser;
}

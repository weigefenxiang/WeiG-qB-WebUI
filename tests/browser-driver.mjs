import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_CHANNEL='chrome';

function resolveChannel(){
  const configured=process.env.WEIG_BROWSER_CHANNEL;
  const channel=(configured===undefined?DEFAULT_CHANNEL:String(configured)).trim();
  if(channel!=='chrome'){
    throw new Error(`Unsupported browser channel "${channel}". WeiG browser gates use hosted Google Chrome Stable only.`);
  }
  return channel;
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
  return chromium.launch({
    headless:true,
    ...launchOptions,
    channel:resolveChannel()
  });
}

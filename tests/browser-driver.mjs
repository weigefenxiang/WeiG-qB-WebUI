import {chromium} from 'playwright';

const DEFAULT_CHANNEL='chrome';

function resolveChannel(){
  const configured=process.env.WEIGG_BROWSER_CHANNEL;
  const channel=(configured===undefined?DEFAULT_CHANNEL:String(configured)).trim();
  if(channel!=='chrome'){
    throw new Error(`Unsupported browser channel "${channel}". WeiG browser gates use hosted Google Chrome Stable only.`);
  }
  return channel;
}

export function launchBrowser(options={}){
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

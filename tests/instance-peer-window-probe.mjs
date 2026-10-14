// A76-51: real qB Chrome capability gate for consented cross-Origin tabs.
// A test probe only: no app owner, no persisted state, no cookie/SID transport.
import crypto from 'node:crypto';

export async function probePeerWindows({first,context,target,assert,awaitRealApp}){
  const nonce=crypto.randomBytes(24).toString('hex');
  const sourceOrigin=new URL(first.url()).origin,targetOrigin=new URL(target.url).origin;
  assert(sourceOrigin!==targetOrigin,'A76-51 requires different qB browser origins');
  const peerNavigation=[];
  const observe=request=>{
    if(request.isNavigationRequest()&&request.url().startsWith(target.url))
      peerNavigation.push(request);
  };
  let popup=null;
  context.on('request',observe);
  try{
    await first.evaluate(({url,expectedOrigin,nonce})=>{
      window.__weigA76Proof=null;
      window.addEventListener('message',event=>{
        const message=event.data;
        if(event.origin!==expectedOrigin||!event.source||message?.type!=='weig-a76-peer-report'
          ||message?.nonce!==nonce||message.status!=='online'
          ||!Number.isSafeInteger(message.count)||message.count<0)return;
        window.__weigA76Proof={nonce,origin:event.origin,count:message.count};
        event.source.postMessage({type:'weig-a76-peer-ack',nonce},expectedOrigin);
      });
      const link=document.createElement('a');
      link.id='weig-a76-peer-open';link.href=url;link.target='_blank';
      link.rel='opener';link.referrerPolicy='no-referrer';
      link.textContent='Connect instance';document.body.appendChild(link);
    },{url:target.url,expectedOrigin:targetOrigin,nonce});
    const opened=first.waitForEvent('popup',{timeout:20000});
    await first.locator('#weig-a76-peer-open').click({timeout:20000});
    popup=await opened;
    await popup.waitForLoadState('domcontentloaded',{timeout:20000});
    await awaitRealApp(popup,target,'A76-51 consented popup');
    assert(await popup.evaluate(()=>!!window.opener),
      'A76-51: opener was separated by COOP/noopener; cannot use realtime peer transport');
    await popup.evaluate(async({nonce,sourceOrigin})=>{
      const health=window.WeiG?.InstanceHealth,registry=window.WeiG?.InstanceRegistry;
      if(!health||!registry)throw Error('WeiG current-instance owner unavailable');
      await health.checkNow();
      const own=health.get(registry.currentUrl());
      if(own?.status!=='online'||!Number.isSafeInteger(own.count))
        throw Error('Peer cannot read its own authenticated qB total');
      window.__weigA76Ack=null;
      window.addEventListener('message',event=>{
        if(event.source!==window.opener||event.origin!==sourceOrigin
          ||event.data?.type!=='weig-a76-peer-ack'||event.data?.nonce!==nonce)return;
        window.__weigA76Ack={nonce,origin:event.origin};
      });
      window.opener.postMessage({type:'weig-a76-peer-report',nonce,
        status:own.status,count:own.count},sourceOrigin);
    },{nonce,sourceOrigin});
    await first.waitForFunction(n=>window.__weigA76Proof?.nonce===n,nonce,{timeout:10000});
    await popup.waitForFunction(n=>window.__weigA76Ack?.nonce===n,nonce,{timeout:10000});
    const evidence=await first.evaluate(()=>window.__weigA76Proof);
    assert(evidence.origin===targetOrigin&&Number.isSafeInteger(evidence.count),
      'A76-51: exact-origin authenticated peer count not delivered');
    assert(peerNavigation.length>0,'A76-51: expected real qB popup navigation missing');
    const headers=await peerNavigation[0].allHeaders();
    assert(!Object.prototype.hasOwnProperty.call(headers,'referer'),
      'A76-51: qB popup sent a foreign Referer');
    return{transport:'postMessage',origins:[sourceOrigin,targetOrigin],
      opener:'PASS',nonceRoundTrip:'PASS',noForeignReferer:'PASS',count:evidence.count};
  }finally{
    context.off('request',observe);
    if(popup)await popup.close().catch(()=>{});
    await first.evaluate(()=>document.getElementById('weig-a76-peer-open')?.remove()).catch(()=>{});
  }
}

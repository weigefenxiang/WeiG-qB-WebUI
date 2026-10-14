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


// Product-level proof: real qB 4.6.7 origin -> independently authenticated
// real qB 5.2.4 origin, through both actual consent dialogs.
export async function probeLivePeerConsent({first,target,assert,awaitRealApp}){
  const name='Consented live qB',url=target.url;
  await first.evaluate(({url,name})=>{
    const W=window.WeiG;
    if(!W.InstanceRegistry.list(true).some(item=>item.url===url))W.InstanceRegistry.add(name,url);
    W.InstancesUI.render();
  },{url,name});
  const row=first.locator('#sidebar-instances .sidebar-instances__row').filter({hasText:name});
  let popup=null;
  try{
    await row.locator('.sidebar-instances__more').click();
    const menu=first.locator('#weig-floating-layer .ui-context-menu[role="menu"]');
    await menu.getByRole('menuitem',{name:'Connect',exact:true}).click();
    const sourceConsent=first.locator('.instance-manager-dialog').filter({hasText:'Connect instance?'});
    await sourceConsent.waitFor({state:'visible',timeout:10000});
    const popupEvent=first.waitForEvent('popup',{timeout:20000});
    await sourceConsent.locator('.btn--primary').click({timeout:10000});
    popup=await popupEvent;
    await awaitRealApp(popup,target,'consented live peer target');
    await popup.waitForFunction(()=>!!window.WeiG?.InstancePeerBridge&&!!window.WeiG?.InstancesUI,null,{timeout:20000});
    assert(await popup.evaluate(()=>!!window.opener),'Live peer target must retain the actual opener WindowProxy');
    const targetConsent=popup.locator('.instance-manager-dialog').filter({hasText:'Share live status?'});
    await targetConsent.waitFor({state:'visible',timeout:20000});
    await targetConsent.locator('.btn--primary').click({timeout:10000});
    await first.waitForFunction(url=>{
      const row=WeiG.InstanceHealth?.get(url);
      return row?.status==='online'&&row.source==='peer'&&Number.isSafeInteger(row.count);
    },url,{timeout:20000});
    const live=await first.evaluate(url=>{
      const health=WeiG.InstanceHealth.get(url),row=[...document.querySelectorAll('#sidebar-instances .sidebar-instances__row')]
        .find(el=>el.querySelector('.sidebar-instances__select')?.title.includes(url));
      return{count:health.count,status:health.status,source:health.source,
        label:row?.querySelector('.sidebar-instances__count')?.textContent?.trim(),
        dot:row?.querySelector('.sidebar-instances__dot')?.dataset.state};
    },url);
    const actual=await popup.evaluate(()=>WeiG.AppState.client.torrentCount());
    assert(live.status==='online'&&live.source==='peer'&&live.count===actual
      &&live.dot==='online'&&live.label===String(actual),
      'Actual consented peer qB count/color mismatch: '+JSON.stringify({live,actual}));
    await row.locator('.sidebar-instances__more').click();
    await menu.getByRole('menuitem',{name:'Disconnect',exact:true}).click();
    await first.waitForFunction(url=>{
      const health=WeiG.InstanceHealth.get(url);
      const row=[...document.querySelectorAll('#sidebar-instances .sidebar-instances__row')]
        .find(el=>el.querySelector('.sidebar-instances__select')?.title.includes(url));
      return health.status==='unverified'&&Number.isSafeInteger(health.reportedCount)
        &&row?.querySelector('.sidebar-instances__dot')?.dataset.state==='historical'
        &&row.querySelector('.sidebar-instances__count')?.textContent?.trim()===String(health.reportedCount)+'*';
    },url,{timeout:10000});
    return{realLiveStatus:'PASS',sourceConsent:'PASS',targetConsent:'PASS',
      disconnectHistorical:'PASS',count:actual};
  }finally{
    await first.evaluate(url=>{
      const W=window.WeiG;W?.InstancePeerBridge?.disconnect(url);
      if(W?.InstanceRegistry?.list(true).some(item=>item.url===url))W.InstanceRegistry.remove(url);
      W?.InstancesUI?.render();
    },url).catch(()=>{});
    if(popup)await popup.close().catch(()=>{});
  }
}

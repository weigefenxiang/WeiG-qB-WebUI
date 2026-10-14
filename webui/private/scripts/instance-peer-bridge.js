(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(W.InstancePeerBridge)return;
  // A76: browser-only transport. InstanceHealth alone owns all status truth.
  var PREFIX='#!weig-peer=',PROTOCOL='weig-peer-v1',POLL_MS=30000,MAX_PENDING_MS=10*60000;
  var outgoing=new Map(),connected=new Map(),incoming=null,approved=null,started=false;
  function current(){return W.InstanceRegistry&&W.InstanceRegistry.currentUrl?W.InstanceRegistry.currentUrl():new URL('/',global.location.href).href;}
  function validURL(value){
    try{var u=new URL(value);return (u.protocol==='https:'||u.protocol==='http:')&&
      !u.username&&!u.password&&!u.search&&!u.hash&&u.href===value;}catch(_e){return false;}
  }
  function nonce(){var data=new Uint8Array(24);global.crypto.getRandomValues(data);return Array.from(data,function(x){return x.toString(16).padStart(2,'0');}).join('');}
  function validNonce(v){return typeof v==='string'&&/^[a-f0-9]{48}$/.test(v);}
  function emit(){global.dispatchEvent(new CustomEvent('weig:instance-peer'));}
  function parseIncoming(){
    // Handoff captures pre-auth URL fragments before qB login redirects.
    var H=W.InstanceHandoff,invite=H&&H.peekPeer&&H.peekPeer();
    if(!invite)return;
    if(!validNonce(invite.nonce)||!validURL(invite.source))return;
    incoming={nonce:invite.nonce,source:invite.source,
      origin:new URL(invite.source).origin,created:Date.now()};
  }
  parseIncoming();
  function send(peer,type,body){
    if(!peer||!peer.win||peer.win.closed)return false;
    try{peer.win.postMessage(Object.assign({protocol:PROTOCOL,type:type,nonce:peer.nonce},body||{}),peer.origin);return true;}
    catch(_e){return false;}
  }
  function clearPeer(url){
    if(!connected.has(url))return;
    connected.delete(url);
    if(W.InstanceHealth&&W.InstanceHealth.clearPeer)W.InstanceHealth.clearPeer(url);
    emit();
  }
  function connect(url){
    var R=W.InstanceRegistry;
    if(!R||!R.list(true).some(function(x){return x.url===url;})||!validURL(url)
      ||url===current())throw new Error('Choose another saved instance.');
    if(global.location.protocol==='https:'&&new URL(url).protocol==='http:')
      throw new Error('HTTPS to HTTP requires explicit confirmation before connecting.');
    if(outgoing.size>=16)throw new Error('Too many pending connections.');
    var id=nonce(),origin=new URL(url).origin,request={url:url,origin:origin,nonce:id,created:Date.now()};
    var destination=new URL(url);
    destination.hash=PREFIX+encodeURIComponent(JSON.stringify({v:1,nonce:id,source:current()}));
    outgoing.set(id,request);
    // Must run synchronously from a direct user gesture. rel=opener is
    // intentional and requires user consent; never use noreferrer here.
    var link=global.document.createElement('a');
    link.href=destination.href;link.target='_blank';link.rel='opener';link.referrerPolicy='no-referrer';
    link.hidden=true;global.document.body.appendChild(link);
    try{link.click();}finally{link.remove();}
    emit();return true;
  }
  function pendingInvitation(){
    return incoming&&Date.now()-incoming.created<MAX_PENDING_MS?
      {source:incoming.source,origin:incoming.origin}:null;
  }
  function approveIncoming(){
    if(!pendingInvitation()||!global.opener||global.opener.closed)return false;
    approved={origin:incoming.origin,nonce:incoming.nonce,win:global.opener,url:incoming.source};
    incoming=null;if(W.InstanceHandoff&&W.InstanceHandoff.consumePeer)W.InstanceHandoff.consumePeer();
    send(approved,'hello',{url:current()});emit();return true;
  }
  function rejectIncoming(){incoming=null;approved=null;
    if(W.InstanceHandoff&&W.InstanceHandoff.consumePeer)W.InstanceHandoff.consumePeer();emit();}
  async function report(){
    var peer=approved;
    if(!peer||!W.InstanceHealth||!W.InstanceRegistry)return;
    try{
      await W.InstanceHealth.checkNow();
      if(approved!==peer)return;
      var data=W.InstanceHealth.get(current()),online=data&&data.status==='online';
      var count=online&&Number.isSafeInteger(data.count)&&data.count>=0?data.count:null;
      send(peer,'status',{url:current(),status:online?'online':'unverified',
        count:count,at:Date.now()});
    }catch(_e){send(peer,'status',{url:current(),status:'unverified',count:null,at:Date.now()});}
  }
  function onMessage(event){
    var m=event.data;
    if(!m||typeof m!=='object'||m.protocol!==PROTOCOL||!validNonce(m.nonce)||!event.source)return;
    if(m.type==='hello'){
      var request=outgoing.get(m.nonce);
      if(!request||Date.now()-request.created>MAX_PENDING_MS
        ||request.origin!==event.origin||request.url!==m.url)return;
      outgoing.delete(m.nonce);
      var peer={url:request.url,origin:request.origin,nonce:request.nonce,win:event.source};
      connected.set(peer.url,peer);send(peer,'welcome');emit();return;
    }
    if(approved&&m.nonce===approved.nonce&&event.source===approved.win&&event.origin===approved.origin){
      if(m.type==='welcome'){report();return;}
      if(m.type==='poll'){report();return;}
      if(m.type==='disconnect'){approved=null;emit();return;}
    }
    var peers=Array.from(connected.values()),peer=peers.find(function(x){
      return x.nonce===m.nonce&&x.win===event.source&&x.origin===event.origin;
    });
    if(!peer)return;
    if(m.type==='status'){
      if(m.url!==peer.url||!Number.isSafeInteger(m.at)||Math.abs(Date.now()-m.at)>60000
        ||!['online','unverified'].includes(m.status)
        ||m.count!==null&&(!Number.isSafeInteger(m.count)||m.count<0)
        ||m.status!=='online'&&m.count!==null)return;
      if(W.InstanceHealth&&W.InstanceHealth.acceptPeer)
        W.InstanceHealth.acceptPeer(peer.url,{status:m.status,count:m.count,checkedAt:m.at});
      return;
    }
    if(m.type==='disconnect')clearPeer(peer.url);
  }
  function disconnect(url){
    var peer=connected.get(url);if(peer)send(peer,'disconnect');
    for(var kv of outgoing){if(kv[1].url===url)outgoing.delete(kv[0]);}
    clearPeer(url);
  }
  function isConnected(url){return connected.has(url);}
  function focus(url){
    var peer=connected.get(url);
    if(!peer||peer.win.closed){clearPeer(url);return false;}
    try{peer.win.focus();return true;}catch(_e){return false;}
  }
  function poll(){
    var now=Date.now();
    for(var kv of outgoing){if(now-kv[1].created>MAX_PENDING_MS)outgoing.delete(kv[0]);}
    for(var pair of connected){
      if(pair[1].win.closed||!send(pair[1],'poll'))clearPeer(pair[0]);
    }
    if(approved&&approved.win.closed){approved=null;emit();}
    if(W.InstanceHealth&&W.InstanceHealth.expirePeers)W.InstanceHealth.expirePeers();
  }
  function start(){if(started)return;started=true;global.addEventListener('message',onMessage);
    global.addEventListener('visibilitychange',poll);
    global.setInterval(poll,POLL_MS);
  }
  start();
  W.InstancePeerBridge=Object.freeze({connect:connect,disconnect:disconnect,
    isConnected:isConnected,focus:focus,pendingInvitation:pendingInvitation,
    approveIncoming:approveIncoming,rejectIncoming:rejectIncoming});
})(window);

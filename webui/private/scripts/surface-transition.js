(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  if(W.SurfaceTransition)return;
  var active=new WeakMap(),ghosts=new Set();

  function motionSetting(){var root=global.document&&document.documentElement;return String(root&&root.dataset&&root.dataset.motion||'system');}
  function systemReduced(){try{return !!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);}catch(_e){return false;}}
  function policy(kind){
    kind=String(kind||'surface');
    var setting=motionSetting(),reduced=setting==='reduced'||(setting!=='full'&&systemReduced()),full=setting==='full';
    if(reduced)return{mode:'reduced',duration:0,fade:0,offset:0,scale:1,blur:0};
    var base=kind==='detail'?220:kind==='rail'?240:kind==='dock'?160:150;
    return{mode:full?'full':'system',duration:full?Math.round(base*1.55):base,fade:full?140:90,offset:full?14:7,scale:full?.955:.982,blur:full?5:2};
  }
  function animate(node,frames,timing){if(!node||typeof node.animate!=='function')return null;try{return node.animate(frames,timing);}catch(_e){return null;}}
  function settled(animation){return animation&&animation.finished?Promise.resolve(animation.finished).catch(function(){}):Promise.resolve();}
  function stop(animation){if(!animation)return;try{animation.cancel();}catch(_e){}}
  function capture(node){
    if(!node||!node.getBoundingClientRect)return null;
    var rect=node.getBoundingClientRect();if(!rect||rect.width<=0||rect.height<=0)return null;
    var style=global.getComputedStyle?global.getComputedStyle(node):null;
    return{rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},background:style&&(style.backgroundColor||style.background)||'',borderColor:style&&style.borderColor||'',borderWidth:style&&style.borderWidth||'',borderRadius:style&&style.borderRadius||'',boxShadow:style&&style.boxShadow||''};
  }
  function ghost(snapshot,className){
    if(!snapshot||!snapshot.rect||!global.document)return null;
    var node=document.createElement('div'),r=snapshot.rect;node.className=className||'surface-transition-ghost';
    node.style.left=r.left+'px';node.style.top=r.top+'px';node.style.width=r.width+'px';node.style.height=r.height+'px';
    if(snapshot.background)node.style.background=snapshot.background;if(snapshot.borderColor)node.style.borderColor=snapshot.borderColor;if(snapshot.borderWidth)node.style.borderWidth=snapshot.borderWidth;if(snapshot.borderRadius)node.style.borderRadius=snapshot.borderRadius;if(snapshot.boxShadow&&snapshot.boxShadow!=='none')node.style.boxShadow=snapshot.boxShadow;
    return node;
  }
  function cancel(node){var entry=node&&active.get(node);if(!entry)return false;active.delete(node);var animation=entry&&entry.animation?entry.animation:entry;stop(animation);if(entry&&typeof entry.cleanup==='function')entry.cleanup(false);if(node&&node.dataset)delete node.dataset.surfaceTransition;return true;}
  function clearSlideStyles(node){if(!node||!node.style)return;['height','overflow','opacity','transform','willChange'].forEach(function(name){node.style.removeProperty(name.replace(/[A-Z]/g,function(ch){return'-'+ch.toLowerCase();}));});}
  function slide(node,open,kind){
    kind=String(kind||'rail');var p=policy(kind),wantOpen=!!open;cancel(node);if(!node)return Promise.resolve(false);if(wantOpen)node.hidden=false;
    if(p.duration<=0){clearSlideStyles(node);node.hidden=!wantOpen;return Promise.resolve(true);}
    var startHeight=wantOpen?0:Math.max(0,node.getBoundingClientRect().height),targetHeight;
    if(wantOpen){node.style.height='auto';targetHeight=Math.max(0,node.scrollHeight||node.getBoundingClientRect().height);node.style.height='0px';}else targetHeight=0;
    if(!wantOpen&&startHeight<=0){clearSlideStyles(node);node.hidden=true;return Promise.resolve(true);}
    node.style.overflow='hidden';node.style.willChange='height, opacity, transform';if(node.dataset)node.dataset.surfaceTransition=wantOpen?'slide-in':'slide-out';
    var offset=Math.max(5,p.offset),frames=wantOpen?[{height:'0px',opacity:0,transform:'translateY('+offset+'px)'},{height:targetHeight+'px',opacity:1,transform:'translateY(0)'}]:[{height:startHeight+'px',opacity:1,transform:'translateY(0)'},{height:'0px',opacity:0,transform:'translateY('+offset+'px)'}],animation=animate(node,frames,{duration:p.duration,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'});
    if(!animation){clearSlideStyles(node);node.hidden=!wantOpen;if(node.dataset)delete node.dataset.surfaceTransition;return Promise.resolve(false);}
    var entry={animation:animation,cleanup:function(finalize){clearSlideStyles(node);if(finalize)node.hidden=!wantOpen;}};
    active.set(node,entry);return settled(animation).then(function(){if(active.get(node)!==entry)return false;active.delete(node);stop(animation);entry.cleanup(true);if(node.dataset)delete node.dataset.surfaceTransition;return true;});
  }
  function enter(node,kind){
    var p=policy(kind);cancel(node);if(!node||p.duration<=0)return Promise.resolve(false);
    if(node.dataset)node.dataset.surfaceTransition='enter';
    var animation=animate(node,[{opacity:0,transform:'translateY('+p.offset+'px) scale('+p.scale+')',filter:'blur('+p.blur+'px)'},{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'}],{duration:p.duration,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'});
    if(!animation){if(node.dataset)delete node.dataset.surfaceTransition;return Promise.resolve(false);}
    active.set(node,animation);return settled(animation).then(function(){if(active.get(node)!==animation)return false;active.delete(node);stop(animation);if(node.dataset)delete node.dataset.surfaceTransition;return true;});
  }
  function removeGhost(node){if(!node)return;ghosts.delete(node);if(node.isConnected)node.remove();}
  function exitSnapshot(snapshot,kind){
    var p=policy(kind);if(!snapshot||p.duration<=0||!global.document)return Promise.resolve(false);
    var node=ghost(snapshot,'surface-transition-ghost surface-transition-ghost--exit');if(!node)return Promise.resolve(false);document.body.appendChild(node);ghosts.add(node);
    var animation=animate(node,[{opacity:1,transform:'translateY(0) scale(1)',filter:'blur(0)'},{opacity:0,transform:'translateY('+Math.max(3,p.offset*.7)+'px) scale('+Math.max(.94,p.scale)+')',filter:'blur('+p.blur+'px)'}],{duration:Math.max(90,Math.round(p.duration*.8)),easing:'cubic-bezier(.4,0,.2,1)',fill:'both'});
    if(!animation){removeGhost(node);return Promise.resolve(false);}return settled(animation).then(function(){stop(animation);removeGhost(node);return true;});
  }
  function morph(snapshot,target,kind){
    var p=policy(kind||'detail'),targetSnapshot=capture(target);if(!snapshot||!targetSnapshot||p.duration<=0||!global.document)return Promise.resolve(false);
    var node=ghost(snapshot,'surface-transition-ghost surface-transition-ghost--morph');if(!node)return Promise.resolve(false);
    var previousOpacity=target.style.opacity,source=snapshot.rect,dest=targetSnapshot.rect,dx=dest.left-source.left,dy=dest.top-source.top,sx=dest.width/source.width,sy=dest.height/source.height;
    target.style.opacity='0';document.body.appendChild(node);ghosts.add(node);
    var move=animate(node,[{opacity:.96,transform:'translate3d(0,0,0) scale(1,1)',filter:'blur(0)'},{opacity:1,transform:'translate3d('+dx+'px,'+dy+'px,0) scale('+sx+','+sy+')',filter:'blur('+Math.min(1.5,p.blur*.3)+'px)'}],{duration:p.duration,easing:'cubic-bezier(.2,.82,.2,1)',fill:'both'});
    if(!move){target.style.opacity=previousOpacity;removeGhost(node);return Promise.resolve(false);}
    return settled(move).then(function(){
      stop(move);target.style.opacity=previousOpacity||'1';
      var fadeTarget=animate(target,[{opacity:0,filter:'blur('+Math.min(3,p.blur)+'px)'},{opacity:1,filter:'blur(0)'}],{duration:p.fade,easing:'ease-out',fill:'both'});
      var fadeGhost=animate(node,[{opacity:1},{opacity:0}],{duration:p.fade,easing:'ease-out',fill:'both'});
      return Promise.all([settled(fadeTarget),settled(fadeGhost)]).then(function(){stop(fadeTarget);stop(fadeGhost);if(previousOpacity)target.style.opacity=previousOpacity;else target.style.removeProperty('opacity');removeGhost(node);return true;});
    }).catch(function(){stop(move);if(previousOpacity)target.style.opacity=previousOpacity;else target.style.removeProperty('opacity');removeGhost(node);return false;});
  }
  function clear(){Array.from(ghosts).forEach(removeGhost);}
  W.SurfaceTransition={policy:policy,capture:capture,enter:enter,slide:slide,exitSnapshot:exitSnapshot,morph:morph,cancel:cancel,clear:clear};
})(window);

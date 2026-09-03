(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util;
  if(!U||W.Feedback)return;

  var MAX_VISIBLE=4;
  var DEFAULT_DURATION={info:3800,success:3800,warning:4400,error:5200};
  var active=[],nextId=1,nextAutoOrder=1,timeoutInFlight=false;
  var iconPaths={
    info:['M12 10v6','M12 7h.01'],
    success:['m8 12 2.5 2.5L16 9'],
    warning:['M12 8v5','M12 16h.01'],
    error:['m9 9 6 6','m15 9-6 6']
  };

  function locale(){
    return W.I18n&&W.I18n.getLocale?W.I18n.getLocale():'en';
  }
  function words(){
    var l=locale();
    if(l==='zh-CN')return{dismiss:'关闭通知',info:'提示',success:'操作成功',warning:'请注意',error:'操作失败'};
    if(l==='zh-TW')return{dismiss:'關閉通知',info:'提示',success:'操作成功',warning:'請注意',error:'操作失敗'};
    if(l==='ja')return{dismiss:'通知を閉じる',info:'お知らせ',success:'完了',warning:'注意',error:'エラー'};
    if(l==='ko')return{dismiss:'알림 닫기',info:'안내',success:'완료',warning:'주의',error:'오류'};
    return{dismiss:'Dismiss notification',info:'Information',success:'Completed',warning:'Attention',error:'Action failed'};
  }
  function normalizeKind(kind){
    kind=String(kind||'info').toLowerCase();
    return Object.prototype.hasOwnProperty.call(DEFAULT_DURATION,kind)?kind:'info';
  }
  function reducedMotion(){
    return document.documentElement.dataset.motion==='reduced'||!!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function host(){
    var node=U.$('toast-region');
    if(!node)return null;
    node.classList.add('feedback-stack');
    node.setAttribute('aria-live','polite');
    node.setAttribute('aria-relevant','additions text');
    return node;
  }
  function svgIcon(kind){
    var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 24 24');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('focusable','false');
    svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor');
    svg.setAttribute('stroke-width','2');
    svg.setAttribute('stroke-linecap','round');
    svg.setAttribute('stroke-linejoin','round');
    var pathList=iconPaths[kind]||iconPaths.info;
    pathList.forEach(function(d){
      var p=document.createElementNS(ns,'path');
      p.setAttribute('d',d);
      svg.appendChild(p);
    });
    return svg;
  }
  function snapshot(){
    var out=new Map();
    active.forEach(function(record){
      if(record.node&&record.node.isConnected)out.set(record.id,record.node.getBoundingClientRect());
    });
    return out;
  }
  function playReflow(before){
    if(reducedMotion())return;
    active.forEach(function(record){
      var old=before.get(record.id);
      if(!old||!record.node||!record.node.isConnected||record.state==='leaving')return;
      var now=record.node.getBoundingClientRect(),dx=old.left-now.left,dy=old.top-now.top;
      if(Math.abs(dx)<.5&&Math.abs(dy)<.5)return;
      record.node.style.transition='none';
      record.node.style.transform='translate('+dx+'px,'+dy+'px)';
      record.node.getBoundingClientRect();
      requestAnimationFrame(function(){
        if(!record.node||!record.node.isConnected)return;
        record.node.style.transition='';
        record.node.style.transform='';
      });
    });
  }
  function withReflow(mutator){
    var before=snapshot();
    mutator();
    playReflow(before);
  }
  function clearTimer(record){
    if(record.timer){clearTimeout(record.timer);record.timer=null;}
  }
  function restartProgress(record){
    var progress=record.progress;
    if(!progress)return;
    progress.classList.remove('is-running');
    progress.style.setProperty('--feedback-duration',(record.duration||0)+'ms');
    progress.hidden=!record.duration;
    if(!record.duration)return;
    progress.getBoundingClientRect();
    requestAnimationFrame(function(){
      if(progress.isConnected)progress.classList.add('is-running');
    });
  }
  function finiteQueue(){
    return active.filter(function(record){
      return record.state!=='removed'&&record.state!=='leaving'&&record.duration>0&&record.autoOrder>0;
    }).sort(function(a,b){return a.autoOrder-b.autoOrder;});
  }
  function flushTimeoutQueue(){
    if(timeoutInFlight)return;
    var queue=finiteQueue(),first=queue[0];
    if(first&&first.timeoutReady){
      timeoutInFlight=true;
      dismiss(first,'timeout');
    }
  }
  function schedule(record){
    clearTimer(record);
    record.timeoutReady=false;
    restartProgress(record);
    if(!record.duration){record.autoOrder=0;return;}
    if(!record.autoOrder)record.autoOrder=nextAutoOrder++;
    record.startedAt=Date.now();
    record.timer=setTimeout(function(){
      record.timer=null;
      record.timeoutReady=true;
      flushTimeoutQueue();
    },record.duration);
  }
  function setIcon(record,kind){
    record.icon.textContent='';
    record.icon.appendChild(svgIcon(kind));
  }
  function paint(record,message,kind,options){
    options=options||{};
    kind=normalizeKind(kind);
    record.kind=kind;
    record.node.dataset.kind=kind;
    record.node.setAttribute('role',kind==='error'?'alert':'status');
    record.node.setAttribute('aria-atomic','true');
    record.title.textContent=options.title==null?words()[kind]:String(options.title);
    record.message.textContent=message==null?'':String(message);
    record.message.hidden=!record.message.textContent;
    record.close.setAttribute('aria-label',words().dismiss);
    setIcon(record,kind);
    var duration=options.duration;
    record.duration=duration==null?DEFAULT_DURATION[kind]:Math.max(0,Number(duration)||0);
    schedule(record);
  }
  function removeRecord(record){
    var index=active.indexOf(record);
    if(index<0)return;
    withReflow(function(){
      active.splice(index,1);
      if(record.node&&record.node.parentNode)record.node.remove();
    });
    record.state='removed';
    if(record.leaveReason==='timeout')timeoutInFlight=false;
    flushTimeoutQueue();
  }
  function dismiss(record,reason){
    if(!record||record.state==='leaving'||record.state==='removed')return;
    clearTimer(record);
    record.state='leaving';
    record.leaveReason=reason||'manual';
    record.node.dataset.state='leaving';
    record.node.classList.add('is-leaving');
    record.progress.classList.remove('is-running');
    var delay=reducedMotion()?0:220;
    clearTimeout(record.leaveTimer);
    record.leaveTimer=setTimeout(function(){record.leaveTimer=null;removeRecord(record);},delay);
  }
  function enforceLimit(){
    var stable=active.filter(function(record){return record.state!=='leaving'&&record.state!=='removed';});
    while(stable.length>MAX_VISIBLE){
      dismiss(stable.shift(),'overflow');
    }
  }
  function build(message,kind,options){
    var region=host();
    if(!region)return null;
    var record={id:nextId++,state:'entering',timer:null,leaveTimer:null,duration:0,startedAt:0,autoOrder:0,timeoutReady:false,leaveReason:''};
    var outer=document.createElement('div');
    outer.className='feedback-toast is-entering';
    outer.dataset.feedbackId=String(record.id);
    outer.dataset.state='entering';
    var surface=document.createElement('div');
    surface.className='feedback-toast__surface';
    var icon=document.createElement('span');
    icon.className='feedback-toast__icon';
    var copy=document.createElement('span');
    copy.className='feedback-toast__copy';
    var title=document.createElement('strong');
    title.className='feedback-toast__title';
    var body=document.createElement('span');
    body.className='feedback-toast__message';
    copy.append(title,body);
    var close=document.createElement('button');
    close.type='button';
    close.className='feedback-toast__dismiss';
    close.textContent='×';
    var progress=document.createElement('span');
    progress.className='feedback-toast__progress';
    progress.setAttribute('aria-hidden','true');
    surface.append(icon,copy,close,progress);
    outer.appendChild(surface);
    Object.assign(record,{node:outer,surface:surface,icon:icon,title:title,message:body,close:close,progress:progress});
    close.addEventListener('click',function(){dismiss(record,'manual');});
    var before=snapshot();
    active.push(record);
    region.appendChild(outer);
    paint(record,message,kind,options);
    enforceLimit();
    playReflow(before);
    requestAnimationFrame(function(){
      if(!outer.isConnected)return;
      outer.classList.remove('is-entering');
      outer.dataset.state='active';
      record.state='active';
    });
    return record;
  }
  function toast(message,kind,options){
    var record=build(message,kind,options);
    if(!record)return{update:function(){},dismiss:function(){}};
    return{
      update:function(nextMessage,nextKind,nextOptions){
        if(record.state==='removed')return this;
        if(record.leaveReason==='timeout'&&record.state==='leaving')timeoutInFlight=false;
        clearTimeout(record.leaveTimer);record.leaveTimer=null;
        record.leaveReason='';
        record.node.classList.remove('is-leaving');
        record.node.dataset.state='active';
        record.state='active';
        paint(record,nextMessage,nextKind||record.kind,nextOptions||{});
        flushTimeoutQueue();
        return this;
      },
      dismiss:function(){dismiss(record,'manual');},
      id:record.id
    };
  }

  W.Feedback={
    show:toast,
    dismissAll:function(){active.slice().forEach(function(record){dismiss(record,'all');});},
    size:function(){return active.filter(function(record){return record.state!=='removed';}).length;},
    kinds:Object.keys(DEFAULT_DURATION)
  };
  W.toast=toast;
})(window);

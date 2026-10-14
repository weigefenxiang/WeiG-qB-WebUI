(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},R=W.InstanceRegistry,H=W.InstanceHealth,P=W.InstancePeerBridge,D=W.DialogRuntime,STORE=W.StorageRuntime&&W.StorageRuntime.local;
  if(W.InstancesUI||!R||!D)return;
  var KEY=W.StorageKeys&&W.StorageKeys.instancesCollapsed||'weig.instances.collapsed';
  var host=null,expanded=!(STORE&&STORE.get(KEY,'0')==='1'),importOffered=false,liveRows=new Map();
  function tr(key,vars){return W.I18n&&W.I18n.t?W.I18n.t('instances.'+key,vars):String(key);}
  function el(tag,cls,text){var node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;}
  function button(label,cls,callback){var b=el('button',cls,label);b.type='button';if(callback)b.addEventListener('click',callback);return b;}
  function notice(message){var region=document.getElementById('sidebar-instance-error');if(region)region.textContent=String(message||'');if(message&&W.toast)W.toast(String(message),'error');}
  function modal(title){
    var dlg=D.create({className:'dialog surface surface--modal instance-manager-dialog',draggable:true,backdropClose:true,escapeClose:true,removeOnClose:true});
    var head=el('div','dialog__head'),text=el('h2','',title),close=button('×','icon-btn',function(){D.close(dlg,'close');});
    close.setAttribute('aria-label',tr('close'));head.append(text,close);
    var body=el('div','dialog__body'),footer=el('div','dialog__footer instance-manager__footer');
    dlg.append(head,body,footer);
    return{dialog:dlg,body:body,footer:footer,show:function(focus){D.open(dlg,{focus:focus,draggable:true,removeOnClose:true});}};
  }
  function ask(title,description,accept,onAccept,onCancel){
    var m=modal(title),copy=el('p','text-description',description);
    m.body.appendChild(copy);
    m.footer.append(button(tr('cancel'),'btn btn--ghost',function(){if(onCancel)onCancel();D.close(m.dialog,'cancel');}));
    m.footer.append(button(accept,'btn btn--primary',function(){try{onAccept();D.close(m.dialog,'confirm');}catch(error){var msg=m.body.querySelector('[role="alert"]');if(!msg){msg=el('p','instance-manager__feedback');msg.setAttribute('role','alert');m.body.appendChild(msg);}msg.textContent=error.message;}}));
    m.show();
    return m;
  }
  function records(){
    var current=R.currentUrl(),saved=R.list(true),own=saved.find(function(x){return x.url===current;});
    return [own||{name:R.defaultName(current),url:current}].concat(saved.filter(function(x){return x.url!==current;}));
  }
  function transferAndSwitch(item){
    if(item.url===R.currentUrl())return;
    // Reuse the consented live tab instead of unloading the broker page.
    if(P&&P.isConnected(item.url)&&P.focus(item.url))return;
    var action=function(insecure){
      try{R.switchTo(item.url,{transfer:true,allowDowngrade:insecure===true,currentName:records()[0].name});}
      catch(error){notice(error.message);}
    };
    if(global.location.protocol==='https:'&&new URL(item.url).protocol==='http:'){
      ask(tr('insecureTitle'),tr('insecureWarning'),tr('continue'),function(){action(true);});
      return;
    }
    action(false);
  }
  function paintHealth(view){
    var health=H&&H.get(view.item.url),state=health&&health.status||'unknown',count=health&&health.count;
    var status=state==='online'?tr('online'):tr('unverified'),historical=count==null&&health&&Number.isSafeInteger(health.reportedCount)?health.reportedCount:null;
    view.dot.dataset.state=state==='online'?'online':historical===null?'unknown':'historical';
    view.total.textContent=count==null?(historical===null?'—':String(historical)+'*'):String(count);
    var previous=health&&health.reportedAt&&state!=='online'?tr('lastReported',{time:new Date(health.reportedAt).toLocaleString()}):'';
    view.select.title=view.item.name+' · '+view.item.url+' · '+status+(count!=null?' · '+tr('torrentCount',{count:count}):historical===null?'':' · '+tr('torrentCount',{count:historical})+'*')+(previous?' · '+previous:'');
    view.select.setAttribute('aria-label',view.select.title);
  }
  function updateHealth(){liveRows.forEach(paintHealth);}
  function render(){
    if(!host)return;
    liveRows.clear();
    host.dataset.expanded=expanded?'1':'0';host.textContent='';
    var top=el('div','sidebar-instances__head');
    var heading=button('','sidebar-instances__heading',function(){
      expanded=!expanded;if(STORE)STORE.set(KEY,expanded?'0':'1');render();
    });
    heading.setAttribute('aria-expanded',expanded?'true':'false');
    heading.append(el('span','sidebar-instances__chevron','⌄'),el('span','',tr('title')));
    top.appendChild(heading);host.append(top);
    var content=el('div','sidebar-instances__body');
    var items=[];try{items=records();}catch(error){notice(error.message);}
    items.forEach(function(item){
      var active=item.url===R.currentUrl();
      var row=el('div','sidebar-instances__row'),select=button('','sidebar-instances__select',function(){transferAndSwitch(item);});
      if(active)row.classList.add('is-active');
      select.setAttribute('aria-current',active?'page':'false');
      var label=el('span','sidebar-instances__name');
      var dot=el('span','sidebar-instances__dot');dot.setAttribute('aria-hidden','true');
      label.append(dot,el('span','',item.name+(active?tr('currentSuffix'):'')));
      var total=el('span','sidebar-instances__count');
      select.append(label,total);
      var view={item:item,select:select,dot:dot,total:total};
      liveRows.set(item.url,view);paintHealth(view);
      var more=button('···','sidebar-instances__more',function(event){
        // ContextMenu is owned by the shared floating layer; keep this opening click
        // from reaching its document-level outside-click closer in the same event.
        event.stopPropagation();
        var r=more.getBoundingClientRect();
        if(W.Components&&W.Components.openContextMenu)W.Components.openContextMenu({x:r.left,y:r.bottom,items:instanceMenu(item,active)});
      });
      more.setAttribute('aria-label',tr('manage')+' · '+item.name);
      more.setAttribute('aria-haspopup','menu');
      row.append(select,more);
      if(W.Components&&W.Components.bindContextMenuTrigger)W.Components.bindContextMenuTrigger(row,function(){return instanceMenu(item,active);});
      content.appendChild(row);
    });
    var actions=el('div','sidebar-instances__actions');
    actions.append(button('＋ '+tr('add'),'btn btn--ghost',function(){openManager();}));
    actions.append(button('↻ '+tr('refresh'),'btn btn--ghost',function(){
      if(!H)return;
      H.checkNow().catch(function(error){notice(error.message);});
    }));
    content.appendChild(actions);
    var error=el('p','instance-manager__feedback');error.id='sidebar-instance-error';error.setAttribute('role','status');
    content.appendChild(error);
    host.appendChild(content);
  }
  function openRename(item){
    var m=modal(tr('rename')),input=el('input','field-input'),label=el('label','',tr('name')),feedback=el('p','instance-manager__feedback');
    input.type='text';input.maxLength=48;input.value=item.name;label.appendChild(input);feedback.setAttribute('role','alert');m.body.append(label,feedback);
    m.footer.append(button(tr('cancel'),'btn btn--ghost',function(){D.close(m.dialog,'cancel');}));
    m.footer.append(button(tr('save'),'btn btn--primary',function(){
      try{
        var saved=R.list(true).some(function(x){return x.url===item.url;});
        if(saved)R.update(item.url,input.value,item.url);
        else R.add(input.value,item.url);
        render();D.close(m.dialog,'save');
      }catch(error){feedback.textContent=error.message;}
    }));
    m.show(input);input.select();
  }
  function instanceMenu(item,active){
    var connected=P&&P.isConnected(item.url);
    return[
      {label:connected?tr('disconnect'):tr('connect'),disabled:active||!P,onSelect:function(){
        if(!P)return;
        if(connected){P.disconnect(item.url);render();return;}
        var downgrade=global.location.protocol==='https:'&&new URL(item.url).protocol==='http:';
        var description=tr('connectHint',{name:item.name})+' · '+item.url+
          (downgrade?' · '+tr('insecureWarning'):'');
        ask(tr('connectTitle'),description,tr('connect'),function(){
          P.connect(item.url,{allowDowngrade:downgrade});
        });
      }},
      {label:tr('rename'),onSelect:function(){openRename(item);}},
      {label:tr('edit'),onSelect:function(){openManager(item);}},
      {label:tr('remove'),disabled:active,onSelect:function(){
        ask(tr('remove'),item.name+' · '+item.url,tr('remove'),function(){
          if(P)P.disconnect(item.url);R.remove(item.url);render();
        });
      }}
    ];
  }
  function openManager(initial){
    var m=modal(tr('manage')),list=el('div','instance-manager__list'),form=el('form','instance-manager__fields');
    form.noValidate=true;var name=el('input','field-input'),url=el('input','field-input');
    name.type='text';name.maxLength=48;name.required=true;
    url.type='url';url.required=true;url.placeholder='http://192.168.1.72:8080/';
    var nameLabel=el('label','',tr('name')),urlLabel=el('label','',tr('url'));nameLabel.append(name);urlLabel.append(url);
    var localHint=el('p','instance-manager__feedback');localHint.setAttribute('role','note');
    function syncAddressHint(){
      var host='';
      try{host=new URL(url.value).hostname;}catch(_error){}
      localHint.textContent=/^(127\.0\.0\.1|localhost|\[::1\])$/i.test(host)?tr('loopbackWarning'):'';
    }
    url.addEventListener('input',syncAddressHint);
    var status=el('p','instance-manager__feedback');status.setAttribute('role','status');
    var save=button(tr('save'),'btn btn--primary');save.type='submit';
    form.append(nameLabel,urlLabel,localHint,status,save);
    var editingUrl=null;
    function showRows(){
      list.textContent='';
      try{R.list(true).forEach(function(item){
        var row=el('div','instance-manager__row'),label=el('span','',item.name+' · '+item.url);
        var edit=button(tr('edit'),'btn btn--ghost',function(){editingUrl=item.url;name.value=item.name;url.value=item.url;name.focus();});
        var remove=button(tr('remove'),'btn btn--ghost',function(){
          try{if(P)P.disconnect(item.url);R.remove(item.url);status.textContent='';showRows();render();}catch(error){status.textContent=error.message;}
        });
        row.append(label,edit,remove);list.appendChild(row);
      });}catch(error){status.textContent=error.message;}
    }
    form.addEventListener('submit',function(event){
      event.preventDefault();
      try{
        if(editingUrl)R.update(editingUrl,name.value,url.value);
        else R.add(name.value,url.value);
        editingUrl=null;name.value='';url.value='';status.textContent='';showRows();render();
      }catch(error){status.textContent=error.message;}
    });
    m.body.append(list,form);showRows();
    if(initial&&typeof initial.url==='string'){
      var existing=R.list(true).some(function(x){return x.url===initial.url;});
      editingUrl=existing?initial.url:null;
      name.value=initial.name;url.value=initial.url;
    }
    syncAddressHint();m.show(name);
  }
  function offerIncoming(){
    if(importOffered||!W.InstanceHandoff)return;
    var proposal=W.InstanceHandoff.peek();if(!proposal)return;
    importOffered=true;var finished=false,bridge=W.InstanceHandoff;
    var json=JSON.stringify({schemaVersion:1,items:proposal.items}),preview;
    try{preview=R.previewIncoming(json);}catch(error){notice(error.message);bridge.consume();return;}
    // A fully synchronized destination does not need another consent dialog.
    if(!preview.pending.length){if(H&&H.importReports)H.importReports(proposal.reports||[]);bridge.consume();return;}
    var selected=new Set(preview.pending.map(function(item){return item.url;}));
    var m=modal(tr('importTitle'));
    m.body.appendChild(el('p','text-description',tr('importHint',{count:proposal.items.length,source:proposal.source})));
    var list=el('div','instance-import__list'),feedback=el('p','instance-manager__feedback');
    feedback.setAttribute('role','alert');m.body.append(list,feedback);
    var accept=button('','btn btn--primary',function(){
      try{
        var chosen=preview.pending.filter(function(item){return selected.has(item.url);}).map(function(item){return{name:item.name,url:item.url};});
        if(!chosen.length)return;
        // Revalidate the selected subset at the point of the atomic write.
        R.importMissing(JSON.stringify({schemaVersion:1,items:chosen}));
        if(H&&H.importReports)H.importReports(proposal.reports||[]);
        finished=true;bridge.consume();render();D.close(m.dialog,'confirm');
      }catch(error){feedback.textContent=error.message;}
    });
    function paintPreview(){
      list.textContent='';
      preview.items.forEach(function(item){
        if(!item.existing&&!selected.has(item.url))return;
        var row=el('div','instance-import__row'),details=el('div','instance-import__details');
        details.append(el('strong','',item.name),el('span','instance-import__url',item.url));
        row.appendChild(details);
        if(item.existing){row.classList.add('is-existing');row.appendChild(el('span','instance-import__existing','✓'));}
        else{
          var remove=button('×','icon-btn',function(){selected.delete(item.url);paintPreview();});
          remove.setAttribute('aria-label',tr('remove')+' · '+item.name);
          row.appendChild(remove);
        }
        list.appendChild(row);
      });
      accept.disabled=selected.size===0;
      accept.textContent=tr('import')+' ('+selected.size+')';
    }
    m.footer.append(button(tr('cancel'),'btn btn--ghost',function(){finished=true;bridge.consume();D.close(m.dialog,'cancel');}),accept);
    m.dialog.addEventListener('close',function(){if(!finished)bridge.consume();});
    paintPreview();m.show(accept);
  }
  function offerPeerInvitation(){
    if(!P||!P.pendingInvitation)return;
    var invite=P.pendingInvitation();
    if(!invite)return;
    var decided=false;
    var consent=ask(tr('allowTitle'),tr('allowHint',{source:invite.source}),tr('allow'),function(){
      if(!P.approveIncoming())throw new Error('Peer window was closed or invitation expired.');
      decided=true;
    },function(){decided=true;P.rejectIncoming();});
    consent.dialog.addEventListener('close',function(){if(!decided)P.rejectIncoming();});
  }
  function init(){
    host=document.getElementById('sidebar-instances');if(!host)return;
    render();if(H&&H.start)H.start();
    var session=W.SessionController;
    if(session&&session.ready)session.ready().then(function(ok){
      if(!ok)return;
      // Session-ready is earlier than preferences.locale / the WeiG locale shard.
      // Wait for the canonical app startup barrier; the initial Dialog is not reactive.
      function offerPending(){offerIncoming();offerPeerInvitation();}
      if(W.AppState&&W.AppState.initialized)offerPending();
      else global.addEventListener('weig:app-ready',offerPending,{once:true});
    }).catch(function(){});
  }
  W.InstancesUI=Object.freeze({render:render,openManager:openManager});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  global.addEventListener('weig:languagechange',render);
  global.addEventListener('weig:instance-health',updateHealth);
  global.addEventListener('weig:instance-peer',render);
  // App's full catalog may finish after the first health probe; reuse its
  // verified count without creating another network probe or replacing rows.
  global.addEventListener('weig:library-state',updateHealth);
})(window);

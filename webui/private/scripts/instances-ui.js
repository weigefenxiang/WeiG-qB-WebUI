(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},R=W.InstanceRegistry,H=W.InstanceHealth,D=W.DialogRuntime,STORE=W.StorageRuntime&&W.StorageRuntime.local;
  if(W.InstancesUI||!R||!D)return;
  var KEY=W.StorageKeys&&W.StorageKeys.instancesCollapsed||'weig.instances.collapsed';
  var host=null,expanded=!(STORE&&STORE.get(KEY,'0')==='1'),importOffered=false;
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
    return [own||{name:tr('current'),url:current}].concat(saved.filter(function(x){return x.url!==current;}));
  }
  function transferAndSwitch(item){
    if(item.url===R.currentUrl())return;
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
  function render(){
    if(!host)return;
    host.dataset.expanded=expanded?'1':'0';host.textContent='';
    var top=el('div','sidebar-instances__head');
    var heading=button('','sidebar-instances__heading',function(){
      expanded=!expanded;if(STORE)STORE.set(KEY,expanded?'0':'1');render();
    });
    heading.setAttribute('aria-expanded',expanded?'true':'false');
    heading.append(el('span','sidebar-instances__chevron','⌄'),el('span','',tr('title')));
    var value=H?H.minutes():30;
    var interval=button(value===0?tr('off'):tr('every',{minutes:value}),'btn btn--ghost sidebar-instances__interval',openInterval);
    interval.setAttribute('aria-label',tr('changeInterval'));
    top.append(heading,interval);host.append(top);
    var content=el('div','sidebar-instances__body');
    var items=[];try{items=records();}catch(error){notice(error.message);}
    items.forEach(function(item){
      var health=H&&H.get(item.url),state=health&&health.status||'unknown',count=health&&health.count;
      var row=button('','sidebar-instances__row',function(){transferAndSwitch(item);});
      if(item.url===R.currentUrl())row.classList.add('is-active');
      row.setAttribute('aria-current',item.url===R.currentUrl()?'true':'false');
      var label=el('span','sidebar-instances__name');
      var dot=el('span','sidebar-instances__dot');dot.dataset.state=state;dot.setAttribute('aria-hidden','true');
      label.append(dot,el('span','',item.name));
      var total=el('span','sidebar-instances__count',count==null?'—':String(count));
      var status=state==='online'?tr('online'):state==='denied'?tr('denied'):tr('unverified');
      row.title=item.name+' · '+item.url+' · '+status+(count==null?'':' · '+tr('torrentCount',{count:count}));
      row.setAttribute('aria-label',row.title);row.append(label,total);content.appendChild(row);
    });
    var actions=el('div','sidebar-instances__actions');
    actions.append(button('＋ '+tr('add'),'btn btn--ghost',openManager));
    actions.append(button('↻ '+tr('refresh'),'btn btn--ghost',function(){
      if(!H)return;
      H.checkNow().catch(function(error){notice(error.message);});
    }));
    content.appendChild(actions);
    var error=el('p','instance-manager__feedback');error.id='sidebar-instance-error';error.setAttribute('role','status');
    content.appendChild(error);
    host.appendChild(content);
  }
  function openManager(){
    var m=modal(tr('manage')),list=el('div','instance-manager__list'),form=el('form','instance-manager__fields');
    form.noValidate=true;var name=el('input','field-input'),url=el('input','field-input');
    name.type='text';name.maxLength=48;name.required=true;
    url.type='url';url.required=true;url.placeholder='http://192.168.1.72:8080/';
    var nameLabel=el('label','',tr('name')),urlLabel=el('label','',tr('url'));nameLabel.append(name);urlLabel.append(url);
    var status=el('p','instance-manager__feedback');status.setAttribute('role','status');
    var save=button(tr('save'),'btn btn--primary');save.type='submit';
    form.append(nameLabel,urlLabel,status,save);
    var editingUrl=null;
    function showRows(){
      list.textContent='';
      try{R.list(true).forEach(function(item){
        var row=el('div','instance-manager__row'),label=el('span','',item.name+' · '+item.url);
        var edit=button(tr('edit'),'btn btn--ghost',function(){editingUrl=item.url;name.value=item.name;url.value=item.url;name.focus();});
        var remove=button(tr('remove'),'btn btn--ghost',function(){
          try{R.remove(item.url);status.textContent='';showRows();render();}catch(error){status.textContent=error.message;}
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
    m.body.append(list,form);showRows();m.show(name);
  }
  function openInterval(){
    if(!H)return;
    var m=modal(tr('intervalTitle')),form=el('form','instance-manager__fields');
    var label=el('label','',tr('minutes')),input=el('input','field-input');
    input.type='number';input.min='5';input.max='1440';input.step='1';input.value=String(H.minutes()||30);label.append(input);
    var disableLabel=el('label',''),disabled=el('input');disabled.type='checkbox';disabled.checked=H.minutes()===0;
    disableLabel.append(disabled,document.createTextNode(' '+tr('disable')));
    disabled.addEventListener('change',function(){input.disabled=disabled.checked;});
    input.disabled=disabled.checked;
    var message=el('p','instance-manager__feedback');message.setAttribute('role','alert');
    form.append(label,disableLabel,message);
    m.body.append(form);
    m.footer.append(button(tr('cancel'),'btn btn--ghost',function(){D.close(m.dialog,'cancel');}));
    var save=button(tr('save'),'btn btn--primary',function(){
      try{H.setMinutes(disabled.checked?0:input.value);render();D.close(m.dialog,'save');}
      catch(error){message.textContent=error.message;}
    });
    m.footer.append(save);m.show(input);
  }
  function offerIncoming(){
    if(importOffered||!W.InstanceHandoff)return;
    var proposal=W.InstanceHandoff.peek();if(!proposal)return;
    importOffered=true;var finished=false,bridge=W.InstanceHandoff;
    var m=ask(tr('importTitle'),tr('importHint',{count:proposal.items.length,source:proposal.source}),tr('import'),function(){
      var json=JSON.stringify({schemaVersion:1,items:proposal.items});
      R.importList(json);finished=true;bridge.consume();render();
    },function(){finished=true;bridge.consume();});
    m.dialog.addEventListener('close',function(){if(!finished)bridge.consume();});
  }
  function init(){
    host=document.getElementById('sidebar-instances');if(!host)return;
    render();if(H&&H.start)H.start();
    var session=W.SessionController;
    if(session&&session.ready)session.ready().then(function(ok){if(ok)offerIncoming();}).catch(function(){});
  }
  W.InstancesUI=Object.freeze({render:render,openManager:openManager});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  global.addEventListener('weig:languagechange',render);
  global.addEventListener('weig:instance-health',render);
  global.addEventListener('weig:instance-interval',render);
})(window);

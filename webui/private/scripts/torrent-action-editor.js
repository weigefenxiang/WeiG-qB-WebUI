(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},C=W.Components,RV=W.RateValue;
  if(W.TorrentActionEditor||!C||!RV)return;
  var dialog=null,active=null,unitControl=null;

  function tr(key,vars){return W.I18n&&W.I18n.t?W.I18n.t(key,vars):String(key||'');}
  function same(a,b){return String(a==null?'':a)===String(b==null?'':b);}
  function createContext(rows,hashes){
    rows=Array.isArray(rows)?rows.filter(Boolean):[];
    hashes=Array.isArray(hashes)?hashes.map(String).filter(Boolean):[];
    var byHash=new Map();rows.forEach(function(row){if(row&&row.hash)byHash.set(String(row.hash),row);});
    var ordered=hashes.map(function(hash){return byHash.get(hash);}).filter(Boolean);
    return{hashes:hashes.slice(),rows:ordered,complete:ordered.length===hashes.length&&hashes.length>0};
  }
  function common(context,field){
    var rows=context&&Array.isArray(context.rows)?context.rows:[];
    if(!rows.length)return{available:false,mixed:false,value:undefined};
    var first=rows[0]&&rows[0][field],mixed=rows.some(function(row){return !same(row&&row[field],first);});
    return{available:true,mixed:mixed,value:mixed?undefined:first};
  }
  function memberships(context,field){
    var rows=context&&Array.isArray(context.rows)?context.rows:[],counts={},total=rows.length;
    rows.forEach(function(row){String(row&&row[field]||'').split(',').map(function(v){return v.trim();}).filter(Boolean).forEach(function(value){counts[value]=(counts[value]||0)+1;});});
    return Object.keys(counts).sort().map(function(value){return{value:value,count:counts[value],state:counts[value]===total?'all':'partial'};});
  }
  function ensureDialog(){
    if(dialog&&dialog.isConnected)return dialog;
    dialog=document.createElement('dialog');dialog.id='torrent-action-editor-dialog';dialog.className='dialog surface surface--modal torrent-action-editor';dialog.dataset.dialogMobile='compact';
    var head=document.createElement('div');head.className='dialog__head';var copy=document.createElement('div'),eyebrow=document.createElement('div'),title=document.createElement('h2'),close=document.createElement('button');
    eyebrow.className='eyebrow';eyebrow.textContent='ACTION';title.dataset.actionEditorTitle='1';copy.append(eyebrow,title);close.type='button';close.className='icon-btn';close.textContent='×';close.setAttribute('aria-label',tr('app.close'));close.onclick=function(){W.DialogRuntime.close(dialog);};head.append(copy,close);
    var body=document.createElement('div');body.className='dialog__body torrent-action-editor__body';var label=document.createElement('label');label.className='field torrent-action-editor__field';var input=document.createElement('input');input.type='text';input.className='field-input';input.dataset.actionEditorValue='1';label.appendChild(input);body.appendChild(label);
    var actions=document.createElement('div');actions.className='dialog__actions torrent-action-editor__actions';var left=document.createElement('span');left.className='torrent-action-editor__footer-left';left.dataset.actionEditorUnitSlot='1';var cancel=document.createElement('button'),confirm=document.createElement('button');cancel.type='button';cancel.className='btn btn--ghost';cancel.textContent=tr('app.cancel');cancel.onclick=function(){W.DialogRuntime.close(dialog);};confirm.type='button';confirm.className='btn btn--primary';confirm.textContent=tr('app.confirm');confirm.dataset.actionEditorConfirm='1';actions.append(left,cancel,confirm);
    dialog.append(head,body,actions);document.body.appendChild(dialog);
    dialog.addEventListener('close',function(){active=null;unitControl=null;});
    return dialog;
  }
  function currentPayload(){
    var d=ensureDialog(),input=d.querySelector('[data-action-editor-value]'),raw=String(input.value||'').trim(),editor=active&&active.definition&&active.definition.editor||{};
    if(!raw)return null;
    if(editor.type==='rate'){var unit=unitControl&&unitControl.getValue?unitControl.getValue():'KiB/s';return{bytes:RV.toBytes(raw,unit),unit:unit,raw:raw};}
    return raw;
  }
  function paintConfirm(){
    var d=ensureDialog(),confirm=d.querySelector('[data-action-editor-confirm]'),payload=currentPayload();if(confirm)confirm.disabled=!payload;
  }
  function buildUnitControl(bytes,mixed){
    var slot=ensureDialog().querySelector('[data-action-editor-unit-slot]');slot.textContent='';
    var unit=!mixed?RV.unitFor(bytes):'KiB/s',input=ensureDialog().querySelector('[data-action-editor-value]');
    unitControl=C.selectControl({id:'torrent-action-rate-unit',value:unit,options:RV.unitOptions(),ariaLabel:tr('transfer.rateUnit'),onChange:function(next){var raw=String(input.value||'').trim();if(raw){var before=unitControl&&unitControl.__previousUnit||unit,canonical=RV.toBytes(raw,before);input.value=RV.display(canonical,next,'∞');}unitControl.__previousUnit=next;paintConfirm();}});
    unitControl.__previousUnit=unit;unitControl.classList.add('torrent-action-editor__unit');slot.appendChild(unitControl);
  }
  function open(options){
    options=options||{};var definition=options.definition||{},editor=definition.editor||{},context=options.context||createContext([],[]),field=String(editor.field||''),state=field?common(context,field):{available:true,mixed:false,value:''};
    if(field&&!context.complete)return Promise.reject(new Error(tr('selection.actionsUnavailable')));
    var d=ensureDialog(),input=d.querySelector('[data-action-editor-value]'),title=d.querySelector('[data-action-editor-title]'),slot=d.querySelector('[data-action-editor-unit-slot]'),confirm=d.querySelector('[data-action-editor-confirm]');
    active={definition:definition,context:context,onSubmit:options.onSubmit};title.textContent=tr(definition.key||'dialog.action.title');input.setAttribute('aria-label',title.textContent);input.dataset.mixed=state.mixed?'true':'false';input.placeholder=state.mixed?'—':'';
    if(editor.type==='rate'){var bytes=state.mixed?0:RV.normalizeBytes(state.value);buildUnitControl(bytes,state.mixed);var unit=unitControl.getValue?unitControl.getValue():'KiB/s';input.inputMode='decimal';input.value=state.mixed?'':RV.display(bytes,unit,'∞');}
    else{slot.textContent='';unitControl=null;input.inputMode='text';input.value=state.mixed?'':String(state.value==null?'':state.value);}
    input.oninput=paintConfirm;confirm.onclick=async function(){var payload=currentPayload();if(payload==null)return;confirm.disabled=true;try{if(typeof active.onSubmit==='function')await active.onSubmit(payload);W.DialogRuntime.close(d);}catch(error){if(W.toast)W.toast((error&&error.message)||String(error),'error');}finally{if(d.open)paintConfirm();}};
    paintConfirm();W.DialogRuntime.open(d,{draggable:true,focus:input});setTimeout(function(){input.focus();input.select();},20);return Promise.resolve(d);
  }

  W.TorrentActionEditor={createContext:createContext,common:common,memberships:memberships,open:open};
})(window);

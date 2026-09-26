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
  function choiceState(context,field,value){
    var rows=context&&Array.isArray(context.rows)?context.rows:[],total=rows.length,count=rows.filter(function(row){return same(row&&row[field],value);}).length;
    return count===0?'none':count===total?'all':'partial';
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
    var body=document.createElement('div');body.className='dialog__body torrent-action-editor__body';
    var actions=document.createElement('div');actions.className='dialog__actions torrent-action-editor__actions';var left=document.createElement('span');left.className='torrent-action-editor__footer-left';left.dataset.actionEditorUnitSlot='1';var cancel=document.createElement('button'),confirm=document.createElement('button');cancel.type='button';cancel.className='btn btn--ghost';cancel.textContent=tr('app.cancel');cancel.onclick=function(){W.DialogRuntime.close(dialog);};confirm.type='button';confirm.className='btn btn--primary';confirm.textContent=tr('app.confirm');confirm.dataset.actionEditorConfirm='1';actions.append(left,cancel,confirm);
    dialog.append(head,body,actions);document.body.appendChild(dialog);
    dialog.addEventListener('close',function(){active=null;unitControl=null;});
    return dialog;
  }
  function resetFrame(titleKey){
    var d=ensureDialog(),title=d.querySelector('[data-action-editor-title]'),body=d.querySelector('.torrent-action-editor__body'),slot=d.querySelector('[data-action-editor-unit-slot]');
    title.textContent=tr(titleKey||'dialog.action.title');body.textContent='';slot.textContent='';unitControl=null;return{dialog:d,title:title,body:body,slot:slot,confirm:d.querySelector('[data-action-editor-confirm]')};
  }
  function textField(body,labelText,value,opts){
    opts=opts||{};var label=document.createElement('label');label.className='field torrent-action-editor__field';if(labelText){var caption=document.createElement('span');caption.textContent=labelText;label.appendChild(caption);}var input=document.createElement('input');input.type=opts.type||'text';input.className='field-input';input.inputMode=opts.inputMode||'text';input.value=value==null?'':String(value);if(opts.placeholder)input.placeholder=opts.placeholder;if(opts.dataKey)input.dataset.actionEditorField=opts.dataKey;if(opts.primary)input.dataset.actionEditorValue='1';input.setAttribute('aria-label',labelText||opts.ariaLabel||'Action value');label.appendChild(input);body.appendChild(label);return input;
  }
  function currentPayload(){
    var d=ensureDialog(),input=d.querySelector('[data-action-editor-value]'),raw=String(input&&input.value||'').trim(),editor=active&&active.definition&&active.definition.editor||{};
    if(!raw)return null;
    if(editor.type==='rate'){var unit=unitControl&&unitControl.getValue?unitControl.getValue():'KiB/s';return{bytes:RV.toBytes(raw,unit),unit:unit,raw:raw};}
    return raw;
  }
  function paintSimpleConfirm(){var d=ensureDialog(),confirm=d.querySelector('[data-action-editor-confirm]'),payload=currentPayload();if(confirm)confirm.disabled=!payload;}
  function buildUnitControl(slot,input,bytes,mixed){
    var unit=!mixed?RV.unitFor(bytes):'KiB/s';
    unitControl=C.selectControl({id:'torrent-action-rate-unit',value:unit,options:RV.unitOptions(),ariaLabel:tr('transfer.rateUnit'),onChange:function(next){var raw=String(input.value||'').trim();if(raw){var before=unitControl&&unitControl.__previousUnit||unit,canonical=RV.toBytes(raw,before);input.value=RV.display(canonical,next,'∞');}unitControl.__previousUnit=next;paintSimpleConfirm();}});
    unitControl.__previousUnit=unit;unitControl.classList.add('torrent-action-editor__unit');slot.appendChild(unitControl);
  }
  function bindSubmit(confirm,reader,onSubmit,d){
    confirm.onclick=async function(){var payload=reader();if(payload==null)return;confirm.disabled=true;try{if(typeof onSubmit==='function')await onSubmit(payload);W.DialogRuntime.close(d);}catch(error){if(W.toast)W.toast((error&&error.message)||String(error),'error');}finally{if(d.open)confirm.disabled=false;}};
  }
  function open(options){
    options=options||{};var definition=options.definition||{},editor=definition.editor||{},context=options.context||createContext([],[]),field=String(editor.field||''),state=field?common(context,field):{available:true,mixed:false,value:''};
    if(field&&!context.complete)return Promise.reject(new Error(tr('selection.actionsUnavailable')));
    var frame=resetFrame(definition.key),input=textField(frame.body,'',state.mixed?'':String(state.value==null?'':state.value),{primary:true,ariaLabel:frame.title.textContent,placeholder:state.mixed?'—':''});
    active={definition:definition,context:context,onSubmit:options.onSubmit};input.dataset.mixed=state.mixed?'true':'false';
    if(editor.type==='rate'){var bytes=state.mixed?0:RV.normalizeBytes(state.value);input.inputMode='decimal';buildUnitControl(frame.slot,input,bytes,state.mixed);var unit=unitControl.getValue?unitControl.getValue():'KiB/s';input.value=state.mixed?'':RV.display(bytes,unit,'∞');}
    input.oninput=paintSimpleConfirm;bindSubmit(frame.confirm,currentPayload,options.onSubmit,frame.dialog);paintSimpleConfirm();
    W.DialogRuntime.open(frame.dialog,{draggable:true,focus:input});setTimeout(function(){input.focus();input.select();},20);return Promise.resolve(frame.dialog);
  }
  function openCategoryCreate(options){
    options=options||{};var descriptor=options.descriptor||{},params=new Set(Array.isArray(descriptor.parameters)?descriptor.parameters:[]),frame=resetFrame('selection.newCategory'),fields={};
    fields.category=textField(frame.body,tr('selection.categoryName'),'',{dataKey:'category'});
    if(params.has('savePath'))fields.savePath=textField(frame.body,tr('selection.categorySavePath'),'',{dataKey:'savePath'});
    if(params.has('downloadPath'))fields.downloadPath=textField(frame.body,tr('selection.categoryDownloadPath'),'',{dataKey:'downloadPath'});
    if(params.has('downloadPathEnabled')){var check=C.checkControl(tr('selection.categoryDownloadPathEnabled'),false);check.classList.add('torrent-action-editor__check');frame.body.appendChild(check);fields.downloadPathEnabled=check.input;}
    function read(){var category=String(fields.category.value||'').trim();if(!category)return null;var out={category:category};if(fields.savePath)out.savePath=String(fields.savePath.value||'').trim();if(fields.downloadPath)out.downloadPath=String(fields.downloadPath.value||'').trim();if(fields.downloadPathEnabled)out.downloadPathEnabled=!!fields.downloadPathEnabled.checked;return out;}
    function paint(){frame.confirm.disabled=!read();}fields.category.addEventListener('input',paint);bindSubmit(frame.confirm,read,options.onSubmit,frame.dialog);paint();
    W.DialogRuntime.open(frame.dialog,{draggable:true,focus:fields.category});setTimeout(function(){fields.category.focus();},20);return Promise.resolve(frame.dialog);
  }

  W.TorrentActionEditor={createContext:createContext,common:common,choiceState:choiceState,memberships:memberships,open:open,openCategoryCreate:openCategoryCreate};
})(window);

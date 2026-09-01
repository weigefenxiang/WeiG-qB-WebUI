(function(global){
  'use strict';
  var W=global.WeiG,C=W&&W.Components,U=W&&W.util;
  if(!W||!C||!U||W.V037Polish)return;

  var initialized=false,transferClient=null,transferDialog=null,transferCap=null,transferMode='normal',transferUnit=localStorage.getItem('weigg.transferUnit')||'MiB/s',tooltipNode=null,observer=null,statusGuard=false;
  var UNITS={'KiB/s':1024,'MiB/s':1048576,'GiB/s':1073741824};
  var transferState={normal:{down:0,up:0},alt:{down:0,up:0}};

  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function label(en,cn){return zh()?cn:en;}
  function asset(path){return W.buildAssetUrl?W.buildAssetUrl(path):path;}

  function ensureCss(){
    var link=document.querySelector('link[data-weigg-layer="ui-polish-037"]');
    if(!link){link=document.createElement('link');link.rel='stylesheet';link.dataset.weiggLayer='ui-polish-037';link.href=asset('css/ui-polish-v037.css');document.head.appendChild(link);}
    var ui=document.querySelector('link[data-weigg-layer="ui-system-037"]');if(ui&&link.previousElementSibling!==ui)ui.insertAdjacentElement('afterend',link);
  }

  /* STATUS-DOCK-002 — success polling is silent; failures still own status copy. */
  function normalizeStatusMessage(){var node=document.getElementById('status-message');if(!node)return;var text=String(node.textContent||'').trim();if(/^(已刷新|refreshed|refresh complete)$/i.test(text))node.textContent='';}

  /* CONNECTION-002 — one semantic indicator owns status color and motion. */
  function connectionState(text){text=String(text||'').toLocaleLowerCase();if(/disconnect|offline|异常|断开|未连接|error/.test(text))return 'disconnected';if(/firewall|limited|受限|防火墙/.test(text))return 'limited';return 'connected';}
  function syncConnectionIndicator(){
    var node=document.getElementById('status-connection');if(!node||statusGuard)return;
    var raw=String(node.textContent||'').trim(),copy=raw.replace(/^●\s*/,'').trim()||'—';
    statusGuard=true;node.classList.add('connection-indicator');node.dataset.connectionState=connectionState(copy);if(copy!==raw)node.textContent=copy;statusGuard=false;
  }
  function pulseConnection(){var node=document.getElementById('status-connection');if(!node)return;node.classList.remove('is-refresh-pulse');void node.offsetWidth;node.classList.add('is-refresh-pulse');setTimeout(function(){node.classList.remove('is-refresh-pulse');},620);}

  /* TOOLTIP-002 — one floating tooltip for icon-only controls. */
  function tooltipText(target){
    if(!target)return'';var id=target.id;
    if(id==='refresh-btn')return label('Refresh data','刷新数据');
    if(id==='theme-btn')return label('Toggle theme','切换主题');
    if(/logout/i.test(id)||target.dataset.action==='logout')return label('Log out','注销');
    return target.dataset.tooltip||target.getAttribute('aria-label')||target.title||'';
  }
  function ensureTooltip(){if(tooltipNode)return tooltipNode;tooltipNode=document.createElement('div');tooltipNode.id='v037-tooltip';tooltipNode.className='tooltip polish-tooltip';tooltipNode.setAttribute('role','tooltip');document.body.appendChild(tooltipNode);return tooltipNode;}
  function positionTooltip(target){var tip=ensureTooltip(),r=target.getBoundingClientRect(),box=tip.getBoundingClientRect(),left=Math.min(innerWidth-box.width-8,Math.max(8,r.left+(r.width-box.width)/2)),top=r.bottom+8;if(top+box.height>innerHeight-8)top=Math.max(8,r.top-box.height-8);tip.style.left=Math.round(left)+'px';tip.style.top=Math.round(top)+'px';}
  function showTooltip(target){var text=tooltipText(target);if(!text)return;var tip=ensureTooltip();tip.textContent=text;tip.classList.add('is-visible');tip.dataset.for=target.id||'';requestAnimationFrame(function(){positionTooltip(target);});}
  function hideTooltip(){if(tooltipNode)tooltipNode.classList.remove('is-visible');}
  function installTooltips(){
    ['refresh-btn','theme-btn'].forEach(function(id){var node=document.getElementById(id);if(node){node.dataset.polishTooltip='1';if(node.title)node.removeAttribute('title');}});
    document.addEventListener('mouseover',function(e){var t=e.target&&e.target.closest&&e.target.closest('.icon-btn[data-polish-tooltip],#refresh-btn,#theme-btn,[data-action="logout"]');if(t)showTooltip(t);});
    document.addEventListener('mouseout',function(e){var t=e.target&&e.target.closest&&e.target.closest('.icon-btn[data-polish-tooltip],#refresh-btn,#theme-btn,[data-action="logout"]');if(t)hideTooltip();});
    document.addEventListener('focusin',function(e){var t=e.target&&e.target.closest&&e.target.closest('.icon-btn[data-polish-tooltip],#refresh-btn,#theme-btn,[data-action="logout"]');if(t)showTooltip(t);});
    document.addEventListener('focusout',function(e){var t=e.target&&e.target.closest&&e.target.closest('.icon-btn[data-polish-tooltip],#refresh-btn,#theme-btn,[data-action="logout"]');if(t)hideTooltip();});
  }

  /* RATE-INPUT-001 — shared value, unit and scrub behavior. */
  function bytesTo(value,unit){var n=Number(value)||0;if(n===0)return'0';return String(Math.round((n/(UNITS[unit]||1048576))*100)/100);}
  function toBytes(value,unit){var n=Number(value);return Number.isFinite(n)&&n>0?Math.round(n*(UNITS[unit]||1048576)):0;}
  function scrubStep(){return transferUnit==='GiB/s'?.01:transferUnit==='KiB/s'?16:.1;}
  function installScrubber(handle,input){
    if(handle.dataset.scrubberReady==='1')return;handle.dataset.scrubberReady='1';
    handle.addEventListener('pointerdown',function(e){e.preventDefault();var startX=e.clientX,start=Number(input.value)||0,step=scrubStep();handle.setPointerCapture(e.pointerId);handle.classList.add('is-scrubbing');function move(ev){var factor=ev.shiftKey?10:1,next=Math.max(0,start+Math.round((ev.clientX-startX)/7)*step*factor);input.value=String(Math.round(next*100)/100);}function done(ev){handle.classList.remove('is-scrubbing');try{handle.releasePointerCapture(ev.pointerId);}catch(_e){}handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',done);handle.removeEventListener('pointercancel',done);}handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',done);handle.addEventListener('pointercancel',done);});
  }
  function captureTransferInputs(){if(!transferDialog)return;var state=transferState[transferMode];state.down=toBytes(transferDialog.querySelector('[data-transfer-rate="down"]').value,transferUnit);state.up=toBytes(transferDialog.querySelector('[data-transfer-rate="up"]').value,transferUnit);}
  function syncUnit(next){captureTransferInputs();transferUnit=next;localStorage.setItem('weigg.transferUnit',transferUnit);Array.from(transferDialog.querySelectorAll('.transfer-unit-select')).forEach(function(sel){if(sel.setValue&&sel.getValue()!==transferUnit)sel.setValue(transferUnit);});paintTransferEditor();}
  function rateField(kind){
    var field=document.createElement('section');field.className='rate-field';field.dataset.rateKind=kind;
    var head=document.createElement('div');head.className='rate-field__head';var title=document.createElement('strong');title.dataset.rateLabel=kind;var hint=document.createElement('small');hint.textContent='0 = '+label('Unlimited','不限速');head.append(title,hint);
    var controls=document.createElement('div');controls.className='rate-field__controls';var input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.inputMode='decimal';input.className='field-input rate-field__input';input.dataset.transferRate=kind;
    var unit=C.selectControl({value:transferUnit,options:Object.keys(UNITS),className:'transfer-unit-select',ariaLabel:label('Rate unit','速率单位'),onChange:syncUnit});
    var scrub=document.createElement('button');scrub.type='button';scrub.className='rate-scrubber';scrub.textContent='↔';scrub.setAttribute('aria-label',label('Drag to change value','拖动调整数值'));scrub.title=label('Drag left or right to change value; hold Shift for larger steps','左右拖动调整数值；按住 Shift 使用大步进');
    controls.append(input,unit,scrub);field.append(head,controls);installScrubber(scrub,input);return field;
  }

  /* TRANSFER-002 — one capsule, one editor, normal and alternative rates share the same surface. */
  function ensureTransferDialog(){
    if(transferDialog&&transferDialog.isConnected)return transferDialog;
    var stale=document.getElementById('v037-transfer-dialog');if(stale)stale.remove();
    transferDialog=document.createElement('dialog');transferDialog.id='v037-transfer-dialog';transferDialog.className='dialog surface surface--modal transfer-dialog transfer-rate-editor';transferDialog.dataset.polishOwner='1';
    transferDialog.innerHTML='<div class="dialog__head"><div><div class="eyebrow">TRANSFER RATE</div><h2>'+label('Global speed limits','全局速度限制')+'</h2><p class="text-description transfer-editor-copy">'+label('Edit qBittorrent upload and download limits in one place.','在一个面板中设置 qBittorrent 上传和下载速度限制。')+'</p></div><button type="button" class="icon-btn v037-close" aria-label="'+label('Close','关闭')+'">×</button></div><div class="dialog__body"><div class="transfer-mode-switch"><button type="button" data-transfer-mode="normal">'+label('Normal rates','常规速度')+'</button><button type="button" data-transfer-mode="alt">'+label('Alternative rate limits','备用速度限制')+'</button></div><div class="rate-fields"></div></div><div class="dialog__actions"><button type="button" class="btn btn--ghost v037-cancel">'+label('Cancel','取消')+'</button><button type="button" class="btn btn--primary v037-apply">'+label('Apply','应用')+'</button></div>';
    var fields=transferDialog.querySelector('.rate-fields');fields.append(rateField('down'),rateField('up'));
    transferDialog.querySelector('.v037-close').onclick=transferDialog.querySelector('.v037-cancel').onclick=function(){transferDialog.close();};
    Array.from(transferDialog.querySelectorAll('[data-transfer-mode]')).forEach(function(button){button.onclick=function(){captureTransferInputs();transferMode=button.dataset.transferMode==='alt'?'alt':'normal';paintTransferEditor();};});
    transferDialog.querySelector('.v037-apply').onclick=applyTransferEditor;document.body.appendChild(transferDialog);return transferDialog;
  }
  function paintTransferEditor(){
    var d=ensureTransferDialog(),state=transferState[transferMode];d.dataset.mode=transferMode;
    Array.from(d.querySelectorAll('[data-transfer-mode]')).forEach(function(button){button.classList.toggle('is-active',button.dataset.transferMode===transferMode);});
    d.querySelector('[data-rate-label="down"]').textContent=transferMode==='alt'?label('Alternative download rate limit','备用下载速度限制'):label('Global download rate limit','全局下载速度限制');
    d.querySelector('[data-rate-label="up"]').textContent=transferMode==='alt'?label('Alternative upload rate limit','备用上传速度限制'):label('Global upload rate limit','全局上传速度限制');
    d.querySelector('[data-transfer-rate="down"]').value=bytesTo(state.down,transferUnit);d.querySelector('[data-transfer-rate="up"]').value=bytesTo(state.up,transferUnit);
    Array.from(d.querySelectorAll('.transfer-unit-select')).forEach(function(sel){if(sel.setValue)sel.setValue(transferUnit);});
  }
  async function loadTransferEditor(){
    var d=ensureTransferDialog();transferClient=transferClient||new W.QBClient();d.showModal();
    try{await transferClient.detect();var values=await Promise.all([transferClient.getGlobalDownloadLimit(),transferClient.getGlobalUploadLimit(),transferClient.getPreferences(),transferClient.getAltSpeedMode()]),prefs=values[2]||{};transferState.normal.down=Number(values[0])||0;transferState.normal.up=Number(values[1])||0;transferState.alt.down=Number(prefs.alt_dl_limit)||0;transferState.alt.up=Number(prefs.alt_up_limit)||0;transferMode=values[3]?'alt':'normal';paintTransferEditor();}catch(e){W.toast(e.message||String(e),'danger');}
  }
  function syncCapsuleMode(){var cap=document.getElementById('transfer-capsule');if(!cap)return;cap.dataset.modeLabel=label('ALT','备用');var badge=cap.querySelector('.transfer-capsule__mode');if(badge)badge.dataset.modeLabel=cap.dataset.modeLabel;}
  async function applyTransferEditor(){
    captureTransferInputs();var d=ensureTransferDialog(),state=transferState[transferMode];transferClient=transferClient||new W.QBClient();
    try{await transferClient.detect();if(transferMode==='alt')await transferClient.setPreferences({alt_dl_limit:state.down,alt_up_limit:state.up});else await Promise.all([transferClient.setGlobalDownloadLimit(state.down),transferClient.setGlobalUploadLimit(state.up)]);var active=await transferClient.getAltSpeedMode(),want=transferMode==='alt';if(active!==want)await transferClient.toggleAltSpeedMode();var cap=document.getElementById('transfer-capsule');if(cap)cap.dataset.mode=transferMode;syncCapsuleMode();d.close();W.toast(label('Global speed limits updated','全局速度限制已更新'));}catch(e){W.toast(e.message||String(e),'danger');}
  }
  function normalizeTransferCapsule(){
    var old=document.getElementById('transfer-capsule');if(!old||old.dataset.polishOwner==='1'){syncCapsuleMode();return;}
    var dlValue=document.getElementById('status-dl'),upValue=document.getElementById('status-up');if(!dlValue||!upValue)return;
    var cap=document.createElement('button');cap.type='button';cap.id='transfer-capsule';cap.className='transfer-capsule transfer-capsule--unified';cap.dataset.polishOwner='1';cap.dataset.mode=old.dataset.mode==='alt'?'alt':'normal';
    var dl=document.createElement('span');dl.className='status-speed status-speed--dl';dl.append(document.createTextNode('↓ '),dlValue);
    var up=document.createElement('span');up.className='status-speed status-speed--up';up.append(document.createTextNode('↑ '),upValue);
    var badge=document.createElement('span');badge.className='transfer-capsule__mode';badge.hidden=cap.dataset.mode!=='alt';cap.append(dl,up,badge);old.replaceWith(cap);transferCap=cap;cap.addEventListener('click',loadTransferEditor);
    var legacy=document.getElementById('global-speed-dialog');if(legacy)legacy.remove();var stale=document.getElementById('v037-transfer-dialog');if(stale&&stale.dataset.polishOwner!=='1')stale.remove();syncCapsuleMode();
  }

  /* SETTINGS-FORM-RAIL-001 / ABOUT-002 — centered rail and compact two-column facts. */
  function compactAbout(){
    var group=document.querySelector('#settings-content .about-surface');if(!group)return;
    var grid=group.querySelector(':scope > .about-facts-grid');if(!grid){grid=document.createElement('div');grid.className='about-facts-grid';var legal=group.querySelector(':scope > .about-legal');group.insertBefore(grid,legal||null);}
    Array.from(group.querySelectorAll(':scope > .about-row')).forEach(function(row){row.classList.add('about-fact');grid.appendChild(row);});
  }

  /* ACTION-SHEET-002 — semantic hover tones without feature-local button systems. */
  function actionTone(text){text=String(text||'').toLocaleLowerCase();if(/删除|delete/.test(text))return'danger';if(/限速|limit/.test(text))return'rate';if(/校验|汇报|recheck|reannounce/.test(text))return'verify';if(/队列|顺序|首尾|自动|queue|sequential|first|auto/.test(text))return'queue';if(/移动|分类|标签|tag|location|category/.test(text))return'organize';if(/开始|暂停|停止|强制|start|pause|stop|force/.test(text))return'run';return'neutral';}
  function decorateActionSheet(){
    Array.from(document.querySelectorAll('#v037-actions-dialog,#actions-dialog')).forEach(function(dialog){dialog.classList.add('action-sheet-polish');var grid=dialog.querySelector('.v037-action-grid,.action-grid');if(!grid)return;Array.from(grid.querySelectorAll('button.btn')).forEach(function(button){if(button.classList.contains('v037-close'))return;button.dataset.actionTone=actionTone(button.textContent);});});
  }

  function observe(){
    if(observer)return;observer=new MutationObserver(function(records){var needsTransfer=false,needsAbout=false,needsActions=false,needsStatus=false,needsConnection=false;records.forEach(function(record){var target=record.target;if(target&&target.id==='status-message')needsStatus=true;if(target&&target.id==='status-connection')needsConnection=true;Array.from(record.addedNodes||[]).forEach(function(node){if(!node||node.nodeType!==1)return;if((node.id==='transfer-capsule')||(node.querySelector&&node.querySelector('#transfer-capsule')))needsTransfer=true;if((node.matches&&node.matches('.about-surface,.about-row'))||(node.querySelector&&node.querySelector('.about-surface,.about-row')))needsAbout=true;if((node.id==='v037-actions-dialog')||(node.querySelector&&node.querySelector('#v037-actions-dialog,#actions-dialog')))needsActions=true;});});if(needsTransfer)requestAnimationFrame(normalizeTransferCapsule);if(needsAbout)requestAnimationFrame(compactAbout);if(needsActions)requestAnimationFrame(decorateActionSheet);if(needsStatus)normalizeStatusMessage();if(needsConnection)syncConnectionIndicator();});observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    var refresh=document.getElementById('last-refresh');if(refresh)new MutationObserver(function(){pulseConnection();}).observe(refresh,{childList:true,subtree:true,characterData:true});
  }

  function init(){if(initialized)return;initialized=true;ensureCss();normalizeStatusMessage();syncConnectionIndicator();installTooltips();normalizeTransferCapsule();compactAbout();decorateActionSheet();observe();setTimeout(function(){normalizeTransferCapsule();compactAbout();decorateActionSheet();syncConnectionIndicator();},700);global.addEventListener('weigg:languagechange',function(){syncCapsuleMode();if(transferDialog){captureTransferInputs();transferDialog.remove();transferDialog=null;}installTooltips();});}

  W.V037Polish={init:init,normalizeTransferCapsule:normalizeTransferCapsule,compactAbout:compactAbout,decorateActionSheet:decorateActionSheet,openTransferEditor:loadTransferEditor,syncConnectionIndicator:syncConnectionIndicator};
})(window);

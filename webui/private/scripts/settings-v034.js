(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var t=function(key){return W.V034I18n&&W.V034I18n.t?W.V034I18n.t(key):key;};
  var state={client:null,prefs:null,metadata:null,draft:{},loading:null,originalSave:null};
  var KEYS=['alternative_webui_enabled','alternative_webui_path'];

  function hasOwn(obj,key){return Object.prototype.hasOwnProperty.call(obj||{},key);}
  function isWebUiTab(){var tab=document.querySelector('[data-settings-tab="webui"]');return !!(tab&&tab.classList.contains('is-active'));}
  function isAdvancedTab(){var tab=document.querySelector('[data-settings-tab="advanced"]');return !!(tab&&tab.classList.contains('is-active'));}
  function value(key){return hasOwn(state.draft,key)?state.draft[key]:(state.prefs?state.prefs[key]:undefined);}
  function changed(key){return !!state.prefs&&hasOwn(state.draft,key)&&String(state.draft[key])!==String(state.prefs[key]);}
  function hasDraft(){return KEYS.some(changed);}
  function cleanDraft(){KEYS.forEach(function(key){if(hasOwn(state.draft,key)&&String(state.draft[key])===String(state.prefs&&state.prefs[key]))delete state.draft[key];});}
  function setDraft(key,val){state.draft[key]=val;cleanDraft();syncBadge();}
  function syncBadge(){var badge=document.querySelector('#alternative-webui-v034 .alt-webui-v034__badge');if(badge)badge.textContent=hasDraft()?t('v034.alt.pending'):t('v034.alt.current');}

  function repairTagI18n(){
    var tagAll=document.querySelector('#tag-nav [data-tag=""]');
    if(!tagAll)return;
    if(tagAll.getAttribute('data-i18n')!=='tag.all')tagAll.setAttribute('data-i18n','tag.all');
    if(W.t)tagAll.textContent=W.t('tag.all');
  }

  async function loadMetadata(){
    try{
      var res=await fetch('weigg-install.json',{cache:'no-store',credentials:'same-origin'});
      if(!res.ok)return null;
      var data=await res.json();
      return data&&typeof data==='object'?data:null;
    }catch(_e){return null;}
  }
  async function ensureState(force){
    if(state.loading&&!force)return state.loading;
    state.loading=(async function(){
      if(!state.client)state.client=new W.QBClient();
      state.prefs=await state.client.getPreferences();
      state.metadata=await loadMetadata();
      if(force)state.draft={};
      return state;
    })();
    try{return await state.loading;}finally{state.loading=null;}
  }

  function copy(title,desc){
    var span=document.createElement('span');
    var strong=document.createElement('strong');strong.textContent=title;
    var small=document.createElement('small');small.className='text-description';small.textContent=desc;
    span.append(strong,small);return span;
  }
  function infoRow(label,valueText,source){
    var row=document.createElement('div');row.className='alt-webui-v034__info';
    var left=document.createElement('span');var strong=document.createElement('strong');strong.textContent=label;
    var small=document.createElement('small');small.className='text-description';small.textContent=source;
    left.append(strong,small);
    var code=document.createElement('code');code.textContent=valueText||t('v034.alt.unavailable');
    row.append(left,code);return row;
  }
  function renderUnsupported(root){
    var group=document.createElement('section');group.id='alternative-webui-v034';group.className='settings-group alt-webui-v034';
    var h=document.createElement('h3');h.textContent=t('v034.alt.title');
    var p=document.createElement('p');p.className='text-description';p.textContent=t('v034.alt.unsupported');
    group.append(h,p);root.appendChild(group);
  }
  function renderGroup(){
    var root=document.getElementById('settings-content');if(!root||!isWebUiTab())return;
    var old=document.getElementById('alternative-webui-v034');if(old)old.remove();
    if(!state.prefs||!hasOwn(state.prefs,'alternative_webui_enabled')||!hasOwn(state.prefs,'alternative_webui_path')){renderUnsupported(root);return;}

    var group=document.createElement('section');group.id='alternative-webui-v034';group.className='settings-group alt-webui-v034';
    var head=document.createElement('div');head.className='alt-webui-v034__head';
    var headCopy=document.createElement('div');var title=document.createElement('h3');title.textContent=t('v034.alt.title');var desc=document.createElement('p');desc.className='text-description';desc.textContent=t('v034.alt.description');headCopy.append(title,desc);
    var badge=document.createElement('span');badge.className='alt-webui-v034__badge';head.append(headCopy,badge);group.appendChild(head);

    var enabled=document.createElement('label');enabled.className='settings-control alt-webui-v034__control';
    var enabledInput=document.createElement('input');enabledInput.type='checkbox';enabledInput.checked=!!value('alternative_webui_enabled');enabledInput.className='alt-webui-v034__toggle';
    enabledInput.addEventListener('change',function(){setDraft('alternative_webui_enabled',enabledInput.checked);});
    enabled.append(copy(t('v034.alt.enabled'),t('v034.alt.enabledDesc')),enabledInput);group.appendChild(enabled);

    var pathRow=document.createElement('label');pathRow.className='settings-control alt-webui-v034__control';
    var pathInput=document.createElement('input');pathInput.type='text';pathInput.className='field-input alt-webui-v034__path';pathInput.value=String(value('alternative_webui_path')||'');pathInput.autocomplete='off';pathInput.spellcheck=false;
    pathInput.addEventListener('input',function(){setDraft('alternative_webui_path',pathInput.value.trim());});
    pathRow.append(copy(t('v034.alt.qbPath'),t('v034.alt.qbPathDesc')),pathInput);group.appendChild(pathRow);

    var meta=document.createElement('div');meta.className='alt-webui-v034__meta';
    meta.appendChild(infoRow(t('v034.alt.qbPath'),String(value('alternative_webui_path')||''),t('v034.alt.sourceApi')));
    var m=state.metadata||{};
    meta.appendChild(infoRow(t('v034.alt.hostPath'),m.hostPath||'',t('v034.alt.sourceInstaller')));
    meta.appendChild(infoRow(t('v034.alt.version'),m.version||'',t('v034.alt.sourceInstaller')));
    meta.appendChild(infoRow(t('v034.alt.container'),m.container||'',t('v034.alt.sourceInstaller')));
    if(m.installedAt)meta.appendChild(infoRow(t('v034.alt.installedAt'),m.installedAt,t('v034.alt.sourceInstaller')));
    group.appendChild(meta);
    root.appendChild(group);syncBadge();
  }
  function hideAdvancedDuplicates(){
    if(!isAdvancedTab())return;
    KEYS.forEach(function(key){var row=document.querySelector('#settings-content .settings-row[data-key="'+key+'"]');if(row)row.hidden=true;});
  }
  async function sync(){
    var root=document.getElementById('settings-content');if(!root)return;
    if(isAdvancedTab()){hideAdvancedDuplicates();return;}
    if(!isWebUiTab())return;
    try{if(!state.prefs)await ensureState(false);renderGroup();}catch(e){console.error(e);renderUnsupported(root);}
  }

  function isHostPathMistake(nextPath){
    var m=state.metadata||{};
    if(!m.hostPath||!m.qbPath)return false;
    var trim=function(x){return String(x||'').replace(/[\\/]+$/,'');};
    return trim(nextPath)===trim(m.hostPath)&&trim(m.hostPath)!==trim(m.qbPath);
  }
  async function saveAlternative(){
    cleanDraft();if(!hasDraft())return {saved:false,disabled:false};
    var disable=changed('alternative_webui_enabled')&&state.prefs.alternative_webui_enabled===true&&state.draft.alternative_webui_enabled===false;
    var pathChanged=changed('alternative_webui_path');
    var nextPath=String(value('alternative_webui_path')||'').trim();
    if(pathChanged&&isHostPathMistake(nextPath)){
      W.toast(t('v034.alt.hostPathError'),'danger');
      var input=document.querySelector('#alternative-webui-v034 .alt-webui-v034__path');if(input)input.focus();
      return {cancelled:true};
    }
    if(disable&&!global.confirm(t('v034.alt.disableConfirm')))return {cancelled:true};
    if(pathChanged&&!disable&&!global.confirm(t('v034.alt.pathConfirm')))return {cancelled:true};
    var payload={};KEYS.forEach(function(key){if(changed(key))payload[key]=state.draft[key];});
    try{
      await state.client.setPreferences(payload);
      W.toast(disable?t('v034.alt.redirecting'):t('v034.alt.saved'));
      state.prefs=await state.client.getPreferences().catch(function(){return Object.assign({},state.prefs,payload);});
      state.draft={};
      if(disable){setTimeout(function(){global.location.href='/';},700);return {saved:true,disabled:true};}
      renderGroup();return {saved:true,disabled:false};
    }catch(e){W.toast(t('v034.alt.saveFailed')+': '+e.message,'danger');return {cancelled:true,error:e};}
  }
  function installSaveBridge(){
    var button=document.getElementById('save-settings-btn');if(!button||button.dataset.v034SaveBridge)return;
    button.dataset.v034SaveBridge='1';state.originalSave=button.onclick;
    button.onclick=async function(event){
      if(hasDraft()){
        var result=await saveAlternative();
        if(result&&result.cancelled)return;
        if(result&&result.disabled)return;
      }
      if(typeof state.originalSave==='function')return state.originalSave.call(button,event);
    };
  }
  function installNavigationBridge(){
    var tabs=document.getElementById('settings-tabs');if(tabs&&!tabs.dataset.v034TabsBridge){
      tabs.dataset.v034TabsBridge='1';var original=tabs.onclick;
      tabs.onclick=function(event){var result;if(typeof original==='function')result=original.call(tabs,event);setTimeout(sync,0);return result;};
    }
    global.addEventListener('hashchange',function(){setTimeout(sync,0);});
    var root=document.getElementById('settings-content');if(root){
      new MutationObserver(function(){if(isWebUiTab()&&!document.getElementById('alternative-webui-v034'))setTimeout(sync,0);if(isAdvancedTab())hideAdvancedDuplicates();}).observe(root,{childList:true});
    }
  }
  function install(){repairTagI18n();installSaveBridge();installNavigationBridge();setTimeout(sync,0);}
  document.addEventListener('DOMContentLoaded',install);
  W.SettingsV034={sync:sync,saveAlternative:saveAlternative,state:state};
})(window);

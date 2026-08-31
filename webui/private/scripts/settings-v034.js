(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var t=function(key){return W.V034I18n&&W.V034I18n.t?W.V034I18n.t(key):key;};
  var state={client:null,prefs:null,metadata:null,draft:{},loading:null,originalSave:null};
  var KEYS=['alternative_webui_enabled','alternative_webui_path'];
  var MARK='v035Alt';

  function hasOwn(obj,key){return Object.prototype.hasOwnProperty.call(obj||{},key);}
  function activeTab(name){var tab=document.querySelector('#settings-tabs [data-settings-tab="'+name+'"]');return !!(tab&&tab.classList.contains('is-active'));}
  function isWebUiTab(){return activeTab('webui');}
  function isAdvancedTab(){return activeTab('advanced');}
  function value(key){return hasOwn(state.draft,key)?state.draft[key]:(state.prefs?state.prefs[key]:undefined);}
  function changed(key){return !!state.prefs&&hasOwn(state.draft,key)&&String(state.draft[key])!==String(state.prefs[key]);}
  function hasDraft(){return KEYS.some(changed);}
  function cleanDraft(){KEYS.forEach(function(key){if(hasOwn(state.draft,key)&&String(state.draft[key])===String(state.prefs&&state.prefs[key]))delete state.draft[key];});}
  function setDraft(key,val){state.draft[key]=val;cleanDraft();}

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

  function mark(card){card.dataset[MARK]='1';return card;}
  function clearInjected(group){group.querySelectorAll('[data-v035-alt="1"]').forEach(function(node){node.remove();});}
  function readonly(key,title,description,val){return mark(W.Components.readonlySettingField(key,title,description,val));}
  function renderUnsupported(group){group.appendChild(readonly('alternative_webui_support',t('v034.alt.title'),t('v034.alt.unsupported'),t('v034.alt.unavailable')));}
  function renderGroup(){
    var root=document.getElementById('settings-content');if(!root||!isWebUiTab())return;
    var group=root.querySelector('.settings-group');if(!group)return;
    clearInjected(group);
    if(!state.prefs||!hasOwn(state.prefs,'alternative_webui_enabled')||!hasOwn(state.prefs,'alternative_webui_path')){renderUnsupported(group);return;}

    var enabled=mark(W.Components.preferenceField('alternative_webui_enabled',!!value('alternative_webui_enabled'),function(key,val){setDraft(key,val);},t('v034.alt.enabled')));
    var path=mark(W.Components.preferenceField('alternative_webui_path',String(value('alternative_webui_path')||''),function(key,val){setDraft(key,String(val||'').trim());},t('v034.alt.qbPath')));
    group.append(enabled,path);

    var m=state.metadata||{};
    if(m.hostPath)group.appendChild(readonly('weigg_host_path',t('v034.alt.hostPath'),t('v034.alt.sourceInstaller'),m.hostPath));
    if(m.version)group.appendChild(readonly('weigg_version',t('v034.alt.version'),t('v034.alt.sourceInstaller'),m.version));
    if(m.gitSha)group.appendChild(readonly('weigg_git_sha','Git Commit',t('v034.alt.sourceInstaller'),m.gitSha));
    if(m.container)group.appendChild(readonly('weigg_container',t('v034.alt.container'),t('v034.alt.sourceInstaller'),m.container));
    if(m.installedAt)group.appendChild(readonly('weigg_installed_at',t('v034.alt.installedAt'),t('v034.alt.sourceInstaller'),m.installedAt));
  }
  function hideAdvancedDuplicates(){
    if(!isAdvancedTab())return;
    KEYS.forEach(function(key){
      var selector='#settings-content .settings-row[data-key="'+key+'"],#settings-content .settings-row[data-setting-key="'+key+'"]';
      document.querySelectorAll(selector).forEach(function(row){row.hidden=true;});
    });
  }
  async function sync(){
    var root=document.getElementById('settings-content');if(!root)return;
    if(isAdvancedTab()){hideAdvancedDuplicates();return;}
    if(!isWebUiTab())return;
    try{if(!state.prefs)await ensureState(false);renderGroup();}catch(e){console.error(e);var group=root.querySelector('.settings-group');if(group){clearInjected(group);renderUnsupported(group);}}
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
      var input=document.querySelector('#settings-content [data-setting-key="alternative_webui_path"] .field-input');if(input)input.focus();
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
    var tabs=document.getElementById('settings-tabs');
    if(tabs&&!tabs.dataset.v034TabsBridge){
      tabs.dataset.v034TabsBridge='1';
      tabs.addEventListener('click',function(event){if(!event.target.closest('[data-settings-tab]'))return;setTimeout(sync,0);setTimeout(sync,80);});
    }
    global.addEventListener('hashchange',function(){setTimeout(sync,0);});
    var root=document.getElementById('settings-content');if(root){
      new MutationObserver(function(){
        if(isWebUiTab()&&!root.querySelector('[data-v035-alt="1"]'))setTimeout(sync,0);
        if(isAdvancedTab())hideAdvancedDuplicates();
      }).observe(root,{childList:true,subtree:true});
    }
  }
  function install(){installSaveBridge();installNavigationBridge();setTimeout(sync,0);}
  document.addEventListener('DOMContentLoaded',install);
  W.SettingsV034={sync:sync,saveAlternative:saveAlternative,state:state};
})(window);

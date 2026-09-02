(function(global){
  'use strict';
  var W=global.WeiG,C=W&&W.Components,U=W&&W.util;
  if(!W||!C||!U||W.HeaderSettingsSystemV037)return;

  var GITHUB_URL='https://github.com/weigefenxiang/WeiG-qB-WebUI';
  var BLOG_URL='https://www.weigshare.com/';
  var sessionClient=null,observer=null,queued=false,patchedFactories=false;

  function locale(){return W.I18n&&W.I18n.getLocale?W.I18n.getLocale():'en';}
  function label(en,zh){return locale()==='zh-CN'?zh:en;}

  function svgIcon(kind){
    var span=document.createElement('span');span.className='header-utility-icon';span.setAttribute('aria-hidden','true');
    if(kind==='github')span.innerHTML='<svg viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M12 .7A11.5 11.5 0 0 0 8.36 23.1c.58.11.79-.25.79-.56v-2.03c-3.22.71-3.9-1.37-3.9-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.73.08-.71.08-.71 1.16.08 1.78 1.2 1.78 1.2 1.03 1.78 2.71 1.27 3.37.97.11-.76.41-1.27.74-1.56-2.57-.3-5.28-1.3-5.28-5.76 0-1.27.45-2.31 1.2-3.13-.12-.3-.52-1.48.11-3.08 0 0 .98-.31 3.19 1.2A10.9 10.9 0 0 1 12 6.1c.99 0 1.98.13 2.91.39 2.21-1.51 3.19-1.2 3.19-1.2.63 1.6.23 2.78.11 3.08.75.82 1.2 1.86 1.2 3.13 0 4.47-2.72 5.45-5.31 5.74.42.36.79 1.07.79 2.15v3.15c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>';
    else if(kind==='blog')span.innerHTML='<svg viewBox="0 0 24 24" focusable="false"><path d="M6 3.5h9l3 3V20.5H6zM15 3.5v4h4M9 11h6M9 15h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    else span.innerHTML='<svg viewBox="0 0 24 24" focusable="false"><path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    return span;
  }

  function SessionController(){ }
  SessionController.logout=function(){
    sessionClient=sessionClient||new W.QBClient();
    return sessionClient.request('auth/logout',{method:'POST',type:'void'}).catch(function(error){
      if(error&&error.status===403)return null;
      throw error;
    });
  };

  function logout(button){
    if(button)button.disabled=true;
    SessionController.logout().then(function(){global.location.replace('login.html');}).catch(function(error){
      if(button)button.disabled=false;
      if(W.toast)W.toast(label('Logout failed: ','登出失败：')+(error&&error.message||String(error)),'danger');
    });
  }

  function utilityAction(spec,mode){
    var node;
    if(spec.href){node=document.createElement('a');node.href=spec.href;node.target='_blank';node.rel='noopener noreferrer';}
    else{node=document.createElement('button');node.type='button';node.addEventListener('click',spec.onClick);}
    node.id=mode==='header'?spec.id:spec.id+'-mobile';
    node.dataset.headerUtility=spec.key;
    node.className=mode==='header'?'icon-btn header-utility-action desktop-only':'nav-item header-utility-link';
    node.setAttribute('aria-label',spec.label());node.title=spec.label();
    if(mode==='header')node.appendChild(svgIcon(spec.icon));
    else{var icon=svgIcon(spec.icon),text=document.createElement('span');text.textContent=spec.label();node.append(icon,text);}
    return node;
  }

  function actionSpecs(){return [
    {key:'github',id:'github-btn',icon:'github',href:GITHUB_URL,label:function(){return 'GitHub';}},
    {key:'blog',id:'blog-btn',icon:'blog',href:BLOG_URL,label:function(){return label('WeiG Share Blog','WeiG Share 博客');}},
    {key:'logout',id:'logout-btn',icon:'logout',label:function(){return label('Log out','登出');},onClick:function(e){logout(e.currentTarget);}}
  ];}

  function normalizeHeaderUtilities(){
    var actions=document.querySelector('.topbar__actions'),refresh=document.getElementById('refresh-btn'),theme=document.getElementById('theme-btn');
    if(!actions||!refresh||!theme)return;
    var specs=actionSpecs(),github=document.getElementById('github-btn'),blog=document.getElementById('blog-btn'),logoutNode=document.getElementById('logout-btn');
    if(!github){github=utilityAction(specs[0],'header');actions.insertBefore(github,refresh);}
    if(!blog){blog=utilityAction(specs[1],'header');actions.insertBefore(blog,refresh);}
    if(!logoutNode){logoutNode=utilityAction(specs[2],'header');actions.appendChild(logoutNode);}
    [github,blog,refresh,theme,logoutNode].forEach(function(node){if(node)node.classList.add('header-utility-action');});
    if(actions.lastElementChild!==logoutNode)actions.appendChild(logoutNode);
  }

  function normalizeMobileUtilityLinks(){
    var sidebar=document.getElementById('sidebar');if(!sidebar)return;
    var section=sidebar.querySelector('[data-v037-utility-links]');
    if(!section){
      section=document.createElement('div');section.className='sidebar__section v037-mobile-utility-links mobile-only';section.dataset.v037UtilityLinks='1';
      var title=document.createElement('div');title.className='eyebrow';title.textContent=label('LINKS','链接');
      var nav=document.createElement('nav');nav.className='nav-list';
      actionSpecs().forEach(function(spec){nav.appendChild(utilityAction(spec,'mobile'));});
      section.append(title,nav);sidebar.appendChild(section);
    }
  }

  function rowKey(row){
    if(!row)return'';
    return row.dataset.settingKey||row.dataset.key||(row.dataset.v021Language?'weigg_language':'')||(row.dataset.v036Timezone?'weigg_timezone':'');
  }

  function ensureCopy(row){
    var copy=row.querySelector(':scope > .settings-row__copy');if(copy)return copy;
    var first=row.firstElementChild;
    if(first&&first.tagName==='SPAN'&&!first.classList.contains('settings-row__control')&&(first.querySelector('strong')||first.querySelector('small'))){first.classList.add('settings-row__copy');return first;}
    var title=Array.from(row.children).find(function(child){return child.tagName==='STRONG';});
    var desc=Array.from(row.children).find(function(child){return child.tagName==='SMALL';});
    if(!title&&!desc)return null;
    copy=document.createElement('span');copy.className='settings-row__copy';row.insertBefore(copy,row.firstChild);
    if(title)copy.appendChild(title);if(desc)copy.appendChild(desc);return copy;
  }

  function ensureControlSlot(row,copy){
    var slot=row.querySelector(':scope > .settings-row__control');
    if(!slot){slot=document.createElement('span');slot.className='settings-row__control';row.appendChild(slot);}
    Array.from(row.children).forEach(function(child){
      if(child===copy||child===slot)return;
      slot.appendChild(child);
    });
    return slot;
  }

  function explicitSpan(row){
    if(!row)return'1';
    if(row.matches('.setting-block,[data-setting-block="1"],[data-setting-layout="block"],[data-setting-layout="full"]'))return'full';
    if(row.querySelector('textarea'))return'full';
    var key=rowKey(row),info=W.SettingsSchema&&W.SettingsSchema.describe&&key?W.SettingsSchema.describe(key):null;
    if(info&&(info.span==='full'||info.layout==='block'||info.layout==='full'))return'full';
    return'1';
  }

  function canonicalizeRow(row){
    if(!row||row.closest('.about-surface'))return row;
    row.classList.add('settings-row--canonical','setting-row-grid');
    var copy=ensureCopy(row);if(copy)copy.classList.add('settings-row__copy');
    var slot=ensureControlSlot(row,copy);slot.classList.add('settings-row__control');
    row.dataset.settingSpan=explicitSpan(row);
    return row;
  }

  function patchFactories(){
    if(patchedFactories)return;patchedFactories=true;
    ['preferenceField','readonlySettingField'].forEach(function(name){
      var base=C[name];if(typeof base!=='function'||base.__canonicalSettingFactory)return;
      var wrapped=function(){return canonicalizeRow(base.apply(this,arguments));};
      wrapped.__canonicalSettingFactory=true;wrapped.__base=base;C[name]=wrapped;
    });
  }

  function activeOwner(){var active=document.querySelector('#settings-tabs [data-settings-tab].is-active');return active&&active.dataset.settingsTab||'unknown';}
  function normalizeSection(group,owner){
    if(!group)return;
    group.classList.add('settings-section-panel');group.dataset.settingsOwner=owner||group.dataset.settingsOwner||activeOwner();
    if(group.classList.contains('about-surface'))return;
    var grid=group.querySelector(':scope > .settings-grid-canonical');
    var rows=Array.from(group.querySelectorAll('.settings-row,.settings-control,.setting-row-grid')).filter(function(row){return row.closest('.settings-group')===group;});
    if(!rows.length&&!grid)return;
    if(!grid){grid=document.createElement('div');grid.className='settings-grid-canonical';grid.dataset.settingsGrid='auto';var heading=group.querySelector(':scope > .section-heading');if(heading)heading.insertAdjacentElement('afterend',grid);else group.prepend(grid);}
    grid.dataset.settingsOwner=group.dataset.settingsOwner;
    Array.from(group.querySelectorAll(':scope > .settings-grid-canonical')).forEach(function(extra){if(extra===grid)return;Array.from(extra.children).forEach(function(child){grid.appendChild(child);});extra.remove();});
    rows.forEach(function(row){canonicalizeRow(row);if(row.parentElement!==grid)grid.appendChild(row);});
  }

  function normalizeSettings(){
    var root=document.getElementById('settings-content');if(!root)return;
    root.classList.add('settings-content--canonical');
    var owner=activeOwner();
    Array.from(root.querySelectorAll(':scope > .settings-group')).forEach(function(group,index){normalizeSection(group,owner==='weigg'&&index>0?'weigg-metrics':owner);});
  }

  function queue(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;normalizeHeaderUtilities();normalizeMobileUtilityLinks();normalizeSettings();});}
  function observe(){var root=document.getElementById('settings-content');if(!root||observer)return;observer=new MutationObserver(queue);observer.observe(root,{childList:true,subtree:true});}

  function init(){
    patchFactories();normalizeHeaderUtilities();normalizeMobileUtilityLinks();normalizeSettings();observe();
    global.addEventListener('hashchange',queue);global.addEventListener('weigg:languagechange',queue);global.addEventListener('weigg:timezonechange',queue);
    global.setTimeout(queue,500);
  }

  W.SessionController=SessionController;
  W.HeaderUtilityV037={normalize:normalizeHeaderUtilities,actions:actionSpecs,github:GITHUB_URL,blog:BLOG_URL};
  W.SettingsRowV037={normalize:normalizeSettings,normalizeSection:normalizeSection,canonicalize:canonicalizeRow,span:explicitSpan};
  W.HeaderSettingsSystemV037={init:init,header:W.HeaderUtilityV037,settings:W.SettingsRowV037,session:SessionController};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);

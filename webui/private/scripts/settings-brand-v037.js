(function(global){
  'use strict';
  var W=global.WeiG,C=W&&W.Components,U=W&&W.util;
  if(!W||!C||!U||W.V037SettingsBrand)return;

  var initialized=false,settingsObserver=null,normalizeQueued=false;
  var BRAND_MARK_SELECTOR='.brand__mark';

  function reducedMotion(){return !!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);}
  function homeLabel(){return W.t?W.t('app.home'):'Home';}
  function goHome(){if(W.Router&&typeof W.Router.home==='function')W.Router.home();else location.hash='#/';}
  W.Navigation=W.Navigation||{};
  W.Navigation.goHome=goHome;

  function triggerMark(mark,effect){
    if(!mark||reducedMotion())return false;
    return !!(W.AmbientMark&&W.AmbientMark.trigger&&W.AmbientMark.trigger(mark,effect));
  }
  function userGesture(mark){
    if(!mark||reducedMotion())return;
    var cls=Math.random()>.5?'is-user-spin':'is-user-flip';
    mark.classList.remove('is-user-spin','is-user-flip');
    void mark.offsetWidth;
    mark.classList.add(cls);
    triggerMark(mark,'orbit-spark');
    global.setTimeout(function(){mark.classList.remove(cls);},900);
  }
  function installBrandMark(mark,profile){
    if(!mark)return null;
    mark.classList.add('brand-mark');
    mark.dataset.motionProfile=profile||'compact';
    if(W.AmbientMark&&W.AmbientMark.install)W.AmbientMark.install(mark);
    if(mark.dataset.brandMotionReady==='1')return mark;
    mark.dataset.brandMotionReady='1';
    mark.addEventListener('mouseenter',function(){
      triggerMark(mark,mark.dataset.motionProfile==='identity'?'orbit-spark':(Math.random()>.5?'orbit':'shine'));
    });
    return mark;
  }
  function wireHomeTarget(button,mark,delay){
    if(!button||button.dataset.brandHomeReady==='1')return button;
    button.dataset.brandHomeReady='1';
    button.addEventListener('click',function(){
      if(mark)userGesture(mark);
      if(reducedMotion()||!delay)goHome();
      else global.setTimeout(goHome,delay);
    });
    return button;
  }
  function homeButton(className,ariaLabel){
    var b=document.createElement('button');
    b.type='button';
    b.className=className;
    b.setAttribute('aria-label',ariaLabel||homeLabel());
    b.title=ariaLabel||homeLabel();
    return b;
  }

  /* BRAND-SYSTEM-001 — mark, motion, text and navigation are separate canonical owners. */
  function normalizeHeaderBrand(){
    var current=document.getElementById('brand-btn');
    if(!current)return null;
    if(current.classList.contains('brand-cluster'))return current;
    var mark=current.querySelector(BRAND_MARK_SELECTOR),text=current.querySelector('.brand__text');
    if(!mark)return current;
    installBrandMark(mark,'compact');

    var cluster=document.createElement('div');
    cluster.id='brand-btn';
    cluster.className='brand-cluster';
    cluster.setAttribute('aria-label','WeiG qB');

    var markHome=homeButton('brand-mark-home',homeLabel());
    markHome.appendChild(mark);
    wireHomeTarget(markHome,mark,0);

    var nameHome=homeButton('brand-name-home',homeLabel());
    var labelNode=text||document.createElement('span');
    labelNode.classList.add('brand__text');
    labelNode.textContent=labelNode.textContent||'WeiG qB';
    nameHome.appendChild(labelNode);
    wireHomeTarget(nameHome,null,0);

    cluster.append(markHome,nameHome);
    current.replaceWith(cluster);
    return cluster;
  }

  function cloneBrandMark(profile){
    var source=document.querySelector('#brand-btn '+BRAND_MARK_SELECTOR)||document.querySelector(BRAND_MARK_SELECTOR);
    if(!source)return null;
    var mark=source.cloneNode(true);
    mark.removeAttribute('id');
    mark.classList.remove('is-user-spin','is-user-flip','is-ambient-orbit','is-ambient-spark','is-ambient-tilt','is-ambient-shine','is-ambient-breathe');
    delete mark.dataset.v037Interactive;
    delete mark.dataset.brandMotionReady;
    return installBrandMark(mark,profile||'identity');
  }

  /* BRAND-IDENTITY-001 — About composes the same BrandMark and AmbientMark controller. */
  function normalizeAboutIdentity(){
    var identity=document.querySelector('#settings-content .about-surface .about-identity');
    if(!identity)return;
    identity.classList.add('brand-identity','settings-brand-identity');
    if(!identity.querySelector('.brand-identity__mark-home')){
      var old=identity.querySelector('.about-brand-orb'),mark=cloneBrandMark('identity');
      if(mark){
        var markHome=homeButton('brand-identity__mark-home',homeLabel());
        markHome.appendChild(mark);
        wireHomeTarget(markHome,mark,180);
        if(old)old.replaceWith(markHome);else identity.prepend(markHome);
      }
    }
    var heading=identity.querySelector('h2');
    if(heading&&!heading.querySelector('.brand-identity__name-home')){
      var name=homeButton('brand-identity__name-home',homeLabel());
      name.textContent=heading.textContent||'WeiG qB WebUI';
      wireHomeTarget(name,null,0);
      heading.textContent='';
      heading.appendChild(name);
    }
  }

  function rowTitle(row){
    if(!row)return null;
    var title=row.querySelector('.settings-row__copy strong');
    if(title)return title;
    var first=row.firstElementChild;
    if(first&&first.tagName==='SPAN'){
      title=first.querySelector('strong');
      if(title)return title;
    }
    return Array.from(row.children).find(function(child){return child.tagName==='STRONG';})||null;
  }
  function rowKey(row){
    if(!row)return'';
    if(row.dataset.settingKey)return row.dataset.settingKey;
    if(row.dataset.key)return row.dataset.key;
    if(row.dataset.v021Language)return'weigg_language';
    var title=rowTitle(row);
    return String(title&&title.textContent||'').trim().toLocaleLowerCase();
  }
  function classifySpan(row){
    var key=rowKey(row);
    var wide=!!row.querySelector('textarea,.field-input[data-control-size="wide"]');
    if(!wide){
      var input=row.querySelector('input.field-input');
      wide=!!(input&&/(path|url|domain|address|tracker|directory|location|save|host|username|password|rule)/i.test(key));
    }
    if(/(path|url|domain|address|tracker|directory|location|save|host|username|password|rule)/i.test(key))wide=true;
    return wide?'full':'1';
  }
  var ControlRegistry={
    select:function(opts){return C.selectControl(opts);},
    preference:function(key,value,onChange,label){return C.preferenceField(key,value,onChange,label);},
    readonly:function(key,title,description,value){return C.readonlySettingField(key,title,description,value);}
  };

  function activeSettingsOwner(){
    var active=document.querySelector('#settings-tabs [data-settings-tab].is-active');
    return active&&active.dataset.settingsTab?active.dataset.settingsTab:'unknown';
  }
  function mergeExtraGrids(group,grid){
    Array.from(group.querySelectorAll(':scope > .settings-grid-canonical')).forEach(function(extra){
      if(extra===grid)return;
      Array.from(extra.children).forEach(function(child){grid.appendChild(child);});
      extra.remove();
    });
  }
  function sectionRows(group,grid){
    return Array.from(group.querySelectorAll('.settings-row,.settings-row--canonical,.settings-control')).filter(function(row){
      if(row.closest('.settings-group')!==group)return false;
      return !grid||row.parentElement!==grid;
    });
  }
  function decorateRow(row){
    if(!row)return;
    row.classList.add('settings-row--canonical','setting-row-grid');
    row.dataset.settingSpan=classifySpan(row);
  }

  /* SETTINGS-DESIGN-001 — every editable Settings section consumes one responsive grid owner. */
  function normalizeSection(group,owner){
    if(!group)return;
    group.classList.add('settings-section-panel');
    group.dataset.settingsOwner=owner||group.dataset.settingsOwner||activeSettingsOwner();
    if(group.classList.contains('about-surface')){normalizeAboutIdentity();return;}

    var grids=Array.from(group.querySelectorAll(':scope > .settings-grid-canonical'));
    var grid=grids[0]||null;
    var rows=sectionRows(group,grid);
    if(!rows.length&&!grid)return;
    if(!grid){
      grid=document.createElement('div');
      grid.className='settings-grid-canonical';
      grid.dataset.settingsGrid='auto';
      grid.dataset.settingsOwner=group.dataset.settingsOwner;
      var heading=group.querySelector(':scope > .section-heading');
      if(heading)heading.insertAdjacentElement('afterend',grid);else group.prepend(grid);
    }
    grid.dataset.settingsOwner=group.dataset.settingsOwner;
    mergeExtraGrids(group,grid);
    sectionRows(group,grid).forEach(function(row){decorateRow(row);grid.appendChild(row);});
    Array.from(grid.children).forEach(function(row){
      if(!row.matches('.settings-row,.settings-row--canonical,.settings-control,.setting-row-grid'))return;
      decorateRow(row);
    });
  }
  function consolidateWeiGGrid(root){
    var primary=root.querySelector(':scope > .settings-section-panel[data-settings-owner="weigg"]');
    var grid=primary&&primary.querySelector(':scope > .settings-grid-canonical');
    if(!grid)return;
    grid.dataset.settingsOwner='weigg';
    Array.from(root.querySelectorAll('.settings-row,.setting-row-grid,.settings-control,.settings-row--canonical')).forEach(function(row){
      var section=row.closest('.settings-section-panel');
      if(section&&section.dataset.settingsOwner==='weigg-metrics')return;
      if(section&&section.classList.contains('about-surface'))return;
      if(row.closest('#settings-content')!==root)return;
      decorateRow(row);
      if(row.parentElement!==grid)grid.appendChild(row);
    });
    Array.from(root.querySelectorAll('.settings-grid-canonical')).forEach(function(extra){
      if(extra===grid)return;
      var section=extra.closest('.settings-section-panel');
      if(section&&section.dataset.settingsOwner==='weigg-metrics')return;
      Array.from(extra.children).forEach(function(child){
        if(child.matches('.settings-row,.setting-row-grid,.settings-control,.settings-row--canonical')){decorateRow(child);grid.appendChild(child);}
      });
      if(!extra.children.length)extra.remove();
    });
  }
  function normalizeSettings(){
    var root=document.getElementById('settings-content');
    if(!root)return;
    root.classList.add('settings-content--canonical');
    var owner=activeSettingsOwner();
    Array.from(root.querySelectorAll(':scope > .settings-group')).forEach(function(group,index){
      var sectionOwner=owner;
      if(owner==='weigg'&&index>0)sectionOwner='weigg-metrics';
      normalizeSection(group,sectionOwner);
    });
    if(owner==='weigg')consolidateWeiGGrid(root);
    normalizeAboutIdentity();
  }
  function queueNormalize(){
    if(normalizeQueued)return;
    normalizeQueued=true;
    requestAnimationFrame(function(){normalizeQueued=false;normalizeSettings();});
  }
  function observeSettings(){
    var root=document.getElementById('settings-content');
    if(!root||settingsObserver)return;
    settingsObserver=new MutationObserver(queueNormalize);
    settingsObserver.observe(root,{childList:true,subtree:true});
  }

  function init(){
    if(initialized)return;
    initialized=true;
    normalizeHeaderBrand();
    normalizeSettings();
    observeSettings();
    global.addEventListener('weigg:languagechange',queueNormalize);
    global.addEventListener('weigg:timezonechange',queueNormalize);
    global.addEventListener('hashchange',function(){requestAnimationFrame(function(){normalizeHeaderBrand();queueNormalize();});});
    global.setTimeout(function(){normalizeHeaderBrand();queueNormalize();},700);
  }

  W.SettingsDesignV037={
    ControlRegistry:ControlRegistry,
    normalize:normalizeSettings,
    normalizeSection:normalizeSection,
    classifySpan:classifySpan,
    activeOwner:activeSettingsOwner
  };
  W.BrandSystemV037={
    BrandMark:installBrandMark,
    BrandCluster:normalizeHeaderBrand,
    BrandIdentity:normalizeAboutIdentity,
    Navigation:W.Navigation
  };
  W.V037SettingsBrand={init:init,settings:W.SettingsDesignV037,brand:W.BrandSystemV037};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);

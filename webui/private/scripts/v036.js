(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util,C=W&&W.Components;
  if(!W||!U||!C)return;
  var I=W.V036I18n;
  function tr(key,vars){return I&&I.t?I.t(key,vars):key;}

  /* BRAND-001 — reusable random AmbientMark scheduler. */
  var ambientRandom=Math.random,ambientTimer=null,ambientMarks=new Set();
  var EFFECTS=['orbit','spark','tilt','shine','breathe','orbit-spark'];
  var SPARK_COLORS=['#38d6ff','#7297ff','#816fff','#39d98a','#ffbd5a','#edf2ff'];
  function reducedMotion(){return !!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);}
  function repairBrandAsset(){var link=document.querySelector('link[data-weigg-layer="brand-031"]');if(link&&W.buildAssetUrl&&String(link.getAttribute('href')||'').indexOf('__WEIGG_GIT_SHA__')<0){var wanted=W.buildAssetUrl('css/brand-v031.css');if(link.getAttribute('href')!==wanted)link.href=wanted;}}
  function ensureAmbientLayers(mark){
    var orbit=mark.querySelector('.ambient-mark__orbit');if(!orbit){orbit=document.createElement('span');orbit.className='ambient-mark__orbit';orbit.setAttribute('aria-hidden','true');mark.prepend(orbit);}
    var shine=mark.querySelector('.ambient-mark__shine');if(!shine){shine=document.createElement('span');shine.className='ambient-mark__shine';shine.setAttribute('aria-hidden','true');mark.appendChild(shine);}
    var sparks=mark.querySelector('.ambient-mark__sparks');if(!sparks){sparks=document.createElement('span');sparks.className='ambient-mark__sparks';sparks.setAttribute('aria-hidden','true');SPARK_COLORS.forEach(function(color,index){var s=document.createElement('i');s.className='ambient-mark__spark';s.style.setProperty('--spark-color',color);s.style.setProperty('--spark-delay',(index*36)+'ms');sparks.appendChild(s);});mark.appendChild(sparks);}
  }
  function decorateAmbientMark(mark){
    if(!mark)return mark;mark.dataset.ambientMarkReady='1';mark.classList.add('ambient-mark');mark.style.overflow='visible';ensureAmbientLayers(mark);ambientMarks.add(mark);repairBrandAsset();return mark;
  }
  function randomBetween(min,max){return min+ambientRandom()*(max-min);}
  function resetEffect(mark){['is-ambient-orbit','is-ambient-spark','is-ambient-tilt','is-ambient-shine','is-ambient-breathe'].forEach(function(cls){mark.classList.remove(cls);});}
  function seedSparks(mark){Array.from(mark.querySelectorAll('.ambient-mark__spark')).forEach(function(s,index){var angle=randomBetween(0,Math.PI*2),distance=randomBetween(15,26);s.style.setProperty('--spark-x',(Math.cos(angle)*distance).toFixed(1)+'px');s.style.setProperty('--spark-y',(Math.sin(angle)*distance).toFixed(1)+'px');s.style.setProperty('--spark-delay',Math.round(index*28+randomBetween(0,80))+'ms');});}
  function triggerAmbient(mark,effect){
    mark=decorateAmbientMark(mark);if(!mark||reducedMotion()||document.hidden)return false;resetEffect(mark);void mark.offsetWidth;effect=effect||EFFECTS[Math.floor(ambientRandom()*EFFECTS.length)]||'shine';seedSparks(mark);
    if(effect==='orbit-spark'){mark.classList.add('is-ambient-orbit','is-ambient-spark');}
    else mark.classList.add('is-ambient-'+effect);
    global.setTimeout(function(){resetEffect(mark);},2100);return true;
  }
  function scheduleAmbient(){
    clearTimeout(ambientTimer);ambientTimer=null;if(document.hidden||reducedMotion()||!ambientMarks.size)return;
    ambientTimer=setTimeout(function(){var marks=Array.from(ambientMarks);if(marks.length&&ambientRandom()>.18)triggerAmbient(marks[Math.floor(ambientRandom()*marks.length)]);scheduleAmbient();},Math.round(randomBetween(8000,28000)));
  }
  W.AmbientMark={
    install:function(target){var nodes=typeof target==='string'?document.querySelectorAll(target):[target];Array.from(nodes||[]).forEach(decorateAmbientMark);scheduleAmbient();return this;},
    trigger:function(target,effect){var mark=typeof target==='string'?document.querySelector(target):target;return triggerAmbient(mark,effect);},
    setRandom:function(fn){ambientRandom=typeof fn==='function'?fn:Math.random;return this;},
    stop:function(){clearTimeout(ambientTimer);ambientTimer=null;},
    start:scheduleAmbient
  };

  /* SELECT-001 — progressively upgrade every native select to the shared listbox. */
  function upgradeSelects(root){C.upgradeNativeSelects(root||document);}
  function observeSelects(){
    if(document.documentElement.dataset.v036SelectObserver==='1')return;document.documentElement.dataset.v036SelectObserver='1';
    upgradeSelects(document);
    new MutationObserver(function(records){records.forEach(function(record){Array.from(record.addedNodes||[]).forEach(function(node){if(node.nodeType!==1)return;if(node.matches&&node.matches('select'))C.upgradeNativeSelect(node);upgradeSelects(node);});});}).observe(document.body,{childList:true,subtree:true});
  }

  /* TIME-001 — one browser timezone setting shared by Logs and Settings. */
  function timeZoneOptions(){return W.Time.zones().map(function(item){if(item.value==='system')return {value:item.value,label:tr('v036.time.system')};return item;});}
  function buildTimeZoneCard(){
    var card=document.createElement('div');card.className='settings-control';card.dataset.v036Timezone='1';card.dataset.settingKey='weigg_timezone';card.dataset.settingSearch=('timezone time zone '+tr('v036.settings.timeZone')+' '+tr('v036.settings.timeZoneDesc')).toLocaleLowerCase();
    var copy=document.createElement('span');var title=document.createElement('strong');title.textContent=tr('v036.settings.timeZone');var desc=document.createElement('small');desc.className='text-description';desc.textContent=tr('v036.settings.timeZoneDesc');copy.append(title,desc);
    var select=C.selectControl({value:W.Time.getZone(),options:timeZoneOptions(),className:'timezone-select',ariaLabel:tr('v036.logs.timeZone'),searchable:true,searchThreshold:12,searchPlaceholder:tr('v036.logs.timeZoneSearch'),onChange:function(value){W.Time.setZone(value);}});
    card.append(copy,select);return card;
  }
  function injectTimeZoneSetting(){
    var root=U.$('settings-content'),active=document.querySelector('#settings-tabs [data-settings-tab].is-active');if(!root||!active||active.dataset.settingsTab!=='weigg')return;
    if(root.querySelector('[data-v036-timezone]'))return;
    var groups=root.querySelectorAll('.settings-group'),group=groups.length?groups[0]:root;group.appendChild(buildTimeZoneCard());
  }
  function observeSettings(){
    var root=U.$('settings-content');if(!root||root.dataset.v036Observed==='1')return;root.dataset.v036Observed='1';new MutationObserver(function(){requestAnimationFrame(injectTimeZoneSetting);}).observe(root,{childList:true,subtree:true});document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#settings-tabs [data-settings-tab]'))setTimeout(injectTimeZoneSetting,40);});injectTimeZoneSetting();
  }

  /* NAV-001 — detail Back/Escape returns to the list context, not an arbitrary site. */
  var CONTEXT_KEY='weigg.torrentListContext.v036';
  function listContext(){try{return JSON.parse(sessionStorage.getItem(CONTEXT_KEY)||'null');}catch(_e){return null;}}
  function writeListContext(ctx){try{sessionStorage.setItem(CONTEXT_KEY,JSON.stringify(ctx));}catch(_e){}}
  function saveListContext(){var list=U.$('torrent-list');writeListContext({hash:location.hash||'#/',scrollTop:list?list.scrollTop:0,pageLabel:U.$('page-label')?U.$('page-label').textContent:'',savedAt:Date.now(),restore:false});}
  function markRestore(){var ctx=listContext();if(!ctx)return;ctx.restore=true;writeListContext(ctx);}
  function restoreListContext(){
    var ctx=listContext(),route=W.Router&&W.Router.route?W.Router.route():{name:'home'};if(!ctx||!ctx.restore||route.name!=='home')return;
    var target=Math.max(0,Number(ctx.scrollTop)||0),tries=0,maxTries=12;
    function apply(){
      var current=W.Router&&W.Router.route?W.Router.route():{name:'home'},list=U.$('torrent-list');
      if(current.name!=='home')return;
      if(!list||list.clientHeight<=0||list.scrollHeight<=list.clientHeight){if(tries++<maxTries)return setTimeout(apply,40);return;}
      list.__weiggVirtualScrollTop=target;list.scrollTop=target;
      if(list.__weiggVirtualScrollHandler)list.__weiggVirtualScrollHandler();
      if(Math.abs(list.scrollTop-target)>3&&tries++<maxTries)return setTimeout(apply,40);
      ctx.restore=false;writeListContext(ctx);
    }
    requestAnimationFrame(function(){requestAnimationFrame(apply);});
  }
  function backFromDetail(){var route=W.Router&&W.Router.route?W.Router.route():{name:'home'},ctx=listContext();if(route.name!=='torrent')return false;markRestore();if(ctx&&ctx.hash&&ctx.savedAt&&Date.now()-ctx.savedAt<86400000){history.back();setTimeout(function(){var r=W.Router.route();if(r.name==='torrent')W.Router.home();},180);return true;}W.Router.home();return true;}
  function syncDetailBack(){
    var tabs=document.querySelector('#detail-view .detail-tabs'),route=W.Router&&W.Router.route?W.Router.route():{name:'home'};if(!tabs)return;var existing=tabs.querySelector('[data-v036-detail-back]');if(route.name!=='torrent'){if(existing)existing.remove();return;}if(existing){existing.querySelector('span').textContent=tr('v036.detail.back');existing.title=tr('v036.detail.backHint');return;}
    var button=document.createElement('button');button.type='button';button.className='btn btn--ghost detail-context-back';button.dataset.v036DetailBack='1';button.title=tr('v036.detail.backHint');var icon=document.createElement('b');icon.textContent='←';icon.setAttribute('aria-hidden','true');var label=document.createElement('span');label.textContent=tr('v036.detail.back');button.append(icon,label);button.addEventListener('click',backFromDetail);tabs.insertBefore(button,tabs.firstChild);
  }
  function captureDetailEntry(e){if(!e.target.closest)return;var target=e.target.closest('.torrent-title,.row-more,.mobile-card-title');if(target)saveListContext();}
  function editableFocus(){var el=document.activeElement;if(!el)return false;return /^(INPUT|TEXTAREA)$/.test(el.tagName)||el.isContentEditable;}
  function onEscape(e){if(e.key!=='Escape')return;if(C.closeSelects(false)){e.preventDefault();e.stopPropagation();return;}if(document.querySelector('dialog[open]'))return;if(editableFocus())return;var route=W.Router&&W.Router.route?W.Router.route():{name:'home'};if(route.name==='torrent'){e.preventDefault();e.stopPropagation();backFromDetail();}}

  function syncLocale(){I=W.V036I18n||I;syncDetailBack();var card=document.querySelector('[data-v036-timezone]');if(card){card.remove();injectTimeZoneSetting();}}
  function init(){
    if(document.documentElement.dataset.v036==='1')return;document.documentElement.dataset.v036='1';
    observeSelects();observeSettings();W.AmbientMark.install('.brand__mark');syncDetailBack();restoreListContext();
    document.addEventListener('click',captureDetailEntry,true);document.addEventListener('keydown',onEscape,true);
    global.addEventListener('hashchange',function(){setTimeout(function(){syncDetailBack();restoreListContext();},20);});
    global.addEventListener('weigg:languagechange',syncLocale);global.addEventListener('weigg:timezonechange',function(){global.dispatchEvent(new CustomEvent('weigg:timeformatrefresh'));});
    document.addEventListener('visibilitychange',function(){if(document.hidden)W.AmbientMark.stop();else W.AmbientMark.start();});
    setTimeout(function(){W.AmbientMark.install('.brand__mark');repairBrandAsset();upgradeSelects(document);injectTimeZoneSetting();syncDetailBack();},900);
    setTimeout(function(){W.AmbientMark.install('.brand__mark');repairBrandAsset();},1800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);

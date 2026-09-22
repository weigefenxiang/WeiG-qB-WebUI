(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var MODES=['system','time','light','dark'],mode='dark',resolved='dark',systemQuery=null,timeTimer=null;
  function normalize(value){value=String(value||'dark');return MODES.indexOf(value)>=0?value:'dark';}
  function locale(){return W.I18n&&W.I18n.getLocale?W.I18n.getLocale():'en';}
  function labels(){var I=W.I18n,t=I&&I.t?function(key){return I.t(key);}:function(key){return key;};return{system:t('settings.weig.theme.system'),time:t('settings.weig.theme.time'),light:t('settings.weig.theme.light'),dark:t('settings.weig.theme.dark'),aria:t('settings.weig.theme.aria')};}
  function options(){var x=labels();return MODES.map(function(value){return{value:value,label:x[value]};});}
  function systemTheme(){return global.matchMedia&&global.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
  function timeTheme(now){now=now||new Date();var hour=now.getHours();return hour>=20||hour<8?'dark':'light';}
  function resolveFor(nextMode,now){nextMode=normalize(nextMode);return nextMode==='system'?systemTheme():nextMode==='time'?timeTheme(now):nextMode;}
  function nextBoundary(now){now=now||new Date();var out=new Date(now.getTime()),hour=now.getHours();if(hour<8){out.setHours(8,0,0,0);}else if(hour<20){out.setHours(20,0,0,0);}else{out.setDate(out.getDate()+1);out.setHours(8,0,0,0);}return out;}
  function metaColor(theme){return theme==='light'?'#f8fbff':'#070b14';}
  function emit(reason){try{global.dispatchEvent(new CustomEvent('weigg:themechange',{detail:{mode:mode,resolved:resolved,reason:reason||'apply'}}));}catch(_e){}}
  function paint(next,reason,forceEvent){next=next==='light'?'light':'dark';var h=document.documentElement,changed=resolved!==next||h.dataset.theme!==next;resolved=next;h.dataset.theme=resolved;h.dataset.themeMode=mode;var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',metaColor(resolved));if(changed||forceEvent)emit(reason);return resolved;}
  function clearTime(){if(timeTimer){clearTimeout(timeTimer);timeTimer=null;}}
  function scheduleTime(){clearTime();if(mode!=='time')return;var now=new Date(),delay=Math.max(1000,nextBoundary(now).getTime()-now.getTime()+80);timeTimer=setTimeout(function(){paint(timeTheme(new Date()),'time-boundary',false);scheduleTime();},delay);}
  function onSystemChange(){if(mode==='system')paint(systemTheme(),'system-change',false);}
  function bindSystem(){if(!systemQuery&&global.matchMedia){systemQuery=global.matchMedia('(prefers-color-scheme: dark)');if(systemQuery.addEventListener)systemQuery.addEventListener('change',onSystemChange);}}
  function unbindSystem(){if(systemQuery&&systemQuery.removeEventListener)systemQuery.removeEventListener('change',onSystemChange);systemQuery=null;}
  function applyMode(next,reason){next=normalize(next);var previous=mode;if(mode!==next){clearTime();unbindSystem();}mode=next;if(mode==='system')bindSystem();else if(mode==='time')scheduleTime();return paint(resolveFor(mode,new Date()),reason||'mode',previous!==mode);}
  function applyConfig(cfg){cfg=cfg||{};return applyMode(cfg.theme,'config');}
  function setMode(next){next=normalize(next);var cfg=W.Config&&W.Config.load?W.Config.load():{};cfg.theme=next;if(W.Config&&W.Config.save)W.Config.save(cfg);applyMode(next,'user');try{global.dispatchEvent(new CustomEvent('weigg:configchange',{detail:{key:'theme',value:next}}));}catch(_e){}return next;}
  function refresh(reason){if(mode==='time'){paint(timeTheme(new Date()),reason||'refresh',false);scheduleTime();}else if(mode==='system')paint(systemTheme(),reason||'refresh',false);}
  function state(){return{mode:mode,resolved:resolved};}
  function title(){var x=labels();return x.aria+': '+x[mode];}
  W.Theme={modes:MODES.slice(),options:options,labels:labels,normalize:normalize,resolveFor:resolveFor,nextBoundary:nextBoundary,applyConfig:applyConfig,setMode:setMode,refresh:refresh,state:state,title:title};
  document.addEventListener('visibilitychange',function(){if(!document.hidden)refresh('visibility');});
  global.addEventListener('pageshow',function(){refresh('pageshow');});
  global.addEventListener('weigg:languagechange',function(){try{global.dispatchEvent(new CustomEvent('weigg:themeoptionschange',{detail:{mode:mode}}));}catch(_e){}});
  if(W.Config&&W.Config.load)applyConfig(W.Config.load());
})(window);

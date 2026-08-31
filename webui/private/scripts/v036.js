(function(global){
  'use strict';
  var W=global.WeiG,U=W&&W.util,C=W&&W.Components;
  if(!W||!U||!C)return;
  var I=W.V036I18n;
  function tr(key,vars){return I&&I.t?I.t(key,vars):key;}

  function ensureV036Css(){
    if(document.querySelector('link[data-weigg-v036-css]'))return;
    var link=document.createElement('link');link.rel='stylesheet';link.dataset.weiggV036Css='1';link.href=W.buildAssetUrl?W.buildAssetUrl('css/v036.css'):'css/v036.css';document.head.appendChild(link);
  }
  ensureV036Css();

  /* FLOATING-001 — every Select/Popover lives outside clipping ancestors. */
  var floatingRoot=null,activeSelect=null;
  function getFloatingRoot(){
    if(floatingRoot&&floatingRoot.isConnected)return floatingRoot;
    floatingRoot=document.getElementById('weigg-floating-layer');
    if(!floatingRoot){floatingRoot=document.createElement('div');floatingRoot.id='weigg-floating-layer';floatingRoot.className='weigg-floating-layer';floatingRoot.setAttribute('aria-live','off');document.body.appendChild(floatingRoot);}
    return floatingRoot;
  }
  function viewportBox(){var vv=global.visualViewport;return {left:vv?vv.offsetLeft:0,top:vv?vv.offsetTop:0,width:vv?vv.width:document.documentElement.clientWidth,height:vv?vv.height:document.documentElement.clientHeight};}
  function placeFloating(wrapper){
    if(!wrapper||!wrapper.__uiMenu||wrapper.__uiMenu.hidden)return;
    var trigger=wrapper.__uiTrigger,menu=wrapper.__uiMenu,r=trigger.getBoundingClientRect(),v=viewportBox(),pad=8,gap=7,maxW=Math.max(160,v.width-pad*2);
    menu.style.visibility='hidden';menu.style.left='0px';menu.style.top='0px';menu.style.width=Math.min(maxW,Math.max(r.width,Math.min(360,wrapper.__preferredWidth||220)))+'px';menu.style.maxHeight='';
    var width=Math.min(maxW,Math.max(r.width,menu.offsetWidth||220)),naturalH=menu.offsetHeight||240,down=(v.top+v.height)-r.bottom-gap-pad,up=r.top-v.top-gap-pad,useDown=(down>=Math.min(naturalH,280)||down>=up),maxH=Math.max(120,(useDown?down:up));
    menu.style.width=width+'px';menu.style.maxHeight=Math.min(maxH,Math.floor(v.height*.68))+'px';
    var h=Math.min(menu.offsetHeight||naturalH,Math.min(maxH,Math.floor(v.height*.68))),left=Math.min(Math.max(v.left+pad,r.left),v.left+v.width-pad-width),top=useDown?r.bottom+gap:Math.max(v.top+pad,r.top-gap-h);
    menu.style.left=Math.round(left)+'px';menu.style.top=Math.round(top)+'px';menu.style.visibility='visible';menu.dataset.placement=useDown?'bottom':'top';
  }
  function closeFloatingSelect(wrapper,restoreFocus){
    if(!wrapper||!wrapper.__uiMenu||wrapper.__uiMenu.hidden)return false;
    wrapper.__uiMenu.hidden=true;wrapper.__uiMenu.remove();wrapper.classList.remove('is-open');wrapper.__uiTrigger.setAttribute('aria-expanded','false');if(activeSelect===wrapper)activeSelect=null;if(restoreFocus)wrapper.__uiTrigger.focus();return true;
  }
  function installFloatingSelect(){
    if(C.__floatingSelectV036)return;C.__floatingSelectV036=true;
    C.closeSelects=function(restoreFocus){return closeFloatingSelect(activeSelect,restoreFocus!==false);};
    C.selectControl=function(opts){
      opts=opts||{};var raw=opts.options||[],items=raw.map(function(item){return typeof item==='string'?{value:item,label:item}:{value:String(item.value),label:String(item.label==null?item.value:item.label)};}),value=String(opts.value==null?'':opts.value),wrapper=document.createElement('div');wrapper.className='ui-select'+(opts.className?' '+opts.className:'');wrapper.dataset.uiSelect='1';if(opts.id)wrapper.id=opts.id;
      var trigger=document.createElement('button');trigger.type='button';trigger.className='ui-select__trigger';trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');if(opts.ariaLabel)trigger.setAttribute('aria-label',opts.ariaLabel);
      var prefix=document.createElement('span');prefix.className='ui-select__prefix';prefix.textContent=opts.prefix||'';prefix.hidden=!opts.prefix;var copy=document.createElement('span');copy.className='ui-select__value';var chevron=document.createElement('span');chevron.className='ui-select__chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='▾';trigger.append(prefix,copy,chevron);wrapper.appendChild(trigger);
      var menu=document.createElement('div');menu.className='ui-select__menu surface surface--floating';menu.setAttribute('role','listbox');menu.hidden=true;var search=null,list=document.createElement('div');list.className='ui-select__options';menu.appendChild(list);wrapper.__uiMenu=menu;wrapper.__uiTrigger=trigger;wrapper.__preferredWidth=opts.width||220;
      var filtered=items.slice(),activeIndex=-1;
      function current(){var hit=items.find(function(x){return x.value===value;});return hit?hit.label:(opts.placeholder||value||'—');}
      function sync(){copy.textContent=current();trigger.title=(opts.prefix?opts.prefix+' ':'')+current();trigger.disabled=!!opts.disabled;}
      function render(q){q=String(q||'').trim().toLocaleLowerCase();filtered=items.filter(function(x){return !q||x.label.toLocaleLowerCase().indexOf(q)>=0||x.value.toLocaleLowerCase().indexOf(q)>=0;});list.textContent='';activeIndex=-1;filtered.forEach(function(item,index){var b=document.createElement('button');b.type='button';b.className='ui-select__option';b.setAttribute('role','option');b.dataset.value=item.value;b.setAttribute('aria-selected',item.value===value?'true':'false');b.classList.toggle('is-selected',item.value===value);b.textContent=item.label;b.addEventListener('click',function(){setValue(item.value,true);closeFloatingSelect(wrapper,true);});list.appendChild(b);if(item.value===value)activeIndex=index;});if(activeIndex<0&&filtered.length)activeIndex=0;}
      function ensureSearch(){if(search||!opts.searchable||items.length<(opts.searchThreshold||14))return;search=document.createElement('input');search.type='search';search.className='ui-select__search';search.autocomplete='off';search.placeholder=opts.searchPlaceholder||'Search…';search.setAttribute('aria-label',search.placeholder);search.addEventListener('input',function(){activeIndex=0;render(search.value);placeFloating(wrapper);});search.addEventListener('keydown',onKey);menu.insertBefore(search,list);}
      function focusIndex(i){var buttons=Array.from(list.querySelectorAll('.ui-select__option'));if(!buttons.length)return;activeIndex=Math.max(0,Math.min(buttons.length-1,i));buttons[activeIndex].focus();}
      function onKey(e){if(e.key==='Escape'){e.preventDefault();closeFloatingSelect(wrapper,true);}else if(e.key==='ArrowDown'){e.preventDefault();focusIndex(activeIndex+1);}else if(e.key==='ArrowUp'){e.preventDefault();focusIndex(activeIndex-1);}else if(e.key==='Home'){e.preventDefault();focusIndex(0);}else if(e.key==='End'){e.preventDefault();focusIndex(filtered.length-1);}}
      function open(){if(trigger.disabled)return;if(activeSelect&&activeSelect!==wrapper)closeFloatingSelect(activeSelect,false);ensureSearch();render(search&&search.value);getFloatingRoot().appendChild(menu);menu.hidden=false;wrapper.classList.add('is-open');trigger.setAttribute('aria-expanded','true');activeSelect=wrapper;requestAnimationFrame(function(){placeFloating(wrapper);if(search)search.focus();else focusIndex(Math.max(0,activeIndex));});}
      function setValue(next,notify){value=String(next==null?'':next);sync();render(search&&search.value);if(notify&&typeof opts.onChange==='function')opts.onChange(value);}
      trigger.addEventListener('click',function(e){e.stopPropagation();menu.hidden?open():closeFloatingSelect(wrapper,false);});trigger.addEventListener('keydown',function(e){if(['ArrowDown','ArrowUp','Enter',' '].indexOf(e.key)>=0){e.preventDefault();open();}else if(e.key==='Escape')closeFloatingSelect(wrapper,false);});menu.addEventListener('keydown',onKey);menu.addEventListener('click',function(e){e.stopPropagation();});
      wrapper.setValue=function(next){setValue(next,false);};wrapper.getValue=function(){return value;};wrapper.setOptions=function(next){items=(next||[]).map(function(item){return typeof item==='string'?{value:item,label:item}:{value:String(item.value),label:String(item.label==null?item.value:item.label)};});render(search&&search.value);sync();};wrapper.setDisabled=function(disabled){opts.disabled=!!disabled;sync();};wrapper.__uiClose=function(focus){return closeFloatingSelect(wrapper,focus);};render('');sync();return wrapper;
    };
    document.addEventListener('click',function(){C.closeSelects(false);});global.addEventListener('resize',function(){placeFloating(activeSelect);},{passive:true});global.addEventListener('scroll',function(){placeFloating(activeSelect);},true);if(global.visualViewport){visualViewport.addEventListener('resize',function(){placeFloating(activeSelect);});visualViewport.addEventListener('scroll',function(){placeFloating(activeSelect);});}
  }
  installFloatingSelect();

  /* SETTING-UNIT-001 — Advanced values expose verified units/enums instead of naked numbers. */
  var ADVANCED_META={
    slow_torrent_inactive_timer:{unit:'s'},slow_torrent_dl_rate_threshold:{unit:'KiB/s'},slow_torrent_ul_rate_threshold:{unit:'KiB/s'},send_buffer_watermark:{unit:'KiB'},send_buffer_low_watermark:{unit:'KiB'},send_buffer_watermark_factor:{unit:'%'},socket_backlog_size:{unit:'connections'},socket_receive_buffer_size:{unit:'B'},socket_send_buffer_size:{unit:'B'},stop_tracker_timeout:{unit:'s'},upnp_lease_duration:{unit:'s'},torrent_file_size_limit:{unit:'B'},ssl_listen_port:{unit:'port'},web_ui_port:{unit:'port'},max_concurrent_http_announces:{unit:'requests'},announce_port:{unit:'port'},save_resume_data_interval:{unit:'min'},disk_cache_ttl:{unit:'s'},checking_memory_use:{unit:'MiB'},async_io_threads:{unit:'threads'},file_pool_size:{unit:'files'},recheck_completed_torrents:{kind:'boolean'},
    upload_slots_behavior:{enum:[{value:'0',label:'Fixed slots'},{value:'1',label:'Upload rate based'}]},
    upload_choking_algorithm:{enum:[{value:'0',label:'Round-robin'},{value:'1',label:'Fastest upload'},{value:'2',label:'Anti-leech'}]},
    utp_tcp_mixed_mode:{enum:[{value:'0',label:'Prefer TCP'},{value:'1',label:'Peer proportional'}]},
    torrent_stop_condition:{enum:[{value:'None',label:'None'},{value:'MetadataReceived',label:'Metadata received'},{value:'FilesChecked',label:'Files checked'}]}
  };
  function installAdvancedSchema(){
    if(!W.SettingsSchema||W.SettingsSchema.__v036Units)return;W.SettingsSchema.__v036Units=true;var original=W.SettingsSchema.describe;W.SettingsSchema.describe=function(key){var info=original(key),meta=ADVANCED_META[key];if(!meta)return info;info=Object.assign({},info,meta);if(meta.unit&&String(info.title).indexOf('('+meta.unit+')')<0)info.title=info.title+' ('+meta.unit+')';if(meta.enum)info.kind='enum';return info;};
    var originalField=C.preferenceField;C.preferenceField=function(key,value,onChange,label){var info=W.SettingsSchema.describe(key);if(!info.enum)return originalField(key,value,onChange,label);var row=document.createElement('div');row.className='settings-row setting-card';row.dataset.settingKey=key;row.dataset.settingSearch=(info.title+' '+info.description+' '+key).toLocaleLowerCase();var copyEl=document.createElement('span');copyEl.className='settings-row__copy';var title=document.createElement('strong');title.textContent=info.title;title.title=info.title;var desc=document.createElement('small');desc.className='text-description';desc.textContent=info.description;copyEl.append(title,desc);var select=C.selectControl({value:String(value==null?'':value),options:info.enum,ariaLabel:info.title,onChange:function(next){onChange(key,U.parseScalar(next));}});row.append(copyEl,select);return row;};
  }
  installAdvancedSchema();

  /* BRAND-001 — reusable random AmbientMark scheduler. */
  var ambientRandom=Math.random,ambientTimer=null,ambientMarks=new Set();
  var EFFECTS=['orbit','spark','tilt','shine','breathe','orbit-spark'];
  var SPARK_COLORS=['#38d6ff','#7297ff','#816fff','#39d98a','#ffbd5a','#edf2ff'];
  function reducedMotion(){return !!(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);}
  function repairBrandAsset(){var link=document.querySelector('link[data-weigg-layer="brand-031"]');if(link&&W.buildAssetUrl&&String(link.getAttribute('href')||'').indexOf('__WEIGG_GIT_SHA__')<0){var wanted=W.buildAssetUrl('css/brand-v031.css');if(link.getAttribute('href')!==wanted)link.href=wanted;}}
  function ensureAmbientLayers(mark){var orbit=mark.querySelector('.ambient-mark__orbit');if(!orbit){orbit=document.createElement('span');orbit.className='ambient-mark__orbit';orbit.setAttribute('aria-hidden','true');mark.prepend(orbit);}var shine=mark.querySelector('.ambient-mark__shine');if(!shine){shine=document.createElement('span');shine.className='ambient-mark__shine';shine.setAttribute('aria-hidden','true');mark.appendChild(shine);}var sparks=mark.querySelector('.ambient-mark__sparks');if(!sparks){sparks=document.createElement('span');sparks.className='ambient-mark__sparks';sparks.setAttribute('aria-hidden','true');SPARK_COLORS.forEach(function(color,index){var s=document.createElement('i');s.className='ambient-mark__spark';s.style.setProperty('--spark-color',color);s.style.setProperty('--spark-delay',(index*36)+'ms');sparks.appendChild(s);});mark.appendChild(sparks);}}
  function decorateAmbientMark(mark){if(!mark)return mark;mark.dataset.ambientMarkReady='1';mark.classList.add('ambient-mark');mark.style.overflow='visible';ensureAmbientLayers(mark);ambientMarks.add(mark);repairBrandAsset();return mark;}
  function randomBetween(min,max){return min+ambientRandom()*(max-min);}
  function resetEffect(mark){['is-ambient-orbit','is-ambient-spark','is-ambient-tilt','is-ambient-shine','is-ambient-breathe'].forEach(function(cls){mark.classList.remove(cls);});}
  function seedSparks(mark){Array.from(mark.querySelectorAll('.ambient-mark__spark')).forEach(function(s,index){var angle=randomBetween(0,Math.PI*2),distance=randomBetween(15,26);s.style.setProperty('--spark-x',(Math.cos(angle)*distance).toFixed(1)+'px');s.style.setProperty('--spark-y',(Math.sin(angle)*distance).toFixed(1)+'px');s.style.setProperty('--spark-delay',Math.round(index*28+randomBetween(0,80))+'ms');});}
  function triggerAmbient(mark,effect){mark=decorateAmbientMark(mark);if(!mark||reducedMotion()||document.hidden)return false;resetEffect(mark);void mark.offsetWidth;effect=effect||EFFECTS[Math.floor(ambientRandom()*EFFECTS.length)]||'shine';seedSparks(mark);if(effect==='orbit-spark')mark.classList.add('is-ambient-orbit','is-ambient-spark');else mark.classList.add('is-ambient-'+effect);global.setTimeout(function(){resetEffect(mark);},2100);return true;}
  function scheduleAmbient(){clearTimeout(ambientTimer);ambientTimer=null;if(document.hidden||reducedMotion()||!ambientMarks.size)return;ambientTimer=setTimeout(function(){var marks=Array.from(ambientMarks);if(marks.length&&ambientRandom()>.18)triggerAmbient(marks[Math.floor(ambientRandom()*marks.length)]);scheduleAmbient();},Math.round(randomBetween(8000,28000)));}
  W.AmbientMark={install:function(target){var nodes=typeof target==='string'?document.querySelectorAll(target):[target];Array.from(nodes||[]).forEach(decorateAmbientMark);scheduleAmbient();return this;},trigger:function(target,effect){var mark=typeof target==='string'?document.querySelector(target):target;return triggerAmbient(mark,effect);},setRandom:function(fn){ambientRandom=typeof fn==='function'?fn:Math.random;return this;},stop:function(){clearTimeout(ambientTimer);ambientTimer=null;},start:scheduleAmbient};

  function upgradeSelects(root){C.upgradeNativeSelects(root||document);}
  function observeSelects(){if(document.documentElement.dataset.v036SelectObserver==='1')return;document.documentElement.dataset.v036SelectObserver='1';upgradeSelects(document);new MutationObserver(function(records){records.forEach(function(record){Array.from(record.addedNodes||[]).forEach(function(node){if(node.nodeType!==1)return;if(node.matches&&node.matches('select'))C.upgradeNativeSelect(node);upgradeSelects(node);});});}).observe(document.body,{childList:true,subtree:true});}

  /* TIME-002 — Display Time Zone is browser presentation only, with live UTC offset. */
  function resolvedZone(zone){if(zone&&zone!=='system')return zone;return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}
  function offsetMinutes(zone,date){date=date||new Date();zone=resolvedZone(zone);if(zone==='UTC')return 0;try{var parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date),bag={};parts.forEach(function(p){if(p.type!=='literal')bag[p.type]=p.value;});var asUTC=Date.UTC(Number(bag.year),Number(bag.month)-1,Number(bag.day),Number(bag.hour),Number(bag.minute),Number(bag.second));return Math.round((asUTC-date.getTime())/60000);}catch(_e){return 0;}}
  function offsetLabel(zone,date){var mins=offsetMinutes(zone,date),sign=mins>=0?'+':'-',abs=Math.abs(mins),hh=String(Math.floor(abs/60)).padStart(2,'0'),mm=String(abs%60).padStart(2,'0');return 'UTC'+sign+hh+':'+mm;}
  function zoneDisplayLabel(zone){var resolved=resolvedZone(zone),off=offsetLabel(zone);return zone==='system'?off+' · '+tr('v036.time.system')+' · '+resolved:off+' · '+resolved;}
  W.Time.offsetLabel=offsetLabel;W.Time.displayLabel=zoneDisplayLabel;
  function timeZoneOptions(){return W.Time.zones().map(function(item){return {value:item.value,label:zoneDisplayLabel(item.value)};});}
  function buildTimeZoneCard(){var card=document.createElement('div');card.className='settings-control';card.dataset.v036Timezone='1';card.dataset.settingKey='weigg_timezone';card.dataset.settingSearch=('timezone time zone '+tr('v036.settings.timeZone')+' '+tr('v036.settings.timeZoneDesc')).toLocaleLowerCase();var copy=document.createElement('span');var title=document.createElement('strong');title.textContent=tr('v036.settings.timeZone');var desc=document.createElement('small');desc.className='text-description';desc.textContent=tr('v036.settings.timeZoneDesc');copy.append(title,desc);var select=C.selectControl({value:W.Time.getZone(),options:timeZoneOptions(),className:'timezone-select',ariaLabel:tr('v036.logs.timeZone'),searchable:true,searchThreshold:12,searchPlaceholder:tr('v036.logs.timeZoneSearch'),onChange:function(value){W.Time.setZone(value);}});card.append(copy,select);return card;}
  function injectTimeZoneSetting(){var root=U.$('settings-content'),active=document.querySelector('#settings-tabs [data-settings-tab].is-active');if(!root||!active||active.dataset.settingsTab!=='weigg')return;if(root.querySelector('[data-v036-timezone]'))return;var groups=root.querySelectorAll('.settings-group'),group=groups.length?groups[0]:root;group.appendChild(buildTimeZoneCard());}
  function observeSettings(){var root=U.$('settings-content');if(!root||root.dataset.v036Observed==='1')return;root.dataset.v036Observed='1';new MutationObserver(function(){requestAnimationFrame(injectTimeZoneSetting);}).observe(root,{childList:true,subtree:true});document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#settings-tabs [data-settings-tab]'))setTimeout(injectTimeZoneSetting,40);});injectTimeZoneSetting();}
  function stripLogsTimezone(){var root=U.$('logs-content');if(!root)return;Array.from(root.querySelectorAll('.timezone-select')).forEach(function(node){node.remove();});}
  function installStatusTimezone(){
    var bar=document.querySelector('.statusbar');if(!bar)return;if(bar.querySelector('[data-status-timezone]'))return;var end=document.createElement('div');end.className='statusbar__end';end.dataset.statusTimezone='1';var select=C.selectControl({value:W.Time.getZone(),options:timeZoneOptions(),className:'status-timezone timezone-select',prefix:'✓',ariaLabel:tr('v036.settings.timeZone'),searchable:true,searchThreshold:12,searchPlaceholder:tr('v036.logs.timeZoneSearch'),width:330,onChange:function(value){W.Time.setZone(value);}});end.appendChild(select);bar.appendChild(end);
  }
  function syncTimezoneUI(){document.querySelectorAll('.status-timezone,.settings-control[data-v036-timezone] .timezone-select').forEach(function(sel){if(sel.setOptions){sel.setOptions(timeZoneOptions());sel.setValue(W.Time.getZone());}});stripLogsTimezone();}

  /* NAV-001 — detail Back/Escape returns to the list context, not an arbitrary site. */
  var CONTEXT_KEY='weigg.torrentListContext.v036';
  function listContext(){try{return JSON.parse(sessionStorage.getItem(CONTEXT_KEY)||'null');}catch(_e){return null;}}
  function writeListContext(ctx){try{sessionStorage.setItem(CONTEXT_KEY,JSON.stringify(ctx));}catch(_e){}}
  function saveListContext(){var list=U.$('torrent-list');writeListContext({hash:location.hash||'#/',scrollTop:list?list.scrollTop:0,pageLabel:U.$('page-label')?U.$('page-label').textContent:'',savedAt:Date.now(),restore:false});}
  function markRestore(){var ctx=listContext();if(!ctx)return;ctx.restore=true;writeListContext(ctx);}
  function restoreListContext(){var ctx=listContext(),route=W.Router&&W.Router.route?W.Router.route():{name:'home'};if(!ctx||!ctx.restore||route.name!=='home')return;var target=Math.max(0,Number(ctx.scrollTop)||0),tries=0,maxTries=12;function apply(){var current=W.Router&&W.Router.route?W.Router.route():{name:'home'},list=U.$('torrent-list');if(current.name!=='home')return;if(!list||list.clientHeight<=0||list.scrollHeight<=list.clientHeight){if(tries++<maxTries)return setTimeout(apply,40);return;}list.__weiggVirtualScrollTop=target;list.scrollTop=target;if(list.__weiggVirtualScrollHandler)list.__weiggVirtualScrollHandler();if(Math.abs(list.scrollTop-target)>3&&tries++<maxTries)return setTimeout(apply,40);ctx.restore=false;writeListContext(ctx);}requestAnimationFrame(function(){requestAnimationFrame(apply);});}
  function backFromDetail(){var route=W.Router&&W.Router.route?W.Router.route():{name:'home'},ctx=listContext();if(route.name!=='torrent')return false;markRestore();if(ctx&&ctx.hash&&ctx.savedAt&&Date.now()-ctx.savedAt<86400000){history.back();setTimeout(function(){var r=W.Router.route();if(r.name==='torrent')W.Router.home();},180);return true;}W.Router.home();return true;}
  function syncDetailBack(){var tabs=document.querySelector('#detail-view .detail-tabs'),route=W.Router&&W.Router.route?W.Router.route():{name:'home'};if(!tabs)return;var existing=tabs.querySelector('[data-v036-detail-back]');if(route.name!=='torrent'){if(existing)existing.remove();return;}if(existing){existing.querySelector('span').textContent=tr('v036.detail.back');existing.title=tr('v036.detail.backHint');return;}var button=document.createElement('button');button.type='button';button.className='btn btn--ghost detail-context-back';button.dataset.v036DetailBack='1';button.title=tr('v036.detail.backHint');var icon=document.createElement('b');icon.textContent='←';icon.setAttribute('aria-hidden','true');var label=document.createElement('span');label.textContent=tr('v036.detail.back');button.append(icon,label);button.addEventListener('click',backFromDetail);tabs.insertBefore(button,tabs.firstChild);}
  function captureDetailEntry(e){if(!e.target.closest)return;var target=e.target.closest('.torrent-title,.row-more,.mobile-card-title');if(target)saveListContext();}
  function editableFocus(){var el=document.activeElement;if(!el)return false;return /^(INPUT|TEXTAREA)$/.test(el.tagName)||el.isContentEditable;}
  function onEscape(e){if(e.key!=='Escape')return;if(C.closeSelects(false)){e.preventDefault();e.stopPropagation();return;}if(document.querySelector('dialog[open]'))return;if(editableFocus())return;var route=W.Router&&W.Router.route?W.Router.route():{name:'home'};if(route.name==='torrent'){e.preventDefault();e.stopPropagation();backFromDetail();}}

  function syncLocale(){I=W.V036I18n||I;syncDetailBack();var card=document.querySelector('[data-v036-timezone]');if(card){card.remove();injectTimeZoneSetting();}syncTimezoneUI();}
  function init(){
    if(document.documentElement.dataset.v036==='1')return;document.documentElement.dataset.v036='1';
    observeSelects();observeSettings();W.AmbientMark.install('.brand__mark');syncDetailBack();restoreListContext();installStatusTimezone();stripLogsTimezone();
    document.addEventListener('click',captureDetailEntry,true);document.addEventListener('keydown',onEscape,true);var logsRoot=U.$('logs-content');if(logsRoot)new MutationObserver(function(){requestAnimationFrame(stripLogsTimezone);}).observe(logsRoot,{childList:true,subtree:true});
    global.addEventListener('hashchange',function(){setTimeout(function(){syncDetailBack();restoreListContext();stripLogsTimezone();},20);});
    global.addEventListener('weigg:languagechange',syncLocale);global.addEventListener('weigg:timezonechange',function(){syncTimezoneUI();global.dispatchEvent(new CustomEvent('weigg:timeformatrefresh'));});
    document.addEventListener('visibilitychange',function(){if(document.hidden)W.AmbientMark.stop();else W.AmbientMark.start();});
    setTimeout(function(){W.AmbientMark.install('.brand__mark');repairBrandAsset();upgradeSelects(document);injectTimeZoneSetting();syncDetailBack();installStatusTimezone();stripLogsTimezone();},900);setTimeout(function(){W.AmbientMark.install('.brand__mark');repairBrandAsset();},1800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);

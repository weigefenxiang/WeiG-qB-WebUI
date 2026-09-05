(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},C=W.Components,U=W.util,S=W.SettingsSchema;
  if(!C||!C.selectControl||!U||!S)return;
  function zh(){return !!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');}
  function text(en,cn){return zh()?cn:en;}
  function own(obj,key){return Object.prototype.hasOwnProperty.call(obj||{},key);}
  var TAB_TITLES={downloads:['Downloads','下载'],connection:['Connection','连接'],bittorrent:['BitTorrent','BitTorrent'],webui:['Web UI','Web UI'],advanced:['Advanced','全部高级设置']};

  function describe(key,value){
    var info=S.describeValue(key,value),meta=info.meta||{},title=String(info.title||key),description=String(info.description||'');
    if(meta.unit&&!new RegExp('\\('+meta.unit.replace('/','\\/')+'\\)$').test(title))title+=' ('+meta.unit+')';
    var extras=[];if(meta.zero)extras.push('0 = '+meta.zero);if(meta.minusOne)extras.push('-1 = '+meta.minusOne);
    if(extras.length)description+=(description?' · ':'')+extras.join(' · ');
    if(info.source==='family')description+=(description?' · ':'')+text('Classified automatically for forward compatibility.','已按系统规则自动分类，以兼容未来 qBittorrent。');
    if(info.source==='upstream')description+=(description?' · ':'')+text('Unclassified upstream preference; kept visible instead of being dropped.','未分类的上游设置；系统保留显示，不会静默丢失。');
    if(info.structured)description+=(description?' · ':'')+text('Structured value is read-only until its upstream contract is known.','结构化值在上游契约明确前只读，避免错误写回。');
    return Object.assign({},info,{title:title,description:description,meta:meta});
  }
  function toDisplay(key,value){return S.toDisplay(key,value);}
  function toRaw(key,value){return S.toRaw(key,value);}

  function section(title,subtitle,owner){
    var s=document.createElement('section');s.className='settings-section';s.dataset.settingsOwner=owner||'';
    var h=document.createElement('header');h.className='settings-section__header';var h2=document.createElement('h2');h2.textContent=title;h.appendChild(h2);
    if(subtitle){var p=document.createElement('p');p.className='text-description';p.textContent=subtitle;h.appendChild(p);}
    var g=document.createElement('div');g.className='settings-grid';s.append(h,g);s.grid=g;return s;
  }
  function copy(title,description){
    var c=document.createElement('span');c.className='setting-copy';
    var strong=document.createElement('strong');strong.className='setting-title';strong.textContent=title;strong.title=title;
    var small=document.createElement('small');small.className='text-description setting-description';small.textContent=description||'';
    c.append(strong,small);return c;
  }
  function controlSlot(control){var slot=document.createElement('span');slot.className='setting-control-slot';if(control)slot.appendChild(control);return slot;}
  function switchControl(value,onChange,label){
    var wrap=document.createElement('span');wrap.className='switch-control';var input=document.createElement('input');input.type='checkbox';input.className='switch-input';input.checked=!!value;input.setAttribute('aria-label',label||'');
    var track=document.createElement('span');track.className='switch-track';var thumb=document.createElement('span');thumb.className='switch-thumb';track.appendChild(thumb);wrap.append(input,track);
    input.addEventListener('change',function(){onChange(input.checked);});return wrap;
  }
  function selectControl(value,options,onChange,label,extra){
    var opts={value:String(value==null?'':value),options:(options||[]).map(function(x){return{value:String(x.value),label:x.label};}),ariaLabel:label,onChange:function(v){var hit=(options||[]).find(function(x){return String(x.value)===String(v);});onChange(hit?hit.value:v);}};
    Object.assign(opts,extra||{});return C.selectControl(opts);
  }
  function inputControl(kind,value,onChange,label,meta,editable){
    var input=document.createElement('input');input.className='field-input setting-input';input.autocomplete='off';input.setAttribute('aria-label',label||'');
    var numeric=kind==='number'||kind==='port'||typeof value==='number';input.type=numeric?'number':'text';input.value=value==null?'':String(value);
    if(numeric&&meta&&meta.scale)input.step=(meta.unit==='MiB'||meta.unit==='KiB')?'0.01':'1';
    input.dataset.controlKind=numeric?'number':(kind==='path'||kind==='url'?'wide':'text');
    if(editable===false){input.readOnly=true;input.setAttribute('aria-readonly','true');}
    else input.addEventListener('change',function(){onChange(numeric?U.parseScalar(input.value):input.value);});
    return input;
  }
  function structuredControl(value,label){
    var input=document.createElement('textarea');input.className='field-input setting-input';input.rows=4;input.readOnly=true;input.setAttribute('aria-readonly','true');input.setAttribute('aria-label',label||'');input.dataset.controlKind='wide';
    try{input.value=JSON.stringify(value,null,2);}catch(_e){input.value=String(value);}
    return input;
  }
  function settingRow(def){
    var row=document.createElement('label');row.className='setting-row';row.dataset.settingKey=def.key;row.dataset.key=def.key;row.dataset.settingSpan=def.span==='full'?'full':'1';row.dataset.settingSearch=((def.title||'')+' '+(def.description||'')+' '+def.key).toLocaleLowerCase();
    row.append(copy(def.title,def.description),controlSlot(def.control));return row;
  }
  function preferenceRow(key,value,onChange){
    var info=describe(key,value),meta=info.meta,control;
    if(info.structured)control=structuredControl(value,info.title);
    else if(meta.enum)control=selectControl(value,meta.enum,function(v){onChange(key,v);},info.title);
    else if(info.kind==='boolean'||typeof value==='boolean')control=switchControl(value,function(v){onChange(key,v);},info.title);
    else{var display=toDisplay(key,value);control=inputControl(info.kind,display,function(v){onChange(key,toRaw(key,v));},info.title,meta,info.editable);}
    return settingRow({key:key,title:info.title,description:info.description,span:info.span,control:control});
  }
  function customRow(key,title,description,control,span){return settingRow({key:key,title:title,description:description,control:control,span:span||'1'});}
  function weiggValue(ctx,key,fallback){return own(ctx.weiggDraft,key)?ctx.weiggDraft[key]:fallback;}

  function languageRow(ctx){
    var I=W.I18n,setting=weiggValue(ctx,'language',I&&I.getSetting?I.getSetting():'auto'),options=[{value:'auto',label:text('Automatic (browser)','自动（浏览器）')},{value:'en',label:'English'},{value:'zh-CN',label:'简体中文'},{value:'zh-TW',label:'繁體中文'},{value:'ja',label:'日本語'},{value:'ko',label:'한국어'}];
    return customRow('weigg_language',text('Language','语言'),text('Follow the browser automatically; unsupported languages fall back to English.','自动跟随浏览器；不支持的语言自动回退英文。'),selectControl(setting,options,function(v){ctx.onWeiGChange('language',v);},text('Language','语言')));
  }
  function configSelectRow(ctx,key,title,description,options){var value=weiggValue(ctx,key,ctx.config[key]);return customRow('weigg_'+key,title,description,selectControl(value,options,function(v){ctx.onWeiGChange(key,v);},title));}
  function timezoneRow(ctx){
    var options=(W.Time?W.Time.zones():[{value:'system',label:'System / Browser'}]).map(function(x){return{value:x.value,label:W.Time?W.Time.displayLabel(x.value):x.label};}),value=weiggValue(ctx,'timezone',W.Time?W.Time.getZone():'system');
    return customRow('weigg_timezone',text('Display time zone','显示时区'),text('Changes date/log display only; qBittorrent and server time are unchanged.','只改变日期/日志显示，不修改 qBittorrent 或服务器时间。'),selectControl(value,options,function(v){ctx.onWeiGChange('timezone',v);},text('Display time zone','显示时区'),{searchable:true,searchThreshold:12,width:330}));
  }
  function trackerRulesRow(ctx){
    var value=weiggValue(ctx,'ptTrackers',ctx.config.ptTrackers||[]),input=inputControl('text',(value||[]).join(', '),function(v){ctx.onWeiGChange('ptTrackers',String(v).split(',').map(function(x){return x.trim();}).filter(Boolean));},text('PT Tracker rules','PT Tracker 规则'),{},true);input.dataset.controlKind='wide';
    return customRow('weigg_pt_trackers',text('PT Tracker rules','PT Tracker 规则'),text('Private metadata is resolved from qBittorrent; this optional list classifies PT by tracker domain, comma separated.','Private 状态由 qBittorrent 权威数据解析；这里仅按 Tracker 域名补充识别 PT，逗号分隔。'),input);
  }
  function renderWeiG(root,ctx){
    var s=section(text('Interface','界面'),text('Typography, density, pagination and visual behavior use one token system.','所有字体、密度、分页和视觉行为都由统一 Token 控制。'),'weigg');
    var rows=[languageRow(ctx),configSelectRow(ctx,'theme',text('Theme','主题'),text('Automatic follows the system; Smart auto uses local device time and switches Dark from 20:00 to 08:00.','自动模式跟随系统；智能自动使用设备当地时间，20:00–08:00 为深色。'),W.Theme.options()),configSelectRow(ctx,'fontSize',text('Font size','字体大小'),text('Global display preference.','统一全局设置'),[{value:'standard',label:text('Standard','标准')},{value:'large',label:text('Large (+2px)','大（+2px）')},{value:'xlarge',label:text('Extra large (+3px)','特大（+3px）')}]),configSelectRow(ctx,'density',text('Interface density','界面密度'),text('Global display preference.','统一全局设置'),[{value:'compact',label:text('Compact','紧凑')},{value:'standard',label:text('Standard','标准')},{value:'comfortable',label:text('Comfortable','宽松')}]),configSelectRow(ctx,'starfield',text('Starfield','星空'),text('Global display preference.','统一全局设置'),[{value:'off',label:text('Off','关闭')},{value:'subtle',label:text('Subtle','柔和')},{value:'full',label:text('Full','完整')}]),configSelectRow(ctx,'motion',text('Motion','动画'),text('Global display preference.','统一全局设置'),[{value:'system',label:text('Follow system','跟随系统')},{value:'reduced',label:text('Reduced','减少')},{value:'full',label:text('Full','完整')}]),configSelectRow(ctx,'pageSize',text('Torrents per page','每页 Torrent'),text('Global display preference.','统一全局设置'),[20,50,100,200].map(function(n){return{value:n,label:String(n)}})),configSelectRow(ctx,'refresh',text('Refresh interval','刷新频率'),text('Global display preference.','统一全局设置'),[1000,2000,5000,10000].map(function(n){return{value:n,label:(n/1000)+' '+text('s','秒')}})),trackerRulesRow(ctx),timezoneRow(ctx)];
    rows.forEach(function(r){s.grid.appendChild(r);});root.appendChild(s);
    var d=section(text('Performance','性能'),text('Developer/diagnostic information lives here instead of the main screen.','开发/诊断信息从主界面移到这里。'),'weigg-metrics');d.grid.classList.add('diagnostic-grid');
    var facts=[[text('Catalog cache','全库缓存'),ctx.app.catalog.length],[text('Current page data','当前页数据'),ctx.app.torrents.length],[text('Current DOM','当前 DOM'),ctx.app.virtual&&ctx.app.virtual.el&&ctx.app.virtual.el.dataset.rendered||'—'],[text('API page size','API 每页'),ctx.app.pageSize],[text('Refresh interval','刷新间隔'),ctx.config.refresh+' ms'],[text('Tracker index','Tracker 索引'),ctx.app.catalogReady?text('Ready','完成'):text('Building','构建中')]];
    facts.forEach(function(x){var f=document.createElement('div');f.className='diagnostic-fact';var a=document.createElement('span');a.textContent=x[0];var b=document.createElement('strong');b.textContent=x[1];f.append(a,b);d.grid.appendChild(f);});root.appendChild(d);
  }

  function filterControl(root){
    var filter=document.createElement('input');filter.className='field-input settings-filter';filter.placeholder=text('Filter preference keys…','筛选设置键…');
    filter.addEventListener('input',function(){var q=filter.value.toLocaleLowerCase();Array.from(root.querySelectorAll('.setting-row')).forEach(function(r){r.hidden=!!q&&String(r.dataset.settingSearch||'').indexOf(q)<0;});});
    return filter;
  }
  function renderQb(root,ctx){
    var tab=ctx.tab,prefs=ctx.prefs||{},groups=S.group(tab,prefs);
    if(tab==='advanced')root.appendChild(filterControl(root));
    var tt=TAB_TITLES[tab]||[tab,tab],subtitle=text('Only Preferences returned by this qBittorrent instance are shown.','只显示当前 qBittorrent 实际返回的 Preferences。');
    if(!groups.length){
      var empty=section(text(tt[0],tt[1]),subtitle,tab),p=document.createElement('p');p.className='settings-empty text-description';p.textContent=text('This qBittorrent version returned no settings in this group.','当前版本没有返回这一组设置。');empty.grid.appendChild(p);root.appendChild(empty);return;
    }
    groups.forEach(function(group){
      var s=section(group.title,subtitle,tab+':'+group.id);
      group.keys.forEach(function(key){var value=ctx.draft[key]!==undefined?ctx.draft[key]:prefs[key];s.grid.appendChild(preferenceRow(key,value,ctx.onDraft));});
      root.appendChild(s);
    });
  }
  function fact(label,value,href){
    var row=document.createElement('div');row.className='fact-row';var a=document.createElement('strong');a.textContent=label;var b=document.createElement('span');b.className='fact-value';b.textContent=value==null?'—':String(value);row.append(a,b);
    if(href){var l=document.createElement('a');l.className='btn btn--ghost fact-link';l.href=href;l.target='_blank';l.rel='noopener noreferrer';l.textContent='↗';l.setAttribute('aria-label',label);row.appendChild(l);}return row;
  }
  function renderAbout(root){
    var s=section(text('About','关于'),text('WeiG qB WebUI, qBittorrent and build information.','WeiG qB WebUI、qBittorrent 与构建信息。'),'about');s.classList.add('about-surface');var identity=W.Brand&&W.Brand.createIdentity?W.Brand.createIdentity():null;if(identity)s.insertBefore(identity,s.grid);s.grid.classList.add('fact-grid');
    var sha=(document.querySelector('meta[name="weigg-build-sha"]')||{}).content||'—';
    s.grid.append(fact(text('Version','版本'),controller.productVersion||'—'),fact('qBittorrent',(document.getElementById('qb-version')||{}).textContent||'—'),fact('Git SHA',sha),fact('WebAPI',(document.getElementById('api-version')||{}).textContent||'—'),fact('GitHub','weigefenxiang/WeiG-qB-WebUI','https://github.com/weigefenxiang/WeiG-qB-WebUI'),fact('Blog','WeiG Share','https://www.weigshare.com/'),fact(text('License','许可证'),'GNU GPL-3.0','https://github.com/weigefenxiang/WeiG-qB-WebUI/blob/main/LICENSE'));root.appendChild(s);
  }
  function render(ctx){
    var root=ctx.root;root.textContent='';root.dataset.settingsRenderer='canonical';var save=document.getElementById('save-settings-btn');if(save)save.hidden=ctx.tab==='about';
    if(ctx.tab==='weigg')renderWeiG(root,ctx);else if(ctx.tab==='about')renderAbout(root,ctx);else renderQb(root,ctx);
  }
  async function installMeta(){try{var r=await fetch('weigg-install.json',{cache:'no-store'});if(!r.ok)return null;return await r.json();}catch(_e){return null;}}
  async function validateBeforeSave(draft,prefs){
    draft=draft||{};prefs=prefs||{};
    if(Object.prototype.hasOwnProperty.call(draft,'alternative_webui_enabled')&&draft.alternative_webui_enabled===false){
      if(!global.confirm(text('Disable Alternate WebUI? This will immediately stop using WeiG qB WebUI.','确认关闭备用 Web UI？保存后会立即停止使用 WeiG qB WebUI。')))return false;
    }
    if(Object.prototype.hasOwnProperty.call(draft,'alternative_webui_path')&&String(draft.alternative_webui_path)!==String(prefs.alternative_webui_path||'')){
      var meta=await installMeta(),value=String(draft.alternative_webui_path||'').replace(/[\\/]+$/,'');
      if(meta&&meta.hostPath&&value===String(meta.hostPath).replace(/[\\/]+$/,'')){W.toast(text('Use the path visible inside qBittorrent/container, not the host path.','这里应填写 qBittorrent/容器内可见路径，不能填写宿主机路径。'),'error',{title:text('Invalid WebUI path','WebUI 路径无效')});return false;}
      if(!global.confirm(text('Change the Alternate WebUI path? An incorrect path can make the WebUI unavailable.','确认修改备用 Web UI 路径？错误路径可能导致 WebUI 无法访问。')))return false;
    }
    return true;
  }

  var controller={prefs:null,draft:{},weiggDraft:{},tab:'weigg',config:null,loading:false,productVersion:null,versionTask:null};
  function sharedClient(){var app=W.AppState;if(app&&app.client)return app.client;throw new Error(text('qBittorrent client is not ready.','qBittorrent 客户端尚未就绪。'));}
  function controllerApp(){var state=W.AppState||{};return{catalog:Array.isArray(state.catalog)?state.catalog:[],torrents:Array.isArray(state.torrents)?state.torrents:[],virtual:state.virtual||{el:document.getElementById('torrent-list')||{}},pageSize:Number(state.pageSize||(controller.config&&controller.config.pageSize)||50),catalogReady:!!state.catalogReady};}
  function onWeiGChange(key,value){controller.config=controller.config||W.Config.load();if(key==='pageSize'||key==='refresh')value=Number(value);controller.weiggDraft[key]=value;renderOwned();}
  function ctx(){return{root:document.getElementById('settings-content'),tab:controller.tab,prefs:controller.prefs||{},draft:controller.draft,weiggDraft:controller.weiggDraft,config:controller.config||W.Config.load(),app:controllerApp(),onDraft:function(key,value){controller.draft[key]=value;},onWeiGChange:onWeiGChange};}
  function activeTab(tab){Array.from(document.querySelectorAll('#settings-tabs [data-settings-tab]')).forEach(function(b){b.classList.toggle('is-active',b.dataset.settingsTab===tab);});}
  function renderOwned(){var root=document.getElementById('settings-content');if(!root)return;activeTab(controller.tab);render(ctx());global.dispatchEvent(new CustomEvent('weigg:settings-render',{detail:{tab:controller.tab}}));}
  async function ensureProductVersion(){if(controller.productVersion)return controller.productVersion;if(controller.versionTask)return controller.versionTask;controller.versionTask=(async function(){var meta=await installMeta();controller.productVersion=meta&&meta.version?String(meta.version):'—';return controller.productVersion;})().finally(function(){controller.versionTask=null;});return controller.versionTask;}
  async function ensurePrefs(){if(controller.prefs||controller.loading)return;controller.loading=true;try{controller.prefs=await sharedClient().getPreferences();}catch(e){if(W.toast)W.toast(text('Failed to read settings: ','读取设置失败：')+(e.message||e),'error',{title:text('Settings unavailable','设置读取失败')});}finally{controller.loading=false;}}
  async function openOwned(tab){controller.config=controller.config||W.Config.load();if(tab)controller.tab=tab;if(controller.tab==='about')await ensureProductVersion();else if(controller.tab!=='weigg')await ensurePrefs();renderOwned();}
  function applyWeiGRuntime(pending,nextConfig){Object.keys(pending).forEach(function(key){var value=pending[key];if(key==='language'){if(W.I18n&&W.I18n.setLocale)W.I18n.setLocale(value);return;}if(key==='timezone'){if(W.Time&&W.Time.setZone)W.Time.setZone(value);return;}if(W.LibraryController&&W.LibraryController.applyRuntimeConfig)W.LibraryController.applyRuntimeConfig(key,value);try{global.dispatchEvent(new CustomEvent('weigg:configchange',{detail:{key:key,value:value}}));}catch(_e){}});W.Config.apply(nextConfig);}
  async function saveWeiG(){
    var keys=Object.keys(controller.weiggDraft);if(!keys.length){if(W.toast)W.toast(text('No WeiG settings to save.','没有需要保存的 WeiG 设置'),'info',{title:text('No changes','没有更改')});return;}
    var pending=Object.assign({},controller.weiggDraft),next=Object.assign({},controller.config||W.Config.load());keys.forEach(function(key){if(key!=='language'&&key!=='timezone')next[key]=pending[key];});
    try{W.Config.save(next);controller.config=next;controller.weiggDraft={};applyWeiGRuntime(pending,next);if(W.toast)W.toast(text('WeiG settings saved.','WeiG 设置已保存'),'success',{title:text('Settings saved','设置已保存')});renderOwned();}
    catch(e){if(W.toast)W.toast(text('Save failed: ','保存失败：')+(e.message||e),'error',{title:text('Settings save failed','设置保存失败')});}
  }
  async function saveQb(){
    if(!Object.keys(controller.draft).length){if(W.toast)W.toast(text('No qB settings to save.','没有需要保存的 qB 设置'),'info',{title:text('No changes','没有更改')});return;}
    if(!(await validateBeforeSave(controller.draft,controller.prefs||{})))return;
    var pending=Object.assign({},controller.draft),notice=W.toast?W.toast(text('Writing qBittorrent preferences.','正在写入 qBittorrent 设置。'),'info',{title:text('Saving settings','正在保存设置'),duration:0}):null;
    try{
      var client=sharedClient();await client.setPreferences(pending);controller.prefs=Object.assign({},controller.prefs||{},pending);controller.draft={};
      try{controller.prefs=await client.getPreferences();if(notice)notice.update(text('qBittorrent settings were saved and verified.','qBittorrent 设置已保存并完成回读确认。'),'success',{title:text('Settings saved','设置已保存')});}
      catch(readError){if(notice)notice.update(text('Settings were written, but the verification read failed: ','设置已写入，但回读确认失败：')+(readError.message||readError),'warning',{title:text('Saved; verification unavailable','已保存，暂时无法确认')});}
      renderOwned();
    }catch(e){if(notice)notice.update(text('Save failed: ','保存失败：')+(e.message||e),'error',{title:text('Settings save failed','设置保存失败')});else if(W.toast)W.toast(text('Save failed: ','保存失败：')+(e.message||e),'error');}
  }
  async function saveOwned(){if(controller.tab==='about')return;if(controller.tab==='weigg')return saveWeiG();return saveQb();}
  function installController(){
    controller.config=W.Config.load();
    document.addEventListener('click',function(e){
      var tab=e.target&&e.target.closest&&e.target.closest('#settings-tabs [data-settings-tab]');
      if(tab){e.preventDefault();e.stopImmediatePropagation();controller.tab=tab.dataset.settingsTab||'weigg';openOwned(controller.tab);return;}
      var save=e.target&&e.target.closest&&e.target.closest('#save-settings-btn');if(save){e.preventDefault();e.stopImmediatePropagation();saveOwned();}
    },true);
  }

  W.SettingsState=controller;
  W.ControlRegistry={switchControl:switchControl,selectControl:selectControl,inputControl:inputControl};
  W.SettingsRenderer={render:render,validateBeforeSave:validateBeforeSave,groups:S.sectionOrder,preferenceRow:preferenceRow,settingRow:settingRow,open:openOwned,save:saveOwned};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installController,{once:true});else installController();
})(window);

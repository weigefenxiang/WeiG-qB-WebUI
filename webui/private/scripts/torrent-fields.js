(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{},U=W.util||{};
  if(W.TorrentFieldRegistry)return;
  var MODES={NATIVE:'NATIVE',NORMALIZED:'NORMALIZED',DERIVED:'DERIVED',READ_ONLY:'READ_ONLY',UNAVAILABLE:'UNAVAILABLE',UNKNOWN:'UNKNOWN'};
  var DEFAULT_MOBILE=['state','progress','size','dlspeed','upspeed','eta'];
  var DEFAULT_DESKTOP=['name','size','progress','dlspeed','upspeed','eta','state'];
  function formatTime(value){var n=Number(value);if(!Number.isFinite(n)||n<=0)return'—';var ms=n<1e12?n*1000:n;try{return W.Time&&W.Time.format?W.Time.format(ms,{dateStyle:'short',timeStyle:'short'}):new Date(ms).toLocaleString();}catch(_e){return new Date(ms).toLocaleString();}}
  var FIELDS=[
    {key:'name',sort:'name',en:'Name',zh:'名称',short:'Name',width:420,min:220},
    {key:'size',sort:'size',en:'Size',zh:'大小',short:'Size',width:105,min:80,format:function(t){return U.formatBytes(t.size);}},
    {key:'progress',sort:'progress',en:'Progress',zh:'进度',short:'%',width:220,min:145,format:function(t){return U.percent(t.progress)+'%';}},
    {key:'dlspeed',sort:'dlspeed',en:'Download',zh:'下载',short:'↓',width:110,min:86,configAliases:['dl'],format:function(t){return '↓ '+U.formatSpeed(t.dlspeed);}},
    {key:'upspeed',sort:'upspeed',en:'Upload',zh:'上传',short:'↑',width:110,min:86,configAliases:['up'],format:function(t){return '↑ '+U.formatSpeed(t.upspeed);}},
    {key:'eta',sort:'eta',en:'ETA',zh:'ETA',short:'ETA',width:90,min:70,format:function(t){return 'ETA '+U.formatEta(t.eta);}},
    {key:'state',sort:'state',en:'Status',zh:'状态',short:'State',width:125,min:96,configAliases:['status'],format:function(t){var C=W.Components,s=C&&C.state?C.state(t.state):null;return s?s[0]:String(t.state||'—');}},
    {key:'ratio',sort:'ratio',en:'Ratio',zh:'Ratio',short:'R',width:90,min:70,format:function(t){return 'R '+U.formatRatio(t.ratio);}},
    {key:'tracker',sort:'tracker',en:'Tracker',zh:'Tracker',short:'Tracker',width:165,min:110,format:function(t){return U.trackerLabel(t.tracker);}},
    {key:'category',sort:'category',en:'Category',zh:'分类',short:'Cat',width:130,min:90,format:function(t){return t.category||'—';}},
    {key:'tags',sort:'tags',en:'Tags',zh:'标签',short:'Tags',width:150,min:100,format:function(t){return t.tags||'—';}},
    {key:'num_seeds',sort:'num_seeds',en:'Seeds',zh:'做种数',short:'S',width:90,min:68,format:function(t){return 'S '+(Number.isFinite(Number(t.num_seeds))?Number(t.num_seeds):0);}},
    {key:'num_leechs',sort:'num_leechs',en:'Peers',zh:'下载数',short:'P',width:90,min:68,format:function(t){return 'P '+(Number.isFinite(Number(t.num_leechs))?Number(t.num_leechs):0);}},
    {key:'save_path',sort:'save_path',en:'Save path',zh:'保存路径',short:'Path',width:220,min:130,format:function(t){return t.save_path||'—';}},
    {key:'added_on',sort:'added_on',en:'Added',zh:'添加时间',short:'Added',width:160,min:115,format:function(t){return formatTime(t.added_on);}},
    {key:'completion_on',sort:'completion_on',en:'Completed',zh:'完成时间',short:'Done',width:160,min:115,format:function(t){return formatTime(t.completion_on);}},
    {key:'priority',sort:'priority',en:'Priority',zh:'优先级',short:'Prio',width:92,min:70,format:function(t){var n=Number(t.priority);return Number.isFinite(n)?String(n):'—';}}
  ];
  var FIELD_MAP={};FIELDS.forEach(function(f){FIELD_MAP[f.key]=f;(f.configAliases||[]).forEach(function(alias){FIELD_MAP[alias]=f;});});
  function canonical(key){var f=FIELD_MAP[String(key||'')];return f&&f.key||null;}
  function label(field){field=typeof field==='string'?FIELD_MAP[field]:field;if(!field)return'';var zh=!!(W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN');return zh?(field.zh||field.en||field.key):(field.en||field.zh||field.key);}
  function profileFields(profile){return profile&&Array.isArray(profile.torrentInfoFields)?profile.torrentInfoFields.map(String):null;}
  function currentProfile(){return W.ReleaseProfile&&W.ReleaseProfile.current?W.ReleaseProfile.current():null;}
  function normalizeSpec(spec){if(typeof spec==='string')spec={key:spec};spec=spec||{};return{key:String(spec.key||''),source:String(spec.source||spec.key||''),sourceAliases:Array.isArray(spec.sourceAliases)?spec.sourceAliases.map(String):[],derivedFrom:Array.isArray(spec.derivedFrom)?spec.derivedFrom.map(String):[]};}
  function resolveProvenance(spec,profile){var s=normalizeSpec(spec),p=profile===undefined?currentProfile():profile,fields=profileFields(p);if(!s.key)return{field:s.key,mode:MODES.UNKNOWN};if(!p||p.fallback===true||p.officialWeiGSupport===false||!fields)return{field:s.key,mode:MODES.UNKNOWN};if(s.source&&fields.indexOf(s.source)>=0)return{field:s.key,mode:MODES.NATIVE,sourceField:s.source};for(var i=0;i<s.sourceAliases.length;i++)if(fields.indexOf(s.sourceAliases[i])>=0)return{field:s.key,mode:MODES.NORMALIZED,sourceField:s.sourceAliases[i]};if(s.derivedFrom.length&&s.derivedFrom.every(function(key){return fields.indexOf(key)>=0;}))return{field:s.key,mode:MODES.DERIVED,derivedFrom:s.derivedFrom.slice()};return{field:s.key,mode:MODES.UNAVAILABLE};}
  function provenance(key,profile){var f=FIELD_MAP[String(key||'')];if(!f)return{field:String(key||''),mode:MODES.UNKNOWN};return resolveProvenance(f,profile);}
  function isAvailable(key,profile){var mode=provenance(key,profile).mode;return mode===MODES.NATIVE||mode===MODES.NORMALIZED||mode===MODES.DERIVED||mode===MODES.READ_ONLY;}
  function effectiveFields(profile){var p=profile===undefined?currentProfile():profile;if(!p)return FIELDS.slice();return FIELDS.filter(function(f){return isAvailable(f.key,p);});}
  function savedMobileFields(){var cfg=W.Config&&W.Config.load?W.Config.load():{},raw=Array.isArray(cfg.mobileFields)?cfg.mobileFields:[],out=[];raw.forEach(function(k){var c=canonical(k);if(c&&c!=='name'&&out.indexOf(c)<0)out.push(c);});return out.length?out:DEFAULT_MOBILE.slice();}
  function effectiveMobileFields(profile){var saved=savedMobileFields(),p=profile===undefined?currentProfile():profile;if(!p)return saved;return saved.filter(function(key){return isAvailable(key,p);});}
  function saveRawMobileFields(fields){var cfg=W.Config.load(),out=[];(fields||[]).forEach(function(k){var c=canonical(k);if(c&&c!=='name'&&out.indexOf(c)<0)out.push(c);});cfg.mobileFields=out;W.Config.save(cfg);return out;}
  function saveEffectiveMobileFields(fields,profile){var p=profile===undefined?currentProfile():profile,previous=savedMobileFields(),hidden=p?previous.filter(function(key){return !isAvailable(key,p);}):[],next=[];(fields||[]).concat(hidden).forEach(function(k){var c=canonical(k);if(c&&c!=='name'&&next.indexOf(c)<0)next.push(c);});return saveRawMobileFields(next);}
  function column(field){field=typeof field==='string'?FIELD_MAP[field]:field;if(!field)return null;return{key:field.key,label:label(field),width:field.width,min:field.min,sort:field.sort};}
  function normalizeColumnPreferences(raw){var out=[],seen={};(raw||[]).forEach(function(item){item=typeof item==='string'?{key:item}:item||{};var c=canonical(item.key);if(!c||seen[c])return;seen[c]=true;var pref={key:c};if(Number.isFinite(Number(item.width)))pref.width=Number(item.width);out.push(pref);});return out;}
  function defaultDesktopPreferences(){return DEFAULT_DESKTOP.map(function(key){return{key:key};});}
  function savedDesktopColumns(cfg){cfg=cfg||{};var raw=Array.isArray(cfg.columns)&&cfg.columns.length?cfg.columns:defaultDesktopPreferences();return normalizeColumnPreferences(raw);}
  function decorateColumnPreference(pref){var def=FIELD_MAP[pref&&pref.key],out=column(def);if(!out)return null;if(Number.isFinite(Number(pref.width)))out.width=Number(pref.width);return out;}
  function effectiveDesktopColumns(cfg,profile){var p=profile===undefined?currentProfile():profile,saved=savedDesktopColumns(cfg),out=saved.filter(function(pref){return !p||isAvailable(pref.key,p);}).map(decorateColumnPreference).filter(Boolean);if(out.length||p)return out;return saved.map(decorateColumnPreference).filter(Boolean);}
  function availableColumnDefinitions(profile){return effectiveFields(profile).map(column).filter(Boolean);}
  function serializeColumns(cols){return normalizeColumnPreferences((cols||[]).map(function(c){return{key:c&&c.key,width:c&&c.width};}));}
  function saveRawDesktopColumns(cfg,cols){cfg=cfg||{};cfg.columns=serializeColumns(cols);if(W.Config&&W.Config.save)W.Config.save(cfg);return cfg.columns;}
  function saveEffectiveDesktopColumns(cfg,cols,profile){var p=profile===undefined?currentProfile():profile,previous=savedDesktopColumns(cfg),effective=serializeColumns(cols),queue=effective.slice(),next=[];previous.forEach(function(pref){if(p&&!isAvailable(pref.key,p)){next.push(pref);return;}if(queue.length)next.push(queue.shift());});next=next.concat(queue);saveRawDesktopColumns(cfg,next);return effectiveDesktopColumns(cfg,p);}
  function resetDesktopColumns(cfg,profile){saveRawDesktopColumns(cfg,defaultDesktopPreferences());return effectiveDesktopColumns(cfg,profile);}
  function syncDataGrid(){if(!W.DataGrid)return[];W.DataGrid.defaults=FIELDS.map(column);return W.DataGrid.defaults;}
  var api={modes:MODES,fields:FIELDS,get:function(key){return FIELD_MAP[String(key||'')]||null;},canonical:canonical,label:label,column:column,syncDataGrid:syncDataGrid,resolveProvenance:resolveProvenance,provenance:provenance,isAvailable:isAvailable,effectiveFields:effectiveFields,savedMobileFields:savedMobileFields,mobileFields:effectiveMobileFields,effectiveMobileFields:effectiveMobileFields,saveMobileFields:saveRawMobileFields,saveEffectiveMobileFields:saveEffectiveMobileFields,savedDesktopColumns:savedDesktopColumns,effectiveDesktopColumns:effectiveDesktopColumns,availableColumnDefinitions:availableColumnDefinitions,saveRawDesktopColumns:saveRawDesktopColumns,saveEffectiveDesktopColumns:saveEffectiveDesktopColumns,resetDesktopColumns:resetDesktopColumns};
  W.TorrentFieldRegistry=api;
  syncDataGrid();
})(window);

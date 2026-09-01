(function(global){
  'use strict';
  var W=global.WeiG,C=W&&W.Components,U=W&&W.util;
  if(!W||!C||!U||C.__advancedV036)return;
  C.__advancedV036=true;

  /* SETTING-UNIT-001 — only source-verified qB preference units/conversions live here. */
  var META={
    slow_torrent_inactive_timer:{unit:'s'},
    slow_torrent_dl_rate_threshold:{unit:'KiB/s'},
    slow_torrent_ul_rate_threshold:{unit:'KiB/s'},
    send_buffer_watermark:{unit:'KiB'},
    send_buffer_low_watermark:{unit:'KiB'},
    send_buffer_watermark_factor:{unit:'%'},
    socket_backlog_size:{unit:'connections'},
    socket_receive_buffer_size:{unit:'KiB',scale:1024,zero:'System default'},
    socket_send_buffer_size:{unit:'KiB',scale:1024,zero:'System default'},
    stop_tracker_timeout:{unit:'s',zero:'Disabled'},
    upnp_lease_duration:{unit:'s',zero:'Permanent lease'},
    torrent_file_size_limit:{unit:'MiB',scale:1048576},
    disk_queue_size:{unit:'KiB',scale:1024},
    memory_working_set_limit:{unit:'MiB'},
    checking_memory_use:{unit:'MiB'},
    save_resume_data_interval:{unit:'min',zero:'Disabled'},
    save_statistics_interval:{unit:'min',zero:'Disabled'},
    disk_cache_ttl:{unit:'s'},
    hostname_cache_ttl:{unit:'s'},
    refresh_interval:{unit:'ms'},
    async_io_threads:{unit:'threads'},
    file_pool_size:{unit:'files'},
    max_concurrent_http_announces:{unit:'requests'},
    connection_speed:{unit:'connections/s'},
    outgoing_ports_min:{unit:'port',zero:'Disabled'},
    outgoing_ports_max:{unit:'port',zero:'Disabled'},
    announce_port:{unit:'port',zero:'Disabled'},
    ssl_listen_port:{unit:'port'},
    web_ui_port:{unit:'port'},
    torrent_content_remove_option:{enum:[
      {value:'Delete',label:'Delete files permanently'},
      {value:'MoveToTrash',label:'Move files to trash (if possible)'}
    ]}
  };

  function toDisplay(key,raw){var meta=META[key];if(!meta||!meta.scale)return raw;var n=Number(raw);if(!Number.isFinite(n))return raw;return n/meta.scale;}
  function toRaw(key,display){var meta=META[key],n=Number(display);if(!meta||!meta.scale)return U.parseScalar(display);if(!Number.isFinite(n))return display;return Math.round(n*meta.scale);}
  function titleWithUnit(title,meta){title=String(title||'');if(!meta||!meta.unit)return title;var suffix=' ('+meta.unit+')';if(title.endsWith(suffix))return title;title=title.replace(/\s+\((?:B|KiB|MiB|GiB|TiB|PiB|s|ms|min|%|port|connections|connections\/s|threads|files|requests|KiB\/s)\)$/,'');return title+suffix;}
  function descriptionWithSpecial(description,meta){description=String(description||'qBittorrent preference.');if(meta&&meta.zero&&description.indexOf('0 = ')<0)description+=' · 0 = '+meta.zero+'.';return description;}
  function makeCard(key,title,description){var row=document.createElement('label');row.className='settings-row setting-card';row.dataset.settingKey=key;row.dataset.settingSearch=(title+' '+description+' '+key).toLowerCase();var copy=document.createElement('span');copy.className='settings-row__copy';var strong=document.createElement('strong');strong.textContent=title;strong.title=title;var small=document.createElement('small');small.className='text-description';small.textContent=description;copy.append(strong,small);row.appendChild(copy);return row;}
  function enumCard(key,value,onChange,info,meta){var title=titleWithUnit(info.title||key,meta),description=descriptionWithSpecial(info.description,meta),row=makeCard(key,title,description);var select=C.selectControl({value:String(value==null?'':value),options:meta.enum,ariaLabel:title,onChange:function(next){var hit=meta.enum.find(function(x){return String(x.value)===String(next);});onChange(key,hit?hit.value:next);}});row.appendChild(select);return row;}
  function numericCard(key,value,onChange,info,meta){var title=titleWithUnit(info.title||key,meta),description=descriptionWithSpecial(info.description,meta),row=makeCard(key,title,description);var input=document.createElement('input');input.type='number';input.className='field-input';input.autocomplete='off';input.value=String(toDisplay(key,value));input.dataset.apiUnit=meta.scale?'bytes':(meta.unit||'');input.dataset.displayUnit=meta.unit||'';if(meta.scale)input.step=meta.unit==='MiB'||meta.unit==='KiB'?'0.01':'1';input.addEventListener('change',function(){onChange(key,toRaw(key,input.value));});row.appendChild(input);return row;}

  var base=C.preferenceField;
  C.preferenceField=function(key,value,onChange,label){
    var meta=META[key];if(!meta)return base.apply(this,arguments);var info=W.SettingsSchema?W.SettingsSchema.describe(key):{title:label||key,description:'qBittorrent preference.',kind:typeof value==='number'?'number':'auto'};
    if(meta.enum)return enumCard(key,value,onChange,info,meta);if(typeof value==='number'||info.kind==='number')return numericCard(key,value,onChange,info,meta);
    var row=base.apply(this,arguments),title=row.querySelector('.settings-row__copy strong'),desc=row.querySelector('.settings-row__copy small');if(title){title.textContent=titleWithUnit(title.textContent,meta);title.title=title.textContent;}if(desc)desc.textContent=descriptionWithSpecial(desc.textContent,meta);return row;
  };
  W.AdvancedSettingsV036={meta:META,toDisplay:toDisplay,toRaw:toRaw,titleWithUnit:titleWithUnit};

  /* v0.3.7 loads as a modular overlay after the verified v0.3.6 preference layer. */
  function loadV037Runtime(){
    if(typeof document==='undefined')return;
    if(W.V037||document.querySelector('script[data-weigg-layer="v037"]'))return;
    var startRuntime=function(){if(W.V037||document.querySelector('script[data-weigg-layer="v037"]'))return;var runtime=document.createElement('script');runtime.async=false;runtime.dataset.weiggLayer='v037';runtime.src=W.buildAssetUrl?W.buildAssetUrl('scripts/v037.js'):'scripts/v037.js';document.head.appendChild(runtime);};
    if(W.SettingsOfficialV037){startRuntime();return;}var existing=document.querySelector('script[data-weigg-layer="settings-official-v037"]');if(existing){existing.addEventListener('load',startRuntime,{once:true});return;}var translations=document.createElement('script');translations.async=false;translations.dataset.weiggLayer='settings-official-v037';translations.src=W.buildAssetUrl?W.buildAssetUrl('translations/settings-official-v037.js'):'translations/settings-official-v037.js';translations.onload=startRuntime;document.head.appendChild(translations);
  }
  loadV037Runtime();
})(window);

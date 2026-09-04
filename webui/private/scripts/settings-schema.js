(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};

  var SURFACES=['downloads','connection','bittorrent','webui','advanced'];
  var SECTION_ORDER={
    downloads:['adding','paths','management','files','automation'],
    connection:['listening','limits','proxy','i2p','ipfilter','network'],
    bittorrent:['privacy','queue','seeding','tracker','peer'],
    webui:['server','auth','security','reverseProxy','headers','alternative'],
    advanced:['bandwidth','disk','libtorrent','rss','dyndns','mail','logging','system','security','upstream']
  };
  var SECTION_TITLES={
    adding:['Adding torrents','添加 Torrent'],paths:['Paths and storage','路径与保存'],management:['Automatic management','自动管理'],files:['Files','文件规则'],automation:['Automation','自动任务'],
    listening:['Listening','监听'],limits:['Connection limits','连接限制'],proxy:['Proxy','代理'],i2p:['I2P','I2P'],ipfilter:['IP filtering','IP 过滤'],network:['Network','网络'],
    privacy:['Protocol and privacy','协议与隐私'],queue:['Queue','队列'],seeding:['Seeding','做种'],tracker:['Tracker / Announce','Tracker / Announce'],peer:['Peer / Transport','Peer / 传输'],
    server:['Server','服务器'],auth:['Authentication','认证'],security:['Security','安全'],reverseProxy:['Reverse Proxy','Reverse Proxy'],headers:['HTTP Headers','HTTP Headers'],alternative:['Alternative WebUI','备用 WebUI'],
    bandwidth:['Bandwidth / transfer policy','带宽与传输策略'],disk:['Disk / I/O','磁盘 / I/O'],libtorrent:['libtorrent','libtorrent'],rss:['RSS','RSS'],dyndns:['Dynamic DNS','动态 DNS'],mail:['Mail notification','邮件通知'],logging:['Logging','日志'],system:['System / behavior','系统 / 行为'],upstream:['Upstream settings','上游新增设置']
  };

  var META={
    listen_port:{unit:'port'},max_connec:{unit:'connections',minusOne:'Unlimited'},max_connec_per_torrent:{unit:'connections',minusOne:'Unlimited'},
    max_uploads:{unit:'slots',minusOne:'Unlimited'},max_uploads_per_torrent:{unit:'slots',minusOne:'Unlimited'},proxy_port:{unit:'port'},
    dl_limit:{unit:'KiB/s',scale:1024,zero:'Unlimited'},up_limit:{unit:'KiB/s',scale:1024,zero:'Unlimited'},alt_dl_limit:{unit:'KiB/s',scale:1024,zero:'Unlimited'},alt_up_limit:{unit:'KiB/s',scale:1024,zero:'Unlimited'},
    max_active_downloads:{unit:'torrents',minusOne:'Unlimited'},max_active_uploads:{unit:'torrents',minusOne:'Unlimited'},max_active_torrents:{unit:'torrents',minusOne:'Unlimited'},
    max_ratio:{unit:'ratio'},max_seeding_time:{unit:'min'},max_inactive_seeding_time:{unit:'min'},web_ui_port:{unit:'port'},web_ui_max_auth_fail_count:{unit:'attempts'},web_ui_ban_duration:{unit:'s'},web_ui_session_timeout:{unit:'s'},
    slow_torrent_inactive_timer:{unit:'s'},slow_torrent_dl_rate_threshold:{unit:'KiB/s'},slow_torrent_ul_rate_threshold:{unit:'KiB/s'},
    send_buffer_watermark:{unit:'KiB'},send_buffer_low_watermark:{unit:'KiB'},send_buffer_watermark_factor:{unit:'%'},
    socket_backlog_size:{unit:'connections'},socket_receive_buffer_size:{unit:'KiB',scale:1024,zero:'System default'},socket_send_buffer_size:{unit:'KiB',scale:1024,zero:'System default'},
    stop_tracker_timeout:{unit:'s',zero:'Disabled'},upnp_lease_duration:{unit:'s',zero:'Permanent lease'},torrent_file_size_limit:{unit:'MiB',scale:1048576},
    disk_queue_size:{unit:'KiB',scale:1024},memory_working_set_limit:{unit:'MiB'},checking_memory_use:{unit:'MiB'},save_resume_data_interval:{unit:'min',zero:'Disabled'},save_statistics_interval:{unit:'min',zero:'Disabled'},
    disk_cache_ttl:{unit:'s'},hostname_cache_ttl:{unit:'s'},refresh_interval:{unit:'ms'},async_io_threads:{unit:'threads'},hashing_threads:{unit:'threads'},file_pool_size:{unit:'files'},
    max_concurrent_http_announces:{unit:'requests'},connection_speed:{unit:'connections/s'},outgoing_ports_min:{unit:'port',zero:'Disabled'},outgoing_ports_max:{unit:'port',zero:'Disabled'},
    announce_port:{unit:'port',zero:'Disabled'},ssl_listen_port:{unit:'port'},
    torrent_content_remove_option:{enum:[{value:'Delete',label:'Delete files permanently'},{value:'MoveToTrash',label:'Move files to trash (if possible)'}]},
    upload_slots_behavior:{enum:[{value:0,label:'Fixed slots'},{value:1,label:'Upload rate based'}]},
    upload_choking_algorithm:{enum:[{value:0,label:'Round-robin'},{value:1,label:'Fastest upload'},{value:2,label:'Anti-leech'}]},
    utp_tcp_mixed_mode:{enum:[{value:0,label:'Prefer TCP'},{value:1,label:'Peer proportional'}]},
    torrent_stop_condition:{enum:[{value:'None',label:'None'},{value:'MetadataReceived',label:'Metadata received'},{value:'FilesChecked',label:'Files checked'}]},
    proxy_type:{enum:[{value:-1,label:'Disabled'},{value:0,label:'Disabled'},{value:1,label:'HTTP'},{value:2,label:'SOCKS5'},{value:3,label:'HTTP + authentication'},{value:4,label:'SOCKS5 + authentication'},{value:5,label:'SOCKS4'}]},
    encryption:{enum:[{value:0,label:'Prefer encryption'},{value:1,label:'Force encryption on'},{value:2,label:'Force encryption off'}]}
  };

  var schema={};
  function add(surface,section,kind,keys,extra){
    keys.forEach(function(key){schema[key]=Object.assign({surface:surface,section:section,kind:kind||'auto'},extra||{});});
  }

  add('downloads','adding','boolean',['preallocate_all','create_subfolder_enabled','start_paused_enabled','add_stopped_enabled','add_to_top_of_queue','incomplete_files_ext','use_unwanted_folder']);
  add('downloads','adding','text',['torrent_content_layout','torrent_stop_condition']);
  add('downloads','adding','number',['auto_delete_mode']);
  add('downloads','paths','path',['save_path','temp_path','export_dir','export_dir_fin']);
  add('downloads','paths','boolean',['temp_path_enabled']);
  add('downloads','management','boolean',['auto_tmm_enabled','torrent_changed_tmm_enabled','save_path_changed_tmm_enabled','category_changed_tmm_enabled','use_category_paths_in_manual_mode']);
  add('downloads','files','structured',['scan_dirs'],{editable:false});
  add('downloads','files','boolean',['excluded_file_names_enabled','delete_torrent_content_files']);
  add('downloads','files','text',['excluded_file_names','torrent_content_remove_option']);
  add('downloads','files','number',['torrent_file_size_limit']);
  add('downloads','automation','boolean',['autorun_enabled','autorun_on_torrent_added_enabled']);
  add('downloads','automation','text',['autorun_program','autorun_on_torrent_added_program']);

  add('connection','listening','number',['listen_port','ssl_listen_port']);
  add('connection','listening','boolean',['upnp','random_port','ssl_enabled']);
  add('connection','limits','number',['max_connec','max_connec_per_torrent','max_uploads','max_uploads_per_torrent']);
  add('connection','proxy','auto',['proxy_type','proxy_ip','proxy_port','proxy_username','proxy_password','proxy_auth_enabled','proxy_hostname_lookup','proxy_bittorrent','proxy_peer_connections','proxy_rss','proxy_misc','proxy_torrents_only']);
  add('connection','i2p','auto',['i2p_enabled','i2p_address','i2p_port','i2p_mixed_mode','i2p_inbound_quantity','i2p_outbound_quantity','i2p_inbound_length','i2p_outbound_length']);
  add('connection','ipfilter','auto',['ip_filter_enabled','ip_filter_path','ip_filter_trackers','banned_IPs','banned_ips']);
  add('connection','network','auto',['connection_speed','socket_backlog_size','socket_receive_buffer_size','socket_send_buffer_size','outgoing_ports_min','outgoing_ports_max','upnp_lease_duration','peer_tos','hostname_cache_ttl','current_interface_address','current_interface_name','reannounce_when_address_changed']);

  add('bittorrent','privacy','auto',['dht','pex','lsd','encryption','anonymous_mode','bittorrent_protocol']);
  add('bittorrent','queue','auto',['queueing_enabled','max_active_downloads','max_active_uploads','max_active_torrents','max_active_checking_torrents','dont_count_slow_torrents','slow_torrent_dl_rate_threshold','slow_torrent_ul_rate_threshold','slow_torrent_inactive_timer']);
  add('bittorrent','seeding','auto',['max_ratio','max_ratio_enabled','max_ratio_act','max_seeding_time','max_seeding_time_enabled','max_seeding_time_act','max_inactive_seeding_time','max_inactive_seeding_time_enabled']);
  add('bittorrent','tracker','auto',['add_trackers','add_trackers_enabled','add_trackers_from_url_enabled','add_trackers_url','add_trackers_url_list','merge_trackers','announce_to_all_tiers','announce_to_all_trackers','announce_ip','announce_port','max_concurrent_http_announces','stop_tracker_timeout','embedded_tracker_port','embedded_tracker_port_forwarding','enable_embedded_tracker','validate_https_tracker_certificate','tracker_exchange_enabled']);
  add('bittorrent','peer','auto',['enable_multi_connections_from_same_ip','block_peers_on_privileged_ports','peer_turnover','peer_turnover_cutoff','peer_turnover_interval','request_queue_size','upload_slots_behavior','upload_choking_algorithm','utp_tcp_mixed_mode','resolve_peer_countries','resolve_peer_host_names']);

  add('webui','server','auto',['web_ui_address','web_ui_port','web_ui_upnp','use_https','web_ui_https_cert_path','web_ui_https_key_path','ssl_cert','ssl_key']);
  add('webui','auth','auto',['web_ui_username','web_ui_password','web_ui_max_auth_fail_count','web_ui_ban_duration','web_ui_session_timeout','web_ui_api_key','web_ui_localhost_auth_enabled','bypass_local_auth','bypass_auth_subnet_whitelist_enabled','bypass_auth_subnet_whitelist']);
  add('webui','security','auto',['web_ui_csrf_protection_enabled','web_ui_clickjacking_protection_enabled','web_ui_host_header_validation_enabled','web_ui_secure_cookie_enabled']);
  add('webui','reverseProxy','auto',['web_ui_reverse_proxy_enabled','web_ui_reverse_proxies_list']);
  add('webui','headers','auto',['web_ui_use_custom_http_headers_enabled','web_ui_custom_http_headers']);
  add('webui','alternative','auto',['alternative_webui_enabled','alternative_webui_path']);

  add('transfer','global','number',['dl_limit','up_limit','alt_dl_limit','alt_up_limit']);

  add('advanced','bandwidth','auto',['scheduler_enabled','schedule_from_hour','schedule_from_min','schedule_to_hour','schedule_to_min','scheduler_days','limit_utp_rate','limit_tcp_overhead','limit_lan_peers']);
  add('advanced','disk','auto',['disk_cache','disk_cache_ttl','disk_queue_size','disk_io_type','disk_io_read_mode','disk_io_write_mode','enable_coalesce_read_write','enable_os_cache','checking_memory_use','memory_working_set_limit','file_pool_size']);
  add('advanced','libtorrent','auto',['bdecode_depth_limit','bdecode_token_limit','async_io_threads','hashing_threads','enable_piece_extent_affinity','enable_upload_suggestions','send_buffer_watermark','send_buffer_low_watermark','send_buffer_watermark_factor','dht_bootstrap_nodes','save_resume_data_interval','save_statistics_interval','resume_data_storage_type','recheck_completed_torrents','refresh_interval']);
  add('advanced','rss','auto',['rss_auto_downloading_enabled','rss_download_repack_proper_episodes','rss_fetch_delay','rss_max_articles_per_feed','rss_processing_enabled','rss_refresh_interval','rss_smart_episode_filters']);
  add('advanced','dyndns','auto',['dyndns_enabled','dyndns_service','dyndns_domain','dyndns_username','dyndns_password']);
  add('advanced','mail','auto',['mail_notification_enabled','mail_notification_sender','mail_notification_email','mail_notification_smtp','mail_notification_ssl_enabled','mail_notification_auth_enabled','mail_notification_username','mail_notification_password']);
  add('advanced','logging','auto',['file_log_enabled','file_log_path','file_log_backup_enabled','file_log_max_size','file_log_delete_old','file_log_age','file_log_age_type']);
  add('advanced','system','auto',['locale','performance_warning','status_bar_external_ip','confirm_torrent_deletion','confirm_torrent_recheck','mark_of_the_web','ignore_ssl_errors','python_executable_path','app_instance_name','delete_torrent_content_files']);
  add('advanced','security','auto',['ssrf_mitigation']);

  var FAMILY_RULES=[
    {re:/^web_ui_reverse_/i,surface:'webui',section:'reverseProxy'},
    {re:/^web_ui_(?:custom_http|use_custom_http)/i,surface:'webui',section:'headers'},
    {re:/^alternative_webui_/i,surface:'webui',section:'alternative'},
    {re:/^(?:bypass_auth_|bypass_local_auth$|web_ui_(?:username|password|api_key|session_timeout|max_auth|ban_duration|localhost_auth))/i,surface:'webui',section:'auth'},
    {re:/^(?:web_ui_|use_https$|ssl_(?:cert|key)$)/i,surface:'webui',section:'security'},
    {re:/^(?:save_|temp_|export_)/i,surface:'downloads',section:'paths'},
    {re:/^(?:autorun_)/i,surface:'downloads',section:'automation'},
    {re:/^(?:auto_tmm|.*_tmm_|use_category_paths)/i,surface:'downloads',section:'management'},
    {re:/^(?:excluded_file_|torrent_content_remove|torrent_file_size|scan_dirs)/i,surface:'downloads',section:'files'},
    {re:/^(?:add_stopped|add_to_top|torrent_stop_condition|torrent_content_layout|incomplete_files|use_unwanted|preallocate|create_subfolder|start_paused)/i,surface:'downloads',section:'adding'},
    {re:/^proxy_/i,surface:'connection',section:'proxy'},
    {re:/^i2p_/i,surface:'connection',section:'i2p'},
    {re:/^(?:ip_filter_|banned_ip)/i,surface:'connection',section:'ipfilter'},
    {re:/^(?:socket_|outgoing_ports_|listen_|ssl_listen|upnp_|current_interface|connection_)/i,surface:'connection',section:'network'},
    {re:/^(?:add_trackers|announce_|tracker_|embedded_tracker|enable_embedded_tracker|stop_tracker|max_concurrent_http_announces|merge_trackers)/i,surface:'bittorrent',section:'tracker'},
    {re:/^(?:queueing_|max_active_|slow_torrent_|dont_count_slow)/i,surface:'bittorrent',section:'queue'},
    {re:/^(?:max_ratio|max_seeding|max_inactive_seeding)/i,surface:'bittorrent',section:'seeding'},
    {re:/^(?:dht$|pex$|lsd$|anonymous_mode|bittorrent_protocol)/i,surface:'bittorrent',section:'privacy'},
    {re:/^(?:peer_|upload_choking|upload_slots|utp_tcp|block_peers|resolve_peer|enable_multi_connections)/i,surface:'bittorrent',section:'peer'},
    {re:/^(?:scheduler_|schedule_|limit_utp|limit_tcp|limit_lan)/i,surface:'advanced',section:'bandwidth'},
    {re:/^(?:disk_|file_pool|checking_memory|memory_working|enable_os_cache)/i,surface:'advanced',section:'disk'},
    {re:/^(?:rss_)/i,surface:'advanced',section:'rss'},
    {re:/^(?:dyndns_)/i,surface:'advanced',section:'dyndns'},
    {re:/^(?:mail_notification_)/i,surface:'advanced',section:'mail'},
    {re:/^(?:file_log_)/i,surface:'advanced',section:'logging'},
    {re:/^(?:bdecode_|async_io_|hashing_|send_buffer_|save_resume_|save_statistics_|resume_data_|dht_bootstrap|enable_piece_extent)/i,surface:'advanced',section:'libtorrent'}
  ];

  function humanize(key){return String(key||'').replace(/_/g,' ').replace(/\b[a-z]/g,function(c){return c.toUpperCase();}).replace(/\bUi\b/g,'UI').replace(/\bDht\b/g,'DHT').replace(/\bPex\b/g,'PeX').replace(/\bLsd\b/g,'LSD').replace(/\bUpnp\b/g,'UPnP').replace(/\bCsrf\b/g,'CSRF').replace(/\bTmm\b/g,'TMM').replace(/\bRss\b/g,'RSS').replace(/\bSsl\b/g,'SSL');}
  function family(key){
    for(var i=0;i<FAMILY_RULES.length;i++)if(FAMILY_RULES[i].re.test(key))return FAMILY_RULES[i];
    return {surface:'advanced',section:'upstream'};
  }
  function baseInfo(key){
    var item=schema[key],rule=item||family(key),known=!!item,meta=Object.assign({},META[key]||{});
    return {key:key,title:humanize(key),description:known?'qBittorrent preference.':'Upstream qBittorrent preference discovered dynamically.',kind:rule.kind||'auto',surface:rule.surface||'advanced',section:rule.section||'upstream',known:known,source:known?'schema':(rule.section==='upstream'?'upstream':'family'),editable:rule.editable!==false,meta:meta,span:rule.span||'1'};
  }
  function describe(key){return baseInfo(key);}
  function describeValue(key,value){
    var info=api.describe(key),complex=Array.isArray(value)||(value!==null&&typeof value==='object');
    info=Object.assign({},info,{meta:Object.assign({},info.meta||{})});
    if(complex){info.kind='structured';info.structured=true;info.editable=false;return info;}
    if(info.kind==='structured'){info.structured=true;info.editable=false;return info;}
    if(info.kind==='auto'){
      if(typeof value==='boolean')info.kind='boolean';
      else if(typeof value==='number')info.kind='number';
      else info.kind='text';
    }
    return info;
  }
  function toDisplay(key,raw){var m=META[key],n=Number(raw);return m&&m.scale&&Number.isFinite(n)?n/m.scale:raw;}
  function toRaw(key,value){var m=META[key],n=Number(value);if(m&&m.scale&&Number.isFinite(n))return Math.round(n*m.scale);return W.util&&W.util.parseScalar?W.util.parseScalar(value):value;}
  function sectionTitle(section){var pair=SECTION_TITLES[section]||[humanize(section),humanize(section)];return W.I18n&&W.I18n.getLocale&&W.I18n.getLocale()==='zh-CN'?pair[1]:pair[0];}
  function group(tab,prefs){
    var buckets={},order=SECTION_ORDER[tab]||['upstream'];
    Object.keys(prefs||{}).forEach(function(key){
      var info=describeValue(key,prefs[key]);if(info.surface!==tab)return;
      (buckets[info.section]||(buckets[info.section]=[])).push(key);
    });
    Object.keys(buckets).forEach(function(section){buckets[section].sort();});
    var sections=order.filter(function(section){return buckets[section]&&buckets[section].length;});
    Object.keys(buckets).forEach(function(section){if(sections.indexOf(section)<0)sections.push(section);});
    return sections.map(function(section){return {id:section,title:sectionTitle(section),keys:buckets[section]};});
  }
  function keysFor(tab,prefs){return group(tab,prefs).flatMap(function(x){return x.keys;});}

  var api={schema:schema,meta:META,surfaces:SURFACES,sectionOrder:SECTION_ORDER,describe:describe,describeValue:describeValue,toDisplay:toDisplay,toRaw:toRaw,group:group,keysFor:keysFor,sectionTitle:sectionTitle,humanize:humanize};
  W.SettingsSchema=api;
})(window);

(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var labels={
    slow_torrent_inactive_timer:{
      source:'Torrent inactivity timer:',
      official:{
        'zh-CN':'Torrent 非活动计时器',
        'zh-TW':'Torrent 非活躍計時器',
        'ja':'Torrent未稼働時間',
        'ko':'토렌트 비활동 타이머'
      },
      weigg:{
        'zh-CN':'Torrent 非活动计时器',
        'zh-TW':'Torrent 非活躍計時器',
        'ja':'Torrent 非稼働タイマー',
        'ko':'토렌트 비활동 타이머'
      },
      purpose:{
        'zh-CN':'判断 Torrent 是否属于慢速/非活动状态时使用的持续时间。',
        'zh-TW':'判斷 Torrent 是否屬於慢速/非活躍狀態時使用的持續時間。',
        'ja':'Torrent を低速・非稼働として扱うまでの時間です。',
        'ko':'토렌트를 저속/비활동 상태로 판단할 때 사용하는 시간입니다.'
      }
    },
    slow_torrent_dl_rate_threshold:{
      source:'Download rate threshold:',
      official:{'zh-CN':'下载速度阈值','zh-TW':'下載速率閾值','ja':'ダウンロード速度のしきい値','ko':'다운로드 속도 임계값'},
      weigg:{'zh-CN':'下载速度阈值','zh-TW':'下載速率閾值','ja':'ダウンロード速度しきい値','ko':'다운로드 속도 임계값'},
      purpose:{'zh-CN':'低于该下载速度时，可按慢速 Torrent 规则处理。','zh-TW':'低於此下載速度時，可依慢速 Torrent 規則處理。','ja':'この速度未満の Torrent を低速として扱う判定に使います。','ko':'이 속도보다 낮은 토렌트를 저속으로 판단하는 데 사용합니다.'}
    },
    slow_torrent_ul_rate_threshold:{
      source:'Upload rate threshold:',
      official:{'zh-CN':'上传速度阈值','zh-TW':'上傳速率閾值','ja':'アップロード速度のしきい値','ko':'업로드 속도 임계값'},
      weigg:{'zh-CN':'上传速度阈值','zh-TW':'上傳速率閾值','ja':'アップロード速度しきい値','ko':'업로드 속도 임계값'},
      purpose:{'zh-CN':'低于该上传速度时，可按慢速 Torrent 规则处理。','zh-TW':'低於此上傳速度時，可依慢速 Torrent 規則處理。','ja':'この速度未満の Torrent を低速として扱う判定に使います。','ko':'이 속도보다 낮은 토렌트를 저속으로 판단하는 데 사용합니다.'}
    },
    socket_receive_buffer_size:{
      source:'Socket receive buffer size [0: system default]:',
      official:{'zh-CN':'套接字接收缓存大小','zh-TW':'Socket 接收緩衝區大小','ja':'Socket受信バッファーサイズ','ko':'소켓 수신 버퍼 크기'},
      weigg:{'zh-CN':'Socket 接收缓冲区大小','zh-TW':'Socket 接收緩衝區大小','ja':'Socket 受信バッファーサイズ','ko':'소켓 수신 버퍼 크기'},
      purpose:{'zh-CN':'控制 BitTorrent Socket 的接收缓冲区。','zh-TW':'控制 BitTorrent Socket 的接收緩衝區。','ja':'BitTorrent Socket の受信バッファーを制御します。','ko':'BitTorrent 소켓의 수신 버퍼를 제어합니다.'}
    },
    socket_send_buffer_size:{
      source:'Socket send buffer size [0: system default]:',
      official:{'zh-CN':'套接字发送缓存大小','zh-TW':'Socket 傳送緩衝區大小','ja':'Socket送信バッファーサイズ','ko':'소켓 송신 버퍼 크기'},
      weigg:{'zh-CN':'Socket 发送缓冲区大小','zh-TW':'Socket 傳送緩衝區大小','ja':'Socket 送信バッファーサイズ','ko':'소켓 송신 버퍼 크기'},
      purpose:{'zh-CN':'控制 BitTorrent Socket 的发送缓冲区。','zh-TW':'控制 BitTorrent Socket 的傳送緩衝區。','ja':'BitTorrent Socket の送信バッファーを制御します。','ko':'BitTorrent 소켓의 송신 버퍼를 제어합니다.'}
    },
    socket_backlog_size:{
      source:'Socket backlog size:',
      official:{},
      weigg:{'zh-CN':'Socket 等待连接队列大小','zh-TW':'Socket 等待連線佇列大小','ja':'Socket backlog サイズ','ko':'소켓 백로그 크기'},
      purpose:{'zh-CN':'控制监听 Socket 等待处理的连接队列长度。','zh-TW':'控制監聽 Socket 等待處理的連線佇列長度。','ja':'待機中の接続を保持する listen Socket のキュー長です。','ko':'수신 대기 소켓의 연결 대기열 길이를 제어합니다.'}
    },
    torrent_file_size_limit:{
      source:'Maximum .torrent file size:',
      official:{},
      weigg:{'zh-CN':'最大 .torrent 文件大小','zh-TW':'最大 .torrent 檔案大小','ja':'最大 .torrent ファイルサイズ','ko':'최대 .torrent 파일 크기'},
      purpose:{'zh-CN':'限制 qBittorrent 接受的 .torrent 元数据文件大小。','zh-TW':'限制 qBittorrent 接受的 .torrent 中繼資料檔案大小。','ja':'qBittorrent が受け付ける .torrent メタデータの最大サイズです。','ko':'qBittorrent가 허용하는 .torrent 메타데이터 파일의 최대 크기입니다.'}
    },
    disk_queue_size:{
      source:'Disk queue size:',
      official:{},
      weigg:{'zh-CN':'磁盘队列大小','zh-TW':'磁碟佇列大小','ja':'ディスクキューサイズ','ko':'디스크 대기열 크기'},
      purpose:{'zh-CN':'控制磁盘 I/O 队列可使用的内存规模。','zh-TW':'控制磁碟 I/O 佇列可使用的記憶體規模。','ja':'ディスク I/O キューで使用するメモリー量を制御します。','ko':'디스크 I/O 대기열이 사용할 수 있는 메모리 크기를 제어합니다.'}
    },
    memory_working_set_limit:{
      source:'Physical memory (RAM) usage limit:',
      official:{},
      weigg:{'zh-CN':'内存工作集限制','zh-TW':'記憶體工作集限制','ja':'メモリーワーキングセット上限','ko':'메모리 작업 집합 제한'},
      purpose:{'zh-CN':'限制 qBittorrent 可主动使用的内存工作集。','zh-TW':'限制 qBittorrent 可主動使用的記憶體工作集。','ja':'qBittorrent が使用するメモリーのワーキングセット上限です。','ko':'qBittorrent가 사용하는 메모리 작업 집합의 상한입니다.'}
    },
    checking_memory_use:{
      source:'Outstanding memory when checking torrents:',
      official:{},
      weigg:{'zh-CN':'校验 Torrent 时的内存限制','zh-TW':'檢查 Torrent 時的記憶體限制','ja':'Torrent チェック時のメモリー上限','ko':'토렌트 검사 시 메모리 제한'},
      purpose:{'zh-CN':'控制 Torrent 校验过程允许占用的内存。','zh-TW':'控制 Torrent 檢查過程允許占用的記憶體。','ja':'Torrent チェック処理で使用できるメモリー量を制御します。','ko':'토렌트 검사 과정에서 사용할 수 있는 메모리 양을 제어합니다.'}
    },
    save_resume_data_interval:{
      source:'Save resume data interval:',
      official:{},
      weigg:{'zh-CN':'保存恢复数据间隔','zh-TW':'儲存恢復資料間隔','ja':'再開データ保存間隔','ko':'재개 데이터 저장 간격'},
      purpose:{'zh-CN':'控制 qBittorrent 定期写入 Torrent 恢复数据的间隔。','zh-TW':'控制 qBittorrent 定期寫入 Torrent 恢復資料的間隔。','ja':'Torrent の再開データを書き込む周期です。','ko':'토렌트 재개 데이터를 주기적으로 저장하는 간격입니다.'}
    },
    hostname_cache_ttl:{
      source:'Hostname cache TTL:',
      official:{},
      weigg:{'zh-CN':'主机名缓存 TTL','zh-TW':'主機名稱快取 TTL','ja':'ホスト名キャッシュ TTL','ko':'호스트 이름 캐시 TTL'},
      purpose:{'zh-CN':'控制已解析主机名在缓存中的有效时间。','zh-TW':'控制已解析主機名稱在快取中的有效時間。','ja':'解決済みホスト名をキャッシュする有効時間です。','ko':'확인된 호스트 이름을 캐시에 유지하는 시간입니다.'}
    },
    stop_tracker_timeout:{
      source:'Stop tracker timeout:',
      official:{},
      weigg:{'zh-CN':'停止 Tracker 超时','zh-TW':'停止 Tracker 逾時','ja':'Tracker 停止タイムアウト','ko':'트래커 중지 시간 초과'},
      purpose:{'zh-CN':'停止 Torrent 时等待 Tracker 请求完成的最长时间。','zh-TW':'停止 Torrent 時等待 Tracker 請求完成的最長時間。','ja':'Torrent 停止時に Tracker 要求を待つ最大時間です。','ko':'토렌트 중지 시 트래커 요청 완료를 기다리는 최대 시간입니다.'}
    },
    upnp_lease_duration:{
      source:'UPnP lease duration:',
      official:{},
      weigg:{'zh-CN':'UPnP 租约时长','zh-TW':'UPnP 租約時間','ja':'UPnP リース期間','ko':'UPnP 임대 기간'},
      purpose:{'zh-CN':'控制路由器端口映射请求的租约时间。','zh-TW':'控制路由器連接埠對映要求的租約時間。','ja':'ルーターのポートマッピングに要求するリース期間です。','ko':'라우터 포트 매핑 요청의 임대 시간을 제어합니다.'}
    }
  };

  function locale(){return W.I18n&&W.I18n.getLocale?W.I18n.getLocale():'en';}
  function entry(key){return labels[key]||null;}
  function localized(map,loc){return map&&map[loc]?map[loc]:'';}
  function label(key,english){
    var e=entry(key),loc=locale();
    if(!e||loc==='en')return {text:english||e&&e.source||key,source:'english'};
    var off=localized(e.official,loc);
    return off?{text:off,source:'qBittorrent official'}:{text:english||e.source||key,source:'english'};
  }
  function help(key,english){
    var e=entry(key),loc=locale();if(!e||loc==='en')return null;
    var off=localized(e.official,loc),translation=off||localized(e.weigg,loc);
    return {
      translation:translation||english||e.source||key,
      translationSource:off?'qBittorrent official':'WeiG explanation',
      purpose:localized(e.purpose,loc)||'',
      sourceText:e.source||english||key
    };
  }

  W.SettingsOfficialV037={
    upstream:'qbittorrent/qBittorrent',
    upstreamCommit:'fe4506e8c6af67cd49720b8254d7b97fe5504a69',
    entries:labels,
    label:label,
    help:help
  };
})(window);

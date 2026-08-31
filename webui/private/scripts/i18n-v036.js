(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var EN={
    'v036.logs.normal':'Normal',
    'v036.logs.info':'Info',
    'v036.logs.warning':'Warning',
    'v036.logs.critical':'Critical',
    'v036.logs.unknown':'Unknown',
    'v036.logs.follow':'Follow latest',
    'v036.logs.compact':'Compact',
    'v036.logs.auto':'Auto',
    'v036.logs.max':'Max',
    'v036.logs.refresh':'Refresh',
    'v036.logs.log':'Log',
    'v036.logs.time':'Time',
    'v036.logs.level':'Level',
    'v036.logs.empty':'No logs match the current filters.',
    'v036.logs.showing':'Showing {shown} / {total} · newest first',
    'v036.logs.stream':'incremental log stream',
    'v036.logs.unsupported':'This qBittorrent instance does not expose the log API.',
    'v036.logs.failed':'Failed to read logs: {error}',
    'v036.logs.timeZone':'Time zone',
    'v036.logs.timeZoneSearch':'Search time zones…',
    'v036.time.system':'System / Browser',
    'v036.settings.timeZone':'Display time zone',
    'v036.settings.timeZoneDesc':'Changes how dates and log times are displayed in this browser. It does not change qBittorrent or server time.',
    'v036.detail.back':'Back to torrents',
    'v036.detail.backHint':'Return to the previous torrent list position',
    'v036.brand.ambient':'Ambient brand motion'
  };
  var ZH={
    'v036.logs.normal':'普通',
    'v036.logs.info':'信息',
    'v036.logs.warning':'警告',
    'v036.logs.critical':'严重',
    'v036.logs.unknown':'未知',
    'v036.logs.follow':'跟随最新',
    'v036.logs.compact':'紧凑',
    'v036.logs.auto':'自动',
    'v036.logs.max':'最大',
    'v036.logs.refresh':'刷新',
    'v036.logs.log':'日志',
    'v036.logs.time':'时间',
    'v036.logs.level':'级别',
    'v036.logs.empty':'没有符合当前条件的日志。',
    'v036.logs.showing':'显示 {shown} / {total} · 最新在最上方',
    'v036.logs.stream':'增量日志流',
    'v036.logs.unsupported':'当前 qBittorrent 实例不提供日志 API。',
    'v036.logs.failed':'日志读取失败：{error}',
    'v036.logs.timeZone':'时区',
    'v036.logs.timeZoneSearch':'搜索时区…',
    'v036.time.system':'系统 / 浏览器',
    'v036.settings.timeZone':'显示时区',
    'v036.settings.timeZoneDesc':'只改变当前浏览器中日期和日志时间的显示方式，不修改 qBittorrent 或服务器时间。',
    'v036.detail.back':'返回种子列表',
    'v036.detail.backHint':'返回进入详情前的种子列表位置',
    'v036.brand.ambient':'环境品牌动效'
  };
  function interpolate(value,vars){return String(value).replace(/\{(\w+)\}/g,function(_m,key){return vars&&vars[key]!==undefined?String(vars[key]):'{'+key+'}';});}
  function t(key,vars){var locale=W.I18n&&W.I18n.getLocale?W.I18n.getLocale():'en',dict=locale==='zh-CN'?ZH:EN,value=dict[key]!==undefined?dict[key]:(EN[key]!==undefined?EN[key]:key);return interpolate(value,vars);}
  W.V036I18n={t:t,english:EN,zhCN:ZH};
})(window);

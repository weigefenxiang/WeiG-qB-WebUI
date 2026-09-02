(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var EN={
    'v030.limit.download':'Global download limit',
    'v030.limit.upload':'Global upload limit',
    'v030.limit.current':'Current',
    'v030.limit.custom':'Custom MiB/s',
    'v030.limit.apply':'Apply',
    'v030.limit.unlimited':'Unlimited',
    'v030.limit.customButton':'Custom',
    'v030.limit.updated':'Global speed limit updated',
    'v030.limit.failed':'Failed to update speed limit',
    'v030.alt':'Alternative speed limits',
    'v030.alt.enabled':'Alternative speed limits enabled',
    'v030.alt.disabled':'Alternative speed limits disabled',
    'v030.alt.toggled':'Alternative speed mode toggled',
    'v030.alt.failed':'Unable to toggle alternative speed mode',
    'v030.transfer':'Transfer',
    'v030.transfer.title':'Transfer & session',
    'v030.transfer.sessionDown':'Session downloaded',
    'v030.transfer.sessionUp':'Session uploaded',
    'v030.transfer.downLimit':'Download limit',
    'v030.transfer.upLimit':'Upload limit',
    'v030.transfer.freeSpace':'Free space',
    'v030.transfer.speed':'Transfer speed',
    'v030.transfer.download':'Download',
    'v030.transfer.upload':'Upload',
    'v030.loading':'Loading…',
    'v030.speed.downloadAria':'Set global download limit',
    'v030.speed.uploadAria':'Set global upload limit'
  };
  var ZH={
    'v030.limit.download':'全局下载限速',
    'v030.limit.upload':'全局上传限速',
    'v030.limit.current':'当前',
    'v030.limit.custom':'自定义 MiB/s',
    'v030.limit.apply':'应用',
    'v030.limit.unlimited':'不限速',
    'v030.limit.customButton':'自定义',
    'v030.limit.updated':'全局限速已更新',
    'v030.limit.failed':'限速更新失败',
    'v030.alt':'备用限速',
    'v030.alt.enabled':'备用限速已启用',
    'v030.alt.disabled':'备用限速已关闭',
    'v030.alt.toggled':'备用限速模式已切换',
    'v030.alt.failed':'无法切换备用限速',
    'v030.transfer':'传输',
    'v030.transfer.title':'传输与会话',
    'v030.transfer.sessionDown':'本次会话已下载',
    'v030.transfer.sessionUp':'本次会话已上传',
    'v030.transfer.downLimit':'下载限速',
    'v030.transfer.upLimit':'上传限速',
    'v030.transfer.freeSpace':'剩余空间',
    'v030.transfer.speed':'传输速度',
    'v030.transfer.download':'下载',
    'v030.transfer.upload':'上传',
    'v030.loading':'正在读取…',
    'v030.speed.downloadAria':'设置全局下载限速',
    'v030.speed.uploadAria':'设置全局上传限速'
  };
  function t(key){
    var locale=W.I18n&&W.I18n.getLocale?W.I18n.getLocale():'en';
    var d=locale==='zh-CN'?ZH:EN;
    return d[key]!==undefined?d[key]:(EN[key]!==undefined?EN[key]:key);
  }
  W.TransferText={t:t,english:EN,zhCN:ZH};
})(window);

(function(global){
  'use strict';
  var W=global.WeiG=global.WeiG||{};
  var EN={
    'v034.alt.title':'Alternative WebUI',
    'v034.alt.description':'Manage qBittorrent\'s Alternative WebUI switch and the path visible to the qBittorrent process.',
    'v034.alt.enabled':'Use Alternative WebUI',
    'v034.alt.enabledDesc':'Disable this to return to qBittorrent\'s built-in WebUI after reload.',
    'v034.alt.qbPath':'qBittorrent WebUI path',
    'v034.alt.qbPathDesc':'Path as seen by the qBittorrent process. Docker installations normally use /config/... rather than the VPS host path.',
    'v034.alt.hostPath':'VPS / host path',
    'v034.alt.hostPathDesc':'Host-side installation path recorded by the WeiG installer. qBittorrent itself cannot discover this path through WebAPI.',
    'v034.alt.version':'WeiG version',
    'v034.alt.container':'Container',
    'v034.alt.installedAt':'Installed / updated',
    'v034.alt.sourceApi':'qBittorrent Preferences',
    'v034.alt.sourceInstaller':'WeiG installer metadata',
    'v034.alt.unavailable':'Not available from this installation',
    'v034.alt.unsupported':'This qBittorrent version did not return Alternative WebUI preferences.',
    'v034.alt.disableConfirm':'Disable Alternative WebUI? After saving, this WeiG WebUI will stop being used and the page will reload to qBittorrent\'s built-in WebUI.',
    'v034.alt.pathConfirm':'Change the Alternative WebUI path? An invalid path can make the WebUI unavailable until it is corrected from qBittorrent configuration.',
    'v034.alt.hostPathError':'That is the VPS host path. qBittorrent is using a container path; use the qBittorrent path shown below instead.',
    'v034.alt.saved':'Alternative WebUI settings saved',
    'v034.alt.saveFailed':'Unable to save Alternative WebUI settings',
    'v034.alt.redirecting':'Alternative WebUI disabled. Returning to the built-in WebUI…',
    'v034.alt.current':'Current',
    'v034.alt.pending':'Pending change'
  };
  var ZH={
    'v034.alt.title':'Alternative WebUI',
    'v034.alt.description':'管理 qBittorrent 的 Alternative WebUI 开关，以及 qBittorrent 进程实际看到的 WebUI 路径。',
    'v034.alt.enabled':'使用 Alternative WebUI',
    'v034.alt.enabledDesc':'关闭后，保存并刷新会返回 qBittorrent 官方 WebUI。',
    'v034.alt.qbPath':'qBittorrent WebUI 路径',
    'v034.alt.qbPathDesc':'这是 qBittorrent 进程实际看到的路径。Docker 通常应使用 /config/...，而不是 VPS 宿主机路径。',
    'v034.alt.hostPath':'VPS / Host 路径',
    'v034.alt.hostPathDesc':'由 WeiG 安装器记录的宿主机安装路径；qBittorrent WebAPI 本身无法获知这个路径。',
    'v034.alt.version':'WeiG 版本',
    'v034.alt.container':'容器',
    'v034.alt.installedAt':'安装 / 更新时间',
    'v034.alt.sourceApi':'qBittorrent Preferences',
    'v034.alt.sourceInstaller':'WeiG 安装器元数据',
    'v034.alt.unavailable':'当前安装未提供',
    'v034.alt.unsupported':'当前 qBittorrent 没有返回 Alternative WebUI 设置。',
    'v034.alt.disableConfirm':'确定关闭 Alternative WebUI？保存后 WeiG qB WebUI 将停止使用，并刷新返回 qBittorrent 官方 WebUI。',
    'v034.alt.pathConfirm':'确定修改 Alternative WebUI 路径？如果路径无效，WebUI 可能无法访问，直到从 qBittorrent 配置中修正。',
    'v034.alt.hostPathError':'这是 VPS 宿主机路径。当前 qBittorrent 使用容器路径，请改用下面显示的 qBittorrent 路径。',
    'v034.alt.saved':'Alternative WebUI 设置已保存',
    'v034.alt.saveFailed':'Alternative WebUI 设置保存失败',
    'v034.alt.redirecting':'Alternative WebUI 已关闭，正在返回官方 WebUI…',
    'v034.alt.current':'当前值',
    'v034.alt.pending':'待保存'
  };
  function t(key){
    var locale=W.I18n&&W.I18n.getLocale?W.I18n.getLocale():'en';
    var d=locale==='zh-CN'?ZH:EN;
    return d[key]!==undefined?d[key]:(EN[key]!==undefined?EN[key]:key);
  }
  W.V034I18n={t:t,english:EN,zhCN:ZH};
})(window);

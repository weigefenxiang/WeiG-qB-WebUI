# WeiG qB WebUI

一套现代、响应式的 qBittorrent Alternate WebUI。桌面端与移动端共用同一套组件、设置与交互规范。

**语言：** [English](../README.md) · 简体中文

- GitHub: https://github.com/weigefenxiang/WeiG-qB-WebUI
- Blog: https://www.weigshare.com/
- 许可证：GNU GPL-3.0

## 主要功能

- Torrent、搜索、RSS、日志、设置完整响应式适配
- qBittorrent 4.1.9.1+，按 WebAPI/能力判断兼容，而不是写死主版本
- 移动端筛选、长按操作与自适应底部导航
- 桌面端右键 Torrent = 更多操作
- 支持当前页或全部筛选结果的多选、全选与反选
- 设置项统一单位、转换与 `0 / -1` 特殊值说明
- 高级设置优先使用已核实的 qBittorrent 官方译文，缺失时提供 WeiG 帮助说明
- 深色/浅色、显示时区、磁盘可用空间
- Git SHA 缓存身份与可回滚安装

## 安装

Linux / Docker 宿主机：

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-webui-install.sh
sh /tmp/weigg-qb-webui-install.sh
```

让安装器尝试更新检测到的 qBittorrent 配置：

```sh
sh /tmp/weigg-qb-webui-install.sh --configure
```

Docker 或自定义安装建议先查看参数：

```sh
sh /tmp/weigg-qb-webui-install.sh --help
sh /tmp/weigg-qb-webui-install.sh --list-containers
```

Windows PowerShell：

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile $env:TEMP\weigg-qb-webui-install.ps1
powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-webui-install.ps1
```

## qBittorrent 配置

在 qBittorrent Web UI 设置中启用 **Use alternative Web UI**，并将 **Files location** 设置为 qBittorrent 进程实际可见的 WeiG WebUI 路径。

Docker 环境中，宿主机目录与容器内 qB 可见目录是两个概念；qBittorrent 中应填写容器内可见路径。

## 更新 / 回滚

```sh
sh /tmp/weigg-qb-webui-install.sh --update
sh /tmp/weigg-qb-webui-install.sh --rollback
```

安装器会保留部署元数据、精确 Git SHA 与回滚备份。

## 兼容范围

最低目标：

```text
qBittorrent 4.1.9.1
WebAPI 2.2.1
```

兼容判断以 API 字段和 capability 为准，不按 qBittorrent 主版本硬编码。

## 详细文档

- [DESIGN.md](../DESIGN.md) — 视觉与交互规范
- [项目总方案](../docs/001.项目总方案.md)
- [兼容与实现状态](../docs/002.兼容与实现状态.md)
- [项目架构](../docs/003.项目架构.md)
- [UI 与缓存契约](../docs/004.UI与缓存契约.md)
- [v0.3.7 统一交互与设置系统](../docs/005.v0.3.7统一交互与设置系统.md)

## 许可证

Copyright © 2026 Wei.G / WeiG Share.

WeiG qB WebUI 使用 [GNU General Public License v3.0](../LICENSE) 开源。

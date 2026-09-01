# WeiG qB WebUI

一套现代、响应式的 qBittorrent Alternate WebUI。桌面端与手机端共用同一套业务与交互模型，仅针对不同屏幕优化呈现方式。

**语言：** [English](../README.md) · 简体中文

## 安装

**稳定版唯一以 GitHub Releases 为准。** 普通用户请始终从这里获取：

- [最新 Release](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest)
- [WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)
- [SHA256SUMS](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS)

如果还没有发布 Release，就代表当前没有稳定版；`dev` 和 `main` 只用于开发/预发布测试，不作为普通用户稳定下载入口。稳定安装器会 fail closed，不会在 Release 缺失时偷偷改用 branch archive。

### Linux / Docker / NAS 一键安装

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh && sh /tmp/weigg-qb-install.sh --configure
```

安装器会识别常见 qBittorrent Docker 布局、自动备份、校验 Release checksum 与 exact Git SHA、检查完整 Alternate WebUI 入口，并输出 qBittorrent 实际应填写的 WebUI 路径。

### Windows PowerShell 一键安装

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile $env:TEMP\weigg-qb-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-install.ps1 -Configure
```

### 手动安装 / 其它系统

下载最新 `WeiG-qB-WebUI.zip`，使用 `SHA256SUMS` 校验后解压到持久目录；然后在 qBittorrent 中启用 **Use alternative Web UI**，并把 **Files location / Root Folder** 设置为 qBittorrent 进程实际可见的目录。

Docker 环境里“宿主机路径”和“容器内 qB 可见路径”不是一回事，qBittorrent 必须填写容器内路径。

Docker 多容器、自定义路径、更新、回滚、NAS 与完整手动部署说明见：[安装、升级与手动部署](../docs/007.安装升级与手动部署.md)。

## 兼容范围

最低兼容目标：**qBittorrent 4.1.9.1 / WebAPI 2.2.1**。当前发布审计会检查从 4.1.9.1 到 5.2.3 的 **55 个官方正式 4.x/5.x release tags**，另外核对 current upstream WebAPI，并在 Linux 与 Windows Chromium 上运行 20 节点代表性交互矩阵。新版本能力按 WebAPI/capability 渐进启用，不按主版本写死。

完整矩阵、官方源码审计与 LIVE gate 规则见：[兼容与实现状态](../docs/002.兼容与实现状态.md)。

## 文档

- [安装、升级与手动部署](../docs/007.安装升级与手动部署.md)
- [项目总方案](../docs/001.项目总方案.md)
- [兼容与实现状态](../docs/002.兼容与实现状态.md)
- [项目架构](../docs/003.项目架构.md)
- [UI 与缓存契约](../docs/004.UI与缓存契约.md)
- [响应式交互与设置系统](../docs/005.v0.3.7统一交互与设置系统.md)
- [发布与晋级流程](../docs/006.发布与晋级流程.md)
- [DESIGN.md](../DESIGN.md)

## 许可证

Copyright © 2026 Wei.G / WeiG Share。使用 [GNU GPL-3.0](../LICENSE) 开源。

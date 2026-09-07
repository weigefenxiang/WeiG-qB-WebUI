# WeiG qB WebUI

一套现代、响应式的 qBittorrent Alternate WebUI，专为桌面端和手机端优化。

**📱 手机自适应 · 🖥️ 桌面响应式 · 🌙 暗夜模式 · ✅ 支持 qBittorrent 4.1.x → 5.2.x**

**[🌐 在线预览](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ 下载最新正式版](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**语言**：[English](https://github.com/weigefenxiang/WeiG-qB-WebUI/blob/installer-ux-20260907/README.md) · [简体中文](https://github.com/weigefenxiang/WeiG-qB-WebUI/blob/main/translations/README.zh-CN.md) · 日本語 · 한국어 · Deutsch · Français · Español · Português · Русский

## 直接下载

下载最新正式版 **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**。

解压后，**`WeiG-qB-WebUI` 文件夹就是 qBittorrent 要使用的 WebUI 目录**。

## 新手安装

<details>
<summary><b>第一次安装？点击展开 1 分钟教程</b></summary>

### 1. 解压

下载并解压 `WeiG-qB-WebUI.zip`，得到：

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

整个 **`WeiG-qB-WebUI` 文件夹**就是 WebUI 根目录，不要只复制 `public` 或 `private`。

### 2. 放到一个固定位置

例如：

```text
Windows：D:\WeiG-qB-WebUI
Linux：  /opt/WeiG-qB-WebUI
```

### 3. 在 qBittorrent 中启用

打开：

**工具 / 选项（首选项）→ Web UI → Use alternative WebUI**

勾选后，把 **Files location / Root Folder** 设置为刚才的 `WeiG-qB-WebUI` 文件夹路径，保存并刷新 WebUI。

> Docker 用户要填写 **qBittorrent 容器内可见路径**。例如宿主机目录是 `/path/to/qbittorrent/config/weigg-qb-webui`，如果映射到容器内 `/config/weigg-qb-webui`，那么 Root Folder 应填写 `/config/weigg-qb-webui`。

</details>

## 一键安装

一键脚本来自稳定 `main` 分支，**默认安装最新正式 Release**，并校验 `SHA256SUMS`。安装脚本会保存在当前目录，方便以后更新或回滚。

### Linux / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

默认安装目录：

```text
~/.local/share/weigg-qb-webui
```

### Docker

<details>
<summary><b>Docker 一键安装 / 多容器设置（点击展开）</b></summary>

如果只有一个正在运行的 qBittorrent 容器，可直接使用：

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

安装器会自动识别容器的 `/config` 映射，并提示 qBittorrent 应填写的容器内 WebUI 路径。

如果有多个 qBittorrent 容器，先查看：

```sh
sh weigg-install.sh --list-containers
```

再指定容器，例如容器名为 `qbittorrent`：

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

也可以直接指定 qBittorrent `/config` 对应的宿主机目录：

```sh
sh weigg-install.sh --config-root=/path/to/qbittorrent/config --configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

默认安装目录：

```text
%LOCALAPPDATA%\WeiG-qB-WebUI
```

## 常用参数

Linux 和 Windows 使用相同的参数名称，文档统一使用小写；PowerShell 参数本身不区分大小写。

| 用途 | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| 最新稳定版 | 默认，无需参数 | 默认，无需参数 |
| 指定正式版本 | `--version 0.3.60` | `-version 0.3.60` |
| 开发版 | `--dev` | `-dev` |
| 指定安装目录 | `-o /path` 或 `--output /path` | `-o D:\path` 或 `-output D:\path` |
| 自动配置 qBittorrent | `--configure` | `-configure` |
| 回滚上一次安装 | `--rollback` | `-rollback` |
| 查看完整帮助 | `--help` | `-help` |
| 指定 Docker 容器 | `--container=NAME` | — |
| 列出 Docker 容器 | `--list-containers` | — |
| 指定 Docker `/config` 宿主机目录 | `--config-root=/path` | — |

说明：

- `-o` 中的 `o` 表示 **output**，用于指定 WeiG qB WebUI 的安装目录。
- `--configure / -configure` 会在安装后自动启用 qBittorrent 的 **Use alternative WebUI**，并设置 **WebUI Root Folder**；修改前会备份 qBittorrent 配置。
- `--rollback / -rollback` 会恢复上一次安装及对应的 qBittorrent 配置；默认会记住上一次安装目录。
- `--version / -version` 安装指定 GitHub Release，例如 `0.3.60`；指定版本不存在时直接报错，**不会自动退回 latest 或 dev**。
- `--dev / -dev` 只用于测试当前开发版 exact Git SHA，不能和 `--version / -version` 同时使用。
- Docker 有多个 qBittorrent 容器时，用 `--list-containers` 查看，再用 `--container=NAME` 明确指定；也可以用 `--config-root=/path` 直接指定宿主机上的 qBittorrent 配置目录。

### 指定版本和安装目录

Linux：

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

### 回滚

Linux：

```sh
sh weigg-install.sh --rollback
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

## 更多帮助

Docker 多容器、NAS、自定义路径及高级部署说明见：[安装、升级与手动部署](../docs/007.安装升级与手动部署.md)。

## 许可证

本项目使用 [GNU General Public License v3](../LICENSE)。

Copyright © 2026 Wei.G / WeiG Share。

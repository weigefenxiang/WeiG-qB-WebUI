# WeiG qB WebUI

一套现代、响应式的 qBittorrent Alternate WebUI。

**语言**：[English](../README.md) · 简体中文

## 安装频道

- **Release** — 稳定版、默认频道、校验 SHA256，推荐普通用户使用。
- **dev** — 当前开发分支，但安装器会先解析为一个确定的 Git commit。只有明确选择时才安装 dev；Release 缺失时绝不会自动回退到 dev。

## 一键安装

### Linux / Docker / NAS

Release（默认）：

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh && sh /tmp/weigg-qb-install.sh --configure
```

dev：

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/dev/installers/install.sh -o /tmp/weigg-qb-install.sh && sh /tmp/weigg-qb-install.sh --channel=dev --configure
```

安装器会自动选择系统已有的下载、ZIP 解压和 SHA256 工具，兼容常见的 `curl`、`wget`、BusyBox、Python 和 `bsdtar` 组合。Release 必须通过 `SHA256SUMS` 校验；dev 会记录实际安装的 exact Git SHA。

如果机器里有多个 qBittorrent Docker 容器，先列出：

```sh
sh /tmp/weigg-qb-install.sh --list-containers
```

再明确指定，例如：

```sh
sh /tmp/weigg-qb-install.sh --container=qbittorrent --configure
```

### Windows PowerShell

Release：

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile $env:TEMP\weigg-qb-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-install.ps1 -Channel Release -Configure
```

dev：

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/dev/installers/install.ps1 -OutFile $env:TEMP\weigg-qb-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-install.ps1 -Channel Dev -Configure
```

## 直接下载 Release

任何时候都可以在浏览器打开 [GitHub Releases](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest) 手动下载。Release 包含 [WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip) 和 [SHA256SUMS](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS)。

使用 `curl`：

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -o WeiG-qB-WebUI.zip
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
```

使用 `wget`：

```sh
wget https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -O WeiG-qB-WebUI.zip
wget https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -O SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
```

精简 NAS 系统通常还可以使用 BusyBox：

```sh
busybox wget -O WeiG-qB-WebUI.zip https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip
busybox wget -O SHA256SUMS https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS
busybox sha256sum WeiG-qB-WebUI.zip
busybox unzip WeiG-qB-WebUI.zip
```

如果系统没有 `curl`、`wget` 或 `unzip`，可以直接在电脑浏览器下载 ZIP，再上传/复制到 Linux 或 NAS。解压可使用系统已有的任意 ZIP 工具，例如 `unzip`、`busybox unzip`、`python3 -m zipfile -e WeiG-qB-WebUI.zip .` 或 `bsdtar -xf WeiG-qB-WebUI.zip`。

Windows 手动下载与解压：

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip .\WeiG-qB-WebUI -Force
```

## 手动下载 dev

推荐使用安装器，因为安装器会先把 `dev` 解析成一个 exact Git SHA，再把这个 SHA 写入 WebUI 文件中。

需要手动测试时，可以在 GitHub 选择 **Code → dev → Download ZIP**，也可以：

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/archive/refs/heads/dev.zip -o WeiG-qB-WebUI-dev.zip
unzip WeiG-qB-WebUI-dev.zip
```

使用 `wget`：

```sh
wget https://github.com/weigefenxiang/WeiG-qB-WebUI/archive/refs/heads/dev.zip -O WeiG-qB-WebUI-dev.zip
unzip WeiG-qB-WebUI-dev.zip
```

手动解压 dev 源码包后，真正的 Alternate WebUI 目录是 **`WeiG-qB-WebUI-dev/webui/`**，不要把整个仓库根目录填给 qBittorrent。

## 启用 WeiG qB WebUI

进入 qBittorrent **工具 / 选项（首选项）→ Web UI**，勾选 **Use alternative WebUI**，然后把 **Files location / Root Folder** 设置为 qBittorrent 进程实际能看到的 WebUI 目录。

Docker 中“宿主机路径”和“容器内路径”不同。例如：

```text
宿主机：    /root/qbittorrent/config/weigg-qb-webui
qBittorrent：/config/weigg-qb-webui
```

qBittorrent 必须填写容器内可见路径。

## 更新

重新运行安装器即可。Release 仍是默认频道；需要继续使用 dev 时，Linux 加 `--channel=dev`，Windows 使用 `-Channel Dev`。

## 停用 / 回滚

要立即恢复 qBittorrent 原生 WebUI，只需取消勾选 **Use alternative WebUI**。

Linux 回滚：

```sh
sh /tmp/weigg-qb-install.sh --rollback
```

Windows 回滚：

```powershell
powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-install.ps1 -Mode Rollback
```

## 兼容范围

最低支持目标：**qBittorrent 4.1.9.1**。WeiG qB WebUI 通过 capability 兼容层支持 qBittorrent **4.x 和 5.x**。

## 更多帮助

自定义路径、Docker 多容器、NAS 部署、更新与回滚等完整说明见：[安装、升级与手动部署](../docs/007.安装升级与手动部署.md)。

## 许可证

本项目使用 [GNU General Public License v3](../LICENSE)。

Copyright © 2026 Wei.G / WeiG Share。

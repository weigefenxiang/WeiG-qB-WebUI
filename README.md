# WeiG qB WebUI

Modern responsive Alternate WebUI for qBittorrent. Desktop and mobile share one application model, with layouts optimized for each screen size.

**Language:** English · [简体中文](translations/README.zh-CN.md)

## Install

**Stable builds come from GitHub Releases.** Use the latest Release as the source of truth:

- [Latest Release](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest)
- [WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)
- [SHA256SUMS](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS)

If no Release exists yet, there is no stable build; `dev` and `main` are development/pre-release sources.

### Linux / Docker / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh && sh /tmp/weigg-qb-install.sh --configure
```

The bootstrap installer detects common qBittorrent Docker layouts, keeps a backup, installs the Release payload, writes the exact Git SHA, and prints the qB-visible WebUI path.

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile $env:TEMP\weigg-qb-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-install.ps1 -Configure
```

### Manual install / other systems

Download the latest `WeiG-qB-WebUI.zip`, verify it with `SHA256SUMS`, extract it to a persistent directory, then in qBittorrent enable **Use alternative Web UI** and set **Files location / Root Folder** to that directory as seen by the qBittorrent process.

For Docker, the host path and the path visible inside the container are different. qBittorrent must use the container-visible path.

See [Installation & upgrade](docs/007.安装升级与手动部署.md) for Docker multi-container selection, custom paths, update, rollback, NAS and manual deployment.

## Compatibility

Minimum compatibility target: **qBittorrent 4.1.9.1 / WebAPI 2.2.1**. Newer capabilities are enabled progressively through API/capability detection rather than major-version hard-coding.

## Documentation

- [Installation & upgrade](docs/007.安装升级与手动部署.md)
- [Project contract](docs/001.项目总方案.md)
- [Compatibility](docs/002.兼容与实现状态.md)
- [Architecture](docs/003.项目架构.md)
- [UI & cache contracts](docs/004.UI与缓存契约.md)
- [Responsive interaction/settings system](docs/005.v0.3.7统一交互与设置系统.md)
- [Release & promotion flow](docs/006.发布与晋级流程.md)
- [DESIGN.md](DESIGN.md)

## License

Copyright © 2026 Wei.G / WeiG Share. Licensed under [GNU GPL-3.0](LICENSE).

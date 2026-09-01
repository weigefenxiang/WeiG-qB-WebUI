# WeiG qB WebUI

A modern, responsive Alternate WebUI for qBittorrent, designed for desktop and mobile with one consistent component system.

**Language:** English · [简体中文](translations/README.zh-CN.md)

- GitHub: https://github.com/weigefenxiang/WeiG-qB-WebUI
- Blog: https://www.weigshare.com/
- License: GNU GPL-3.0

## Highlights

- Responsive Torrent, Search, RSS, Logs and Settings views
- qBittorrent 4.1.9.1+ compatibility through WebAPI/capability detection
- Mobile-friendly filters, long-press actions and adaptive navigation
- Desktop right-click torrent actions
- Multi-select for current page or all matching torrents
- Source-verified setting units, conversions and special values
- Official qBittorrent setting translations where verified, with WeiG help fallback
- Dark/light appearance, display timezone and free-space telemetry
- Exact Git-SHA cache identity and rollback-friendly deployment

## Install

Linux / Docker host:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-webui-install.sh
sh /tmp/weigg-qb-webui-install.sh
```

To let the installer update a detected qBittorrent configuration:

```sh
sh /tmp/weigg-qb-webui-install.sh --configure
```

For Docker or a custom installation, inspect the available options first:

```sh
sh /tmp/weigg-qb-webui-install.sh --help
sh /tmp/weigg-qb-webui-install.sh --list-containers
```

Windows PowerShell:

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile $env:TEMP\weigg-qb-webui-install.ps1
powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-webui-install.ps1
```

## Configure qBittorrent

Enable **Use alternative Web UI** in qBittorrent Web UI settings and set **Files location** to the path visible to the qBittorrent process.

For Docker, the host installation directory and the path visible inside the container are different concepts. Use the qB-visible path in qBittorrent.

## Update / rollback

```sh
sh /tmp/weigg-qb-webui-install.sh --update
sh /tmp/weigg-qb-webui-install.sh --rollback
```

The installer keeps deployment metadata, the exact Git SHA and backups for rollback.

## Compatibility

Minimum target:

```text
qBittorrent 4.1.9.1
WebAPI 2.2.1
```

Compatibility is based on API fields and capabilities rather than qBittorrent major-version checks.

## Documentation

- [DESIGN.md](DESIGN.md) — visual and interaction system
- [Project plan](docs/001.项目总方案.md)
- [Compatibility and implementation status](docs/002.兼容与实现状态.md)
- [Architecture](docs/003.项目架构.md)
- [UI and cache contracts](docs/004.UI与缓存契约.md)
- [v0.3.7 unified interaction/settings system](docs/005.v0.3.7统一交互与设置系统.md)

## License

Copyright © 2026 Wei.G / WeiG Share.

WeiG qB WebUI is free software licensed under the [GNU General Public License v3.0](LICENSE).

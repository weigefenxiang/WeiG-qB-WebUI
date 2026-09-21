# WeiG qB WebUI

A responsive qBittorrent Alternate WebUI for desktop and mobile.

**Mobile-friendly · Dark mode · Source-derived compatibility · qBittorrent 4.1.0+**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
</p>

**[Live Preview](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[Download Latest Release](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

## Interface Preview

### Desktop

![WeiG qB WebUI desktop interface](assets/screenshots/weig-qb-webui-desktop-overview.png)

### Mobile

![WeiG qB WebUI mobile interface](assets/screenshots/weig-qb-webui-mobile-overview.png)

## Install

### Manual installation

1. Download and extract `WeiG-qB-WebUI.zip`.
2. Rename the extracted folder to `WeiG_qB-WebUI`.
3. Move the entire folder to a permanent location.
4. In qBittorrent, open **Tools → Options → WebUI**.
5. Enable **Use alternative WebUI** and set **Files location** to the `WeiG_qB-WebUI` directory.

The WebUI root must directly contain:

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── translations/
├── VERSION
└── GIT_SHA
```

For Docker, qBittorrent must receive the path visible **inside the container**, not an arbitrary host path.

### Linux / NAS

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh
sh weig_qb-webui_install.sh -configure
```

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

The installer uses the latest stable GitHub Release by default. Add `-dev` only when you intentionally want the current development build.

See [installers/README.md](installers/README.md) for Docker, multi-instance, custom path, rollback, and exact-version usage.

## Developer Documentation

- [Project architecture](ARCHITECTURE.md)
- [WebUI architecture](webui/ARCHITECTURE.md)
- [Simulator architecture](simulator/ARCHITECTURE.md)
- [Development guide](docs/DEVELOPMENT.md)
- [Compatibility model](docs/COMPATIBILITY.md)
- [Testing guide](tests/README.md)
- [Tooling guide](tools/README.md)
- [Release process](docs/RELEASE.md)
- [Contribution guide](CONTRIBUTING.md)
- [Design system](DESIGN.md)

## Repository Layout

```text
webui/       production Alternate WebUI
simulator/   development and validation environment
tests/       contracts, browser checks, compatibility and real-qB validation
tools/       source extraction, compatibility compilation and build utilities
installers/  Linux and Windows installation lifecycle
docs/        long-lived developer documentation
```

The production WebUI does not depend on the simulator at runtime.

## License

Licensed under the [GNU General Public License v3](LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

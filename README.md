# WeiG qB WebUI

A modern responsive Alternate WebUI for qBittorrent.

**Language**: English · [简体中文](translations/README.zh-CN.md)

## Install channels

- **Release** — stable, default, checksum-verified, recommended for normal use.
- **dev** — current development branch resolved to an exact Git commit. Use it only when you explicitly want the latest development build. It is never used as an automatic fallback for a missing Release.

## Quick Install

### Linux / Docker / NAS

Release (default):

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh && sh /tmp/weigg-qb-install.sh --configure
```

dev:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/dev/installers/install.sh -o /tmp/weigg-qb-install.sh && sh /tmp/weigg-qb-install.sh --channel=dev --configure
```

The installer automatically chooses an available downloader, ZIP extractor and SHA256 tool. It supports common combinations including `curl`, `wget`, BusyBox, Python and `bsdtar`. Release installation always verifies `SHA256SUMS`; dev installation records the exact dev Git SHA.

For multiple qBittorrent Docker containers, list them first:

```sh
sh /tmp/weigg-qb-install.sh --list-containers
```

Then select one explicitly, for example:

```sh
sh /tmp/weigg-qb-install.sh --container=qbittorrent --configure
```

### Windows PowerShell

Release:

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile $env:TEMP\weigg-qb-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-install.ps1 -Channel Release -Configure
```

dev:

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/dev/installers/install.ps1 -OutFile $env:TEMP\weigg-qb-install.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-install.ps1 -Channel Dev -Configure
```

## Direct Release Download

You can always download files in a browser from [GitHub Releases](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest). The two Release files are [WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip) and [SHA256SUMS](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS).

With `curl`:

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -o WeiG-qB-WebUI.zip
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
```

With `wget`:

```sh
wget https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -O WeiG-qB-WebUI.zip
wget https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -O SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
```

On minimal NAS systems, BusyBox can often be used instead:

```sh
busybox wget -O WeiG-qB-WebUI.zip https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip
busybox wget -O SHA256SUMS https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS
busybox sha256sum WeiG-qB-WebUI.zip
busybox unzip WeiG-qB-WebUI.zip
```

If `curl`, `wget` or `unzip` is unavailable, download the ZIP in a browser and copy/upload it to the Linux/NAS host. For extraction, use any available ZIP tool such as `unzip`, `busybox unzip`, `python3 -m zipfile -e WeiG-qB-WebUI.zip .`, or `bsdtar -xf WeiG-qB-WebUI.zip`.

Windows manual extraction:

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip .\WeiG-qB-WebUI -Force
```

## Manual dev Download

The installer is preferred because it resolves `dev` to one exact Git SHA and stamps that SHA into the WebUI files.

For manual testing you may download the branch source from **Code → dev → Download ZIP**, or use:

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/archive/refs/heads/dev.zip -o WeiG-qB-WebUI-dev.zip
unzip WeiG-qB-WebUI-dev.zip
```

With `wget`:

```sh
wget https://github.com/weigefenxiang/WeiG-qB-WebUI/archive/refs/heads/dev.zip -O WeiG-qB-WebUI-dev.zip
unzip WeiG-qB-WebUI-dev.zip
```

For a manually extracted dev source archive, the Alternate WebUI directory is **`WeiG-qB-WebUI-dev/webui/`**. Do not point qBittorrent at the repository root.

## Enable WeiG qB WebUI

In qBittorrent open **Tools / Options (Preferences) → Web UI**, enable **Use alternative WebUI**, and set **Files location / Root Folder** to the extracted WebUI directory as seen by the qBittorrent process.

For Docker, the host path and the container-visible path are different. For example:

```text
Host:       /root/qbittorrent/config/weigg-qb-webui
qBittorrent: /config/weigg-qb-webui
```

qBittorrent must use the container-visible path.

## Update

Run the installer again. Release remains the default channel; use `--channel=dev` on Linux or `-Channel Dev` on Windows to stay on dev.

## Disable / Roll Back

To immediately return to qBittorrent's built-in WebUI, disable **Use alternative WebUI**.

Linux rollback:

```sh
sh /tmp/weigg-qb-install.sh --rollback
```

Windows rollback:

```powershell
powershell -ExecutionPolicy Bypass -File $env:TEMP\weigg-qb-install.ps1 -Mode Rollback
```

## Compatibility

Minimum supported target: **qBittorrent 4.1.9.1**. WeiG qB WebUI supports qBittorrent **4.x and 5.x** with capability-based compatibility handling.

## More Help

For custom paths, Docker multi-container setups, NAS deployment, updates and rollback, see [Installation & Upgrade](docs/007.安装升级与手动部署.md).

## License

Licensed under the [GNU General Public License v3](LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

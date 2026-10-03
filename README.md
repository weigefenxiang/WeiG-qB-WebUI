# WeiG qB WebUI

A modern, responsive qBittorrent Alternate WebUI optimized for desktop and mobile.

**📱 Mobile-friendly · 🌙 Dark mode · ✅ Supports qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 Live Preview](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Download Latest Release](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/weig-qb-webui.zip)**

**Language**: **English** · [简中](translations/README.zh-CN.md) · [繁中](translations/README.zh-TW.md) · [日本語](translations/README.ja.md) · [한국어](translations/README.ko.md) · [Deutsch](translations/README.de.md) · [Français](translations/README.fr.md) · [Español](translations/README.es.md) · [Português](translations/README.pt.md) · [Русский](translations/README.ru.md)

## Direct Download

Download the latest stable **[weig-qb-webui.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/weig-qb-webui.zip)**. Linux/NAS users can also use **`weig-qb-webui.tar.gz`** from the same Release.

The ZIP already contains the canonical top-level folder **`weig-qb-webui`**. Extract it and use that folder directly as qBittorrent's WebUI directory; no rename is required.

## Interface Preview

### Desktop

<p align="center">
  <img src="assets/screenshots/weig-qb-webui-desktop-overview-v1.1.0.png" alt="WeiG qB WebUI desktop interface" width="800">
</p>

### Mobile

<p align="center">
  <img src="assets/screenshots/weig-qb-webui-mobile-overview-v1.1.0.gif" alt="WeiG qB WebUI mobile animation" height="341">
  <img src="assets/screenshots/weig-qb-webui-mobile-overview-v1.1.0.png" alt="WeiG qB WebUI mobile interface" height="341">
</p>

## New User Installation

<details>
<summary><b>First time installing? Expand this 1-minute guide</b></summary>

### 1. Extract the ZIP

Download `weig-qb-webui.zip` and extract it. The archive already produces the canonical folder:

```text
weig-qb-webui/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

The entire **`weig-qb-webui` folder** is the WebUI root. Do not copy only `public` or `private`.

### 2. Move it to a permanent location

Put the whole `weig-qb-webui` folder somewhere you will not accidentally delete later, for example:

```text
Windows: D:\weig-qb-webui
Linux:   /opt/weig-qb-webui
```

This is the directory you will enter in qBittorrent.

### 3. Enable it in qBittorrent

Open qBittorrent:

**Tools → Options... → WebUI**

These are the current qBittorrent English UI terms. Then:

1. Enable **Use alternative WebUI**.
2. Find **Files location:**.
3. Enter the path to the `weig-qb-webui` folder.

Windows example:

```text
D:\weig-qb-webui
```

Regular Linux example:

```text
/opt/weig-qb-webui
```

4. Click **OK** to save.
5. Refresh the qBittorrent WebUI page. If the old page is still cached, try `Ctrl + F5` once.

> **How do I know the path is correct?** The directory you enter should directly contain `public`, `private`, `VERSION`, and the other WebUI files. If you need to enter another `weig-qb-webui` folder before seeing those files, your path is one level too high or too low.

> **Docker users:** qBittorrent runs inside a container, so you usually cannot enter the host path directly. See the **Docker** guide below for the difference between host and container paths.

</details>

## One-click Install

The Linux/NAS one-click installer is always downloaded from the fixed Dev Pages URL below. **The script URL does not choose the install channel:** without `-dev`, it installs the latest verified stable GitHub Release; add `-dev` only when you intentionally want the current development build.

### Linux / NAS

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

<details>
<summary><b>Show script location and default WebUI install directory</b></summary>

```text
./install.sh
```

The WebUI itself is installed by default to:

```text
~/.local/share/weig-qb-webui
```

For example, when running as `root`, this is usually:

```text
/root/.local/share/weig-qb-webui
```

</details>

### Docker

<details>
<summary><b>Docker one-click install / multiple containers / path guide (recommended for beginners)</b></summary>

#### First understand “host” and “container”

If qBittorrent is running in Docker on a VPS, Linux server, Synology, QNAP, or another NAS:

- **Host**: the real Linux/NAS machine that runs Docker — the system you see after SSH login.
- **Container**: the isolated environment Docker creates for qBittorrent. qBittorrent can directly see container paths, not arbitrary host paths.

For example, your qBittorrent container may have this mapping:

```text
Host:      /root/qbittorrent/config
   ↓ mapped to
Container: /config
```

A typical Docker Compose entry looks like:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

The left side of the colon, `/root/qbittorrent/config`, is the **host path**. The right side, `/config`, is the **container path**.

If WeiG qB WebUI is physically installed at:

```text
Host: /root/qbittorrent/config/weig-qb-webui
```

then qBittorrent **Files location:** should be:

```text
/config/weig-qb-webui
```

**Do not enter `/root/qbittorrent/config/weig-qb-webui` in qBittorrent**, because the container usually cannot see that host path directly.

#### Case 1: only one running qBittorrent container

Use the normal one-click command:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

The installer will try to detect the running qBittorrent container, detect its `/config` mapping, install the WebUI in the corresponding host location, and configure qBittorrent automatically.

#### Case 2: find the qBittorrent container name first

If you are not sure what the container is called:

```sh
sh install.sh --list-containers
```

You can also use Docker directly:

```sh
docker ps
```

If the qBittorrent container is named:

```text
qbittorrent
```

select it explicitly:

```sh
sh install.sh --container=qbittorrent -configure
```

#### Case 3: multiple qBittorrent containers

For example:

```text
qbittorrent
qbittorrent-test
```

List them first:

```sh
sh install.sh --list-containers
```

Install for the main `qbittorrent` container:

```sh
sh install.sh --container=qbittorrent -configure
```

Install for the test container:

```sh
sh install.sh --container=qbittorrent-test -configure
```

The installer will not silently guess between multiple qBittorrent containers.

#### Case 4: you already know the host directory mounted as `/config`

For example:

```text
/root/qbittorrent/config
```

Specify it directly:

```sh
sh install.sh --config-root=/root/qbittorrent/config -configure
```

A Synology path might look like:

```sh
sh install.sh --config-root=/volume1/docker/qbittorrent -configure
```

Another NAS might use something like:

```sh
sh install.sh --config-root=/share/Container/qbittorrent -configure
```

These are examples only. **Replace them with the real host path that is mounted as qBittorrent `/config`.**

#### Case 5: choose the WebUI install path

After selecting a container, you can also choose the container-visible WebUI location:

```sh
sh install.sh --container=qbittorrent -o /config/weig-qb-webui -configure
```

The installer converts the `/config/...` container path to the corresponding host install path.

#### Case 6: update multiple existing WebUI directories with one download

For multiple qBittorrent instances, repeat `-o`. The payload is downloaded and verified once, all targets are prepared before switching, and each target keeps its own latest three backups under `~/.config/weig_qb-webui/backups/`.

```sh
sh install.sh -dev \
  -o /root/qbittorrent/config/weig-qb-webui \
  -o /root/qbittorrent3/config/weig-qb-webui
```

Do not add `-configure` in multi-target mode; each qBittorrent instance keeps its existing Alternative WebUI Root Folder. To see the current command syntax, run `sh install.sh -help`.

#### What should I see after installation?

A successful install prints values similar to:

```text
Host install path: /root/qbittorrent/config/weig-qb-webui
qBittorrent Root Folder: /config/weig-qb-webui
```

Meaning:

- `Host install path`: where the files are physically stored on the host;
- `qBittorrent Root Folder`: **the container path qBittorrent should use for Files location**.

If `-configure` successfully finds the qBittorrent configuration, the installer enables **Use alternative WebUI** and sets the path automatically. Otherwise, follow the manual steps in **New User Installation → Enable it in qBittorrent** above.

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\install.ps1; powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

<details>
<summary><b>Show install directory</b></summary>

```text
C:\Users\<your-username>\AppData\Local\weig-qb-webui
```

</details>

## Common Options
Linux and Windows use the same public option names where practical. Documentation uses lowercase; PowerShell parameter names are case-insensitive.

| Purpose | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Stable main | Default, no option | Default, no option |
| Specific Release | `-version 1.0.0` | `-version 1.0.0` |
| Development build | `-dev` | `-dev` |
| Custom install directory | `-o /path` (repeatable on Linux) | `-o D:\path` or `-output D:\path` |
| Configure qBittorrent automatically | `-configure` | `-configure` |
| Roll back the previous install | `-rollback` | `-rollback` |
| Complete uninstall (do not keep installer backups) | `-uninstall -purge` | `-uninstall -purge` |
| Full help | `-help` | `-help` |
| Select Docker container | `--container=NAME` | — |
| List Docker containers | `--list-containers` | — |
| Specify host directory mounted as Docker `/config` | `--config-root=/path` | — |

<details>
<summary><b>Notes: (click to expand)</b></summary>

Notes:

- No `-dev` option means stable `main`; `-dev` selects the current development exact Git SHA.
- `-o` means **output** and selects the WeiG qB WebUI install directory. On Linux it may be repeated to update multiple existing targets with one verified download.
- Installer backups stay under `~/.config/weig_qb-webui/backups/` and the latest **3 backups are retained independently per install target**.
- `-configure` enables qBittorrent **Use alternative WebUI** and sets **Files location** after installation. It is intentionally single-target only.
- `-rollback` restores the newest installer-owned backup for the selected target; repeat `-o` to roll back multiple explicit targets.
- `-version` installs an exact GitHub Release such as `1.0.0`. If the requested version does not exist, installation fails and **never falls back to latest or dev**.
- `-help` shows the current Linux syntax. Long `--...` forms remain accepted as compatibility aliases.
- With multiple qBittorrent Docker containers, use `--list-containers`, then select one with `--container=NAME`. You can also use `--config-root=/path` if you already know the host qBittorrent configuration directory.

### Specific version and install directory

Linux:

```sh
sh install.sh -version 1.0.0 -o /opt/weig-qb-webui -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -version 1.0.0 -o D:\weig-qb-webui -configure
```

### Rollback

Linux:

```sh
sh install.sh -rollback
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback
```

</details>

## One-click Uninstall

<details>
<summary><b>Linux / NAS, Docker, and Windows PowerShell complete uninstall</b></summary>

The recommended command below performs a complete uninstall **without keeping installer backups**: it removes the WebUI, disables the matching alternative WebUI configuration, purges installer-owned backups / rollback state for this target, and then deletes the downloaded installer script from the current directory.

### Linux / NAS

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

For a custom install directory, add `-o /path/to/weig-qb-webui`.

### Docker

Single container / automatic detection:

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Multiple containers:

```sh
sh install.sh -uninstall -configure -purge --container=qbittorrent && rm -f -- ./install.sh
```

When using `--config-root`:

```sh
sh install.sh -uninstall -configure -purge --config-root=/path/to/qbittorrent/config && rm -f -- ./install.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -uninstall -configure -purge; if ($LASTEXITCODE -eq 0) { Remove-Item .\install.ps1 -Force }
```

For a custom install directory, add `-o D:\weig-qb-webui`.

`-purge` only removes backups owned by the current uninstall target; it does not touch backups for other installations. When the shared state directory becomes empty, Linux `~/.config/weig_qb-webui` (for root: `/root/.config/weig_qb-webui`) or Windows `%APPDATA%\WeiG_qB-WebUI` is removed as well.

To keep installer backups for a later `-rollback`, simply omit `-purge`.

</details>

## More Help

For Docker multi-container setups, NAS deployment, custom paths, updates, and advanced installation details, see the detailed [Installation, Upgrade & Manual Deployment Guide](translations/installation-guide/deployment-guide.en.md).

## License

Licensed under the [GNU General Public License v3](LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

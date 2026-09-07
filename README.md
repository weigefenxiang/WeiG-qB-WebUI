# WeiG qB WebUI

A modern, responsive qBittorrent Alternate WebUI optimized for desktop and mobile.

**📱 Mobile-friendly · 🖥️ Responsive desktop · 🌙 Dark mode · ✅ Supports qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 Live Preview](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Download Latest Release](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**Language**: **English** · [简中](translations/README.zh-CN.md) · [繁中](translations/README.zh-TW.md) · 日本語 · 한국어 · Deutsch · Français · Español · Português · Русский

## Direct Download

Download the latest stable **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**.

After extraction, the **`WeiG-qB-WebUI` folder itself is the WebUI directory qBittorrent should use**.

## New User Installation

<details>
<summary><b>First time installing? Expand this 1-minute guide</b></summary>

### 1. Extract the ZIP

Download and extract `WeiG-qB-WebUI.zip`. You should get:

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

The entire **`WeiG-qB-WebUI` folder** is the WebUI root. Do not copy only `public` or `private`.

### 2. Move it to a permanent location

Put the whole `WeiG-qB-WebUI` folder somewhere you will not accidentally delete later, for example:

```text
Windows: D:\WeiG-qB-WebUI
Linux:   /opt/WeiG-qB-WebUI
```

This is the directory you will enter in qBittorrent.

### 3. Enable it in qBittorrent

Open qBittorrent:

**Tools → Options... → WebUI**

These are the current qBittorrent English UI terms. Then:

1. Enable **Use alternative WebUI**.
2. Find **Files location:**.
3. Enter the path to the `WeiG-qB-WebUI` folder.

Windows example:

```text
D:\WeiG-qB-WebUI
```

Regular Linux example:

```text
/opt/WeiG-qB-WebUI
```

4. Click **OK** to save.
5. Refresh the qBittorrent WebUI page. If the old page is still cached, try `Ctrl + F5` once.

> **How do I know the path is correct?** The directory you enter should directly contain `public`, `private`, `VERSION`, and the other WebUI files. If you need to enter another `WeiG-qB-WebUI` folder before seeing those files, your path is one level too high or too low.

> **Docker users:** qBittorrent runs inside a container, so you usually cannot enter the host path directly. See the **Docker** guide below for the difference between host and container paths.

</details>

## One-click Install

The one-click installer is downloaded from the stable `main` branch. **By default it installs the latest stable GitHub Release** and verifies `SHA256SUMS`. The installer script is kept in the current directory for later updates or rollback.

### Linux / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>Show script location and default WebUI install directory</b></summary>

```text
./weigg-install.sh
```

The WebUI itself is installed by default to:

```text
~/.local/share/weigg-qb-webui
```

For example, when running as `root`, this is usually:

```text
/root/.local/share/weigg-qb-webui
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
Host: /root/qbittorrent/config/weigg-qb-webui
```

then qBittorrent **Files location:** should be:

```text
/config/weigg-qb-webui
```

**Do not enter `/root/qbittorrent/config/weigg-qb-webui` in qBittorrent**, because the container usually cannot see that host path directly.

#### Case 1: only one running qBittorrent container

Use the normal one-click command:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

The installer will try to detect the running qBittorrent container, detect its `/config` mapping, install the WebUI in the corresponding host location, and configure qBittorrent automatically.

#### Case 2: find the qBittorrent container name first

If you are not sure what the container is called:

```sh
sh weigg-install.sh --list-containers
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
sh weigg-install.sh --container=qbittorrent --configure
```

#### Case 3: multiple qBittorrent containers

For example:

```text
qbittorrent
qbittorrent-test
```

List them first:

```sh
sh weigg-install.sh --list-containers
```

Install for the main `qbittorrent` container:

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

Install for the test container:

```sh
sh weigg-install.sh --container=qbittorrent-test --configure
```

The installer will not silently guess between multiple qBittorrent containers.

#### Case 4: you already know the host directory mounted as `/config`

For example:

```text
/root/qbittorrent/config
```

Specify it directly:

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

A Synology path might look like:

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

Another NAS might use something like:

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

These are examples only. **Replace them with the real host path that is mounted as qBittorrent `/config`.**

#### Case 5: choose the WebUI install path

After selecting a container, you can also choose the container-visible WebUI location:

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

The installer converts the `/config/...` container path to the corresponding host install path.

#### What should I see after installation?

A successful install prints values similar to:

```text
Host install path: /root/qbittorrent/config/weigg-qb-webui
qBittorrent Root Folder: /config/weigg-qb-webui
```

Meaning:

- `Host install path`: where the files are physically stored on the host;
- `qBittorrent Root Folder`: **the container path qBittorrent should use for Files location**.

If `--configure` successfully finds the qBittorrent configuration, the installer enables **Use alternative WebUI** and sets the path automatically. Otherwise, follow the manual steps in **New User Installation → Enable it in qBittorrent** above.

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>Show install directory</b></summary>

```text
C:\Users\<your-username>\AppData\Local\WeiG-qB-WebUI
```

</details>

## Common Options

<details>
<summary><b>Options / specific version / custom directory / rollback (expand)</b></summary>

Linux and Windows use the same public option names where practical. Documentation uses lowercase; PowerShell parameter names are case-insensitive.

| Purpose | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Latest stable Release | Default, no option | Default, no option |
| Specific Release | `--version 0.3.60` | `-version 0.3.60` |
| Development build | `--dev` | `-dev` |
| Custom install directory | `-o /path` or `--output /path` | `-o D:\path` or `-output D:\path` |
| Configure qBittorrent automatically | `--configure` | `-configure` |
| Roll back the previous install | `--rollback` | `-rollback` |
| Full help | `--help` | `-help` |
| Select Docker container | `--container=NAME` | — |
| List Docker containers | `--list-containers` | — |
| Specify host directory mounted as Docker `/config` | `--config-root=/path` | — |

Notes:

- `-o` means **output** and selects the WeiG qB WebUI install directory.
- `--configure / -configure` enables qBittorrent **Use alternative WebUI** and sets **Files location** after installation. The qBittorrent configuration is backed up first.
- `--rollback / -rollback` restores the previous WebUI installation and matching qBittorrent configuration. The installer remembers the last install directory by default.
- `--version / -version` installs an exact GitHub Release such as `0.3.60`. If the requested version does not exist, installation fails and **never falls back to latest or dev**.
- `--dev / -dev` is for testing the current development branch at an exact Git SHA. It cannot be combined with `--version / -version`.
- With multiple qBittorrent Docker containers, use `--list-containers`, then select one with `--container=NAME`. You can also use `--config-root=/path` if you already know the host qBittorrent configuration directory.

### Specific version and install directory

Linux:

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

### Rollback

Linux:

```sh
sh weigg-install.sh --rollback
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

</details>

## More Help

For Docker multi-container setups, NAS deployment, custom paths, updates, and advanced installation details, see the bilingual [Installation, Upgrade & Manual Deployment Guide](docs/007.安装升级与手动部署.md).

## License

Licensed under the [GNU General Public License v3](LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

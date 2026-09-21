# Beginner Installation & Upgrade Guide

**Language**: **English** · [简中](deployment-guide.zh-CN.md) · [繁中](deployment-guide.zh-TW.md) · [日本語](deployment-guide.ja.md) · [한국어](deployment-guide.ko.md) · [Deutsch](deployment-guide.de.md) · [Français](deployment-guide.fr.md) · [Español](deployment-guide.es.md) · [Português](deployment-guide.pt.md) · [Русский](deployment-guide.ru.md)

This guide is written for beginners. **Most users should install the latest stable Release**. Use `dev` only when you intentionally want to test the development build.

Supported qBittorrent range: **4.1.x → 5.2.x**.

> If you only want the fastest path, jump to **Linux / NAS**, **Docker**, or **Windows PowerShell** and copy the main command. Extra explanations and examples are collapsed by default.

## 1. Linux / NAS one-click install

Recommended one-click command:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Show script location, default install directory, and more (click to expand)</b></summary>



This saves `weig_qb-webui_install.sh` in the current directory, installs the latest stable Release, and tries to configure qBittorrent automatically.

### Default install directory

Normal user:

```text
~/.local/share/weig_qb-webui
```

Example:

```text
/home/alex/.local/share/weig_qb-webui
```

When running as `root`:

```text
/root/.local/share/weig_qb-webui
```

The installer script itself remains in the current directory:

```text
./weig_qb-webui_install.sh
```

### Example 1: latest Release + automatic qBittorrent configuration

```sh
sh weig_qb-webui_install.sh -configure
```

### Example 2: install files only

```sh
sh weig_qb-webui_install.sh
```

Then configure qBittorrent manually:

**Tools → Options... → WebUI**

1. Enable **Use alternative WebUI**.
2. Set **Files location:** to the WeiG qB WebUI directory.
3. Click **OK**.

### Example 3: install a specific Release

```sh
sh weig_qb-webui_install.sh -version 0.1.0 -configure
```

### Example 4: custom directory

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

Equivalent long form:

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

### Example 5: specific version + custom directory

```sh
sh weig_qb-webui_install.sh -version 0.1.0 -o /opt/weig_qb-webui -configure
```

### Example 6: test dev

```sh
sh weig_qb-webui_install.sh -dev -configure
```

### Example 7: upgrade to the latest Release

Run the installer again:

```sh
sh weig_qb-webui_install.sh -configure
```

To move to another pinned version:

```sh
sh weig_qb-webui_install.sh -version 0.1.1 -configure
```

Remove `-version` to return to latest.

### Example 8: rollback

```sh
sh weig_qb-webui_install.sh -rollback
```

The installer remembers the previous destination when possible and restores the previous WebUI/config backup.

### Example 9: help

```sh
sh weig_qb-webui_install.sh -help
```

### What tools does Linux need?

For downloads, the installer can use common tools such as `curl`, `wget`, BusyBox `wget`, or Python 3. For ZIP extraction it can use `unzip`, BusyBox `unzip`, Python 3 `zipfile`, or `bsdtar`.

For Release verification it looks for a SHA-256 implementation such as `sha256sum`, BusyBox, `shasum`, OpenSSL, or Python 3. **If no SHA-256 implementation is available, a Release install is refused rather than installed without verification.**

</details>

---

---

## 2. Docker one-click install

If qBittorrent runs in Docker, try the same one-click command first:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Docker paths, multiple containers, and advanced usage (click to expand)</b></summary>



If there is only one running qBittorrent container and it exposes a normal `/config` mount, the installer will try to detect it automatically.

### Host path vs container path

Example Docker Compose mapping:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

This means:

```text
Host:      /root/qbittorrent/config
Container: /config
```

If WeiG qB WebUI is physically stored at:

```text
/root/qbittorrent/config/weig_qb-webui
```

then qBittorrent **Files location:** should normally be:

```text
/config/weig_qb-webui
```

Do not enter the host path in qBittorrent unless the container can actually see that host path.

### Default Docker path mapping

When the installer detects:

```text
Container /config -> Host /root/qbittorrent/config
```

and you did not provide `-o`, it uses:

```text
Host install path: /root/qbittorrent/config/weig_qb-webui
qBittorrent Root Folder: /config/weig_qb-webui
```

### Example 1: one qBittorrent container

```sh
sh weig_qb-webui_install.sh -configure
```

### Example 2: list detected containers

```sh
sh weig_qb-webui_install.sh --list-containers
```

You can also inspect Docker directly:

```sh
docker ps
```

### Example 3: select a container explicitly

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

Also valid:

```sh
sh weig_qb-webui_install.sh --container qbittorrent -configure
```

### Example 4: multiple qBittorrent containers

```text
qbittorrent
qbittorrent-test
qbittorrent-old
```

List them:

```sh
sh weig_qb-webui_install.sh --list-containers
```

Install for the main container:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

Install for the test container:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

The installer refuses to guess when multiple qBittorrent containers are detected.

### Example 5: specify the host directory mounted as `/config`

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

### Example 6: Synology example

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

### Example 7: another NAS example

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

Replace these sample paths with the real host directory mounted as `/config` on your system.

### Example 8: choose a container-visible WebUI path

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

If `/config` maps to `/root/qbittorrent/config`, the installer maps the destination to:

```text
/config/weig_qb-webui
        ↓
/root/qbittorrent/config/weig_qb-webui
```

### Example 9: choose a host-side WebUI path

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -o /root/qbittorrent/config/weig_qb-webui -configure
```

The corresponding qBittorrent path becomes `/config/weig_qb-webui`.

### Example 10: specific Release

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -version 0.1.0 -configure
```

### Example 11: dev

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -dev -configure
```

### Example 12: rollback

```sh
sh weig_qb-webui_install.sh -rollback
```

### Most common Docker mistake

Entering this host path in qBittorrent:

```text
/root/qbittorrent/config/weig_qb-webui
```

when qBittorrent runs inside the container. Usually qBittorrent needs:

```text
/config/weig_qb-webui
```

### No `/config` mount?

Automatic Docker configuration relies on a usable `/config` mount. If the container does not expose one, confirm your Docker Compose or `docker run` volume configuration first.

</details>

---

---

## 3. Windows one-click install

Recommended one-click command:

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>Show default install directory and more Windows usage (click to expand)</b></summary>



This saves `weig_qb-webui_install.ps1` in the current PowerShell directory, installs the latest stable Release, and tries to configure qBittorrent automatically.

### Default install directory

```text
C:\Users\<your-username>\AppData\Local\WeiG_qB-WebUI
```

Equivalent environment variable form:

```text
%LOCALAPPDATA%\WeiG_qB-WebUI
```

### Example 1: latest Release + automatic configuration

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Example 2: install files only

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1
```

Then use qBittorrent:

**Tools → Options... → WebUI**

Enable **Use alternative WebUI** and set **Files location:** to the install directory.

### Example 3: specific Release

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 0.1.0 -configure
```

### Example 4: install on D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -o D:\WeiG_qB-WebUI -configure
```

Equivalent:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -output D:\WeiG_qB-WebUI -configure
```

### Example 5: version + custom directory

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 0.1.0 -o D:\WeiG_qB-WebUI -configure
```

### Example 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

### Example 7: upgrade

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

Or pin a newer Release:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 0.1.1 -configure
```

### Example 8: rollback

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

### Example 9: help

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -help
```

### PowerShell option casing

These are equivalent:

```text
-configure
-Configure
-CONFIGURE
```

### Why `-ExecutionPolicy Bypass`?

Windows may block local scripts under the current execution policy. This flag applies to that PowerShell process; it does not permanently change the system-wide execution policy.

</details>

---

---

## 4. How to upgrade and roll back


Re-running the installer is the normal upgrade method.

<details>
<summary><b>Show upgrade and rollback commands (click to expand)</b></summary>

Linux:

```sh
sh weig_qb-webui_install.sh -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

Rollback:

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

If you only want to immediately return to qBittorrent's built-in WebUI, open **Tools → Options... → WebUI** and disable **Use alternative WebUI**.

---

</details>

---

## 5. Common options

Linux / Docker / NAS use `install.sh`; Windows uses `install.ps1`. PowerShell option names are case-insensitive, but this documentation uses lowercase consistently.

| Purpose | Linux / Docker / NAS | Windows PowerShell | Notes |
|---|---|---|---|
| Latest stable Release | Default, no option | Default, no option | Recommended |
| Specific Release | `-version 0.1.0` | `-version 0.1.0` | Install only that Release |
| Development build | `-dev` | `-dev` | Current `dev` exact Git SHA |
| Install directory | `-o /path` or `-o /path` | `-o D:\path` or `-output D:\path` | `o` = output |
| Configure qBittorrent automatically | `-configure` | `-configure` | Enable alternative WebUI and set the path |
| Roll back | `-rollback` | `-rollback` | Restore the previous install and qB config |
| Help | `-help` | `-help` | Show full installer help |
| Select Docker container | `--container=NAME` | — | Useful with multiple qB containers |
| List Docker containers | `--list-containers` | — | Show detected qB containers |
| Specify host `/config` directory | `--config-root=/path` | — | Use when you already know the mount source |

<details>
<summary><b>Notes: (click to expand)</b></summary>

Important rules:

- With **no source option**, the installer uses the latest stable Release.
- `-version` installs exactly the requested Release. If it does not exist, installation stops; it **never falls back to latest or dev**.
- `-dev` and `-version` cannot be used together.
- `-configure` backs up qBittorrent configuration before changing it.
- `-rollback` restores the previous WebUI and matching qBittorrent configuration when a backup is available.
- Legacy options such as Linux `--channel=release|dev`, `--dir=...`, `--update` and Windows `-Channel`, `-Destination`, `-Mode` remain for compatibility, but new deployments should use the options above.

</details>

---

## 6. Manual installation

You can install without running the scripts.

Latest Release page:

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

Download:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>Expand: manual download, verification and qBittorrent setup</b></summary>

### Linux with curl

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -o WeiG-qB-WebUI.zip
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
mv WeiG-qB-WebUI WeiG_qB-WebUI
```

### Linux with wget

```sh
wget https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -O WeiG-qB-WebUI.zip
wget https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -O SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
```

### Windows

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip . -Force
Rename-Item .\WeiG-qB-WebUI WeiG_qB-WebUI
```

To calculate SHA-256 manually:

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

Compare it with the `WeiG-qB-WebUI.zip` entry in `SHA256SUMS`.

### Expected extracted structure

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

### Enable the alternative WebUI manually

Open qBittorrent:

**Tools → Options... → WebUI**

Enable **Use alternative WebUI** and set **Files location:** to the `WeiG_qB-WebUI` root directory.

Windows example:

```text
D:\WeiG_qB-WebUI
```

Linux example:

```text
/opt/WeiG_qB-WebUI
```

Docker example:

```text
/config/weig_qb-webui
```

</details>

---

---

## 7. Troubleshooting

<details>
<summary><b>Expand: stale page, 404, Docker path errors, multiple containers, checksum errors</b></summary>

### The old page still appears

Try:

```text
Ctrl + F5
```

An incognito/private browser window can also help confirm whether cache is involved.

### 404 or the WebUI does not load

Check **Files location:**. That directory should directly contain:

```text
public
private
VERSION
GIT_SHA
```

If you must enter another `WeiG_qB-WebUI` directory before seeing those files, the configured path is one level too high or too low.

### Docker cannot find the installed files

You may have entered a host path instead of the container-visible path. Typical container path:

```text
/config/weig_qb-webui
```

### Multiple qBittorrent containers detected

```sh
sh weig_qb-webui_install.sh --list-containers
```

Then choose one explicitly:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### `-configure` did not configure qBittorrent

The WebUI files may still be installed successfully. Configure qBittorrent manually using the steps above.

### Release checksum verification failed

Do not bypass it. Re-download and retry. The installer intentionally fails closed if `WeiG-qB-WebUI.zip` and `SHA256SUMS` do not match.

### Requested version does not exist

For example:

```sh
sh weig_qb-webui_install.sh -version 9.9.9
```

The installer stops and does not switch to latest or dev.

</details>

---

---

## 8. How to confirm the installed version

Check these files in the install directory:

```text
VERSION
GIT_SHA
private/weigg-install.json
```

- `VERSION`: WeiG qB WebUI version.
- `GIT_SHA`: exact Git commit for the installed payload.
- `private/weigg-install.json`: installer metadata such as source, SHA, host path, qB path, and Docker information.

---

---

## 9. Compatibility

Current supported range:

```text
qBittorrent 4.1.x → 5.2.x
```

The minimum mainline WebAPI v2 target is **qBittorrent 4.1.0**. qBittorrent 4.0.x uses the older WebAPI v1 and is outside the current mainline support statement.

---

---

## 10. Advanced / maintainer notes

<details>
<summary><b>Expand: exact SHA, Release identity and legacy options</b></summary>

### exact SHA

A `dev` install first resolves the current `dev` branch to a 40-character Git SHA, deploys that exact commit, and writes it into `GIT_SHA`.

### Release identity

A normal Release must provide:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

The installer validates checksum, `VERSION`, and a valid `GIT_SHA`. A specifically requested Release never falls back automatically.

### Legacy compatibility

Linux still accepts:

```text
--channel=release
--channel=dev
--dir=/path
--update
```

Windows still accepts:

```text
-Channel Release
-Channel Dev
-Destination PATH
-Mode Install
-Mode Update
-Mode Rollback
```

These exist for older users and automation. Prefer the current options at the top of this guide for new deployments.

</details>

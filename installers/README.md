# Installer Guide

The repository provides Linux/NAS/Docker and Windows PowerShell installers.

- `install.sh`
- `install.ps1`

Both installers support stable Release installs and exact development payloads.

## 1. Channels

The installer script itself is published from the development Pages location. The script URL does not select the payload channel.

- No `-dev`: install the latest verified stable GitHub Release.
- `-dev`: install the current development payload published by Virtual qB Pages.
- `-version X.Y.Z`: install an exact GitHub Release version.

An unavailable exact version fails closed; it does not fall back to another channel.

## 2. Linux / NAS

Download:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh
```

Install and configure qBittorrent:

```sh
sh weig_qb-webui_install.sh -configure
```

Development build:

```sh
sh weig_qb-webui_install.sh -dev -configure
```

Custom install directory:

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

## 3. Windows PowerShell

Download:

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1
```

Install and configure:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

Development build:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

## 4. Docker

qBittorrent sees container paths, not arbitrary host paths.

Example mapping:

```text
Host:      /root/qbittorrent/config
Container: /config
```

If the WebUI is physically installed at:

```text
/root/qbittorrent/config/weig_qb-webui
```

then qBittorrent should use:

```text
/config/weig_qb-webui
```

List detected qBittorrent containers:

```sh
sh weig_qb-webui_install.sh --list-containers
```

Select one explicitly:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

If you already know the host directory mounted as `/config`:

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

The installer does not silently choose between multiple qBittorrent containers.

## 5. Multiple Install Targets

Linux supports repeated `-o` arguments so one verified payload can update multiple existing WebUI directories:

```sh
sh weig_qb-webui_install.sh -dev \
  -o /root/qbittorrent/config/weig_qb-webui \
  -o /root/qbittorrent3/config/weig_qb-webui
```

Configuration mutation is intentionally separate. Do not use `-configure` for a multi-target update.

## 6. Configuration

`-configure` enables qBittorrent's Alternative WebUI and writes the WebUI root folder when the installer can safely resolve the target configuration.

A normal file refresh without `-configure` does not rewrite qBittorrent configuration and does not require stopping qBittorrent.

## 7. Backups and Rollback

Installer-owned backups are retained per target under:

```text
~/.config/weig_qb-webui/backups/
```

The current installer retains the latest three backups independently per install target.

Rollback:

Linux:

```sh
sh weig_qb-webui_install.sh -rollback
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

## 8. Payload Integrity

Development payloads are materialized by Virtual qB Pages and include:

- `WeiG-qB-WebUI.zip`
- `SHA256SUMS`
- `GIT_SHA`
- `VERSION`
- installer scripts
- distribution metadata

The installer verifies the payload identity before switching the target directory.

A development install does not fall back to raw repository source when the materialized payload is missing or invalid.

A newer repository commit may reuse an older materialized development payload only when every intervening change is outside the public payload inputs. Product, simulator, installer, version and relevant compatibility-materialization changes require a new payload; repository-only documentation changes do not.

## 9. Help

Show current Linux syntax:

```sh
sh weig_qb-webui_install.sh -help
```

PowerShell parameter names are case-insensitive. Linux also accepts supported long-form compatibility aliases where documented by the script.

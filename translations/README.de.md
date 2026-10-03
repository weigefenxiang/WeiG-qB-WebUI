# WeiG qB WebUI

Eine moderne, responsive qBittorrent Alternate WebUI, optimiert für Desktop und Mobilgeräte.

**📱 Mobilfreundlich · 🌙 Dunkelmodus · ✅ Unterstützt qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 Online-Vorschau](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Neueste stabile Version herunterladen](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest)**

**Sprache**: [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Deutsch** · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

## Direkt herunterladen

Lade die neueste stabile **[weig-qb-webui.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest)** herunter.

Historische unveränderliche Releases behalten ihre ursprünglich veröffentlichten Asset-Namen; der Installer liest diese alten Namen nur über einen klar begrenzten Kompatibilitätspfad.

Das ZIP enthält bereits den kanonischen obersten Ordner **`weig-qb-webui`**. Entpacke ihn und verwende diesen Ordner direkt als WebUI-Verzeichnis für qBittorrent; ein Umbenennen ist nicht nötig.

## Oberflächenvorschau

### Desktop

<p align="center">
  <img src="../assets/screenshots/weig-qb-webui-desktop-overview-v1.1.0.png" alt="WeiG qB WebUI Desktop-Oberfläche" width="800">
</p>

### Mobil

<p align="center">
  <img src="../assets/screenshots/weig-qb-webui-mobile-overview-v1.1.0.gif" alt="WeiG qB WebUI Mobil-Animation" height="341">
  <img src="../assets/screenshots/weig-qb-webui-mobile-overview-v1.1.0.png" alt="WeiG qB WebUI Mobil-Oberfläche" height="341">
</p>

## Installation für Einsteiger

<details>
<summary><b>Zum ersten Mal? 1-Minuten-Anleitung aufklappen</b></summary>

### 1. ZIP entpacken

Lade `weig-qb-webui.zip` herunter und entpacke es. Das Archiv erzeugt bereits den kanonischen Ordner:

```text
weig-qb-webui/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

Der gesamte Ordner **`weig-qb-webui`** ist das WebUI-Stammverzeichnis. Nicht nur `public` oder `private` kopieren.

### 2. An einen festen Ort verschieben

Zum Beispiel:

```text
Windows: D:\weig-qb-webui
Linux:   /opt/weig-qb-webui
```

Diesen Pfad trägst du anschließend in qBittorrent ein.

### 3. In qBittorrent aktivieren

Öffne qBittorrent:

**Werkzeuge → Optionen ... → WebUI**

Das sind die aktuellen Begriffe der offiziellen deutschen qBittorrent-Oberfläche. Danach:

1. **Alternative Weboberfläche verwenden** aktivieren.
2. **Speicherort der Dateien:** suchen.
3. Den Pfad zum Ordner `weig-qb-webui` eintragen.

Windows-Beispiel:

```text
D:\weig-qb-webui
```

Linux-Beispiel:

```text
/opt/weig-qb-webui
```

4. Mit **OK** speichern.
5. Die qBittorrent-WebUI neu laden. Falls die alte Ansicht im Cache bleibt, `Ctrl + F5` verwenden.

> **Pfad prüfen:** Im eingetragenen Ordner müssen `public`, `private`, `VERSION` usw. direkt sichtbar sein.

> **Docker:** qBittorrent läuft im Container. Deshalb muss in qBittorrent normalerweise ein container-sichtbarer Pfad eingetragen werden, nicht der Host-Pfad.

</details>

## Ein-Klick-Installation

Das Linux-/NAS-Installationsskript wird immer über den festen Dev-Pages-Link unten geladen. **Die Skriptadresse bestimmt nicht den Installationskanal:** ohne `-dev` wird die neueste geprüfte stabile GitHub-Release installiert; `-dev` ist nur für die aktuelle Entwicklungsversion.

### Linux / NAS

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

<details>
<summary><b>Skript- und Standard-Installationspfad anzeigen</b></summary>

```text
./install.sh
```

Standardpfad der WebUI:

```text
~/.local/share/weig-qb-webui
```

Bei Ausführung als `root` typischerweise:

```text
/root/.local/share/weig-qb-webui
```

</details>

### Docker

<details>
<summary><b>Docker-Ein-Klick-Installation / mehrere Container / Pfade</b></summary>

#### Host und Container

- **Host**: das Linux-/NAS-System, auf dem Docker läuft.
- **Container**: die isolierte Umgebung, in der qBittorrent läuft.

Beispiel:

```text
Host:      /root/qbittorrent/config
   ↓ gemountet als
Container: /config
```

Docker Compose:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Liegt die WebUI auf dem Host unter:

```text
/root/qbittorrent/config/weig-qb-webui
```

muss qBittorrent bei **Speicherort der Dateien:** verwenden:

```text
/config/weig-qb-webui
```

#### Ein qBittorrent-Container

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

Der Installer versucht Container und `/config`-Mount automatisch zu erkennen.

#### Container anzeigen

```sh
sh install.sh --list-containers
```

Oder:

```sh
docker ps
```

Einen Container ausdrücklich wählen:

```sh
sh install.sh --container=qbittorrent -configure
```

Bei mehreren qBittorrent-Containern wählt der Installer nicht automatisch einen aus.

#### Host-Pfad für `/config` angeben

```sh
sh install.sh --config-root=/root/qbittorrent/config -configure
```

Synology-Beispiel:

```sh
sh install.sh --config-root=/volume1/docker/qbittorrent -configure
```

Anderes NAS:

```sh
sh install.sh --config-root=/share/Container/qbittorrent -configure
```

#### WebUI-Zielpfad festlegen

```sh
sh install.sh --container=qbittorrent -o /config/weig-qb-webui -configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\install.ps1; powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

<details>
<summary><b>Installationspfad anzeigen</b></summary>

```text
C:\Users\<Benutzername>\AppData\Local\weig-qb-webui
```

</details>

## Häufige Optionen
PowerShell-Parameternamen unterscheiden nicht zwischen Groß- und Kleinschreibung.

| Zweck | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Neuester stabiler Release | Standard | Standard |
| Bestimmter Release | `-version 1.0.0` | `-version 1.0.0` |
| Entwicklungsstand | `-dev` | `-dev` |
| Zielordner | `-o /path` oder `-o /path` | `-o D:\path` oder `-output D:\path` |
| qBittorrent automatisch konfigurieren | `-configure` | `-configure` |
| Vorherige Installation wiederherstellen | `-rollback` | `-rollback` |
| Vollständig deinstallieren (keine Installer-Backups behalten) | `-uninstall -purge` | `-uninstall -purge` |
| Hilfe | `-help` | `-help` |
| Docker-Container wählen | `--container=NAME` | — |
| Docker-Container auflisten | `--list-containers` | — |
| Host-Pfad des Docker-`/config` angeben | `--config-root=/path` | — |

<details>
<summary><b>Hinweise: (zum Aufklappen klicken)</b></summary>

- Eine nicht vorhandene Version fällt **nicht** automatisch auf latest oder dev zurück.
- `-dev` kann nicht zusammen mit `-version` verwendet werden.

### Bestimmte Version und Installationsverzeichnis

Linux-Beispiel:

```sh
sh install.sh -version 1.0.0 -o /opt/weig-qb-webui -configure
```

Windows-Beispiel:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -version 1.0.0 -o D:\weig-qb-webui -configure
```

### Rollback

Rollback:

```sh
sh install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback
```

</details>

## Ein-Klick-Deinstallation

<details>
<summary><b>Vollständige Deinstallation für Linux / NAS, Docker und Windows PowerShell</b></summary>

Empfohlen ist standardmäßig die **vollständige Deinstallation ohne Installer-Backups**: WebUI entfernen, die passende Alternative-WebUI-Konfiguration deaktivieren, die installer-eigenen Backups / den Rollback-Status dieses Ziels bereinigen und anschließend das heruntergeladene Installationsskript im aktuellen Verzeichnis löschen.

### Linux / NAS

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Bei einem eigenen Installationspfad `-o /path/to/weig-qb-webui` ergänzen.

### Docker

Ein Container / automatische Erkennung:

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Mehrere Container:

```sh
sh install.sh -uninstall -configure -purge --container=qbittorrent && rm -f -- ./install.sh
```

Bei Verwendung von `--config-root`:

```sh
sh install.sh -uninstall -configure -purge --config-root=/path/to/qbittorrent/config && rm -f -- ./install.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -uninstall -configure -purge; if ($LASTEXITCODE -eq 0) { Remove-Item .\install.ps1 -Force }
```

Bei einem eigenen Installationspfad `-o D:\weig-qb-webui` ergänzen.

`-purge` entfernt nur Backups des aktuellen Deinstallationsziels und lässt andere Installationen unangetastet. Ist das gemeinsame Statusverzeichnis danach leer, wird unter Linux auch `~/.config/weig_qb-webui` (für root: `/root/.config/weig_qb-webui`) bzw. unter Windows `%APPDATA%\WeiG_qB-WebUI` entfernt.

Sollen Backups für ein späteres `-rollback` erhalten bleiben, `-purge` einfach weglassen.

</details>

## Weitere Hilfe

Docker, NAS, benutzerdefinierte Pfade, Aktualisierung und manuelle Installation: [Installations-, Upgrade- und Bereitstellungsanleitung](installation-guide/deployment-guide.de.md).

## Lizenz

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

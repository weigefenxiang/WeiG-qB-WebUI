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

**[🌐 Online-Vorschau](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Neueste stabile Version herunterladen](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**Sprache**: [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Deutsch** · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

## Direkt herunterladen

Lade die neueste stabile **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)** herunter.

Nach dem Entpacken ist **der Ordner `WeiG-qB-WebUI` selbst das WebUI-Verzeichnis**, das in qBittorrent eingetragen wird.

## Installation für Einsteiger

<details>
<summary><b>Zum ersten Mal? 1-Minuten-Anleitung aufklappen</b></summary>

### 1. ZIP entpacken

Nach dem Entpacken sollte Folgendes vorhanden sein:

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

Der gesamte Ordner **`WeiG-qB-WebUI`** ist das WebUI-Stammverzeichnis. Nicht nur `public` oder `private` kopieren.

### 2. An einen festen Ort verschieben

Zum Beispiel:

```text
Windows: D:\WeiG-qB-WebUI
Linux:   /opt/WeiG-qB-WebUI
```

Diesen Pfad trägst du anschließend in qBittorrent ein.

### 3. In qBittorrent aktivieren

Öffne qBittorrent:

**Werkzeuge → Optionen ... → WebUI**

Das sind die aktuellen Begriffe der offiziellen deutschen qBittorrent-Oberfläche. Danach:

1. **Alternative Weboberfläche verwenden** aktivieren.
2. **Speicherort der Dateien:** suchen.
3. Den Pfad zum Ordner `WeiG-qB-WebUI` eintragen.

Windows-Beispiel:

```text
D:\WeiG-qB-WebUI
```

Linux-Beispiel:

```text
/opt/WeiG-qB-WebUI
```

4. Mit **OK** speichern.
5. Die qBittorrent-WebUI neu laden. Falls die alte Ansicht im Cache bleibt, `Ctrl + F5` verwenden.

> **Pfad prüfen:** Im eingetragenen Ordner müssen `public`, `private`, `VERSION` usw. direkt sichtbar sein.

> **Docker:** qBittorrent läuft im Container. Deshalb muss in qBittorrent normalerweise ein container-sichtbarer Pfad eingetragen werden, nicht der Host-Pfad.

</details>

## Ein-Klick-Installation

Das Installationsskript wird aus dem stabilen `main`-Branch geladen. **Standardmäßig wird der neueste stabile GitHub Release installiert** und `SHA256SUMS` geprüft.

### Linux / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>Skript- und Standard-Installationspfad anzeigen</b></summary>

```text
./weigg-install.sh
```

Standardpfad der WebUI:

```text
~/.local/share/weigg-qb-webui
```

Bei Ausführung als `root` typischerweise:

```text
/root/.local/share/weigg-qb-webui
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
/root/qbittorrent/config/weigg-qb-webui
```

muss qBittorrent bei **Speicherort der Dateien:** verwenden:

```text
/config/weigg-qb-webui
```

#### Ein qBittorrent-Container

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

Der Installer versucht Container und `/config`-Mount automatisch zu erkennen.

#### Container anzeigen

```sh
sh weigg-install.sh --list-containers
```

Oder:

```sh
docker ps
```

Einen Container ausdrücklich wählen:

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

Bei mehreren qBittorrent-Containern wählt der Installer nicht automatisch einen aus.

#### Host-Pfad für `/config` angeben

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

Synology-Beispiel:

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

Anderes NAS:

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

#### WebUI-Zielpfad festlegen

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>Installationspfad anzeigen</b></summary>

```text
C:\Users\<Benutzername>\AppData\Local\WeiG-qB-WebUI
```

</details>

## Häufige Optionen

<details>
<summary><b>Optionen / Version / Zielordner / Rollback anzeigen</b></summary>

PowerShell-Parameternamen unterscheiden nicht zwischen Groß- und Kleinschreibung.

| Zweck | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Neuester stabiler Release | Standard | Standard |
| Bestimmter Release | `--version 0.3.60` | `-version 0.3.60` |
| Entwicklungsstand | `--dev` | `-dev` |
| Zielordner | `-o /path` oder `--output /path` | `-o D:\path` oder `-output D:\path` |
| qBittorrent automatisch konfigurieren | `--configure` | `-configure` |
| Vorherige Installation wiederherstellen | `--rollback` | `-rollback` |
| Hilfe | `--help` | `-help` |
| Docker-Container wählen | `--container=NAME` | — |
| Docker-Container auflisten | `--list-containers` | — |
| Host-Pfad des Docker-`/config` angeben | `--config-root=/path` | — |

- Eine nicht vorhandene Version fällt **nicht** automatisch auf latest oder dev zurück.
- `--dev / -dev` kann nicht zusammen mit `--version / -version` verwendet werden.

Linux-Beispiel:

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

Windows-Beispiel:

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

Rollback:

```sh
sh weigg-install.sh --rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

</details>

## Weitere Hilfe

Docker, NAS, benutzerdefinierte Pfade, Aktualisierung und manuelle Installation: [Installations-, Upgrade- und Bereitstellungsanleitung](deployment-guide/README.de.md).

## Lizenz

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

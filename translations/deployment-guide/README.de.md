# Installation, Upgrade und manuelle Bereitstellung

**Sprache**: [English](README.en.md) · [简中](../../docs/007.安装升级与手动部署.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · **Deutsch** · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

Diese Anleitung richtet sich an Einsteiger. **Für die meisten Nutzer wird die neueste stabile Release-Version empfohlen.** `dev` sollte nur verwendet werden, wenn die Entwicklungsversion bewusst getestet werden soll.

Unterstützter Bereich: **qBittorrent 4.1.x → 5.2.x**.

> Für die schnellste Installation direkt zu **Linux / NAS**, **Docker** oder **Windows PowerShell** springen und den Hauptbefehl kopieren. Ausführliche Erklärungen und Beispiele sind standardmäßig eingeklappt.

## 1. Wichtige Optionen

Linux / Docker / NAS verwenden `install.sh`, Windows verwendet `install.ps1`. PowerShell-Parameter sind nicht groß-/kleinschreibungssensitiv.

| Zweck | Linux / Docker / NAS | Windows PowerShell | Hinweis |
|---|---|---|---|
| Neueste stabile Release | Standard | Standard | Empfohlen |
| Bestimmte Release | `--version 0.3.60` | `-version 0.3.60` | Nur diese Release installieren |
| Entwicklungsversion | `--dev` | `-dev` | Aktueller `dev` exact Git SHA |
| Installationspfad | `-o /path` / `--output /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| qBittorrent automatisch konfigurieren | `--configure` | `-configure` | Alternative Weboberfläche aktivieren und Pfad setzen |
| Rollback | `--rollback` | `-rollback` | Vorherige Installation und qB-Konfiguration wiederherstellen |
| Hilfe | `--help` | `-help` | Vollständige Hilfe anzeigen |
| Docker-Container wählen | `--container=NAME` | — | Bei mehreren qB-Containern |
| Docker-Container auflisten | `--list-containers` | — | Erkannte qB-Container anzeigen |
| Host-Verzeichnis für `/config` angeben | `--config-root=/path` | — | Wenn die Mount-Quelle bekannt ist |

Wichtige Regeln:

- Ohne Quelloption wird die neueste stabile Release installiert.
- `--version / -version` installiert exakt die angeforderte Release. Existiert sie nicht, wird abgebrochen; es gibt **keinen automatischen Fallback auf latest oder dev**.
- `--dev / -dev` und `--version / -version` können nicht zusammen verwendet werden.
- `--configure / -configure` sichert die qBittorrent-Konfiguration vor Änderungen.
- `--rollback / -rollback` stellt nach Möglichkeit die vorherige WebUI- und qBittorrent-Konfiguration wieder her.

## 2. Welche Quelle soll ich verwenden?

### Neueste stabile Release — empfohlen

Der Installer lädt:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Vor der Installation wird SHA-256 geprüft. Bei einem Fehler wird abgebrochen.

### Bestimmte Release

Beispiel:

```text
0.3.60
```

Dies entspricht dem Release-Tag `v0.3.60`.

### dev

`dev` ist kein Ersatz, falls eine Release nicht geladen werden kann. Der Installer löst den aktuellen `dev`-Stand zuerst auf einen **40-stelligen exact Git SHA** auf und lädt genau diesen Commit.

---

## 3. Linux / NAS

Empfohlener Einzeiler:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>Aufklappen: Linux / NAS Pfade, Optionen, Upgrades und Beispiele</b></summary>

### Standard-Installationspfad

```text
~/.local/share/weigg-qb-webui
```

Beispiel:

```text
/home/alex/.local/share/weigg-qb-webui
```

Als `root` normalerweise:

```text
/root/.local/share/weigg-qb-webui
```

Das Installationsskript bleibt im aktuellen Verzeichnis:

```text
./weigg-install.sh
```

### Beispiel 1: neueste Release + automatische Konfiguration

```sh
sh weigg-install.sh --configure
```

### Beispiel 2: nur Dateien installieren

```sh
sh weigg-install.sh
```

Danach qBittorrent manuell öffnen:

**Werkzeuge → Optionen ... → WebUI**

1. **Alternative Weboberfläche verwenden** aktivieren.
2. Unter **Speicherort der Dateien:** das WeiG-qB-WebUI-Verzeichnis eintragen.
3. Mit **OK** speichern.

### Beispiel 3: bestimmte Release

```sh
sh weigg-install.sh --version 0.3.60 --configure
```

### Beispiel 4: eigener Pfad

```sh
sh weigg-install.sh -o /opt/weigg-qb-webui --configure
```

Oder:

```sh
sh weigg-install.sh --output /opt/weigg-qb-webui --configure
```

### Beispiel 5: Version + Pfad

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

### Beispiel 6: dev

```sh
sh weigg-install.sh --dev --configure
```

### Beispiel 7: Upgrade auf latest

```sh
sh weigg-install.sh --configure
```

Auf eine bestimmte Version wechseln:

```sh
sh weigg-install.sh --version 0.3.61 --configure
```

### Beispiel 8: Rollback

```sh
sh weigg-install.sh --rollback
```

### Beispiel 9: Hilfe

```sh
sh weigg-install.sh --help
```

Der Linux-Installer sucht automatisch nach verfügbaren Werkzeugen wie `curl`, `wget`, BusyBox oder Python 3. Wenn keine SHA-256-Prüfung möglich ist, wird eine Release nicht ungeprüft installiert.

</details>

---

## 4. Docker

Zuerst den normalen Einzeiler versuchen:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

Wenn nur ein laufender qBittorrent-Container mit normalem `/config`-Mount vorhanden ist, versucht der Installer ihn automatisch zu erkennen.

<details>
<summary><b>Aufklappen: Docker-Grundlagen, mehrere Container, NAS-Pfade und Beispiele</b></summary>

### Host-Pfad und Container-Pfad

Docker-Compose-Beispiel:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Bedeutung:

```text
Host:      /root/qbittorrent/config
Container: /config
```

Liegt die WebUI auf dem Host unter:

```text
/root/qbittorrent/config/weigg-qb-webui
```

sollte qBittorrent unter **Speicherort der Dateien:** normalerweise Folgendes verwenden:

```text
/config/weigg-qb-webui
```

### Standard-Docker-Zuordnung

Wenn erkannt wird:

```text
Container /config -> Host /root/qbittorrent/config
```

und kein `-o` gesetzt wurde:

```text
Host install path: /root/qbittorrent/config/weigg-qb-webui
qBittorrent Root Folder: /config/weigg-qb-webui
```

### Beispiel 1: ein qBittorrent-Container

```sh
sh weigg-install.sh --configure
```

### Beispiel 2: Container auflisten

```sh
sh weigg-install.sh --list-containers
```

Oder:

```sh
docker ps
```

### Beispiel 3: Container gezielt wählen

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

### Beispiel 4: mehrere qBittorrent-Container

```sh
sh weigg-install.sh --list-containers
sh weigg-install.sh --container=qbittorrent --configure
```

Test-Container:

```sh
sh weigg-install.sh --container=qbittorrent-test --configure
```

Bei mehreren Treffern rät der Installer nicht, sondern verlangt eine eindeutige Auswahl.

### Beispiel 5: Host-Verzeichnis für `/config` ist bekannt

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

### Beispiel 6: Synology

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

### Beispiel 7: anderes NAS

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

Diese Beispielpfade müssen durch den tatsächlichen Host-Pfad ersetzt werden, der als `/config` gemountet ist.

### Beispiel 8: container-sichtbaren WebUI-Pfad wählen

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

Bei `/config -> /root/qbittorrent/config` wird umgesetzt zu:

```text
/config/weigg-qb-webui
        ↓
/root/qbittorrent/config/weigg-qb-webui
```

### Beispiel 9: bestimmte Release

```sh
sh weigg-install.sh --container=qbittorrent --version 0.3.60 --configure
```

### Beispiel 10: dev

```sh
sh weigg-install.sh --container=qbittorrent --dev --configure
```

### Beispiel 11: Rollback

```sh
sh weigg-install.sh --rollback
```

### Häufigster Fehler

Ein Host-Pfad wird in qBittorrent eingetragen. Im Container wird normalerweise dieser Pfad benötigt:

```text
/config/weigg-qb-webui
```

</details>

---

## 5. Windows PowerShell

Empfohlener Einzeiler:

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>Aufklappen: Windows-Pfade, Optionen, Upgrades und Beispiele</b></summary>

### Standard-Installationspfad

```text
C:\Users\<Benutzername>\AppData\Local\WeiG-qB-WebUI
```

Entspricht:

```text
%LOCALAPPDATA%\WeiG-qB-WebUI
```

### Beispiel 1: latest + automatische Konfiguration

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

### Beispiel 2: nur Dateien installieren

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1
```

Danach **Werkzeuge → Optionen ... → WebUI** öffnen, **Alternative Weboberfläche verwenden** aktivieren und unter **Speicherort der Dateien:** den Installationspfad eintragen.

### Beispiel 3: bestimmte Release

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -configure
```

### Beispiel 4: Installation auf D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -o D:\WeiG-qB-WebUI -configure
```

### Beispiel 5: Version + Pfad

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

### Beispiel 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -dev -configure
```

### Beispiel 7: Upgrade

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

### Beispiel 8: Rollback

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

### Beispiel 9: Hilfe

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -help
```

PowerShell-Parameter sind nicht groß-/kleinschreibungssensitiv. `-ExecutionPolicy Bypass` gilt nur für diesen PowerShell-Prozess und ändert die systemweite Richtlinie nicht dauerhaft.

</details>

---

## 6. Manuelle Installation

Neueste Release:

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

Benötigte Dateien:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>Aufklappen: manueller Download, Prüfung, Entpacken und qBittorrent-Konfiguration</b></summary>

Linux:

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -o WeiG-qB-WebUI.zip
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
```

Windows:

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip .\WeiG-qB-WebUI -Force
```

SHA-256 berechnen:

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

Nach dem Entpacken:

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

In qBittorrent **Werkzeuge → Optionen ... → WebUI** öffnen, **Alternative Weboberfläche verwenden** aktivieren und **Speicherort der Dateien:** auf das `WeiG-qB-WebUI`-Stammverzeichnis setzen.

</details>

## 7. Upgrade und Rollback

Installer erneut ausführen = normales Upgrade.

Linux:

```sh
sh weigg-install.sh --configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

Rollback:

```sh
sh weigg-install.sh --rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

Für eine sofortige Rückkehr zur eingebauten qBittorrent-WebUI einfach **Alternative Weboberfläche verwenden** deaktivieren.

## 8. Fehlerbehebung

<details>
<summary><b>Aufklappen: Cache, 404, Docker-Pfade, mehrere Container, checksum</b></summary>

### Alte Seite wird noch angezeigt

`Ctrl + F5` oder ein privates Browserfenster ausprobieren.

### 404 / WebUI lädt nicht

Unter **Speicherort der Dateien:** muss ein Verzeichnis stehen, das direkt Folgendes enthält:

```text
public
private
VERSION
GIT_SHA
```

### Docker findet Dateien nicht

Meist wurde der Host-Pfad statt des Container-Pfads verwendet. Typisch korrekt:

```text
/config/weigg-qb-webui
```

### Mehrere Container

```sh
sh weigg-install.sh --list-containers
sh weigg-install.sh --container=qbittorrent --configure
```

### checksum-Fehler

Nicht umgehen. Neu herunterladen und erneut versuchen. Bei nicht passendem ZIP und `SHA256SUMS` stoppt der Installer absichtlich.

</details>

## 9. Installierten Build prüfen

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` enthält die Version, `GIT_SHA` den exact Git commit und `private/weigg-install.json` Quelle, SHA, Pfade und Docker-Metadaten.

## 10. Kompatibilität

```text
qBittorrent 4.1.x → 5.2.x
```

Das minimale Hauptziel für WebAPI v2 ist **qBittorrent 4.1.0**. qBittorrent 4.0.x verwendet die ältere WebAPI v1 und gehört nicht zum aktuellen Hauptsupport.

## 11. Fortgeschrittene / Maintainer

<details>
<summary><b>Aufklappen: exact SHA, Release-Identität und alte Optionen</b></summary>

`dev` wird zuerst auf einen 40-stelligen Git SHA aufgelöst; genau dieser Commit wird installiert und in `GIT_SHA` eingetragen.

Eine normale Release stellt bereit:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Linux unterstützt aus Kompatibilitätsgründen weiterhin `--channel=release|dev`, `--dir=/path`, `--update`; Windows weiterhin `-Channel`, `-Destination`, `-Mode`. Für neue Installationen die aktuellen Optionen am Anfang dieser Seite verwenden.

</details>

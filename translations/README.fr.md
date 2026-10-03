# WeiG qB WebUI

Une interface Web alternative moderne et responsive pour qBittorrent, optimisée pour ordinateur et mobile.

**📱 Adaptée au mobile · 🌙 Mode sombre · ✅ Compatible qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 Aperçu en ligne](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Télécharger la dernière version stable](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/weig-qb-webui.zip)**

**Langue** : [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · **Français** · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

## Téléchargement direct

Téléchargez la dernière version stable **[weig-qb-webui.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/weig-qb-webui.zip)**.

Le ZIP contient déjà le dossier racine canonique **`weig-qb-webui`**. Extrayez-le et utilisez directement ce dossier comme répertoire WebUI dans qBittorrent ; aucun renommage n'est nécessaire.

## Aperçu de l’interface

### Bureau

<p align="center">
  <img src="../assets/screenshots/weig-qb-webui-desktop-overview-v1.1.0.png" alt="Interface bureau de WeiG qB WebUI" width="800">
</p>

### Mobile

<p align="center">
  <img src="../assets/screenshots/weig-qb-webui-mobile-overview-v1.1.0.gif" alt="Animation mobile de WeiG qB WebUI" height="341">
  <img src="../assets/screenshots/weig-qb-webui-mobile-overview-v1.1.0.png" alt="Interface mobile de WeiG qB WebUI" height="341">
</p>

## Installation pour débutants

<details>
<summary><b>Première installation ? Déplier le guide d'une minute</b></summary>

### 1. Extraire l'archive

Téléchargez `weig-qb-webui.zip` et extrayez-le. L'archive crée déjà le dossier canonique :

```text
weig-qb-webui/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

Le dossier **`weig-qb-webui` entier** est la racine WebUI. Ne copiez pas uniquement `public` ou `private`.

### 2. Déplacer le dossier vers un emplacement permanent

```text
Windows : D:\weig-qb-webui
Linux :   /opt/weig-qb-webui
```

C'est ce chemin qu'il faudra renseigner dans qBittorrent.

### 3. Activer dans qBittorrent

Ouvrez qBittorrent :

**Outils → Options… → WebUI**

Ce sont les termes de l'interface française officielle actuelle de qBittorrent. Ensuite :

1. Activez **Utiliser l'IU Web alternative**.
2. Repérez **Emplacement des fichiers :**.
3. Saisissez le chemin du dossier `weig-qb-webui`.

Exemple Windows :

```text
D:\weig-qb-webui
```

Exemple Linux :

```text
/opt/weig-qb-webui
```

4. Cliquez sur **OK** pour enregistrer.
5. Rechargez la page WebUI. Si l'ancienne interface reste en cache, essayez `Ctrl + F5`.

> **Vérification du chemin :** `public`, `private`, `VERSION` et les autres fichiers doivent être directement visibles dans le dossier indiqué.

> **Docker :** qBittorrent fonctionne dans un conteneur. Il faut donc généralement saisir le chemin visible depuis le conteneur, et non le chemin de l'hôte.

</details>

## Installation en une commande

Le script d’installation Linux/NAS est toujours téléchargé depuis l’adresse fixe Dev Pages ci-dessous. **L’adresse du script ne choisit pas le canal d’installation :** sans `-dev`, la dernière Release stable vérifiée est installée ; utilisez `-dev` uniquement pour la version de développement actuelle.

### Linux / NAS

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

<details>
<summary><b>Afficher l'emplacement du script et le dossier d'installation par défaut</b></summary>

```text
./install.sh
```

Répertoire WebUI par défaut :

```text
~/.local/share/weig-qb-webui
```

Avec l'utilisateur `root` :

```text
/root/.local/share/weig-qb-webui
```

</details>

### Docker

<details>
<summary><b>Installation Docker / plusieurs conteneurs / chemins</b></summary>

#### Hôte et conteneur

- **Hôte** : le système Linux/NAS qui exécute Docker.
- **Conteneur** : l'environnement dans lequel qBittorrent s'exécute.

Exemple :

```text
Hôte :      /root/qbittorrent/config
   ↓ monté vers
Conteneur : /config
```

Docker Compose :

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Si la WebUI est installée sur l'hôte dans :

```text
/root/qbittorrent/config/weig-qb-webui
```

alors **Emplacement des fichiers :** dans qBittorrent doit être :

```text
/config/weig-qb-webui
```

#### Un seul conteneur qBittorrent

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

Le programme d'installation essaie de détecter automatiquement le conteneur et le montage `/config`.

#### Lister les conteneurs

```sh
sh install.sh --list-containers
```

Ou :

```sh
docker ps
```

Choisir explicitement un conteneur :

```sh
sh install.sh --container=qbittorrent -configure
```

S'il y a plusieurs conteneurs qBittorrent, le programme d'installation refuse d'en choisir un au hasard.

#### Indiquer le chemin hôte correspondant à `/config`

```sh
sh install.sh --config-root=/root/qbittorrent/config -configure
```

Synology :

```sh
sh install.sh --config-root=/volume1/docker/qbittorrent -configure
```

Autre NAS :

```sh
sh install.sh --config-root=/share/Container/qbittorrent -configure
```

#### Choisir le chemin WebUI

```sh
sh install.sh --container=qbittorrent -o /config/weig-qb-webui -configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\install.ps1; powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

<details>
<summary><b>Afficher le dossier d'installation</b></summary>

```text
C:\Users\<votre-nom>\AppData\Local\weig-qb-webui
```

</details>

## Options courantes
Les noms des paramètres PowerShell ne sont pas sensibles à la casse.

| Usage | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Dernière version stable | Par défaut | Par défaut |
| Release précise | `-version 1.0.0` | `-version 1.0.0` |
| Version de développement | `-dev` | `-dev` |
| Dossier d'installation | `-o /path` ou `-o /path` | `-o D:\path` ou `-output D:\path` |
| Configurer qBittorrent | `-configure` | `-configure` |
| Restaurer l'installation précédente | `-rollback` | `-rollback` |
| Désinstallation complète (sans sauvegardes de l’installateur) | `-uninstall -purge` | `-uninstall -purge` |
| Aide | `-help` | `-help` |
| Choisir un conteneur Docker | `--container=NAME` | — |
| Lister les conteneurs Docker | `--list-containers` | — |
| Chemin hôte monté sur `/config` | `--config-root=/path` | — |

<details>
<summary><b>Remarques : (cliquer pour développer)</b></summary>

- Une version inexistante ne bascule jamais automatiquement vers latest ou dev.
- `-dev` ne peut pas être combiné avec `-version`.

### Version précise et répertoire d’installation

Linux :

```sh
sh install.sh -version 1.0.0 -o /opt/weig-qb-webui -configure
```

Windows :

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -version 1.0.0 -o D:\weig-qb-webui -configure
```

### Retour arrière

Retour arrière :

```sh
sh install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback
```

</details>

## Désinstallation en une commande

<details>
<summary><b>Désinstallation complète Linux / NAS, Docker et Windows PowerShell</b></summary>

Par défaut, nous recommandons la **désinstallation complète sans conserver les sauvegardes de l’installateur** : suppression du WebUI, désactivation de l’interface alternative correspondant à la cible, purge des sauvegardes / de l’état de rollback appartenant à cette cible, puis suppression du script d’installation téléchargé dans le dossier courant.

### Linux / NAS

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Pour un répertoire personnalisé, ajoutez `-o /path/to/weig-qb-webui`.

### Docker

Un seul conteneur / détection automatique :

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Plusieurs conteneurs :

```sh
sh install.sh -uninstall -configure -purge --container=qbittorrent && rm -f -- ./install.sh
```

Avec `--config-root` :

```sh
sh install.sh -uninstall -configure -purge --config-root=/path/to/qbittorrent/config && rm -f -- ./install.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -uninstall -configure -purge; if ($LASTEXITCODE -eq 0) { Remove-Item .\install.ps1 -Force }
```

Pour un répertoire personnalisé, ajoutez `-o D:\weig-qb-webui`.

`-purge` ne supprime que les sauvegardes appartenant à la cible en cours de désinstallation et ne touche pas aux autres installations. Si le répertoire d’état partagé devient vide, `~/.config/weig_qb-webui` sous Linux (root : `/root/.config/weig_qb-webui`) ou `%APPDATA%\WeiG_qB-WebUI` sous Windows est également supprimé.

Pour conserver les sauvegardes afin d’utiliser `-rollback` plus tard, retirez simplement `-purge`.

</details>

## Aide supplémentaire

Pour Docker, NAS, les chemins personnalisés, les mises à jour et le déploiement manuel, consultez [Installation, mise à niveau et déploiement manuel](installation-guide/deployment-guide.fr.md).

## Licence

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

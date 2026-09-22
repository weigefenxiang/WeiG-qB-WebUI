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

**[🌐 Aperçu en ligne](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Télécharger la dernière version stable](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**Langue** : [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · **Français** · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

## Téléchargement direct

Téléchargez la dernière version stable **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**.

Le ZIP contient toujours le dossier racine `WeiG-qB-WebUI`. Après extraction, renommez ce dossier local en **`WeiG_qB-WebUI`** ; ce dossier renommé est le répertoire WebUI à utiliser dans qBittorrent.

## Aperçu de l’interface

### Bureau

![Interface de bureau de WeiG qB WebUI](../assets/screenshots/weig-qb-webui-desktop-overview.png)

### Mobile

![Interface mobile de WeiG qB WebUI](../assets/screenshots/weig-qb-webui-mobile-overview.png)

## Installation pour débutants

<details>
<summary><b>Première installation ? Déplier le guide d'une minute</b></summary>

### 1. Extraire l'archive

Téléchargez `WeiG-qB-WebUI.zip`, extrayez-le, puis renommez le dossier extrait `WeiG-qB-WebUI` en `WeiG_qB-WebUI`. La structure finale doit être :

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

Le dossier **`WeiG_qB-WebUI` entier** est la racine WebUI. Ne copiez pas uniquement `public` ou `private`.

### 2. Déplacer le dossier vers un emplacement permanent

```text
Windows : D:\WeiG_qB-WebUI
### Version précise et répertoire d’installation

Linux :   /opt/WeiG_qB-WebUI
```

C'est ce chemin qu'il faudra renseigner dans qBittorrent.

### 3. Activer dans qBittorrent

Ouvrez qBittorrent :

**Outils → Options… → WebUI**

Ce sont les termes de l'interface française officielle actuelle de qBittorrent. Ensuite :

1. Activez **Utiliser l'IU Web alternative**.
2. Repérez **Emplacement des fichiers :**.
3. Saisissez le chemin du dossier `WeiG_qB-WebUI`.

Exemple Windows :

```text
D:\WeiG_qB-WebUI
```

Exemple Linux :

```text
/opt/WeiG_qB-WebUI
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
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Afficher l'emplacement du script et le dossier d'installation par défaut</b></summary>

```text
./weig_qb-webui_install.sh
```

Répertoire WebUI par défaut :

```text
~/.local/share/weig_qb-webui
```

Avec l'utilisateur `root` :

```text
/root/.local/share/weig_qb-webui
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
/root/qbittorrent/config/weig_qb-webui
```

alors **Emplacement des fichiers :** dans qBittorrent doit être :

```text
/config/weig_qb-webui
```

#### Un seul conteneur qBittorrent

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

Le programme d'installation essaie de détecter automatiquement le conteneur et le montage `/config`.

#### Lister les conteneurs

```sh
sh weig_qb-webui_install.sh --list-containers
```

Ou :

```sh
docker ps
```

Choisir explicitement un conteneur :

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

S'il y a plusieurs conteneurs qBittorrent, le programme d'installation refuse d'en choisir un au hasard.

#### Indiquer le chemin hôte correspondant à `/config`

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

Synology :

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

Autre NAS :

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

#### Choisir le chemin WebUI

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>Afficher le dossier d'installation</b></summary>

```text
C:\Users\<votre-nom>\AppData\Local\WeiG_qB-WebUI
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
sh weig_qb-webui_install.sh -version 1.0.0 -o /opt/weig_qb-webui -configure
```

Windows :

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -o D:\WeiG_qB-WebUI -configure
```

### Retour arrière

Retour arrière :

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```


</details>
## Aide supplémentaire

Pour Docker, NAS, les chemins personnalisés, les mises à jour et le déploiement manuel, consultez [Installation, mise à niveau et déploiement manuel](installation-guide/deployment-guide.fr.md).

## Licence

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

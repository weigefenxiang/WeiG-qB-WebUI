# Guide débutant : installation et mise à niveau

**Langue** : [English](deployment-guide.en.md) · [简中](deployment-guide.zh-CN.md) · [繁中](deployment-guide.zh-TW.md) · [日本語](deployment-guide.ja.md) · [한국어](deployment-guide.ko.md) · [Deutsch](deployment-guide.de.md) · **Français** · [Español](deployment-guide.es.md) · [Português](deployment-guide.pt.md) · [Русский](deployment-guide.ru.md)

Ce guide détaillé est destiné aux débutants. **La plupart des utilisateurs doivent installer la dernière Release stable.** Utilisez `dev` uniquement si vous souhaitez tester volontairement la version de développement.

Plage prise en charge : **qBittorrent 4.1.x → 5.2.x**.

> Pour aller au plus vite, passez directement à **Linux / NAS**, **Docker** ou **Windows PowerShell** et copiez la commande principale. Les explications et exemples supplémentaires sont repliés par défaut.

## 1. Installation en un clic sur Linux / NAS

Commande en une ligne recommandée :

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Afficher l’emplacement du script, le dossier par défaut et plus d’options (cliquer pour développer)</b></summary>

### Répertoire d'installation par défaut

```text
~/.local/share/weig_qb-webui
```

Exemple :

```text
/home/alex/.local/share/weig_qb-webui
```

Avec `root` :

```text
/root/.local/share/weig_qb-webui
```

Le script reste dans le répertoire courant :

```text
./weig_qb-webui_install.sh
```

### Exemple 1 : dernière Release + configuration automatique

```sh
sh weig_qb-webui_install.sh -configure
```

### Exemple 2 : installer les fichiers uniquement

```sh
sh weig_qb-webui_install.sh
```

Puis configurez qBittorrent manuellement :

**Outils → Options… → WebUI**

1. Activez **Utiliser l'IU Web alternative**.
2. Dans **Emplacement des fichiers :**, indiquez le dossier WeiG qB WebUI.
3. Validez avec **OK**.

### Exemple 3 : Release précise

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -configure
```

### Exemple 4 : répertoire personnalisé

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

Ou :

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

### Exemple 5 : version + répertoire

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -o /opt/weig_qb-webui -configure
```

### Exemple 6 : dev

```sh
sh weig_qb-webui_install.sh -dev -configure
```

### Exemple 7 : mise à niveau vers latest

```sh
sh weig_qb-webui_install.sh -configure
```

Vers une version précise :

```sh
sh weig_qb-webui_install.sh -version 0.1.1 -configure
```

### Exemple 8 : rollback

```sh
sh weig_qb-webui_install.sh -rollback
```

### Exemple 9 : aide

```sh
sh weig_qb-webui_install.sh -help
```

L'installateur Linux recherche automatiquement des outils disponibles tels que `curl`, `wget`, BusyBox ou Python 3. S'il n'existe aucun moyen de vérifier le SHA-256, une Release n'est pas installée sans vérification.

</details>

---

---

## 2. Installation en un clic avec Docker

Essayez d'abord la commande normale :

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Chemins Docker, plusieurs conteneurs et options avancées (cliquer pour développer)</b></summary>



S'il n'y a qu'un seul conteneur qBittorrent actif avec un montage `/config` normal, l'installateur tente de le détecter automatiquement.

### Chemin hôte et chemin conteneur

Exemple Docker Compose :

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Cela signifie :

```text
Hôte :      /root/qbittorrent/config
Conteneur : /config
```

Si le WebUI est stocké sur l'hôte dans :

```text
/root/qbittorrent/config/weig_qb-webui
```

alors **Emplacement des fichiers :** dans qBittorrent doit généralement être :

```text
/config/weig_qb-webui
```

### Conversion Docker par défaut

Si l'installateur détecte :

```text
Container /config -> Host /root/qbittorrent/config
```

et qu'aucun `-o` n'est fourni :

```text
Host install path: /root/qbittorrent/config/weig_qb-webui
qBittorrent Root Folder: /config/weig_qb-webui
```

### Exemple 1 : un seul conteneur qBittorrent

```sh
sh weig_qb-webui_install.sh -configure
```

### Exemple 2 : lister les conteneurs

```sh
sh weig_qb-webui_install.sh --list-containers
```

Ou :

```sh
docker ps
```

### Exemple 3 : sélectionner un conteneur

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### Exemple 4 : plusieurs conteneurs qBittorrent

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

Conteneur de test :

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

Avec plusieurs candidats, l'installateur refuse de choisir au hasard.

### Exemple 5 : le chemin hôte monté sur `/config` est connu

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

### Exemple 6 : Synology

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

### Exemple 7 : autre NAS

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

Remplacez ces exemples par le vrai chemin hôte monté sur `/config`.

### Exemple 8 : définir le chemin WebUI visible dans le conteneur

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

Si `/config` correspond à `/root/qbittorrent/config` :

```text
/config/weig_qb-webui
        ↓
/root/qbittorrent/config/weig_qb-webui
```

### Exemple 9 : Release précise

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -version 1.0.0 -configure
```

### Exemple 10 : dev

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -dev -configure
```

### Exemple 11 : rollback

```sh
sh weig_qb-webui_install.sh -rollback
```

### Erreur Docker la plus courante

Entrer un chemin hôte dans qBittorrent. Dans le conteneur, le chemin correct est généralement :

```text
/config/weig_qb-webui
```

</details>

---

---

## 3. Installation en un clic sur Windows

Commande recommandée :

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>Afficher le dossier par défaut et plus d’options Windows (cliquer pour développer)</b></summary>

### Répertoire par défaut

```text
C:\Users\<votre-utilisateur>\AppData\Local\WeiG_qB-WebUI
```

Équivalent :

```text
%LOCALAPPDATA%\WeiG_qB-WebUI
```

### Exemple 1 : latest + configuration automatique

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Exemple 2 : fichiers uniquement

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1
```

Ensuite ouvrez **Outils → Options… → WebUI**, activez **Utiliser l'IU Web alternative** et indiquez le répertoire d'installation dans **Emplacement des fichiers :**.

### Exemple 3 : Release précise

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -configure
```

### Exemple 4 : installation sur D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -o D:\WeiG_qB-WebUI -configure
```

### Exemple 5 : version + répertoire

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -o D:\WeiG_qB-WebUI -configure
```

### Exemple 6 : dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

### Exemple 7 : mise à niveau

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Exemple 8 : rollback

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

### Exemple 9 : aide

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -help
```

Les noms de paramètres PowerShell ne sont pas sensibles à la casse. `-ExecutionPolicy Bypass` s'applique uniquement à ce processus PowerShell et ne modifie pas définitivement la stratégie système.

</details>

---

---

## 4. Mettre à niveau et revenir en arrière


Relancer l'installateur est la méthode normale de mise à niveau.

<details>
<summary><b>Afficher les commandes de mise à niveau et de rollback (cliquer pour développer)</b></summary>

Linux :

```sh
sh weig_qb-webui_install.sh -configure
```

Windows :

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

Rollback :

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

Pour revenir immédiatement à l'interface Web intégrée de qBittorrent, désactivez simplement **Utiliser l'IU Web alternative**.

</details>

---

## 5. Options courantes

Linux / Docker / NAS utilisent `install.sh`, Windows utilise `install.ps1`. Les paramètres PowerShell ne sont pas sensibles à la casse.

| Usage | Linux / Docker / NAS | Windows PowerShell | Remarque |
|---|---|---|---|
| Dernière Release stable | Par défaut | Par défaut | Recommandé |
| Release précise | `-version 1.0.0` | `-version 1.0.0` | Installe uniquement cette Release |
| Version de développement | `-dev` | `-dev` | SHA Git exact du `dev` actuel |
| Répertoire d'installation | `-o /path` / `-o /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| Configurer qBittorrent | `-configure` | `-configure` | Active l'IU Web alternative et définit le chemin |
| Revenir en arrière | `-rollback` | `-rollback` | Restaure l'installation et la config qB précédentes |
| Aide | `-help` | `-help` | Affiche l'aide complète |
| Choisir un conteneur Docker | `--container=NAME` | — | Utile avec plusieurs conteneurs qB |
| Lister les conteneurs | `--list-containers` | — | Affiche les conteneurs qB détectés |
| Définir le `/config` hôte | `--config-root=/path` | — | Si la source du montage est connue |

<details>
<summary><b>Remarques : (cliquer pour développer)</b></summary>

Règles importantes :

- Sans option de source, la dernière Release stable est installée.
- `-version` installe exactement la Release demandée. Si elle n'existe pas, l'installation s'arrête ; **aucun retour automatique vers latest ou dev**.
- `-dev` et `-version` ne peuvent pas être combinés.
- `-configure` sauvegarde la configuration qBittorrent avant modification.
- `-rollback` restaure l'état précédent lorsqu'une sauvegarde est disponible.

</details>

---

## 6. Installation manuelle

Dernière Release :

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

Fichiers à télécharger :

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>Déplier : téléchargement manuel, vérification, extraction et configuration</b></summary>

Linux :

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -o WeiG-qB-WebUI.zip
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
mv WeiG-qB-WebUI WeiG_qB-WebUI
```

Windows :

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip . -Force
Rename-Item .\WeiG-qB-WebUI WeiG_qB-WebUI
```

Calcul SHA-256 :

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

Après extraction :

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

Dans qBittorrent, ouvrez **Outils → Options… → WebUI**, activez **Utiliser l'IU Web alternative** et définissez **Emplacement des fichiers :** sur la racine `WeiG_qB-WebUI`.

</details>

---

## 7. Dépannage

<details>
<summary><b>Déplier : cache, 404, chemins Docker, plusieurs conteneurs, checksum</b></summary>

### L'ancienne page apparaît encore

Essayez `Ctrl + F5` ou une fenêtre privée.

### 404 / WebUI ne charge pas

Le dossier défini dans **Emplacement des fichiers :** doit contenir directement :

```text
public
private
VERSION
GIT_SHA
```

### Docker ne trouve pas les fichiers

Vous avez probablement utilisé le chemin hôte au lieu du chemin du conteneur. Le chemin typique est :

```text
/config/weig_qb-webui
```

### Plusieurs conteneurs

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### Erreur checksum

Ne la contournez pas. Téléchargez à nouveau. L'installateur s'arrête volontairement si le ZIP et `SHA256SUMS` ne correspondent pas.

</details>

---

## 8. Vérifier la version installée

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` indique la version, `GIT_SHA` le commit Git exact et `private/weigg-install.json` enregistre la source, le SHA, les chemins et les informations Docker.

---

## 9. Compatibilité

```text
qBittorrent 4.1.x → 5.2.x
```

La cible minimale WebAPI v2 de la branche principale est **qBittorrent 4.1.0**. qBittorrent 4.0.x utilise l'ancienne WebAPI v1 et n'entre pas dans la prise en charge principale actuelle.

---

## 10. Avancé / maintenance

<details>
<summary><b>Déplier : exact SHA, identité Release et anciennes options</b></summary>

Une installation `dev` résout d'abord le `dev` actuel vers un SHA Git de 40 caractères, déploie ce commit exact puis l'écrit dans `GIT_SHA`.

Une Release normale fournit :

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Linux conserve `--channel=release|dev`, `--dir=/path`, `--update` et Windows conserve `-Channel`, `-Destination`, `-Mode` pour compatibilité. Pour une nouvelle installation, utilisez les options modernes en haut de cette page.

</details>

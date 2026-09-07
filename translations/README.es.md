# WeiG qB WebUI

Una Alternate WebUI moderna y adaptable para qBittorrent, optimizada para escritorio y móvil.

**📱 Adaptada a móvil · 🌙 Modo oscuro · ✅ Compatible con qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 Vista previa en línea](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Descargar la última versión estable](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**Idioma**: [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · **Español** · [Português](README.pt.md) · [Русский](README.ru.md)

## Descarga directa

Descarga la última versión estable **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**.

Después de extraerla, **la carpeta `WeiG-qB-WebUI` es el directorio WebUI que debe usar qBittorrent**.

## Instalación para principiantes

<details>
<summary><b>¿Es tu primera instalación? Despliega esta guía de 1 minuto</b></summary>

### 1. Extraer el ZIP

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

La carpeta **`WeiG-qB-WebUI` completa** es la raíz de la WebUI. No copies solo `public` o `private`.

### 2. Moverla a una ubicación fija

```text
Windows: D:\WeiG-qB-WebUI
Linux:   /opt/WeiG-qB-WebUI
```

Ese es el directorio que indicarás en qBittorrent.

### 3. Activarla en qBittorrent

Abre qBittorrent:

**Herramientas → Opciones... → WebUI**

Estos son los términos actuales de la traducción oficial al español de qBittorrent. Después:

1. Activa **Usar la interfaz Web alternativa**.
2. Busca **Ubicación de archivos:**.
3. Introduce la ruta de la carpeta `WeiG-qB-WebUI`.

Ejemplo en Windows:

```text
D:\WeiG-qB-WebUI
```

Ejemplo en Linux:

```text
/opt/WeiG-qB-WebUI
```

4. Pulsa **OK** para guardar.
5. Recarga la WebUI. Si sigue apareciendo la interfaz antigua, prueba `Ctrl + F5`.

> **Cómo comprobar la ruta:** dentro del directorio indicado debes ver directamente `public`, `private`, `VERSION` y los demás archivos.

> **Docker:** qBittorrent se ejecuta dentro de un contenedor, por lo que normalmente debes usar una ruta visible desde el contenedor y no la ruta real del host.

</details>

## Instalación con un solo comando

El instalador se descarga de la rama estable `main`. **Por defecto instala la última Release estable de GitHub** y verifica `SHA256SUMS`.

### Linux / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>Ver ubicación del script y directorio de instalación predeterminado</b></summary>

```text
./weigg-install.sh
```

Ruta predeterminada de la WebUI:

```text
~/.local/share/weigg-qb-webui
```

Si se ejecuta como `root`:

```text
/root/.local/share/weigg-qb-webui
```

</details>

### Docker

<details>
<summary><b>Instalación Docker / varios contenedores / rutas</b></summary>

#### Host y contenedor

- **Host**: el sistema Linux/NAS donde se ejecuta Docker.
- **Contenedor**: el entorno aislado donde se ejecuta qBittorrent.

Ejemplo:

```text
Host:       /root/qbittorrent/config
   ↓ montado como
Contenedor: /config
```

Docker Compose:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Si la WebUI está instalada en el host en:

```text
/root/qbittorrent/config/weigg-qb-webui
```

entonces **Ubicación de archivos:** en qBittorrent debe ser:

```text
/config/weigg-qb-webui
```

#### Un único contenedor qBittorrent

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

El instalador intenta detectar automáticamente el contenedor y el montaje `/config`.

#### Listar contenedores

```sh
sh weigg-install.sh --list-containers
```

O:

```sh
docker ps
```

Elegir un contenedor explícitamente:

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

Si hay varios contenedores qBittorrent, el instalador no elige uno al azar.

#### Indicar el directorio del host montado como `/config`

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

Synology:

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

Otro NAS:

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

#### Elegir la ruta WebUI

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>Ver directorio de instalación</b></summary>

```text
C:\Users\<tu-usuario>\AppData\Local\WeiG-qB-WebUI
```

</details>

## Opciones habituales

<details>
<summary><b>Opciones / versión concreta / directorio personalizado / rollback</b></summary>

Los nombres de parámetros de PowerShell no distinguen mayúsculas y minúsculas.

| Uso | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Última Release estable | Predeterminado | Predeterminado |
| Release específica | `--version 0.3.60` | `-version 0.3.60` |
| Versión de desarrollo | `--dev` | `-dev` |
| Directorio de instalación | `-o /path` o `--output /path` | `-o D:\path` o `-output D:\path` |
| Configurar qBittorrent | `--configure` | `-configure` |
| Restaurar instalación anterior | `--rollback` | `-rollback` |
| Ayuda | `--help` | `-help` |
| Elegir contenedor Docker | `--container=NAME` | — |
| Listar contenedores Docker | `--list-containers` | — |
| Ruta del host montada como `/config` | `--config-root=/path` | — |

- Una versión inexistente no cambia automáticamente a latest o dev.
- `--dev / -dev` no puede combinarse con `--version / -version`.

Linux:

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

Windows:

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

## Más ayuda

Para Docker, NAS, rutas personalizadas, actualizaciones e instalación manual, consulta [Instalación, actualización y despliegue manual](deployment-guide/README.es.md).

## Licencia

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

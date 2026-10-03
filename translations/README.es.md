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

**[🌐 Vista previa en línea](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Descargar la última versión estable](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/weig-qb-webui.zip)**

**Idioma**: [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · **Español** · [Português](README.pt.md) · [Русский](README.ru.md)

## Descarga directa

Descarga la última versión estable **[weig-qb-webui.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/weig-qb-webui.zip)**.

El ZIP ya contiene la carpeta superior canónica **`weig-qb-webui`**. Extráela y usa directamente esa carpeta como directorio WebUI de qBittorrent; no hace falta cambiarle el nombre.

## Vista previa de la interfaz

### Escritorio

<p align="center">
  <img src="../assets/screenshots/weig-qb-webui-desktop-overview-v1.1.0.png" alt="Interfaz de escritorio de WeiG qB WebUI" width="800">
</p>

### Móvil

<p align="center">
  <img src="../assets/screenshots/weig-qb-webui-mobile-overview-v1.1.0.gif" alt="Animación móvil de WeiG qB WebUI" height="341">
  <img src="../assets/screenshots/weig-qb-webui-mobile-overview-v1.1.0.png" alt="Interfaz móvil de WeiG qB WebUI" height="341">
</p>

## Instalación para principiantes

<details>
<summary><b>¿Es tu primera instalación? Despliega esta guía de 1 minuto</b></summary>

### 1. Extraer el ZIP

Descarga `weig-qb-webui.zip` y extráelo. El archivo ya crea la carpeta canónica:

```text
weig-qb-webui/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

La carpeta **`weig-qb-webui` completa** es la raíz de la WebUI. No copies solo `public` o `private`.

### 2. Moverla a una ubicación fija

```text
Windows: D:\weig-qb-webui
Linux:   /opt/weig-qb-webui
```

Ese es el directorio que indicarás en qBittorrent.

### 3. Activarla en qBittorrent

Abre qBittorrent:

**Herramientas → Opciones... → WebUI**

Estos son los términos actuales de la traducción oficial al español de qBittorrent. Después:

1. Activa **Usar la interfaz Web alternativa**.
2. Busca **Ubicación de archivos:**.
3. Introduce la ruta de la carpeta `weig-qb-webui`.

Ejemplo en Windows:

```text
D:\weig-qb-webui
```

Ejemplo en Linux:

```text
/opt/weig-qb-webui
```

4. Pulsa **OK** para guardar.
5. Recarga la WebUI. Si sigue apareciendo la interfaz antigua, prueba `Ctrl + F5`.

> **Cómo comprobar la ruta:** dentro del directorio indicado debes ver directamente `public`, `private`, `VERSION` y los demás archivos.

> **Docker:** qBittorrent se ejecuta dentro de un contenedor, por lo que normalmente debes usar una ruta visible desde el contenedor y no la ruta real del host.

</details>

## Instalación con un solo comando

El instalador para Linux/NAS se descarga siempre desde el enlace fijo de Dev Pages que aparece abajo. **La dirección del script no decide el canal de instalación:** sin `-dev` instala la última Release estable verificada; usa `-dev` solo para la versión de desarrollo actual.

### Linux / NAS

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

<details>
<summary><b>Ver ubicación del script y directorio de instalación predeterminado</b></summary>

```text
./install.sh
```

Ruta predeterminada de la WebUI:

```text
~/.local/share/weig-qb-webui
```

Si se ejecuta como `root`:

```text
/root/.local/share/weig-qb-webui
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
/root/qbittorrent/config/weig-qb-webui
```

entonces **Ubicación de archivos:** en qBittorrent debe ser:

```text
/config/weig-qb-webui
```

#### Un único contenedor qBittorrent

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

El instalador intenta detectar automáticamente el contenedor y el montaje `/config`.

#### Listar contenedores

```sh
sh install.sh --list-containers
```

O:

```sh
docker ps
```

Elegir un contenedor explícitamente:

```sh
sh install.sh --container=qbittorrent -configure
```

Si hay varios contenedores qBittorrent, el instalador no elige uno al azar.

#### Indicar el directorio del host montado como `/config`

```sh
sh install.sh --config-root=/root/qbittorrent/config -configure
```

Synology:

```sh
sh install.sh --config-root=/volume1/docker/qbittorrent -configure
```

Otro NAS:

```sh
sh install.sh --config-root=/share/Container/qbittorrent -configure
```

#### Elegir la ruta WebUI

```sh
sh install.sh --container=qbittorrent -o /config/weig-qb-webui -configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\install.ps1; powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

<details>
<summary><b>Ver directorio de instalación</b></summary>

```text
C:\Users\<tu-usuario>\AppData\Local\weig-qb-webui
```

</details>

## Opciones habituales
Los nombres de parámetros de PowerShell no distinguen mayúsculas y minúsculas.

| Uso | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Última Release estable | Predeterminado | Predeterminado |
| Release específica | `-version 1.0.0` | `-version 1.0.0` |
| Versión de desarrollo | `-dev` | `-dev` |
| Directorio de instalación | `-o /path` o `-o /path` | `-o D:\path` o `-output D:\path` |
| Configurar qBittorrent | `-configure` | `-configure` |
| Restaurar instalación anterior | `-rollback` | `-rollback` |
| Desinstalación completa (sin copias del instalador) | `-uninstall -purge` | `-uninstall -purge` |
| Ayuda | `-help` | `-help` |
| Elegir contenedor Docker | `--container=NAME` | — |
| Listar contenedores Docker | `--list-containers` | — |
| Ruta del host montada como `/config` | `--config-root=/path` | — |

<details>
<summary><b>Notas: (haz clic para desplegar)</b></summary>

- Una versión inexistente no cambia automáticamente a latest o dev.
- `-dev` no puede combinarse con `-version`.

### Versión específica y directorio de instalación

Linux:

```sh
sh install.sh -version 1.0.0 -o /opt/weig-qb-webui -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -version 1.0.0 -o D:\weig-qb-webui -configure
```

### Reversión

Rollback:

```sh
sh install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback
```

</details>

## Desinstalación con un solo comando

<details>
<summary><b>Desinstalación completa para Linux / NAS, Docker y Windows PowerShell</b></summary>

De forma predeterminada se recomienda la **desinstalación completa sin conservar copias del instalador**: elimina el WebUI, desactiva la interfaz alternativa correspondiente, purga las copias / el estado de rollback propiedad de ese destino y después elimina el script de instalación descargado en el directorio actual.

### Linux / NAS

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Para una ruta personalizada, añade `-o /path/to/weig-qb-webui`.

### Docker

Un contenedor / detección automática:

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Varios contenedores:

```sh
sh install.sh -uninstall -configure -purge --container=qbittorrent && rm -f -- ./install.sh
```

Al usar `--config-root`:

```sh
sh install.sh -uninstall -configure -purge --config-root=/path/to/qbittorrent/config && rm -f -- ./install.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -uninstall -configure -purge; if ($LASTEXITCODE -eq 0) { Remove-Item .\install.ps1 -Force }
```

Para una ruta personalizada, añade `-o D:\weig-qb-webui`.

`-purge` solo elimina las copias pertenecientes al destino que se está desinstalando y no afecta a otras instalaciones. Si el directorio de estado compartido queda vacío, también se elimina `~/.config/weig_qb-webui` en Linux (root: `/root/.config/weig_qb-webui`) o `%APPDATA%\WeiG_qB-WebUI` en Windows.

Para conservar las copias y poder usar `-rollback` más adelante, simplemente omite `-purge`.

</details>

## Más ayuda

Para Docker, NAS, rutas personalizadas, actualizaciones e instalación manual, consulta [Instalación, actualización y despliegue manual](installation-guide/deployment-guide.es.md).

## Licencia

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

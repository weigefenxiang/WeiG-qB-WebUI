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

El ZIP sigue conteniendo la carpeta superior `WeiG-qB-WebUI`. Después de extraerlo, cambia el nombre de esa carpeta local a **`WeiG_qB-WebUI`**; esa carpeta renombrada es el directorio WebUI que debe usar qBittorrent.

## Vista previa de la interfaz

### Escritorio

![Interfaz de escritorio de WeiG qB WebUI](../assets/screenshots/weig-qb-webui-desktop-overview.png)

### Móvil

![Interfaz móvil de WeiG qB WebUI](../assets/screenshots/weig-qb-webui-mobile-overview.png)

## Instalación para principiantes

<details>
<summary><b>¿Es tu primera instalación? Despliega esta guía de 1 minuto</b></summary>

### 1. Extraer el ZIP

Descarga `WeiG-qB-WebUI.zip`, extráelo y cambia el nombre de la carpeta extraída `WeiG-qB-WebUI` a `WeiG_qB-WebUI`. La estructura final debe ser:

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

La carpeta **`WeiG_qB-WebUI` completa** es la raíz de la WebUI. No copies solo `public` o `private`.

### 2. Moverla a una ubicación fija

```text
Windows: D:\WeiG_qB-WebUI
### Versión específica y directorio de instalación

Linux:   /opt/WeiG_qB-WebUI
```

Ese es el directorio que indicarás en qBittorrent.

### 3. Activarla en qBittorrent

Abre qBittorrent:

**Herramientas → Opciones... → WebUI**

Estos son los términos actuales de la traducción oficial al español de qBittorrent. Después:

1. Activa **Usar la interfaz Web alternativa**.
2. Busca **Ubicación de archivos:**.
3. Introduce la ruta de la carpeta `WeiG_qB-WebUI`.

Ejemplo en Windows:

```text
D:\WeiG_qB-WebUI
```

Ejemplo en Linux:

```text
/opt/WeiG_qB-WebUI
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
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Ver ubicación del script y directorio de instalación predeterminado</b></summary>

```text
./weig_qb-webui_install.sh
```

Ruta predeterminada de la WebUI:

```text
~/.local/share/weig_qb-webui
```

Si se ejecuta como `root`:

```text
/root/.local/share/weig_qb-webui
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
/root/qbittorrent/config/weig_qb-webui
```

entonces **Ubicación de archivos:** en qBittorrent debe ser:

```text
/config/weig_qb-webui
```

#### Un único contenedor qBittorrent

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

El instalador intenta detectar automáticamente el contenedor y el montaje `/config`.

#### Listar contenedores

```sh
sh weig_qb-webui_install.sh --list-containers
```

O:

```sh
docker ps
```

Elegir un contenedor explícitamente:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

Si hay varios contenedores qBittorrent, el instalador no elige uno al azar.

#### Indicar el directorio del host montado como `/config`

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

Synology:

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

Otro NAS:

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

#### Elegir la ruta WebUI

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>Ver directorio de instalación</b></summary>

```text
C:\Users\<tu-usuario>\AppData\Local\WeiG_qB-WebUI
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
| Ayuda | `-help` | `-help` |
| Elegir contenedor Docker | `--container=NAME` | — |
| Listar contenedores Docker | `--list-containers` | — |
| Ruta del host montada como `/config` | `--config-root=/path` | — |

<details>
<summary><b>Notas: (haz clic para desplegar)</b></summary>

- Una versión inexistente no cambia automáticamente a latest o dev.
- `-dev` no puede combinarse con `-version`.

Linux:

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -o /opt/weig_qb-webui -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -o D:\WeiG_qB-WebUI -configure
```

### Reversión

Rollback:

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```


</details>
## Más ayuda

Para Docker, NAS, rutas personalizadas, actualizaciones e instalación manual, consulta [Instalación, actualización y despliegue manual](installation-guide/deployment-guide.es.md).

## Licencia

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

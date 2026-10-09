# Guía para principiantes: instalación y actualización

**Idioma**: [English](deployment-guide.en.md) · [简中](deployment-guide.zh-CN.md) · [繁中](deployment-guide.zh-TW.md) · [日本語](deployment-guide.ja.md) · [한국어](deployment-guide.ko.md) · [Deutsch](deployment-guide.de.md) · [Français](deployment-guide.fr.md) · **Español** · [Português](deployment-guide.pt.md) · [Русский](deployment-guide.ru.md)

Esta guía detallada está pensada para principiantes. **La mayoría de los usuarios debería instalar la última Release estable.** Usa `dev` solo si quieres probar deliberadamente la versión de desarrollo.

Rango compatible: **qBittorrent 4.1.x → 5.2.x**.

> Si solo quieres instalar lo más rápido posible, ve directamente a **Linux / NAS**, **Docker** o **Windows PowerShell** y copia el comando principal. Las explicaciones y ejemplos adicionales están plegados por defecto.

## 1. Instalación con un clic en Linux / NAS

Comando recomendado en una línea:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

<details>
<summary><b>Ver ubicación del script, directorio predeterminado y más opciones (haz clic para desplegar)</b></summary>

### Directorio predeterminado

```text
~/.local/share/weig-qb-webui
```

Ejemplo:

```text
/home/alex/.local/share/weig-qb-webui
```

Con `root`:

```text
/root/.local/share/weig-qb-webui
```

El script queda en el directorio actual:

```text
./install.sh
```

### Ejemplo 1: última Release + configuración automática

```sh
sh install.sh -configure
```

### Ejemplo 2: instalar solo los archivos

```sh
sh install.sh
```

Después configura qBittorrent manualmente:

**Herramientas → Opciones... → WebUI**

1. Activa **Usar la interfaz Web alternativa**.
2. En **Ubicación de archivos:** indica el directorio de WeiG qB WebUI.
3. Guarda con **OK**.

### Ejemplo 3: Release específica

```sh
sh install.sh -version 1.2.0 -configure
```

### Ejemplo 4: directorio personalizado

```sh
sh install.sh -o /opt/weig-qb-webui -configure
```

O:

```sh
sh install.sh -o /opt/weig-qb-webui -configure
```

### Ejemplo 5: versión + directorio

```sh
sh install.sh -version 1.2.0 -o /opt/weig-qb-webui -configure
```

### Ejemplo 6: dev

```sh
sh install.sh -dev -configure
```

### Ejemplo 7: actualizar a latest

```sh
sh install.sh -configure
```

A una versión concreta:

```sh
sh install.sh -version 1.2.0 -configure
```

### Ejemplo 8: rollback

```sh
sh install.sh -rollback
```

### Ejemplo 9: ayuda

```sh
sh install.sh -help
```

El instalador Linux detecta herramientas disponibles como `curl`, `wget`, BusyBox o Python 3. Si no hay ninguna forma disponible de comprobar SHA-256, no instala una Release sin verificar.

</details>

---

## 2. Instalación con un clic en Docker

Prueba primero el comando normal:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

<details>
<summary><b>Rutas de Docker, varios contenedores y opciones avanzadas (haz clic para desplegar)</b></summary>

Si solo hay un contenedor qBittorrent en ejecución con un montaje `/config` normal, el instalador intenta detectarlo automáticamente.

### Ruta del host y ruta del contenedor

Ejemplo Docker Compose:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Significa:

```text
Host:       /root/qbittorrent/config
Contenedor: /config
```

Si la WebUI está físicamente en el host aquí:

```text
/root/qbittorrent/config/weig-qb-webui
```

entonces **Ubicación de archivos:** en qBittorrent normalmente debe ser:

```text
/config/weig-qb-webui
```

### Conversión Docker predeterminada

Si se detecta:

```text
Container /config -> Host /root/qbittorrent/config
```

y no se usa `-o`:

```text
Host install path: /root/qbittorrent/config/weig-qb-webui
qBittorrent Root Folder: /config/weig-qb-webui
```

### Ejemplo 1: un contenedor qBittorrent

```sh
sh install.sh -configure
```

### Ejemplo 2: listar contenedores

```sh
sh install.sh --list-containers
```

O:

```sh
docker ps
```

### Ejemplo 3: elegir un contenedor

```sh
sh install.sh --container=qbittorrent -configure
```

### Ejemplo 4: varios contenedores qBittorrent

```sh
sh install.sh --list-containers
sh install.sh --container=qbittorrent -configure
```

Contenedor de pruebas:

```sh
sh install.sh --container=qbittorrent-test -configure
```

Si hay varios candidatos, el instalador no elige uno al azar.

### Ejemplo 5: conoces el directorio del host montado como `/config`

```sh
sh install.sh --config-root=/root/qbittorrent/config -configure
```

### Ejemplo 6: Synology

```sh
sh install.sh --config-root=/volume1/docker/qbittorrent -configure
```

### Ejemplo 7: otro NAS

```sh
sh install.sh --config-root=/share/Container/qbittorrent -configure
```

Sustituye estos ejemplos por el directorio real del host montado como `/config`.

### Ejemplo 8: elegir una ruta WebUI visible en el contenedor

```sh
sh install.sh --container=qbittorrent -o /config/weig-qb-webui -configure
```

Si `/config` corresponde a `/root/qbittorrent/config`:

```text
/config/weig-qb-webui
        ↓
/root/qbittorrent/config/weig-qb-webui
```

### Ejemplo 9: Release específica

```sh
sh install.sh --container=qbittorrent -version 1.2.0 -configure
```

### Ejemplo 10: dev

```sh
sh install.sh --container=qbittorrent -dev -configure
```

### Ejemplo 11: rollback

```sh
sh install.sh -rollback
```

### Error Docker más común

Introducir una ruta del host en qBittorrent. Dentro del contenedor normalmente debe usarse:

```text
/config/weig-qb-webui
```

</details>

---

## 3. Instalación con un clic en Windows

Comando recomendado:

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\install.ps1; powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

<details>
<summary><b>Ver directorio predeterminado y más opciones de Windows (haz clic para desplegar)</b></summary>

### Directorio predeterminado

```text
C:\Users\<tu-usuario>\AppData\Local\weig-qb-webui
```

Equivale a:

```text
%LOCALAPPDATA%\weig-qb-webui
```

### Ejemplo 1: latest + configuración automática

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

### Ejemplo 2: solo archivos

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Después abre **Herramientas → Opciones... → WebUI**, activa **Usar la interfaz Web alternativa** e indica el directorio de instalación en **Ubicación de archivos:**.

### Ejemplo 3: Release específica

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -version 1.2.0 -configure
```

### Ejemplo 4: instalar en D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -o D:\weig-qb-webui -configure
```

### Ejemplo 5: versión + directorio

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -version 1.2.0 -o D:\weig-qb-webui -configure
```

### Ejemplo 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -dev -configure
```

### Ejemplo 7: actualizar

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

### Ejemplo 8: rollback

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback
```

### Ejemplo 9: ayuda

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -help
```

Los parámetros de PowerShell no distinguen mayúsculas y minúsculas. `-ExecutionPolicy Bypass` solo se aplica a ese proceso de PowerShell y no cambia permanentemente la política del sistema.

</details>

---

## 4. Cómo actualizar, revertir y desinstalar

**Volver a ejecutar el instalador es la forma normal de actualizar.** Prepara y verifica la nueva versión antes de cambiar el WebUI.

<details>
<summary><b>Mostrar comandos de actualización, reversión y desinstalación</b></summary>

### Actualizar a la última versión estable

Linux / NAS / Docker:

```sh
sh install.sh -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

### Volver a la instalación anterior

Linux / NAS / Docker:

```sh
sh install.sh -rollback
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback
```

### Desinstalación con un solo comando

De forma predeterminada recomendamos la **desinstalación completa sin conservar copias del instalador**. Elimina de forma segura el WeiG WebUI actual, desactiva la interfaz alternativa correspondiente, purga las copias / el estado de rollback de este destino y, al finalizar correctamente, elimina también el script de instalación del directorio actual.

Linux / NAS:

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Docker (single container / automatic detection):

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Docker (multiple containers, explicit selection):

```sh
sh install.sh -uninstall -configure -purge --container=qbittorrent && rm -f -- ./install.sh
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -uninstall -configure -purge; if ($LASTEXITCODE -eq 0) { Remove-Item .\install.ps1 -Force }
```

Para una ruta personalizada, añade `-o /path` o `-o D:\path`. Si no quieres modificar la configuración de qBittorrent, omite `-configure`.

`-purge` solo limpia el destino que se está desinstalando. Si el directorio de estado compartido queda vacío, también se elimina `~/.config/weig-qb-webui` en Linux (root: `/root/.config/weig-qb-webui`) o `%APPDATA%\weig-qb-webui` en Windows.

Para conservar las copias y usar `-rollback` más adelante, omite `-purge`.

Las copias del instalador de Linux se guardan en `~/.config/weig-qb-webui/backups/`; se conservan las tres más recientes de forma independiente por destino.

Si solo quieres volver temporalmente al WebUI nativo de qBittorrent, desactiva **Usar WebUI alternativa** en **Herramientas → Opciones… → WebUI**.

</details>

## 5. Opciones habituales

Linux / Docker / NAS usan `install.sh`; Windows usa `install.ps1`. Los parámetros de PowerShell no distinguen mayúsculas y minúsculas.

| Uso | Linux / Docker / NAS | Windows PowerShell | Nota |
|---|---|---|---|
| Última Release estable | Predeterminado | Predeterminado | Recomendado |
| Release específica | `-version 1.2.0` | `-version 1.2.0` | Instala solo esa Release |
| Versión de desarrollo | `-dev` | `-dev` | SHA Git exacto del `dev` actual |
| Directorio de instalación | `-o /path` / `-o /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| Archivo de configuración qBittorrent personalizado | — | `-qbconfig D:\path\qBittorrent.ini` | Versión portátil de Windows |
| Configurar qBittorrent automáticamente | `-configure` | `-configure` | Activa la WebUI alternativa y fija la ruta |
| Revertir | `-rollback` | `-rollback` | Restaura la instalación y config qB anteriores |
| Desinstalación completa (recomendada, sin copias del instalador) | `-uninstall -purge` | `-uninstall -purge` | Purga las copias / estado de rollback de este destino |
| Ayuda | `-help` | `-help` | Muestra la ayuda completa |
| Elegir contenedor Docker | `--container=NAME` | — | Útil con varios contenedores qB |
| Listar contenedores Docker | `--list-containers` | — | Muestra los contenedores qB detectados |
| Indicar `/config` del host | `--config-root=/path` | — | Si conoces el origen del montaje |

<details>
<summary><b>Notas: (haz clic para desplegar)</b></summary>

Reglas importantes:

- Sin opción de origen se instala la última Release estable.
- `-version` instala exactamente la Release solicitada. Si no existe, se detiene y **no cambia automáticamente a latest ni dev**.
- `-dev` y `-version` no pueden usarse juntos.
- `-configure` guarda una copia de la configuración de qBittorrent antes de modificarla.
- `-rollback` restaura el estado anterior cuando hay una copia disponible.

</details>

---

## 6. Instalación manual

Última Release:

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

Descarga:

```text
weig-qb-webui.zip
SHA256SUMS
```

<details>
<summary><b>Desplegar: descarga manual, verificación, extracción y configuración</b></summary>

Linux:

```sh
# Download the ZIP asset from https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip weig-qb-webui.zip
# El archivo de la Release ya contiene la carpeta superior canónica `weig-qb-webui`; extráela y úsala directamente como raíz WebUI de qBittorrent. No es necesario cambiarle el nombre.
```

Windows:

```powershell
# Download the ZIP asset from https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
Expand-Archive .\weig-qb-webui.zip . -Force
# El archivo de la Release ya contiene la carpeta superior canónica `weig-qb-webui`; extráela y úsala directamente como raíz WebUI de qBittorrent. No es necesario cambiarle el nombre.
```

Calcular SHA-256:

```powershell
Get-FileHash .\weig-qb-webui.zip -Algorithm SHA256
```

Después de extraer:

```text
weig-qb-webui/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

En qBittorrent abre **Herramientas → Opciones... → WebUI**, activa **Usar la interfaz Web alternativa** y establece **Ubicación de archivos:** en la raíz `weig-qb-webui`.

</details>

---

## 7. Problemas frecuentes

<details>
<summary><b>Desplegar: caché, 404, rutas Docker, varios contenedores, checksum</b></summary>

### Sigue apareciendo la página antigua

Prueba `Ctrl + F5` o una ventana privada.

### 404 / WebUI no carga

El directorio configurado en **Ubicación de archivos:** debe contener directamente:

```text
public
private
VERSION
GIT_SHA
```

### Docker no encuentra los archivos

Probablemente se usó la ruta del host. La ruta habitual del contenedor es:

```text
/config/weig-qb-webui
```

### Varios contenedores

```sh
sh install.sh --list-containers
sh install.sh --container=qbittorrent -configure
```

### Error de checksum

No lo ignores. Descarga de nuevo. El instalador se detiene deliberadamente si el ZIP y `SHA256SUMS` no coinciden.

</details>

---

## 8. Cómo comprobar la versión instalada

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` indica la versión, `GIT_SHA` el commit Git exacto y `private/weigg-install.json` registra origen, SHA, rutas e información Docker.

---

## 9. Compatibilidad

```text
qBittorrent 4.1.x → 5.2.x
```

El objetivo mínimo principal de WebAPI v2 es **qBittorrent 4.1.0**. qBittorrent 4.0.x usa la antigua WebAPI v1 y queda fuera del soporte principal actual.

---

## 10. Opciones avanzadas / mantenimiento

<details>
<summary><b>Desplegar: SHA Git exacto y verificación de la versión</b></summary>

Una instalación `dev` resuelve primero el `dev` actual a un SHA Git de 40 caracteres, instala exactamente ese commit y lo escribe en `GIT_SHA`.

Una Release normal proporciona:

```text
weig-qb-webui.zip
SHA256SUMS
```


</details>

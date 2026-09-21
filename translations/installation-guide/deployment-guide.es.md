# Guía para principiantes: instalación y actualización

**Idioma**: [English](deployment-guide.en.md) · [简中](deployment-guide.zh-CN.md) · [繁中](deployment-guide.zh-TW.md) · [日本語](deployment-guide.ja.md) · [한국어](deployment-guide.ko.md) · [Deutsch](deployment-guide.de.md) · [Français](deployment-guide.fr.md) · **Español** · [Português](deployment-guide.pt.md) · [Русский](deployment-guide.ru.md)

Esta guía detallada está pensada para principiantes. **La mayoría de los usuarios debería instalar la última Release estable.** Usa `dev` solo si quieres probar deliberadamente la versión de desarrollo.

Rango compatible: **qBittorrent 4.1.x → 5.2.x**.

> Si solo quieres instalar lo más rápido posible, ve directamente a **Linux / NAS**, **Docker** o **Windows PowerShell** y copia el comando principal. Las explicaciones y ejemplos adicionales están plegados por defecto.

## 1. Instalación con un clic en Linux / NAS

Comando recomendado en una línea:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Ver ubicación del script, directorio predeterminado y más opciones (haz clic para desplegar)</b></summary>

### Directorio predeterminado

```text
~/.local/share/weig_qb-webui
```

Ejemplo:

```text
/home/alex/.local/share/weig_qb-webui
```

Con `root`:

```text
/root/.local/share/weig_qb-webui
```

El script queda en el directorio actual:

```text
./weig_qb-webui_install.sh
```

### Ejemplo 1: última Release + configuración automática

```sh
sh weig_qb-webui_install.sh -configure
```

### Ejemplo 2: instalar solo los archivos

```sh
sh weig_qb-webui_install.sh
```

Después configura qBittorrent manualmente:

**Herramientas → Opciones... → WebUI**

1. Activa **Usar la interfaz Web alternativa**.
2. En **Ubicación de archivos:** indica el directorio de WeiG qB WebUI.
3. Guarda con **OK**.

### Ejemplo 3: Release específica

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -configure
```

### Ejemplo 4: directorio personalizado

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

O:

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

### Ejemplo 5: versión + directorio

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -o /opt/weig_qb-webui -configure
```

### Ejemplo 6: dev

```sh
sh weig_qb-webui_install.sh -dev -configure
```

### Ejemplo 7: actualizar a latest

```sh
sh weig_qb-webui_install.sh -configure
```

A una versión concreta:

```sh
sh weig_qb-webui_install.sh -version 0.1.1 -configure
```

### Ejemplo 8: rollback

```sh
sh weig_qb-webui_install.sh -rollback
```

### Ejemplo 9: ayuda

```sh
sh weig_qb-webui_install.sh -help
```

El instalador Linux detecta herramientas disponibles como `curl`, `wget`, BusyBox o Python 3. Si no hay ninguna forma disponible de comprobar SHA-256, no instala una Release sin verificar.

</details>

---

---

## 2. Instalación con un clic en Docker

Prueba primero el comando normal:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
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
/root/qbittorrent/config/weig_qb-webui
```

entonces **Ubicación de archivos:** en qBittorrent normalmente debe ser:

```text
/config/weig_qb-webui
```

### Conversión Docker predeterminada

Si se detecta:

```text
Container /config -> Host /root/qbittorrent/config
```

y no se usa `-o`:

```text
Host install path: /root/qbittorrent/config/weig_qb-webui
qBittorrent Root Folder: /config/weig_qb-webui
```

### Ejemplo 1: un contenedor qBittorrent

```sh
sh weig_qb-webui_install.sh -configure
```

### Ejemplo 2: listar contenedores

```sh
sh weig_qb-webui_install.sh --list-containers
```

O:

```sh
docker ps
```

### Ejemplo 3: elegir un contenedor

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### Ejemplo 4: varios contenedores qBittorrent

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

Contenedor de pruebas:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

Si hay varios candidatos, el instalador no elige uno al azar.

### Ejemplo 5: conoces el directorio del host montado como `/config`

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

### Ejemplo 6: Synology

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

### Ejemplo 7: otro NAS

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

Sustituye estos ejemplos por el directorio real del host montado como `/config`.

### Ejemplo 8: elegir una ruta WebUI visible en el contenedor

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

Si `/config` corresponde a `/root/qbittorrent/config`:

```text
/config/weig_qb-webui
        ↓
/root/qbittorrent/config/weig_qb-webui
```

### Ejemplo 9: Release específica

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -version 1.0.0 -configure
```

### Ejemplo 10: dev

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -dev -configure
```

### Ejemplo 11: rollback

```sh
sh weig_qb-webui_install.sh -rollback
```

### Error Docker más común

Introducir una ruta del host en qBittorrent. Dentro del contenedor normalmente debe usarse:

```text
/config/weig_qb-webui
```

</details>

---

---

## 3. Instalación con un clic en Windows

Comando recomendado:

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>Ver directorio predeterminado y más opciones de Windows (haz clic para desplegar)</b></summary>

### Directorio predeterminado

```text
C:\Users\<tu-usuario>\AppData\Local\WeiG_qB-WebUI
```

Equivale a:

```text
%LOCALAPPDATA%\WeiG_qB-WebUI
```

### Ejemplo 1: latest + configuración automática

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Ejemplo 2: solo archivos

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1
```

Después abre **Herramientas → Opciones... → WebUI**, activa **Usar la interfaz Web alternativa** e indica el directorio de instalación en **Ubicación de archivos:**.

### Ejemplo 3: Release específica

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -configure
```

### Ejemplo 4: instalar en D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -o D:\WeiG_qB-WebUI -configure
```

### Ejemplo 5: versión + directorio

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -o D:\WeiG_qB-WebUI -configure
```

### Ejemplo 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

### Ejemplo 7: actualizar

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Ejemplo 8: rollback

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

### Ejemplo 9: ayuda

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -help
```

Los parámetros de PowerShell no distinguen mayúsculas y minúsculas. `-ExecutionPolicy Bypass` solo se aplica a ese proceso de PowerShell y no cambia permanentemente la política del sistema.

</details>

---

---

## 4. Cómo actualizar y volver atrás


Volver a ejecutar el instalador es el método normal de actualización.

<details>
<summary><b>Ver comandos de actualización y rollback (haz clic para desplegar)</b></summary>

Linux:

```sh
sh weig_qb-webui_install.sh -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

Rollback:

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

Para volver inmediatamente a la WebUI integrada de qBittorrent, desactiva **Usar la interfaz Web alternativa**.

</details>

---

## 5. Opciones habituales

Linux / Docker / NAS usan `install.sh`; Windows usa `install.ps1`. Los parámetros de PowerShell no distinguen mayúsculas y minúsculas.

| Uso | Linux / Docker / NAS | Windows PowerShell | Nota |
|---|---|---|---|
| Última Release estable | Predeterminado | Predeterminado | Recomendado |
| Release específica | `-version 1.0.0` | `-version 1.0.0` | Instala solo esa Release |
| Versión de desarrollo | `-dev` | `-dev` | SHA Git exacto del `dev` actual |
| Directorio de instalación | `-o /path` / `-o /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| Configurar qBittorrent automáticamente | `-configure` | `-configure` | Activa la WebUI alternativa y fija la ruta |
| Revertir | `-rollback` | `-rollback` | Restaura la instalación y config qB anteriores |
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
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>Desplegar: descarga manual, verificación, extracción y configuración</b></summary>

Linux:

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -o WeiG-qB-WebUI.zip
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
mv WeiG-qB-WebUI WeiG_qB-WebUI
```

Windows:

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip . -Force
Rename-Item .\WeiG-qB-WebUI WeiG_qB-WebUI
```

Calcular SHA-256:

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

Después de extraer:

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

En qBittorrent abre **Herramientas → Opciones... → WebUI**, activa **Usar la interfaz Web alternativa** y establece **Ubicación de archivos:** en la raíz `WeiG_qB-WebUI`.

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
/config/weig_qb-webui
```

### Varios contenedores

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
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
<summary><b>Desplegar: exact SHA, identidad de Release y opciones antiguas</b></summary>

Una instalación `dev` resuelve primero el `dev` actual a un SHA Git de 40 caracteres, instala exactamente ese commit y lo escribe en `GIT_SHA`.

Una Release normal proporciona:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Linux conserva `--channel=release|dev`, `--dir=/path`, `--update` y Windows conserva `-Channel`, `-Destination`, `-Mode` por compatibilidad. Para instalaciones nuevas usa las opciones modernas del inicio de esta página.

</details>

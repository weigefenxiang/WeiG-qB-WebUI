# Instalación, actualización y despliegue manual

**Idioma**: [English](README.en.md) · [简中](../../docs/007.安装升级与手动部署.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · **Español** · [Português](README.pt.md) · [Русский](README.ru.md)

Esta guía detallada está pensada para principiantes. **La mayoría de los usuarios debería instalar la última Release estable.** Usa `dev` solo si quieres probar deliberadamente la versión de desarrollo.

Rango compatible: **qBittorrent 4.1.x → 5.2.x**.

> Si solo quieres instalar lo más rápido posible, ve directamente a **Linux / NAS**, **Docker** o **Windows PowerShell** y copia el comando principal. Las explicaciones y ejemplos adicionales están plegados por defecto.

## 1. Opciones más usadas

Linux / Docker / NAS usan `install.sh`; Windows usa `install.ps1`. Los parámetros de PowerShell no distinguen mayúsculas y minúsculas.

| Uso | Linux / Docker / NAS | Windows PowerShell | Nota |
|---|---|---|---|
| Última Release estable | Predeterminado | Predeterminado | Recomendado |
| Release específica | `--version 0.3.60` | `-version 0.3.60` | Instala solo esa Release |
| Versión de desarrollo | `--dev` | `-dev` | SHA Git exacto del `dev` actual |
| Directorio de instalación | `-o /path` / `--output /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| Configurar qBittorrent automáticamente | `--configure` | `-configure` | Activa la WebUI alternativa y fija la ruta |
| Revertir | `--rollback` | `-rollback` | Restaura la instalación y config qB anteriores |
| Ayuda | `--help` | `-help` | Muestra la ayuda completa |
| Elegir contenedor Docker | `--container=NAME` | — | Útil con varios contenedores qB |
| Listar contenedores Docker | `--list-containers` | — | Muestra los contenedores qB detectados |
| Indicar `/config` del host | `--config-root=/path` | — | Si conoces el origen del montaje |

Reglas importantes:

- Sin opción de origen se instala la última Release estable.
- `--version / -version` instala exactamente la Release solicitada. Si no existe, se detiene y **no cambia automáticamente a latest ni dev**.
- `--dev / -dev` y `--version / -version` no pueden usarse juntos.
- `--configure / -configure` guarda una copia de la configuración de qBittorrent antes de modificarla.
- `--rollback / -rollback` restaura el estado anterior cuando hay una copia disponible.

## 2. ¿Qué origen debo usar?

### Última Release estable — recomendada

El instalador descarga:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Verifica SHA-256 antes de desplegar. Si la verificación falla, se detiene.

### Release específica

Ejemplo:

```text
0.3.60
```

Corresponde a la etiqueta `v0.3.60`.

### dev

`dev` no es un respaldo si falla una Release. El instalador resuelve primero el `dev` actual a un **SHA Git exacto de 40 caracteres** y descarga ese commit concreto.

---

## 3. Linux / NAS

Comando recomendado en una línea:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>Desplegar: rutas Linux / NAS, opciones, actualizaciones y ejemplos</b></summary>

### Directorio predeterminado

```text
~/.local/share/weigg-qb-webui
```

Ejemplo:

```text
/home/alex/.local/share/weigg-qb-webui
```

Con `root`:

```text
/root/.local/share/weigg-qb-webui
```

El script queda en el directorio actual:

```text
./weigg-install.sh
```

### Ejemplo 1: última Release + configuración automática

```sh
sh weigg-install.sh --configure
```

### Ejemplo 2: instalar solo los archivos

```sh
sh weigg-install.sh
```

Después configura qBittorrent manualmente:

**Herramientas → Opciones... → WebUI**

1. Activa **Usar la interfaz Web alternativa**.
2. En **Ubicación de archivos:** indica el directorio de WeiG qB WebUI.
3. Guarda con **OK**.

### Ejemplo 3: Release específica

```sh
sh weigg-install.sh --version 0.3.60 --configure
```

### Ejemplo 4: directorio personalizado

```sh
sh weigg-install.sh -o /opt/weigg-qb-webui --configure
```

O:

```sh
sh weigg-install.sh --output /opt/weigg-qb-webui --configure
```

### Ejemplo 5: versión + directorio

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

### Ejemplo 6: dev

```sh
sh weigg-install.sh --dev --configure
```

### Ejemplo 7: actualizar a latest

```sh
sh weigg-install.sh --configure
```

A una versión concreta:

```sh
sh weigg-install.sh --version 0.3.61 --configure
```

### Ejemplo 8: rollback

```sh
sh weigg-install.sh --rollback
```

### Ejemplo 9: ayuda

```sh
sh weigg-install.sh --help
```

El instalador Linux detecta herramientas disponibles como `curl`, `wget`, BusyBox o Python 3. Si no hay ninguna forma disponible de comprobar SHA-256, no instala una Release sin verificar.

</details>

---

## 4. Docker

Prueba primero el comando normal:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

Si solo hay un contenedor qBittorrent en ejecución con un montaje `/config` normal, el instalador intenta detectarlo automáticamente.

<details>
<summary><b>Desplegar: conceptos Docker, varios contenedores, NAS y ejemplos</b></summary>

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
/root/qbittorrent/config/weigg-qb-webui
```

entonces **Ubicación de archivos:** en qBittorrent normalmente debe ser:

```text
/config/weigg-qb-webui
```

### Conversión Docker predeterminada

Si se detecta:

```text
Container /config -> Host /root/qbittorrent/config
```

y no se usa `-o`:

```text
Host install path: /root/qbittorrent/config/weigg-qb-webui
qBittorrent Root Folder: /config/weigg-qb-webui
```

### Ejemplo 1: un contenedor qBittorrent

```sh
sh weigg-install.sh --configure
```

### Ejemplo 2: listar contenedores

```sh
sh weigg-install.sh --list-containers
```

O:

```sh
docker ps
```

### Ejemplo 3: elegir un contenedor

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

### Ejemplo 4: varios contenedores qBittorrent

```sh
sh weigg-install.sh --list-containers
sh weigg-install.sh --container=qbittorrent --configure
```

Contenedor de pruebas:

```sh
sh weigg-install.sh --container=qbittorrent-test --configure
```

Si hay varios candidatos, el instalador no elige uno al azar.

### Ejemplo 5: conoces el directorio del host montado como `/config`

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

### Ejemplo 6: Synology

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

### Ejemplo 7: otro NAS

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

Sustituye estos ejemplos por el directorio real del host montado como `/config`.

### Ejemplo 8: elegir una ruta WebUI visible en el contenedor

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

Si `/config` corresponde a `/root/qbittorrent/config`:

```text
/config/weigg-qb-webui
        ↓
/root/qbittorrent/config/weigg-qb-webui
```

### Ejemplo 9: Release específica

```sh
sh weigg-install.sh --container=qbittorrent --version 0.3.60 --configure
```

### Ejemplo 10: dev

```sh
sh weigg-install.sh --container=qbittorrent --dev --configure
```

### Ejemplo 11: rollback

```sh
sh weigg-install.sh --rollback
```

### Error Docker más común

Introducir una ruta del host en qBittorrent. Dentro del contenedor normalmente debe usarse:

```text
/config/weigg-qb-webui
```

</details>

---

## 5. Windows PowerShell

Comando recomendado:

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>Desplegar: rutas Windows, opciones, actualizaciones y ejemplos</b></summary>

### Directorio predeterminado

```text
C:\Users\<tu-usuario>\AppData\Local\WeiG-qB-WebUI
```

Equivale a:

```text
%LOCALAPPDATA%\WeiG-qB-WebUI
```

### Ejemplo 1: latest + configuración automática

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

### Ejemplo 2: solo archivos

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1
```

Después abre **Herramientas → Opciones... → WebUI**, activa **Usar la interfaz Web alternativa** e indica el directorio de instalación en **Ubicación de archivos:**.

### Ejemplo 3: Release específica

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -configure
```

### Ejemplo 4: instalar en D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -o D:\WeiG-qB-WebUI -configure
```

### Ejemplo 5: versión + directorio

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

### Ejemplo 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -dev -configure
```

### Ejemplo 7: actualizar

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

### Ejemplo 8: rollback

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

### Ejemplo 9: ayuda

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -help
```

Los parámetros de PowerShell no distinguen mayúsculas y minúsculas. `-ExecutionPolicy Bypass` solo se aplica a ese proceso de PowerShell y no cambia permanentemente la política del sistema.

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
```

Windows:

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip .\WeiG-qB-WebUI -Force
```

Calcular SHA-256:

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

Después de extraer:

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

En qBittorrent abre **Herramientas → Opciones... → WebUI**, activa **Usar la interfaz Web alternativa** y establece **Ubicación de archivos:** en la raíz `WeiG-qB-WebUI`.

</details>

## 7. Actualización y rollback

Volver a ejecutar el instalador es el método normal de actualización.

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

Para volver inmediatamente a la WebUI integrada de qBittorrent, desactiva **Usar la interfaz Web alternativa**.

## 8. Solución de problemas

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
/config/weigg-qb-webui
```

### Varios contenedores

```sh
sh weigg-install.sh --list-containers
sh weigg-install.sh --container=qbittorrent --configure
```

### Error de checksum

No lo ignores. Descarga de nuevo. El instalador se detiene deliberadamente si el ZIP y `SHA256SUMS` no coinciden.

</details>

## 9. Comprobar la versión instalada

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` indica la versión, `GIT_SHA` el commit Git exacto y `private/weigg-install.json` registra origen, SHA, rutas e información Docker.

## 10. Compatibilidad

```text
qBittorrent 4.1.x → 5.2.x
```

El objetivo mínimo principal de WebAPI v2 es **qBittorrent 4.1.0**. qBittorrent 4.0.x usa la antigua WebAPI v1 y queda fuera del soporte principal actual.

## 11. Avanzado / mantenedores

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

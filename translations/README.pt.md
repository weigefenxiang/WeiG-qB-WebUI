# WeiG qB WebUI

Uma Alternate WebUI moderna e responsiva para qBittorrent, otimizada para computador e dispositivos móveis.

**📱 Adaptada a dispositivos móveis · 🌙 Modo escuro · ✅ Compatível com qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 Pré-visualização online](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Transferir a versão estável mais recente](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest)**

**Idioma**: [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · **Português** · [Русский](README.ru.md)

## Transferência direta

Transfira a versão estável mais recente [**weig-qb-webui.zip**](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest). O mesmo ficheiro ZIP também funciona em Linux e NAS.

## Pré-visualização da interface

### Desktop

<p align="center">
  <img src="../assets/screenshots/weig-qb-webui-desktop-overview.png" alt="Interface de desktop do WeiG qB WebUI" width="800">
</p>

### Mobile

<p align="center">
  <img src="../assets/screenshots/weig-qb-webui-mobile-overview.gif" alt="Animação mobile do WeiG qB WebUI" height="341"><img src="../assets/screenshots/weig-qb-webui-mobile-overview.png" alt="Interface mobile do WeiG qB WebUI" height="341">
</p>

## Instalação para iniciantes

<details>
<summary><b>Primeira instalação? Abrir o guia de 1 minuto</b></summary>

### 1. Extrair o ZIP

Transfira `weig-qb-webui.zip` e extraia-o. O arquivo já cria a pasta canónica:

```text
weig-qb-webui/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

A pasta **`weig-qb-webui` completa** é a raiz da WebUI. Não copie apenas `public` ou `private`.

### 2. Mover para uma localização permanente

```text
Windows: D:\weig-qb-webui
Linux:   /opt/weig-qb-webui
```

Este é o diretório que deverá indicar no qBittorrent.

### 3. Ativar no qBittorrent

Abra o qBittorrent:

**Ferramentas → Opções... → WebUI**

Estes são os termos atuais da tradução oficial portuguesa do qBittorrent. Depois:

1. Ative **Usar interface web alternativa**.
2. Procure **Localização dos ficheiros:**.
3. Introduza o caminho para a pasta `weig-qb-webui`.

Exemplo Windows:

```text
D:\weig-qb-webui
```

Exemplo Linux:

```text
/opt/weig-qb-webui
```

4. Clique em **OK** para guardar.
5. Atualize a página da WebUI. Se a interface antiga continuar em cache, experimente `Ctrl + F5`.

> **Como confirmar o caminho:** dentro do diretório indicado deve conseguir ver diretamente `public`, `private`, `VERSION` e os restantes ficheiros.

> **Docker:** o qBittorrent é executado dentro de um contentor. Normalmente deve indicar um caminho visível pelo contentor, não o caminho real do anfitrião.

</details>

## Instalação com um comando

O instalador de um clique para Linux/NAS é sempre descarregado pelo endereço fixo do Dev Pages abaixo. **O endereço do script não escolhe o canal de instalação:** sem `-dev`, instala a Release estável mais recente e verificada; use `-dev` apenas para a versão de desenvolvimento atual.

### Linux / NAS

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

<details>
<summary><b>Mostrar localização do script e diretório de instalação predefinido</b></summary>

```text
./install.sh
```

Diretório predefinido da WebUI:

```text
~/.local/share/weig-qb-webui
```

Ao executar como `root`:

```text
/root/.local/share/weig-qb-webui
```

</details>

### Docker

<details>
<summary><b>Instalação Docker / vários contentores / caminhos</b></summary>

#### Anfitrião e contentor

- **Anfitrião**: o sistema Linux/NAS onde o Docker é executado.
- **Contentor**: o ambiente isolado onde o qBittorrent é executado.

Exemplo:

```text
Anfitrião: /root/qbittorrent/config
   ↓ montado em
Contentor: /config
```

Docker Compose:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Se a WebUI estiver instalada no anfitrião em:

```text
/root/qbittorrent/config/weig-qb-webui
```

então **Localização dos ficheiros:** no qBittorrent deve ser:

```text
/config/weig-qb-webui
```

#### Apenas um contentor qBittorrent

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o install.sh && sh install.sh -configure
```

O instalador tenta detetar automaticamente o contentor e a montagem `/config`.

#### Listar contentores

```sh
sh install.sh --list-containers
```

Ou:

```sh
docker ps
```

Selecionar explicitamente um contentor:

```sh
sh install.sh --container=qbittorrent -configure
```

Se existirem vários contentores qBittorrent, o instalador não escolhe um ao acaso.

#### Indicar a pasta do anfitrião montada como `/config`

```sh
sh install.sh --config-root=/root/qbittorrent/config -configure
```

Synology:

```sh
sh install.sh --config-root=/volume1/docker/qbittorrent -configure
```

Outro NAS:

```sh
sh install.sh --config-root=/share/Container/qbittorrent -configure
```

#### Escolher o caminho da WebUI

```sh
sh install.sh --container=qbittorrent -o /config/weig-qb-webui -configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\install.ps1; powershell -ExecutionPolicy Bypass -File .\install.ps1 -configure
```

<details>
<summary><b>Mostrar diretório de instalação</b></summary>

```text
C:\Users\<nome-do-utilizador>\AppData\Local\weig-qb-webui
```

</details>

## Opções comuns
Os nomes dos parâmetros PowerShell não distinguem maiúsculas de minúsculas.

| Utilização | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Release estável mais recente | Predefinição | Predefinição |
| Release específica | `-version 1.2.0` | `-version 1.2.0` |
| Versão de desenvolvimento | `-dev` | `-dev` |
| Diretório de instalação | `-o /path` ou `-o /path` | `-o D:\path` ou `-output D:\path` |
| Configurar o qBittorrent | `-configure` | `-configure` |
| Restaurar a instalação anterior | `-rollback` | `-rollback` |
| Desinstalação completa (sem cópias do instalador) | `-uninstall -purge` | `-uninstall -purge` |
| Ajuda | `-help` | `-help` |
| Selecionar contentor Docker | `--container=NAME` | — |
| Listar contentores Docker | `--list-containers` | — |
| Caminho do anfitrião montado como `/config` | `--config-root=/path` | — |

<details>
<summary><b>Notas: (clique para expandir)</b></summary>

- Uma versão inexistente não muda automaticamente para latest ou dev.
- `-dev` não pode ser combinado com `-version`.

### Versão específica e diretório de instalação

Linux:

```sh
sh install.sh -version 1.2.0 -o /opt/weig-qb-webui -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -version 1.2.0 -o D:\weig-qb-webui -configure
```

### Restauro

Restauro:

```sh
sh install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -rollback
```

</details>

## Desinstalação com um comando

<details>
<summary><b>Desinstalação completa em Linux / NAS, Docker e Windows PowerShell</b></summary>

Por predefinição, recomendamos a **desinstalação completa sem manter cópias do instalador**: remove o WebUI, desativa a interface alternativa correspondente, elimina as cópias / estado de rollback pertencentes a esse destino e, por fim, remove o script de instalação transferido no diretório atual.

### Linux / NAS

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Para um caminho personalizado, acrescente `-o /path/to/weig-qb-webui`.

### Docker

Um contentor / deteção automática:

```sh
sh install.sh -uninstall -configure -purge && rm -f -- ./install.sh
```

Vários contentores:

```sh
sh install.sh -uninstall -configure -purge --container=qbittorrent && rm -f -- ./install.sh
```

Ao usar `--config-root`:

```sh
sh install.sh -uninstall -configure -purge --config-root=/path/to/qbittorrent/config && rm -f -- ./install.sh
```

### Windows PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -uninstall -configure -purge; if ($LASTEXITCODE -eq 0) { Remove-Item .\install.ps1 -Force }
```

Para um caminho personalizado, acrescente `-o D:\weig-qb-webui`.

`-purge` elimina apenas as cópias pertencentes ao destino que está a ser desinstalado e não afeta outras instalações. Se o diretório de estado partilhado ficar vazio, `~/.config/weig-qb-webui` no Linux (root: `/root/.config/weig-qb-webui`) ou `%APPDATA%\weig-qb-webui` no Windows também é removido.

Para manter as cópias e poder usar `-rollback` mais tarde, basta omitir `-purge`.

</details>

## Mais ajuda

Para Docker, NAS, caminhos personalizados, atualizações e instalação manual, consulte [Instalação, atualização e implementação manual](installation-guide/deployment-guide.pt.md).

## Licença

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

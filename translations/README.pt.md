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

**[🌐 Pré-visualização online](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Transferir a versão estável mais recente](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**Idioma**: [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · **Português** · [Русский](README.ru.md)

## Transferência direta

Transfira a versão estável mais recente **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**.

Depois de extrair, **a própria pasta `WeiG-qB-WebUI` é o diretório WebUI que deve ser utilizado no qBittorrent**.

## Instalação para iniciantes

<details>
<summary><b>Primeira instalação? Abrir o guia de 1 minuto</b></summary>

### 1. Extrair o ZIP

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

A pasta **`WeiG-qB-WebUI` completa** é a raiz da WebUI. Não copie apenas `public` ou `private`.

### 2. Mover para uma localização permanente

```text
Windows: D:\WeiG-qB-WebUI
Linux:   /opt/WeiG-qB-WebUI
```

Este é o diretório que deverá indicar no qBittorrent.

### 3. Ativar no qBittorrent

Abra o qBittorrent:

**Ferramentas → Opções... → WebUI**

Estes são os termos atuais da tradução oficial portuguesa do qBittorrent. Depois:

1. Ative **Usar interface web alternativa**.
2. Procure **Localização dos ficheiros:**.
3. Introduza o caminho para a pasta `WeiG-qB-WebUI`.

Exemplo Windows:

```text
D:\WeiG-qB-WebUI
```

Exemplo Linux:

```text
/opt/WeiG-qB-WebUI
```

4. Clique em **OK** para guardar.
5. Atualize a página da WebUI. Se a interface antiga continuar em cache, experimente `Ctrl + F5`.

> **Como confirmar o caminho:** dentro do diretório indicado deve conseguir ver diretamente `public`, `private`, `VERSION` e os restantes ficheiros.

> **Docker:** o qBittorrent é executado dentro de um contentor. Normalmente deve indicar um caminho visível pelo contentor, não o caminho real do anfitrião.

</details>

## Instalação com um comando

O instalador é transferido do ramo estável `main`. **Por predefinição instala a Release estável mais recente do GitHub** e verifica `SHA256SUMS`.

### Linux / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>Mostrar localização do script e diretório de instalação predefinido</b></summary>

```text
./weigg-install.sh
```

Diretório predefinido da WebUI:

```text
~/.local/share/weigg-qb-webui
```

Ao executar como `root`:

```text
/root/.local/share/weigg-qb-webui
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
/root/qbittorrent/config/weigg-qb-webui
```

então **Localização dos ficheiros:** no qBittorrent deve ser:

```text
/config/weigg-qb-webui
```

#### Apenas um contentor qBittorrent

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

O instalador tenta detetar automaticamente o contentor e a montagem `/config`.

#### Listar contentores

```sh
sh weigg-install.sh --list-containers
```

Ou:

```sh
docker ps
```

Selecionar explicitamente um contentor:

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

Se existirem vários contentores qBittorrent, o instalador não escolhe um ao acaso.

#### Indicar a pasta do anfitrião montada como `/config`

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

Synology:

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

Outro NAS:

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

#### Escolher o caminho da WebUI

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>Mostrar diretório de instalação</b></summary>

```text
C:\Users\<nome-do-utilizador>\AppData\Local\WeiG-qB-WebUI
```

</details>

## Opções comuns

<details>
<summary><b>Opções / versão específica / diretório personalizado / restauro</b></summary>

Os nomes dos parâmetros PowerShell não distinguem maiúsculas de minúsculas.

| Utilização | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Release estável mais recente | Predefinição | Predefinição |
| Release específica | `--version 0.3.60` | `-version 0.3.60` |
| Versão de desenvolvimento | `--dev` | `-dev` |
| Diretório de instalação | `-o /path` ou `--output /path` | `-o D:\path` ou `-output D:\path` |
| Configurar o qBittorrent | `--configure` | `-configure` |
| Restaurar a instalação anterior | `--rollback` | `-rollback` |
| Ajuda | `--help` | `-help` |
| Selecionar contentor Docker | `--container=NAME` | — |
| Listar contentores Docker | `--list-containers` | — |
| Caminho do anfitrião montado como `/config` | `--config-root=/path` | — |

- Uma versão inexistente não muda automaticamente para latest ou dev.
- `--dev / -dev` não pode ser combinado com `--version / -version`.

Linux:

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

Restauro:

```sh
sh weigg-install.sh --rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

</details>

## Mais ajuda

Para Docker, NAS, caminhos personalizados, atualizações e instalação manual, consulte [Instalação, atualização e implementação manual](deployment-guide/README.pt.md).

## Licença

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

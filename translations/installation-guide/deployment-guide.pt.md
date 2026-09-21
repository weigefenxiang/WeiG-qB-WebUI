# Guia para iniciantes: instalação e atualização

**Idioma**: [English](deployment-guide.en.md) · [简中](deployment-guide.zh-CN.md) · [繁中](deployment-guide.zh-TW.md) · [日本語](deployment-guide.ja.md) · [한국어](deployment-guide.ko.md) · [Deutsch](deployment-guide.de.md) · [Français](deployment-guide.fr.md) · [Español](deployment-guide.es.md) · **Português** · [Русский](deployment-guide.ru.md)

Este guia detalhado foi escrito para iniciantes. **A maioria dos utilizadores deve instalar a última Release estável.** Use `dev` apenas quando quiser testar deliberadamente a versão de desenvolvimento.

Intervalo suportado: **qBittorrent 4.1.x → 5.2.x**.

> Se só pretende instalar o mais rapidamente possível, avance para **Linux / NAS**, **Docker** ou **Windows PowerShell** e copie o comando principal. As explicações e exemplos adicionais ficam recolhidos por predefinição.

## 1. Instalação com um clique no Linux / NAS

Comando recomendado numa linha:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Ver localização do script, diretório predefinido e mais opções (clique para expandir)</b></summary>

### Diretório predefinido

```text
~/.local/share/weig_qb-webui
```

Exemplo:

```text
/home/alex/.local/share/weig_qb-webui
```

Com `root`:

```text
/root/.local/share/weig_qb-webui
```

O script fica no diretório atual:

```text
./weig_qb-webui_install.sh
```

### Exemplo 1: última Release + configuração automática

```sh
sh weig_qb-webui_install.sh -configure
```

### Exemplo 2: instalar apenas os ficheiros

```sh
sh weig_qb-webui_install.sh
```

Depois configure o qBittorrent manualmente:

**Ferramentas → Opções... → WebUI**

1. Ative **Usar interface web alternativa**.
2. Em **Localização dos ficheiros:** indique o diretório do WeiG qB WebUI.
3. Grave com **OK**.

### Exemplo 3: Release específica

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -configure
```

### Exemplo 4: diretório personalizado

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

Ou:

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

### Exemplo 5: versão + diretório

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -o /opt/weig_qb-webui -configure
```

### Exemplo 6: dev

```sh
sh weig_qb-webui_install.sh -dev -configure
```

### Exemplo 7: atualizar para latest

```sh
sh weig_qb-webui_install.sh -configure
```

Para uma versão específica:

```sh
sh weig_qb-webui_install.sh -version 0.1.1 -configure
```

### Exemplo 8: rollback

```sh
sh weig_qb-webui_install.sh -rollback
```

### Exemplo 9: ajuda

```sh
sh weig_qb-webui_install.sh -help
```

O instalador Linux procura automaticamente ferramentas disponíveis como `curl`, `wget`, BusyBox ou Python 3. Se não existir qualquer forma de validar SHA-256, uma Release não é instalada sem verificação.

</details>

---

---

## 2. Instalação com um clique no Docker

Experimente primeiro o comando normal:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Caminhos Docker, vários contentores e opções avançadas (clique para expandir)</b></summary>



Se existir apenas um contentor qBittorrent em execução com um volume `/config` normal, o instalador tenta detetá-lo automaticamente.

### Caminho do host e caminho do contentor

Exemplo Docker Compose:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Significa:

```text
Host:      /root/qbittorrent/config
Contentor: /config
```

Se a WebUI estiver fisicamente no host em:

```text
/root/qbittorrent/config/weig_qb-webui
```

então **Localização dos ficheiros:** no qBittorrent deve normalmente ser:

```text
/config/weig_qb-webui
```

### Conversão Docker predefinida

Se for detetado:

```text
Container /config -> Host /root/qbittorrent/config
```

e não for usado `-o`:

```text
Host install path: /root/qbittorrent/config/weig_qb-webui
qBittorrent Root Folder: /config/weig_qb-webui
```

### Exemplo 1: um contentor qBittorrent

```sh
sh weig_qb-webui_install.sh -configure
```

### Exemplo 2: listar contentores

```sh
sh weig_qb-webui_install.sh --list-containers
```

Ou:

```sh
docker ps
```

### Exemplo 3: escolher um contentor

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### Exemplo 4: vários contentores qBittorrent

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

Contentor de teste:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

Com vários candidatos, o instalador não escolhe um ao acaso.

### Exemplo 5: conhece o diretório do host montado como `/config`

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

### Exemplo 6: Synology

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

### Exemplo 7: outro NAS

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

Substitua estes exemplos pelo caminho real do host montado como `/config`.

### Exemplo 8: escolher um caminho WebUI visível no contentor

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

Se `/config` corresponder a `/root/qbittorrent/config`:

```text
/config/weig_qb-webui
        ↓
/root/qbittorrent/config/weig_qb-webui
```

### Exemplo 9: Release específica

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -version 1.0.0 -configure
```

### Exemplo 10: dev

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -dev -configure
```

### Exemplo 11: rollback

```sh
sh weig_qb-webui_install.sh -rollback
```

### Erro Docker mais comum

Introduzir no qBittorrent um caminho do host. Dentro do contentor normalmente deve ser usado:

```text
/config/weig_qb-webui
```

</details>

---

---

## 3. Instalação com um clique no Windows

Comando recomendado:

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>Ver diretório predefinido e mais opções do Windows (clique para expandir)</b></summary>

### Diretório predefinido

```text
C:\Users\<utilizador>\AppData\Local\WeiG_qB-WebUI
```

Equivale a:

```text
%LOCALAPPDATA%\WeiG_qB-WebUI
```

### Exemplo 1: latest + configuração automática

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Exemplo 2: apenas os ficheiros

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1
```

Depois abra **Ferramentas → Opções... → WebUI**, ative **Usar interface web alternativa** e indique o diretório de instalação em **Localização dos ficheiros:**.

### Exemplo 3: Release específica

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -configure
```

### Exemplo 4: instalar em D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -o D:\WeiG_qB-WebUI -configure
```

### Exemplo 5: versão + diretório

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -o D:\WeiG_qB-WebUI -configure
```

### Exemplo 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

### Exemplo 7: atualizar

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Exemplo 8: rollback

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

### Exemplo 9: ajuda

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -help
```

Os parâmetros PowerShell não diferenciam maiúsculas de minúsculas. `-ExecutionPolicy Bypass` aplica-se apenas a esse processo PowerShell e não altera permanentemente a política do sistema.

</details>

---

---

## 4. Como atualizar e reverter


Voltar a executar o instalador é o método normal de atualização.

<details>
<summary><b>Ver comandos de atualização e rollback (clique para expandir)</b></summary>

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

Para regressar imediatamente à WebUI integrada do qBittorrent, desative **Usar interface web alternativa**.

</details>

---

## 5. Opções comuns

Linux / Docker / NAS usam `install.sh`; Windows usa `install.ps1`. Os parâmetros PowerShell não diferenciam maiúsculas de minúsculas.

| Finalidade | Linux / Docker / NAS | Windows PowerShell | Nota |
|---|---|---|---|
| Última Release estável | Predefinição | Predefinição | Recomendado |
| Release específica | `-version 1.0.0` | `-version 1.0.0` | Instala apenas essa Release |
| Versão de desenvolvimento | `-dev` | `-dev` | SHA Git exato do `dev` atual |
| Diretório de instalação | `-o /path` / `-o /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| Configurar qBittorrent | `-configure` | `-configure` | Ativa a interface web alternativa e define o caminho |
| Reverter | `-rollback` | `-rollback` | Restaura a instalação e configuração qB anteriores |
| Ajuda | `-help` | `-help` | Mostra a ajuda completa |
| Escolher contentor Docker | `--container=NAME` | — | Para vários contentores qB |
| Listar contentores Docker | `--list-containers` | — | Mostra contentores qB detetados |
| Indicar `/config` do host | `--config-root=/path` | — | Quando conhece a origem do volume |

<details>
<summary><b>Notas: (clique para expandir)</b></summary>

Regras importantes:

- Sem opção de origem, é instalada a última Release estável.
- `-version` instala exatamente a Release pedida. Se não existir, a instalação termina e **não muda automaticamente para latest ou dev**.
- `-dev` e `-version` não podem ser usados em conjunto.
- `-configure` cria uma cópia da configuração do qBittorrent antes de a alterar.
- `-rollback` restaura o estado anterior quando existe uma cópia disponível.

</details>

---

## 6. Instalação manual

Última Release:

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

Transferir:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>Expandir: transferência manual, verificação, extração e configuração</b></summary>

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

Depois de extrair:

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

No qBittorrent abra **Ferramentas → Opções... → WebUI**, ative **Usar interface web alternativa** e defina **Localização dos ficheiros:** para a raiz `WeiG_qB-WebUI`.

</details>

---

## 7. Problemas frequentes

<details>
<summary><b>Expandir: cache, 404, caminhos Docker, vários contentores, checksum</b></summary>

### A página antiga continua a aparecer

Experimente `Ctrl + F5` ou uma janela privada.

### 404 / WebUI não carrega

O diretório configurado em **Localização dos ficheiros:** deve conter diretamente:

```text
public
private
VERSION
GIT_SHA
```

### Docker não encontra os ficheiros

Provavelmente foi usado o caminho do host. O caminho típico do contentor é:

```text
/config/weig_qb-webui
```

### Vários contentores

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### Erro de checksum

Não ignore. Transfira novamente. O instalador termina de propósito se o ZIP e `SHA256SUMS` não corresponderem.

</details>

---

## 8. Como confirmar a versão instalada

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` indica a versão, `GIT_SHA` o commit Git exato e `private/weigg-install.json` regista origem, SHA, caminhos e informação Docker.

---

## 9. Compatibilidade

```text
qBittorrent 4.1.x → 5.2.x
```

O alvo mínimo principal para WebAPI v2 é **qBittorrent 4.1.0**. qBittorrent 4.0.x usa a antiga WebAPI v1 e fica fora do suporte principal atual.

---

## 10. Avançado / manutenção

<details>
<summary><b>Expandir: exact SHA, identidade da Release e opções antigas</b></summary>

Uma instalação `dev` resolve primeiro o `dev` atual para um SHA Git de 40 caracteres, instala exatamente esse commit e escreve-o em `GIT_SHA`.

Uma Release normal fornece:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Linux mantém `--channel=release|dev`, `--dir=/path`, `--update` e Windows mantém `-Channel`, `-Destination`, `-Mode` por compatibilidade. Para instalações novas use as opções atuais no início desta página.

</details>

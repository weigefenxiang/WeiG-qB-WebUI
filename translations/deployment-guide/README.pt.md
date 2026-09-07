# Instalação, atualização e implementação manual

**Idioma**: [English](README.en.md) · [简中](../../docs/007.安装升级与手动部署.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · **Português** · [Русский](README.ru.md)

Este guia detalhado foi escrito para iniciantes. **A maioria dos utilizadores deve instalar a última Release estável.** Use `dev` apenas quando quiser testar deliberadamente a versão de desenvolvimento.

Intervalo suportado: **qBittorrent 4.1.x → 5.2.x**.

> Se só pretende instalar o mais rapidamente possível, avance para **Linux / NAS**, **Docker** ou **Windows PowerShell** e copie o comando principal. As explicações e exemplos adicionais ficam recolhidos por predefinição.

## 1. Opções mais usadas

Linux / Docker / NAS usam `install.sh`; Windows usa `install.ps1`. Os parâmetros PowerShell não diferenciam maiúsculas de minúsculas.

| Finalidade | Linux / Docker / NAS | Windows PowerShell | Nota |
|---|---|---|---|
| Última Release estável | Predefinição | Predefinição | Recomendado |
| Release específica | `--version 0.3.60` | `-version 0.3.60` | Instala apenas essa Release |
| Versão de desenvolvimento | `--dev` | `-dev` | SHA Git exato do `dev` atual |
| Diretório de instalação | `-o /path` / `--output /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| Configurar qBittorrent | `--configure` | `-configure` | Ativa a interface web alternativa e define o caminho |
| Reverter | `--rollback` | `-rollback` | Restaura a instalação e configuração qB anteriores |
| Ajuda | `--help` | `-help` | Mostra a ajuda completa |
| Escolher contentor Docker | `--container=NAME` | — | Para vários contentores qB |
| Listar contentores Docker | `--list-containers` | — | Mostra contentores qB detetados |
| Indicar `/config` do host | `--config-root=/path` | — | Quando conhece a origem do volume |

Regras importantes:

- Sem opção de origem, é instalada a última Release estável.
- `--version / -version` instala exatamente a Release pedida. Se não existir, a instalação termina e **não muda automaticamente para latest ou dev**.
- `--dev / -dev` e `--version / -version` não podem ser usados em conjunto.
- `--configure / -configure` cria uma cópia da configuração do qBittorrent antes de a alterar.
- `--rollback / -rollback` restaura o estado anterior quando existe uma cópia disponível.

## 2. Que origem devo usar?

### Última Release estável — recomendada

O instalador transfere:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

O SHA-256 é verificado antes da instalação. Se a verificação falhar, o processo termina.

### Release específica

Exemplo:

```text
0.3.60
```

Corresponde à tag `v0.3.60`.

### dev

`dev` não é um plano B para falhas de Release. O instalador resolve primeiro o `dev` atual para um **SHA Git exato de 40 caracteres** e transfere apenas esse commit.

---

## 3. Linux / NAS

Comando recomendado numa linha:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>Expandir: caminhos Linux / NAS, opções, atualizações e exemplos</b></summary>

### Diretório predefinido

```text
~/.local/share/weigg-qb-webui
```

Exemplo:

```text
/home/alex/.local/share/weigg-qb-webui
```

Com `root`:

```text
/root/.local/share/weigg-qb-webui
```

O script fica no diretório atual:

```text
./weigg-install.sh
```

### Exemplo 1: última Release + configuração automática

```sh
sh weigg-install.sh --configure
```

### Exemplo 2: instalar apenas os ficheiros

```sh
sh weigg-install.sh
```

Depois configure o qBittorrent manualmente:

**Ferramentas → Opções... → WebUI**

1. Ative **Usar interface web alternativa**.
2. Em **Localização dos ficheiros:** indique o diretório do WeiG qB WebUI.
3. Grave com **OK**.

### Exemplo 3: Release específica

```sh
sh weigg-install.sh --version 0.3.60 --configure
```

### Exemplo 4: diretório personalizado

```sh
sh weigg-install.sh -o /opt/weigg-qb-webui --configure
```

Ou:

```sh
sh weigg-install.sh --output /opt/weigg-qb-webui --configure
```

### Exemplo 5: versão + diretório

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

### Exemplo 6: dev

```sh
sh weigg-install.sh --dev --configure
```

### Exemplo 7: atualizar para latest

```sh
sh weigg-install.sh --configure
```

Para uma versão específica:

```sh
sh weigg-install.sh --version 0.3.61 --configure
```

### Exemplo 8: rollback

```sh
sh weigg-install.sh --rollback
```

### Exemplo 9: ajuda

```sh
sh weigg-install.sh --help
```

O instalador Linux procura automaticamente ferramentas disponíveis como `curl`, `wget`, BusyBox ou Python 3. Se não existir qualquer forma de validar SHA-256, uma Release não é instalada sem verificação.

</details>

---

## 4. Docker

Experimente primeiro o comando normal:

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

Se existir apenas um contentor qBittorrent em execução com um volume `/config` normal, o instalador tenta detetá-lo automaticamente.

<details>
<summary><b>Expandir: conceitos Docker, vários contentores, NAS e exemplos</b></summary>

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
/root/qbittorrent/config/weigg-qb-webui
```

então **Localização dos ficheiros:** no qBittorrent deve normalmente ser:

```text
/config/weigg-qb-webui
```

### Conversão Docker predefinida

Se for detetado:

```text
Container /config -> Host /root/qbittorrent/config
```

e não for usado `-o`:

```text
Host install path: /root/qbittorrent/config/weigg-qb-webui
qBittorrent Root Folder: /config/weigg-qb-webui
```

### Exemplo 1: um contentor qBittorrent

```sh
sh weigg-install.sh --configure
```

### Exemplo 2: listar contentores

```sh
sh weigg-install.sh --list-containers
```

Ou:

```sh
docker ps
```

### Exemplo 3: escolher um contentor

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

### Exemplo 4: vários contentores qBittorrent

```sh
sh weigg-install.sh --list-containers
sh weigg-install.sh --container=qbittorrent --configure
```

Contentor de teste:

```sh
sh weigg-install.sh --container=qbittorrent-test --configure
```

Com vários candidatos, o instalador não escolhe um ao acaso.

### Exemplo 5: conhece o diretório do host montado como `/config`

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

### Exemplo 6: Synology

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

### Exemplo 7: outro NAS

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

Substitua estes exemplos pelo caminho real do host montado como `/config`.

### Exemplo 8: escolher um caminho WebUI visível no contentor

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

Se `/config` corresponder a `/root/qbittorrent/config`:

```text
/config/weigg-qb-webui
        ↓
/root/qbittorrent/config/weigg-qb-webui
```

### Exemplo 9: Release específica

```sh
sh weigg-install.sh --container=qbittorrent --version 0.3.60 --configure
```

### Exemplo 10: dev

```sh
sh weigg-install.sh --container=qbittorrent --dev --configure
```

### Exemplo 11: rollback

```sh
sh weigg-install.sh --rollback
```

### Erro Docker mais comum

Introduzir no qBittorrent um caminho do host. Dentro do contentor normalmente deve ser usado:

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
<summary><b>Expandir: caminhos Windows, opções, atualizações e exemplos</b></summary>

### Diretório predefinido

```text
C:\Users\<utilizador>\AppData\Local\WeiG-qB-WebUI
```

Equivale a:

```text
%LOCALAPPDATA%\WeiG-qB-WebUI
```

### Exemplo 1: latest + configuração automática

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

### Exemplo 2: apenas os ficheiros

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1
```

Depois abra **Ferramentas → Opções... → WebUI**, ative **Usar interface web alternativa** e indique o diretório de instalação em **Localização dos ficheiros:**.

### Exemplo 3: Release específica

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -configure
```

### Exemplo 4: instalar em D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -o D:\WeiG-qB-WebUI -configure
```

### Exemplo 5: versão + diretório

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

### Exemplo 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -dev -configure
```

### Exemplo 7: atualizar

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

### Exemplo 8: rollback

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

### Exemplo 9: ajuda

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -help
```

Os parâmetros PowerShell não diferenciam maiúsculas de minúsculas. `-ExecutionPolicy Bypass` aplica-se apenas a esse processo PowerShell e não altera permanentemente a política do sistema.

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

Depois de extrair:

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

No qBittorrent abra **Ferramentas → Opções... → WebUI**, ative **Usar interface web alternativa** e defina **Localização dos ficheiros:** para a raiz `WeiG-qB-WebUI`.

</details>

## 7. Atualização e rollback

Voltar a executar o instalador é o método normal de atualização.

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

Para regressar imediatamente à WebUI integrada do qBittorrent, desative **Usar interface web alternativa**.

## 8. Resolução de problemas

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
/config/weigg-qb-webui
```

### Vários contentores

```sh
sh weigg-install.sh --list-containers
sh weigg-install.sh --container=qbittorrent --configure
```

### Erro de checksum

Não ignore. Transfira novamente. O instalador termina de propósito se o ZIP e `SHA256SUMS` não corresponderem.

</details>

## 9. Confirmar a versão instalada

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` indica a versão, `GIT_SHA` o commit Git exato e `private/weigg-install.json` regista origem, SHA, caminhos e informação Docker.

## 10. Compatibilidade

```text
qBittorrent 4.1.x → 5.2.x
```

O alvo mínimo principal para WebAPI v2 é **qBittorrent 4.1.0**. qBittorrent 4.0.x usa a antiga WebAPI v1 e fica fora do suporte principal atual.

## 11. Avançado / manutenção

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

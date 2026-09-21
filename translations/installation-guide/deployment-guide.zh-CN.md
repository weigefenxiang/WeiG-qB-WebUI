# 新手安装、升级指南

**语言**：[English](deployment-guide.en.md) · **简中** · [繁中](deployment-guide.zh-TW.md) · [日本語](deployment-guide.ja.md) · [한국어](deployment-guide.ko.md) · [Deutsch](deployment-guide.de.md) · [Français](deployment-guide.fr.md) · [Español](deployment-guide.es.md) · [Português](deployment-guide.pt.md) · [Русский](deployment-guide.ru.md)

这份指南面向第一次安装 WeiG qB WebUI 的用户。**如果只是正常使用，不需要先理解 Release、Git SHA、checksum 等概念，选择自己的运行环境并复制一键安装命令即可。**

支持范围：**qBittorrent 4.1.x → 5.2.x**。

先判断自己的环境：

- **Linux / NAS**：qBittorrent 直接运行在 Linux、VPS 或 NAS 系统中，不是在 Docker 容器里。
- **Docker**：qBittorrent 通过 Docker、Docker Compose、Container Manager 等方式运行。
- **Windows**：qBittorrent 运行在 Windows 桌面系统中。

> 不确定是不是 Docker？如果平时会用 `docker ps`、Docker Compose，或者 NAS 的“容器管理器”运行 qBittorrent，就选 **Docker**；否则通常选 **Linux / NAS**。

---

## 1. Linux / NAS 一键安装

推荐直接复制这一条：

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>查看脚本位置、默认安装目录和更多用法（点击展开）</b></summary>

**脚本地址里的 `/dev/` 只是安装脚本的固定下载入口，不代表安装开发版。** 不加 `-dev` 时，默认安装最新稳定正式版。

安装成功后，脚本会尽量自动启用 qBittorrent 的 **使用备选 WebUI** 并设置正确路径。

### 默认安装目录

```text
~/.local/share/weig_qb-webui
```

例如使用 `root` 用户时通常是：

```text
/root/.local/share/weig_qb-webui
```

安装脚本本身保存在你执行命令时的当前目录：

```text
./weig_qb-webui_install.sh
```

### 只安装文件，不自动配置 qBittorrent

```sh
sh weig_qb-webui_install.sh
```

之后打开 qBittorrent：

**工具 → 选项… → WebUI**

1. 勾选 **使用备选 WebUI**。
2. 在 **文件位置：** 填入 WebUI 安装目录。
3. 点击 **确定**。

### 指定正式版本

```sh
sh weig_qb-webui_install.sh -version 0.1.0 -configure
```

### 指定安装目录

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

### 测试开发版

只有明确想测试当前开发版本时才使用：

```sh
sh weig_qb-webui_install.sh -dev -configure
```

### 查看帮助

```sh
sh weig_qb-webui_install.sh -help
```

正式版安装会校验下载文件。校验失败时安装器会停止，不会继续使用损坏或来源不明的文件。

</details>

---

## 2. Docker 一键安装

如果只有一个 qBittorrent 容器，先直接运行：

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Docker 路径、多容器和高级用法（点击展开）</b></summary>

**脚本地址里的 `/dev/` 只是固定下载入口，不代表安装开发版。** 不加 `-dev` 默认安装最新稳定正式版。

如果机器上只有一个正在运行的 qBittorrent 容器，而且它正常挂载了 `/config`，安装器会尝试自动识别容器、计算 WebUI 路径并配置 qBittorrent。

### Docker 最容易弄错的一点

例如 Docker Compose 中有：

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

这表示：

```text
宿主机：/root/qbittorrent/config
容器内：/config
```

如果 WebUI 实际保存在宿主机：

```text
/root/qbittorrent/config/weig_qb-webui
```

那么 qBittorrent 的 **文件位置：** 应填写：

```text
/config/weig_qb-webui
```

**不要把宿主机完整路径直接填进容器里的 qBittorrent。**

### 列出 qBittorrent 容器

```sh
sh weig_qb-webui_install.sh --list-containers
```

也可以先查看：

```sh
docker ps
```

### 指定容器

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

如果有测试容器：

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

安装器不会在多个 qBittorrent 容器之间随便选择一个。

### 已知道宿主机的 `/config` 目录

例如：

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

Synology 可能类似：

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

其他 NAS 可能类似：

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

请换成自己真正映射到容器 `/config` 的宿主机目录。

### 指定容器内 WebUI 路径

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

如果 `/config` 对应宿主机 `/root/qbittorrent/config`，安装器会自动换算为：

```text
容器：  /config/weig_qb-webui
          ↓
宿主机：/root/qbittorrent/config/weig_qb-webui
```

### 指定正式版本

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -version 0.1.0 -configure
```

### 测试 dev

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -dev -configure
```

### 一次更新多个已有 WebUI 目录

Linux 可以重复使用 `-o`：

```sh
sh weig_qb-webui_install.sh -dev \
  -o /root/qbittorrent/config/weig_qb-webui \
  -o /root/qbittorrent3/config/weig_qb-webui
```

多目标模式不要同时使用 `-configure`、`--container` 或 `--config-root`；每个 qBittorrent 实例继续使用自己原本已经配置好的 WebUI 路径。

</details>

---

## 3. Windows 一键安装

在 PowerShell 中运行：

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>查看默认安装目录和更多 Windows 用法（点击展开）</b></summary>

**下载地址里的 `/dev/` 只是安装脚本的固定入口，不代表安装开发版。** 不加 `-dev` 默认安装最新稳定正式版。

### 默认安装目录

```text
C:\Users\<你的用户名>\AppData\Local\WeiG_qB-WebUI
```

也就是：

```text
%LOCALAPPDATA%\WeiG_qB-WebUI
```

### 只安装文件，不自动配置 qBittorrent

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1
```

之后进入：

**工具 → 选项… → WebUI**

勾选 **使用备选 WebUI**，并在 **文件位置：** 填入安装目录。

### 指定正式版本

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 0.1.0 -configure
```

### 安装到 D 盘

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -o D:\WeiG_qB-WebUI -configure
```

### 测试开发版

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

### 查看帮助

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -help
```

PowerShell 参数不区分大小写，文档统一使用小写。

`-ExecutionPolicy Bypass` 只作用于这一次启动的 PowerShell 进程，不会永久修改整台电脑的执行策略。

</details>

---

## 4. 怎么升级和回滚

**重新执行安装器就是正常升级方式。** 安装器会先准备和验证新版本，再切换 WebUI。

<details>
<summary><b>查看升级和回滚命令（点击展开）</b></summary>

### 升级到最新稳定版

Linux / NAS / Docker：

```sh
sh weig_qb-webui_install.sh -configure
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### 回滚上一次安装

Linux / NAS / Docker：

```sh
sh weig_qb-webui_install.sh -rollback
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

Linux 安装器备份保存在：

```text
~/.config/weig_qb-webui/backups/
```

每个安装目标独立保留最近 3 份安装器备份。

如果只是想临时回到 qBittorrent 原生 WebUI，可以进入：

**工具 → 选项… → WebUI**

取消 **使用备选 WebUI** 即可。

</details>

---

## 5. 常用参数

| 用途 | Linux / Docker / NAS | Windows PowerShell | 说明 |
|---|---|---|---|
| 最新稳定版 | 默认，无需参数 | 默认，无需参数 | 推荐一般用户 |
| 指定正式版本 | `-version 0.1.0` | `-version 0.1.0` | 只安装指定版本 |
| 开发测试版 | `-dev` | `-dev` | 只有测试开发版时使用 |
| 指定安装目录 | `-o /path` | `-o D:\path` 或 `-output D:\path` | `o` = output |
| 自动配置 qBittorrent | `-configure` | `-configure` | 启用备选 WebUI 并设置路径 |
| 回滚 | `-rollback` | `-rollback` | 恢复上一次安装 |
| 查看帮助 | `-help` | `-help` | 显示完整参数 |
| 指定 Docker 容器 | `--container=NAME` | — | 多容器时使用 |
| 列出 Docker 容器 | `--list-containers` | — | 查看检测到的容器 |
| 指定 Docker `/config` 宿主机目录 | `--config-root=/path` | — | 已知道挂载来源时使用 |

<details>
<summary><b>说明：</b> <b>（点击展开）</b></summary>

- 不加 `-dev` 时默认安装最新稳定正式版。
- `-version` 只安装指定版本；指定版本不存在时直接停止，**不会自动退回 latest 或 dev**。
- `-dev` 与 `-version` 不能同时使用。
- `-configure` 会在安装后尝试启用 qBittorrent 的备选 WebUI，并在修改配置前创建备份。
- Linux 的 `-o` 可以重复使用，一次下载和验证后更新多个明确目标；多目标模式不能同时使用 `-configure`、`--container` 或 `--config-root`。
- Docker 专用的 `--container`、`--list-containers`、`--config-root` 保持双横线写法。
- 旧的 Linux 长参数仍保留兼容性，但新安装建议优先使用上表中的单横线参数。

</details>

---

## 6. 手动安装

如果一键安装不适合你的环境，也可以手动下载最新正式版：

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

正式版通常提供：

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Release ZIP 内部的顶层目录名是 `WeiG-qB-WebUI`。手动安装时，解压后建议将本地 WebUI 文件夹重命名为 `WeiG_qB-WebUI`。

<details>
<summary><b>手动下载、校验和设置（点击展开）</b></summary>

### Linux

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -o WeiG-qB-WebUI.zip
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
mv WeiG-qB-WebUI WeiG_qB-WebUI
```

### Windows

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip . -Force
Rename-Item .\WeiG-qB-WebUI WeiG_qB-WebUI
```

手动计算 SHA-256：

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

解压并重命名后，WebUI 根目录中应直接看到：

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

然后打开 qBittorrent：

**工具 → 选项… → WebUI**

启用 **使用备选 WebUI**，把 **文件位置：** 指向 `WeiG_qB-WebUI` 根目录。

</details>

---

## 7. 常见问题

<details>
<summary><b>常见问题（点击展开）</b></summary>

### 为什么安装脚本下载地址里有 `/dev/`？

因为这个地址只是安装脚本的固定发布入口。

**是否安装开发版由参数决定：**

- 不加 `-dev`：安装最新稳定正式版。
- 加 `-dev`：安装当前开发版。

### 安装后还是旧页面

先按 `Ctrl + F5` 强制刷新，也可以用无痕窗口测试。

### 404 / WebUI 无法加载

确认 qBittorrent 的 **文件位置：** 指向的目录中直接包含：

```text
public
private
VERSION
GIT_SHA
```

如果还要再进入一层目录才能看到这些文件，说明路径多填或少填了一层。

### Docker 找不到文件

通常是把宿主机路径填进了容器里的 qBittorrent。

常见正确容器路径是：

```text
/config/weig_qb-webui
```

### 有多个 qBittorrent Docker 容器

先查看：

```sh
sh weig_qb-webui_install.sh --list-containers
```

再明确指定：

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### checksum 校验失败

不要跳过。重新下载后再试。安装器发现 ZIP 与 `SHA256SUMS` 不一致时会安全停止。

</details>

---

## 8. 怎么确认安装的是哪一版

最简单的方法是查看 WebUI 根目录里的：

```text
VERSION
```

需要排查开发版或精确构建身份时，再查看：

```text
GIT_SHA
private/weigg-install.json
```

- `VERSION`：产品版本号。
- `GIT_SHA`：这份 WebUI 对应的精确 Git 提交。
- `private/weigg-install.json`：安装器记录的来源、SHA、安装路径和 Docker 等信息。

普通用户通常只需要确认 `VERSION`。

---

## 9. 兼容范围

```text
qBittorrent 4.1.x → 5.2.x
```

最低主线 WebAPI v2 支持目标为 **qBittorrent 4.1.0**。

qBittorrent 4.0.x 使用旧 WebAPI v1，不在当前主线支持范围内。

---

## 10. 高级说明 / 维护者

<details>
<summary><b>版本来源、exact SHA、校验与旧参数（点击展开）</b></summary>

### 稳定正式版

不加 `-dev` 时，安装器使用经过校验的最新 GitHub Release。

指定：

```text
-version 0.1.0
```

时，只安装对应的 `v0.1.0` Release；如果指定版本不存在，会直接停止，不会自动换成其他来源。

### 开发版

使用 `-dev` 时，安装器会先解析当前 `dev` 的 40 位 Git SHA，再安装与该提交对应的精确构建。

`dev` 不是正式版下载失败时的备用来源。

### 正式版校验文件

正式 Release 应提供：

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

安装器会验证下载内容，校验失败时停止安装。

### Linux 旧参数兼容

旧长参数仍兼容，例如：

```text
--dev
--version
--output
--configure
--rollback
--help
--channel=release|dev
--dir=/path
--update
```

新安装建议优先使用本文中的：

```text
-dev
-version
-o
-configure
-rollback
-help
```

Windows 仍兼容 `-Channel`、`-Destination`、`-Mode` 等历史参数。

</details>

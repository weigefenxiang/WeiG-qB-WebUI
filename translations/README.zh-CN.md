# WeiG qB WebUI

一套现代、响应式的 qBittorrent Alternate WebUI，专为桌面端和手机端优化。

**📱 手机自适应 · 🖥️ 桌面响应式 · 🌙 暗夜模式 · ✅ 支持 qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 在线预览](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ 下载最新正式版](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**语言**：[English](../README.md) · **简中** · [繁中](README.zh-TW.md) · 日本語 · 한국어 · Deutsch · Français · Español · Português · Русский

## 直接下载

下载最新正式版 **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**。

解压后，**`WeiG-qB-WebUI` 文件夹就是 qBittorrent 要使用的 WebUI 目录**。

## 新手安装

<details>
<summary><b>第一次安装？点击展开 1 分钟教程</b></summary>

### 1. 解压

下载并解压 `WeiG-qB-WebUI.zip`，得到：

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

整个 **`WeiG-qB-WebUI` 文件夹**就是 WebUI 根目录，不要只复制 `public` 或 `private`。

### 2. 放到一个固定位置

把整个 `WeiG-qB-WebUI` 文件夹移动到一个以后不会随便删除的位置，例如：

```text
Windows：D:\WeiG-qB-WebUI
Linux：  /opt/WeiG-qB-WebUI
```

后面 qBittorrent 要填写的就是这个目录。

### 3. 在 qBittorrent 中启用

打开 qBittorrent：

**工具 → 选项... → WebUI**

这是 qBittorrent 当前简体中文官方用语。然后：

1. 勾选 **使用备选 WebUI**。
2. 找到 **文件位置：**。
3. 填入刚才保存的 `WeiG-qB-WebUI` 文件夹路径。

Windows 示例：

```text
D:\WeiG-qB-WebUI
```

普通 Linux 示例：

```text
/opt/WeiG-qB-WebUI
```

4. 点击 **确定** 保存设置。
5. 刷新 qBittorrent WebUI 页面。如果浏览器仍显示旧页面，可再按一次 `Ctrl + F5` 强制刷新。

> **怎么判断路径填对了？** 你填写的目录里面应该能直接看到 `public`、`private`、`VERSION` 等文件/目录。如果还要再进入一层 `WeiG-qB-WebUI` 才能看到这些内容，说明路径多填或少填了一层。

> **Docker 用户注意：** qBittorrent 运行在容器里面，因此这里通常不能填写宿主机上的真实路径。Docker 的“宿主机 / 容器”区别和正确路径写法见下面 **Docker** 折叠教程。

</details>

## 一键安装

一键脚本来自稳定 `main` 分支，**默认安装最新正式 Release**，并校验 `SHA256SUMS`。安装脚本会保存在当前目录，方便以后更新或回滚。

### Linux / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>查看脚本位置和 WebUI 默认安装目录</b></summary>

```text
./weigg-install.sh
```

WebUI 本体默认安装到：

```text
~/.local/share/weigg-qb-webui
```

例如使用 `root` 用户运行时，通常就是：

```text
/root/.local/share/weigg-qb-webui
```

</details>

### Docker

<details>
<summary><b>Docker 一键安装 / 多容器 / 路径说明（新手建议展开）</b></summary>

#### 先理解“宿主机”和“容器”

如果你是在 VPS、Linux 服务器、群晖、威联通等设备上运行 Docker：

- **宿主机**：真正运行 Docker 的那台 Linux / NAS，也就是你 SSH 登录进去后看到的系统。
- **容器**：Docker 给 qBittorrent 单独创建的运行环境。qBittorrent 只能直接看到容器里的路径。

例如 Docker 创建 qBittorrent 时有这样的目录映射：

```text
宿主机：/root/qbittorrent/config
   ↓ 映射到
容器内：/config
```

Docker Compose 中常见写法类似：

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

冒号左边 `/root/qbittorrent/config` 是**宿主机路径**，右边 `/config` 是**容器内路径**。

如果 WeiG qB WebUI 实际安装到了：

```text
宿主机：/root/qbittorrent/config/weigg-qb-webui
```

那么 qBittorrent 的 **文件位置：** 应填写：

```text
/config/weigg-qb-webui
```

**不要填写 `/root/qbittorrent/config/weigg-qb-webui`**，因为 qBittorrent 容器通常看不到这个宿主机路径。

#### 情况 1：只有一个 qBittorrent Docker 容器

最简单，直接运行：

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

安装器会尝试自动找到正在运行的 qBittorrent 容器、识别它的 `/config` 映射，把 WebUI 安装到合适的位置，并自动设置 qBittorrent。

#### 情况 2：先看看机器上有哪些 qBittorrent 容器

如果不确定容器叫什么：

```sh
sh weigg-install.sh --list-containers
```

也可以先用 Docker 自己的命令查看正在运行的容器：

```sh
docker ps
```

例如你看到 qBittorrent 容器名是：

```text
qbittorrent
```

就可以明确指定它：

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

#### 情况 3：机器上有多个 qBittorrent 容器

例如同时有：

```text
qbittorrent
qbittorrent-test
```

先运行：

```sh
sh weigg-install.sh --list-containers
```

安装正式使用的 `qbittorrent`：

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

安装测试容器 `qbittorrent-test`：

```sh
sh weigg-install.sh --container=qbittorrent-test --configure
```

安装器不会在多个 qBittorrent 容器之间随便猜一个。

#### 情况 4：你知道 qBittorrent 的宿主机 `/config` 目录

例如你的 Docker 配置目录是：

```text
/root/qbittorrent/config
```

可以直接指定：

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

群晖上可能类似：

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

其他 NAS 可能类似：

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

这些只是示例，**请换成你自己的真实 qBittorrent `/config` 宿主机目录**。

#### 情况 5：指定 WebUI 安装目录

已经指定容器时，也可以指定容器里希望使用的 WebUI 路径：

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

安装器会根据 Docker `/config` 映射换算成宿主机上的实际安装目录。

#### 安装后应该看到什么

安装成功时脚本会输出类似：

```text
Host install path: /root/qbittorrent/config/weigg-qb-webui
qBittorrent Root Folder: /config/weigg-qb-webui
```

含义是：

- `Host install path`：文件真正保存到宿主机哪里；
- `qBittorrent Root Folder`：**你在 qBittorrent 的“文件位置：”中应该填写的容器内路径**。

如果用了 `--configure` 并成功找到 qBittorrent 配置，安装器会自动启用 **使用备选 WebUI** 并设置路径；否则按照上面的“新手安装 → 在 qBittorrent 中启用”手动填写即可。

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>查看安装目录</b></summary>

```text
C:\Users\<你的用户名>\AppData\Local\WeiG-qB-WebUI
```

</details>

## 常用参数

<details>
<summary><b>参数说明 / 指定版本 / 自定义目录 / 回滚（点击展开）</b></summary>

Linux 和 Windows 使用相同的参数名称，文档统一使用小写；PowerShell 参数本身不区分大小写。

| 用途 | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| 最新稳定版 | 默认，无需参数 | 默认，无需参数 |
| 指定正式版本 | `--version 0.3.60` | `-version 0.3.60` |
| 开发版 | `--dev` | `-dev` |
| 指定安装目录 | `-o /path` 或 `--output /path` | `-o D:\path` 或 `-output D:\path` |
| 自动配置 qBittorrent | `--configure` | `-configure` |
| 回滚上一次安装 | `--rollback` | `-rollback` |
| 查看完整帮助 | `--help` | `-help` |
| 指定 Docker 容器 | `--container=NAME` | — |
| 列出 Docker 容器 | `--list-containers` | — |
| 指定 Docker `/config` 宿主机目录 | `--config-root=/path` | — |

说明：

- `-o` 中的 `o` 表示 **output**，用于指定 WeiG qB WebUI 的安装目录。
- `--configure / -configure` 会在安装后自动启用 qBittorrent 的 **使用备选 WebUI / Use alternative WebUI**，并设置 **文件位置 / Files location**；修改前会备份 qBittorrent 配置。
- `--rollback / -rollback` 会恢复上一次安装及对应的 qBittorrent 配置；默认会记住上一次安装目录。
- `--version / -version` 安装指定 GitHub Release，例如 `0.3.60`；指定版本不存在时直接报错，**不会自动退回 latest 或 dev**。
- `--dev / -dev` 只用于测试当前开发版 exact Git SHA，不能和 `--version / -version` 同时使用。
- Docker 有多个 qBittorrent 容器时，用 `--list-containers` 查看，再用 `--container=NAME` 明确指定；也可以用 `--config-root=/path` 直接指定宿主机上的 qBittorrent 配置目录。

### 指定版本和安装目录

Linux：

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

### 回滚

Linux：

```sh
sh weigg-install.sh --rollback
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

</details>

## 更多帮助

Docker 多容器、NAS、自定义路径及高级部署说明见：[安装、升级与手动部署](../docs/007.安装升级与手动部署.md)。

## 许可证

本项目使用 [GNU General Public License v3](../LICENSE)。

Copyright © 2026 Wei.G / WeiG Share。

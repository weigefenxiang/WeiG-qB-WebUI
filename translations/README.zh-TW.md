# WeiG qB WebUI

一套現代、響應式的 qBittorrent Alternate WebUI，專為桌面端與手機端最佳化。

**📱 手機自適應 · 🌙 暗夜模式 · ✅ 支援 qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 線上預覽](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ 下載最新正式版](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**語言**：[English](../README.md) · [簡中](README.zh-CN.md) · **繁中** · 日本語 · 한국어 · Deutsch · Français · Español · Português · Русский

## 直接下載

下載最新正式版 **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**。

解壓縮後，**`WeiG-qB-WebUI` 資料夾本身就是 qBittorrent 要使用的 WebUI 目錄**。

## 新手安裝

<details>
<summary><b>第一次安裝？點擊展開 1 分鐘教學</b></summary>

### 1. 解壓縮

下載並解壓縮 `WeiG-qB-WebUI.zip`，會得到：

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

整個 **`WeiG-qB-WebUI` 資料夾**就是 WebUI 根目錄，不要只複製 `public` 或 `private`。

### 2. 放到固定位置

把整個 `WeiG-qB-WebUI` 資料夾移到之後不會隨便刪除的位置，例如：

```text
Windows：D:\WeiG-qB-WebUI
Linux：  /opt/WeiG-qB-WebUI
```

之後 qBittorrent 要填寫的就是這個目錄。

### 3. 在 qBittorrent 中啟用

開啟 qBittorrent：

**工具 → 選項… → WebUI**

這是 qBittorrent 目前繁體中文官方用語。接著：

1. 勾選 **使用替補 WebUI**。
2. 找到 **檔案位置：**。
3. 填入剛才儲存的 `WeiG-qB-WebUI` 資料夾路徑。

Windows 範例：

```text
D:\WeiG-qB-WebUI
```

一般 Linux 範例：

```text
/opt/WeiG-qB-WebUI
```

4. 按一下 **確定** 儲存設定。
5. 重新整理 qBittorrent WebUI 頁面。如果瀏覽器仍顯示舊頁面，可再按一次 `Ctrl + F5` 強制重新整理。

> **怎麼判斷路徑填對了？** 你填寫的目錄裡應該能直接看到 `public`、`private`、`VERSION` 等檔案/目錄。如果還要再進入一層 `WeiG-qB-WebUI` 才能看到這些內容，表示路徑多填或少填了一層。

> **Docker 使用者注意：** qBittorrent 執行在容器裡，因此這裡通常不能直接填宿主機上的真實路徑。Docker 的「宿主機 / 容器」差異與正確路徑寫法請看下面 **Docker** 折疊教學。

</details>

## 一鍵安裝

一鍵腳本來自穩定 `main` 分支，**預設安裝最新正式 Release**，並驗證 `SHA256SUMS`。安裝腳本會保存在目前目錄，方便之後更新或回滾。

### Linux / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>查看腳本位置與 WebUI 預設安裝目錄</b></summary>

```text
./weigg-install.sh
```

WebUI 本體預設安裝到：

```text
~/.local/share/weigg-qb-webui
```

例如使用 `root` 使用者執行時，通常就是：

```text
/root/.local/share/weigg-qb-webui
```

</details>

### Docker

<details>
<summary><b>Docker 一鍵安裝 / 多容器 / 路徑說明（新手建議展開）</b></summary>

#### 先理解「宿主機」和「容器」

如果你是在 VPS、Linux 伺服器、Synology、QNAP 等裝置上執行 Docker：

- **宿主機**：真正執行 Docker 的那台 Linux / NAS，也就是你 SSH 登入後看到的系統。
- **容器**：Docker 為 qBittorrent 建立的獨立執行環境。qBittorrent 可以直接看到容器內路徑，但不能任意看到宿主機路徑。

例如 Docker 建立 qBittorrent 時有這樣的目錄映射：

```text
宿主機：/root/qbittorrent/config
   ↓ 映射到
容器內：/config
```

Docker Compose 常見寫法類似：

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

冒號左邊 `/root/qbittorrent/config` 是**宿主機路徑**，右邊 `/config` 是**容器內路徑**。

如果 WeiG qB WebUI 實際安裝到了：

```text
宿主機：/root/qbittorrent/config/weigg-qb-webui
```

那麼 qBittorrent 的 **檔案位置：** 應填寫：

```text
/config/weigg-qb-webui
```

**不要填 `/root/qbittorrent/config/weigg-qb-webui`**，因為 qBittorrent 容器通常看不到這個宿主機路徑。

#### 情況 1：只有一個正在執行的 qBittorrent Docker 容器

最簡單，直接執行：

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

安裝器會嘗試自動找到正在執行的 qBittorrent 容器、辨識它的 `/config` 映射，把 WebUI 安裝到對應的宿主機位置，並自動設定 qBittorrent。

#### 情況 2：先查看機器上有哪些 qBittorrent 容器

如果不確定容器叫什麼：

```sh
sh weigg-install.sh --list-containers
```

也可以直接用 Docker 查看目前執行中的容器：

```sh
docker ps
```

例如你看到 qBittorrent 容器名稱是：

```text
qbittorrent
```

就可以明確指定：

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

#### 情況 3：機器上有多個 qBittorrent 容器

例如同時有：

```text
qbittorrent
qbittorrent-test
```

先執行：

```sh
sh weigg-install.sh --list-containers
```

安裝正式使用的 `qbittorrent`：

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

安裝測試容器 `qbittorrent-test`：

```sh
sh weigg-install.sh --container=qbittorrent-test --configure
```

安裝器不會在多個 qBittorrent 容器之間隨便猜一個。

#### 情況 4：你知道 qBittorrent `/config` 對應的宿主機目錄

例如 Docker 設定目錄是：

```text
/root/qbittorrent/config
```

可以直接指定：

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

Synology 上可能類似：

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

其他 NAS 可能類似：

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

這些只是範例，**請換成你自己的 qBittorrent `/config` 真實宿主機目錄**。

#### 情況 5：指定 WebUI 安裝目錄

已經指定容器時，也可以指定容器內希望使用的 WebUI 路徑：

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

安裝器會依照 Docker `/config` 映射換算成宿主機上的實際安裝目錄。

#### 安裝後應該看到什麼

安裝成功時腳本會輸出類似：

```text
Host install path: /root/qbittorrent/config/weigg-qb-webui
qBittorrent Root Folder: /config/weigg-qb-webui
```

意思是：

- `Host install path`：檔案實際儲存在宿主機哪裡；
- `qBittorrent Root Folder`：**你在 qBittorrent「檔案位置：」中應填寫的容器內路徑**。

如果使用 `--configure` 並成功找到 qBittorrent 設定，安裝器會自動啟用 **使用替補 WebUI** 並設定路徑；否則請依照上面的「新手安裝 → 在 qBittorrent 中啟用」手動填寫。

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>查看安裝目錄</b></summary>

```text
C:\Users\<你的使用者名稱>\AppData\Local\WeiG-qB-WebUI
```

</details>

## 常用參數

<details>
<summary><b>參數說明 / 指定版本 / 自訂目錄 / 回滾（點擊展開）</b></summary>

Linux 與 Windows 盡量使用相同的公開參數名稱；文件統一使用小寫。PowerShell 參數名稱本身不區分大小寫。

| 用途 | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| 最新穩定版 | 預設，不需參數 | 預設，不需參數 |
| 指定正式版本 | `--version 0.3.60` | `-version 0.3.60` |
| 開發版 | `--dev` | `-dev` |
| 指定安裝目錄 | `-o /path` 或 `--output /path` | `-o D:\path` 或 `-output D:\path` |
| 自動設定 qBittorrent | `--configure` | `-configure` |
| 回滾上一次安裝 | `--rollback` | `-rollback` |
| 查看完整說明 | `--help` | `-help` |
| 指定 Docker 容器 | `--container=NAME` | — |
| 列出 Docker 容器 | `--list-containers` | — |
| 指定 Docker `/config` 宿主機目錄 | `--config-root=/path` | — |

說明：

- `-o` 中的 `o` 表示 **output**，用來指定 WeiG qB WebUI 的安裝目錄。
- `--configure / -configure` 會在安裝後自動啟用 qBittorrent 的 **使用替補 WebUI / Use alternative WebUI**，並設定 **檔案位置 / Files location**；修改前會先備份 qBittorrent 設定。
- `--rollback / -rollback` 會還原上一次安裝與對應的 qBittorrent 設定；預設會記住上一次安裝目錄。
- `--version / -version` 安裝指定 GitHub Release，例如 `0.3.60`；指定版本不存在時直接報錯，**不會自動退回 latest 或 dev**。
- `--dev / -dev` 只用於測試目前開發版的 exact Git SHA，不能和 `--version / -version` 同時使用。
- Docker 有多個 qBittorrent 容器時，用 `--list-containers` 查看，再用 `--container=NAME` 明確指定；也可以用 `--config-root=/path` 直接指定宿主機上的 qBittorrent 設定目錄。

### 指定版本與安裝目錄

Linux：

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

### 回滾

Linux：

```sh
sh weigg-install.sh --rollback
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

</details>

## 更多說明

Docker 多容器、NAS、自訂路徑、更新及進階部署說明請參閱中英雙語的：[安裝、升級與手動部署](../docs/007.安装升级与手动部署.md)。

## 授權條款

本專案使用 [GNU General Public License v3](../LICENSE)。

Copyright © 2026 Wei.G / WeiG Share。

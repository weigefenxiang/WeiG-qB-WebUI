# 安裝、升級與手動部署

**語言**：[English](README.en.md) · [簡中](../../docs/007.安装升级与手动部署.md) · **繁中** · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

這是一份給新手看的完整安裝說明。**一般使用者建議優先安裝最新正式 Release**；只有你明確想測試開發版時才使用 `dev`。

支援範圍：**qBittorrent 4.1.x → 5.2.x**。

> 如果只想最快安裝，直接跳到 **Linux / NAS、Docker 或 Windows PowerShell**，複製主命令即可。後面的路徑說明、參數與案例預設收合，需要時再展開。

## 1. 先看懂常用參數

Linux / Docker / NAS 使用 `install.sh`，Windows 使用 `install.ps1`。PowerShell 參數不區分大小寫，文件統一使用小寫。

| 用途 | Linux / Docker / NAS | Windows PowerShell | 說明 |
|---|---|---|---|
| 最新正式版 | 預設，不需參數 | 預設，不需參數 | 推薦一般使用者 |
| 指定正式版本 | `--version 0.3.60` | `-version 0.3.60` | 只安裝指定 Release |
| 開發版 | `--dev` | `-dev` | 目前 `dev` 的 exact Git SHA |
| 指定安裝目錄 | `-o /path` 或 `--output /path` | `-o D:\path` 或 `-output D:\path` | `o` = output |
| 自動設定 qBittorrent | `--configure` | `-configure` | 啟用替補 WebUI 並設定路徑 |
| 回滾 | `--rollback` | `-rollback` | 還原上一次安裝與 qB 設定 |
| 說明 | `--help` | `-help` | 顯示完整參數 |
| 指定 Docker 容器 | `--container=NAME` | — | 多個 qB 容器時使用 |
| 列出 Docker 容器 | `--list-containers` | — | 查看偵測到的 qB 容器 |
| 指定宿主機 `/config` 目錄 | `--config-root=/path` | — | 已知道掛載來源時使用 |

重要規則：

- 不加來源參數時，預設安裝最新正式 Release。
- `--version / -version` 只安裝指定版本；版本不存在時直接停止，**不會退回 latest 或 dev**。
- `--dev / -dev` 與 `--version / -version` 不能同時使用。
- `--configure / -configure` 修改 qBittorrent 前會先備份設定。
- `--rollback / -rollback` 會盡量還原上一份 WebUI 與對應 qBittorrent 設定。
- 舊參數仍保留相容性，但新部署建議使用上表的新參數。

## 2. 要選哪一種來源？

### 最新正式 Release — 推薦

安裝器會下載：

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

並先驗證 SHA-256。校驗失敗會停止安裝。

### 指定正式版本

例如固定安裝：

```text
0.3.60
```

安裝器會對應到 Release tag `v0.3.60`。

### dev

`dev` 不是 Release 下載失敗時的備援。安裝器會先解析 `dev` 分支目前的 **40 位 exact Git SHA**，再下載那個精確提交。

---

## 3. Linux / NAS

最常用的一鍵安裝：

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>展開：Linux / NAS 路徑、參數、升級與案例</b></summary>

### 預設安裝目錄

一般使用者：

```text
~/.local/share/weigg-qb-webui
```

例如：

```text
/home/alex/.local/share/weigg-qb-webui
```

使用 `root` 時通常是：

```text
/root/.local/share/weigg-qb-webui
```

安裝腳本本身保留在目前目錄：

```text
./weigg-install.sh
```

### 案例 1：最新正式版 + 自動設定

```sh
sh weigg-install.sh --configure
```

### 案例 2：只安裝檔案

```sh
sh weigg-install.sh
```

之後手動開啟 qBittorrent：

**工具 → 選項… → WebUI**

1. 勾選 **使用替補 WebUI**。
2. 在 **檔案位置：** 填入 WeiG qB WebUI 目錄。
3. 按 **確定**。

### 案例 3：指定版本

```sh
sh weigg-install.sh --version 0.3.60 --configure
```

### 案例 4：指定安裝目錄

```sh
sh weigg-install.sh -o /opt/weigg-qb-webui --configure
```

或：

```sh
sh weigg-install.sh --output /opt/weigg-qb-webui --configure
```

### 案例 5：版本 + 目錄

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

### 案例 6：測試 dev

```sh
sh weigg-install.sh --dev --configure
```

### 案例 7：升級 latest

```sh
sh weigg-install.sh --configure
```

升級到指定版本：

```sh
sh weigg-install.sh --version 0.3.61 --configure
```

### 案例 8：回滾

```sh
sh weigg-install.sh --rollback
```

### 案例 9：查看說明

```sh
sh weigg-install.sh --help
```

Linux 安裝器會依序尋找可用的下載、解壓與 SHA-256 工具。若找不到任何可用的 SHA-256 工具，正式 Release 會拒絕在未驗證狀態下安裝。

</details>

---

## 4. Docker

先試最簡單的一鍵命令：

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

如果只有一個正在執行的 qBittorrent 容器，而且有正常 `/config` 掛載，安裝器會嘗試自動辨識。

<details>
<summary><b>展開：Docker 新手說明、多容器、NAS 路徑與完整案例</b></summary>

### 宿主機路徑與容器路徑

例如 Docker Compose：

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

代表：

```text
宿主機：/root/qbittorrent/config
容器內：/config
```

如果 WebUI 實際儲存在宿主機：

```text
/root/qbittorrent/config/weigg-qb-webui
```

qBittorrent 的 **檔案位置：** 通常要填：

```text
/config/weigg-qb-webui
```

而不是宿主機完整路徑。

### Docker 預設換算

當安裝器偵測到：

```text
Container /config -> Host /root/qbittorrent/config
```

且沒有指定 `-o`，會使用：

```text
Host install path: /root/qbittorrent/config/weigg-qb-webui
qBittorrent Root Folder: /config/weigg-qb-webui
```

### 案例 1：只有一個 qBittorrent 容器

```sh
sh weigg-install.sh --configure
```

### 案例 2：列出容器

```sh
sh weigg-install.sh --list-containers
```

也可查看：

```sh
docker ps
```

### 案例 3：指定容器

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

### 案例 4：多個 qBittorrent 容器

先列出：

```sh
sh weigg-install.sh --list-containers
```

再指定：

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

或測試容器：

```sh
sh weigg-install.sh --container=qbittorrent-test --configure
```

安裝器不會在多個 qBittorrent 容器之間隨便猜。

### 案例 5：已知道宿主機 `/config` 目錄

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

### 案例 6：Synology

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

### 案例 7：其他 NAS

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

請改成自己真正掛載到容器 `/config` 的宿主機路徑。

### 案例 8：指定容器可見的 WebUI 路徑

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

若 `/config` 對應 `/root/qbittorrent/config`，安裝器會換算為：

```text
/config/weigg-qb-webui
        ↓
/root/qbittorrent/config/weigg-qb-webui
```

### 案例 9：指定正式版本

```sh
sh weigg-install.sh --container=qbittorrent --version 0.3.60 --configure
```

### 案例 10：dev

```sh
sh weigg-install.sh --container=qbittorrent --dev --configure
```

### 案例 11：回滾

```sh
sh weigg-install.sh --rollback
```

### 最常見錯誤

把宿主機路徑填到 qBittorrent 裡。容器裡的 qBittorrent 通常應使用：

```text
/config/weigg-qb-webui
```

如果容器沒有可用 `/config` 掛載，請先檢查 Docker Compose 或 `docker run` 的 volume 設定。

</details>

---

## 5. Windows PowerShell

最常用的一鍵安裝：

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>展開：Windows 路徑、參數、升級與案例</b></summary>

### 預設安裝目錄

```text
C:\Users\<你的使用者名稱>\AppData\Local\WeiG-qB-WebUI
```

對應：

```text
%LOCALAPPDATA%\WeiG-qB-WebUI
```

### 案例 1：latest + 自動設定

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

### 案例 2：只安裝檔案

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1
```

之後進入：

**工具 → 選項… → WebUI**

勾選 **使用替補 WebUI**，並在 **檔案位置：** 填入安裝目錄。

### 案例 3：指定版本

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -configure
```

### 案例 4：安裝到 D 槽

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -o D:\WeiG-qB-WebUI -configure
```

### 案例 5：版本 + 目錄

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

### 案例 6：dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -dev -configure
```

### 案例 7：升級

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

### 案例 8：回滾

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

### 案例 9：說明

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -help
```

PowerShell 參數大小寫不敏感。`-ExecutionPolicy Bypass` 只套用於這次啟動的 PowerShell 程序，不是永久修改整台系統的執行原則。

</details>

---

## 6. 手動安裝

最新 Release：

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

下載：

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>展開：手動下載、校驗、解壓縮與 qBittorrent 設定</b></summary>

Linux：

```sh
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -o WeiG-qB-WebUI.zip
curl -fL https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/SHA256SUMS -o SHA256SUMS
sha256sum -c SHA256SUMS
unzip WeiG-qB-WebUI.zip
```

Windows：

```powershell
Invoke-WebRequest https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip -OutFile .\WeiG-qB-WebUI.zip
Expand-Archive .\WeiG-qB-WebUI.zip .\WeiG-qB-WebUI -Force
```

手動計算 SHA-256：

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

解壓後應看到：

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

手動設定 qBittorrent：

**工具 → 選項… → WebUI**

啟用 **使用替補 WebUI**，把 **檔案位置：** 指向 `WeiG-qB-WebUI` 根目錄。

</details>

---

## 7. 升級與回滾

重新執行安裝器就是正常升級方式。

Linux：

```sh
sh weigg-install.sh --configure
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

回滾：

```sh
sh weigg-install.sh --rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

如果只想立刻回到 qBittorrent 原生 WebUI，進入 **工具 → 選項… → WebUI**，取消 **使用替補 WebUI** 即可。

---

## 8. 常見問題

<details>
<summary><b>展開：快取、404、Docker 路徑、多容器、checksum</b></summary>

### 還是舊頁面

先試 `Ctrl + F5`，也可用無痕視窗測試。

### 404 / WebUI 無法載入

確認 **檔案位置：** 指向的目錄直接包含：

```text
public
private
VERSION
GIT_SHA
```

### Docker 找不到檔案

通常是把宿主機路徑填進 qBittorrent。常見正確容器路徑是：

```text
/config/weigg-qb-webui
```

### 多個 qBittorrent 容器

```sh
sh weigg-install.sh --list-containers
sh weigg-install.sh --container=qbittorrent --configure
```

### checksum 失敗

不要略過。重新下載後再試。安裝器會在 ZIP 與 `SHA256SUMS` 不一致時安全停止。

</details>

---

## 9. 確認安裝的是哪一版

查看：

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` 是版本號，`GIT_SHA` 是 exact Git commit，`private/weigg-install.json` 記錄來源、SHA、安裝路徑與 Docker 等部署資訊。

## 10. 相容範圍

```text
qBittorrent 4.1.x → 5.2.x
```

最低主線 WebAPI v2 目標為 **qBittorrent 4.1.0**。qBittorrent 4.0.x 使用舊 WebAPI v1，不在目前主線支援聲明內。

## 11. 進階 / 維護者

<details>
<summary><b>展開：exact SHA、Release 身分與舊參數</b></summary>

`dev` 會先解析目前 `dev` 的 40 位 Git SHA，再部署精確提交並寫入 `GIT_SHA`。

正式 Release 應提供：

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Linux 舊參數仍相容：`--channel=release|dev`、`--dir=/path`、`--update`。Windows 仍相容 `-Channel`、`-Destination`、`-Mode`。新部署請優先使用本文最上方的新參數。

</details>

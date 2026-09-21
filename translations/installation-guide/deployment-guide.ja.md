# 初心者向けインストール・アップグレードガイド

**言語**: [English](deployment-guide.en.md) · [简中](deployment-guide.zh-CN.md) · [繁中](deployment-guide.zh-TW.md) · **日本語** · [한국어](deployment-guide.ko.md) · [Deutsch](deployment-guide.de.md) · [Français](deployment-guide.fr.md) · [Español](deployment-guide.es.md) · [Português](deployment-guide.pt.md) · [Русский](deployment-guide.ru.md)

このページは初心者向けの詳しい導入ガイドです。**通常は最新の安定版 Release を使用してください**。`dev` は開発版を意図的に試す場合だけ使用します。

対応範囲: **qBittorrent 4.1.x → 5.2.x**。

> 最短で導入したい場合は、下の **Linux / NAS、Docker、Windows PowerShell** の該当項目へ進み、メインコマンドをコピーしてください。詳しい説明と例は初期状態では折りたたまれています。

## 1. Linux / NAS ワンクリックインストール

推奨ワンライナー:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>スクリプトの場所、既定のインストール先、その他の使い方（クリックして展開）</b></summary>

### 既定のインストール先

```text
~/.local/share/weig_qb-webui
```

例:

```text
/home/alex/.local/share/weig_qb-webui
```

`root` の場合:

```text
/root/.local/share/weig_qb-webui
```

スクリプトは現在のディレクトリに残ります。

```text
./weig_qb-webui_install.sh
```

### 例 1: 最新 Release + 自動設定

```sh
sh weig_qb-webui_install.sh -configure
```

### 例 2: ファイルのみインストール

```sh
sh weig_qb-webui_install.sh
```

その後 qBittorrent を手動設定します。

**ツール → オプション... → WebUI**

1. **別のWebUIを使用する** を有効化します。
2. **ファイルの場所:** に WeiG qB WebUI のディレクトリを指定します。
3. **OK** で保存します。

### 例 3: 特定バージョン

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -configure
```

### 例 4: `/opt/weig_qb-webui` にインストール

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

または:

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

### 例 5: バージョン + パス

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -o /opt/weig_qb-webui -configure
```

### 例 6: dev

```sh
sh weig_qb-webui_install.sh -dev -configure
```

### 例 7: 最新版へ更新

```sh
sh weig_qb-webui_install.sh -configure
```

固定バージョンへ移動:

```sh
sh weig_qb-webui_install.sh -version 0.1.1 -configure
```

### 例 8: ロールバック

```sh
sh weig_qb-webui_install.sh -rollback
```

### 例 9: ヘルプ

```sh
sh weig_qb-webui_install.sh -help
```

Linux インストーラーは `curl` / `wget` / BusyBox / Python 3 などを自動検出します。Release の SHA-256 検証手段が一つもない場合、未検証のまま続行せず安全に停止します。

</details>

---

---

## 2. Docker ワンクリックインストール

まず通常のワンライナーを試してください。

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Docker のパス、複数コンテナー、高度な使い方（クリックして展開）</b></summary>



実行中の qBittorrent コンテナが 1 つで、通常の `/config` マウントがあれば自動検出を試みます。

### ホスト側パスとコンテナ側パス

Docker Compose 例:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

意味:

```text
ホスト:      /root/qbittorrent/config
コンテナ:    /config
```

WebUI がホストの次の場所にある場合:

```text
/root/qbittorrent/config/weig_qb-webui
```

qBittorrent の **ファイルの場所:** は通常こちらです。

```text
/config/weig_qb-webui
```

### 既定の Docker 変換

```text
Container /config -> Host /root/qbittorrent/config
```

を検出し、`-o` を指定していなければ:

```text
Host install path: /root/qbittorrent/config/weig_qb-webui
qBittorrent Root Folder: /config/weig_qb-webui
```

となります。

### 例 1: qBittorrent コンテナが 1 つ

```sh
sh weig_qb-webui_install.sh -configure
```

### 例 2: コンテナ一覧

```sh
sh weig_qb-webui_install.sh --list-containers
```

または:

```sh
docker ps
```

### 例 3: コンテナを指定

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### 例 4: 複数コンテナ

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

テスト用:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

複数候補がある場合、インストーラーは勝手に選びません。

### 例 5: ホスト側 `/config` の場所が分かる

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

### 例 6: Synology

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

### 例 7: その他の NAS

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

実際に `/config` へマウントしているパスへ置き換えてください。

### 例 8: コンテナ側の WebUI パスを指定

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

`/config` が `/root/qbittorrent/config` に対応する場合:

```text
/config/weig_qb-webui
        ↓
/root/qbittorrent/config/weig_qb-webui
```

### 例 9: 特定 Release

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -version 1.0.0 -configure
```

### 例 10: dev

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -dev -configure
```

### 例 11: ロールバック

```sh
sh weig_qb-webui_install.sh -rollback
```

### よくあるミス

qBittorrent 内にホスト側パスを入力してしまうことです。コンテナ内 qBittorrent では通常:

```text
/config/weig_qb-webui
```

を使用します。

</details>

---

---

## 3. Windows ワンクリックインストール

推奨ワンライナー:

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>既定のインストール先と Windows のその他の使い方（クリックして展開）</b></summary>

### 既定のインストール先

```text
C:\Users\<ユーザー名>\AppData\Local\WeiG_qB-WebUI
```

環境変数では:

```text
%LOCALAPPDATA%\WeiG_qB-WebUI
```

### 例 1: latest + 自動設定

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### 例 2: ファイルだけインストール

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1
```

その後:

**ツール → オプション... → WebUI**

**別のWebUIを使用する** を有効化し、**ファイルの場所:** にインストール先を設定します。

### 例 3: 特定 Release

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -configure
```

### 例 4: D ドライブ

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -o D:\WeiG_qB-WebUI -configure
```

### 例 5: バージョン + D ドライブ

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -o D:\WeiG_qB-WebUI -configure
```

### 例 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

### 例 7: 更新

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### 例 8: ロールバック

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

### 例 9: ヘルプ

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -help
```

PowerShell のパラメータ名は大文字小文字を区別しません。`-ExecutionPolicy Bypass` はこの PowerShell プロセスにだけ適用され、システム全体の実行ポリシーを恒久変更するものではありません。

</details>

---

---

## 4. アップグレードとロールバック


再度インストーラーを実行するのが通常の更新方法です。

<details>
<summary><b>アップグレードとロールバックのコマンド（クリックして展開）</b></summary>

Linux:

```sh
sh weig_qb-webui_install.sh -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

ロールバック:

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

qBittorrent 標準 WebUI にすぐ戻すだけなら、**別のWebUIを使用する** を無効にしてください。

</details>

---

## 5. よく使うオプション

Linux / Docker / NAS は `install.sh`、Windows は `install.ps1` を使用します。PowerShell のパラメータ名は大文字小文字を区別しません。

| 用途 | Linux / Docker / NAS | Windows PowerShell | 説明 |
|---|---|---|---|
| 最新安定版 | 既定、指定不要 | 既定、指定不要 | 推奨 |
| 特定 Release | `-version 1.0.0` | `-version 1.0.0` | 指定した Release のみ |
| 開発版 | `-dev` | `-dev` | 現在の `dev` exact Git SHA |
| インストール先 | `-o /path` / `-o /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| qBittorrent を自動設定 | `-configure` | `-configure` | 代替 WebUI を有効化しパスを設定 |
| ロールバック | `-rollback` | `-rollback` | 前回の WebUI / qB 設定を復元 |
| ヘルプ | `-help` | `-help` | 完全なヘルプを表示 |
| Docker コンテナ指定 | `--container=NAME` | — | 複数コンテナ時 |
| Docker コンテナ一覧 | `--list-containers` | — | 検出された qB コンテナを表示 |
| ホスト側 `/config` 指定 | `--config-root=/path` | — | マウント元が分かる場合 |

<details>
<summary><b>説明：（クリックして展開）</b></summary>

重要なルール:

- 何も指定しない場合は最新の安定版 Release をインストールします。
- `-version` で存在しないバージョンを指定すると停止し、**latest や dev へ自動的に切り替わりません**。
- `-dev` と `-version` は同時に使用できません。
- `-configure` は qBittorrent の設定を変更する前にバックアップします。
- `-rollback` は利用可能なバックアップから前回状態を復元します。

</details>

---

## 6. 手動インストール

最新 Release:

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

必要なファイル:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>展開: 手動ダウンロード、検証、展開、qBittorrent 設定</b></summary>

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

SHA-256 計算:

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

展開後:

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

qBittorrent で **ツール → オプション... → WebUI** を開き、**別のWebUIを使用する** を有効化し、**ファイルの場所:** を `WeiG_qB-WebUI` ルートへ設定します。

</details>

---

---

## 7. よくある問題

<details>
<summary><b>展開: キャッシュ、404、Docker パス、複数コンテナ、checksum</b></summary>

### 古い画面が出る

`Ctrl + F5` またはプライベートウィンドウを試してください。

### 404 / 読み込めない

**ファイルの場所:** のディレクトリ直下に次があるか確認します。

```text
public
private
VERSION
GIT_SHA
```

### Docker で見つからない

ホストパスではなく、通常は次のコンテナパスを使用します。

```text
/config/weig_qb-webui
```

### 複数コンテナ

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### checksum エラー

回避せず再ダウンロードしてください。ZIP と `SHA256SUMS` が一致しない場合、インストーラーは意図的に停止します。

</details>

---

## 8. インストール済みバージョンの確認

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` はバージョン、`GIT_SHA` は exact Git commit、`private/weigg-install.json` は配布元・SHA・パス・Docker 情報などを記録します。

---

## 9. 互換性

```text
qBittorrent 4.1.x → 5.2.x
```

メインラインの最小 WebAPI v2 対象は **qBittorrent 4.1.0** です。qBittorrent 4.0.x は旧 WebAPI v1 のため現在のメインライン対象外です。

---

## 10. 高度な説明 / メンテナー向け

<details>
<summary><b>展開: exact SHA、Release identity、旧オプション</b></summary>

`dev` は現在の `dev` を 40 文字 Git SHA に解決し、その正確なコミットを配置して `GIT_SHA` に記録します。

Release は通常次を提供します。

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Linux の旧 `--channel=release|dev`、`--dir=/path`、`--update`、Windows の `-Channel`、`-Destination`、`-Mode` は互換用に残っています。新規導入では本ページ冒頭の新しいオプションを使用してください。

</details>

# WeiG qB WebUI

デスクトップとモバイル向けに最適化された、モダンでレスポンシブな qBittorrent Alternate WebUI です。

**📱 モバイル対応 · 🌙 ダークモード · ✅ qBittorrent 4.1.x → 5.2.x をサポート**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 オンラインプレビュー](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ 最新正式版をダウンロード](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**言語**：[English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · **日本語** · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

## 直接ダウンロード

最新の安定版 **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)** をダウンロードします。

ZIP 内の最上位フォルダー名は引き続き `WeiG-qB-WebUI` です。展開後、ローカルのフォルダー名を **`WeiG_qB-WebUI`** に変更してください。この名前に変更したフォルダーを qBittorrent の WebUI ディレクトリとして使用します。

## 画面プレビュー

### デスクトップ

![WeiG qB WebUI デスクトップ画面](../assets/screenshots/weig-qb-webui-desktop-overview.png)

### モバイル

![WeiG qB WebUI モバイル画面](../assets/screenshots/weig-qb-webui-mobile-overview.png)

## 初心者向けインストール

<details>
<summary><b>初めてインストールしますか？1分ガイドを展開</b></summary>

### 1. ZIP を展開

`WeiG-qB-WebUI.zip` をダウンロードして展開し、展開された `WeiG-qB-WebUI` フォルダーを `WeiG_qB-WebUI` に変更します。最終的な構成は次のようになります。

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

**`WeiG_qB-WebUI` フォルダー全体**が WebUI のルートです。`public` や `private` だけをコピーしないでください。

### 2. 固定した場所へ移動

`WeiG_qB-WebUI` フォルダー全体を、あとで誤って削除しない場所へ移動します。例：

```text
Windows：D:\WeiG_qB-WebUI
Linux：  /opt/WeiG_qB-WebUI
```

このディレクトリを qBittorrent に指定します。

### 3. qBittorrent で有効化

qBittorrent を開きます。

**ツール → オプション... → WebUI**

これは現在の qBittorrent 日本語公式 UI の用語です。続いて：

1. **別のWebUIを使用する** を有効にします。
2. **ファイルの場所:** を探します。
3. 保存した `WeiG_qB-WebUI` フォルダーのパスを入力します。

Windows の例：

```text
D:\WeiG_qB-WebUI
```

通常の Linux の例：

```text
/opt/WeiG_qB-WebUI
```

4. **OK** を押して保存します。
5. qBittorrent WebUI のページを再読み込みします。古い画面が残る場合は `Ctrl + F5` を試してください。

> **パスが正しいか確認する方法：** 指定したディレクトリの直下に `public`、`private`、`VERSION` などが見える必要があります。さらにもう一つ `WeiG_qB-WebUI` フォルダーへ入らないと見えない場合は、パスの階層がずれています。

> **Docker ユーザー：** qBittorrent はコンテナー内で動作するため、通常はホスト側の実パスをそのまま指定できません。下の **Docker** ガイドを参照してください。

</details>

## ワンクリックインストール

Linux / NAS 用のワンクリックインストーラーは、下の固定 Dev Pages URL から取得します。**スクリプトの URL はインストール先のチャンネルを決めません：** `-dev` を付けなければ検証済みの最新安定 Release をインストールし、`-dev` は現在の開発版を明示的に試す場合だけ使用します。
### Linux / NAS

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>スクリプトの場所と既定の WebUI インストール先を表示</b></summary>

```text
./weig_qb-webui_install.sh
```

WebUI 本体の既定インストール先：

```text
~/.local/share/weig_qb-webui
```

`root` ユーザーで実行する場合は通常：

```text
/root/.local/share/weig_qb-webui
```

</details>

### Docker

<details>
<summary><b>Docker ワンクリック / 複数コンテナー / パス説明（初心者向け）</b></summary>

#### 「ホスト」と「コンテナー」

VPS、Linux サーバー、Synology、QNAP などで Docker を使用している場合：

- **ホスト**：Docker を実際に動かしている Linux / NAS。本体側のシステムです。
- **コンテナー**：Docker が qBittorrent 用に作る独立した実行環境です。qBittorrent はコンテナー内のパスを参照します。

たとえば次のマウントがあるとします。

```text
ホスト：      /root/qbittorrent/config
   ↓ マウント
コンテナー：  /config
```

Docker Compose では一般に：

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

左側が**ホストパス**、右側が**コンテナーパス**です。

WebUI がホスト側の：

```text
/root/qbittorrent/config/weig_qb-webui
```

にある場合、qBittorrent の **ファイルの場所:** には：

```text
/config/weig_qb-webui
```

を指定します。ホストパスをそのまま指定しないでください。

#### 1つだけ qBittorrent コンテナーがある場合

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

インストーラーが実行中の qBittorrent コンテナーと `/config` マウントを検出し、適切なホスト側の場所へ WebUI を配置して設定を行います。

#### コンテナー名を確認する

```sh
sh weig_qb-webui_install.sh --list-containers
```

Docker 自体でも確認できます。

```sh
docker ps
```

名前が `qbittorrent` の場合：

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

#### 複数の qBittorrent コンテナーがある場合

```text
qbittorrent
qbittorrent-test
```

まず一覧を表示：

```sh
sh weig_qb-webui_install.sh --list-containers
```

使用するコンテナーを明示します。

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

テスト用なら：

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

複数ある場合、インストーラーは勝手に選択しません。

#### ホスト側の `/config` ディレクトリが分かっている場合

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

Synology の例：

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

その他の NAS の例：

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

実際の環境のパスへ置き換えてください。

#### WebUI のパスを指定する

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

インストーラーが `/config/...` を対応するホスト側パスへ変換します。

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>インストール先を表示</b></summary>

```text
C:\Users\<ユーザー名>\AppData\Local\WeiG_qB-WebUI
```

</details>

## よく使うオプション
PowerShell のパラメーター名は大文字・小文字を区別しません。

| 用途 | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| 最新正式版 | 既定、引数不要 | 既定、引数不要 |
| 正式版を指定 | `-version 0.1.0` | `-version 0.1.0` |
| 開発版 | `-dev` | `-dev` |
| インストール先を指定 | `-o /path` または `-o /path` | `-o D:\path` または `-output D:\path` |
| qBittorrent を自動設定 | `-configure` | `-configure` |
| 前回のインストールへ戻す | `-rollback` | `-rollback` |
| ヘルプ | `-help` | `-help` |
| Docker コンテナー指定 | `--container=NAME` | — |
| Docker コンテナー一覧 | `--list-containers` | — |
| Docker `/config` のホストパス指定 | `--config-root=/path` | — |

<details>
<summary><b>説明：（クリックして展開）</b></summary>

- `-version` で存在しない Release を指定した場合、latest や dev へ自動フォールバックしません。
- `-dev` と `-version` は同時に使用できません。
- `-configure` はインストール前の qBittorrent 設定をバックアップしてから Alternate WebUI を設定します。

### バージョンと保存先を同時指定

Linux：

```sh
sh weig_qb-webui_install.sh -version 0.1.0 -o /opt/weig_qb-webui -configure
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 0.1.0 -o D:\WeiG_qB-WebUI -configure
```

### ロールバック

Linux：

```sh
sh weig_qb-webui_install.sh -rollback
```

Windows：

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```


</details>
## 詳細ヘルプ

Docker、NAS、カスタムパス、更新、手動展開については [インストール・更新・手動展開](installation-guide/deployment-guide.ja.md) を参照してください。

## ライセンス

[GNU General Public License v3](../LICENSE) の下で公開されています。

Copyright © 2026 Wei.G / WeiG Share。

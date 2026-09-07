# WeiG qB WebUI

데스크톱과 모바일에 최적화된 현대적이고 반응형인 qBittorrent Alternate WebUI입니다.

**📱 모바일 친화적 · 🌙 다크 모드 · ✅ qBittorrent 4.1.x → 5.2.x 지원**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 온라인 미리보기](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ 최신 정식 버전 다운로드](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**언어**: [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · **한국어** · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt.md) · [Русский](README.ru.md)

## 직접 다운로드

최신 정식 **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)** 을 다운로드하세요.

압축을 풀면 **`WeiG-qB-WebUI` 폴더 자체가 qBittorrent에서 지정할 WebUI 디렉터리**입니다.

## 초보자 설치

<details>
<summary><b>처음 설치하나요? 1분 가이드 펼치기</b></summary>

### 1. 압축 풀기

`WeiG-qB-WebUI.zip`을 다운로드해 압축을 풀면 다음과 같습니다.

```text
WeiG-qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

**`WeiG-qB-WebUI` 전체 폴더**가 WebUI 루트입니다. `public`이나 `private`만 복사하지 마세요.

### 2. 고정된 위치로 이동

나중에 실수로 삭제하지 않을 위치에 전체 폴더를 옮깁니다.

```text
Windows: D:\WeiG-qB-WebUI
Linux:   /opt/WeiG-qB-WebUI
```

이 경로를 qBittorrent에 입력합니다.

### 3. qBittorrent에서 활성화

qBittorrent를 엽니다.

**도구 → 옵션… → WebUI**

현재 qBittorrent 공식 한국어 UI 용어입니다. 이어서:

1. **대체 WebUI 사용**을 켭니다.
2. **파일 위치:**를 찾습니다.
3. 저장한 `WeiG-qB-WebUI` 폴더 경로를 입력합니다.

Windows 예시:

```text
D:\WeiG-qB-WebUI
```

일반 Linux 예시:

```text
/opt/WeiG-qB-WebUI
```

4. **확인/OK**을 눌러 저장합니다.
5. qBittorrent WebUI 페이지를 새로고침합니다. 이전 화면이 남으면 `Ctrl + F5`를 눌러 보세요.

> **경로가 맞는지 확인하는 방법:** 입력한 폴더 안에 `public`, `private`, `VERSION` 등이 바로 보여야 합니다.

> **Docker 사용자:** qBittorrent는 컨테이너 안에서 실행되므로 호스트 경로를 그대로 입력할 수 없는 경우가 많습니다. 아래 Docker 안내를 확인하세요.

</details>

## 원클릭 설치

설치 스크립트는 안정적인 `main` 브랜치에서 받습니다. **기본값은 최신 정식 GitHub Release**이며 `SHA256SUMS`를 검증합니다.

### Linux / NAS

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

<details>
<summary><b>스크립트 위치와 기본 WebUI 설치 경로 보기</b></summary>

```text
./weigg-install.sh
```

기본 WebUI 설치 경로:

```text
~/.local/share/weigg-qb-webui
```

`root`로 실행한 경우 일반적으로:

```text
/root/.local/share/weigg-qb-webui
```

</details>

### Docker

<details>
<summary><b>Docker 원클릭 설치 / 여러 컨테이너 / 경로 설명</b></summary>

#### 호스트와 컨테이너

- **호스트**: Docker가 실제로 실행되는 Linux/NAS 시스템입니다.
- **컨테이너**: qBittorrent가 실행되는 Docker 환경입니다.

예를 들어:

```text
호스트:      /root/qbittorrent/config
   ↓ 매핑
컨테이너:    /config
```

Docker Compose 예시:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

WebUI가 호스트의:

```text
/root/qbittorrent/config/weigg-qb-webui
```

에 설치되었다면 qBittorrent의 **파일 위치:**에는:

```text
/config/weigg-qb-webui
```

를 입력해야 합니다.

#### qBittorrent 컨테이너가 하나뿐인 경우

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o weigg-install.sh && sh weigg-install.sh --configure
```

설치기가 실행 중인 qBittorrent 컨테이너와 `/config` 매핑을 자동으로 찾습니다.

#### 컨테이너 목록 보기

```sh
sh weigg-install.sh --list-containers
```

또는:

```sh
docker ps
```

`qbittorrent`를 명시적으로 선택:

```sh
sh weigg-install.sh --container=qbittorrent --configure
```

여러 컨테이너가 있으면 설치기는 임의로 선택하지 않습니다.

#### 호스트의 `/config` 경로를 알고 있는 경우

```sh
sh weigg-install.sh --config-root=/root/qbittorrent/config --configure
```

Synology 예시:

```sh
sh weigg-install.sh --config-root=/volume1/docker/qbittorrent --configure
```

다른 NAS 예시:

```sh
sh weigg-install.sh --config-root=/share/Container/qbittorrent --configure
```

#### WebUI 경로 지정

```sh
sh weigg-install.sh --container=qbittorrent -o /config/weigg-qb-webui --configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.ps1 -OutFile .\weigg-install.ps1; powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -configure
```

<details>
<summary><b>설치 경로 보기</b></summary>

```text
C:\Users\<사용자 이름>\AppData\Local\WeiG-qB-WebUI
```

</details>

## 자주 쓰는 옵션

<details>
<summary><b>옵션 / 버전 지정 / 경로 지정 / 롤백 펼치기</b></summary>

PowerShell 매개변수 이름은 대소문자를 구분하지 않습니다.

| 용도 | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| 최신 정식 버전 | 기본값 | 기본값 |
| 특정 Release | `--version 0.3.60` | `-version 0.3.60` |
| 개발 버전 | `--dev` | `-dev` |
| 설치 경로 지정 | `-o /path` 또는 `--output /path` | `-o D:\path` 또는 `-output D:\path` |
| qBittorrent 자동 설정 | `--configure` | `-configure` |
| 이전 설치로 롤백 | `--rollback` | `-rollback` |
| 도움말 | `--help` | `-help` |
| Docker 컨테이너 지정 | `--container=NAME` | — |
| Docker 컨테이너 목록 | `--list-containers` | — |
| Docker `/config` 호스트 경로 지정 | `--config-root=/path` | — |

- 존재하지 않는 `--version / -version`은 latest나 dev로 자동 전환되지 않습니다.
- `--dev / -dev`와 `--version / -version`은 함께 사용할 수 없습니다.

Linux 예시:

```sh
sh weigg-install.sh --version 0.3.60 -o /opt/weigg-qb-webui --configure
```

Windows 예시:

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -version 0.3.60 -o D:\WeiG-qB-WebUI -configure
```

롤백:

```sh
sh weigg-install.sh --rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weigg-install.ps1 -rollback
```

</details>

## 추가 도움말

Docker, NAS, 사용자 지정 경로, 업데이트 및 수동 배포는 [설치, 업그레이드 및 수동 배포](../docs/007.安装升级与手动部署.md)를 참고하세요.

## 라이선스

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

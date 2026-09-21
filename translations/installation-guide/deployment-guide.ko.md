# 초보자 설치·업그레이드 가이드

**언어**: [English](deployment-guide.en.md) · [简中](deployment-guide.zh-CN.md) · [繁中](deployment-guide.zh-TW.md) · [日本語](deployment-guide.ja.md) · **한국어** · [Deutsch](deployment-guide.de.md) · [Français](deployment-guide.fr.md) · [Español](deployment-guide.es.md) · [Português](deployment-guide.pt.md) · [Русский](deployment-guide.ru.md)

이 문서는 초보자를 위한 자세한 설치 가이드입니다. **대부분의 사용자는 최신 안정 Release를 사용하는 것을 권장합니다.** `dev`는 개발 버전을 의도적으로 테스트할 때만 사용하세요.

지원 범위: **qBittorrent 4.1.x → 5.2.x**.

> 가장 빠르게 설치하려면 아래의 **Linux / NAS, Docker, Windows PowerShell** 중 해당 환경으로 이동해 기본 명령을 복사하세요. 상세 설명과 예시는 기본적으로 접혀 있습니다.

## 1. Linux / NAS 원클릭 설치

권장 원클릭 명령:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>스크립트 위치, 기본 설치 경로와 추가 사용법 보기 (클릭하여 펼치기)</b></summary>

### 기본 설치 경로

```text
~/.local/share/weig_qb-webui
```

예:

```text
/home/alex/.local/share/weig_qb-webui
```

`root` 사용 시:

```text
/root/.local/share/weig_qb-webui
```

설치 스크립트는 현재 디렉터리에 남습니다.

```text
./weig_qb-webui_install.sh
```

### 예시 1: 최신 Release + 자동 설정

```sh
sh weig_qb-webui_install.sh -configure
```

### 예시 2: 파일만 설치

```sh
sh weig_qb-webui_install.sh
```

그다음 qBittorrent에서 직접 설정합니다.

**도구 → 옵션… → WebUI**

1. **대체 WebUI 사용**을 켭니다.
2. **파일 위치:**에 WeiG qB WebUI 디렉터리를 입력합니다.
3. **확인**으로 저장합니다.

### 예시 3: 특정 버전

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -configure
```

### 예시 4: 사용자 지정 경로

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

또는:

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

### 예시 5: 버전 + 경로

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -o /opt/weig_qb-webui -configure
```

### 예시 6: dev

```sh
sh weig_qb-webui_install.sh -dev -configure
```

### 예시 7: 최신 Release로 업그레이드

```sh
sh weig_qb-webui_install.sh -configure
```

특정 버전으로 이동:

```sh
sh weig_qb-webui_install.sh -version 0.1.1 -configure
```

### 예시 8: 롤백

```sh
sh weig_qb-webui_install.sh -rollback
```

### 예시 9: 도움말

```sh
sh weig_qb-webui_install.sh -help
```

Linux 설치기는 `curl`, `wget`, BusyBox, Python 3 등 사용 가능한 도구를 자동 탐색합니다. SHA-256 검증 수단이 하나도 없으면 Release를 검증 없이 설치하지 않고 중단합니다.

</details>

---

---

## 2. Docker 원클릭 설치

먼저 기본 원클릭 명령을 실행해 보세요.

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Docker 경로, 여러 컨테이너와 고급 사용법 (클릭하여 펼치기)</b></summary>



실행 중인 qBittorrent 컨테이너가 하나이고 정상적인 `/config` 마운트가 있으면 자동 감지를 시도합니다.

### 호스트 경로와 컨테이너 경로

Docker Compose 예:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

의미:

```text
호스트:     /root/qbittorrent/config
컨테이너:   /config
```

WebUI가 호스트의 다음 위치에 있다면:

```text
/root/qbittorrent/config/weig_qb-webui
```

qBittorrent의 **파일 위치:**에는 일반적으로 다음을 입력합니다.

```text
/config/weig_qb-webui
```

### 기본 Docker 경로 변환

설치기가 다음을 감지하고:

```text
Container /config -> Host /root/qbittorrent/config
```

`-o`를 지정하지 않았으면:

```text
Host install path: /root/qbittorrent/config/weig_qb-webui
qBittorrent Root Folder: /config/weig_qb-webui
```

를 사용합니다.

### 예시 1: qBittorrent 컨테이너 하나

```sh
sh weig_qb-webui_install.sh -configure
```

### 예시 2: 컨테이너 목록

```sh
sh weig_qb-webui_install.sh --list-containers
```

또는:

```sh
docker ps
```

### 예시 3: 컨테이너 지정

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### 예시 4: 여러 qBittorrent 컨테이너

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

테스트 컨테이너:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

여러 후보가 있으면 설치기는 임의로 선택하지 않습니다.

### 예시 5: 호스트 `/config` 경로를 알고 있음

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

### 예시 6: Synology

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

### 예시 7: 기타 NAS

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

실제로 `/config`에 마운트한 호스트 경로로 바꾸세요.

### 예시 8: 컨테이너에서 보이는 WebUI 경로 지정

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

`/config`가 `/root/qbittorrent/config`에 대응하면:

```text
/config/weig_qb-webui
        ↓
/root/qbittorrent/config/weig_qb-webui
```

로 변환됩니다.

### 예시 9: 특정 Release

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -version 1.0.0 -configure
```

### 예시 10: dev

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -dev -configure
```

### 예시 11: 롤백

```sh
sh weig_qb-webui_install.sh -rollback
```

### 가장 흔한 실수

qBittorrent에 호스트 경로를 입력하는 것입니다. 컨테이너 내부 qBittorrent는 보통 다음 경로를 사용해야 합니다.

```text
/config/weig_qb-webui
```

</details>

---

---

## 3. Windows 원클릭 설치

권장 원클릭 명령:

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>기본 설치 경로와 Windows 추가 사용법 보기 (클릭하여 펼치기)</b></summary>

### 기본 설치 경로

```text
C:\Users\<사용자 이름>\AppData\Local\WeiG_qB-WebUI
```

환경 변수 형태:

```text
%LOCALAPPDATA%\WeiG_qB-WebUI
```

### 예시 1: latest + 자동 설정

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### 예시 2: 파일만 설치

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1
```

그다음 **도구 → 옵션… → WebUI**에서 **대체 WebUI 사용**을 켜고 **파일 위치:**에 설치 경로를 입력합니다.

### 예시 3: 특정 Release

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -configure
```

### 예시 4: D 드라이브

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -o D:\WeiG_qB-WebUI -configure
```

### 예시 5: 버전 + 경로

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -o D:\WeiG_qB-WebUI -configure
```

### 예시 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

### 예시 7: 업그레이드

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### 예시 8: 롤백

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

### 예시 9: 도움말

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -help
```

PowerShell 매개변수는 대소문자를 구분하지 않습니다. `-ExecutionPolicy Bypass`는 해당 PowerShell 프로세스에만 적용되며 시스템 전체 정책을 영구 변경하지 않습니다.

</details>

---

---

## 4. 업그레이드와 롤백


설치기를 다시 실행하는 것이 일반적인 업그레이드 방법입니다.

<details>
<summary><b>업그레이드와 롤백 명령 보기 (클릭하여 펼치기)</b></summary>

Linux:

```sh
sh weig_qb-webui_install.sh -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

롤백:

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

기본 qBittorrent WebUI로 바로 돌아가려면 **대체 WebUI 사용**을 끄면 됩니다.

</details>

---

## 5. 자주 쓰는 옵션

Linux / Docker / NAS는 `install.sh`, Windows는 `install.ps1`을 사용합니다. PowerShell 매개변수는 대소문자를 구분하지 않습니다.

| 용도 | Linux / Docker / NAS | Windows PowerShell | 설명 |
|---|---|---|---|
| 최신 안정 Release | 기본값 | 기본값 | 권장 |
| 특정 Release | `-version 1.0.0` | `-version 1.0.0` | 지정한 버전만 설치 |
| 개발 버전 | `-dev` | `-dev` | 현재 `dev` exact Git SHA |
| 설치 경로 | `-o /path` / `-o /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| qBittorrent 자동 설정 | `-configure` | `-configure` | 대체 WebUI 활성화 및 경로 설정 |
| 롤백 | `-rollback` | `-rollback` | 이전 설치와 qB 설정 복원 |
| 도움말 | `-help` | `-help` | 전체 도움말 출력 |
| Docker 컨테이너 지정 | `--container=NAME` | — | qB 컨테이너가 여러 개일 때 |
| Docker 컨테이너 목록 | `--list-containers` | — | 감지된 qB 컨테이너 표시 |
| 호스트 `/config` 경로 지정 | `--config-root=/path` | — | 마운트 원본을 알고 있을 때 |

<details>
<summary><b>설명: (클릭하여 펼치기)</b></summary>

중요 규칙:

- 소스 옵션을 지정하지 않으면 최신 안정 Release를 설치합니다.
- `-version`으로 존재하지 않는 버전을 지정하면 중단되며 **latest나 dev로 자동 전환되지 않습니다**.
- `-dev`와 `-version`은 함께 사용할 수 없습니다.
- `-configure`는 qBittorrent 설정을 수정하기 전에 백업합니다.
- `-rollback`은 가능한 경우 이전 WebUI와 qBittorrent 설정을 복원합니다.

</details>

---

## 6. 수동 설치

최신 Release:

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

다운로드할 파일:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>펼치기: 수동 다운로드, 검증, 압축 해제, qBittorrent 설정</b></summary>

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

SHA-256 계산:

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

압축 해제 후:

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

qBittorrent에서 **도구 → 옵션… → WebUI**를 열고 **대체 WebUI 사용**을 활성화한 뒤 **파일 위치:**를 `WeiG_qB-WebUI` 루트 디렉터리로 지정하세요.

</details>

---

---

## 7. 자주 묻는 문제

<details>
<summary><b>펼치기: 캐시, 404, Docker 경로, 다중 컨테이너, checksum</b></summary>

### 이전 화면이 계속 보임

`Ctrl + F5` 또는 시크릿 창을 사용해 보세요.

### 404 / WebUI 로드 실패

**파일 위치:**가 가리키는 디렉터리에 다음이 바로 보여야 합니다.

```text
public
private
VERSION
GIT_SHA
```

### Docker에서 파일을 못 찾음

호스트 경로 대신 일반적으로 다음 컨테이너 경로를 사용합니다.

```text
/config/weig_qb-webui
```

### 여러 컨테이너

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### checksum 오류

무시하지 말고 다시 다운로드하세요. ZIP과 `SHA256SUMS`가 일치하지 않으면 설치기는 의도적으로 중단됩니다.

</details>

---

## 8. 설치된 버전 확인

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION`은 버전, `GIT_SHA`는 exact Git commit, `private/weigg-install.json`은 소스·SHA·경로·Docker 정보 등을 기록합니다.

---

## 9. 호환 범위

```text
qBittorrent 4.1.x → 5.2.x
```

메인라인 최소 WebAPI v2 대상은 **qBittorrent 4.1.0**입니다. qBittorrent 4.0.x는 구형 WebAPI v1이라 현재 메인라인 지원 범위에 포함되지 않습니다.

---

## 10. 고급 설명 / 관리자

<details>
<summary><b>펼치기: exact SHA, Release identity, 레거시 옵션</b></summary>

`dev`는 현재 `dev`를 40자리 Git SHA로 해석하고 해당 정확한 커밋을 배포한 뒤 `GIT_SHA`에 기록합니다.

정식 Release는 일반적으로 다음을 제공합니다.

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Linux의 `--channel=release|dev`, `--dir=/path`, `--update`와 Windows의 `-Channel`, `-Destination`, `-Mode`는 기존 사용자를 위해 호환됩니다. 신규 배포는 문서 상단의 새 옵션을 사용하세요.

</details>

# Руководство для новичков: установка и обновление

**Язык**: [English](deployment-guide.en.md) · [简中](deployment-guide.zh-CN.md) · [繁中](deployment-guide.zh-TW.md) · [日本語](deployment-guide.ja.md) · [한국어](deployment-guide.ko.md) · [Deutsch](deployment-guide.de.md) · [Français](deployment-guide.fr.md) · [Español](deployment-guide.es.md) · [Português](deployment-guide.pt.md) · **Русский**

Это подробное руководство для начинающих. **Большинству пользователей рекомендуется устанавливать последний стабильный Release.** Используйте `dev` только если вы сознательно хотите протестировать версию разработки.

Поддерживаемый диапазон: **qBittorrent 4.1.x → 5.2.x**.

> Если нужна самая быстрая установка, перейдите сразу к **Linux / NAS**, **Docker** или **Windows PowerShell** и скопируйте основную команду. Подробные объяснения и примеры по умолчанию свёрнуты.

## 1. Установка Linux / NAS в один шаг

Рекомендуемая команда в одну строку:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Показать расположение скрипта, каталог по умолчанию и дополнительные варианты (нажмите, чтобы раскрыть)</b></summary>

### Каталог установки по умолчанию

```text
~/.local/share/weig_qb-webui
```

Пример:

```text
/home/alex/.local/share/weig_qb-webui
```

Для `root` обычно:

```text
/root/.local/share/weig_qb-webui
```

Сам скрипт остаётся в текущем каталоге:

```text
./weig_qb-webui_install.sh
```

### Пример 1: latest + автоматическая настройка

```sh
sh weig_qb-webui_install.sh -configure
```

### Пример 2: установить только файлы

```sh
sh weig_qb-webui_install.sh
```

Затем настройте qBittorrent вручную:

**Сервис → Настройки… → WebUI**

1. Включите **Использовать альтернативный веб-интерфейс**.
2. В **Расположение файлов:** укажите каталог WeiG qB WebUI.
3. Сохраните через **OK**.

### Пример 3: конкретный Release

```sh
sh weig_qb-webui_install.sh -version 0.1.0 -configure
```

### Пример 4: пользовательский каталог

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

Или:

```sh
sh weig_qb-webui_install.sh -o /opt/weig_qb-webui -configure
```

### Пример 5: версия + каталог

```sh
sh weig_qb-webui_install.sh -version 0.1.0 -o /opt/weig_qb-webui -configure
```

### Пример 6: dev

```sh
sh weig_qb-webui_install.sh -dev -configure
```

### Пример 7: обновление до latest

```sh
sh weig_qb-webui_install.sh -configure
```

Переход на конкретную версию:

```sh
sh weig_qb-webui_install.sh -version 0.1.1 -configure
```

### Пример 8: откат

```sh
sh weig_qb-webui_install.sh -rollback
```

### Пример 9: справка

```sh
sh weig_qb-webui_install.sh -help
```

Linux-установщик автоматически ищет доступные инструменты вроде `curl`, `wget`, BusyBox или Python 3. Если нет ни одного способа проверить SHA-256, Release не устанавливается без проверки.

</details>

---

---

## 2. Установка Docker в один шаг

Сначала попробуйте обычную команду:

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Пути Docker, несколько контейнеров и расширенные варианты (нажмите, чтобы раскрыть)</b></summary>



Если запущен только один контейнер qBittorrent с обычным монтированием `/config`, установщик попытается определить его автоматически.

### Путь хоста и путь контейнера

Пример Docker Compose:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Означает:

```text
Хост:      /root/qbittorrent/config
Контейнер: /config
```

Если WebUI физически расположен на хосте здесь:

```text
/root/qbittorrent/config/weig_qb-webui
```

то в qBittorrent в **Расположение файлов:** обычно нужно указать:

```text
/config/weig_qb-webui
```

### Автоматическое сопоставление Docker

Если найдено:

```text
Container /config -> Host /root/qbittorrent/config
```

и `-o` не задан:

```text
Host install path: /root/qbittorrent/config/weig_qb-webui
qBittorrent Root Folder: /config/weig_qb-webui
```

### Пример 1: один контейнер qBittorrent

```sh
sh weig_qb-webui_install.sh -configure
```

### Пример 2: список контейнеров

```sh
sh weig_qb-webui_install.sh --list-containers
```

Или:

```sh
docker ps
```

### Пример 3: выбрать контейнер

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### Пример 4: несколько контейнеров qBittorrent

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

Тестовый контейнер:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent-test -configure
```

При нескольких кандидатах установщик не выбирает случайно и требует явный выбор.

### Пример 5: известен каталог хоста, смонтированный как `/config`

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

### Пример 6: Synology

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

### Пример 7: другой NAS

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

Замените примеры на реальный путь хоста, смонтированный в `/config`.

### Пример 8: указать путь WebUI, видимый контейнеру

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

Если `/config` соответствует `/root/qbittorrent/config`:

```text
/config/weig_qb-webui
        ↓
/root/qbittorrent/config/weig_qb-webui
```

### Пример 9: конкретный Release

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -version 0.1.0 -configure
```

### Пример 10: dev

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -dev -configure
```

### Пример 11: откат

```sh
sh weig_qb-webui_install.sh -rollback
```

### Самая частая ошибка Docker

В qBittorrent вводят путь хоста. Внутри контейнера обычно нужен:

```text
/config/weig_qb-webui
```

</details>

---

---

## 3. Установка Windows в один шаг

Рекомендуемая команда:

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>Показать каталог по умолчанию и дополнительные варианты Windows (нажмите, чтобы раскрыть)</b></summary>

### Каталог по умолчанию

```text
C:\Users\<имя-пользователя>\AppData\Local\WeiG_qB-WebUI
```

Эквивалентно:

```text
%LOCALAPPDATA%\WeiG_qB-WebUI
```

### Пример 1: latest + автоматическая настройка

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Пример 2: только файлы

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1
```

Затем откройте **Сервис → Настройки… → WebUI**, включите **Использовать альтернативный веб-интерфейс** и укажите каталог установки в **Расположение файлов:**.

### Пример 3: конкретный Release

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 0.1.0 -configure
```

### Пример 4: установка на D:\

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -o D:\WeiG_qB-WebUI -configure
```

### Пример 5: версия + каталог

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 0.1.0 -o D:\WeiG_qB-WebUI -configure
```

### Пример 6: dev

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -dev -configure
```

### Пример 7: обновление

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

### Пример 8: откат

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

### Пример 9: справка

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -help
```

Параметры PowerShell не чувствительны к регистру. `-ExecutionPolicy Bypass` применяется только к этому процессу PowerShell и не меняет системную политику навсегда.

</details>

---

---

## 4. Обновление и откат


Повторный запуск установщика — обычный способ обновления.

<details>
<summary><b>Показать команды обновления и отката (нажмите, чтобы раскрыть)</b></summary>

Linux:

```sh
sh weig_qb-webui_install.sh -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

Откат:

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```

Чтобы сразу вернуться к встроенному WebUI qBittorrent, отключите **Использовать альтернативный веб-интерфейс**.

</details>

---

## 5. Основные параметры

Linux / Docker / NAS используют `install.sh`, Windows использует `install.ps1`. Параметры PowerShell не чувствительны к регистру.

| Назначение | Linux / Docker / NAS | Windows PowerShell | Примечание |
|---|---|---|---|
| Последний стабильный Release | По умолчанию | По умолчанию | Рекомендуется |
| Конкретный Release | `-version 0.1.0` | `-version 0.1.0` | Установить только эту версию |
| Версия разработки | `-dev` | `-dev` | Точный Git SHA текущего `dev` |
| Каталог установки | `-o /path` / `-o /path` | `-o D:\path` / `-output D:\path` | `o` = output |
| Автонастройка qBittorrent | `-configure` | `-configure` | Включить альтернативный веб-интерфейс и задать путь |
| Откат | `-rollback` | `-rollback` | Восстановить предыдущую установку и конфигурацию qB |
| Справка | `-help` | `-help` | Показать полную справку |
| Выбрать Docker-контейнер | `--container=NAME` | — | Для нескольких контейнеров qB |
| Список Docker-контейнеров | `--list-containers` | — | Показать найденные контейнеры qB |
| Указать host-путь `/config` | `--config-root=/path` | — | Если известен источник монтирования |

<details>
<summary><b>Примечания: (нажмите, чтобы раскрыть)</b></summary>

Важные правила:

- Без параметра источника устанавливается последний стабильный Release.
- `-version` устанавливает именно запрошенный Release. Если его нет, установка прекращается и **не переключается автоматически на latest или dev**.
- `-dev` нельзя использовать вместе с `-version`.
- `-configure` создаёт резервную копию конфигурации qBittorrent перед изменением.
- `-rollback` восстанавливает предыдущий WebUI и настройки qBittorrent, если резервная копия доступна.

</details>

---

## 6. Ручная установка

Последний Release:

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest
```

Скачать:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

<details>
<summary><b>Развернуть: ручная загрузка, проверка, распаковка и настройка</b></summary>

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

Вычислить SHA-256:

```powershell
Get-FileHash .\WeiG-qB-WebUI.zip -Algorithm SHA256
```

После распаковки:

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

В qBittorrent откройте **Сервис → Настройки… → WebUI**, включите **Использовать альтернативный веб-интерфейс** и задайте **Расположение файлов:** на корневой каталог `WeiG_qB-WebUI`.

</details>

---

## 7. Частые проблемы

<details>
<summary><b>Развернуть: кэш, 404, Docker-пути, несколько контейнеров, checksum</b></summary>

### Всё ещё старая страница

Попробуйте `Ctrl + F5` или приватное окно браузера.

### 404 / WebUI не загружается

Каталог в **Расположение файлов:** должен напрямую содержать:

```text
public
private
VERSION
GIT_SHA
```

### Docker не видит файлы

Вероятно, указан путь хоста. Типичный путь контейнера:

```text
/config/weig_qb-webui
```

### Несколько контейнеров

```sh
sh weig_qb-webui_install.sh --list-containers
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

### Ошибка checksum

Не обходите проверку. Скачайте заново. Установщик намеренно останавливается, если ZIP и `SHA256SUMS` не совпадают.

</details>

---

## 8. Как проверить установленную версию

```text
VERSION
GIT_SHA
private/weigg-install.json
```

`VERSION` содержит версию, `GIT_SHA` — точный Git commit, а `private/weigg-install.json` — источник, SHA, пути и Docker-метаданные.

---

## 9. Совместимость

```text
qBittorrent 4.1.x → 5.2.x
```

Минимальная основная цель WebAPI v2 — **qBittorrent 4.1.0**. qBittorrent 4.0.x использует старую WebAPI v1 и не входит в текущую основную поддержку.

---

## 10. Дополнительно / для сопровождающих

<details>
<summary><b>Развернуть: exact SHA, идентичность Release и старые параметры</b></summary>

Установка `dev` сначала разрешает текущий `dev` в 40-символьный Git SHA, устанавливает именно этот commit и записывает его в `GIT_SHA`.

Обычный Release предоставляет:

```text
WeiG-qB-WebUI.zip
SHA256SUMS
```

Linux по-прежнему принимает `--channel=release|dev`, `--dir=/path`, `--update`, а Windows — `-Channel`, `-Destination`, `-Mode` для обратной совместимости. Для новых установок используйте актуальные параметры в начале страницы.

</details>

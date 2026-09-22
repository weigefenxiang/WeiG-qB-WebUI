# WeiG qB WebUI

Современный адаптивный Alternate WebUI для qBittorrent, оптимизированный для компьютеров и мобильных устройств.

**📱 Удобно на мобильных устройствах · 🌙 Тёмная тема · ✅ Поддержка qBittorrent 4.1.x → 5.2.x**

<p>
  <img src="https://img.shields.io/badge/-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/-CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/-Node.js-339933?logo=nodedotjs&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/-Shell-8A2BE2?logo=gnubash&logoColor=white" alt="Shell">
</p>

**[🌐 Онлайн-просмотр](https://weigefenxiang.github.io/WeiG-qB-WebUI/)** · **[⬇️ Скачать последнюю стабильную версию](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**

**Язык**: [English](../README.md) · [简中](README.zh-CN.md) · [繁中](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Deutsch](README.de.md) · [Français](README.fr.md) · [Español](README.es.md) · [Português](README.pt.md) · **Русский**

## Прямая загрузка

Скачайте последнюю стабильную версию **[WeiG-qB-WebUI.zip](https://github.com/weigefenxiang/WeiG-qB-WebUI/releases/latest/download/WeiG-qB-WebUI.zip)**.

В ZIP верхняя папка по-прежнему называется `WeiG-qB-WebUI`. После распаковки переименуйте локальную папку в **`WeiG_qB-WebUI`**; именно эту переименованную папку следует использовать как каталог WebUI в qBittorrent.

## Предпросмотр интерфейса

### Настольная версия

![Настольный интерфейс WeiG qB WebUI](../assets/screenshots/weig-qb-webui-desktop-overview.png)

### Мобильная версия

![Мобильный интерфейс WeiG qB WebUI](../assets/screenshots/weig-qb-webui-mobile-overview.png)

## Установка для начинающих

<details>
<summary><b>Устанавливаете впервые? Откройте минутную инструкцию</b></summary>

### 1. Распакуйте ZIP

Скачайте `WeiG-qB-WebUI.zip`, распакуйте архив и переименуйте полученную папку `WeiG-qB-WebUI` в `WeiG_qB-WebUI`. Итоговая структура должна выглядеть так:

```text
WeiG_qB-WebUI/
├── public/
├── private/
├── VERSION
└── GIT_SHA
```

Вся папка **`WeiG_qB-WebUI`** является корнем WebUI. Не копируйте только `public` или `private`.

### 2. Переместите в постоянное место

Например:

```text
Windows: D:\WeiG_qB-WebUI
### Конкретная версия и каталог установки

Linux:   /opt/WeiG_qB-WebUI
```

Этот путь затем нужно указать в qBittorrent.

### 3. Включите в qBittorrent

Откройте qBittorrent:

**Сервис → Настройки… → WebUI**

Это текущие термины официального русского перевода qBittorrent. Затем:

1. Включите **Использовать альтернативный веб-интерфейс**.
2. Найдите **Расположение файлов:**.
3. Укажите путь к папке `WeiG_qB-WebUI`.

Пример Windows:

```text
D:\WeiG_qB-WebUI
```

Пример Linux:

```text
/opt/WeiG_qB-WebUI
```

4. Нажмите **OK** для сохранения.
5. Обновите страницу WebUI. Если осталась старая версия из кэша, попробуйте `Ctrl + F5`.

> **Проверка пути:** в указанном каталоге должны сразу быть видны `public`, `private`, `VERSION` и другие файлы.

> **Docker:** qBittorrent работает внутри контейнера, поэтому обычно нужно указывать путь, видимый из контейнера, а не реальный путь хоста.

</details>

## Установка одной командой

Однокликовый установщик для Linux/NAS всегда загружается по фиксированному адресу Dev Pages ниже. **Адрес скрипта не определяет канал установки:** без `-dev` устанавливается последний проверенный стабильный Release; `-dev` используется только для текущей версии разработки.
### Linux / NAS

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

<details>
<summary><b>Показать путь скрипта и каталог установки по умолчанию</b></summary>

```text
./weig_qb-webui_install.sh
```

Каталог WebUI по умолчанию:

```text
~/.local/share/weig_qb-webui
```

При запуске от `root` обычно:

```text
/root/.local/share/weig_qb-webui
```

</details>

### Docker

<details>
<summary><b>Docker / несколько контейнеров / объяснение путей</b></summary>

#### Хост и контейнер

- **Хост**: Linux/NAS, на котором запущен Docker.
- **Контейнер**: изолированная среда, где работает qBittorrent.

Пример:

```text
Хост:       /root/qbittorrent/config
   ↓ смонтировано как
Контейнер:  /config
```

Docker Compose:

```yaml
volumes:
  - /root/qbittorrent/config:/config
```

Если WebUI на хосте находится здесь:

```text
/root/qbittorrent/config/weig_qb-webui
```

то в **Расположение файлов:** qBittorrent нужно указать:

```text
/config/weig_qb-webui
```

#### Один контейнер qBittorrent

```sh
curl -fsSL https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.sh -o weig_qb-webui_install.sh && sh weig_qb-webui_install.sh -configure
```

Установщик попытается автоматически определить контейнер и монтирование `/config`.

#### Показать контейнеры

```sh
sh weig_qb-webui_install.sh --list-containers
```

Или:

```sh
docker ps
```

Явно выбрать контейнер:

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -configure
```

Если найдено несколько контейнеров qBittorrent, установщик не выбирает один случайно.

#### Указать путь хоста, смонтированный как `/config`

```sh
sh weig_qb-webui_install.sh --config-root=/root/qbittorrent/config -configure
```

Synology:

```sh
sh weig_qb-webui_install.sh --config-root=/volume1/docker/qbittorrent -configure
```

Другой NAS:

```sh
sh weig_qb-webui_install.sh --config-root=/share/Container/qbittorrent -configure
```

#### Указать путь WebUI

```sh
sh weig_qb-webui_install.sh --container=qbittorrent -o /config/weig_qb-webui -configure
```

</details>

### Windows PowerShell

```powershell
Invoke-WebRequest https://weigefenxiang.github.io/WeiG-qB-WebUI/downloads/dev/install.ps1 -OutFile .\weig_qb-webui_install.ps1; powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -configure
```

<details>
<summary><b>Показать каталог установки</b></summary>

```text
C:\Users\<имя-пользователя>\AppData\Local\WeiG_qB-WebUI
```

</details>

## Основные параметры
Имена параметров PowerShell не зависят от регистра.

| Назначение | Linux / Docker / NAS | Windows PowerShell |
|---|---|---|
| Последний стабильный Release | По умолчанию | По умолчанию |
| Конкретный Release | `-version 1.0.0` | `-version 1.0.0` |
| Версия разработки | `-dev` | `-dev` |
| Каталог установки | `-o /path` или `-o /path` | `-o D:\path` или `-output D:\path` |
| Автоматически настроить qBittorrent | `-configure` | `-configure` |
| Откатить предыдущую установку | `-rollback` | `-rollback` |
| Справка | `-help` | `-help` |
| Выбрать Docker-контейнер | `--container=NAME` | — |
| Показать Docker-контейнеры | `--list-containers` | — |
| Путь хоста, смонтированный как `/config` | `--config-root=/path` | — |

<details>
<summary><b>Примечания: (нажмите, чтобы раскрыть)</b></summary>

- Несуществующая версия не переключается автоматически на latest или dev.
- `-dev` нельзя использовать вместе с `-version`.

### Конкретная версия и каталог установки

Linux:

```sh
sh weig_qb-webui_install.sh -version 1.0.0 -o /opt/weig_qb-webui -configure
```

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -version 1.0.0 -o D:\WeiG_qB-WebUI -configure
```

### Откат

Откат:

```sh
sh weig_qb-webui_install.sh -rollback
```

```powershell
powershell -ExecutionPolicy Bypass -File .\weig_qb-webui_install.ps1 -rollback
```


</details>
## Дополнительная помощь

Docker, NAS, пользовательские пути, обновление и ручное развёртывание: [Установка, обновление и ручное развёртывание](installation-guide/deployment-guide.ru.md).

## Лицензия

[GNU General Public License v3](../LICENSE).

Copyright © 2026 Wei.G / WeiG Share.

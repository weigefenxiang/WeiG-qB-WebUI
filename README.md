# WeiG qB WebUI

A premium, modular and high-performance Alternate WebUI for qBittorrent.

Current version: **0.2.1**  
Compatibility floor: **qBittorrent 4.1.9**  
Compatibility target: **qBittorrent 4.1.x → current 5.x**, with capability-based forward compatibility.

## v0.2.1 highlights

### Product navigation

Application navigation is now separated from Torrent filtering:

```text
Topbar
Torrents · Search · RSS · Logs · Settings · Contextual Search · Add Torrent

Sidebar
Torrent State · Trackers · Save Path · Categories · Tags · Connection
```

The Sidebar no longer mixes application pages with Torrent dataset filters. On phones, the main application destinations are exposed through a dedicated bottom navigation while the Drawer remains focused on Torrent filters.

### Internationalization

English is the **canonical source language**. UI text is resolved through the shared i18n layer rather than Feature-specific language checks.

Current locale targets:

```text
English
简体中文
繁體中文
日本語
한국어
```

Behavior:

```text
Manual language selection
        ↓
Browser language
        ↓
English fallback
```

Unsupported locales always fall back to English. The login screen follows the browser language as well.

For qBittorrent settings terminology, existing official qBittorrent WebUI translations are the preferred terminology source. The upstream Simplified Chinese WebUI translation lives under `qBittorrent/qBittorrent/src/webui/www/translations/webui_zh_CN.ts`. WeiG-specific concepts such as Nebula Noir, Starfield and UI density are maintained by this project.

### Settings UX

Settings are no longer presented as a raw API-object editor.

- Human-readable setting titles and descriptions come from a metadata schema.
- Common qBittorrent Preferences have English canonical labels plus Simplified Chinese translations.
- Unknown/new qB Preference keys receive a humanized English fallback rather than breaking the page.
- Boolean values use the canonical WeiG Switch control instead of tiny native checkboxes.
- Settings use a responsive card layout: 2 columns on normal desktop, 3 on very wide screens, 1 on smaller/mobile layouts.
- Settings search filters the visible setting cards.
- A Language card offers Browser/English/Chinese/Japanese/Korean selection.
- Raw API keys are implementation metadata, not normal end-user labels.

### Contextual search

The Topbar search changes role with the active page:

```text
Torrents  → Search torrents…
Settings  → Search settings…
Search    → Search engine…
RSS       → Search RSS…
Logs      → Search logs…
```

The non-Torrent search routes no longer accidentally trigger hidden Torrent-list filtering requests.

## v0.2 platform features

- **Nebula Noir v2**: CSS starfield, layered 3D surfaces, restrained edge glow and Light/Dark/System appearance.
- **Semantic Typography System**: Standard / Large (+2px) / XLarge (+3px) global scale. Large is the current default.
- **Independent density**: Compact / Standard / Comfortable is separate from font size.
- **20 / 50 / 100 / 200 server page sizes** with qB `limit` / `offset`.
- **Virtual DOM windowing**: API page/cache size never maps directly to mounted Torrent rows.
- **DataGrid v2**: sortable headers, resizable columns, column visibility/order controls and saved layout.
- **Mobile v2**: dedicated Torrent cards, Drawer, touch-size controls, More actions and bottom app navigation.
- **Whole-library catalog** fetched in bounded chunks for name/Tracker/save-path/PT filtering without whole-library DOM.
- **Tracker privacy normalization** removes query/fragment credentials before display/filter keys.
- **Private/PT filter** uses exact capability where available and configurable Tracker-domain heuristics on older qB.
- **Expanded Torrent actions**: start/resume, pause/stop, force start, recheck, reannounce, sequential mode, first/last piece priority, auto management, queue top/bottom, rename, location, category, tags and Torrent limits where supported.
- **Torrent Detail**: Overview, Files, Trackers, Peers and HTTP Sources.
- **Search / RSS / Logs** are capability-aware; unsupported modules are hidden instead of exposing dead controls.
- **Back/Home/Reload recovery**, background-tab polling slowdown and Reduced Motion remain hard invariants.

## Compatibility model

Feature/UI code does not scatter qB main-version conditions. Startup detects qBittorrent + WebAPI versions and creates a capability profile.

Important bridges include:

```text
qB 4.x            qB 5.x
pause / resume  ↔ stop / start
paused filter   ↔ stopped filter
```

Historical WebAPI anomalies are handled in the compatibility layer instead of Feature code.

### Real regression labs

```text
Lab A: qBittorrent 4.1.9.1 / WebAPI 2.2.1
Lab B: qBittorrent 5.2.0
```

Both are release-blocking stabilization targets. Static CI passing does **not** by itself certify every intermediate qB patch release; live API behavior continues to be tested on both ends of the supported range.

## Tracker privacy

Tracker URLs may include private passkeys or credentials. Display/filter values are normalized:

```text
https://tracker.m-team.cc/announce?credential=SECRET
→
https://tracker.m-team.cc/announce
```

Raw Tracker values are used only internally when a qB API operation genuinely requires the original value.

## Performance model

Page size controls API/data navigation, not DOM count:

```text
qB API:       limit=200&offset=0
Data models:  up to 200 for the page
DOM:          viewport + overscan only
```

Developer counters such as cache/DOM size live under **Settings → WeiG WebUI → Performance**, not the normal Torrent dashboard.

## Manual installation

1. Download or clone this repository.
2. Use the repository `webui` directory as the qBittorrent Alternate WebUI root.
3. Open **Tools → Preferences → Web UI** in qBittorrent.
4. Enable **Use alternative WebUI**.
5. Set the root folder to the local/container-visible `webui` directory.
6. Restart qBittorrent or refresh the browser.

The configured value is a **local filesystem path**, not a GitHub URL.

## Linux installer

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh
sh /tmp/weigg-qb-install.sh
```

Known Docker `/config` mount:

```sh
sh /tmp/weigg-qb-install.sh \
  --config-root=/host/path/to/qbittorrent/config \
  --dir=/config/weigg-qb-webui
```

List qB Docker candidates:

```sh
sh /tmp/weigg-qb-install.sh --list-containers
```

With multiple qBittorrent containers, the installer **refuses to guess**. Select one explicitly:

```sh
sh /tmp/weigg-qb-install.sh \
  --container=qbittorrent \
  --dir=/config/weigg-qb-webui
```

Optional safe config update:

```sh
sh /tmp/weigg-qb-install.sh --configure
```

Rollback:

```sh
sh /tmp/weigg-qb-install.sh --rollback
```

The installer backs up before replacement, rejects Docker overlay/rootfs template configs, validates `public/login.html` + `private/index.html`, and remembers the last destination.

## Windows installer

```powershell
.\install.ps1
```

Optional automatic qB configuration:

```powershell
.\install.ps1 -Configure
```

Custom destination:

```powershell
.\install.ps1 -Destination "D:\qBittorrent\WeiG-qB-WebUI"
```

Rollback:

```powershell
.\install.ps1 -Mode Rollback
```

## Development

Runtime remains plain HTML/CSS/JavaScript with no external runtime CDN/framework requirement.

```sh
npm test
```

CI now checks the v0.2.1 navigation/i18n/settings invariants, all runtime JavaScript modules, compatibility tokens, installer safety and no-external-runtime-asset rules.

Visual/UI changes must follow [`DESIGN.md`](./DESIGN.md). Engineering, compatibility, i18n and performance architecture are defined in [`docs/001.项目总方案.md`](./docs/001.%E9%A1%B9%E7%9B%AE%E6%80%BB%E6%96%B9%E6%A1%88.md).

## v0.2.1 stabilization status

`0.2.1` is the integrated Navigation + i18n + Settings UX baseline. Repository CI is green. Final compatibility certification still requires live regression of this exact build on Lab A (4.1.9.1) and Lab B (5.2.0); live issues discovered there remain release-blocking.

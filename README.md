# WeiG qB WebUI

A premium, modular and high-performance Alternate WebUI for qBittorrent.

Current version: **0.2.3**  
Compatibility floor: **qBittorrent 4.1.9**  
Compatibility target: **qBittorrent 4.1.x → current 5.x**, with capability-based forward compatibility.

## v0.2.3 — Legacy login diagnostics hotfix

The public login page now follows the qBittorrent 4.1.x form-encoded login contract more strictly and no longer reports every authentication failure as “Invalid username or password”.

Login outcomes are separated into:

```text
Ok.       → authenticated, reload into private WebUI
Fails.    → invalid username/password
HTTP 403  → qBittorrent temporary client/IP ban
other HTTP errors → reverse-proxy / Host / Origin / server rejection
network failure   → connection failure
```

This matters especially on qBittorrent 4.1.x, where repeated failed logins can temporarily ban the client. The login UI is maintained in English and Simplified Chinese, with English fallback for missing locale-specific diagnostic text.

## v0.2.2 — Nebula Spatial Console

v0.2.2 focuses on spatial hierarchy and information architecture instead of adding more flat controls.

### Spatial UI

The dark theme now uses explicit depth levels:

```text
Void → Base → Panel → Card → Raised → Floating
```

Search/Input/Select controls are visibly separated from their surrounding panel even before focus. Hover adds a restrained cool edge/glow; focus adds a clear blue ring. Topbar, Stats, Settings, dialogs and DataGrid containers use material separation, top highlights and soft shadows rather than uniform black surfaces.

The visual direction takes principles from precise premium dark interfaces while preserving WeiG's own identity: restrained hierarchy, floating chrome, premium dark materials, cool blue/violet accents, CSS starfield and interaction-only Nebula glow.

### Sidebar and filters

Desktop Sidebar is now intentionally compact and normally scrollbar-free.

Permanent Sidebar content:

```text
Torrent state
All / Downloading / Seeding / Completed / Paused / Active / Stalled / Error / Private-PT
```

High-cardinality filters no longer permanently consume Sidebar height. Tracker, Save Path, Category and Tags move into a horizontal **Filter Shelf** with searchable Floating Popovers:

```text
[ Tracker ▾ ] [ Save Path ▾ ] [ Category ▾ ] [ Tags ▾ ]
```

qBittorrent/WebAPI/compatibility details move to the bottom Status Dock and open in a compact connection popover.

### Settings cards

Every standard Settings card now follows one consistent vertical structure:

```text
Title
Description
Control
```

- title remains a primary single line where practical;
- description occupies the middle explanatory area;
- Input/Select/Number controls use full-width bottom placement;
- Switch controls sit at the bottom edge rather than floating beside the title;
- desktop Settings use a readable two-column grid; tablet/phone use one column.

### English + Chinese

English is the canonical source language. **English and Simplified Chinese are the maintained product languages.**

Resolution order:

```text
User language selection
→ Browser language
→ English fallback
```

qBittorrent terminology prefers official qBittorrent WebUI translations when available. WeiG-specific concepts are maintained by this project. Additional locale overlays may exist, but missing strings must fall back to English and never expose translation keys.

## Core v0.2 platform

- qBittorrent **4.1.9 compatibility floor** with capability-based support through current 5.x.
- Real regression targets: **4.1.9.1 / WebAPI 2.2.1** and **5.2.0**.
- `20 / 50 / 100 / 200` qB server page sizes using `limit` / `offset`.
- Virtual DOM windowing: API/cache item count never maps directly to mounted rows.
- Desktop DataGrid with sorting, resizable columns, show/hide, ordering and persistence.
- Mobile Torrent cards, touch controls, Drawer/Bottom navigation and Action Sheet behavior.
- Tracker privacy normalization removes query/fragment credentials before display/filter keys.
- Private/PT filtering uses exact API capability where available and explicit Tracker-domain heuristics on older qB versions.
- Torrent actions include start/resume, pause/stop, force start, recheck, reannounce, sequential mode, first/last piece priority, auto management, queue operations, rename, location, category, tags and limits where supported.
- Torrent Detail includes Overview, Files, Trackers, Peers and HTTP Sources.
- Metadata-driven Settings render only preferences exposed by the connected qB instance.
- Search / RSS / Logs are capability-aware and hidden when unsupported.
- Back/Home/Reload recovery, Reduced Motion and background-tab polling slowdown remain hard invariants.

## Compatibility model

Feature/UI code does not scatter qB main-version checks. Startup detects qBittorrent + WebAPI versions and creates a capability profile.

Important bridges include:

```text
qB 4.x            qB 5.x
pause / resume  ↔ stop / start
paused filter   ↔ stopped filter
```

Historical WebAPI anomalies stay inside the compatibility layer.

## Performance model

```text
qB API:       limit=200&offset=0
Data models:  up to 200 for the page
DOM:          viewport + overscan only
```

Whole-library Tracker/Path/PT indexing is fetched in bounded chunks and never rendered as thousands of hidden DOM rows.

## Tracker privacy

```text
https://tracker.m-team.cc/announce?credential=SECRET
→
https://tracker.m-team.cc/announce
```

Raw Tracker values are used only internally when a qB API operation genuinely requires them.

## Linux installer

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh
sh /tmp/weigg-qb-install.sh
```

Known Docker `/config` root:

```sh
sh /tmp/weigg-qb-install.sh \
  --config-root=/host/path/to/qbittorrent/config \
  --dir=/config/weigg-qb-webui
```

List qB Docker candidates:

```sh
sh /tmp/weigg-qb-install.sh --list-containers
```

When multiple qBittorrent containers exist, the installer refuses to guess. Select a target with `--container=` or `--config-root=`.

Rollback:

```sh
sh /tmp/weigg-qb-install.sh --rollback
```

## Windows installer

```powershell
.\install.ps1
```

Optional configuration:

```powershell
.\install.ps1 -Configure
```

Rollback:

```powershell
.\install.ps1 -Mode Rollback
```

## Development

Runtime is plain HTML/CSS/JavaScript with no external runtime CDN/framework dependency.

```sh
npm test
```

Documentation authority:

- [`DESIGN.md`](./DESIGN.md) — visual, typography, spatial, navigation, i18n and Settings design authority.
- [`docs/001.项目总方案.md`](./docs/001.%E9%A1%B9%E7%9B%AE%E6%80%BB%E6%96%B9%E6%A1%88.md) — product plan and hard engineering rules.
- [`docs/002.兼容与实现状态.md`](./docs/002.%E5%85%BC%E5%AE%B9%E4%B8%8E%E5%AE%9E%E7%8E%B0%E7%8A%B6%E6%80%81.md) — compatibility and current implementation status.
- [`docs/003.项目架构.md`](./docs/003.%E9%A1%B9%E7%9B%AE%E6%9E%B6%E6%9E%84.md) — repository tree, runtime layers and module ownership.

## Stabilization status

`0.2.3` is the current integrated baseline: v0.2.2 Spatial UI plus the legacy-login diagnostics hotfix. Repository CI validates JavaScript syntax, login outcome handling, spatial UI invariants, pagination/VirtualList architecture, compatibility tokens, i18n/Settings metadata and installer safety. Final release certification still requires live regression on both real endpoints: qBittorrent 4.1.9.1 and qBittorrent 5.2.0.

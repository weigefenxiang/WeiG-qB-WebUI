# WeiG qB WebUI

A premium, modular and high-performance Alternate WebUI for qBittorrent.

Current version: **0.3.1**  
Compatibility floor: **qBittorrent 4.1.9**  
Compatibility target: **qBittorrent 4.1.x → current 5.x**, using capability-based progressive enhancement.

## v0.3.1 — Polling scroll stability hotfix

Real qBittorrent 4.1.9 testing exposed one remaining VirtualList race: `app.js` clears the list container before constructing the next VirtualList. On some browsers the old scroll listener receives the transient programmatic `scrollTop = 0` caused by DOM teardown and overwrites the remembered user position immediately before the replacement list restores it.

v0.3.1 hardens the VirtualList scroll handler so teardown-generated scroll events are ignored whenever the handler's own spacer is no longer connected to the active container. Normal user scroll events still update `__weiggVirtualScrollTop`.

The visible `Refresh HH:MM:SS` readout has also been removed from the Transfer Dock. Polling continues normally; the timestamp was redundant operational noise and is not used as application state.

Expected behavior:

```text
Automatic polling / manual Refresh → preserve current viewport
Filter / facet / page / page-size / search context change → reset to top
```

## v0.3.0 — Stable Virtual UI + Transfer Control

v0.3.0 focuses on interaction stability and daily-use completeness rather than adding a large number of disconnected buttons.

### Scroll position is user state

The Torrent VirtualList preserves the user's scroll position across automatic polling and rerenders.

Deliberate context changes still reset the main list to the top:

```text
Filter / Tracker / Save Path / Category / Tag
Page change
Page-size change
Torrent search change
```

Manual refresh and background polling preserve the current viewport.

### Compact zero-result views

All zero-result Torrent states share one compact empty layout. `Private / PT`, `Error`, `Downloading`, `Seeding`, `Paused`, Tracker/Category/Tag/Path filters and other empty views no longer reserve a full-height blank DataGrid.

The Filter Shelf and global transfer/network status remain available while the empty table body and meaningless pager collapse.

### Interactive Transfer Control Dock

The desktop Status Dock is a centered operational control surface.

```text
↓ current download
↑ current upload
ALT speed mode
connection state
Torrent count
Transfer / session
```

Click the download or upload speed to change the **global** rate limit. Cross-version endpoints are deliberately the long-lived qB transfer APIs:

```text
transfer/downloadLimit
transfer/setDownloadLimit
transfer/uploadLimit
transfer/setUploadLimit
transfer/speedLimitsMode
transfer/toggleSpeedLimitsMode
```

This keeps global speed control available at the qBittorrent 4.1.9 compatibility floor as well as on modern 5.x.

### Session statistics + Transfer Graph

The Transfer surface reuses the normal transfer polling stream and keeps a bounded in-browser ring buffer instead of starting a second high-frequency poller.

It exposes:

- current download/upload history;
- session downloaded/uploaded bytes;
- global download/upload limits;
- DHT nodes / peer connections;
- free disk space when supplied through `sync/maindata`;
- 1 / 5 / 15 minute graph windows.

The graph uses a native Canvas and a maximum 900-point ring buffer. No chart framework or runtime CDN is required.

### Multi-selection

Existing `Ctrl/Cmd+A`, Escape and Delete behavior remains. v0.3 also adds Ctrl/Cmd-click and Shift-click selection behavior for currently rendered Torrent rows. Virtualized/off-screen selection is never implemented by mounting hidden rows.

## Compatibility matrix

Automated compatibility fixtures exercise three tiers:

| Tier | Fixture | Expected behavior |
| --- | --- | --- |
| Legacy floor | 4.1.9.1 / WebAPI 2.2.1 | resume/pause, global limits, alt-speed, no Tags/private flag |
| Mature 4.x | 4.6.x / WebAPI 2.8.3 | Tags/filter capabilities, still no exact private flag |
| Modern target | 5.2.0 / WebAPI 2.14.1 | start/stop, Tags, private flag, modern capability foundations |

Static fixtures are not a substitute for real-server certification. The release-blocking live targets remain qBittorrent **4.1.9.1** and **5.2.0**.

## VueTorrent gap review

VueTorrent is a useful functional reference, but its current project baseline targets qBittorrent 4.4+, while WeiG keeps a 4.1.9 floor. Features therefore pass through the WeiG Capability layer instead of being copied directly.

v0.3 closes or prepares several useful gaps:

- session statistics — implemented;
- transfer graph — implemented;
- global/alternative speed controls — implemented;
- richer multi-selection — implemented for rendered rows;
- Torrent Creator — QBClient capability/API foundation for supported modern qB versions;
- Cookie Manager — QBClient capability/API foundation for WebAPI versions that expose cookies.

Future candidates include richer RSS rules/articles, Search plugin management, full Torrent Creator/Cookie Manager product pages, configurable Dashboard fields, PWA installation and magnet-handler integration.

## Nebula Spatial Console

The visual system remains:

```text
Void → Base → Panel → Card → Raised → Floating
```

Desktop Topbar owns application navigation. Sidebar owns low-cardinality Torrent state filters. Tracker / Save Path / Category / Tags use the searchable Filter Shelf. Connection details live in the Status Dock. Settings follow **Title → Description → Control** and default to a readable two-column desktop grid.

## Languages

English is the canonical source language. **English and Simplified Chinese are maintained product languages.**

```text
Explicit user language
→ Browser locale
→ English fallback
```

qBittorrent terminology prefers official qB WebUI translations when available. Feature code must not branch on language, and missing locale strings must never expose raw translation keys.

## Core platform

- qBittorrent **4.1.9 compatibility floor** through current 5.x via Capability detection.
- `20 / 50 / 100 / 200` server page sizes using `limit` / `offset`.
- Virtualized Torrent/Files/Peers/Trackers/Logs lists.
- Data count is never treated as DOM count.
- Desktop DataGrid with sorting, resizable/configurable columns and persisted widths/order.
- Mobile Torrent cards, touch navigation and action surfaces.
- Tracker display/filter normalization strips query/fragment credentials.
- Private/PT uses exact private metadata when available and explicit Tracker-domain rules on old qB.
- Torrent actions, detail Files/Trackers/Peers/HTTP Sources, metadata-driven Settings, Search/RSS/Logs capability gating.
- Back/Home/Reload recovery and Reduced Motion remain hard invariants.

## Compatibility boundary

Feature/UI code must not scatter qB version checks.

```text
qB API
  ↓
QBClient + Capability
  ↓
stable application semantics
  ↓
Feature / UI
```

Important bridges include:

```text
qB 4.x          qB 5.x
resume/pause ↔ start/stop
paused       ↔ stopped
```

Historical API exceptions remain inside `qb-client.js`.

## Performance model

```text
API/cache page
      ↓
VirtualList
      ↓
viewport + overscan DOM only
```

Whole-library Tracker/Path/PT catalogs are built in bounded data batches and never rendered as thousands of hidden rows. Transfer Graph samples are bounded separately and do not create Torrent DOM.

## Tracker privacy

```text
https://tracker.example/announce?passkey=SECRET#fragment
→
https://tracker.example/announce
```

Raw Tracker values are retained only where a qB API operation genuinely requires them.

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

List candidates:

```sh
sh /tmp/weigg-qb-install.sh --list-containers
```

Rollback:

```sh
sh /tmp/weigg-qb-install.sh --rollback
```

The installer refuses to guess when multiple qB containers are detected. Normal install/update does not modify WebUI credentials.

## Windows installer

```powershell
.\install.ps1
```

Optional qB Alternate-WebUI configuration:

```powershell
.\install.ps1 -Configure
```

Rollback:

```powershell
.\install.ps1 -Mode Rollback
```

## Development and tests

Runtime is plain HTML/CSS/JavaScript without a runtime application framework.

```sh
npm test
```

The suite includes syntax/smoke checks plus `tests/compat-v030.mjs` for 4.1.9.1 / mature 4.x / 5.2.0 API semantics.

Documentation authority:

- `DESIGN.md` — visual, interaction, typography, navigation, i18n, empty-state and Transfer Dock rules.
- `docs/001.项目总方案.md` — product plan and engineering invariants.
- `docs/002.兼容与实现状态.md` — compatibility matrix and current live/automated test state.
- `docs/003.项目架构.md` — repository tree, runtime layers and ownership boundaries.

## Certification status

`0.3.1` is the current integrated baseline. Repository CI and compatibility fixtures can validate code contracts, but stable release certification still requires live regression on both release-blocking endpoints. A fixture PASS must never be reported as a 5.2.0 live PASS.

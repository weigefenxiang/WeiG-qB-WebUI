# WeiG qB WebUI

A premium, modular and high-performance Alternate WebUI for qBittorrent.

Current version: **0.3.5**  
Compatibility floor: **qBittorrent 4.1.9**  
Compatibility target: **qBittorrent 4.1.x → current 5.x**, using capability-based progressive enhancement.

## v0.3.5 — Canonical Settings UI + Git SHA cache identity

v0.3.5 removes the standalone Alternative WebUI visual subsystem introduced in v0.3.4. Alternative WebUI controls and install metadata now reuse the same canonical `setting-card` / `settings-row` components as the rest of **Settings → Web UI**. There is no feature-local card grid or feature-local Settings CSS.

The UI primitive audit covers the existing runtime layers and establishes one owner per semantic surface:

```text
Settings        → SettingCard / settings-control
Torrent data    → DataGrid / VirtualList
Logs            → DataPage / DataPanel / VirtualList
Dialogs         → dialog + surface--modal
Status          → status-pill / status dock
```

The v0.3.5 browser gate exercises qBittorrent **4.1.9.1 / 4.6.7 / 5.2.0** fixtures at **390×844 / 1366×768 / 1920×1080** and checks that Alternative WebUI controls use the same card geometry, responsive columns, title/description/control order and overflow rules as normal qB settings.

v0.3.5 also replaces hand-maintained `?v=0.x.y` resource revisions with a deployment Git SHA contract:

```text
HTML                    → no-store / no-cache metadata
HTML build identity     → <meta name="weigg-build-sha" ...>
CSS / JS URL            → ?v=<40-character Git SHA>
Lazy runtime CSS / JS   → same Git SHA through buildAssetUrl()
Installed identity      → VERSION + GIT_SHA + weigg-install.json.gitSha
```

Linux and Windows installers resolve or read the exact source SHA, inject it into the deployed payload, and refuse release payloads that cannot provide a valid `GIT_SHA`. Release packaging stamps `${GITHUB_SHA}` before creating the archive. This means a browser may safely cache a SHA-addressed static asset while a new deployment automatically receives a different URL. Reverse proxies/CDNs must preserve qBittorrent's HTML no-store behavior; production header verification remains a deployment test, not something static HTML can force through an intermediary.

## v0.3.4 — Alternative WebUI Settings + Install Metadata

v0.3.4 makes qBittorrent's own Alternative WebUI state visible and controllable from **Settings → Web UI** instead of silently omitting it.

When qBittorrent actually returns the preferences, WeiG shows:

```text
Use Alternative WebUI
qBittorrent WebUI path
VPS / host path (when recorded by the installer)
WeiG installed version
container name (Docker installs)
install/update timestamp
```

The compatibility rule is data-driven rather than major-version-driven: `alternative_webui_enabled` and `alternative_webui_path` are shown whenever they are present in `app/preferences`. This keeps the feature usable on the supported qBittorrent **4.1.9.1 / WebAPI 2.2.1** floor as well as **5.2.0 / WebAPI 2.15.1**.

Docker paths are deliberately separated:

```text
VPS / host path
/root/qbittorrent3/config/weigg-qb-webui
        ↓ mounted as /config
qBittorrent-visible path
/config/weigg-qb-webui
```

Only the qBittorrent-visible path belongs in `alternative_webui_path`. The browser cannot infer the Docker host path from WebAPI, so Linux/Windows installers write authenticated deployment metadata to `private/weigg-install.json`.

Safety behavior:

- writing a known VPS host path into the Docker qB path field is blocked;
- changing the Alternative WebUI path requires confirmation because a wrong path can make the UI unreachable;
- disabling Alternative WebUI requires an explicit confirmation;
- after a successful disable, WeiG redirects to `/` so qBittorrent's built-in WebUI can take over;
- the two Alternative WebUI preferences are hidden from the generic Advanced list once the dedicated settings surface owns them.

## v0.3.3 — Cross-version Logs browser regression gate

v0.3.3 strengthens the v0.3.2 Logs work with an actual Chromium/Playwright browser regression instead of relying only on API-contract fixtures and JavaScript syntax checks.

The browser gate serves the real `webui/private` runtime against two deterministic qB WebAPI fixtures:

```text
qBittorrent 4.1.9.1 / WebAPI 2.2.1 → legacy millisecond log timestamps
qBittorrent 5.2.0   / WebAPI 2.15.1 → modern second log timestamps
```

Primary viewport coverage:

```text
390 × 844   mobile
1366 × 768  compact desktop
1920 × 1080 desktop
```

The gate validates the user-visible Logs route through a real browser:

- cross-version timestamp normalization reaches the same valid time range;
- adaptive DataPanel has no horizontal overflow and keeps useful height;
- **Auto / Compact / Max** sizing changes the real layout as intended;
- local log search narrows results correctly;
- severity filtering leaves only the selected semantic level;
- `last_known_id` incremental polling appends new rows;
- **Follow latest OFF** preserves a manually selected viewport while new rows arrive;
- browser console/page errors are treated as failures.

This is a browser fixture certification layer, not a claim that a remote production qB instance has been interactively tested. Real-server certification remains separate and must never be inferred from fixture PASS.

## v0.3.2 — Cross-version Logs + Adaptive DataPanel

v0.3.2 fixes a compatibility mistake in the Logs gate and promotes Logs from a fixed-height utility box to a first-class adaptive data page.

- qBittorrent **4.1.9.1 / WebAPI 2.2.1** Logs are no longer hidden by the incorrect `WebAPI >= 2.3.0` gate.
- `QBClient.logs()` / `peerLogs()` normalize legacy millisecond timestamps and modern second timestamps to one stable seconds contract.
- Logs use an independent VirtualList with incremental `last_known_id` polling, local search, semantic level filters, Follow latest and a bounded 5000-row in-browser buffer.
- The Logs DataPanel supports **Auto / Compact / Max** sizing. Auto consumes the remaining workspace instead of stopping at `max-height: 62vh`.
- The design rules were reviewed against `VoltAgent/awesome-design-md` principles: reusable tokens/components, restrained depth, explicit interaction states and responsive data surfaces rather than feature-local visual systems.

The compatibility model is now explicit:

```text
Native       qB exposes the capability directly
Compatible   QBClient translates old/new API vocabulary or data format
Enhanced     WeiG JS derives safe convenience behavior from existing data
Unavailable  backend data/write capability does not exist; do not fabricate it
```

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
| Legacy floor | 4.1.9.1 / WebAPI 2.2.1 | resume/pause, global limits, alt-speed, Logs, Alternative WebUI prefs when returned, no Tags/private flag |
| Mature 4.x | 4.6.x / WebAPI 2.8.3 | Tags/filter capabilities, Logs, Alternative WebUI prefs, still no exact private flag |
| Modern target | 5.2.0 / WebAPI 2.15.1 | start/stop, Tags, private flag, Logs, Alternative WebUI prefs, modern capability foundations |

Logs are native across the supported qB range; WeiG adds cross-version timestamp normalization plus search/filter/follow/adaptive-layout enhancements. Alternative WebUI settings are exposed from the real Preferences payload instead of guessed from qB major version. Static/browser fixtures are not substitutes for real-server certification. The release-blocking live targets remain qBittorrent **4.1.9.1** and **5.2.0**.

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

Primary data-heavy pages should converge on the canonical DataPage/DataPanel pattern. Logs is the first v0.3.2 implementation: toolbar + table header + virtual viewport + compact empty/error/status surfaces, with the data area owning the remaining workspace height.

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
- Logs use a separate route-local VirtualList and incremental stream so they do not overwrite Torrent viewport state.
- Alternative WebUI enabled/path preferences reuse canonical SettingCards when the backend returns them.
- Installed payload contains `VERSION` and `GIT_SHA`; installer metadata exposes Git SHA, qB/container path and VPS/host path without pretending WebAPI knows Docker host mounts.
- HTML is treated as a no-store bootstrap; local CSS/JS identity is the deployment Git SHA rather than the product version.
- Back/Home/Reload recovery and Reduced Motion remain hard invariants.

## Compatibility boundary

Feature/UI code must not scatter qB version checks.

```text
qB API
  ↓
QBClient + Capability + normalization
  ↓
stable application semantics
  ↓
WeiG enhancement
  ↓
Feature / UI
```

Important bridges include:

```text
qB 4.x          qB 5.x
resume/pause ↔ start/stop
paused       ↔ stopped
legacy log ms → normalized seconds ← modern log seconds
```

Historical API exceptions remain inside `qb-client.js`. Preference-owned features such as Alternative WebUI are gated by the actual Preferences keys returned by the server.

## Performance model

```text
API/cache page
      ↓
VirtualList
      ↓
viewport + overscan DOM only
```

Whole-library Tracker/Path/PT catalogs are built in bounded data batches and never rendered as thousands of hidden rows. Transfer Graph samples are bounded separately and do not create Torrent DOM. Logs retain at most 5000 main-log rows in browser memory while only the viewport + overscan are mounted.

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

After v0.3.5 installation/update, deployment identity is directly available:

```sh
cat /host/path/to/qbittorrent/config/weigg-qb-webui/VERSION
cat /host/path/to/qbittorrent/config/weigg-qb-webui/GIT_SHA
cat /host/path/to/qbittorrent/config/weigg-qb-webui/private/weigg-install.json
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

The static suite includes syntax/smoke checks, `tests/compat-v030.mjs` for 4.1.9.1 / mature 4.x / 5.2.0 API semantics, `tests/log-compat-v032.mjs` for Logs capability/timestamp/incremental behavior, `tests/settings-v034.mjs` for Alternative WebUI/settings/install-metadata contracts, and `tests/cache-contract-v035.mjs` for HTML no-store + Git SHA asset identity.

CI additionally runs two headless Chromium gates:

```text
tests/browser-logs-v033.mjs
tests/browser-settings-v034.mjs
```

The v0.3.5 settings browser gate exercises the actual WebUI runtime with qB 4.1.9.1, qB 4.6.7 and qB 5.2.0 fixtures at three viewports. It verifies canonical SettingCard geometry, `/config/...` path writes, known host-path rejection, disable writes, Advanced duplicate suppression, install metadata including Git SHA, and browser console/page error cleanliness.

Documentation authority:

- `DESIGN.md` — visual, interaction, typography, navigation, i18n, empty-state, Transfer Dock, DataPanel and canonical UI primitive rules.
- `docs/001.项目总方案.md` — product plan and engineering invariants.
- `docs/002.兼容与实现状态.md` — compatibility matrix and current live/automated status.
- `docs/003.项目架构.md` — repository tree, runtime layers and ownership boundaries.
- `docs/004.UI与缓存契约.md` — UI primitive audit and HTML/Git-SHA cache contract.

## Certification status

`0.3.5` unifies Alternative WebUI with the canonical Settings component system and adds deterministic Git-SHA asset identity on top of the v0.3.4 compatibility behavior. Repository CI, API-contract fixtures and browser fixtures can certify deterministic code/UI behavior, but stable real-server certification still requires interactive regression on the release-blocking qBittorrent **4.1.9.1** and **5.2.0** instances. A browser fixture PASS must never be reported as a production/live PASS.

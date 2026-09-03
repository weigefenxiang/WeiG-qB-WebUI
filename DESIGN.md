# WeiG qB WebUI — Design System

Version: **2.4**  
Status: **v0.3.7 Semantic Ownership 3.7**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This file is the single visual, interaction and first-party runtime ownership authority. New work extends these rules; it never creates a parallel owner, hidden compatibility runtime or post-render repair layer.

## 1. Non-negotiable rules

1. One semantic purpose has one canonical component/controller/layout/data owner.
2. Feature code does not invent local Button/Select/Card/Badge/Dialog/Popover/SettingRow systems when a canonical primitive exists.
3. All first-party repository files use stable responsibility-based filenames, never WeiG release/version suffixes or qB-version filenames.
4. Git history is the archive. Historical WeiG runtime, tests and deployment tools are deleted, not aliased or preserved for compatibility.
5. Source owners emit final DOM. First-party runtime must not use `MutationObserver` to reclaim, move, wrap, upgrade or repair UI.
6. Presentation modules (`responsive`, `spatial`, `layout`, `polish`, `ux`) do not own qB clients, API polling or business state.
7. Runtime coordination uses explicit semantic lifecycle events, not DOM observation.
8. Settings has one source renderer and one geometry owner.
9. Torrent selection has one `W.Selection` state owner and one `ActionRegistry`.
10. Transfer speed samples and qB telemetry metadata have one `W.TransferRuntime` owner.
11. Private/PT semantics have one `W.TorrentSemantics` owner; UI never re-derives privacy locally.
12. Route URL state belongs to `W.Router`; Route Frame presentation is committed atomically by `app.js` only.
13. qB endpoint, capability and native-unit differences are normalized in `QBClient` before presentation.
14. Authentication actions use one `SessionController`; logout is accepted only after server-side invalidation is verified.
15. Browser Back/BFCache must never reveal stale private UI after logout.
16. Mobile is adaptive presentation, not a second business application.
17. Data count is not DOM count; large collections remain virtualized.
18. Interactive touch targets are at least 44×44 CSS px where touch is primary.
19. Reduced Motion is mandatory.
20. `VERSION` is product identity; exact Git SHA is code/cache identity; tag/Release is distribution identity.
21. README is user-facing. Architecture, test and release contracts live here and in `docs/`.
22. Shared control/dialog skin belongs to `css/ui.css`; feature CSS may provide geometry variables but must not duplicate primitive skin.
23. Dialog shells do not become scroll containers merely because the viewport is narrow; only content regions that actually overflow may scroll.
24. Native Select explicitly follows the resolved light/dark theme through canonical tokens and `color-scheme`.
25. A retired canonical API/capability hook must be removed from every caller; unreachable compatibility code is still runtime.
26. Torrent facet state is semantic state; no hidden nav tree or visible DOM copy may act as its database.
27. One telemetry field has one authoritative presentation input; unchanged formatted telemetry does not cause DOM writes.
28. Routine polling success is silent. `Refreshed / 已刷新` and refresh timestamps never occupy durable UI.
29. Desktop/mobile variants may move or separately render one semantic state only through one presentation owner; they may not create independent business state or polling paths.
30. Torrent Topbar is single-row on desktop; Search is the primary flexible item and shrinks before navigation/action controls wrap.
31. Persistent global state uses the lowest-cost persistent surface and must not displace primary data merely for duplicate visibility.
32. Passive duplicate product identity and redundant manual refresh do not occupy permanent Topbar space.
33. qBittorrent/WebAPI version facts that define current capability boundaries remain explicit; repository filename neutrality must never erase messages such as `qBittorrent 5.0.0+` or `WebAPI 2.3.0+`.

### COMPAT-DEGRADE-001 — honest capability degradation

If an older upstream lacks the authoritative/batch capability required by a feature, the default is explicit capability degradation, not expensive emulation. A costly fallback is allowed only after explicit product approval and performance evaluation.

### PERF-COMPAT-001 — no collection N→N API fallback

A collection/list feature must not default to `N items -> N HTTP requests`. Before any fallback enters list/filter/refresh, evaluate at least 100, 1000 and 5000 items. Prefer authoritative fields, batch endpoints, existing snapshots or capability degradation.

### PROGRESSIVE-DATA-001 — aggregate data never blocks primary content

Current-page data renders as soon as available. Aggregate count/index/enrichment is background work; unknown total uses bounded loading/error state and never a long-lived `?`.

### TIMESERIES-001 — bounded history

Realtime chart history is bounded and may use multi-resolution aggregation. Longer chart windows do not create more network polling or unbounded raw samples.

### INTERACTION-TEST-001 — test the user action

Critical interaction tests execute the actual action and assert state transition plus visible/normalized result. Element existence alone is not PASS.

### CONTROL-SKIN-001 — one primitive skin owner

`W.Components.selectControl()` owns Select behavior/presentation mode; `css/ui.css` owns floating/native Select skin. Feature CSS may provide width/height custom properties only.

### DIALOG-SCROLL-001 — shell is not the scroll owner

`dialog.dialog` is a bounded top-layer shell with `overflow:hidden`. Only genuinely overflowing body/form/action-list regions scroll internally.

### NATIVE-THEME-001 — native controls follow resolved theme

Canonical native Select, options and optgroups explicitly consume resolved light/dark semantic tokens and `color-scheme`.

### OWNER-RETIRE-001 — dormant compatibility code is still runtime

When a canonical owner replaces another implementation, old call sites, shims, false branches, CSS selectors and test expectations leave runtime in the same change. Git history is the archive.

### CURRENT-ONLY-001 — dev contains only the current WeiG architecture

Historical WeiG release runtime, tests, deployment scripts and compatibility aliases do not remain in the current tree. Historical recovery uses Git history, tags and Releases. Current qBittorrent/WebAPI compatibility behavior is not historical baggage and remains tested.

### FILE-NAMING-001 — filenames describe responsibility, not versions

First-party runtime, test, deployment and documentation filenames are semantic and stable. Names such as `live-v037.sh`, `browser-ui-v036.mjs`, `platform-contract-v037.mjs` and `live-qb52.sh` are prohibited. Product/qB/WebAPI versions belong in `VERSION`, exact-SHA evidence, capability text, fixtures and release metadata.

### TEST-CURRENT-001 — tests validate the current product contract

Tests do not preserve old WeiG release architecture. If a behavior remains a current requirement, it is asserted by a current canonical test; old release-specific test files are deleted rather than renamed or wrapped.

### FACET-OWNER-001 — facet state/presentation are singular

Facet business state belongs to `app.js / W.LibraryController`; visible composition belongs to `W.SpatialRuntime`; control behavior belongs to `W.Components.selectControl()`; skin belongs to `css/ui.css`. Retired `filter-shelf`, feature-local facet popover/search and hidden source nav trees do not coexist with canonical controls.

### PRESENTATION-STATE-001 — DOM is not application state

Adaptive presentation consumes semantic state/events/controllers, never another UI node's text or hidden DOM as authoritative state.

### TELEMETRY-PAINT-001 — one input, idempotent paint

DHT/Peers consumes the `W.TransferRuntime` `sync/maindata` lifecycle. `getTransferInfo()` does not also paint DHT/Peers. If formatted DHT/Peers has not changed, renderer performs no DOM mutation.

### STATUS-NOISE-001 — routine success is silent

Background success never creates persistent `Refreshed / 已刷新`, timestamp or equivalent heartbeat copy. Actionable errors remain visible; explicit operation success may use bounded Toast.

### STATUS-DEDUP-001 — durable state is not duplicated inside one viewport

Desktop Connection belongs to the Statusbar. Mobile Connection belongs to the Mobile Network Summary. Both consume the same semantic lifecycle and neither owns polling. The same durable status is not repeated across multiple permanent surfaces in the same viewport.

### STATUS-PLACEMENT-001 — durable state uses the cheapest persistent surface

Persistent global telemetry must not consume primary workspace height when an existing Statusbar can express it without harming the data workflow.

### ADAPTIVE-STATUS-001 — adaptive placement is not a second state owner

Desktop and Mobile may place one semantic status differently, but they must not create independent state, API clients, polling loops or reconciliation code.

### LIVE-INDICATOR-001 — online animation is presentation only

Connection animation consumes existing semantic `connection_status`; it never creates a timer or network request. Connected uses success semantics, firewalled warning semantics, disconnected/error danger semantics.

### MOTION-STATUS-001 — status motion obeys Reduced Motion

Online glow respects both system `prefers-reduced-motion` and WeiG `data-motion="reduced"`. Reduced Motion uses a static semantic glow.

### HEADER-UTILITY-001 — permanent Header space is purposeful

Topbar permanent space is reserved for identity, navigation, primary search and actionable global utilities. Passive duplicate qB product identity and redundant manual Refresh are retired together with their DOM/caller/CSS/tests.

## 2. Visual theme

WeiG uses **Nebula Spatial Console**: dark, precise, dense and restrained. The engineering discipline follows `awesome-design-md`: explicit semantic tokens, hierarchy, reusable primitives, documented responsive behavior, state contracts and known failure modes rather than screenshot-specific patches.

```text
Void      deep-space background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      compact information surface
Raised    toolbar / active input / detail summary
Floating  select / menu / dialog
```

Blue/cyan = ordinary interaction; purple = ALT/secondary selected semantics; success/warning/danger = status semantics. Depth comes from surface/border contrast, not permanent glow.

## 3. Canonical owner map

```text
qB endpoint/capability/native units     W.QBClient
Router URL/hash state                   W.Router
Route Frame presentation                app.js / W.AppState
Torrent query/catalog/page              app.js / W.AppState
Torrent facet state/facade              W.LibraryController
Torrent facet presentation              W.SpatialRuntime
Settings DOM/save                       W.SettingsRenderer / W.SettingsState
Select behavior/presentation mode       W.Components.selectControl
Shared Select visual skin               css/ui.css
Shared Dialog visual/scroll skin        css/ui.css
Torrent semantics                       W.TorrentSemantics
Torrent selection                       W.Selection
Torrent actions                         W.Selection.actions / ActionRegistry
Transfer samples + telemetry            W.TransferRuntime
Transfer dialogs/rate editor            W.Transfer
Connection semantic publisher           existing app transfer cycle -> weigg:status-state
Connection adaptive presentation        W.MobileAdaptive
Responsive placement / row height       W.MobileAdaptive
DataGrid/dialog behavior                W.LayoutRuntime
Visual polish                           W.PolishRuntime
Runtime translation/context text        ux.js
Brand/logo/favicon/motion               W.Brand + W.AmbientMark
Header utilities                        source DOM + header.js
Session/logout/BFCache                  W.SessionController / SessionGate
Torrent progress motion                 css/progress.css
Non-Settings shell geometry             css/layout.css
```

Owner names are semantic. Do not create version-labelled owners such as `TransferV038`, second Route controllers, feature-local dropdown/dialog systems, `DesktopConnectionController` or `MobileConnectionController`.

## 4. Explicit runtime lifecycle

```text
app.js
  weigg:library-state
  weigg:status-state
  weigg:route-state

settings.js
  weigg:settings-render

transfer.js / W.TransferRuntime
  weigg:transfer
  weigg:maindata

shared
  weigg:languagechange
  weigg:configchange
```

Forbidden first-party architecture: `MutationObserver` repair/reclaim, observer-based Select upgrade, hidden versioned loader, presentation module API polling, permanent setTimeout repair loops, old+new owners loaded together, dormant retired API callers, hidden presentation DOM used as semantic storage.

## 5. Stable runtime assets

Active first-party filenames are responsibility-based (`app.js`, `layout.css`, `settings.js`, `transfer.js`, `responsive.js`, `spatial.js`, `ui.css`, etc.). Tests, deployment scripts and docs follow the same rule. No active `*-vNNN.css/js`, version-labelled test/deploy file, alias/shim after migration or CSS correction layer over obsolete owners. Cache identity = stable semantic path + exact deployment SHA.

## 6. Canonical controls/dialogs

Visible Selects are explicitly created by `W.Components.selectControl()`. Floating mode serves ordinary page/facet/settings controls; `native:true` serves modal/top-layer reliability. Both expose the same semantic API and share `css/ui.css` skin.

Dialogs use one canonical shell:

```text
shell        bounded top layer, overflow hidden
head         intrinsic
body/form    internal scroll only on real overflow
actions      intrinsic / bounded list scroll if required
```

## 7. Route Frame

`W.Router` owns URL/hash. `app.js` alone commits active View, Top/Mobile Nav state, Torrent Sidebar visibility, workspace route scope, Back, drawer close and `weigg:route-state`. Settings/UX/Spatial cannot intercept App route presentation.

## 8. Torrent selection / capability

`W.Selection` owns selected hashes and all selection semantics. Title opens detail; checkbox/selection hit selects; right-click/long-press/More use the same ActionRegistry; touch target >=44×44.

qB5 Private uses authoritative metadata. qB4 Private/PT remains visible with `5+`; click -> shared capability dialog, no filter mutation, no tracker scan. Tags remains visible on unsupported instances and degrades honestly at WebAPI 2.3.0 via canonical Select `onOpen` guard.

## 9. Progressive library

Page request uses `pageSize+1`; first page renders immediately; catalog/index enriches later. Initial page label uses spinner, resolved label uses exact total, failure uses `!`, never `?`.

## 10. Torrent workspace geometry

`css/layout.css` is the final non-Settings geometry owner.

Desktop Topbar:

```text
WeiG qB | Nav | flexible Search | + Add | Theme | utilities
```

No qB passive product badge. No manual Refresh. Automatic polling remains.

Desktop Sidebar:

```text
Torrent state filters
Private / PT [5+ when unsupported]
canonical Tracker Select
canonical Save Path Select
canonical Category Select
canonical Tags Select
```

Desktop Workspace:

```text
ListView
└─ TorrentPanel flex:1
   ├─ GridToolbar: page / columns / Start / Pause / More / Delete / Expand
   ├─ ColumnHeader
   ├─ TorrentList flex:1 internal scroll
   └─ Pager
```

The former four-card Stats row is **Mobile Summary only**. Desktop does not reserve its height/margin. Action order is `Start -> Pause -> More -> Delete -> Expand`.

Mobile uses the same application state, Facet host and Selection toolbar. It retains the compact Download/Upload/Network/Torrent summary and hides Desktop Statusbar.

## 11. Transfer telemetry / Connection

`W.TransferRuntime` owns live samples plus `sync/maindata` metadata. Raw samples max 900; minute buckets max 720; chart windows through 12h. Long windows do not increase polling.

DHT/Peers:

```text
sync/maindata -> TransferRuntime -> weigg:maindata -> app metadata renderer
```

Connection:

```text
existing getTransferInfo connection_status
-> app emits weigg:status-state
-> W.MobileAdaptive presentation
```

`loadTransfer()` owns the existing transfer request cycle and speed/status emission, but does not directly own Desktop/Mobile Connection DOM. `W.MobileAdaptive` owns presentation only and creates no qB client/timer.

State semantics:

```text
connected      success   Connected / 已连接
firewalled     warning   Network limited / 网络受限
disconnected   danger    Disconnected / 未连接
error          danger    Unavailable / 异常
```

## 12. Transfer rate-unit contract

Canonical rate = B/s. NORMAL qB endpoint already B/s. ALT preferences are KiB/s and normalize at QBClient boundary (`read ×1024`, `write ÷1024`). Rate UI offers Auto/KiB/s/MiB/s/GiB/s and loads authoritative limits before `showModal()`.

## 13. Desktop Statusbar

Named areas:

```text
"torrent storage transfer connection message"
```

Persistent state = Torrent count + Free space + Transfer capsule + Connection. `message` is transient/actionable. `Refreshed / 已刷新` and refresh timestamp never return.

Connected uses a restrained success-green pulse; Light mode reduces glow intensity. Firewalled uses warning; disconnected/error danger. Reduced Motion disables the pulse and keeps static semantic glow.

## 14. Session / Progress

Verified logout: `SessionController.logout -> auth/logout -> protected probe -> invalid session required`. Back/BFCache fail-closed.

`css/progress.css` remains the only Torrent progress motion owner. 100% stops decorative motion. System and WeiG Reduced Motion disable animation.

## 15. Systemic failure modes

```text
1. old-version feature simulated with N per-item requests
2. route presentation split across modules
3. obsolete fixed height plus adaptive override
4. modal trigger/menu split across top-layer boundary
5. interaction test checks existence but not action
6. long chart window retains unbounded raw samples
7. aggregate metadata blocks primary page
8. qB native units leak into presentation
9. compatibility/polish code hides a second semantic owner
10. generic dialog shell and feature CSS fight scroll ownership
11. shared Select exists but feature invents local dropdown
12. removed compatibility API survives as dormant caller
13. async dialog opens before authoritative values arrive
14. new UI wrapper is added while old owner remains underneath
15. one telemetry value has two writers
16. mobile UI reads another UI as state database
17. routine polling success becomes permanent noise
18. durable state is repeated on multiple permanent surfaces
19. desktop telemetry cards consume primary workspace height despite cheaper persistent status surface
20. passive qB identity and manual Refresh consume permanent Header width without primary workflow value
21. old WeiG release test/deploy file is kept "for reference" beside the canonical current file
```

Diagnosis order: owner -> upstream/API evidence -> performance budget -> normalization -> source component -> shared primitive -> explicit lifecycle -> final geometry -> delete obsolete owner/caller -> static + real interaction regression.

## 16. Validation contract

Dev `[ui]` exact-HEAD validation uses qB 4.1.9.1 + 5.2.0 representative fixtures in Linux Chromium plus smoke/static/syntax and upstream representative audit.

Static gates reject version-labelled repository filenames, versioned runtime, first-party MutationObserver, presentation API polling, second Selection/Transfer/Settings/Route/Connection owner, legacy qB4 Private resolver/caller, fixed Torrent viewport owner, route geometry in Spatial, feature-local native Select skin, retired Facet DOM, presentation DOM as state, qB product marker/manual Refresh runtime, duplicate Connection polling and second DHT/Peers writer.

Browser gates execute:

```text
qB4 Private/PT -> 5+ dialog + 0 tracker requests
qB4 unsupported Tags -> WebAPI 2.3.0 dialog + no state/request
qB5 Private + actual Tags selection
progressive page label without ?
route transitions
Desktop Topbar one row; Search shrinks first
no qB marker / manual Refresh
Desktop Stats absent; TorrentPanel starts at workspace top
Start/Pause/More/Delete before Expand
same Facet/action DOM moves to mobile
same DHT/Peers twice -> zero DOM mutation
firewalled -> Network limited
connected/disconnected -> semantic ConnectionIndicator
Reduced Motion -> online pulse disabled
Mobile Summary retains same connection semantic state
Transfer 12h / real rate-unit / ALT Apply
Selection / Session / BFCache
```

Full stable-tag audit, Linux/Windows full browser matrix and packaging remain main Release-only. Real exact-SHA qB 4.1.9.1 + 5.2.x LIVE is mandatory before promotion.

## 17. Agent implementation guide

```text
read DESIGN/docs
-> identify canonical owner
-> verify upstream capability/units
-> reject high-cost compatibility by default
-> change code + tests + docs as one problem chain
-> Current Owner audit + zombie audit + cumulative diff audit
-> create one final exact dev HEAD
-> exact-HEAD CI + upstream audit
-> real exact-SHA LIVE
```

A compatibility problem must not become a permanent compatibility layer. `docs/008.Torrent工作区与状态所有权.md` provides the page-level Torrent contract and must remain consistent with this authority.

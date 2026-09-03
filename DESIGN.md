# WeiG qB WebUI — Design System

Version: **2.5**  
Status: **v0.3.7 Semantic Ownership 3.7**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This is the current visual, interaction and first-party ownership authority. The engineering style follows the `awesome-design-md` discipline: explicit hierarchy, semantic tokens, reusable components, responsive behavior, interaction states, Do/Don't rules and documented failure modes instead of screenshot-specific patches.

## 1. Non-negotiable architecture

1. One semantic purpose has one Current Owner.
2. Canonical Button / Select / Dialog / Input / Card / Theme primitives are reused; feature-local copies are prohibited.
3. Historical WeiG runtime/tests/deploy tools are not compatibility baggage in `dev`; Git history is the archive.
4. First-party filenames describe stable responsibility, never WeiG release versions or a qB version.
5. `MutationObserver`, monkey patch, post-render repair layers, duplicate polling and dual owners are prohibited.
6. Presentation modules do not own qB clients, business state or polling.
7. Current qBittorrent/WebAPI capability facts remain explicit, including `qBittorrent 5.0.0+` and `WebAPI 2.3.0+`.
8. Mobile is adaptive presentation of the same application state, not a second app.
9. Reduced Motion is mandatory.
10. Exact Git SHA is code/cache/test identity; `VERSION` is product identity; tag/Release is distribution identity.

## 2. Hard rules

### COMPAT-DEGRADE-001 — honest capability degradation
If an older upstream lacks an authoritative/batch capability, prefer an explicit capability notice over expensive emulation unless product approval explicitly requires the fallback.

### PERF-COMPAT-001 — no collection N→N API fallback
List/filter/refresh paths must not default to `N items -> N requests`. Evaluate 100/1000/5000-item cost before any fallback.

### PROGRESSIVE-DATA-001 — aggregate work never blocks primary data
Current-page data renders first. Aggregate count/index/enrichment is background work with bounded loading/error state; never a durable `?`.

### TIMESERIES-001 — bounded history
Realtime history is bounded; longer windows do not increase network polling or create unbounded samples.

### INTERACTION-TEST-001 — test the action and final state
Critical browser tests perform the user action and assert state transition plus visible final result. Element existence alone is not PASS.

### CONTROL-SKIN-001 — one Select/Dialog primitive system
`W.Components.selectControl()` owns Select behavior/mode. Shared Select/Dialog skin belongs to `css/ui.css`. Feature modules may provide geometry only.

### SELECT-SCROLL-001 — internal Select scrolling is not anchor scrolling
The scrollable `.ui-select__options` viewport owns its own wheel/touch/scroll position. Internal menu scrolling must never trigger floating-menu anchor re-placement or reset list position. External page/viewport scroll may reposition the menu.

### SELECT-TOPLAYER-001 — top-layer Select remains canonical
When a modal needs native reliability it still uses `W.Components.selectControl({native:true})`; do not create a second Select system.

### DIALOG-SCROLL-001 — shell is not the scroll owner
`dialog.dialog` is bounded with `overflow:hidden`; only genuinely overflowing content/form/list regions scroll.

### NATIVE-THEME-001 — native controls follow resolved theme
Canonical native Select/options consume resolved Light/Dark tokens and `color-scheme`.

### OWNER-RETIRE-001 — replaced owners leave runtime
When a canonical owner replaces another implementation, old callers, shims, selectors, events, state and test expectations leave in the same change.

### CURRENT-ONLY-001 — dev contains only current WeiG architecture
Historical WeiG implementation/test/deploy compatibility is deleted, not aliased. Current qB/WebAPI compatibility behavior remains.

### FILE-NAMING-001 — filenames describe responsibility
No active `*-vNNN.*`, `live-vNNN.sh`, `live-qb52.sh` or equivalent version-labelled first-party file.

### TEST-CURRENT-001 — tests validate current contracts
Historical release-specific tests are not preserved. Current requirements live in current canonical tests.

### FACET-OWNER-001 — one facet state/presentation chain
Facet state = `app.js / W.LibraryController`; composition = `W.SpatialRuntime`; control = canonical Select; skin = `css/ui.css`.

### PRESENTATION-STATE-001 — DOM is not application state
Adaptive UI consumes semantic state/events/controllers, never another visible/hidden node as its database.

### TELEMETRY-PAINT-001 — one input, idempotent paint
DHT/Peers consumes the existing `weigg:maindata` lifecycle. Unchanged formatted telemetry causes zero DOM writes.

### STATUS-NOISE-001 — routine success is silent
Background polling success does not create durable `Refreshed / 已刷新` or timestamps.

### STATUS-DEDUP-001 — durable status is not duplicated per viewport
Desktop Connection lives in Statusbar; Mobile Connection lives in Mobile Network Summary. Both consume one semantic state and no extra polling.

### STATUS-PLACEMENT-001 — durable state uses the cheapest surface
Persistent telemetry must not consume primary workspace height when an existing status surface is sufficient.

### ADAPTIVE-STATUS-001 — adaptive placement is not another owner
Desktop/Mobile placement never creates another qB client, timer, state store or reconciliation path.

### LIVE-INDICATOR-001 — Connection motion is presentation only
Connection animation consumes existing `connection_status`; no timer/request is added. Connected=success, firewalled=warning, disconnected/error=danger.

### STATUS-SIGNAL-001 — one semantic state, one visible signal
A Connection state has exactly one explicit status dot. Glow/rings/pseudo-elements must not create a second distinguishable circle. Connected may animate that one dot only; warning/danger remain static.

### MOTION-STATUS-001 — status motion obeys Reduced Motion
System `prefers-reduced-motion` and WeiG `data-motion="reduced"` disable the Connected pulse; the same single semantic dot remains visible and static.

### HEADER-UTILITY-001 — permanent Header space is purposeful
Topbar space is for identity, navigation, primary search and actionable global utilities. Passive qB product marks and redundant manual Refresh stay retired.

### HEADER-SEARCH-001 — one Search DOM/state, adaptive presentation
Torrent Search has one `#search-input` and one `app.search` state. Desktop presentation is restrained full width, then compact width, then icon-only when space is tight; focus temporarily expands the same input. Mobile continues to reveal the same input through the existing mobile Search trigger. No duplicate input/controller/filter state.

## 3. Canonical owner map

```text
qB capability/endpoints/native units     W.QBClient
Router URL/hash                          W.Router
Route Frame + Torrent query/page/search  app.js / W.AppState
Facet semantic facade                    W.LibraryController
Facet composition                        W.SpatialRuntime
Settings DOM/save                        W.SettingsRenderer / W.SettingsState
Display time-zone state                  W.Time
Select behavior                          W.Components.selectControl()
Shared Select/Dialog skin                css/ui.css
Floating Select placement                scripts/floating.js
Torrent semantics                        W.TorrentSemantics
Selection/actions                        W.Selection / ActionRegistry
Transfer samples/metadata                W.TransferRuntime
Connection semantic publisher            existing app transfer cycle -> weigg:status-state
Connection adaptive presentation         W.MobileAdaptive
Desktop Connection geometry/signal       css/layout.css
Desktop Header/Search geometry           css/header.css
Responsive placement/row height          W.MobileAdaptive
Non-Settings shell geometry              css/layout.css
Session/logout/BFCache                    W.SessionController / SessionGate
```

## 4. Canonical controls and scroll boundaries

Floating Select anatomy:

```text
trigger                  semantic control
floating menu            anchored top-layer surface
search input             fixed inside menu
options viewport         sole internal scroll owner
```

`scroll` inside `.ui-select__options` is internal interaction and must not call menu placement. Scroll on the page, Settings content, window or visual viewport may call placement because the anchor moved.

Settings time zone continues to use the same searchable canonical Select. It does not use a timezone-specific dropdown, wheel handler, CSS override or native fallback.

## 5. Header/Search responsive design

Desktop Search is a bounded utility, not an infinite spacer:

```text
wide desktop       ~320px search
medium desktop     ~240px search
narrow >820px      40px search icon
focused icon mode  same search box expands temporarily to ~280px
mobile <=820px     existing mobile-search-btn reveals same #search-input
```

Navigation and permanent actions stay on one row. Search presentation may shrink, but `app.search`, the input value and filtering semantics never change owners.

## 6. Torrent workspace

```text
Topbar    WeiG qB | Nav | adaptive Search | + Add | Theme | utilities
Sidebar   Torrent state filters + canonical Tracker/Path/Category/Tags Selects
Workspace TorrentPanel flex:1
Statusbar Torrent count | Free space | Transfer | Connection | actionable message
```

Desktop four-card Stats is retired; it remains Mobile Summary only. Action order stays `Start -> Pause -> More -> Delete -> Expand`. Automatic polling remains; manual Refresh stays retired.

## 7. qB capability contract

qB4 Private/PT remains visible with `5+`; click -> shared capability dialog -> filter unchanged -> zero tracker requests. Copy keeps **此功能需要 qBittorrent 5.0.0+**.

qB5 Private uses authoritative metadata. Tags keeps the **WebAPI 2.3.0+** boundary and degrades through the shared capability dialog without state/request mutation when unsupported.

## 8. Connection contract

```text
getTransferInfo connection_status
-> app emits weigg:status-state
-> W.MobileAdaptive paints semantic state
-> css/layout.css paints one status dot
```

```text
connected     success   Connected / 已连接      one breathing dot
firewalled    warning   Network limited / 网络受限  one static dot
disconnected  danger    Disconnected / 未连接   one static dot
error         danger    Unavailable / 异常      one static dot
```

No second ring, second dot, pseudo-element signal, extra event or polling path.

## 9. Transfer/data contracts

Transfer raw samples max 900; minute buckets max 720; windows through 12 h; no extra polling. Canonical rate = B/s; NORMAL qB endpoint = B/s; ALT preferences = KiB/s and normalize at QBClient boundary. `ALT Apply` uses canonical methods.

Progressive paging uses `pageSize+1`, first page immediately, spinner before total, exact total later, `!` on aggregate failure, never `?`.

## 10. Systemic failure modes

```text
1. new UI wrapper while old owner remains
2. shared component replaced by feature-local control
3. internal Select scroll treated as page scroll and reset by re-placement
4. responsive Search implemented as a second input/controller
5. one Connection state rendered as two distinguishable animated circles
6. qB old-version fallback implemented as N per-item requests
7. mobile presentation creates a second business state or polling path
8. primary workspace height spent on duplicate telemetry
9. manual refresh reintroduced beside automatic polling
10. CSS correction layer added instead of changing the canonical geometry owner
11. test checks DOM existence but not interaction/final state
12. old WeiG release code/tests/scripts kept "for compatibility"
```

Diagnosis order: Current Owner -> upstream capability -> performance -> canonical primitive -> scroll/state boundary -> responsive geometry -> retire old caller -> static contract -> real interaction regression.

## 11. Validation contract

Dev `[ui]` exact-HEAD validation uses qB 4.1.9.1 and 5.2.0 representative fixtures in Linux Chromium plus smoke/static/syntax and upstream audit.

Browser gates must execute and verify:

```text
qB4 Private/PT -> 5+ dialog + zero tracker requests
qB4 unsupported Tags -> WebAPI 2.3.0 dialog + no state/request mutation
qB5 authoritative Private + Tags
Desktop TorrentPanel geometry and action order
DHT/Peers idempotent paint
Connected/firewalled/disconnected semantic state
one Connection dot; Connected single-dot pulse; Reduced Motion static
Display time-zone Select wheel scroll retains non-zero scrollTop and stable menu position
Display time-zone selection changes W.Time and visible trigger in Dark and Light
Desktop Search bounded width; narrow desktop collapses to icon
icon focus expands the same input and filtering state; blur collapses without losing value
Mobile Search and time-zone interaction reuse the same canonical state/components
```

Real exact-SHA qB 4.1.9.1 + 5.2.x LIVE remains mandatory before promotion. `main` does not move without explicit maintainer authorization.

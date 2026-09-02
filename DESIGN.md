# WeiG qB WebUI — Design System

Version: **2.3**  
Status: **v0.3.7 Semantic Ownership 3.7**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This file is the single visual, interaction and first-party runtime ownership authority. New work extends these rules; it never creates a parallel owner or a post-render repair layer.

## 1. Non-negotiable rules

1. One semantic purpose has one canonical component/controller/layout/data owner.
2. Feature code does not invent local Button/Select/Card/Badge/Dialog/Popover/SettingRow systems.
3. Active first-party runtime assets use stable semantic filenames, never release/version suffixes.
4. Git history is the archive. Migrated legacy runtime code is deleted, not aliased.
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
22. Shared control/dialog skin belongs to `css/ui.css`; feature CSS may contribute geometry variables but must not duplicate primitive skin.
23. Dialog shells do not become scroll containers merely because the viewport is narrow; only content regions that actually overflow may scroll.
24. Native Select presentation explicitly follows the resolved light/dark theme through canonical tokens and `color-scheme`.
25. A retired canonical API or capability hook must be removed from every caller; an unreachable compatibility branch is still legacy runtime.
26. Torrent facet state is semantic state; no hidden nav tree or visible DOM copy may act as its database.
27. One telemetry field has one presentation input, and unchanged formatted telemetry must not cause a DOM write.
28. Routine polling success is silent; durable status surfaces do not display heartbeat copy such as Refreshed/Connected when another surface already owns that state.
29. Desktop/mobile variants may move one canonical component instance between declared slots; they may not clone a second business-control tree.
30. The Torrent Topbar is single-row on desktop; search is the primary flexible item and shrinks before navigation/action controls wrap.

### COMPAT-DEGRADE-001 — honest capability degradation

If an older upstream version lacks the authoritative/batch capability required by a feature, the default is an explicit capability boundary, not expensive emulation. The UI may keep the entry visible and state the minimum supported qBittorrent version. A costly fallback is allowed only after the developer explicitly confirms that the old-version feature is necessary and its performance cost is acceptable.

Product copy stays neutral: state the required version/current version, optionally suggest upgrading, and remind users to back up configuration/tasks/important data before an upgrade. Internal API/performance explanations belong in developer documentation, not the end-user capability dialog.

### PERF-COMPAT-001 — no collection N→N API fallback

A collection/list feature must not default to `N items -> N HTTP requests` as a compatibility mechanism. Before any fallback enters the list/filter/refresh path, evaluate at least 100, 1000 and 5000 items. Prefer an authoritative field, batch endpoint, existing snapshot or capability degradation.

### PROGRESSIVE-DATA-001 — aggregate data never blocks primary content

Background index/count/enrichment is secondary. If the current page is available, render it immediately. Unknown aggregate information uses a bounded loading/error state and is replaced when resolved; it does not block the first page and is never displayed as a long-lived `?`.

### TIMESERIES-001 — bounded history

Long realtime charts use bounded retention and, when needed, multi-resolution aggregation. Expanding a chart window must not create more network polling or unbounded raw samples.

### INTERACTION-TEST-001 — test the user action

Critical interaction tests must execute the actual user action and assert the resulting state/value/visible outcome. The existence of an option/menu element is not sufficient evidence that the interaction works.

### CONTROL-SKIN-001 — one primitive skin owner

Control behavior and control appearance are separate responsibilities but neither may have feature-local duplicates. `W.Components.selectControl()` owns Select behavior/presentation mode; `css/ui.css` owns the shared floating/native visual skin. A feature such as Transfer may provide width/height through semantic custom properties, but must not restyle `.ui-select__native` locally.

### DIALOG-SCROLL-001 — shell is not the scroll owner

`dialog.dialog` is a bounded top-layer shell. The outer dialog remains `overflow:hidden`. Short capability/confirm/prompt dialogs must not show a decorative outer scrollbar on desktop or mobile. When content genuinely exceeds the viewport, the canonical body/form/action-list region owns the internal scroll with bounded overscroll behavior.

### NATIVE-THEME-001 — native controls follow resolved theme

Canonical native Select uses the resolved WeiG theme, not browser-default white presentation. The live `<select>`, its text/border/surface and option surface consume shared semantic tokens, and `color-scheme` is explicitly `dark` or `light` according to `html[data-theme]`.

### OWNER-RETIRE-001 — dormant compatibility code is still runtime

When a canonical capability is removed, every old call site, shim, false branch and no-op hook must also leave runtime. Code that “cannot currently execute” is not an archive. Git history is the only archive for retired ownership.

### FACET-OWNER-001 — facet state and facet presentation are separate, singular owners

Torrent facet business state belongs to `app.js / W.LibraryController`; visible facet composition belongs to `W.SpatialRuntime`; Select behavior belongs to `W.Components.selectControl()`; Select skin belongs to `css/ui.css`. The retired `filter-shelf`, feature-local facet popover/search implementation and hidden tracker/path/category/tag nav trees do not coexist with the canonical controls.

### PRESENTATION-STATE-001 — DOM is not application state

Adaptive/mobile presentation consumes semantic state/events or a semantic controller. It must not copy `page-title`, `library-count-copy`, hidden facet text or another presentation node as an authoritative source.

### TELEMETRY-PAINT-001 — one input, idempotent paint

DHT/Peers presentation consumes the `W.TransferRuntime` `sync/maindata` lifecycle. `getTransferInfo()` may own live speed/connection sampling but does not also paint DHT/Peers. If the formatted DHT/Peers value has not changed, the renderer performs no DOM mutation.

### STATUS-NOISE-001 — routine success is silent

Background refresh success does not occupy permanent UI with `Refreshed / 已刷新`, a refresh timestamp, or equivalent heartbeat text. Actionable errors remain visible and explicit operation success may use a bounded Toast.

### STATUS-DEDUP-001 — durable state has one persistent surface

Connection state belongs to the Network card. Statusbar does not duplicate `Connected / 已连接`. Persistent statusbar content is limited to Torrent count, storage, Transfer and a transient actionable message region.

## 2. Visual theme

WeiG uses the **Nebula Spatial Console** design language: dark, precise, dense and restrained. It follows the design-system discipline promoted by `awesome-design-md`: explicit tokens, hierarchy, reusable components, documented responsive behavior, state contracts and known failure modes rather than screenshot-specific patches. The `awesome-design-md` Linear analysis is used as a discipline reference for layered dark surfaces, hairline boundaries, restrained accent use and reusable component tokens; WeiG keeps its own Nebula palette instead of copying another product's colors.

```text
Void      deep-space background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      compact information surface
Raised    toolbar / active input / detail summary
Floating  select / menu / popover / dialog
```

Blue/cyan communicates ordinary interaction. Purple is reserved for ALT/secondary semantics and selected brand accents. Depth comes from surface/border contrast, not permanent glow. Dark controls should read as members of the same surface ladder, never as isolated bright browser-default islands.

## 3. Canonical owner map

```text
qB endpoint/capability/native units    W.QBClient
Router URL/hash state                  W.Router
Route Frame presentation               app.js / W.AppState
Torrent query/catalog/page state       app.js / W.AppState
Torrent facet state/facade             app.js / W.LibraryController
Torrent facet presentation             W.SpatialRuntime
Network card presentation              app.js
Settings DOM/save                      W.SettingsRenderer / W.SettingsState
Settings controls                      W.ControlRegistry + W.Components.selectControl
Select behavior/presentation mode      W.Components.selectControl
Shared Select visual skin              css/ui.css
Shared Dialog visual/scroll skin       css/ui.css
Torrent semantics                      W.TorrentSemantics
Torrent selection                      W.Selection
Torrent actions                        W.Selection.actions / ActionRegistry
Transfer samples + telemetry           W.TransferRuntime
Transfer dialogs/rate editor behavior  W.Transfer
Torrent field registry                 W.TorrentFieldRegistry
Responsive presentation                W.MobileAdaptive
Shared adaptive behavior               W.UiSystem
DataGrid/dialog behavior               W.LayoutRuntime
Visual polish                          W.PolishRuntime
Runtime translation/context text       ux.js
Brand/logo/favicon/motion              W.Brand + W.AmbientMark
Header utilities/product presentation  header.js + source DOM
Session/logout/BFCache                 W.SessionController / SessionGate
Torrent progress motion                css/progress.css
Non-Settings shell geometry            css/layout.css
```

Owner names are semantic. A release must not create `TransferV038`, `SelectionModelV038`, `SettingsGridV038`, feature-local dropdown/dialog skin systems or parallel route controllers.

## 4. Explicit runtime lifecycle

Canonical publishers:

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

Consumers may recalculate their own presentation from these events. They may not watch arbitrary DOM mutations and infer ownership after the fact.

Forbidden first-party runtime architecture:

```text
MutationObserver repair/reclaim
observer-based native Select upgrade
hidden versioned script/link loader
presentation module starting QBClient/API polling
setTimeout loops used as permanent ownership repair
old + new runtime implementations loaded together
dormant calls to retired canonical compatibility APIs
hidden presentation DOM used as semantic state storage
```

## 5. Stable runtime filenames

Active first-party runtime paths are named by responsibility:

```text
webui/private/css/app.css
webui/private/css/layout.css
webui/private/css/settings.css
webui/private/css/transfer.css
webui/private/css/progress.css
webui/private/css/ui.css
webui/private/css/polish.css
webui/private/css/brand.css

webui/private/scripts/core.js
webui/private/scripts/qb-client.js
webui/private/scripts/components.js
webui/private/scripts/floating.js
webui/private/scripts/torrent-semantics.js
webui/private/scripts/settings.js
webui/private/scripts/selection.js
webui/private/scripts/transfer.js
webui/private/scripts/layout.js
webui/private/scripts/responsive.js
webui/private/scripts/spatial.js
webui/private/scripts/ui.js
webui/private/scripts/polish.js
webui/private/scripts/app.js
```

Absolute rules:

```text
no active *-vNNN.css/js
no old-name alias/shim after migration
no hidden loader for deleted assets
no long-term CSS correction layer over an obsolete owner
```

Cache identity is `stable semantic path + exact deployment Git SHA`.

## 6. Canonical controls and dialogs

Visible Selects are created explicitly with `W.Components.selectControl()` by the source owner. No runtime scans native `<select>` elements and upgrades them later.

The same canonical Select owner has two explicit presentation modes:

```text
floating mode   ordinary page/list/settings/facet controls
native mode     modal controls where the browser top layer must own the dropdown
```

`native:true` is not a second component system; it is a presentation mode of the same `selectControl()` contract and exposes the same `getValue/setValue/setOptions/setDisabled/onChange` semantics. Capability-gated controls use the same component `onOpen` guard; a feature does not create a fake disabled dropdown or a second popup framework.

The visual skin for **both** Select presentations lives in `css/ui.css`. Native mode consumes `--ui-control-surface`, `--ui-control-border`, `--ui-control-option-surface`, `--ui-native-scheme` and related semantic tokens. Feature styles may only set geometry such as `--ui-select-h` or `--ui-select-width`.

Transfer chart-window and rate-unit controls use modal-safe native mode. Feature-local `TransferUnitDropdown`, local `.ui-select__native` skin, dialog portal hacks or observer repairs are forbidden.

Dialogs use one canonical shell in `css/ui.css`:

```text
Dialog shell        bounded top layer, overflow hidden
Dialog head         intrinsic
Dialog body/form    internal scroll only on real overflow
Dialog actions      intrinsic / bounded action-list scroll when required
```

Feature CSS supplies semantic geometry via `--dialog-width`, `--dialog-max-width`, `--dialog-max-height`, `--dialog-padding`; it does not restyle generic dialog overflow/skin. A compact capability dialog therefore does not gain an outer scrollbar simply because the viewport is mobile.

## 7. Settings structure

Every ordinary editable preference is emitted directly as:

```text
SettingsSection
└─ SettingsGrid
   └─ SettingRow
      ├─ SettingCopy
      └─ SettingControlSlot
         └─ canonical control
```

Wide desktop uses two columns; narrow/mobile uses one. Ordinary copy is left aligned; controls align to the control axis. Full-span rows are schema semantics only for genuinely large editors.

## 8. Route Frame contract

`W.Router` owns URL/hash parsing. `app.js` is the **only** owner allowed to commit route presentation. One route transition atomically synchronizes:

```text
active View
Top Navigation active item
Mobile Navigation active item
Torrent Sidebar visibility
workspace route scope / column span
Back button
mobile drawer close
weigg:route-state
```

Route matrix:

```text
Home             Torrents active   Torrent Sidebar visible
Torrent Detail   Torrents active   Torrent Sidebar hidden
Search           Search active     Torrent Sidebar hidden
RSS              RSS active        Torrent Sidebar hidden
Logs             Logs active       Torrent Sidebar hidden
Settings         Settings active   Torrent Sidebar hidden
```

`ux.js` may synchronize translated route text/placeholders but never active navigation state. `spatial.js` owns facet presentation but never route shell classes or connection/footer presentation. Settings content must not intercept `hashchange` or block the canonical Route Frame event path.

## 9. Torrent selection

`W.Selection` owns the selected hash Set and all selection semantics.

Desktop:

```text
row non-interactive click   select only
Ctrl/Cmd + click            toggle
Shift + click               range from anchor
checkbox                    toggle
Torrent title               open detail only
right click                 target selection + ActionRegistry
Ctrl/Cmd+A                  select current page
Escape                      clear when no dialog owns Escape
```

Mobile:

```text
selection hit target >=44×44
ordinary card area participates in selection
long press -> same ActionRegistry
More -> same ActionRegistry
```

Top More, context menu, long-press and mobile More render the same registry. Selection-wide queries consume `W.LibraryController.state()` rather than retired tracker/path/category/tag presentation DOM. Selection must not retain hooks to retired qB4 Private enrichment such as `resolveMany`.

## 10. Private / PT and Tags capability contract

Classification belongs to `W.TorrentSemantics`:

```text
PRIVATE_PT
PRIVATE
PT
PUBLIC
UNKNOWN
```

### qBittorrent 5.0+

When qB returns authoritative `private` / equivalent metadata, it is used directly. The `Private / PT` filter and small privacy badges operate from collection data without per-torrent requests. PT tracker-domain rules may supplement PT classification.

### qBittorrent 4.x

The `Private / PT` entry remains visible with a muted `5+` capability marker. Clicking it opens the neutral shared capability dialog; it does **not** change the active filter and does **not** issue tracker requests.

The legacy DHT/PeX/LSD tracker-message resolver, request queue and privacy cache are not part of runtime. Dormant callers of those removed APIs are also forbidden. qB4 Torrent Detail does not invent Private state when the WebAPI does not provide the authoritative metadata needed by this feature.

### Tags

The Tags facet remains visible on unsupported instances. `QBClient.capabilities.tags` is authoritative and currently maps to **WebAPI 2.3.0+**. Opening Tags on an unsupported instance shows the same shared capability dialog and does not issue the unsupported Tags request or mutate tag filter state. It is not described as a qB 5-only feature.

Capability notices consume the shared Dialog shell. Short content must not show an outer or body scrollbar on ordinary desktop/mobile viewports; only genuinely overflowing dialog content may scroll internally.

Metadata pending on supported versions remains `UNKNOWN`, never falsely Public.

## 11. Progressive library/pagination

The current page is primary content. Full catalog/index/aggregate count is secondary enrichment.

Initial large-library state:

```text
◌ Page 1 · 50 per page
```

Resolved:

```text
Page 1 / 30 · 50 per page
```

Aggregate failure:

```text
! Page 1 · 50 per page
```

The error indicator may explain that total count is temporarily unavailable, while current-page browsing remains usable. The page request uses one bounded look-ahead item (`pageSize + 1`) to determine whether Next is available before aggregate total is known.

The loading ring is CSS-only, small, and respects Reduced Motion.

## 12. Torrent workspace geometry

`css/layout.css` is the final non-Settings geometry owner. Desktop Topbar remains one line; navigation/actions are intrinsic and Search is the primary flex-shrinking region. The Torrent route intentionally has no duplicate Library/Page title block and no main-workspace filter shelf.

Desktop Sidebar:

```text
Torrent state filters
Private / PT [5+ when unsupported]
canonical Tracker Select
canonical Save Path Select
canonical Category Select
canonical Tags Select
```

The four Facets are the same `W.SpatialRuntime` instances used on mobile. Their external labels are omitted because the current Select values (`All Trackers`, `All Paths`, `All Categories`, `All Tags`) provide the semantic cue.

Desktop workspace:

```text
ListView (flex column)
├─ Stats             intrinsic
└─ TorrentPanel      flex:1
   ├─ GridToolbar    intrinsic
   │  ├─ page size / columns
   │  ├─ Start / Pause / More / Delete
   │  └─ Expand
   ├─ Column header  intrinsic
   ├─ TorrentList    flex:1; internal scroll
   └─ Pager          intrinsic
```

Desktop action order is contractual: `Start -> Pause -> More -> Delete -> Expand`.

Mobile owns no second business-control tree. `W.MobileAdaptive` moves the same Facet host and Selection toolbar between explicit desktop/mobile slots and adapts row height/density only.

`app.css` must not retain fixed `62vh/660px` or mobile viewport-calculation heights for `torrent-list`. Adaptive geometry is not implemented as a later CSS override over an obsolete height owner.

Route shell column/span geometry and statusbar named areas belong to `css/layout.css`, not `spatial.css` or `polish.css`.

## 13. Transfer telemetry and chart history

`W.TransferRuntime` owns:

```text
existing getTransferInfo stream -> live speed samples
one sync/maindata lifecycle      -> DHT / peers / free space
```

No second speed polling loop is created. The Network card consumes DHT/Peers only from the `weigg:maindata` lifecycle and uses idempotent text paint; unchanged snapshots do not flash or mutate the DOM. `loadTransfer()` may update Download/Upload speed and the card's connection state but must not become a second DHT/Peers writer.

Realtime stats order:

```text
Session downloaded | Session uploaded | DHT / Peers
Global upload limit | Global download limit | Free space
```

Chart windows:

```text
1 min / 5 min / 15 min / 30 min / 1 h / 3 h / 6 h / 12 h
```

Retention:

```text
raw ring        max 900 samples for short windows
minute buckets  max 720 buckets for long windows
```

History lives only in the current browser page memory. It is not written to qBittorrent, the VPS or persistent browser storage; refreshing the page starts new history. The selected unit/window preference may use a tiny local setting, but sample history does not.

## 14. Transfer rate-unit contract

Inside Transfer, the canonical rate is always **bytes/second**.

`QBClient` normalizes qB native units:

```text
Normal transfer endpoints   B/s  <-> canonical B/s
ALT Preferences             KiB/s <-> canonical B/s
```

Presentation offers:

```text
Auto
KiB/s
MiB/s
GiB/s
```

Auto chooses a practical concrete unit on paint/open. The rate dialog loads authoritative qB limits before it becomes interactive, so an early unit change cannot capture an empty field as zero. Editing does not cause the unit to jump while the user types. Manual unit changes preserve the underlying canonical bytes/s value. Numeric display targets approximately three significant digits, and inputs allow enough precision to prevent a small B/s value from becoming zero when expressed in GiB/s.

The chart-window and rate-unit native Selects share one dark/light skin from `css/ui.css`. In dark mode neither the closed control nor its option surface is allowed to fall back to a bright browser-default theme.

## 15. Statusbar geometry

Desktop statusbar named areas:

```text
"torrent storage transfer message"
```

Persistent information is limited to Torrent count, Free space and the Transfer capsule. The final message area is transient/actionable only. `Connected / 已连接`, `Refreshed / 已刷新` and refresh timestamps are not durable Footer owners. `polish.css` may change tone but never placement.

## 16. Progress and motion

`css/progress.css` is the only Torrent progress motion owner. Incomplete torrents may use flow/sweep; 100% stops decorative motion. Both system `prefers-reduced-motion` and `html[data-motion="reduced"]` disable animation.

## 17. Session / auth

Verified logout:

```text
SessionController.logout()
→ QBClient.logout()
→ auth/logout
→ protected session probe
→ invalid session required for success
```

Auth bypass is reported as server policy, not false success. Back/BFCache re-entry remains fail-closed.

## 18. Systemic failure modes found during v0.3.7 LIVE

The following are recurring architecture failures, not isolated screenshot bugs:

```text
1. old-version feature simulated with N per-item API requests
2. route presentation split across App + UX + Spatial
3. base stylesheet fixed height plus adaptive stylesheet override
4. modal trigger in browser top layer with menu portalled outside the modal
5. browser test checked option existence but never performed selection
6. long chart window attempted by retaining more raw samples indefinitely
7. aggregate/index metadata treated as prerequisite for primary content
8. qB endpoint/preference units leaked directly into presentation state
9. second semantic owner hidden behind “compatibility” or “polish” code
10. generic mobile dialog overflow owned by app.css while feature dialogs locally undo it
11. Select behavior is canonical but native visual skin is owned by one feature stylesheet
12. removed compatibility API survives as an unreachable caller/hook and can be revived later
13. async dialog opens before authoritative data is loaded, exposing an invalid editable first frame
14. a new UI wrapper is added while the old presentation owner remains underneath it
15. a shared Select exists but one feature invents its own trigger/popover/search dropdown system
16. one telemetry value is painted by two data streams, creating visible churn even when state is stable
17. mobile presentation reads another UI node as its state database
18. routine polling success or one durable state is duplicated across multiple fixed surfaces
```

Fixed diagnosis order:

```text
owner
→ upstream/API evidence
→ complexity/performance budget
→ data/schema normalization
→ source component
→ shared primitive skin
→ explicit lifecycle
→ final geometry
→ delete obsolete owner and dormant caller
→ static + real interaction regression
```

Never begin with screenshot-specific CSS when ownership/data complexity is unresolved.

## 19. Validation contract

Dev `[ui]` exact-HEAD validation uses representative qB 4.1.9.1 + 5.2.0 in Linux Chromium plus smoke/static/syntax and the upstream representative audit.

Static gates reject:

```text
versioned runtime assets/loaders/owners
first-party MutationObserver
presentation QBClient/API polling
second Selection/Transfer/Settings/Route owner
legacy qB4 Private bulk resolver or dormant caller
fixed Torrent viewport owner in app.css
route shell geometry in spatial.css
un-normalized ALT rate handling in Transfer UI
unbounded Transfer history
feature-local .ui-select__native skin
app.css generic dialog visual/overflow ownership
capability dialog width !important override
retired filter-shelf / facet popover / hidden facet nav source
presentation DOM used as LibraryController state
persistent Footer connection/refresh heartbeat owner
second DHT/Peers presentation writer
```

Browser fixture must execute and verify:

```text
qB4 Private/PT -> 5+ capability dialog + 0 tracker requests
qB4 compact capability dialog -> no outer/body scrollbar on desktop/mobile
qB4 unsupported Tags -> visible control + shared WebAPI 2.3.0 capability dialog + no state mutation/request
qB5 native Private filter/detail
qB5 Tags -> actual canonical Select interaction
progressive page label without ?
first page before aggregate index completes
RSS -> Settings atomic active state and sidebar removal
desktop Torrent panel fills workspace
Topbar remains one row and Search flex-shrinks before actions wrap
Start/Pause/More/Delete remain immediately before Expand
same Facet/action DOM moves to mobile without duplication
unchanged DHT/Peers snapshot causes zero DOM mutation
Footer has no persistent Refreshed/Connected copy
real modal chart-window selection through 12h
real rate-unit selection and numeric conversion
dark native chart/rate Selects share one canonical theme
ALT Apply emits qB-native KiB/s values
Selection / ActionRegistry desktop and mobile behavior
44px mobile touch target
Reduced Motion
Settings/session/logout/BFCache
```

Full stable-tag audit, Linux/Windows full browser matrix and packaging remain main Release-only. Real exact-SHA qB 4.1.9.1 + 5.2.x LIVE remains mandatory before promotion.

## 20. Agent implementation guide

```text
read DESIGN/docs contract
→ identify canonical owner
→ verify upstream capability/units when ambiguous
→ reject high-cost compatibility by default
→ change code + tests + docs as one issue chain
→ cumulative diff/ownership audit
→ create one final exact dev HEAD
→ run exact-HEAD CI
→ real exact-SHA LIVE
```

A compatibility problem must not become a permanent compatibility layer. Torrent workspace page-level detail is additionally specified in `docs/008.Torrent工作区与状态所有权.md`; it must remain consistent with this authority rather than override it.

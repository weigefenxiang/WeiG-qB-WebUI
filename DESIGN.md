# WeiG qB WebUI — Design System

Version: **2.9**  
Status: **Current Semantic Ownership**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> Current visual, interaction and first-party ownership authority. The engineering discipline follows `awesome-design-md`: explicit hierarchy, semantic tokens, reusable primitives, responsive behavior, interaction states, Do/Don't rules and documented failure modes instead of screenshot-specific patches.

## 1. Non-negotiable architecture

1. One semantic purpose has one Current Owner.
2. Canonical Button / Select / Dialog / Input / Card / Theme primitives are reused; feature-local copies are prohibited.
3. Historical WeiG runtime/tests/deploy tools are not compatibility baggage in `dev`; Git history is the archive.
4. First-party filenames describe stable responsibility, never WeiG release versions or a qB version.
5. `MutationObserver`, monkey patch, post-render repair layers, duplicate polling and dual owners are prohibited.
6. Presentation modules do not own qB clients, business state or polling.
7. Current qBittorrent/WebAPI facts remain explicit, including `qBittorrent 5.0.0+` and `WebAPI 2.3.0+`.
8. Mobile is adaptive presentation of the same application state, not a second app.
9. Reduced Motion is mandatory.
10. Exact Git SHA is code/cache/test identity; `VERSION` is product identity; tag/Release is distribution identity.

## 2. Hard rules

### COMPAT-DEGRADE-001 — honest capability degradation
If older upstream lacks an authoritative/batch capability, prefer a visible capability notice over expensive emulation unless product approval explicitly requires a fallback.

### PERF-COMPAT-001 — no collection N→N API fallback
List/filter/refresh paths must not default to `N items -> N requests`. Evaluate 100/1000/5000-item cost first.

### PROGRESSIVE-DATA-001 — aggregate work never blocks primary data
Current-page data renders first. Aggregate count/index/enrichment is background work with bounded loading/error state; never a durable `?`.

### TIMESERIES-001 — bounded history
Realtime history is bounded; longer windows do not increase network polling or create unbounded samples.

### INTERACTION-TEST-001 — test action and final state
Critical browser tests perform the user action and assert semantic transition plus visible final result. Element existence alone is not PASS.

### CONTROL-SKIN-001 — one Select/Dialog primitive system
`W.Components.selectControl()` owns Select behavior/mode. Shared Select/Dialog skin belongs to `css/ui.css`; feature modules provide only semantic content/geometry.

### SELECT-SCROLL-001 — internal Select scrolling is not anchor scrolling
`.ui-select__options` owns its wheel/touch/scroll position. Internal menu scrolling never triggers floating anchor placement or resets list position; external page/viewport scrolling may reposition the menu.

### SELECT-TOPLAYER-001 — top-layer Select remains canonical
When a modal needs native reliability it still uses `W.Components.selectControl({native:true})`; do not create a second Select system.

### DIALOG-SCROLL-001 — shell is not the scroll owner
`dialog.dialog` is bounded with `overflow:hidden`; only genuinely overflowing body/form/list regions scroll.

### NATIVE-THEME-001 — native controls follow resolved theme
Canonical native Select/options consume resolved Light/Dark tokens and `color-scheme`.

### THEME-OWNER — one Theme preference/resolution authority
`W.Theme` in `scripts/theme.js` is the only owner of Theme mode validation, resolved Light/Dark, System media listener, Smart Auto boundary scheduling, theme-color metadata and Theme lifecycle. `W.Config` persists preference only; Header and Settings are presentation callers.

### THEME-MODE — saved Theme mode has four canonical values
Theme preference is exactly `system / time / light / dark`. Header `◐` and Settings both reuse `W.Components.selectControl()` and write through `W.Theme.setMode()`; a second enum, toggle state or viewport-specific Theme controller is prohibited.

### THEME-RESOLUTION — preference is not the rendered theme
`system` and `time` resolve inside `W.Theme`; DOM, CSS and native controls consume only `html[data-theme=light|dark]`. Presentation code must not infer saved Theme preference from visible DOM state.

### THEME-SYSTEM — System mode is event-driven
System mode owns one live `prefers-color-scheme` change listener. OS/browser Light↔Dark changes apply without reload and without API, polling or a second state store.

### THEME-TIME — Smart Auto schedules boundaries, not polling
Smart Auto uses browser/device local time: Dark from 20:00 through 07:59, Light from 08:00 through 19:59. Runtime keeps only the next 08:00/20:00 boundary timeout and recalibrates on visibility/pageshow; minute polling is prohibited.

### THEME-SURFACE — Light is a semantic white/blue-violet system
Light uses a white canvas and white/very-light-blue surfaces with cool hairlines and blue/violet brand elevation. `spatial.css` owns shared surface/elevation tokens; shared/feature owners consume semantic variables. `light-fix.css`, tail-end Light correction layers and Light-specific `!important` patching are prohibited.

### THEME-DARK-STABILITY — Light work does not redesign Dark
When the requested scope is Light, existing Dark palette, shadow, hover, elevation and semantic color intent remain the baseline. Shared formulas may be tokenized only if the default token reproduces the existing Dark result; Dark redesign requires explicit scope.

### THEME-MOTION — Theme truth is independent of animation
System `prefers-reduced-motion` and WeiG `data-motion="reduced"` may remove decorative transition/animation but must not alter saved mode, resolved Light/Dark, System change handling or Smart Auto boundary behavior.

### THEME-RETIRE — replaced Theme owners leave together
When `W.Theme` is canonical, old `core.js` Theme resolution, `app.js::toggleTheme()`, direct `#theme-btn.onclick`, duplicate Theme enums/state and Light CSS repair layers must leave in the same change; no compatibility shim or dual owner remains.

### OWNER-RETIRE-001 — replaced owners leave runtime
When a canonical owner replaces another implementation, old callers, selectors, events, state, CSS signal and test expectations leave in the same change.

### CURRENT-ONLY-001 — dev contains only current WeiG architecture
Historical WeiG implementation/test/deploy compatibility is deleted, not aliased. Current qB/WebAPI compatibility remains.

### FILE-NAMING-001 — filenames describe responsibility
No active `*-vNNN.*`, `live-vNNN.sh`, `live-qb52.sh` or equivalent version-labelled first-party file.

### TEST-CURRENT-001 — tests validate current contracts
Historical release-specific tests are not preserved. Current requirements live in current canonical tests.

### FACET-OWNER-001 — one facet state/presentation chain
Facet state = `app.js / W.LibraryController`; composition = `W.SpatialRuntime`; control = canonical Select; skin = shared UI/polish tokens.

### PRESENTATION-STATE-001 — DOM is not application state
Adaptive UI consumes semantic state/events/controllers, never another visible/hidden node as its database.

### TELEMETRY-PAINT-001 — one input, idempotent paint
DHT/Peers consumes existing `weigg:maindata`. Unchanged formatted telemetry causes zero DOM writes.

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
A Connection state has exactly one explicit status marker. Connected and firewalled may animate that marker itself only; rings, pseudo-elements, duplicate dots and expanding halos are prohibited.

### RENDERED-SIGNAL-001 — final rendering, not DOM count, is the acceptance boundary
Visual-semantic defects must be tested against the rendered result. `one DOM node` is insufficient if CSS pseudo-elements, glow rings or animation create another distinguishable signal.

### MOTION-STATUS-001 — status motion obeys Reduced Motion
System `prefers-reduced-motion` and WeiG `data-motion="reduced"` disable Connection marker motion while preserving the same single marker.

### STATUS-EXPLAIN-001 — status explanation consumes existing state
A persistent semantic status may expose canonical Tooltip + Dialog help, but the help surface consumes already available qB/WebAPI/DHT/Peers state and must not create another request, poll, port scan or capability owner.

### HEADER-UTILITY-001 — permanent Header space is purposeful
Topbar space is for identity, navigation, primary search and actionable global utilities. Passive qB product marks and redundant manual Refresh stay retired.

### HEADER-SEARCH-001 — one Search DOM/state, adaptive presentation
Torrent Search has one `#search-input` and one `app.search`. Desktop presentation is bounded full width, compact width, then icon-only; focus expands the same input. Mobile reveals the same input with the existing trigger.

### HEADER-END-ANCHOR-001 — global actions form one end rail
Desktop `Add / Theme / GitHub / WeiG Share / Logout` is one canonical end-aligned action rail. Search/navigation shrink or collapse before the action rail moves away from the right edge.

### CAPABILITY-OWNER-001 — one user-facing compatibility authority
All user-visible compatibility requirements, badges, disabled states and explanation content are owned by `W.CapabilityRegistry` plus `data/capabilities.json`. Feature modules may ask whether a capability is supported but do not duplicate thresholds/copy.

### CAPABILITY-RANGE-001 — semantic ranges, not exact-version enumeration
Capability support is evaluated against detected qBittorrent/WebAPI versions using `eq / gt / gte / lt / lte` and compound rules. Arbitrary patch releases do not need an explicit JSON entry.

### CAPABILITY-BADGE-001 — badges speak qBittorrent first
User-facing badges show the qBittorrent-facing range when known (`5+`, `4.2+`, `<5`, bounded ranges). Raw WebAPI requirements remain visible in the detail Dialog, not as the primary list label.

### CAPABILITY-DIALOG-001 — one template explains every unsupported feature
Unsupported-feature explanations use one canonical Capability Dialog driven from the same feature record that controls availability.

### CAPABILITY-COST-001 — capability evaluation is local
Capability evaluation consumes already detected `qbVersion` and `webApiVersion` plus local JSON. It never introduces per-feature API requests or polling.

### CAPABILITY-VISIBLE-001 — unsupported user features normally stay explainable
Default unsupported policy is visible + `aria-disabled` + badge + Tooltip/Dialog explanation. `hide` is reserved for explicitly internal/non-actionable surfaces.

### CAPABILITY-EXCEPTION-001 — upstream quirks live in data
Exceptional upstream boundaries use declarative `any / all / not / exact` rules in the Registry data. Feature code does not grow one-off version `if` branches.

### FEEDBACK-OWNER — transient feedback has one Current Owner
`W.Feedback` in `scripts/feedback.js` owns transient feedback template, queue, timing, update and dismissal. `W.toast(message, kind, options)` is the only public business entry. A second notifier, legacy Toast owner or feature-specific Toast system is prohibited.

### FEEDBACK-TRUTH — presentation timers never fabricate business truth
A timer controls only how long a completed notification remains visible. Processing uses `duration:0` and changes to success/warning/error only when the real Promise/business result resolves. No timer may fake success.

### FEEDBACK-ACTIVITY — processing activity is indeterminate, not fake progress
A `duration:0` processing card shows one indeterminate activity rail on the same canonical Feedback card. The rail means only “work is still active”; it never implies a business percentage. When the real result resolves, the same rail changes to the finite lifetime presentation.

### FEEDBACK-STACK — one bounded non-overlapping stack
At most four feedback cards are visible. Finite auto-dismiss cards retire FIFO; a persistent processing card does not block later finite feedback. Capacity eviction retires the oldest card through the canonical leave lifecycle.

### FEEDBACK-EXIT — leave motion precedes DOM removal
Timeout, manual dismiss and capacity eviction enter one `leaving` state and move right before removal. Remaining cards reflow from their existing DOM nodes; abrupt same-frame deletion and recreation are prohibited.

### FEEDBACK-ADAPTIVE — Desktop and Mobile share one queue/state
Desktop anchors the stack above the Statusbar at bottom-right with newest nearest the bottom. Mobile anchors inside the top safe-area with newest nearest the top. Placement may adapt; queue, lifecycle and business state may not fork.

### FEEDBACK-NOISE — routine background success stays silent
Background polling and routine refresh success do not generate feedback. User-triggered actions and actionable failures may use the stack; recurring background failure paths must not spam it.

### FEEDBACK-THEME — semantic state changes accent, not component identity
`info/success/warning/error` consume global theme/state tokens. State does not create separate geometry, radius, typography, shadow or full-color card systems. Hard-coded white/black or copied Remote Gate palettes are prohibited.

### FEEDBACK-A11Y — live semantics and dismiss control are mandatory
The canonical region uses polite live updates and additions/text relevance. Ordinary cards are atomic `status`; errors are atomic `alert`; icons/progress are decorative; dismiss has a localized accessible name and Mobile target is at least 44px.

### FEEDBACK-RETIRE — the replaced Toast implementation leaves in the same change
The old `core.js` Toast owner, old `.toast-region/.toast` CSS, `danger` Toast caller assumptions and stale tests are deleted rather than wrapped or aliased.

### TORRENT-PROGRESS-OWNER — one progress projection and DOM chain
`W.Components.progressVisual()` projects the torrent object already being rendered into the canonical progress semantic; `W.Components.progressTrack()` owns the DOM. Desktop and Mobile reuse that chain. No feature-local progress policy, qB client or polling path is allowed.

### TORRENT-PROGRESS-TRUTH — width is real qBittorrent progress
The filled width comes only from real `torrent.progress`. Decorative flow/sheen may move inside the filled area but never animates width to simulate business completion.

### TORRENT-PROGRESS-STATE — semantic state controls color/activity
Downloading, seeding, complete, paused, checking, queued, stalled and error states map locally to semantic progress color/activity from the torrent object already available to the renderer. State projection introduces zero network work and never infers business state from DOM.

### TORRENT-PROGRESS-MOTION — activity is selective and reducible
Only genuinely active download/seed/checking states use subtle flow/sheen. Completed, paused, queued, stalled and error remain static. System Reduced Motion and WeiG Reduced Motion disable decorative movement while preserving truthful width and semantic color.

## 3. Canonical owner map

```text
qB HTTP/endpoints/technical facts       W.QBClient
qB/WebAPI user-facing capability policy W.CapabilityRegistry + data/capabilities.json
Capability badge/disabled/dialog        W.CapabilityRegistry
Router URL/hash                         W.Router
Route Frame + Torrent query/page/search app.js / W.AppState
Torrent progress semantic projection    W.Components.progressVisual
Torrent progress DOM                    W.Components.progressTrack / progressCell
Torrent progress visual skin/motion     css/progress.css
Facet semantic facade                   W.LibraryController
Facet composition                       W.SpatialRuntime
Settings DOM/save                       W.SettingsRenderer / W.SettingsState
Theme preference/resolution             W.Theme / scripts/theme.js
Display time-zone state                 W.Time
Select behavior                         W.Components.selectControl()
Shared Select/Dialog primitive skin     css/ui.css
Capability/help visual skin             css/polish.css
Floating Select placement               scripts/floating.js
Transient feedback queue/lifecycle      W.Feedback / scripts/feedback.js
Transient feedback visual skin          css/feedback.css
Torrent semantics                       W.TorrentSemantics
Selection/actions                       W.Selection / ActionRegistry
Transfer samples/metadata               W.TransferRuntime
Connection semantic publisher           existing app transfer cycle -> weigg:status-state
Connection presentation/help            W.MobileAdaptive
Connection marker geometry/motion       css/layout.css
Desktop Header/Search/action geometry   css/header.css
Session/logout/BFCache                  W.SessionController / SessionGate
```

`W.QBClient.capabilities` may retain low-level endpoint facts needed by request code. It is not the owner of badge text, UI disabling or user compatibility explanations.

## 4. Capability registry contract

Runtime data uses semantic ranges, for example:

```json
{"qb":{"gte":"5.0.0"}}
{"qb":{"lt":"5.0.0"}}
{"qb":{"gte":"4.2.0","lt":"5.0.0"}}
{"webApi":{"gte":"2.3.0"}}
{"any":[{"qb":{"eq":"4.3.3"}},{"webApi":{"gte":"2.8.0"}}]}
```

Synthetic boundary strings such as `4.9.2` / `4.9.3` are valid test inputs for the range engine; they are not claims that upstream shipped those exact releases.

Known qB/WebAPI milestones are display/audit assistance only. Actual support is evaluated against the detected runtime versions. If no trustworthy qB equivalent is known for a WebAPI boundary, UI says `Upgrade / 需升级` rather than guessing.

Unsupported control contract:

```text
visible
-> aria-disabled=true
-> qB-facing badge
-> hover short reason
-> click/focus explanation
-> zero business-state mutation
-> zero extra capability requests
```

## 5. Header/Search responsive design

```text
wide desktop       ~320px Search                 actions anchored right
medium desktop     ~240px Search                 actions anchored right
narrow >820px      40px Search icon              actions anchored right
focused icon mode  same Search expands ~280px    action rail remains the anchor
mobile <=820px     existing mobile trigger        same #search-input/app.search
```

Theme `◐` is an icon-only presentation of the same canonical Select. Desktop remains in the action rail; Mobile uses the same `#theme-control` and a minimum 44px touch target.

Search is elastic content; the action rail is the stable right-edge anchor.

## 6. Torrent workspace

```text
Topbar    WeiG qB | Nav | adaptive Search | flexible space | Add Theme GitHub Blog Logout
Sidebar   Torrent states + canonical Tracker/Path/Category/Tags Selects
Workspace TorrentPanel flex:1
Statusbar Torrent count | Free space | Transfer | Connection | actionable message
```

Desktop four-card Stats remains retired; Mobile Summary uses the same state. Action order is `Start -> Pause -> More -> Delete -> Expand`. Manual Refresh remains retired.

Torrent progress width is real qB `torrent.progress`. The same canonical rail projects state as download/seed/complete/paused/checking/queued/stalled/error/idle. Download/seed/checking may show subtle motion inside the filled area; static states do not. Mobile uses the same progress projection/track as a thinner bottom-edge rail when Progress is enabled.

## 7. qB capability contract

- qB4 Private/PT remains visible with `5+`; click -> shared capability Dialog -> filter unchanged -> `0 legacy Private tracker scan`.
- Exact Private metadata requires **qBittorrent 5.0.0+**.
- Tags requires **WebAPI 2.3.0+**; known qB-facing boundary is shown as `4.2+`.
- Unknown patch releases are evaluated by range, not by lookup table membership.
- Expensive old-version emulation is not introduced unless explicitly approved.

## 8. Connection contract

```text
getTransferInfo connection_status
-> app emits weigg:status-state
-> W.MobileAdaptive paints state + explanation trigger
-> css/layout.css paints exactly one marker
```

```text
connected     success   Connected / 已连接          one gentle breathing dot
firewalled    warning   Network limited / 网络受限   one slower breathing dot
disconnected  danger    Disconnected / 未连接       one static dot
error         danger    Unavailable / 异常          one static dot
```

Hover shows a short reason. Click opens one canonical Connection Dialog with current qBittorrent, WebAPI and already-rendered network information plus troubleshooting. No port scan, API request, timer or second state owner is added.

`polish.js/css` does not own Connection state or draw a second marker.

## 9. Select and scroll boundaries

Floating Select anatomy:

```text
trigger          semantic control
floating menu    anchored top-layer surface
search input     fixed inside menu
options viewport sole internal scroll owner
```

Settings time zone continues to use the same searchable Select; no timezone-specific dropdown, wheel handler or CSS override.

## 10. Transfer/data contracts

Transfer raw samples max 900; minute buckets max 720; windows through `12 h`; no extra polling. Canonical rate = B/s; ALT preferences are normalized at QBClient boundary. `ALT Apply` uses canonical methods.

Progressive paging uses `pageSize+1`, renders current page immediately and resolves aggregate total separately.

## 11. Floating Feedback Stack

```text
business Promise/result
-> W.toast(message, kind, options)
-> W.Feedback record
-> one canonical feedback card
-> optional same-record update(...)
-> duration:0 activity rail OR finite lifetime rail
-> leaving state -> right exit -> DOM removal
```

Default completed lifetimes are `info 3800ms`, `success 3800ms`, `warning 4400ms`, `error 5200ms`. `duration:0` means persistent processing and shows an indeterminate activity rail, never fake business progress. The real business result updates that same card/rail into success/warning/error and a finite lifetime rail. Desktop births from below and exits right; Mobile births from the top safe-area and exits right. Reduced Motion removes translation/scale/activity spectacle without changing dismiss/timer semantics.

The component adds zero qB requests, zero polling and zero `QBClient` instances. Add Torrent, Settings save/readback and RSS add/reload update the same card from real asynchronous state.

## 12. Theme resolution and Light surface system

```text
W.Config.theme preference
-> W.Theme
-> resolved light | dark
-> html[data-theme]
-> canonical semantic tokens
-> Desktop/Mobile presentation
```

`system` follows the browser/OS live color-scheme signal. `time` uses the local browser/device clock and changes only at the next 08:00 or 20:00 boundary. Neither mode creates a qB request, polling loop, second timer owner or DOM-repair path.

Light visual hierarchy is deliberately different in luminance but not architecture:

```text
canvas          white / near-white
panel/card      white / very-light cool blue
hairline        cool blue-gray
focus/elevation blue with restrained violet atmosphere
semantic state existing success/warning/danger/info tokens
```

Shared spatial surfaces live in `css/spatial.css`; shared controls/Dialog remain in their canonical owners; Settings/Transfer/Logs/layout keep only feature-specific semantic variables. Dark values are the existing baseline and must resolve to the same visual intent after tokenization.

## 13. Systemic failure modes

```text
1. new UI wrapper while old owner remains
2. shared component replaced by feature-local control
3. internal Select scroll treated as page scroll
4. responsive Search implemented as a second input/controller
5. one Connection state rendered by real dot + pseudo dot/ring
6. Connection polish parses display text and becomes a second semantic owner
7. capability threshold copied into app/spatial/settings instead of Registry data
8. qB old-version fallback implemented as N per-item requests
9. unsupported feature silently hidden when explanation is useful
10. WebAPI number shown without qB-facing explanation
11. CSS correction layer added instead of changing canonical owner
12. test checks DOM existence but not interaction/final state
13. old Toast owner remains under a new visual wrapper or danger alias
14. timer changes a processing card to success without a business result
15. Desktop and Mobile create separate feedback queues
16. duration:0 processing hides all activity feedback or displays a fake percent countdown
17. Torrent progress animation changes width instead of decorating the real filled region
18. Mobile creates a second Torrent progress state map or requests qB data again
19. completed/paused/error Torrent states continue active download-style motion
20. Header and Settings each maintain their own Theme enum/state
21. Smart Auto polls every minute instead of scheduling the next boundary
22. Light fixes append a correction stylesheet or `!important` selector layer
23. Light tokenization silently redesigns the accepted Dark baseline
24. one feature semantic is asserted again in a global gate as implementation shape
25. CI failure changes correct product behavior instead of checking runtime truth first
26. tests/docs/workflow-only commit bumps product VERSION without changing webui/**
27. same VERSION is treated as permission to reuse an older SHA validation
```

Diagnosis order: Current Owner -> upstream capability -> performance -> canonical primitive -> state/render boundary -> responsive geometry -> retire old caller -> semantic/static contract -> real interaction regression -> exact-SHA evidence.

## 14. Validation contract

Representative browser validation covers qB 4.1.9.1 and 5.2.x in Dark/Light. It must execute and verify:

```text
semantic range boundaries including arbitrary 4.x patch strings and 5.0.0 boundary
qB4 Private/PT -> visible 5+ disabled state -> shared dialog -> state unchanged
qB4 Tags -> visible 4.2+ disabled state -> WebAPI 2.3.0 detail -> state unchanged
qB5 supported controls -> enabled, no stale badge
one rendered Connection marker; no ::before/::after ring
Connected marker animation and Reduced Motion static result
Connection hover explanation and click troubleshooting dialog from existing state
Desktop action rail remains at right edge at wide/medium/narrow desktop widths
Display time-zone Select real wheel scroll + selection final state
Search full/compact/icon presentation reuses one input/state
Theme Header/Settings real Select interaction -> one saved W.Theme mode
Theme System mode -> live OS/browser Light/Dark change without reload
Theme Smart Auto -> 07:59 Dark, 08:00 Light, 19:59 Light, 20:00 Dark
Theme Light -> visible Topbar/Statusbar/Settings/Input/Select/Dialog/Transfer/Logs white-based surfaces
Theme Mobile -> same canonical control/owner and >=44px touch target
Theme Reduced Motion -> unchanged saved/resolved truth with decorative motion removed
Mobile reuses the same Search, capability, Settings and Theme owners
Feedback four kinds + role semantics + long text wrapping
Feedback max-four stack + strict finite FIFO + fifth-card oldest eviction
Feedback manual/timeout right exit before removal + smooth reflow
Feedback real Add/Settings/RSS processing activity rail -> same-card finite lifetime rail
Feedback Desktop/Light/Dark + Mobile top safe-area + both Reduced Motion authorities
Torrent download/seed/complete/paused/error/checking/queued/stalled -> truthful width + semantic color/activity
Torrent active motion -> both Reduced Motion authorities static
Mobile Torrent progress -> same canonical state/width/rail, not a second owner
```

Real exact-SHA qB 4.1.9.1 + 5.2.x LIVE remains mandatory before promotion. `main` never moves without explicit maintainer authorization.

## 15. Gate ownership and product-version scope

### GATE-OWNER-001 — one gate owns one validation responsibility
Global `runtime-contract.mjs` protects only repository-wide runtime invariants. Theme, Feedback, Capability and Torrent semantics remain in their feature contracts; browser gates own real interaction/final rendered truth. A global gate must not duplicate feature implementation shape.

### GATE-SEMANTIC-001 — semantic truth beats implementation shape
A failing assertion is not proof that product behavior is wrong. Inspect runtime/computed/API/final state first. If product semantics are correct and a gate is stale or shape-locked, repair the gate rather than reverting correct product code.

### GATE-SYNTAX-001 — syntax has one owner
`syntax-contract.mjs` owns runtime/test JavaScript syntax validation. `package.json` does not maintain a second list of `node --check` callers.

### VERSION-WEBUI-001 — product VERSION follows webui/** only
A patch VERSION increment is required only when the formal change modifies product content under `webui/**` (apart from the version-file synchronization itself). Tests, workflows, docs, DESIGN, installer and gate-only changes keep the existing product VERSION. When `webui/**` changes, `VERSION`, `webui/VERSION` and `package.json.version` update together.

### EXACT-SHA-EVIDENCE-001 — validation belongs to SHA, not VERSION
The same product VERSION may appear on multiple dev commits when only repository infrastructure changes. Every new commit has a new exact SHA, and CI/LIVE/candidate/artifact evidence from an older SHA is not inherited even when VERSION is unchanged.

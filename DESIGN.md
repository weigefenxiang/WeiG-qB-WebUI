# WeiG qB WebUI — Design System

Status: **Current Semantic Ownership**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.0**

> Current visual, interaction and first-party ownership authority. The engineering discipline follows `awesome-design-md`: explicit hierarchy, semantic tokens, reusable primitives, responsive behavior, interaction states, Do/Don't rules and documented failure modes instead of screenshot-specific patches.

## 1. Non-negotiable architecture

1. One semantic purpose has one Current Owner.
2. Canonical Button / Select / Dialog / Input / Card / Theme primitives are reused; feature-local copies are prohibited.
3. Historical WeiG runtime/tests/deploy tools are not compatibility baggage in `dev`; Git history is the archive.
4. First-party filenames describe stable responsibility, never WeiG release versions or qB versions.
5. Current semantic identifiers describe stable responsibility and never carry numeric revision suffixes such as `-001/-002`; Git history owns revisions.
6. `MutationObserver`, monkey patch, post-render repair layers, duplicate polling and dual owners are prohibited.
7. Presentation modules do not own qB clients, business state or polling.
8. Current qBittorrent/WebAPI facts remain explicit, including source-derived release/action/filter/parameter facts and protocol milestones such as `qBittorrent 5.0.0+` / `WebAPI 2.3.0+` where those facts remain relevant.
9. Mobile is adaptive presentation of the same application state, not a second app.
10. Light/Dark and Reduced Motion are first-class acceptance dimensions.
11. Exact Git SHA is code/cache/test identity. Product patch `VERSION` increments only when formal `webui/**` product content changes; non-product tree changes create a new SHA without changing product VERSION.

## 2. Shared component and state rules

### OWNER-RETIRE — replaced owners leave runtime
When a canonical owner replaces another implementation, old callers, selectors, events, state, CSS signal and stale test expectations leave in the same change. Compatibility shims, runtime aliases and hidden bridge UIs are not retirement.

### PRESENTATION-STATE — DOM is not application state
Presentation callers consume controllers/events/semantic state. Hidden labels, counters, table headers, dialogs or CSS classes are never read back as the database for another feature.

### CONTROL-SKIN — one Select/Dialog primitive system
`W.Components.selectControl()` owns Select behavior/mode. Shared Select/Dialog skin belongs to `css/ui.css`; feature modules provide semantic content and bounded geometry only.

### SELECT-SCROLL — internal Select scrolling is not anchor scrolling
`.ui-select__options` owns its wheel/touch/scroll position. Internal menu scrolling never re-runs floating anchor placement or resets list position.

### SELECT-TOPLAYER — top-layer Select remains canonical
When a modal needs native reliability it still uses `W.Components.selectControl({native:true})`; no second Select system.

### DIALOG-SCROLL — shell is not the scroll owner
`dialog.dialog` stays bounded with `overflow:hidden`; only genuinely overflowing body/form/list regions scroll.

### INTERACTION-TEST — test action and final state
Critical browser tests perform the real user action and assert semantic transition plus final visible/computed state. Element existence or an implementation string alone is not PASS.

### PROGRESSIVE-DATA — aggregate work never blocks primary data
Current-page data renders first. Aggregate count/index/enrichment is background work with bounded loading/error state.

### COMPAT-DEGRADE — honest capability degradation
If the exact upstream release surface does not expose an authoritative capability, the normal control is not rendered. Attempted routes/actions may use one canonical capability notice where needed; expensive emulation is prohibited unless product approval explicitly requires a fallback.

### PERF-COMPAT — no collection N→N API fallback
List/filter/refresh compatibility must not default to `N items -> N requests`. Prefer capability degradation when authoritative/batch support is absent and emulation is expensive.

### TIMESERIES — bounded history
Realtime history is bounded; longer windows do not increase network polling or create unbounded samples.

### CURRENT-ONLY — dev contains only current WeiG architecture
Historical WeiG implementation/test/deploy compatibility is deleted rather than aliased. Current qB/WebAPI compatibility facts remain.

### FILE-NAMING — filenames describe responsibility
Active first-party runtime/tests/deploy files use stable responsibility names and do not encode WeiG release versions or qB versions.

### SEMANTIC-NAMING — identifiers describe responsibility
Current architecture rule names use stable semantic identifiers such as `COMPAT-DEGRADE`, `CAPABILITY-RANGE` and `BROWSER-RUNTIME`. Numeric revision suffixes such as `-001/-002/-003` are prohibited. Git history/tags/Releases are the revision archive. qBittorrent/WebAPI/Playwright versions remain legal where they are current upstream, protocol or dependency facts.

### TEST-CURRENT — tests validate current contracts
Historical release-specific test copies are not preserved. Current requirements live in current canonical tests.

## 3. Torrent workspace owner map

```text
qB stable source/release facts           tools/qb-release-catalog.mjs -> W.ReleaseProfile
qB HTTP/endpoints/transport              W.QBClient
qB/WebAPI user capability policy         W.CapabilityRegistry + data/capabilities.json
Torrent status/filter semantic truth     W.TorrentSemantics
Torrent filter presentation              W.TorrentFilterView
Route / page / Torrent query / sort      app.js / W.AppState / W.LibraryController
Torrent row/card DOM                     W.Components
Torrent field registry/preferences       W.TorrentFieldRegistry
Torrent progress semantic projection     W.Components.progressVisual
Torrent progress DOM                     W.Components.progressTrack / progressCell
Torrent progress skin/motion             css/progress.css
Facet semantic state                     W.LibraryController
Facet composition                        W.SpatialRuntime
Facet DOM location                       Sidebar / #sidebar-facet-slot
Selection/actions                        W.Selection / ActionRegistry
Transfer samples/metadata                W.TransferRuntime
Connection semantic publisher            app transfer cycle -> weigg:status-state
Connection presentation/help             W.MobileAdaptive
Connection marker geometry/motion        css/layout.css
Header Search dispatch/theme/utilities   W.HeaderUtilities
RSS query/presentation                   W.RSS / ui.js
Logs query/runtime                       W.Logs / logs.js
Header geometry                          css/header.css
Responsive placement                     W.MobileAdaptive
DataGrid sizing/resize                    W.DataGrid
Dialog normalization                     W.LayoutRuntime
```

### FACET-OWNER — one facet chain
Facet state = `W.LibraryController`; composition = `W.SpatialRuntime`; control = canonical Select; skin = shared UI tokens. Desktop Sidebar and Mobile Drawer use the same `#facet-controls`, permanently below Torrent state filters. A Mobile horizontal facet shelf is prohibited. On Mobile/Android, the same facet controls use a two-column responsive grid; semantic state and control instances do not change.

### MOBILE-LIBRARY-IA — one library, adaptive placement
Mobile primary library order is: Topbar → compact toolbar → Torrent cards → Pager/action rail; filters/facets live in Drawer. Desktop and Mobile do not render Download/Upload/Network/Torrent summary cards.

### MOBILE-CONTROL-DENSITY — compact appearance without a second control system
Mobile Select/Columns/Sort/page-size keep a usable interaction target while the visible surface is inset/compact. Geometry may adapt; component skin and behavior remain canonical.

### MOBILE-ACTION-PLACEMENT — one Selection toolbar
`#torrent-selection-toolbar` is one DOM/action owner. Desktop mounts it in `#torrent-action-slot`; Mobile mounts the same node in `#mobile-pager-actions-slot`. Duplicate buttons, enabled-state mirroring and duplicate handlers are prohibited.

### MOBILE-ACTION-DIALOG — same actions, adaptive two-column layout
`ActionRegistry` remains the only Torrent action owner. The More Actions dialog uses the same action nodes on Desktop and Mobile; Mobile keeps a two-column grid with readable adaptive text and usable hit targets. A Mobile-only one-column action implementation or duplicated action registry is prohibited.

### MOBILE-CARD-COMPOSITION — title first, metrics second
Canonical Mobile Torrent card first line is selection + title + More. Configured metrics occupy the second line. When progress is configured, the canonical real progress rail and truthful percentage form one inline cluster with the percentage immediately to the rail's right; a second bottom-edge progress rail is prohibited.

### SORT-OWNER — semantic sort is not a DOM bridge
`app.sort + app.reverse`, exposed through `W.LibraryController`, is the only sort truth. Desktop table headers and Mobile Sort Select are callers. Hidden Columns dialogs, temporary columns, programmatic hidden-header clicks and `weigg.mobileSort` second state are prohibited.

### TORRENT-RENDERER-OWNER — Components owns renderer functions
`W.Components.torrentRow()` and `W.Components.mobileTorrentCard()` are canonical definitions. `ui.js` may supply field registry/config UI but may not replace renderer functions after load. Responsive code may not replace `W.VirtualList` or `W.Components.state`; Layout code may not replace `W.DataGrid` methods.

### TORRENT-FILTER-OWNER — one status semantic chain
`W.ReleaseProfile` exposes which upstream filter names exist for the exact stable release; `W.TorrentSemantics` canonicalizes and evaluates those states; `W.TorrentFilterView` renders the controls; `app.js` and `selection.js` are callers. They may not duplicate state regex policy. Completion (`progress >= 1`) is not itself proof of seeding; seeding comes from upstream seeding/upload state.

## 4. Torrent progress

### TORRENT-PROGRESS-OWNER
One `W.Components` projection/DOM chain owns Torrent progress. Mobile reuses it and adds zero client/polling work.

### TORRENT-PROGRESS-TRUTH
Filled width comes only from real `torrent.progress`. Decorative movement never fabricates completion.

### TORRENT-PROGRESS-STATE
Downloading, seeding, complete, paused, checking, queued, stalled and error project locally to semantic color/activity from the already-rendered torrent object.

### TORRENT-PROGRESS-MOTION
Only active download/seed/checking uses subtle flow/sheen. Completed/paused/queued/stalled/error remain static; System and WeiG Reduced Motion disable decorative movement while preserving truthful width/color/state.

## 5. Header / Search

### HEADER-UTILITY
Permanent Topbar space is for identity, navigation, primary Search and actionable global utilities. Passive qB product marks and redundant Refresh remain retired.

### HEADER-SEARCH
There is exactly one `#search-input`. `W.HeaderUtilities` owns route-aware presentation/dispatch, not a second query store: Home/Torrents delegates to the existing `app.search` / `W.LibraryController`; RSS delegates to `W.RSS.query`; Logs delegates to `W.Logs.query`. RSS and Logs do not render page-local Search icons or inputs. Wide/medium/narrow Desktop changes geometry only. Mobile reveals the same input as a layer anchored below Topbar; opening Search must not change Topbar height or push other header actions outside the viewport.

### TOOL-SEARCH-STATE
Changing routes changes the Header Search placeholder/value to that route's semantic query without copying state between tools. A query belongs to its route owner; Header only dispatches input and reflects that owner's current value.

### RSS-ACTIONS
RSS page chrome keeps Add Feed and Refresh in the page-title action rail. Feed URL is temporary input inside the canonical Dialog opened by Add Feed; it is not a permanent second Search-like field in the RSS content surface.

### LOGS-CONTROLS
Logs page chrome contains filters, Follow, canonical size Select and Refresh only. Log query is driven exclusively by Header Search. Feature CSS may size the canonical Select but may not draw a second shell/border around it. On Mobile, Normal/Info/Warning/Critical form one segmented level list and share one non-wrapping horizontal control rail with Follow, size Select and Refresh; narrow layouts collapse Refresh to its icon and then scroll the rail horizontally instead of creating a second row.

### HEADER-END-ANCHOR
Desktop Add / Theme / GitHub / WeiG Share / Logout forms one right-edge action rail. Search/navigation collapses before this rail loses its end anchor.

## 6. Telemetry / Connection

### TELEMETRY-PAINT
One semantic telemetry source feeds presentation. Same formatted value produces no unnecessary DOM churn.

### STATUS-NOISE
Routine background polling success is silent.

### STATUS-DEDUP
Durable connection/transfer facts are not repeated as primary-workspace summary cards. Desktop uses Statusbar; Mobile does not create a second Network Summary state owner.

### STATUS-PLACEMENT
Persistent telemetry uses the cheapest existing surface and does not spend Torrent workspace height unnecessarily.

### ADAPTIVE-STATUS
Desktop/Mobile placement never creates another qB client, timer, state store or reconciliation path.

### MOBILE-DRAWER-TELEMETRY — move canonical status nodes
Mobile Drawer reuses the same `#status-torrents`, `#status-free-space`, `#transfer-capsule` and `#status-connection` DOM/semantic owners that Desktop places in the Statusbar. Its visual/accessibility order is transfer history → transfer/connection → Torrent/storage, with Torrent/storage physically last; cloning, mirrored counters and duplicate event handlers are prohibited. qBittorrent/WebAPI/compatibility metadata remains available through Desktop/connection surfaces but does not consume Mobile Drawer height. Mobile/Android Torrent state filters and facets both use two-column responsive grids above telemetry, while that filter/facet region remains the Drawer scroll owner.

### TRANSFER-CHART-ADAPTIVE — one bounded history, window and renderer
`W.TransferRuntime` is the only transfer sample/history source. `W.Transfer.drawRateChart()` renders both the full Transfer dialog and the compact Mobile Drawer chart. Both consume the same selected chart window (`1 min` through `12 h`); changing the full dialog window updates Drawer label/data immediately. The Drawer chart does not repeat download/upload speed text already present in the canonical transfer capsule. It adds no API request, timer, polling loop or second history store; tapping it opens the canonical Transfer statistics dialog.

### LIVE-INDICATOR
Connection motion consumes existing `connection_status` only.

### STATUS-SIGNAL
One semantic Connection state has one visible marker. Expanding rings/pseudo dots/duplicate halos are prohibited.

### RENDERED-SIGNAL
Acceptance is the final rendered result, not DOM node count alone.

### MOTION-STATUS
System and WeiG Reduced Motion disable marker animation while keeping the same semantic state.

### STATUS-EXPLAIN
Connection Tooltip/Dialog consumes already available qB/WebAPI/DHT/Peers state from existing semantic owners. It performs no extra request, poll, port scan or capability probe.

## 7. Capability system

### CAPABILITY-OWNER
Exact supported-stable source facts are owned by the generated qB release catalog and `W.ReleaseProfile`; user-visible availability/presentation policy is owned by `W.CapabilityRegistry + data/capabilities.json`. `W.QBClient` consumes the result and does not recreate version policy.

### CAPABILITY-SOURCE
For source-bound features, exact release action/filter/parameter presence outranks heuristic version ranges. Version ranges remain declarative fallback/diagnostic facts where no exact source surface is available. Unknown capability identifiers fail closed.

### CAPABILITY-RANGE
Fallback/version-display logic uses semantic `eq / gt / gte / lt / lte` and compound rules, not exact patch enumeration in callers.

### CAPABILITY-BADGE
Badges are diagnostic/notice content only when a capability surface is intentionally shown. A trustworthy qB milestone may be displayed as a full semantic version; no qB-facing milestone is invented from a WebAPI fact.

### CAPABILITY-DIALOG
One canonical Capability Dialog explains an attempted unavailable route/action when a notice is appropriate.

### CAPABILITY-COST
Capability evaluation consumes already detected versions + local generated catalog/JSON. It adds no per-feature request or polling.

### CAPABILITY-HIDE
A control/facet/filter absent from the exact upstream release surface is absent from normal UI. Unsupported controls are not kept as disabled badge clutter. Desktop and Mobile consume the same capability state and the same control instance where the control exists.

### CAPABILITY-EXCEPTION
Upstream quirks live in declarative/source-derived facts, not one-off caller version branches.

Known current facts include the `private` torrents/info surface in qB 5.x and Tags through the upstream Tags action; WebAPI milestone facts such as 2.3.0 remain recorded where useful, but exact supported-stable source provenance decides source-bound availability.

Current supported stable range is **qBittorrent 4.1.0 → latest official stable**. The catalog is regenerated from upstream source and every supported stable tag is audited; the count/latest version is intentionally not hard-coded in this document. Linux/Windows browser gates exercise representative floor/modern sessions while `tests/upstream-release-audit.mjs` owns complete stable-tag source compatibility.

## 8. Theme

### THEME-OWNER
`W.Theme / scripts/theme.js` is the only Theme preference/resolution owner. `W.Config` persists preference only; Header/Settings are callers.

### THEME-MODE
Saved Theme mode is exactly `system / time / light / dark`.

### THEME-RESOLUTION
Saved preference is not rendered theme. DOM/native controls consume resolved `html[data-theme=light|dark]`.

### THEME-SYSTEM
System mode uses one live `prefers-color-scheme` listener and no polling.

### THEME-TIME
Smart Auto schedules the next 08:00/20:00 boundary; no minute loop.

### THEME-SURFACE
Light is a semantic white/cool-blue-violet system. `spatial.css` owns shared surface/elevation tokens. `light-fix.css`, tail correction layers and hard-coded feature-local theme copies are prohibited.

### THEME-DARK-STABILITY
Shared token refactoring must reproduce the accepted Dark baseline unless Dark redesign is explicitly in scope.

### THEME-MOTION
Theme state remains correct under System/WeiG Reduced Motion.

### THEME-RETIRE
Old Theme resolution/toggle owners and Light repair layers leave when `W.Theme` is canonical.

### NATIVE-THEME
Canonical native controls follow resolved Light/Dark tokens and `color-scheme`.

## 9. Feedback

### FEEDBACK-OWNER
`W.Feedback / scripts/feedback.js` owns transient feedback queue/template/timing/update/dismissal; `W.toast()` is the public business entry.

### FEEDBACK-TRUTH
Presentation timers never fabricate business truth.

### FEEDBACK-ACTIVITY
`duration:0` processing uses an indeterminate activity rail; it is not business percentage.

### FEEDBACK-STACK
One bounded stack, maximum four visible records; finite auto-dismiss is FIFO.

### FEEDBACK-EXIT
Leave state/motion precedes DOM removal; remaining cards reflow without recreation.

### FEEDBACK-ADAPTIVE
Desktop/Mobile share one queue/lifecycle; only placement changes.

### FEEDBACK-NOISE
Routine background success stays silent.

### FEEDBACK-THEME
Semantic kind changes accent, not component identity.

### FEEDBACK-A11Y
One live region; status/alert roles and Mobile dismiss target remain accessible.

### FEEDBACK-RETIRE
Legacy Toast owners/CSS/caller assumptions are deleted, not wrapped.

## 10. Release / gate discipline

### GATE-OWNER — one gate owns one validation responsibility
Global runtime gates protect repository-wide invariants only. Feature semantics stay in feature contracts and browser gates own real interaction/final rendered truth.

### GATE-SEMANTIC — semantic truth before implementation shape
Feature gates prefer runtime/API/computed/final-state truth. A stale gate bound to old DOM/CSS/package-script shape is repaired rather than forcing correct product behavior back to an old implementation.

### GATE-NAMING — naming has one owner
`tests/naming-contract.mjs` owns stable first-party filename policy, revision-neutral semantic identifiers and the rule that `DESIGN.md` does not carry a parallel document revision number.

### GATE-SYNTAX — syntax has one owner
`tests/syntax-contract.mjs` owns runtime/test JavaScript syntax validation only.

### VERSION-PRODUCT — only webui product changes increment patch VERSION
Only a formal change to product content under `webui/**` increments patch VERSION. When `webui/**` changes, `VERSION`, `webui/VERSION` and `package.json.version` move together in the same final state; `package-lock.json` root package version mirrors the same product version. Changes limited to tests, fixtures, workflows, docs, DESIGN, installers, CI/gates, package test scripts, test dependencies or lockfiles keep the current product VERSION. Browser fixtures read canonical VERSION and do not hard-code product patch versions.

### EXACT-SHA-EVIDENCE — validation belongs to SHA
Every new Git SHA invalidates older CI/LIVE/candidate/artifact evidence. VERSION does not authorize evidence reuse, including when a non-product change correctly keeps the same VERSION.

### SAFE-REF — dev writes are race-safe
Formal development uses `dev`; `main` is untouched without explicit authorization. Before write and before ref update, re-read current dev exact HEAD. Update only by safe fast-forward with `force:false`.

### BROWSER-RUNTIME — hosted Chrome is the only CI browser runtime
`tests/browser-driver.mjs` is the only Playwright launch-policy owner. The current `browser-*.mjs` semantic gates are callers and may not import Playwright directly, select a channel, set an executable path or implement fallback policy. Playwright JS is exact-pinned by `package.json + package-lock.json`.

Linux routine UI, Linux candidate and Windows candidate all use the Google Chrome Stable already supplied by their pinned GitHub-hosted runner generation. CI must not run `playwright install`, `playwright install-deps`, dynamic `npm install ... playwright`, manual Chromium downloads or browser-specific apt provisioning. Missing hosted Chrome fails closed; it never falls back to a Playwright-managed browser.

Hosted Chrome itself may update between runs. Therefore browser evidence is traceable as `exact Git SHA + package-lock + runner image + exact logged Chrome version`; it is not a claim that the same SHA always replays against the same browser binary.

### RELEASE-CATALOG-ARTIFACT — one audited source catalog ships everywhere
Candidate CI generates the qB stable release catalog from the upstream source checkout used for the full stable audit, passes that exact catalog as a SHA-bound artifact to release packaging, and embeds it at `private/data/qb-releases.json`. Virtual qB Pages injects the same catalog shape into each built product source. Release ZIP and Pages must not diverge into exact-source versus heuristic compatibility modes.

## 11. Do / Don't

Do:

- reuse canonical Select/Dialog/Button/Input/Card/Theme/Feedback;
- use semantic controllers/state as presentation input;
- keep one owner and retire replaced callers in the same change;
- audit Desktop/Mobile + Light/Dark + Reduced Motion;
- validate real interaction/final state;
- use exact SHA tree/files for repo-wide ownership audits when search can be incomplete;
- keep Playwright dependency identity in `package-lock.json` and log hosted Chrome identity in every browser gate;
- regenerate/audit the supported stable qB source catalog instead of hard-coding release counts;
- use revision-neutral semantic identifiers and let Git history own revisions.

Don't:

- add `*-fix.css`, versioned runtime or tail patch layers;
- add numbered semantic revisions such as `FOO-001` or `FOO-002`;
- use MutationObserver repair, monkey patch, dual renderer or compatibility shim;
- create a second QBClient/polling path;
- read hidden DOM as business state;
- implement Mobile Sort by clicking hidden Desktop UI;
- restore summary cards or Mobile facet/command shelves;
- render controls the exact upstream source surface does not support merely to display an upgrade badge;
- hide stale code instead of deleting its owner/callers/tests;
- dynamically install Playwright or provision Chromium inside CI browser jobs;
- treat a red assertion as proof the product is wrong before inspecting runtime truth.

## 12. Current visual acceptance

The Torrent workspace acceptance matrix includes:

```text
Desktop / Mobile
Dark / Light
System Reduced Motion / WeiG Reduced Motion
qB 4.1.0 floor / latest stable representative compatibility
source-derived Torrent filter set; unsupported filters are absent
source-derived Tags/Private capability visibility
Sidebar facets below state filters
no four-card summary on any viewport
compact Mobile toolbar with canonical controls
same Selection toolbar beside Mobile pager
Mobile More Actions keeps two columns with contained adaptive labels
Mobile two-line card + canonical inline progress rail/percentage
one route-aware Header Search for Torrents / RSS / Logs
RSS title rail owns Add Feed + Refresh; Feed URL lives in Dialog
Logs has no page-local Search; Mobile uses one segmented level list + Follow + canonical size Select + Refresh on one horizontal rail
Mobile Search anchored below Topbar without clipping actions
Mobile Drawer uses two-column Torrent state/facet grids and reuses Statusbar telemetry in chart → transfer/connection → Torrent/storage order while hiding version metadata
Desktop one-row Header/end rail/DataGrid/Statusbar stability
```

The design objective is reduced duplicate ownership and clearer information hierarchy, not fewer files or fewer gates for their own sake.

## 13. Settings semantic runtime

### SETTINGS-OWNER — one Preference semantic owner
`W.SettingsSchema` owns qB preference surface, section, type, unit, enum, editability and future fallback. `W.ReleaseProfile` supplies the exact stable-release getter/setter descriptors; `W.QBClient` only transports `app/preferences` and `app/setPreferences`; `settings.js` is the presentation caller. `W.Transfer` owns bounded transfer telemetry and the quick global/alternate rate-limit dialog; it does not own whether those qB Preferences are present or classified in Settings.

### SETTINGS-ROUTING — semantic routing before fallback
Preference routing is exact schema → semantic family rule → Advanced / Upstream fallback. Per-version runtime copies, qB patch allowlists and versioned Settings implementations are prohibited. The canonical Speed surface owns global/alternate speed Preferences plus scheduler/uTP/TCP/LAN rate-limit policy; Advanced must not duplicate those keys.

### SETTINGS-WRITE-PROVENANCE — setter proof decides editability
For an exact stable profile, a qB Preference is editable only when its source descriptor proves a setter is present, its write type is resolved, getter/setter types do not conflict, and the descriptor is writable. Getter-only, unresolved, missing-descriptor and type-conflict fields remain visible but read-only. Every control kind consumes this editability, and save-time payload filtering repeats the same canonical check as defense in depth.

### SETTINGS-STRUCTURED — safe unknown values
Unknown/scalar Preferences may be routed and rendered from their actual value/read type, but source-unproven scalars remain read-only. Arrays/objects remain visible as read-only structured JSON even when a raw setter exists, until a dedicated authoritative structured editor contract is implemented. `[object Object]` presentation and blind structured writeback are prohibited.

### SETTINGS-VISUAL — reuse canonical primitives
Settings reuses existing `settings-section`, `settings-grid`, `setting-row`, `field-input setting-input`, `switch-control` and `W.Components.selectControl()` primitives. Feature-local Settings CSS, a second Select/Input/Dialog skin, or Mobile-only business state is prohibited.

### SETTINGS-MOBILE-FLOW — long copy stacks the same canonical control
Mobile keeps short Settings rows side-by-side. When rendered description copy exceeds roughly two lines, the same control moves below the copy and may use the full row width. A closed Select remains one line with ellipsis; its menu exposes the complete option text. Time-zone labels remain owned by `W.Time.displayLabel()` and are not rewritten by responsive presentation.

### SETTINGS-GENERATION-AUDIT — every supported stable release
The generated stable catalog starts at qBittorrent 4.1.0 and discovers every numeric official stable tag through the latest release. Each profile derives Preferences getter/setter descriptors, API actions, Torrent filter names and `torrents/info` parameters from that release's source. `tests/upstream-release-audit.mjs` validates the full set; Pages Preferences verification exercises the published stable matrix rather than a hand-picked `5.x.0` generation list.

## 14. Virtual qB Lab

### SIMULATOR-BOUNDARY — simulate behind QBClient
WeiG Virtual qB Lab is a non-product backend simulator. Formal `webui/**` remains unmodified and continues to use the canonical `W.QBClient`; the Lab intercepts qB WebAPI traffic through a Native Service Worker and never replaces or monkey-patches the product client.

### SIMULATOR-OWNER — one virtual daemon state machine
`QBSimulatorEngine` owns the canonical virtual qB world. `QBScheduler` owns activity/resource allocation, `QBPolicyEngine` owns limits/queue/ratio rules, `QBProtocolRouter` owns WebAPI routing, `QBVirtualDatabase` owns IndexedDB persistence, and Service Worker code is an adapter only. Separate Pages/browser/fixture simulator state machines are prohibited.

### SIMULATOR-UPSTREAM — official stable facts, synthetic runtime data
`QBStableReleaseCatalog` discovers numeric official qBittorrent stable tags from 4.1.0 onward and extracts WebAPI/version/API/preference/Torrent-surface facts from the corresponding upstream source. Alpha/beta/rc/master are excluded. Runtime Torrent/peer/network/disk data may be synthetic but must be seeded, deterministic and internally consistent.

### SIMULATOR-AUTH — demo login follows real product flow
Virtual qB accepts arbitrary credentials. Lab presentation may prefill `demo/demo` only in the generated Pages artifact; Clean Mode leaves the product login source untouched. Logout invalidates the virtual session so protected API calls return 403 and the existing `SessionController` completes the real logout verification flow.

### SIMULATOR-POLICY — settings have observable effects
A simulator setting marked modeled must affect virtual behavior. Global/per-torrent rate limits, active Torrent limits, connection/upload slot limits, queueing, Force Start, Ratio and seeding-time policies must constrain the same Scheduler snapshot consumed by Torrent rows, `transfer/info` and `sync/maindata`. Returning success without the corresponding semantic change is prohibited.

### SIMULATOR-FUTURE — discover first, never guess UX semantics
A future stable qB release may be auto-discovered for Virtual Lab metadata without a product VERSION bump or `webui/**` write. Unknown upstream preference keys remain visible through the safe Settings routing system, but writeback requires exact setter/type provenance and structured values remain read-only until their dedicated contract exists. Weekly automation must not invent units, enums, ranges or interaction semantics. Formal Settings UX improvements remain product work owned by `W.SettingsSchema`.

### SIMULATOR-WORKFLOW-GATE — Actions require separate approval
Simulator core, protocol, storage, tests, launcher and local Pages artifact tooling may be developed on `dev`. Adding/enabling Pages deployment permissions, scheduled weekly refresh or a new workflow is a separate workflow boundary and requires explicit user confirmation before write. The detailed architecture and scope live in `docs/009.Virtual-qB-Lab.md`.

# WeiG qB WebUI — Design System

Status: **Current Semantic Ownership**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> Current visual, interaction and first-party ownership authority. The engineering discipline follows `awesome-design-md`: explicit hierarchy, semantic tokens, reusable primitives, responsive behavior, interaction states, Do/Don't rules and documented failure modes instead of screenshot-specific patches.

## 1. Non-negotiable architecture

1. One semantic purpose has one Current Owner.
2. Canonical Button / Select / Dialog / Input / Card / Theme primitives are reused; feature-local copies are prohibited.
3. Historical WeiG runtime/tests/deploy tools are not compatibility baggage in `dev`; Git history is the archive.
4. First-party filenames describe stable responsibility, never WeiG release versions or qB versions.
5. Current semantic identifiers describe stable responsibility and never carry numeric revision suffixes such as `-001/-002`; Git history owns revisions.
6. `MutationObserver`, monkey patch, post-render repair layers, duplicate polling and dual owners are prohibited.
7. Presentation modules do not own qB clients, business state or polling.
8. Current qBittorrent/WebAPI facts remain explicit, including `qBittorrent 5.0.0+` and `WebAPI 2.3.0+`.
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
If older upstream lacks an authoritative/batch capability, prefer a visible capability notice over expensive emulation unless product approval explicitly requires a fallback.

### PERF-COMPAT — no collection N→N API fallback
List/filter/refresh compatibility must not default to `N items -> N requests`. Prefer capability degradation when authoritative/batch support is absent and emulation is expensive.

### TIMESERIES — bounded history
Realtime history is bounded; longer windows do not increase network polling or create unbounded samples.

### CURRENT-ONLY — dev contains only current WeiG architecture
Historical WeiG implementation/test/deploy compatibility is deleted rather than aliased. Current qB/WebAPI compatibility facts remain.

### FILE-NAMING — filenames describe responsibility
Active first-party runtime/tests/deploy files use stable responsibility names and do not encode WeiG release or qB release numbers.

### SEMANTIC-NAMING — identifiers describe responsibility
Current architecture rule names use stable semantic identifiers such as `COMPAT-DEGRADE`, `CAPABILITY-RANGE` and `BROWSER-RUNTIME`. Numeric revision suffixes such as `-001/-002/-003` are prohibited. Git history/tags/Releases are the revision archive. qBittorrent/WebAPI/Playwright versions remain legal where they are current upstream, protocol or dependency facts.

### TEST-CURRENT — tests validate current contracts
Historical release-specific test copies are not preserved. Current requirements live in current canonical tests.

## 3. Torrent workspace owner map

```text
qB HTTP/endpoints/technical facts       W.QBClient
qB/WebAPI user capability policy        W.CapabilityRegistry + data/capabilities.json
Route / query / page / search / sort    app.js / W.AppState / W.LibraryController
Torrent row/card DOM                    W.Components
Torrent field registry/preferences      W.TorrentFieldRegistry
Torrent progress semantic projection    W.Components.progressVisual
Torrent progress DOM                    W.Components.progressTrack / progressCell
Torrent progress skin/motion            css/progress.css
Facet semantic state                    W.LibraryController
Facet composition                       W.SpatialRuntime
Facet DOM location                      Sidebar / #sidebar-facet-slot
Selection/actions                       W.Selection / ActionRegistry
Transfer samples/metadata               W.TransferRuntime
Connection semantic publisher           app transfer cycle -> weigg:status-state
Connection presentation/help            W.MobileAdaptive
Connection marker geometry/motion       css/layout.css
Header Search/theme/utilities            W.HeaderUtilities
Header geometry                         css/header.css
Responsive placement                    W.MobileAdaptive
DataGrid sizing/resize                   W.DataGrid
Dialog normalization                    W.LayoutRuntime
```

### FACET-OWNER — one facet chain
Facet state = `W.LibraryController`; composition = `W.SpatialRuntime`; control = canonical Select; skin = shared UI tokens. Desktop Sidebar and Mobile Drawer use the same `#facet-controls`, permanently below Torrent state filters. A Mobile horizontal facet shelf is prohibited.

### MOBILE-LIBRARY-IA — one library, adaptive placement
Mobile primary library order is: Topbar → compact toolbar → Torrent cards → Pager/action rail; filters/facets live in Drawer. Desktop and Mobile do not render Download/Upload/Network/Torrent summary cards.

### MOBILE-CONTROL-DENSITY — compact appearance without a second control system
Mobile Select/Columns/Sort/page-size keep a usable interaction target while the visible surface is inset/compact. Geometry may adapt; component skin and behavior remain canonical.

### MOBILE-ACTION-PLACEMENT — one Selection toolbar
`#torrent-selection-toolbar` is one DOM/action owner. Desktop mounts it in `#torrent-action-slot`; Mobile mounts the same node in `#mobile-pager-actions-slot`. Duplicate buttons, enabled-state mirroring and duplicate handlers are prohibited.

### MOBILE-CARD-COMPOSITION — title first, metrics second
Canonical Mobile Torrent card first line is selection + title + More. Configured metrics, including progress/rates/status, occupy the second line. The same canonical real progress rail may sit on the bottom edge.

### SORT-OWNER — semantic sort is not a DOM bridge
`app.sort + app.reverse`, exposed through `W.LibraryController`, is the only sort truth. Desktop table headers and Mobile Sort Select are callers. Hidden Columns dialogs, temporary columns, programmatic hidden-header clicks and `weigg.mobileSort` second state are prohibited.

### TORRENT-RENDERER-OWNER — Components owns renderer functions
`W.Components.torrentRow()` and `W.Components.mobileTorrentCard()` are canonical definitions. `ui.js` may supply field registry/config UI but may not replace renderer functions after load. Responsive code may not replace `W.VirtualList` or `W.Components.state`; Layout code may not replace `W.DataGrid` methods.

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
Torrent Search has exactly one `#search-input` and one `app.search`. Wide/medium/narrow Desktop changes geometry only. Mobile `W.HeaderUtilities` reveals the same input as a layer anchored below Topbar; opening Search must not change Topbar height or push other header actions outside the viewport.

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
All user-visible compatibility requirements, badges, disabled states and explanation copy are owned by `W.CapabilityRegistry + data/capabilities.json`.

### CAPABILITY-RANGE
Support uses semantic `eq / gt / gte / lt / lte` and compound rules, not exact patch enumeration.

### CAPABILITY-BADGE
Primary badges are qB-facing when a trustworthy qB milestone exists (`5+`, `4.2+`, bounded ranges).

### CAPABILITY-DIALOG
One canonical Capability Dialog explains unsupported features.

### CAPABILITY-COST
Capability evaluation consumes already detected versions + local JSON, without per-feature requests/polling.

### CAPABILITY-VISIBLE
Unsupported actionable features normally stay visible, `aria-disabled`, badged and explainable.

### CAPABILITY-EXCEPTION
Upstream quirks live in declarative rules, not one-off feature version branches.

Known current facts include Private/PT exact metadata at qBittorrent 5.0.0+ and Tags at WebAPI 2.3.0+ (qB-facing 4.2+ where trustworthy).

Current supported stable range is qBittorrent 4.1.9.1 -> 5.2.3: **55 official stable releases = 40 qB 4.x + 15 qB 5.x**. Linux/Windows Browser gates exercise representative qB4 floor + qB5 modern generations; `tests/upstream-release-audit.mjs` owns the complete stable-tag compatibility audit.

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
Only a formal change to product content under `webui/**` increments patch VERSION. When `webui/**` changes, `VERSION`, `webui/VERSION` and `package.json.version` move together in the same final state. Changes limited to tests, fixtures, workflows, docs, DESIGN, installers, CI/gates, package test scripts, test dependencies or lockfiles keep the current product VERSION. Browser fixtures read canonical VERSION and do not hard-code product patch versions.

### EXACT-SHA-EVIDENCE — validation belongs to SHA
Every new Git SHA invalidates older CI/LIVE/candidate/artifact evidence. VERSION does not authorize evidence reuse, including when a non-product change correctly keeps the same VERSION.

### SAFE-REF — dev writes are race-safe
Formal development uses `dev`; `main` is untouched without explicit authorization. Before write and before ref update, re-read current dev exact HEAD. Update only by safe fast-forward with `force:false`.

### BROWSER-RUNTIME — hosted Chrome is the only CI browser runtime
`tests/browser-driver.mjs` is the only Playwright launch-policy owner. The six `browser-*.mjs` semantic gates are callers and may not import Playwright directly, select a channel, set an executable path or implement fallback policy. Playwright JS is exact-pinned by `package.json + package-lock.json`.

Linux routine UI, Linux candidate and Windows candidate all use the Google Chrome Stable already supplied by their pinned GitHub-hosted runner generation. CI must not run `playwright install`, `playwright install-deps`, dynamic `npm install ... playwright`, manual Chromium downloads or browser-specific apt provisioning. Missing hosted Chrome fails closed; it never falls back to a Playwright-managed browser.

Hosted Chrome itself may update between runs. Therefore browser evidence is traceable as `exact Git SHA + package-lock + runner image + exact logged Chrome version`; it is not a claim that the same SHA always replays against the same browser binary.

## 11. Do / Don't

Do:

- reuse canonical Select/Dialog/Button/Input/Card/Theme/Feedback;
- use semantic controllers/state as presentation input;
- keep one owner and retire replaced callers in the same change;
- audit Desktop/Mobile + Light/Dark + Reduced Motion;
- validate real interaction/final state;
- use exact SHA tree/files for repo-wide ownership audits when search can be incomplete;
- keep Playwright dependency identity in `package-lock.json` and log hosted Chrome identity in every browser gate;
- use revision-neutral semantic identifiers and let Git history own revisions.

Don't:

- add `*-fix.css`, versioned runtime or tail patch layers;
- add numbered semantic revisions such as `FOO-001` or `FOO-002`;
- use MutationObserver repair, monkey patch, dual renderer or compatibility shim;
- create a second QBClient/polling path;
- read hidden DOM as business state;
- implement Mobile Sort by clicking hidden Desktop UI;
- restore summary cards or Mobile facet/command shelves;
- hide stale code instead of deleting its owner/callers/tests;
- dynamically install Playwright or provision Chromium inside CI browser jobs;
- treat a red assertion as proof the product is wrong before inspecting runtime truth.

## 12. Current visual acceptance

The Torrent workspace acceptance matrix includes:

```text
Desktop / Mobile
Dark / Light
System Reduced Motion / WeiG Reduced Motion
qB 4.1.9.1 / qB 5.2.x representative compatibility
Sidebar facets below state filters
no four-card summary on any viewport
compact Mobile toolbar with canonical controls
same Selection toolbar beside Mobile pager
Mobile two-line card + real bottom progress rail
Mobile Search anchored below Topbar without clipping actions
Desktop one-row Header/end rail/DataGrid/Statusbar stability
```

The design objective is reduced duplicate ownership and clearer information hierarchy, not fewer files or fewer gates for their own sake.

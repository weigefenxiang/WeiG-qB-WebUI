# WeiG qB WebUI — Design System

Version: **2.1**  
Status: **v0.3.7 Semantic Ownership 3.6**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This file is the single visual, interaction and first-party runtime ownership authority. New work extends these rules; it never creates a parallel owner or a post-render repair layer.

## 1. Non-negotiable rules

1. One semantic purpose has one canonical component/controller/layout/data owner.
2. Feature code does not invent local Button/Select/Card/Badge/Dialog/Popover/SettingRow systems.
3. Active first-party runtime assets use stable semantic filenames, never release/version suffixes.
4. Git history is the archive. Migrated `*-vNNN.*` / `vNNN.*` runtime code is deleted, not aliased.
5. Source owners emit final DOM. First-party runtime must not use `MutationObserver` to reclaim, move, wrap, upgrade or repair UI.
6. Presentation modules (`responsive`, `spatial`, `layout`, `polish`, `ux`) do not own qB clients, API polling or business state.
7. Runtime coordination uses explicit semantic lifecycle events, not DOM observation.
8. Settings has one source renderer and one geometry owner.
9. Torrent selection has one `W.Selection` state owner and one `ActionRegistry`.
10. Transfer speed samples and qB telemetry metadata have one `W.TransferRuntime` owner.
11. Private/PT semantics have one `W.TorrentSemantics` owner; UI never re-derives privacy locally.
12. qB WebAPI compatibility remains in `QBClient`; presentation cleanup never removes qB 4.1.9.1 support.
13. Authentication actions use one `SessionController`; logout is accepted only after server-side invalidation is verified.
14. Browser Back/BFCache must never reveal stale private UI after logout.
15. Mobile is adaptive presentation, not a second business application.
16. Data count is not DOM count; large collections remain virtualized.
17. Interactive touch targets are at least 44×44 CSS px where touch is primary.
18. Reduced Motion is mandatory.
19. `VERSION` is product identity; exact Git SHA is code/cache identity; tag/Release is distribution identity.
20. README is user-facing. Architecture, test and release contracts live here and in `docs/`.

## 2. Visual Theme & Atmosphere

```text
Void      deep-space page background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      compact information/stat surface
Raised    toolbar / active input / detail summary
Floating  select / menu / popover / dialog
```

The UI is dark, precise and dense. Blue/cyan communicates ordinary interaction; purple is reserved for alternative-rate semantics and selected brand accents. Depth comes from restrained surface/border contrast, not permanent glow.

## 3. Semantic colors and typography

Color is role-based:

```text
--surface-*          hierarchy/elevation
--text-primary       titles and primary values
--text-secondary     normal copy
--text-muted         descriptions and metadata
--border             separators
--accent-primary     primary interaction
--accent-cyan        live/positive detail
--accent-secondary   ALT/secondary emphasis
--success/warning/danger semantic state only
```

Typography hierarchy:

```text
Page title > Section title > item/setting title > value/control > description > metadata
```

Ordinary Settings copy is always horizontally left aligned. Controls align to the row’s right axis.

## 4. Canonical owner map

```text
qB endpoint compatibility          W.QBClient
Application query/catalog state    W.AppState / app.js
Settings DOM/save                  W.SettingsRenderer / W.SettingsState
Settings controls                  W.ControlRegistry + W.Components.selectControl
Torrent semantics                  W.TorrentSemantics
Torrent selection                  W.Selection
Torrent actions                    W.Selection.actions / ActionRegistry
Transfer samples + telemetry       W.TransferRuntime
Transfer dialogs/rate editor       W.Transfer
Torrent field registry             W.TorrentFieldRegistry
Responsive presentation            W.MobileAdaptive
Shared UI behavior                 W.UiSystem
DataGrid/dialog geometry           W.LayoutRuntime
Facet/connection presentation      W.SpatialRuntime
Visual polish                      W.PolishRuntime
Runtime translation synchronization ux.js / semantic events
Brand/logo/favicon/motion          W.Brand + W.AmbientMark
Session/logout/BFCache             W.SessionController / SessionGate
Torrent progress motion            css/progress.css
Statusbar shell geometry           css/layout.css
```

Owner names are semantic. A release must not create `TransferV038`, `SelectionModelV038`, `SettingsGridV038` or equivalent parallel ownership.

## 5. Runtime lifecycle contract — explicit events, no observers

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

shared state
  weigg:languagechange
  weigg:configchange
```

Consumers may recalculate their own presentation from these events. They may not watch arbitrary DOM mutations and infer ownership after the fact.

Forbidden first-party runtime architecture:

```text
MutationObserver repair/reclaim
CSS-order observer
observer-based native Select upgrade
observer that waits for DataGrid/Settings/Brand/Transfer DOM
presentation module starting its own QBClient polling loop
setTimeout loops used as permanent ownership repair
```

A bounded timeout for focus/animation/debounce is not an ownership mechanism and remains allowed where semantically necessary.

## 6. Stable semantic runtime filenames

Current first-party runtime paths are named by responsibility:

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
no active vNNN.css/js
no old-name alias/shim after migration
no old + new implementation loaded together
no hidden dynamic loader for deleted assets
```

Cache identity is `stable semantic path + exact deployment Git SHA`.

## 7. Canonical controls

Visible custom Selects are created explicitly with `W.Components.selectControl()` by the source owner. Settings never falls back to a native Select and no runtime scans the DOM to upgrade old Selects.

Control mapping:

```text
boolean       -> Switch
number/port   -> NumberInput
select/enum   -> canonical Select/Listbox
text/path/url -> TextInput semantic variant
rate          -> Rate editor
readonly      -> FactRow / readonly semantic component
```

A bootstrap/native element may exist only when deliberately required by the static document contract; it is never a second live UI owner and never depends on observer conversion.

## 8. Settings structure and geometry

Every ordinary editable preference is emitted directly as:

```text
SettingsSection
└─ SettingsGrid
   └─ SettingRow
      ├─ SettingCopy
      │  ├─ SettingTitle
      │  └─ Description
      └─ SettingControlSlot
         └─ canonical control
```

Wide desktop:

```text
SettingsGrid = repeat(2,minmax(0,1fr))
```

Narrow/mobile:

```text
SettingsGrid = one column
```

Ordinary row contract:

```text
span = 1
SettingRow          grid-template-columns: minmax(0,1fr) auto
SettingCopy         width:100%; justify-self:start; text-align:left
SettingControlSlot  justify-self:end
```

`span=full` is explicit schema semantics only for multiline/composite/list/table/large editors. Key names (`path`, `url`, `host`, `username`, `password`) never decide layout.

Forbidden Settings architecture:

```text
legacy FormRail
post-render row moving/wrapping
MutationObserver injection
Settings timeout repair
native-select upgrade requirement
CSS specificity/load-order arms race
```

Language and timezone are normal WeiG Settings source items.

## 9. Torrent selection interaction contract

`W.Selection` owns the selected hash Set and all selection semantics.

Desktop/list behavior:

```text
click row non-interactive area   select only that torrent
Ctrl/Cmd + click                 toggle torrent
Shift + click                    select range from anchor
checkbox                         toggle torrent
click torrent title/details      open detail; do not hijack selection
right click                      select target when needed + open ActionRegistry
Ctrl/Cmd+A                       select current page
Escape                           clear selection when no dialog owns Escape
```

Mobile:

```text
checkbox hit target >= 44×44
normal card area participates in selection
long press -> same ActionRegistry
More -> same ActionRegistry
```

Top More, right-click, long-press and mobile More must render the same registry. No entry owns a private action list.

## 10. Private / PT semantics

Classification belongs to `W.TorrentSemantics`:

```text
PRIVATE_PT
PRIVATE
PT
PUBLIC
UNKNOWN
```

### 10.1 qB 5.x / explicit metadata

When qB returns `private` / equivalent authoritative metadata, that value wins.

### 10.2 Metadata pending

`has_metadata=false` or `metaDL`/equivalent is **UNKNOWN**, never Public. A magnet without metadata must not be falsely classified merely because discovery fields are unavailable.

### 10.3 qB 4.1.9.1 fallback

qB 4.1.9.1’s upstream WebAPI emits synthetic tracker rows for DHT, PeX and LSD. Its source assigns the same localized non-empty `msg` to all three only when `torrent->isPrivate()` is true; a Public torrent with globally disabled DHT/PeX/LSD has disabled status but empty messages.

Therefore the fallback contract is:

```text
all [DHT]/[PeX]/[LSD] rows present
+ all msg non-empty
+ all msg exactly equal
= Private

all three msg empty
= Public

incomplete/mixed
= Unknown
```

Never hardcode the English message text. Never infer Private from `status == disabled`.

PT tracker-domain rules are supplemental PT classification only; they are not a replacement for qB Private metadata.

## 11. Transfer telemetry ownership

`W.TransferRuntime` owns both:

```text
getTransferInfo stream -> live DL/UL sample history
sync/maindata metadata -> DHT nodes / peer connections / free space
```

Rules:

- Existing application `getTransferInfo()` calls are wrapped once to capture samples; no second speed polling loop is created.
- `W.TransferRuntime` owns one bounded maindata refresh lifecycle and publishes `weigg:maindata`.
- `responsive.js`, `polish.js`, `spatial.js`, `layout.js` and `ux.js` must not create `QBClient` instances or API polling for presentation.
- Consumers read `W.TransferRuntime.snapshot()` or semantic events.

Realtime Transfer panel order:

```text
Session downloaded | Session uploaded | DHT / Peers
Global upload limit | Global download limit | Free space
Chart: 1 / 5 / 15 min
```

Rate editor:

```text
[NORMAL | ALT] [unit]
Upload limit | Download limit
0 = Unlimited
```

The rate editor is compact and separate from the larger statistics geometry. Ordinary desktop dialogs do not regain unnecessary outer scrollbars.

## 12. Statusbar geometry

`css/layout.css` is the shell geometry owner. Desktop statusbar uses named grid areas, not auto-placement or DOM insertion order:

```text
"torrent storage transfer connection message"
```

`Transfer`, `Storage` and `Connection` have explicit grid areas. `polish.css` may change tone/appearance but never shell placement.

## 13. Progress and motion

`css/progress.css` is the only torrent progress motion owner. It provides width transition, flow and sweep while incomplete. At 100% decorative motion stops.

Both must disable motion:

```text
@media(prefers-reduced-motion:reduce)
html[data-motion="reduced"]
```

## 14. Header, Brand and Session

Desktop utility order:

```text
[+ Add Torrent] [GitHub] [Blog] [Refresh] [Theme] [Logout]
```

Header Brand mark and name are separate Home targets using one navigation owner. About reuses `BrandIdentity`/`AmbientMark`.

Verified logout flow:

```text
SessionController.logout()
→ QBClient.logout()
→ POST auth/logout
→ QBClient.probeSession()
→ invalid session required for success
```

If qB auth bypass immediately recreates a session, UI reports a server-policy auth-bypass state; it never reports false success. BFCache/pageshow re-entry is fail-closed.

## 15. Responsive behavior

```text
>1180px     Settings two columns
821–1180px  Settings one column
<=820px     adaptive single-column/mobile shell
```

Responsive code may reflow, hide, compact, fit and position presentation it owns. It may not fetch qB business data to make that presentation work.

## 16. Systemic failure modes and prohibited regressions

```text
second semantic owner
version-suffixed runtime layer
hidden old loader/alias
MutationObserver repair/reclaim
presentation-owned QBClient/timer
second Selection Set
entry-specific torrent action list
second getTransferInfo polling loop
Private inferred from disabled DHT status
metadata-pending treated as Public
hardcoded localized Private message
statusbar auto-flow dependency
whole-dialog desktop scrollbar for compact limit editor
native Select DOM upgrade system
```

Fix order is always:

```text
owner
→ data/schema boundary
→ source renderer/component
→ explicit lifecycle event
→ layout
→ delete obsolete ownership
→ regression contract
```

Never begin by layering screenshot-specific CSS over an unresolved ownership conflict.

## 17. Validation contract

Dev `[ui]` exact-HEAD validation covers qB 4.1.9.1 + 5.2.0 in one Linux Chromium job plus static/syntax gates.

Static gates must reject:

```text
versioned runtime assets/loaders/owners
first-party MutationObserver
Settings native fallback/repair
presentation QBClient/API polling
second Selection/Transfer owner
statusbar non-semantic geometry ownership
hardcoded qB4 Private message
```

Browser fixture must cover deliberately adversarial cases:

```text
qB4 private without `private` field
Public torrent while DHT/PeX/LSD globally disabled
metadata-pending magnet
transfer/info without peer count; maindata supplies it
ordinary row click vs title/details
Ctrl/Cmd + Shift + checkbox
right-click / long-press / More same ActionRegistry
44px touch selection target
Transfer stat/order/unit/geometry
Reduced Motion
```

Normal dev validation stays representative. Full stable-tag Linux/Windows/multi-viewport audit remains main Release-only. Real exact-SHA qB 4.1.9.1 + 5.2.x LIVE remains mandatory before promotion.

## 18. Agent implementation guide

```text
read DESIGN/docs contract
→ identify canonical owner
→ verify qB upstream semantics when compatibility is ambiguous
→ change code + tests + docs as one issue chain
→ cumulative diff/ownership audit
→ create one final exact dev HEAD
→ run exact-HEAD CI
→ real exact-SHA LIVE
```

Do not convert a compatibility problem into a permanent compatibility layer.
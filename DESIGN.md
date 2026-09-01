# WeiG qB WebUI — Design System

Version: **1.9**  
Status: **v0.3.7 unified interaction + settings semantics + ResponsiveShell 3.0**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This file is the single visual and interaction authority. New UI extends these rules; it does not create a second local design system.

The project may study the system-thinking examples collected by `VoltAgent/awesome-design-md`: tokens, reusable components, explicit interaction states, responsive contracts and restrained hierarchy. References are principles, not screenshots to copy.

## 1. Non-negotiable rules

1. One semantic purpose has one canonical component or controller.
2. Feature code does not invent local Button/Select/Card/Chip/Badge/Modal/Popover visual systems.
3. Capability detection, not qB major version, decides backend compatibility.
4. Data count is not DOM count; large collections stay virtualized.
5. Polling never destroys page, scroll, selection, detail-return or display-timezone state.
6. Mobile is a touch-first adaptive layout, not a squeezed desktop.
7. Primary data surfaces consume safe remaining workspace instead of arbitrary fixed height.
8. Display timezone is browser presentation state, never qB/server time.
9. Storage telemetry is the qB default-save filesystem value, never fabricated VPS telemetry.
10. HTML is a no-store bootstrap; CSS/JS cache identity is the deployment Git SHA.
11. Reduced Motion is mandatory.
12. Setting units, conversions and special values require verified qBittorrent semantics; names are never used to guess units.
13. Official qBittorrent translations and WeiG explanations have distinct provenance.
14. Selection is model state, not mounted-DOM state.
15. README is the concise usage/promotion entry; engineering detail belongs in `docs/` and this design authority.

English is canonical source copy. The runtime may bundle verified/fallback UI dictionaries for `zh-CN`, `zh-TW`, `ja` and `ko`; the project README is maintained in English and Simplified Chinese.

## 2. Spatial hierarchy

```text
Void      page/deep-space background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      stats / information cards
Raised    search / toolbar / active input / detail summary
Floating  listbox / menu / popover / dialog
```

Material hierarchy is created with restrained luminance, border contrast, inner highlight and shadow. Continuous neon is not hierarchy.

## 3. Canonical primitives and controllers

```text
Button / IconButton
Input / Search
Select / Listbox
Switch
CheckControl
FilterChip
Tooltip / SettingHelp
Dialog / AdaptiveDialog
Drawer / Action Sheet / ContextDrawer
Menu / Popover
Badge / StatusPill
Card / Panel
Tabs
DataGrid / Pagination / VirtualList
Settings Card / PreferenceSchemaV037
Filter Shelf / Facet Popover
Connection / Transfer Dock
FloatingLayer
AmbientMark
SelectionModelV037 / BulkActionDispatcher
TorrentActionController
DataGridLayoutController
ResponsiveShell 3.0
AboutPanel
```

### PRIMITIVE-001 — no feature-local clone

Feature CSS may own layout, column geometry and feature-specific semantic states. It may not redefine canonical colors, radii, shadows, focus rings or interaction state for an existing primitive.

Required control states:

```text
Default
Hover
Focus-visible
Active / Selected
Disabled
```

## 4. FLOATING-001 — one FloatingLayer system

Any UI that visually floats above normal content must be rendered through the canonical body-level portal:

```text
Trigger
  ↓ getBoundingClientRect()
#weigg-floating-layer
  ↓ position: fixed
Select / Dropdown / Menu / Popover / Tooltip / SettingHelp / Timezone picker
```

A floating surface must never rely on an ancestor `z-index` to escape `overflow:hidden/auto` clipping.

Collision contract:

```text
prefer below
→ flip above when needed
→ shift horizontally inside viewport
→ cap height when vertical space is limited
→ internal scroll when capped
→ recompute on viewport resize/scroll/visualViewport changes
```

Safe edge target is approximately 8px from the visual viewport.

## 5. SELECT-001 — canonical Select/Listbox

Visible Select UI uses `W.Components.selectControl()`. Native `<select>` may remain as an invisible data/compatibility bridge.

Keyboard/ARIA contract:

```text
Arrow Up / Down
Home / End
Enter / Space
Escape
aria-haspopup=listbox
role=listbox / option
aria-selected
```

System/OS popup coloring is not a product dependency.

## 6. BRAND-001 — reusable AmbientMark

```text
AmbientMark
├─ Mark / Logo
├─ Orbit layer
├─ Spark layer
├─ Shine layer
└─ Ambient scheduler
```

Default is quiet. Typical random check interval is about 8–28 seconds and a check may intentionally do nothing. Allowed short effects include orbit, spark, 3D tilt, shine, breathe and low-probability combinations.

Requirements:

- no permanent RAF loop;
- no continuous orbit;
- scheduler pauses while the document is hidden;
- Reduced Motion disables nonessential brand motion;
- random source can be injected for deterministic tests;
- component is product-neutral and reusable by future WeiG sites.

## 7. TIME-001 / TIME-002 — global Display Time Zone

Visible date/time is rendered through `W.Time` / `Intl.DateTimeFormat`:

```text
qB timestamp
→ normalized epoch
→ chosen IANA timezone
→ localized visible text
```

The desktop status dock is the global control surface. Canonical label:

```text
✓ UTC+08:00 · Asia/Shanghai
```

`UTC±HH:MM` is calculated from the selected IANA zone and current instant, supporting DST, `+05:30`, `+05:45` and other valid offsets.

On phones, system/time/storage metadata may move into ContextDrawer instead of reserving a permanent status row. Logs and other pages consume the same state; they do not create route-local timezone selectors. Changing timezone changes visible text only. Epoch and `<time datetime>` stay immutable.

## 8. LOGS-001 — data-first newest-first Logs

```text
Newest
Older
Oldest
```

- initial request: `last_known_id=-1`;
- incremental cursor: current maximum ID;
- browser buffer: at most 5000 newest rows;
- Follow Latest ON: viewport stays at top;
- manual downward scroll: Follow is released;
- Follow OFF: insertion above compensates scroll position;
- search/severity changes are deliberate context changes and may reset top.

Logs compose canonical Search + FilterChip + CheckControl + Select + Button + StatusPill + DataPanel + VirtualList only.

## 9. NAV-001 — context-safe Torrent detail

Detail tab order begins with:

```text
[ ← Back to torrents ] [ Overview ] [ Files ] [ Trackers ] [ Peers ] ...
```

The application preserves originating Torrent page/filter state and list scroll position.

```text
Page 2 / scroll 600
        ↓
Torrent Detail
        ↓ Back / Esc
Page 2 / scroll 600
```

Directly opened detail URLs without a valid internal list context fall back to Torrent home instead of blindly navigating to an external history entry.

Escape priority:

```text
1. Select/Popover → close
2. Dialog         → dialog owns Esc
3. Editing input  → do not steal
4. Torrent Detail → Context Back
5. Torrent List   → selection/list behavior
```

## 10. SHELL-001 / SCROLL-001 — ResponsiveShell 3.0

Desktop retains Topbar + Sidebar + Workspace + Status dock. Phones use one dynamic three-track shell:

```text
Topbar             auto
Workspace          minmax(0, 1fr)
Bottom navigation  auto + safe area
```

Phone layout uses `100dvh` where available with `100svh` fallback. It must not reserve a fixed empty status track. System metadata that is useful on phones belongs in ContextDrawer.

Every active mobile route has one primary vertical scroll owner:

```text
Torrent   → torrent-list
Settings  → settings-content
Search    → search-results
RSS       → rss-content
Logs      → logs data viewport
Detail    → detail-content
```

Feature pages must not reintroduce `100vh - Npx`, fixed auxiliary rows, arbitrary `min-height:360px`, or competing document/page/list scroll owners.

Validation includes at least:

```text
320×568
360×800
390×844
430×932
```

and representative desktop widths.

## 11. MOBILE-NAV-001 / CONTEXT-DRAWER-001

Bottom navigation is one line with icon before label:

```text
◉ Torrents   ⌕ Search   ◌ RSS   ⚙ Settings
```

Rules:

- icon and label use horizontal flex layout;
- label never wraps;
- safe-area inset is respected;
- workspace ends at the actual navigation edge, not a guessed fixed height.

On phones, Settings category navigation is not rendered as a large rail inside Settings workspace. It moves into the hamburger ContextDrawer directly after Torrent filters (`Private / PT` is the final Torrent filter), followed by optional system metadata:

```text
Torrent filters
Private / PT
Settings
  WeiG WebUI
  Downloads
  Connection
  Speed
  BitTorrent
  Web UI
  Advanced
  About
System
  qBittorrent / WebAPI / Storage / Time / Network
```

Desktop keeps the Settings category rail.

## 12. MOBILE-CARD-001 / MOBILE-CARD-002 — Torrent density

Torrent cards remain readable but dense. Secondary metrics are one visual line whenever physically possible:

```text
↓0B/s  ↑0B/s  ETA  29.8MiB
```

Adaptation priority:

```text
remove redundant spaces/zero decimals
→ reduce gap
→ reduce font size/tracking
→ only then consider overflow fallback
```

CSS card height and JavaScript VirtualList row height share one mobile metric contract so a visually shorter card never leaves invisible virtual-row gaps.

Touch targets remain approximately 44×44px where interaction is required even when data typography becomes denser.

## 13. STATUS-SEMANTIC-001 — Torrent state colors

State must be legible through text plus tone, not color alone.

```text
Downloading       cyan / blue
Seeding           green
Stalled download  amber
Stalled seeding   purple
Stopped / paused  neutral gray family
Queued            indigo
Checking / moving amber
Error             danger red
```

All states use the same `StatusPill` primitive. Do not color the whole Torrent card as a substitute for hierarchy.

## 14. TOOL-PAGE-001 — Search / RSS / Logs on mobile

Search, RSS and Logs use one remaining-workspace tool-page contract. Empty results do not reserve a giant fixed-height box. Controls remain at the top, while the result/data viewport consumes the rest of the page when data exists.

A mobile route must not create a second document-height blank page below its useful content.

## 15. STORAGE-001 — free-disk status telemetry

Canonical source:

```text
sync/maindata
└─ server_state.free_space_on_disk
```

Meaning:

> Free space on the filesystem containing qBittorrent's default save path.

Do not label it as generic VPS root-disk space. In Docker, the filesystem may be a host bind-mounted data volume.

Formatting uses human-readable IEC units:

```text
B / KiB / MiB / GiB / TiB
```

Precision is adaptive for quick reading rather than a forced significant-digit count.

Telemetry rules:

- low-frequency refresh independent of Torrent polling cadence;
- incremental sync RID after the first full snapshot;
- partial sync without a changed free-space field keeps the last valid value;
- missing/unsupported telemetry is hidden, never fabricated;
- actual `0 B` remains a valid value.

## 16. SETTING-UNIT-001 / PREFERENCE-SCHEMA-001

`PreferenceSchemaV037` is the canonical owner for ordinary qB Preferences; the verified Advanced layer follows the same contract. A numeric preference may show a unit or perform API/display conversion only after qBittorrent source/API semantics are verified.

Examples:

```text
dl_limit / up_limit             API B/s ⇄ display KiB/s
alt_dl_limit / alt_up_limit     API B/s ⇄ display KiB/s
listen/proxy/Web UI ports       port
web_ui_ban_duration             s
max connection/upload limits    connections / slots
slow torrent rate thresholds    KiB/s
socket receive/send buffers     API bytes ⇄ display KiB
torrent_file_size_limit         API bytes ⇄ display MiB
disk_queue_size                 API bytes ⇄ display KiB
memory_working_set_limit        MiB
checking_memory_use             MiB
hostname_cache_ttl              s
save_resume_data_interval       min
```

Verified special values are shown concisely, for example:

```text
0  = Unlimited / Disabled / System default / Permanent lease
-1 = Unlimited
```

Only the meaning verified for that exact field is displayed. Display conversion must round-trip to the exact WebAPI representation before release.

Verified enums use canonical Select rather than exposing unexplained codes.

## 17. I18N-SETTING-001 / SETTING-HELP-001

Advanced setting translation data lives outside business logic in a dedicated registry with upstream provenance.

Display policy for non-English locales:

1. verified qBittorrent translation available → use it as visible label;
2. no verified official translation → keep the English label;
3. `SettingHelp` may show WeiG translation/explanation, purpose, unit and special-value semantics;
4. UI must distinguish `qBittorrent official` from `WeiG explanation`.

`SettingHelp` uses the canonical FloatingLayer. Desktop supports hover/focus/click; touch devices use tap. Help must be short and operational, not a second documentation page.

## 18. SETTINGS-001 / ABOUT-001

Settings cards maintain:

```text
Title
Description / Help
Control
```

qB Preferences use `W.Components.preferenceField()`. WeiG readonly deployment metadata uses `W.Components.readonlySettingField()`. WeiG browser/interface preferences use `settings-control`.

Alternative WebUI keeps its path/disable safety behavior but does not own a second visual system.

About is a canonical Settings section exposing:

```text
WeiG / WeiG Share
Version
Git SHA
qBittorrent version
WebAPI version
GitHub
Blog
GNU GPL-3.0
No-warranty notice
```

Public project/brand links are product metadata; deployment-specific host paths, instance URLs, credentials and container names must never be hardcoded into the open-source tree.

## 19. SELECTION-001 / BULK-001

`SelectionModelV037` owns conceptual Torrent selection. Mounted VirtualList rows are only a view of selection state.

Supported scopes/actions:

```text
Select current page
Invert current page
Select all matching
Invert all matching
Clear selection
```

Paging preserves selection. A meaningful query/filter/facet/search change clears the old selection to avoid applying destructive actions to a different set.

The UI exposes selected count. `Ctrl/Cmd+A` selects the current page. Large operations resolve hashes and dispatch in bounded chunks rather than producing one unbounded request.

## 20. TORRENT-ACTION-001 — one action controller

The same Torrent action surface is opened by:

```text
Toolbar More
Row/card More
Desktop right-click
Touch long-press
```

Right-click on an unselected Torrent selects that Torrent first. Right-click on an already selected Torrent preserves multi-selection.

Touch long-press must be cancelled when pointer movement indicates scrolling. Interactive descendants such as buttons, links and checkboxes do not start the long-press timer.

## 21. DATAGRID-001 — responsive column resizing

Column width drag is a layout operation, not a data rerender operation.

During drag:

```text
pointermove
→ requestAnimationFrame
→ update CSS grid template / width state
```

Forbidden during pointermove:

```text
VirtualList.render()
row reconstruction
API request
persistent storage write
```

On pointerup, final width is persisted and one reconciliation render is allowed. Header and visible rows consume the same canonical grid template.

## 22. DIALOG-001 — AdaptiveDialog

Dialogs use three conceptual tracks:

```text
Header
Body
Footer / actions
```

Header/actions remain stable. Only Body may scroll, and only when content exceeds the available dynamic viewport. A desktop Add Torrent dialog with sufficient space must not show a needless body scrollbar.

## 23. DataGrid, virtualization and polling

```text
API/cache item count != mounted DOM count
```

Torrent, Files, Peers, Trackers and Logs remain virtualized when cardinality warrants it.

Polling flow:

```text
fetch compatible data
→ update cache/model
→ refresh visible virtual window
```

Polling updates data, not navigation or conceptual selection.

## 24. Cache identity

HTML declares no-store/no-cache bootstrap metadata. Local CSS/JS direct and lazy assets use the deployment Git SHA through `buildAssetUrl()`.

Historical filenames such as `v030.js`, `v036.js` or `v037.js` describe lineage, not cache identity.

## 25. COMPAT-001 / FUTURE-001 / FIXTURE-001

Compatibility is selected at WebAPI/endpoint/Preference/field/capability boundaries. Feature code must not use `major > 5 => unsupported` style gates.

Representative fixtures span qB 4.1.9.1 through current stable and upstream next. A synthetic future-major node is allowed only as a forward-compatibility sentinel and must never be described as official support for an unreleased qB major version.

Fixtures must model meaningful API/capability differences instead of changing only version strings.

## 26. Release UX gate

A release candidate must pass static contracts plus Chromium checks for:

- canonical Select and FloatingLayer bounds;
- AmbientMark and Reduced Motion;
- Logs newest-first + global timezone invariants;
- Torrent Detail Back/Esc context restoration;
- mobile dynamic remaining-space layout and one-line bottom navigation;
- mobile Settings drawer ownership and no fixed empty status row;
- one-line Torrent metrics and semantic statuses;
- Search/RSS/Logs one-workspace behavior;
- storage telemetry;
- ordinary + Advanced setting units, conversions, enum display and round-trip;
- official translation provenance and SettingHelp;
- current-page/all-matching selection and selected count;
- desktop contextmenu and touch long-press action unification;
- DataGrid drag without pointermove VirtualList reconstruction;
- AdaptiveDialog geometry and no unnecessary Add Torrent scrollbar;
- About/GPL/README product metadata;
- representative compatibility nodes;
- no unexpected console/page errors.

Historical v0.3.6 contracts remain active through an explicit version-identity compatibility bridge; new releases do not weaken prior architecture assertions merely to change the product version.

Fixture PASS never implies production/live certification.

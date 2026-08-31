# WeiG qB WebUI — Design System

Version: **1.5**  
Status: **v0.3.2 adaptive data-surface baseline**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9**

> This file is the single visual and interaction authority. New UI must extend these rules instead of creating feature-local design systems.

## 1. Mission

WeiG qB WebUI is a premium qBittorrent control console: calm, dimensional, information-dense on desktop, touch-first on mobile and stable during long-running polling. Inspiration may come from Linear precision, Raycast floating chrome, Superhuman premium dark surfaces and instrument-like BMW/Revolut material separation, but the resulting identity must remain **WeiG Nebula Spatial Console**.

For v0.3.2 the design review also studied `VoltAgent/awesome-design-md`: its useful lesson is not to copy a screenshot, but to treat tokens, surfaces, spacing, component states and responsive behavior as an explicit reusable design contract. Raycast-like dark precision, Superhuman-like restrained depth and Warp-like technical data density are reference principles only.

Functionality may be compared with qBittorrent WebUIs such as VueTorrent, but another product's visual identity is never copied.

## 2. Non-negotiable rules

1. qBittorrent 4.1.9 remains the UI/interaction compatibility floor.
2. English is canonical source copy; English and Simplified Chinese are maintained languages.
3. Missing translations fall back to English; raw translation keys never appear.
4. Feature code does not invent colors, typography sizes, shadows, radii, motion or component variants.
5. Data count is not DOM count; large collections remain virtualized.
6. **Polling must never destroy user interaction state.**
7. Every non-home view retains Back; fatal states retain Back/Home/Reload.
8. Mobile is not a squeezed desktop DataGrid.
9. Hover-only interaction always has keyboard/touch equivalents where meaningful.
10. Reduced Motion is mandatory.
11. High-cardinality filter catalogs never permanently fill the desktop Sidebar.
12. Normal UI does not expose raw qB API/preference keys or developer rendering counters.
13. Tracker query/fragment credentials are never rendered in normal UI.
14. Visual depth must improve clarity, not hide data or create continuous neon animation.
15. Primary data-heavy pages use the canonical DataPage/DataPanel pattern instead of inventing feature-local fixed-height boxes.
16. A primary data viewport must not use an arbitrary `max-height: 62vh` when the workspace can provide safe remaining height.

## 3. Spatial hierarchy

### SPATIAL-001 — Six semantic surfaces

```text
Void      page/deep-space background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      stats / information cards
Raised    search / toolbar / active input / detail summary
Floating  menu / popover / dialog / action sheet
```

Elevation changes surface luminance, border visibility, top inner highlight, shadow and at most a restrained cool ambient glow. Do not make all dark surfaces the same black.

### SPATIAL-002 — Material before neon

Default surfaces are quiet blue-black materials. Accent wakes up for hover, focus, selected, active and primary actions. Never solve weak hierarchy with constant glowing borders.

### SPATIAL-003 — Interaction depth

Raised interactive controls may move roughly 1px on hover. Card hover may lift at most about 2px. Dense Torrent rows stay quiet and only reveal a subtle selection/hover layer.

## 4. Information architecture

### IA-001 — Topbar owns application navigation

Desktop destinations:

```text
Torrents | Search | RSS | Logs | Settings
```

Topbar also owns contextual search, Add Torrent and global utilities.

### IA-002 — Sidebar is the Torrent state rail

Permanent desktop items are low-cardinality states only:

```text
All
Downloading
Seeding
Completed
Paused
Active
Stalled
Error
Private / PT
```

### SIDEBAR-001 — No nested desktop scroll by default

At ordinary desktop heights the Sidebar should not need its own scrollbar. Tracker, Save Path, Category, Tag and detailed connection metadata belong elsewhere.

### FILTER-001 — Dynamic facets use Filter Shelf

```text
[ Tracker ▾ ] [ Save Path ▾ ] [ Category ▾ ] [ Tags ▾ ]
```

Each opens a searchable Floating Popover. It is a view over canonical application filter state, not a second state store.

### IA-003 — Connection details live in Status/Transfer Dock

qB version, WebAPI version and compatibility details open from the connection control rather than consuming permanent Sidebar height.

### IA-004 — Search is contextual

```text
Torrents → torrent search
Settings → settings search
Search   → qB Search Engine query
RSS      → RSS search/filter
Logs     → log search/filter
```

Off-route features must not run because the global search box changed.

## 5. User position and polling

### SCROLL-001 — User position is state

A user's current scroll position is part of interaction state. Automatic polling, row data refreshes, status updates and background re-renders must preserve it.

Allowed deliberate resets include:

```text
Filter/facet change
Pagination change
Page-size change
Search context change
Explicit Go to top
```

Manual refresh normally preserves current position unless the data context itself changed.

### DATAFLOW-001 — Polling updates data, not navigation state

```text
Timer / event
   ↓
Fetch compatible data
   ↓
Update cache/model
   ↓
Refresh visible virtual window
```

Do not recreate the user's conceptual page every refresh. Recreating implementation objects is acceptable only when the container restores stable viewport/selection state and does not leak event handlers.

### DATAFLOW-002 — No duplicate high-frequency polling

A feature such as Transfer Graph should subscribe to an existing transfer stream when possible. Do not create independent 1s/2s loops for every card.

## 6. Empty states

### EMPTY-001 — Zero-result Torrent views are compact

A filter with zero matching Torrents is a valid state, not a giant blank table.

Desktop target structure:

```text
Filter Shelf
Stats / network context
┌──────────────────────────────┐
│ ◇                            │
│ No torrents match            │
│ Short explanation            │
│ [Add Torrent] / clear action │
└──────────────────────────────┘
```

The empty surface is normally about **180–240px** tall rather than 60vh. Hide the meaningless table body/pager when zero results are confirmed. This applies consistently to Private/PT, Error, Downloading, Seeding, Completed, Paused, Active, Stalled and facet/search results.

### EMPTY-002 — Preserve useful global context

Transfer/network stats and Filter Shelf may remain visible on an empty result because they describe qBittorrent itself, not only the current result set.

## 7. Transfer Control Dock

### DOCK-001 — Operational, centered and interactive

The desktop bottom dock is centered visually and may contain:

```text
↓ current download
↑ current upload
ALT speed mode
connection
Torrent count
refresh time
Transfer / session
```

It is not a debug text strip.

### DOCK-002 — Speeds are controls

Clicking global download/upload speed opens a Floating/Modal speed-limit control. The user must be able to see the current limit, choose common presets, set a custom value and return to unlimited.

The default presets may include:

```text
Unlimited | 1 | 5 | 10 | 50 MiB/s | Custom
```

### DOCK-003 — Alternative speed mode is explicit

Alternative speed mode exposes active/inactive state through shape/fill/aria state, not color alone.

### DOCK-004 — Connection item opens details

The connection control remains the entry for qBittorrent/WebAPI/compatibility metadata. Global rate controls do not replace connection diagnostics.

## 8. Transfer graph and session stats

### TRANSFER-001 — Bounded local history

Transfer history is transient UI telemetry. Keep a bounded in-memory ring buffer; v0.3 baseline maximum is **900 samples**. It is not a Torrent database and does not require a backend.

### TRANSFER-002 — Native lightweight chart

Canvas/SVG is preferred over a large chart runtime. Graphs use semantic accent colors, subtle grid lines and clear DL/UL legend. Never animate hundreds of shadows or redraw when the dialog is closed if no visual update is needed.

### TRANSFER-003 — Useful session context

Where supported, the Transfer surface may show:

- session downloaded/uploaded;
- global DL/UL limit;
- DHT nodes and peer connections;
- free disk space;
- current/history download/upload rates.

Unsupported fields display `—` rather than fake values.

## 9. Internationalization

### I18N-001 — English canonical

Semantic keys and canonical source labels are English. Feature code requests semantic meaning rather than branching on locale.

### I18N-002 — Maintained languages

```text
English
简体中文 (zh-CN)
```

Other overlays may exist, but missing strings fall back to English.

### I18N-003 — Resolution

```text
Explicit user selection
→ navigator.languages/browser locale
→ English fallback
```

### I18N-004 — qB terminology

Official qBittorrent wording/translation is preferred for qB concepts. WeiG-specific terms are maintained locally.

### I18N-005 — Client errors follow the same rule

Compatibility/API layers must not contain Chinese-only canonical errors. Error semantics are English canonical with localized presentation where available.

## 10. Typography

Every string uses a semantic role:

```text
page-title, section-title, item-primary, body, data,
label, description, meta, caption, table-header,
table-cell, status, button, input, tooltip
```

Feature CSS must not hard-code one-off font sizes. Global size changes use the shared offset:

```css
Standard  0px
Large    +2px
XLarge   +3px
```

Current default: **Large (+2px)**. Font size and density remain independent.

## 11. Search and input surfaces

### INPUT-001 — Visible at rest

Search/Input/Select must already be distinct from their panel before interaction.

### INPUT-002 — Required states

```text
Default → Hover → Focus-visible/focus-within → Disabled
```

Hover may add a restrained cool edge and 1px lift. Focus uses a visible blue edge + soft focus ring. A near-black input disappearing into a black background is invalid.

## 12. Settings

### SETTINGS-001 — Metadata-driven

qB Preferences render through metadata describing English title, translation, description, type, category, units/options and capability constraints.

### SETTING-001 — Title → Description → Control

```text
Title
Description
Control
```

Long titles prefer ellipsis + Tooltip. Boolean uses Switch; path/text uses Input; enum uses Select; number uses numeric input. Desktop defaults to two columns; tablet/phone one column.

Only settings returned/supported by the connected qB instance are editable.

## 13. DataGrid and virtualization

Desktop Torrent list supports sorting, column resize, show/hide/order, persisted widths/order and server page sizes:

```text
20 / 50 / 100 / 200
```

### LARGE-001

```text
API/cache item count != mounted DOM count
```

Torrent, Files, Peers, Trackers, Logs and similar lists use VirtualList + overscan. Typical Torrent DOM should remain viewport-sized, not library-sized.

### SELECT-001 — Multi-select respects virtualization

Keyboard/mouse multi-selection must operate on data/selection state, never by mounting hidden rows. `Ctrl/Cmd+A`, Escape and Delete remain global list behaviors when focus is not inside an editable control. Shift-range behavior must clearly define whether it applies to rendered rows or the full logical dataset.

## 14. Tracker privacy

Display/filter keys normalize Tracker URLs before presentation:

```text
https://tracker.example/announce?passkey=SECRET#x
→
https://tracker.example/announce
```

Raw values are used only when an API mutation requires them.

## 15. Mobile

Mobile uses Torrent cards, bottom application navigation, Drawer/Sheet filters and touch-first action surfaces. Critical targets are approximately 44×44px or larger. Primary validation widths: 320, 375, 390, 430 and 768px.

Desktop Status Dock may be replaced by route-appropriate mobile surfaces rather than compressed into an unreadable strip.

## 16. Canonical components

One implementation per primitive:

```text
Button / IconButton / Tooltip / Dialog
Drawer / Action Sheet / Input / Search / Select / Switch
Tabs / Menu / Badge / Status / Card / Panel
DataGrid / Pagination / VirtualList
Settings Card / Filter Shelf / Facet Popover
Connection Popover / Transfer Dock / Transfer Limit Dialog
```

## 17. Motion and performance

Prefer static gradients, borders, transform and opacity. Avoid per-row backdrop filters, persistent glow animation, full-list rebuild animations and continuous chart work while hidden. Respect `prefers-reduced-motion`.

## 18. Definition of success

The UI is successful when it feels materially layered without being noisy; search/inputs are obvious; Sidebar is calm; zero-result pages are compact; polling never throws the user back to the top; global transfer controls are reachable from the dock; Settings read naturally top-to-bottom; English and Simplified Chinese both feel intentional; mobile remains touch-first; and thousands of Torrents do not become thousands of DOM nodes.

## 19. v0.3.2 Canonical DataPage / DataPanel

### DATA-PAGE-001 — One data-surface language

Torrent, Logs, Search results, RSS lists, Files, Peers and Trackers should converge on:

```text
DataPage
├─ Page Header
├─ Context / Toolbar
└─ DataPanel
   ├─ Column Header (when tabular)
   ├─ Virtualized viewport
   ├─ Empty / Error state
   └─ Footer / status
```

The feature may omit irrelevant rows, but it must reuse shared surface, spacing, focus and responsive contracts.

### DATA-PAGE-002 — Remaining height belongs to primary data

On desktop, a primary data page normally uses a grid with `auto minmax(0, 1fr)`. The DataPanel uses `min-height: 0` and consumes the safe remainder of the workspace. A fixed `max-height: 62vh` is not a valid default for a primary data viewport surrounded by unused space.

### DATA-PAGE-003 — Compact / Auto / Max

A primary DataPanel may expose:

```text
Compact  intentionally reduced working area
Auto     fill remaining workspace (default)
Max      hide nonessential page chrome and maximize data area
```

Window constraints always override a stored preference; no mode may overflow the usable viewport.

### DATA-PAGE-004 — Feature-local virtualization ownership

Torrent and Logs do not share one feature-owned VirtualList reference. Each data viewport owns its scroll state and virtualization instance.

### LOGS-001 — Logs are data, not a debug box

The canonical desktop row is:

```text
Log message | Time | Level
```

qB numeric levels are presented semantically:

```text
1 Normal
2 Info
4 Warning
8 Critical
```

Normal/Info remain quiet; Warning/Critical receive restrained semantic emphasis.

### LOGS-002 — Incremental and bounded

Initial load uses `last_known_id=-1`; later refreshes request only rows newer than the current maximum id. Browser history is bounded to 5000 retained main-log rows. Polling runs only while the Logs route is active and slows when the document is hidden.

### LOGS-003 — Follow latest is explicit

Follow latest is a visible state. When disabled, incremental polling preserves the user's manual viewport. Search or severity changes are deliberate context changes and may reset the Logs viewport.

### LOGS-004 — Mobile

The three-column desktop row becomes a two-line mobile row: message first, time + level second. Auto / Compact / Max remains usable in the mobile shell without forcing horizontal table compression.

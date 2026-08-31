# WeiG qB WebUI — Design System

Version: **1.5**  
Status: **v0.3.2 adaptive data-surface baseline**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9**

> This file is the single visual and interaction authority. New UI must extend these rules instead of creating feature-local design systems.

## 1. Mission

WeiG qB WebUI is a premium qBittorrent control console: calm, dimensional, information-dense on desktop, touch-first on mobile and stable during long-running polling.

The design review baseline includes the token/component discipline demonstrated by `VoltAgent/awesome-design-md`, especially Raycast-style precise dark chrome, Superhuman-style restrained premium depth and Warp-style technical data surfaces. These are references for principles, not skins to copy. The resulting identity remains **WeiG Nebula Spatial Console**.

## 2. Non-negotiable rules

1. qBittorrent 4.1.9 remains the compatibility floor.
2. English is canonical source copy; English and Simplified Chinese are maintained languages.
3. Missing translations fall back to English; raw translation keys never appear.
4. Feature code does not invent colors, typography sizes, shadows, radii or motion.
5. Data count is not DOM count; large collections remain virtualized.
6. Polling must never destroy user interaction state.
7. Every non-home view retains Back; fatal states retain Back/Home/Reload.
8. Mobile is not a squeezed desktop DataGrid.
9. Hover-only interaction has keyboard/touch equivalents where meaningful.
10. Reduced Motion is mandatory.
11. Tracker credentials are never rendered in normal UI.
12. Visual depth improves hierarchy; continuous neon decoration is invalid.
13. **Data-heavy pages use the canonical DataPage/DataPanel pattern.**
14. A feature must not create an arbitrary `vh`-limited inner box when the workspace itself can provide the height.

## 3. Spatial hierarchy

```text
Void      page/deep-space background
Base      workspace
Panel     Sidebar / DataPanel / Settings section
Card      stats / information cards
Raised    search / toolbar / active input / detail summary
Floating  menu / popover / dialog / action sheet
```

Default surfaces are quiet blue-black materials. Accent wakes up for hover, focus, selected, active and primary actions. Prefer surface contrast + hairline borders before stronger glow.

## 4. Canonical DataPage / DataPanel

### DATA-PAGE-001 — One layout model

Torrent, Logs, Search results, RSS result lists, Files, Peers, Trackers and future data-heavy features should converge on:

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

A feature may omit irrelevant rows, but it must reuse the same tokens and sizing logic.

### DATA-PAGE-002 — Remaining height belongs to data

On desktop, the active data page should normally consume the remaining workspace height:

```css
page: grid
rows: auto minmax(0, 1fr)
panel: min-height: 0; height: 100%
```

Do not use a fixed `max-height: 62vh` as the normal desktop layout for primary data.

### DATA-PAGE-003 — User-selectable density/size

A primary DataPanel may expose:

```text
Compact  intentionally reduced working area
Auto     fill remaining workspace (default)
Max      hide nonessential page chrome and maximize data area
```

Window resize always wins over an unsafe stored size. No mode may overflow the usable viewport.

### DATA-PAGE-004 — Virtualization owns the viewport

DataPanel scroll position belongs to its own VirtualList instance. Torrent and Logs must not share one feature-owned virtual-list state reference.

## 5. Logs page

### LOGS-001 — Data, not a debug box

Logs are presented as a first-class table-like stream:

```text
Log message | Time | Level
```

Raw numeric qB types are translated to semantic labels:

```text
1 Normal
2 Info
4 Warning
8 Critical
```

Normal and Info remain visually quiet. Warning and Critical may use semantic emphasis.

### LOGS-002 — Incremental stream

Use qB `last_known_id` to request only new rows after initial load. Do not redownload the complete log on every refresh.

### LOGS-003 — Follow latest is explicit

Following the newest log entry is an opt-in/visible state. When disabled, incremental polling must preserve the user's current viewport.

### LOGS-004 — Search and severity filtering

Filtering is local UI state over the retained log buffer. Search/severity changes are deliberate context changes and may reset that log viewport to the top.

### LOGS-005 — Bounded history

Long-running sessions use a bounded in-memory log buffer. The current v0.3.2 target is at most **5000** retained main-log entries.

## 6. User position and polling

A user's current scroll position is interaction state. Automatic polling, row refreshes and status updates preserve it.

Allowed resets include filter/facet change, pagination, page-size change, search context change and explicit Go to top.

Avoid duplicate high-frequency polling. A feature should subscribe to an existing stream where possible; where the backend exposes a dedicated incremental stream such as Logs, poll only while that route is active and slow down when hidden.

## 7. Empty states

Zero-result states are compact and intentional. Hide meaningless table chrome/pager when zero results are confirmed while retaining useful global context.

Logs use a small inline empty state when no rows match the active search/severity filters.

## 8. Navigation and contextual search

Desktop destinations:

```text
Torrents | Search | RSS | Logs | Settings
```

The Topbar search is contextual:

```text
Torrents → torrent search
Settings → settings search
Search   → qB Search query
RSS      → RSS filter
Logs     → virtualized log filter
```

Filtering a virtualized list must change the data model/window, not merely set `hidden` on currently mounted rows.

## 9. Inputs and interaction states

Search/Input/Select must be distinct from the panel at rest and expose:

```text
Default → Hover → Focus-visible/focus-within → Disabled
```

Focus uses a visible cool edge and soft ring. A near-black input disappearing into a black panel is invalid.

## 10. Settings

Settings remain metadata-driven. Cards follow:

```text
Title
Description
Control
```

Desktop prefers equal-height multi-column cards when practical; tablet/mobile collapse to one column. Only settings returned/supported by the connected qB instance are editable.

## 11. DataGrid and virtualization

```text
API/cache item count != mounted DOM count
```

Torrent, Files, Peers, Trackers, Logs and similar lists use VirtualList + overscan. Selection/filter/search behavior operates on data state, never by mounting hidden rows.

## 12. Transfer Control Dock

The desktop Dock is an operational surface for download/upload, ALT mode, connection, Torrent count and Transfer/session actions. It is not a debug strip. Global speed controls use long-lived cross-version APIs.

## 13. Mobile

Mobile uses cards/stacked data rows, bottom navigation, Drawer/Sheet filters and touch-first actions. Critical touch targets are approximately 44×44px or larger.

For Logs, the desktop three-column row becomes a two-line mobile row: message first, time + level second. Auto/Compact/Max sizing remains usable within the mobile shell.

## 14. Motion and performance

Prefer static gradients, borders, transform and opacity. Avoid per-row backdrop filters, persistent glow animation, full-list rebuild animation and continuous work for hidden routes. Respect `prefers-reduced-motion`.

## 15. Definition of success

The UI succeeds when data surfaces feel like one product: consistent toolbar chrome, clear hierarchy, obvious inputs, stable polling, adaptive height, bounded virtualization, quiet Normal/Info rows, visible Warning/Critical states, intentional mobile layouts, and no feature-specific half-height boxes surrounded by wasted space.

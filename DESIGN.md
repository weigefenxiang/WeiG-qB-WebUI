# WeiG qB WebUI — Design System

Version: **1.7**  
Status: **v0.3.6 canonical interaction + ambient brand baseline**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9**

> This file is the single visual and interaction authority. New UI extends these rules; it does not create a second local design system.

## 1. Mission

WeiG qB WebUI is a premium qBittorrent control console: calm, dimensional, information-dense on desktop, touch-first on mobile, and stable during long-running polling.

References may include Linear precision, Raycast floating chrome, Superhuman restrained depth, Warp technical density and the system-thinking examples collected by `VoltAgent/awesome-design-md`. The useful lesson is **tokens + reusable primitives + explicit interaction states**, not copying another product screenshot.

The resulting visual identity remains **WeiG Nebula Spatial Console**.

## 2. Non-negotiable rules

1. qBittorrent **4.1.9** remains the compatibility floor.
2. English is canonical source copy; English and Simplified Chinese are maintained languages.
3. Missing translations fall back to English; raw translation keys never appear.
4. Feature code does not invent colors, typography sizes, shadows, radii, motion or duplicate components.
5. Data count is not DOM count; large collections remain virtualized.
6. **Polling must never destroy user interaction state.**
7. Every non-home route has a meaningful Back contract.
8. Mobile is not a squeezed desktop DataGrid.
9. Hover-only interaction always has keyboard/touch equivalents where meaningful.
10. Reduced Motion is mandatory.
11. High-cardinality filter catalogs do not permanently fill the desktop Sidebar.
12. Normal UI does not expose raw qB API/preference keys or debug rendering counters.
13. Tracker query/fragment credentials are never rendered in normal UI.
14. Visual depth improves hierarchy; continuous neon animation is invalid.
15. Primary data-heavy pages use canonical DataPage/DataPanel rather than feature-local boxes.
16. A primary data viewport does not use arbitrary fixed `max-height` when safe remaining workspace exists.
17. **One semantic primitive has one canonical visual implementation.**
18. **HTML is a no-store bootstrap; CSS/JS identity is deployment Git SHA, not semver.**
19. **User page, scroll, filter, detail-return context and display timezone are interaction state.**
20. **Brand motion is ambient and occasional, never a permanent animation loop.**

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

Elevation changes surface luminance, border visibility, top inner highlight and restrained shadow. Dark mode must still distinguish one material from another.

### SPATIAL-002 — Material before neon

Default surfaces are quiet blue-black materials. Accent wakes up for hover, focus, selected, active and primary actions. Constant glowing borders are not hierarchy.

### SPATIAL-003 — Interaction depth

- Raised controls may move about 1px on hover.
- Card hover may lift at most about 2px.
- Dense rows stay quiet and reveal only a subtle hover/selection layer.
- Reduced Motion removes nonessential movement.

## 4. Information architecture

### IA-001 — Topbar owns application navigation

```text
Torrents | Search | RSS | Logs | Settings
```

Topbar also owns contextual search, Add Torrent and global utilities.

### IA-002 — Sidebar is the Torrent state rail

Permanent desktop items are low-cardinality states:

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

### SIDEBAR-001 — Avoid nested scroll

Tracker, Save Path, Category, Tag and detailed connection metadata belong in facet/popover surfaces rather than forcing a second desktop scrollbar.

### FILTER-001 — Dynamic facets use Filter Shelf

```text
[ Tracker ▾ ] [ Save Path ▾ ] [ Category ▾ ] [ Tags ▾ ]
```

Each opens a searchable Floating Popover over canonical application filter state.

### IA-003 — Connection lives in the Status/Transfer Dock

qB version, WebAPI version and compatibility details open from the connection control.

### IA-004 — Search is contextual

```text
Torrents → torrent search
Settings → settings search
Search   → qB Search Engine query
RSS      → RSS filter
Logs     → log search
```

Off-route features do not run merely because the global search field changed.

## 5. Canonical components

One implementation per semantic primitive:

```text
Button / IconButton
Input / Search
Select / Listbox
Switch
CheckControl
FilterChip
Tooltip
Dialog / Modal
Drawer / Action Sheet
Menu / Popover
Badge / StatusPill
Card / Panel
Tabs
DataGrid / Pagination / VirtualList
Settings Card
Filter Shelf / Facet Popover
Connection Popover / Transfer Dock
AmbientMark
```

Semantic ownership:

```text
Settings        → SettingCard / settings-control
Torrent data    → DataGrid / VirtualList
Logs            → DataPage / DataPanel / VirtualList
Dialogs         → dialog + surface--modal
Torrent state   → status-pill
Global state    → Status / Transfer Dock
Select          → W.Components.selectControl()
Filter Chip     → W.Components.filterChip()
Compact boolean → W.Components.checkControl()
Brand motion    → W.AmbientMark
Client time     → W.Time
```

### COMPONENT-001 — No feature-local clone

A feature runtime may add behavior, validation or data semantics. It may not create a second Button, Select, Card, Chip, Badge, Modal or Popover visual system.

## 6. Control state system

### CONTROL-001 — Required states

Every interactive primitive has:

```text
Default
Hover
Focus-visible
Active / Selected
Disabled
```

Default must already be visible against its parent surface. Focus uses a consistent cool-blue ring. Disabled controls do not lift or animate.

### INPUT-001 — Visible at rest

Search/Input/Select cannot disappear into a near-black panel. The control must have distinct border/surface before hover.

### SELECT-001 — Canonical dark/light Listbox

Visible Select UI uses `W.Components.selectControl()` rather than trusting the OS popup theme.

Structure:

```text
Select Trigger
└─ Floating Listbox
   ├─ optional Search
   ├─ Option
   └─ Selected Option
```

Required keyboard/ARIA behavior:

```text
Arrow Up / Down
Home / End
Enter / Space
Escape
aria-haspopup=listbox
role=listbox / option
aria-selected
```

Legacy/native `<select>` may remain as a hidden data/compatibility bridge and is progressively upgraded by `upgradeNativeSelect(s)`.

### CHIP-001

Filter chips share one shape, padding, hover, active fill and focus ring. Logs severity filters use this primitive.

### CHECK-001

Compact booleans such as Logs “Follow latest” use one `CheckControl`. Settings booleans use the existing Switch; the two semantic roles are distinct and each has one implementation.

## 7. Ambient brand motion

### BRAND-001 — AmbientMark template

The logo is wrapped by a reusable, product-neutral component:

```text
AmbientMark
├─ Mark / Logo
├─ Orbit layer
├─ Spark layer
├─ Shine layer
└─ Ambient scheduler
```

CSS owns visual animation. JavaScript only selects **when** and **which short effect** runs.

### BRAND-002 — Random, sparse, restrained

Default is static. Typical scheduler contract:

```text
random interval: ~8–28 s
some checks intentionally do nothing
single event: ~1–2 s
```

Allowed effect pool:

```text
orbit
spark
3D tilt
shine sweep
soft breathe
low-probability orbit + spark
```

Spark colors come from WeiG cool accents plus restrained semantic highlights. Random RGB nightclub effects are forbidden.

### BRAND-003 — Performance/accessibility

- no permanent RAF loop;
- no continuous orbit;
- scheduler pauses while `document.hidden`;
- `prefers-reduced-motion: reduce` disables orbit/tilt/spark motion;
- RNG can be injected for deterministic tests;
- component is reusable by future WeiG sites without qB-specific code.

## 8. User position and polling

### SCROLL-001 — Position is state

Polling, incremental updates and status refreshes preserve the user’s conceptual position.

Allowed deliberate resets:

```text
Filter/facet change
Pagination change
Page-size change
Search context change
Explicit Go to top
```

### DATAFLOW-001 — Polling updates data, not navigation

```text
Timer / event
   ↓
Fetch compatible data
   ↓
Update cache/model
   ↓
Refresh visible virtual window
```

Do not recreate the conceptual page every refresh.

### DATAFLOW-002 — No duplicate high-frequency polling

Feature UI should subscribe to existing streams where possible rather than adding one timer per card.

## 9. Torrent list and detail navigation

### NAV-001 — Context Back

Torrent Detail places Back **to the left of Overview**:

```text
[ ← Back to torrents ] [ Overview ] [ Files ] [ Trackers ] [ Peers ] ...
```

It returns to the list the user came from, not merely “the home route”.

### NAV-002 — Preserve page + scroll

Example:

```text
Page 2 / scroll 600px
        ↓
Torrent Detail
        ↓ Back or Esc
Page 2 / scroll 600px
```

Page/filter state remains in the application model; list viewport position is explicitly restored.

### NAV-003 — Safe fallback

A directly opened `#/torrent/<hash>` without an internal list context falls back to Torrents home. Do not blindly call `history.back()` into an unrelated external page.

### KEYBOARD-001 — Escape priority

```text
1. Select/Popover open → close it
2. Dialog open         → dialog owns Esc
3. Editable focused    → do not steal key
4. Torrent Detail      → Context Back
5. Torrent List        → existing list behavior
```

## 10. Empty states

### EMPTY-001 — Zero result is compact

A zero-result Torrent filter is valid, not a giant blank table. Typical desktop empty surface is roughly 180–240px with useful explanation/action.

### EMPTY-002 — Keep useful global context

Transfer/network stats and Filter Shelf may remain visible because they describe qB itself, not only the current result set.

## 11. Transfer Control Dock

### DOCK-001 — Operational and interactive

Desktop bottom dock may contain:

```text
↓ download
↑ upload
ALT speed mode
connection
Torrent count
refresh time
Transfer / session
```

### DOCK-002 — Speeds are controls

Clicking global DL/UL opens a shared modal/floating limit control with current value, presets, Custom and Unlimited.

### DOCK-003 — Alternative speed mode is explicit

State is expressed by shape/fill/aria, not color alone.

### DOCK-004 — Connection opens diagnostics

Connection remains the entry to qB/WebAPI/compatibility metadata.

## 12. Transfer graph and session stats

### TRANSFER-001 — Bounded local history

Transfer history remains transient UI telemetry with maximum **900 samples**.

### TRANSFER-002 — Native lightweight chart

Canvas/SVG is preferred over a large chart runtime. Hidden charts do not keep doing visual work.

### TRANSFER-003 — Unsupported data is honest

Unsupported fields render `—`, never fabricated values.

## 13. Settings

### SETTINGS-001 — Metadata driven

Only Preferences actually returned/supported by the connected qB instance are editable.

### SETTING-001 — Title → Description → Control

```text
Title
Description
Control
```

Boolean → Switch  
Path/text → Input  
Enum → Select  
Number → numeric input

### SETTINGS-002 — Canonical card ownership

qB preferences use `W.Components.preferenceField()`; WeiG deployment metadata uses `W.Components.readonlySettingField()`; WeiG UI preferences use `settings-control`.

Alternative WebUI retains special path/disable safety behavior but uses the same visual Settings primitives.

### SETTINGS-003 — Client display timezone

Display timezone appears as a WeiG UI preference, stored in browser state, not qB Preferences.

## 14. Logs

### LOGS-001 — Logs are data

Desktop row:

```text
Log message | Time | Level
```

qB levels:

```text
1 Normal
2 Info
4 Warning
8 Critical
```

### LOGS-002 — Incremental + bounded

Initial request uses `last_known_id=-1`; incremental calls use the current **maximum ID**. Main browser log buffer retains at most **5000 newest rows**.

### LOGS-003 — Newest first

Display order is descending ID/timestamp:

```text
Newest
Older
Oldest
```

The newest row belongs at the top; incremental cursor remains the maximum ID.

### LOGS-004 — Follow latest under newest-first

- Follow ON keeps the viewport at top.
- Manual downward scroll disables Follow.
- With Follow OFF, inserting rows above compensates scroll so the user keeps reading the same historical content.
- Search/severity changes are deliberate context changes and may reset top.

### LOGS-005 — Canonical controls only

Logs compose Search + FilterChip + CheckControl + Select + Button + StatusPill + DataPanel + VirtualList. They do not implement local Button/Select/Chip styling.

## 15. Client time zone

### TIME-001 — Display layer only

qB timestamp is normalized to epoch, then rendered through `W.Time` / `Intl.DateTimeFormat`.

```text
qB epoch
→ stable normalized timestamp
→ selected IANA timezone
→ localized visible text
```

Changing time zone does not modify qB/server time.

### TIME-002 — Sources

First option is **System / Browser**. Supported browsers may enumerate IANA zones with `Intl.supportedValuesOf('timeZone')`; older browsers use a common-zone fallback list.

### TIME-003 — One state store

The selected value is stored under `weigg.timeZone`. Logs and Settings read/write the same value.

### TIME-004 — Source timestamp remains immutable

Changing timezone changes visible text only; epoch and `<time datetime>` remain unchanged.

## 16. Internationalization

### I18N-001 — English canonical

Feature code requests semantic keys instead of branching directly on locale.

### I18N-002 — Maintained languages

```text
English
简体中文 (zh-CN)
```

### I18N-003 — Resolution

```text
Explicit user selection
→ browser locale
→ English fallback
```

### I18N-004 — Official qB terminology

Use official qB wording where possible; WeiG-specific concepts are maintained locally.

## 17. Typography

Every string uses a semantic role:

```text
page-title, section-title, item-primary, body, data,
label, description, meta, caption, table-header,
table-cell, status, button, input, tooltip
```

Feature CSS does not hard-code arbitrary font sizes.

## 18. DataGrid and virtualization

Desktop Torrent list supports sorting, resize, show/hide/order and server page sizes:

```text
20 / 50 / 100 / 200
```

### LARGE-001

```text
API/cache item count != mounted DOM count
```

Torrent, Files, Peers, Trackers, Logs and similar high-cardinality lists remain virtualized.

### SELECT-ROW-001

Multi-selection operates on data/selection state rather than mounting hidden rows.

## 19. Tracker privacy

Tracker display keys strip query/fragment credentials:

```text
https://tracker.example/announce?passkey=SECRET#x
→
https://tracker.example/announce
```

Raw values are retained only when mutation APIs require them.

## 20. Mobile

Mobile uses Torrent cards, bottom navigation, Drawer/Sheet filters and touch-first actions. Critical targets are roughly 44×44px or larger.

Validation widths include:

```text
320
375
390
430
768
```

A custom Select becomes a mobile-safe floating/sheet-like surface rather than an unreadable desktop popup.

## 21. Motion and performance

Prefer static gradients, borders, transform and opacity. Avoid:

```text
per-row backdrop filters
persistent glow animation
full-list rebuild animations
hidden chart work
permanent brand orbit
continuous random spark generation
```

Ambient motion is short, sparse and stopped when not visible.

## 22. Cache identity

HTML declares no-store/no-cache metadata. Local CSS/JS direct and lazy assets are addressed by one deployment Git SHA through `buildAssetUrl()`.

File lineage names (`v022`, `v030`, `v036`) do not define cache identity.

## 23. Definition of success

The design succeeds when:

- surfaces feel layered but calm;
- every Select/Button/Chip/Card looks like one product;
- the logo occasionally feels alive without demanding attention;
- Logs open with newest information first;
- users can choose how timestamps are displayed without touching the server;
- Page 2 → Detail → Back/Esc returns to Page 2 and the prior viewport;
- polling never fights the user;
- English and Simplified Chinese both feel intentional;
- mobile remains touch-first;
- thousands of Torrents do not become thousands of DOM nodes.

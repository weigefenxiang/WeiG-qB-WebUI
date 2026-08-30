# WeiG qB WebUI — Design System

Version: **1.3**  
Status: **Frozen v0.2.2 Spatial UI baseline**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9**

> This file is the single authority for UI and visual work. Any theme, typography, component, navigation, i18n, Settings, animation, DataGrid, mobile, filtering or layout change must read and follow this file first.

## 1. Design mission

WeiG qB WebUI should feel like a premium control console floating in deep space: precise, dimensional, calm, data-dense on desktop, touch-first on mobile, readable for long sessions, and smooth with very large Torrent libraries.

Design references are principles only. The v0.2.2 direction combines:

- Linear: hierarchy, restraint and precision;
- Raycast: floating chrome, search and popovers;
- Superhuman: premium dark surfaces and restrained purple/blue glow;
- Revolut/BMW: material depth, dark-panel separation and instrument-like data presentation;
- existing qBittorrent WebUIs: product functionality only.

Do not copy another product's visual identity. The resulting language is **WeiG Nebula Spatial Console**.

## 2. Non-negotiable rules

1. Dark/Nebula Spatial is the primary visual target; Light/System use the same semantic architecture.
2. Feature code must not invent colors, radii, shadows, motion timings, typography sizes or translations.
3. Button, IconButton, Tooltip, Dialog, Input, Menu, Card, Switch, Tabs, DataGrid, Filter Popover and other primitives have one canonical implementation.
4. Every non-home view has a visible Back action. Error states retain Back/Home/Reload recovery.
5. Mobile is a first-class interaction target, never a squeezed desktop table.
6. Large datasets never map linearly to DOM nodes.
7. Hover-only behavior always has a touch equivalent.
8. Visual polish must never hide status, progress, speed, errors or destructive actions.
9. Reduced Motion must be respected.
10. Normal product UI must not expose developer counters such as DOM limits; diagnostics belong in Settings → Performance.
11. English is the canonical source language. Locale-specific Feature branches are forbidden.
12. English and Simplified Chinese are maintained product languages. Missing translations always fall back to English.
13. Raw qB Preference/API keys are implementation metadata, not normal end-user labels.
14. High-cardinality filter lists must not permanently consume the desktop Sidebar.
15. Search/Input controls must be visually distinguishable before focus, not only after click.

## 3. Spatial hierarchy — hard rules

### SPATIAL-001 — Six semantic depth levels

All major surfaces map to one of these levels:

```text
Void      page/background
Base      workspace background
Panel     Sidebar / table container / Settings section
Card      stats and standard content cards
Raised    search / toolbar / active control / detail summary
Floating  popover / menu / dialog / action sheet
```

Increasing elevation changes more than background color. It may increase:

- surface luminance;
- thin cool-gray border visibility;
- top inner highlight;
- external black shadow;
- extremely weak blue/violet ambient glow.

Do not make all dark surfaces the same black.

### SPATIAL-002 — Material before neon

Premium depth comes from material separation, edges and lighting. Blue/violet/cyan accent wakes up mainly for selected, hover, focus, active and primary actions.

Never compensate for poor hierarchy by adding constant neon everywhere.

### SPATIAL-003 — Interaction depth

Interactive cards and raised controls may lift roughly 1–2px on hover. The active element may receive a restrained cool glow. Large tables remain quiet at rest.

> Interaction moves. Information stays stable.

## 4. Information architecture

### IA-001 — Topbar owns application navigation

Desktop application destinations live in the Topbar:

```text
Torrents
Search
RSS
Logs
Settings
```

The Topbar also owns contextual search, Add Torrent and global utility actions.

### IA-002 — Sidebar is a compact Torrent state rail

The desktop Sidebar permanently exposes only low-cardinality, high-frequency Torrent state filtering.

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

Do not permanently expand Tracker, Save Path, Category or Tag catalogs in the Sidebar.

### SIDEBAR-001 — Avoid nested desktop scrolling

At ordinary desktop heights the Sidebar should not have its own scrollbar. Prefer moving high-cardinality information to horizontal shelves, popovers, the Status Dock or other available workspace surfaces.

On exceptionally small/mobile layouts, scrolling may be used as a fallback when required for accessibility.

### FILTER-001 — High-cardinality filters use Filter Shelf + Popover

Tracker, Save Path, Category and Tags live in a horizontal Filter Shelf above the Torrent data surface.

```text
[ Tracker ▾ ] [ Save Path ▾ ] [ Category ▾ ] [ Tags ▾ ]
```

Each facet opens a searchable Floating Popover. The underlying existing filter state remains canonical; the shelf is a presentation layer.

On mobile, the same facet controls may open as bottom/floating sheets. Do not expose tiny desktop dropdown affordances.

### IA-003 — Connection details belong to Status Dock

qBittorrent version, WebAPI version and compatibility metadata do not consume permanent Sidebar height. The Status Dock exposes current connection state and opens a compact Floating details panel when requested.

### IA-004 — Search is contextual

```text
Torrents  → Search torrents
Settings  → Search settings
Search    → Search engine query
RSS       → Search RSS
Logs      → Search logs
```

A contextual search must never trigger hidden/off-route Feature work.

## 5. Internationalization — hard rules

### I18N-001 — English canonical source

All canonical product copy, semantic IDs and fallback labels are English. Other languages are translation overlays.

Feature code requests semantic keys such as:

```text
nav.settings
settings.downloads
pref.save_path.label
state.downloading
```

Do not add `if (lang === ...)` branches inside Features.

### I18N-002 — Maintained languages

Release-maintained UI languages:

```text
English (canonical)
简体中文 (zh-CN)
```

Additional locale overlays may exist, but incomplete entries fall back to English and are not allowed to break layout or show raw translation keys.

### I18N-003 — Locale resolution

```text
Explicit user selection
→ browser locale
→ English
```

Automatic mode follows `navigator.languages`/browser preferences.

### I18N-004 — qB terminology source

For qBittorrent concepts/settings, prefer terminology already used by official qBittorrent WebUI translation resources. WeiG-specific concepts are translated by this project.

```text
Official qBittorrent terminology
→ reviewed WeiG translation
→ English fallback
```

### I18N-005 — No raw identifiers in product UI

Do not expose values such as `auto_tmm_enabled` or translation keys as normal setting labels. Internal identifiers may exist in developer diagnostics/search metadata only.

## 6. Semantic typography — hard rules

### TYPO-001 — Every text element has a semantic role

Allowed roles:

```text
page-title
section-title
item-primary
body
data
label
description
meta
caption
table-header
table-cell
status
button
input
tooltip
```

### TYPO-002 — Feature CSS must not hard-code font sizes

Feature selectors consume centralized semantic typography tokens.

### TYPO-003 — Global size changes use one offset

If the whole product reads too small, increase the global typography offset by 2–3px rather than patching components individually.

```css
--font-scale-offset: 0px; /* Standard */
--font-scale-offset: 2px; /* Large */
--font-scale-offset: 3px; /* XLarge */
```

Current default: **Large (+2px)**.

### TYPO-004 — Font size and density are independent

Large typography may be combined with Compact density. Readability must not require wasting vertical space.

## 7. Search and input surfaces

### INPUT-001 — Distinguishable at rest

Search, Input and Select controls must be visually distinct from the page before interaction. Default state uses a Raised/Control surface with a visible edge and top highlight.

### INPUT-002 — Four interaction states

```text
Default
Hover
Focus-visible / focus-within
Disabled
```

Hover adds a restrained cool edge/glow and may lift 1px. Focus uses a clear blue border plus soft 2–3px focus ring and ambient glow.

Do not use a near-black input that is indistinguishable from its surrounding black panel.

## 8. Nebula background

Starfield remains CSS-only and offline-safe:

```text
Void
→ far stars
→ near stars
→ low-opacity blue/violet nebula
→ sparse ambient glow
```

Settings:

```text
Off
Subtle
Full
```

No frequent blinking, particle explosions or pointer-driven full-page repaint.

## 9. Settings UX — hard rules

### SETTINGS-001 — Metadata-driven UI

qB Preferences are rendered through a metadata layer, not raw key/value rows.

Each known setting may define canonical English title, description, control type, category/section, units/options, capability/version constraints and localized copy.

### SETTING-001 — Title → Description → Control

Every standard Setting Card follows the same vertical information model:

```text
Title            one primary line
Description      middle explanatory area
Control          bottom full-width or bottom-aligned control
```

Long titles should prefer a single-line ellipsis plus Tooltip instead of wrapping into three narrow lines.

Descriptions normally reserve about two lines so neighboring cards remain visually aligned.

### SETTINGS-002 — Two-column desktop default

```text
Desktop          2 columns
Tablet           1 column
Phone            1 column
```

Do not force three columns merely because a monitor is wide. Readability and card proportion have priority over filling every pixel.

### SETTINGS-003 — Controls match semantics

```text
Boolean → Switch
Path/Text → Input
Enum → Select
Number → numeric Input/control
Dangerous action → dedicated confirmation flow
```

### SETTINGS-004 — Settings search

Settings search may match localized title, canonical English title, description and internal key. The raw key does not need to be visibly rendered.

### SETTINGS-005 — Dynamic qB capability

Only settings returned/supported by the connected qB instance are presented as editable.

## 10. Desktop DataGrid

Desktop Torrent list is a virtualized DataGrid.

Required behavior:

- pointer column resize;
- sortable headers;
- show/hide columns;
- configurable order;
- persisted width/order;
- reset defaults;
- page sizes 20 / 50 / 100 / 200;
- page size controls data fetch, not mounted DOM count.

Core/default columns:

```text
Name
Size
Progress
Download
Upload
ETA
Status
```

## 11. Large-list rule

```text
API/cache count != rendered DOM count
```

Torrent, Files, Peers, Trackers, Logs, Search Results and similar lists use Virtual Window + overscan.

Targets:

```text
Desktop Torrent DOM: normally ~20–60, preferably <100
Mobile Torrent DOM: preferably <=50
```

## 12. Tracker privacy

Any Tracker/announce URL used for display, filtering or local UI state is normalized before presentation.

```text
https://tracker.m-team.cc/announce?credential=SECRET
→
https://tracker.m-team.cc/announce
```

Never expose query credentials/passkeys/tokens/fragments in normal UI.

## 13. Mobile

Mobile uses compact Torrent cards, touch-first filters, Drawer/Bottom surfaces, More/Action Sheet and bottom application navigation. It never exposes tiny desktop column-resize handles.

Critical touch targets are approximately 44×44px or larger. Primary validation widths: 320, 375, 390, 430 and 768px.

## 14. Status Dock

The Status Dock is operational, not a debug bar. It may expose down/up speed, connection state, Torrent count and refresh time. Detailed qB/WebAPI/compatibility metadata opens from the connection item rather than consuming permanent Sidebar space.

## 15. Canonical components

Use one implementation for:

```text
Button
IconButton
Tooltip
Dialog
Drawer
Action Sheet
Input
Search
Select
Switch
Tabs
Menu
Badge/Status
Card/Panel
DataGrid
Pagination
VirtualList
Settings Card
Filter Shelf
Facet Popover
Connection Popover
```

Do not create feature-specific copies.

## 16. Motion and performance

Prefer static gradients, borders, transform and opacity. Avoid per-row backdrop filters, persistent blur animations, endless gradients, mass box-shadow animation and full-list rebuilds.

Nebula Flow remains interaction-triggered rather than permanently animated.

## 17. Light mode

Light mode preserves the same semantic depth structure with brighter materials, cool neutral borders and subdued shadows. It must not become a separate unrelated design system.

## 18. Definition of success

The product should look materially layered even before interaction; Search and Settings controls must be easy to locate; the desktop Sidebar should remain calm and normally scrollbar-free; Settings should read top-to-bottom as Title → Description → Control; English and Simplified Chinese should feel native rather than patched; mobile must preserve the same hierarchy with touch-first composition; and thousands of Torrents must remain smooth.

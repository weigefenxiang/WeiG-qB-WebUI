# WeiG qB WebUI — Design System

Version: **1.1**  
Status: **Frozen v0.2 visual baseline**  
Theme: **Nebula Noir**  
Compatibility floor: **qBittorrent 4.1.9**

> This file is the single authority for UI and visual work. Any theme, typography, component, animation, DataGrid, mobile or layout change must read and follow this file first.

## 1. Design mission

WeiG qB WebUI should feel like a premium control surface floating in deep space: dark, dimensional, precise, information-dense on desktop, touch-first on mobile, and smooth with very large torrent libraries.

References are used for principles only: Linear for hierarchy and theming, Raycast for floating interactions, Apple for motion/touch polish, and existing qBittorrent WebUIs for product functionality. Do not copy another WebUI's visual identity.

## 2. Non-negotiable rules

1. Dark/Nebula Noir is the primary design target; Light/System use the same semantic token architecture.
2. Feature code must not invent colors, radii, shadows, motion timings or typography sizes.
3. Button, IconButton, Tooltip, Dialog, Input, Menu, Card, Switch, Checkbox, Tabs, DataGrid and other primitives have one canonical implementation.
4. Every non-home view has a visible Back action. Error states retain Back/Home/Reload recovery.
5. Mobile is a first-class interaction target, never a squeezed desktop table.
6. Large datasets never map linearly to DOM nodes.
7. Hover-only behavior always has a touch equivalent.
8. Visual polish must never hide status, progress, speed, errors or destructive actions.
9. Reduced Motion must be respected.
10. Normal product UI must not expose developer counters such as DOM limits; diagnostics belong in Settings → Performance.

## 3. Semantic typography — hard rules

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

Examples:

- Torrent names, Tracker names, Category names and primary Settings titles → `item-primary`.
- Speeds, sizes, ETA, ratio, version values and numeric facts → `data`.
- Field names and metadata keys → `label`.
- Help text, current-speed descriptions and explanatory copy → `description`.
- qBittorrent/WebAPI/compatibility secondary information → `meta`/`data`.
- DataGrid headings → `table-header`.
- DataGrid values → `table-cell`.

### TYPO-002 — Feature CSS must not hard-code font sizes

Feature selectors may consume semantic typography tokens but must not create `font-size: 13px`, `15px`, `17px`, etc. New typography values belong in the centralized token layer.

### TYPO-003 — Global size changes use one offset

When the overall UI is too small, increase the global typography scale by **2–3px**, rather than patching Torrent, Sidebar, Connection, Dialog and Settings individually.

```css
--font-scale-offset: 0px; /* Standard */
--font-scale-offset: 2px; /* Large */
--font-scale-offset: 3px; /* XLarge */
```

The v0.2 default is **Large (+2px)** based on real 4.1.9 desktop feedback.

### TYPO-004 — Font size and UI density are independent

Users may choose a large font with compact density, or a smaller font with comfortable density. Do not couple readable typography to huge rows.

Semantic base scale:

```text
Page title      24px + offset
Section title   18px + offset
Item primary    15px + offset
Body/Data       14px + offset
Label           13px + offset
Description     12px + offset
Meta            12px + offset
Caption         11px + offset
Table header    13px + offset
Table cell      13px + offset
Status          12px + offset
Button          13px + offset
Input           14px + offset
```

Use system/offline-safe fonts only and tabular numerals for speeds, sizes, ratios and timers where possible.

## 4. Density system

Density is a global semantic setting:

```text
Compact
Standard
Comfortable
```

Desktop Torrent row targets are approximately 48 / 56 / 64px. Mobile cards may use independent heights appropriate for touch.

## 5. Nebula Noir tokens

Core surfaces:

```text
Void
Deep
Surface
Elevated
Floating
```

Core accent remains blue → violet → cyan. Status colors are semantic Success / Warning / Danger / Info. Avoid flat pure-black pages and giant high-saturation areas.

Depth is expressed by brighter semantic surfaces, a thin translucent edge, top inner highlight, soft black shadow and very weak cool ambient glow.

## 6. CSS starfield

Starfield is CSS-only and offline-safe. No external wallpaper/CDN/canvas particle engine by default.

Layers:

```text
Void
→ far stars
→ near stars
→ low-opacity blue/violet nebula
→ sparse ambient glow
```

Starfield setting:

```text
Off
Subtle
Full
```

Motion is very slow. No frequent blinking, particle explosions or pointer-driven full-page repaint.

## 7. 3D surfaces

Only these elevation classes exist:

```text
Surface
Panel
Card
Raised Card
Floating Panel
Modal
```

Cards may lift roughly `translateY(-2px)` on hover. Torrent rows remain visually lighter than cards/dialogs. Dialogs and floating controls may have stronger depth.

## 8. Nebula Flow

Nebula Flow is the signature interaction: a subdued blue → violet → cyan edge highlight that wakes only on the currently interacted element.

Rules:

- nearly invisible at rest;
- hover/focus-triggered, not an endless effect on every row;
- typical 1.2–1.8 second visual cycle;
- use pseudo-elements, transform and opacity where possible;
- disabled by Reduced Motion when non-essential.

## 9. Desktop DataGrid

Desktop Torrent list is a virtualized DataGrid, not one giant card per Torrent.

Required behavior:

- column resize by pointer;
- sortable headers;
- selectable visible columns;
- configurable order;
- saved column width/order;
- reset to defaults;
- page sizes 20 / 50 / 100 / 200;
- page size is a data-fetch setting, not a DOM-node count.

Core/default columns prioritize:

```text
Name
Size
Progress
Download
Upload
ETA
Status
```

Optional columns include Ratio, Tracker and Category, with future fields added through the same DataGrid schema.

## 10. Large-list rule

API/cache count and rendered DOM count are separate concepts.

```text
200 models in page/cache
!=
200 mounted rows
```

Torrent, Files, Peers, Trackers, Logs, Search Results and other large lists use Virtual Window + overscan.

Targets:

```text
Desktop visible/overscan Torrent DOM: normally ~20–60, preferably <100
Mobile Torrent DOM: preferably <=50
```

Performance diagnostic values belong in Settings, not the main dashboard.

## 11. Tracker privacy

Tracker/announce URLs may contain secrets. Any display, filter key or local UI state must normalize them before presentation.

Example:

```text
https://tracker.m-team.cc/announce?credential=SECRET
→
https://tracker.m-team.cc/announce
```

Never display or store query credentials/passkeys/tokens/fragments as a visual filter key. Filtering may use normalized scheme + host + non-default port + path.

For qB 5.x, an API-provided private flag may power exact Private filtering. For older qB versions lacking that capability, UI must label tracker-domain rules as PT heuristic rather than claiming exact private-torrent detection.

## 12. Mobile

Mobile uses compact Torrent cards, Drawer navigation and a More/Action Sheet. It does not offer tiny draggable desktop column boundaries.

Default mobile card prioritizes:

```text
Torrent name
Status + progress
Progress bar
Download + upload
ETA / size
More action
```

Mobile fields are configurable. Critical actions must have touch targets around 44×44px and cannot depend on hover/right-click.

Primary validation widths: 320, 375, 390, 430 and 768px, including portrait/landscape/software keyboard states.

## 13. Status Dock

The bottom dock is a real operational status surface, not a developer debug bar. It may show global down/up speed, connection state, Torrent count and refresh status with readable semantic typography.

## 14. Settings

WeiG UI Settings owns:

```text
Appearance
Font size
Density
Starfield
Motion
Page size
Refresh interval
Column layout
Mobile card fields
PT tracker rules
Performance diagnostics
```

qBittorrent Settings must only render preferences returned by the connected version/capability profile. Do not expose a newer-version control to an old instance and pretend it works.

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
Select
Switch
Checkbox
Tabs
Menu
Badge/Status
Card/Panel
DataGrid
Pagination
VirtualList
```

Do not create feature-specific copies such as `SettingsButton`, `TorrentSpecialButton`, or local Tooltip implementations.

## 16. Motion and performance

Prefer transform/opacity. Avoid persistent animated blur, box-shadow animation on many rows, per-row backdrop filters, endless gradients and full-list rebuilds.

Principle:

> Interaction moves. Information stays stable.

## 17. Loading, empty and error states

Avoid full-page blocking spinners. Use local loading/skeleton states while navigation stays available. Empty states offer a clear next action. Feature errors must preserve a route to recovery.

## 18. Definition of success

The UI should look premium at first glance, stay calm after long use, remain readable with the default Large typography, work naturally on touch devices, keep secrets out of tracker displays, and remain smooth even when the underlying library contains thousands of Torrents.

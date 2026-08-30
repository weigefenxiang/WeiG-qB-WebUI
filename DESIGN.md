# WeiG qB WebUI — Design System

Version: **1.2**  
Status: **Frozen v0.2.1 UI baseline**  
Theme: **Nebula Noir**  
Compatibility floor: **qBittorrent 4.1.9**

> This file is the single authority for UI and visual work. Any theme, typography, component, navigation, i18n, Settings, animation, DataGrid, mobile or layout change must read and follow this file first.

## 1. Design mission

WeiG qB WebUI should feel like a premium control surface floating in deep space: dark, dimensional, precise, information-dense on desktop, touch-first on mobile, multilingual without visual fragmentation, and smooth with very large Torrent libraries.

References are principles only: Linear for hierarchy/theming, Raycast for floating interactions/search, Apple for motion/touch polish, and existing qBittorrent WebUIs for product functionality. Do not copy another WebUI's visual identity.

## 2. Non-negotiable rules

1. Dark/Nebula Noir is the primary visual target; Light/System use the same semantic token architecture.
2. Feature code must not invent colors, radii, shadows, motion timings, typography sizes or translations.
3. Button, IconButton, Tooltip, Dialog, Input, Menu, Card, Switch, Checkbox, Tabs, DataGrid and other primitives have one canonical implementation.
4. Every non-home view has a visible Back action. Error states retain Back/Home/Reload recovery.
5. Mobile is a first-class interaction target, never a squeezed desktop table.
6. Large datasets never map linearly to DOM nodes.
7. Hover-only behavior always has a touch equivalent.
8. Visual polish must never hide status, progress, speed, errors or destructive actions.
9. Reduced Motion must be respected.
10. Normal product UI must not expose developer counters such as DOM limits; diagnostics belong in Settings → Performance.
11. English is the canonical source language. Locale-specific Feature branches are forbidden.
12. Raw qB Preference/API keys are implementation metadata, not normal end-user labels.

## 3. Information architecture

### IA-001 — Topbar owns application navigation

Desktop application-level destinations live in the Topbar:

```text
Torrents
Search
RSS
Logs
Settings
```

The Topbar also owns contextual search, Add Torrent and global utility actions.

Do not place application pages in the Torrent Sidebar merely because space is available.

### IA-002 — Sidebar owns Torrent dataset filters

The Sidebar is scoped to the current Torrent library:

```text
Torrent state
Trackers
Save Path
Categories
Tags
Connection metadata
```

It is not a second application menu.

### IA-003 — Mobile uses dedicated application navigation

On phone layouts, primary application routes use a touch-first bottom navigation. The Drawer remains focused on Torrent filters. Low-frequency routes may move into a More surface when needed.

### IA-004 — Search is contextual

The same Topbar search surface changes meaning with the current Feature:

```text
Torrents  → Search torrents
Settings  → Search settings
Search    → Search engine query
RSS       → Search RSS
Logs      → Search logs
```

A contextual search must never trigger hidden/off-route Feature work.

## 4. Internationalization — hard rules

### I18N-001 — English canonical source

All canonical product copy, semantic IDs and fallback labels are English. Other languages are translation overlays.

Feature code should request semantic keys, for example:

```text
nav.settings
settings.downloads
pref.save_path.label
state.downloading
```

Do not add `if (lang === ...)` branches inside Features.

### I18N-002 — Locale resolution

Priority:

```text
Explicit user selection
→ browser locale
→ English
```

Automatic mode uses browser language preferences. Unsupported locales fall back to English without showing translation keys.

### I18N-003 — Supported locale targets

Initial runtime targets:

```text
English
简体中文
繁體中文
日本語
한국어
```

A locale may be partially translated; every missing entry must safely fall back to English.

### I18N-004 — qB terminology source

For qBittorrent concepts/settings, prefer terminology already used by official qBittorrent WebUI translation resources. WeiG-specific concepts are translated by this project.

Translation priority:

```text
Official qBittorrent terminology
→ reviewed WeiG translation
→ English fallback
```

### I18N-005 — Language selection is a normal setting

Settings must expose:

```text
Automatic (Browser)
English
简体中文
繁體中文
日本語
한국어
```

Manual selection persists locally.

### I18N-006 — No raw translation/API identifiers in product UI

The UI must not expose values such as:

```text
settings.download.autoTmm
auto_tmm_enabled
web_ui_csrf_protection_enabled
```

as ordinary labels. Developer diagnostics may reveal identifiers when explicitly needed.

## 5. Semantic typography — hard rules

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
- Field names → `label`.
- Help/explanatory copy → `description`.
- qBittorrent/WebAPI/compatibility secondary information → `meta`/`data`.
- DataGrid headings → `table-header`.
- DataGrid values → `table-cell`.

### TYPO-002 — Feature CSS must not hard-code font sizes

Feature selectors consume semantic typography tokens. New sizes belong in the token layer.

### TYPO-003 — Global size changes use one offset

When the overall UI is too small, increase the global typography scale by **2–3px**, rather than patching Torrent, Sidebar, Connection, Dialog and Settings individually.

```css
--font-scale-offset: 0px; /* Standard */
--font-scale-offset: 2px; /* Large */
--font-scale-offset: 3px; /* XLarge */
```

Current default: **Large (+2px)**.

### TYPO-004 — Font size and UI density are independent

Users may choose a large font with Compact density or smaller font with Comfortable density.

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

Use system/offline-safe fonts and tabular numerals for speeds, sizes, ratios and timers where possible.

## 6. Density system

Global density:

```text
Compact
Standard
Comfortable
```

Desktop Torrent row targets are approximately 48 / 56 / 64px. Mobile cards may use independent heights appropriate for touch.

## 7. Nebula Noir

Core surfaces:

```text
Void
Deep
Surface
Elevated
Floating
```

Accent remains blue → violet → cyan. Status colors are semantic Success / Warning / Danger / Info. Avoid flat pure-black pages and giant high-saturation areas.

Depth is expressed through brighter semantic surfaces, thin translucent edges, top inner highlight, soft black shadow and weak cool ambient glow.

## 8. CSS starfield

Starfield is CSS-only and offline-safe. No external wallpaper/CDN/canvas particle engine by default.

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

## 9. 3D surfaces and Nebula Flow

Only these elevation classes exist:

```text
Surface
Panel
Card
Raised Card
Floating Panel
Modal
```

Cards may lift about `translateY(-2px)` on hover. Torrent rows remain visually lighter than cards/dialogs.

Nebula Flow is a subdued blue → violet → cyan edge highlight that appears only on the active hovered/focused surface. It must not run endlessly on all Torrent rows and must respect Reduced Motion.

## 10. Desktop DataGrid

Desktop Torrent list is a virtualized DataGrid, not one giant card per Torrent.

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

Optional columns include Ratio, Tracker and Category.

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

Performance diagnostics belong in Settings, not the dashboard.

## 12. Tracker privacy

Any Tracker/announce URL used for display, filtering or local UI state is normalized before presentation.

```text
https://tracker.m-team.cc/announce?credential=SECRET
→
https://tracker.m-team.cc/announce
```

Never expose query credentials/passkeys/tokens/fragments in normal UI.

For qB 5.x, use exact private capability when available. Older qB versions use an explicitly labeled PT tracker-domain heuristic.

## 13. Mobile

Mobile uses compact Torrent cards, Drawer filtering, More/Action Sheet and bottom application navigation. It never exposes tiny desktop column-resize handles.

Default card prioritizes:

```text
Torrent name
Status + progress
Progress bar
Download + upload
ETA / size
More action
```

Critical touch targets are approximately 44×44px or larger. Primary validation widths: 320, 375, 390, 430 and 768px.

## 14. Settings UX — hard rules

### SETTINGS-001 — Metadata-driven UI

qB Preferences are rendered through a metadata layer, not raw key/value rows.

Each known setting may define:

```text
canonical English title
description
control type
section/category
units/options
capability/version constraints
localized title/description
```

Unknown qB Preference keys use a humanized English fallback and remain safely editable only when the underlying type is understood.

### SETTINGS-002 — Card-based composition

Desktop default:

```text
Category
  → section heading
  → two-column Setting cards
```

Very wide desktop may use three columns. Tablet/phone uses one column.

Do not waste an entire viewport row on one small checkbox unless the content genuinely needs it.

### SETTINGS-003 — Controls match data semantics

Use canonical controls:

```text
Boolean → Switch
Path/Text → Input
Enum → Select
Number → numeric control/input
Dangerous operation → dedicated confirmation flow
```

Tiny browser-default checkboxes are not the standard Settings experience.

### SETTINGS-004 — Settings search

Settings has a dedicated search field. It may match translated title, canonical English title, description and internal key; the raw key does not need to be visibly rendered.

### SETTINGS-005 — Dynamic qB capability

Only settings returned/supported by the connected qB instance are presented as editable. Do not expose a newer-version setting to an older instance and pretend it works.

## 15. Status Dock

The bottom dock is an operational status surface, not a debug bar. It may show global down/up speed, connection state, Torrent count and refresh state with readable semantic typography.

## 16. Canonical components

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
Settings Card
```

Do not create feature-specific copies such as `SettingsButton`, `TorrentSpecialButton`, local Tooltip variants or one-off switches.

## 17. Motion and performance

Prefer transform/opacity. Avoid persistent animated blur, box-shadow animation on many rows, per-row backdrop filters, endless gradients and full-list rebuilds.

> Interaction moves. Information stays stable.

## 18. Loading, empty and error states

Avoid full-page blocking spinners. Use local loading/skeleton states while navigation remains usable. Empty states offer a clear next action. Feature failures must preserve recovery.

## 19. Definition of success

The UI should look premium immediately, stay calm after long use, use consistent language and terminology, remain readable with the Large typography default, make Settings compact instead of sparse, work naturally on touch devices, keep Tracker secrets out of displays, and remain smooth with thousands of Torrents.

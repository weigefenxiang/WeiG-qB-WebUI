# WeiG qB WebUI — Design System

Version: 1.0  
Status: Frozen baseline  
Theme: Nebula Noir  
Compatibility floor: qBittorrent 4.1.9

## 1. Design mission

WeiG qB WebUI should feel like a premium control surface floating in deep space: dark, dimensional, precise, animated with restraint, information-dense on desktop, touch-first on mobile, and still smooth with very large torrent libraries.

Primary references: Linear for hierarchy and theming, Raycast for search/floating interactions, Apple for motion and touch polish, and existing qBittorrent WebUIs only for product functionality—not visual identity.

## 2. Non-negotiable rules

1. Dark mode is the primary design target; Light and System use the same semantic token system.
2. Feature code must not hard-code theme colors, radii, shadows, motion timings or ad-hoc visual primitives.
3. Button, IconButton, Tooltip, Dialog, Input, Menu, Card, Switch, Checkbox, Tabs and other primitives each have one canonical implementation.
4. Every non-home view has a visible Back action; error states keep Retry, Back and Home recovery paths.
5. Animation may enhance interaction but must not destabilize information or cause continuous high GPU/CPU load.
6. Mobile is a first-class layout and interaction target, not a scaled desktop table.
7. Large datasets must not map linearly to DOM node count.
8. Hover-only behavior must always have a touch-accessible equivalent.
9. All UI must respect `prefers-reduced-motion`.
10. Visual polish must never hide torrent status, progress, speed, errors or destructive actions.

## 3. Nebula Noir tokens

```css
:root {
  --bg-void: #05070d;
  --bg-deep: #070b14;
  --bg-base: #0a0f1c;
  --bg-surface: #0e1525;
  --bg-elevated: #131c2f;
  --bg-floating: #18233a;

  --text-primary: #e8edf7;
  --text-secondary: #b8c2d9;
  --text-muted: #7f8aa5;

  --accent-primary: #7297ff;
  --accent-secondary: #816fff;
  --accent-cyan: #38d6ff;

  --success: #39d98a;
  --warning: #ffbd5a;
  --danger: #ff667a;
  --info: #54b8ff;

  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 22px;
  --radius-pill: 999px;

  --motion-fast: 120ms;
  --motion-normal: 180ms;
  --motion-slow: 280ms;
  --ease-standard: cubic-bezier(.2,.8,.2,1);
  --ease-spring: cubic-bezier(.16,1,.3,1);
}
```

Do not use a flat pure-black page. Depth comes from distinct semantic surfaces.

## 4. CSS starfield

The background is CSS-only and offline-safe. No remote images or CDN assets.

Layers:

```text
Void
→ far stars
→ near stars
→ low-opacity blue/violet radial nebula
→ sparse ambient glow
```

Rules:

- far stars: ~1px, dim, mostly static;
- near stars: 1–2px, sparse, extremely slow movement;
- nebula: low-opacity radial gradients with large blur-like falloff;
- background motion cycles should generally be 40–120 seconds;
- no fast twinkle, particle explosions, mouse-driven full-page repaint, or default canvas particle engine;
- Reduced Motion disables non-essential background motion.

## 5. Surface hierarchy and 3D depth

Only these surface classes exist:

```text
Surface
Panel
Card
Raised Card
Floating Panel
Modal
```

Elevation is expressed with a combination of:

- slightly brighter surface tone;
- 1px translucent border;
- subtle top inner highlight;
- soft black outer shadow;
- very weak cool ambient glow.

Key cards may move from `translateY(0)` to roughly `translateY(-2px)` on hover and return to near-flat on active press. Avoid exaggerated perspective or large scale transforms.

Torrent rows stay visually lighter than dashboard cards, dialogs and floating panels.

## 6. Nebula Flow

Nebula Flow is the signature hover effect: a subdued blue → violet → cyan highlight that wakes along the edge of the currently interactive card or control.

Rules:

- nearly invisible at rest;
- appears only for the active hovered/focused element;
- typical duration 1.2–1.8s;
- never run the effect continuously across all torrent rows;
- implement with transform/opacity-friendly pseudo-elements where possible.

## 7. Typography

Use an offline-safe system-first stack, for example:

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
  "PingFang SC", "Microsoft YaHei", sans-serif;
```

Recommended scale:

```text
Page title       22–24px
Section title    16–18px
Body             14px
Torrent table    13–15px
Metadata         12px
Tooltip          12px
```

Speeds, sizes, ratios and timers should use tabular numerals where supported.

## 8. Canonical interaction primitives

### Buttons

Variants: `primary`, `secondary`, `ghost`, `danger`, `icon`.  
Sizes: `small`, `medium`, `large`.

All variants implement consistent default, hover, active, focus-visible, disabled and loading states. Toolbars favor Ghost and Icon buttons so the UI does not become a field of bright rectangles.

### Tooltip

One canonical floating tooltip: dark floating surface, 8px radius, thin border, soft shadow, small translate/fade entrance, roughly 300–400ms hover delay. Icon buttons require a tooltip or equivalent accessible name.

### Dialogs and menus

Dialogs are among the most elevated surfaces and may use restrained glass/blur. Destructive operations clearly distinguish “delete torrent” from “delete torrent and files”. Context menus use compact Raycast-like grouping, icons and clearly separated danger actions.

## 9. Desktop torrent list

Desktop uses an information-dense virtualized data table / floating-row hybrid, not one giant card per torrent.

Recommended row height: 44–52px.

A row should prioritize:

- name;
- status;
- size;
- progress;
- download/upload speed;
- ETA;
- ratio or other user-selected columns.

Hover adds only a very light surface lift. Selection uses a soft accent background plus a narrow accent indicator.

## 10. Mobile torrent list

Mobile does not compress the desktop table. It uses compact touch-first torrent cards, typically around 72–96px when possible.

Default visible information:

```text
Torrent name
Status + progress
Progress bar
Download + upload speed
ETA / ratio or another compact secondary metric
More (…) action
```

Secondary metadata moves into Torrent Detail.

Touch targets must be at least about 44×44px. Desktop right-click actions must have a mobile More menu / action sheet equivalent. Long press may enhance interactions but cannot be the only way to access a command.

## 11. Mobile shell

Desktop and Mobile share stores, domain models, API code and primitives, but may use different navigation/layout composition.

Mobile shell:

```text
Top bar
Main content
Optional bottom action area
Drawer replacing desktop sidebar
```

Torrent Detail keeps a visible top-left Back action. Tabs may scroll horizontally. Landscape and software-keyboard states must be tested.

Primary validation widths include 320, 375, 390, 430 and 768px.

## 12. Large-list visual/performance rules

The visual system assumes a generic LargeList engine.

Torrent API default batch size is 50. Data may be cached across pages, but DOM stays windowed to the viewport plus limited overscan.

Targets:

```text
Desktop torrent DOM: normally ~20–60 visible/overscan rows, preferably <100
Mobile torrent DOM: preferably <=50
```

The same rule applies to large Files, Peers, Trackers, Logs, Search results and RSS lists.

Non-active detail tabs should not retain unnecessarily heavy DOM subtrees.

Stable row/card heights are preferred so virtualization remains predictable.

## 13. Rendering and motion performance

Prefer `transform` and `opacity`. Avoid persistent animated blur, animated box-shadow over many elements, per-row backdrop filters, infinite gradient effects on every torrent, or full-list rebuilds during each refresh.

Only changed visible data should visually update. A speed update must not reconstruct the entire torrent card.

Principle:

> Interaction moves. Information stays stable.

## 14. Progress and state color

Progress uses a dark track and restrained semantic fill:

- downloading: blue/cyan accent;
- seeding/completed: success green;
- paused: muted neutral;
- error: danger red.

Color is supplemental; state text/icons remain present so meaning is never color-only.

## 15. Loading, empty and error states

Avoid full-page blocking spinners. Use local skeletons and row placeholders while keeping navigation usable.

Empty state remains visually calm and offers the primary next action, such as Add Torrent.

Error surfaces must preserve at least Retry and Back, with Home available through the shell. Feature failure must not strand the user in a dead-end screen.

## 16. Theme controls

Initial appearance settings:

```text
Appearance: System / Light / Dark
Dark theme: Nebula Noir
Starfield: Off / Subtle / Full
Motion: System / Reduced / Full
```

Future themes such as OLED Black, Deep Ocean or Midnight Violet must still use the same semantic token/component system.

## 17. Design preview gate

Before integrating a new visual system or major component into qBittorrent data flows, validate it in static previews/mocks.

Planned design surfaces:

```text
design/preview-dark.html
design/preview-light.html
design/components.html
design/desktop.html
design/mobile.html
design/torrent-list.html
design/torrent-detail.html
design/large-list.html
```

`large-list.html` must exercise at least 50, 500, 5,000 and 10,000 mocked torrents while confirming DOM count remains bounded.

## 18. Visual anti-patterns

Do not introduce:

- random one-off button or tooltip styles;
- arbitrary radii, shadow values or transition timings;
- permanent neon/glow everywhere;
- high-saturation rainbow gradients;
- giant cards for every torrent;
- endless simultaneous row animations;
- unreadable glassmorphism;
- hover-only critical actions;
- desktop layouts merely squeezed into a phone;
- decorative effects that degrade large-list scrolling.

## 19. Definition of success

The interface should look premium immediately, remain calm after extended use, keep torrent data precise and readable, work naturally with touch, and remain visually smooth even when the underlying library contains thousands of torrents.

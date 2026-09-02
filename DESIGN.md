# WeiG qB WebUI — Design System

Version: **2.0**  
Status: **v0.3.7 Responsive UI System 3.3**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This file is the single visual and interaction authority. New UI extends these rules; it never creates a second local design system.

WeiG qB WebUI follows the DESIGN.md method promoted by `VoltAgent/awesome-design-md`: document visual atmosphere, semantic color roles, typography, reusable component styling, layout/spacing, depth, Do/Don't guardrails and responsive behavior in one agent-readable authority. We study system thinking, not another product's exact appearance.

## 1. Non-negotiable rules

1. One semantic purpose has one canonical component/controller/layout owner.
2. Feature code does not invent local Button/Select/Card/Chip/Badge/Modal/Popover/Settings-row systems.
3. Settings layout is created correctly at render time; a MutationObserver may be a temporary migration bridge, never the permanent geometry engine.
4. Every ordinary editable Setting is an `inline SettingRow`: copy left, control right.
5. Desktop SettingsGrid defaults to two columns. A field name such as `path`, `url`, `host`, `username` or `password` is never sufficient reason to span both columns.
6. Full-width Settings content is explicit schema semantics, not a heuristic. It is reserved for multiline/composite editors, lists, tables or similarly wide content.
7. An odd final ordinary SettingRow stays in the left grid cell; it is not stretched or centered across the panel.
8. Capability detection, not qB major version, decides backend compatibility.
9. Presentation refactors do not duplicate `QBClient`, `setPreferences()`, preference keys, unit conversion or save behavior.
10. Mobile is adaptive presentation, not a second business application.
11. Data count is not DOM count; large collections remain virtualized.
12. Polling never destroys page, scroll, selection, detail-return or display-timezone state.
13. Display timezone is browser presentation state, never qB/server time.
14. HTML is a no-store bootstrap; CSS/JS cache identity is the deployment Git SHA.
15. Reduced Motion is mandatory.
16. README is the user manual; architecture/test/release detail belongs in `docs/` and this authority.

## 2. Visual atmosphere

```text
Void      deep-space page background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      compact information/stat surface
Raised    toolbar / active input / detail summary
Floating  select / menu / popover / dialog
```

The interface is dark, precise and dense. Blue/cyan communicates ordinary WeiG interaction; purple is reserved for alternative-rate semantics and selected brand accents. Depth comes from restrained border contrast, surface luminance and small elevation, not permanent neon glow.

Typography hierarchy remains:

```text
Page title > Section title > Setting title > value/control > description/helper
```

Setting title and description are always left aligned. Ordinary Settings content never uses centered copy.

## 3. Canonical primitives and owners

```text
Button / IconButton
Input / Search
Select / Listbox
Switch / CheckControl
FilterChip
Tooltip / SettingHelp
Dialog / AdaptiveDialog
Drawer / ActionSheet / ContextDrawer
Menu / Popover
Badge / StatusPill
Card / Panel
Tabs
DataGrid / Pagination / VirtualList
FloatingLayer
PreferenceSchemaV037
ControlRegistry
SettingsPageShell
SettingsViewportLayout
SettingsSectionPanel
SettingsGrid
SettingRow
SettingControlSlot
SettingBlock
FactRow
HeaderUtilityBar
HeaderUtilityAction
BrandMark / BrandCluster / BrandIdentity / AmbientMark
Navigation.goHome
SelectionModelV037 / BulkActionDispatcher
TorrentActionController
DataGridLayoutController
ResponsiveShell 3.0
```

Feature CSS may own feature-specific layout and semantic states. It may not redefine canonical control colors, radii, focus rings, hover/active behavior or create a second Settings geometry system.

## 4. SETTINGS-STRUCTURE-002 — one SettingRow DOM shape

Every ordinary editable preference renders this semantic structure directly:

```text
SettingRow
├─ SettingCopy
│  ├─ SettingTitleLine
│  │  ├─ Title
│  │  └─ optional SettingHelp
│  └─ Description
└─ SettingControlSlot
   └─ canonical control
```

Conceptual DOM:

```html
<label class="setting-row" data-setting-key="...">
  <span class="setting-row__copy">...</span>
  <span class="setting-row__control">...</span>
</label>
```

Legacy flat rows such as `strong + small + control` are migration input only. They must be adapted once into the canonical structure; CSS must not maintain a second geometry branch for them.

## 5. SETTINGS-GRID-002 — two columns by default

All editable Settings tabs share:

```text
SettingsPageShell
└─ SettingsViewportLayout
   ├─ SettingsSidebar
   └─ SettingsContentViewport       <- only Settings scroll owner
      └─ SettingsSectionPanel
         ├─ SectionHeader
         └─ SettingsGrid
            ├─ SettingRow
            ├─ SettingRow
            └─ ...
```

Applies to:

```text
WeiG WebUI
Downloads
Connection
Speed
BitTorrent
Web UI
Advanced
```

Geometry:

```text
content max width          1240px
viewport > 1180px          2 SettingsGrid columns
viewport <= 1180px         1 SettingsGrid column
ordinary row min-height    about 64px desktop
row internal layout        minmax(0,1fr) auto
copy                       left aligned
control slot               right aligned
```

Wide desktop example:

```text
Auto Torrent management              [switch] | Create subfolder                    [switch]
Preallocate disk space               [switch] | Default save path            [/downloads/]
Auto relocate on path change         [switch] | Pause added torrents                 [switch]
Incomplete Torrent path   [/downloads/incomplete] | Use incomplete path             [switch]
```

The same geometry applies to Connection, Speed, BitTorrent, Web UI and Advanced. A setting does not become centered merely because its control is a Switch or because it was produced by a legacy helper.

## 6. SETTINGS-ALIGN-002 — one alignment contract

Inside every ordinary SettingRow:

```text
left edge                                  right edge
Title / description                 [control/value]
```

Hard rules:

- title and description share one left axis;
- control/value shares the row cell right axis;
- Switch, number, port, Select and text input do not each invent a different alignment strategy;
- description wraps only inside the copy column;
- no `justify-content:center`, centered title or centered Switch in ordinary SettingRow;
- controls use semantic width tiers rather than one forced width.

Recommended semantic control sizing:

```text
switch             intrinsic
short number/port  compact
select             content-fit with reasonable cap
standard text      medium
path/url text      medium/wide but still one grid cell by default
```

## 7. SETTINGS-SPAN-002 — explicit full width only

Default:

```text
span = 1
```

Allowed explicit full width:

```text
multiline textarea
tracker/source list editor
large rule editor
certificate/key text area
multi-control composite editor
embedded table/list/data surface
```

Forbidden heuristic:

```text
key contains path/url/domain/address/host/username/password
→ full width
```

Those fields remain ordinary two-column cells unless the schema explicitly declares a genuinely wide editor.

`PreferenceSchema` owns `span` / `layout` semantics. Page CSS and string matching do not.

## 8. SETTINGS-OWNER-002 — remove competing FormRail geometry

The historical centered 820px FormRail is not a current Settings layout authority. Once a tab is migrated to SettingsGrid, legacy FormRail variables/selectors may not affect its rows.

There must be exactly one geometry path:

```text
SettingsGrid
→ SettingRow
→ SettingCopy + SettingControlSlot
```

Two simultaneous `!important` layout systems are forbidden.

## 9. CONTROL-REGISTRY-002

`ControlRegistry` maps verified semantics to shared controls:

```text
boolean     -> Switch
number      -> NumberInput
port        -> PortInput
text        -> TextInput
path        -> TextInput with path semantics
select/enum -> canonical Select/Listbox
rate        -> RateControl
duration    -> DurationControl
timezone    -> canonical TimeZone Select
readonly    -> Fact/readonly control as appropriate
```

A verified enum should not remain an unexplained numeric code when a canonical Select can represent the official choices. Business/API ownership remains outside the registry.

## 10. HEADER-UTILITY-001 — one icon-action template

Desktop/tablet topbar actions become:

```text
[+ Add Torrent] [GitHub] [Blog] [Refresh] [Theme]
```

GitHub:

```text
https://github.com/weigefenxiang/WeiG-qB-WebUI
```

Blog:

```text
https://www.weigshare.com/
```

GitHub, Blog, Refresh and Theme all consume the same `HeaderUtilityAction` / existing `icon-btn` visual template:

```text
same hit area
same radius
same border/surface
same hover
same focus-visible ring
same active feedback
same Tooltip behavior
```

Do not create `.github-btn` or `.blog-btn` visual systems.

External actions render as semantic anchors with `target="_blank"` and `rel="noopener noreferrer"`; runtime actions render as buttons. Both use the same presentation component. Icon-only controls require accessible labels/tooltips.

On narrow phones, GitHub/Blog may move into ContextDrawer `Links` rather than compressing the topbar. Their semantic action remains the same owner.

## 11. BRAND-001 — one reusable Brand system

```text
BrandCluster
├─ BrandMarkHome
│  └─ BrandMark + AmbientMark
└─ BrandNameHome
   └─ WeiG qB
```

Header mark and name are separate Home targets and share `Navigation.goHome()`. About uses the same BrandMark asset and `AmbientMark` controller through `BrandIdentity`, only with a larger identity-size profile.

No duplicate SVG/logo animation implementation is allowed.

## 12. FLOATING / SELECT / DIALOG

Visible Select uses `W.Components.selectControl()`. Native select may remain only as a compatibility/data bridge.

Floating surfaces use body-level `FloatingLayer` and follow below → flip above → shift → cap height → internal scroll collision policy.

Dialogs use Header / Body / Actions. Only Body scrolls when necessary.

## 13. Responsive and mobile

Mobile remains one application with adaptive presentation. Every active long page has one primary scroll owner. `settings-content` owns Settings scrolling; mobile Settings category navigation belongs in ContextDrawer.

SettingsGrid is one column on narrow layouts. The SettingRow internal contract remains copy left / control right unless the available width requires an explicitly defined compact stacking rule. No page-specific mobile Settings implementation is allowed.

## 14. Status / Transfer / data systems

Desktop StatusDock keeps:

```text
left          center runtime cluster                      right
Torrent N     Storage | TransferCapsule | Connection      reserved/status
```

Transfer download/upload is one capsule opening one shared TransferRateEditor. Alternative mode retints the complete editor.

Torrent/Logs large collections remain virtualized. Selection is model state. DataGrid pointermove updates layout only and does not rebuild VirtualList.

## 15. Systemic anti-patterns discovered in v0.3.7

These are now explicit regression risks:

1. **Dual row structures** — canonical `copy + control` rows mixed with flat legacy rows produce different alignment.
2. **Dual layout owners** — old FormRail CSS and new SettingsGrid CSS both using high specificity/`!important` create non-deterministic geometry.
3. **Name-based full-span guessing** — fields containing `host/path/url/user/password` unexpectedly become one-column rows.
4. **Post-render DOM repair as architecture** — observer-driven moving/wrapping can race later injections and hide source ownership problems.
5. **Tests that validate only column count** — a page may technically have two columns while labels are centered or full-span is overused.
6. **Feature-local header actions** — adding one-off GitHub/Blog styles would duplicate the existing IconButton system.

Fix the owner, schema or primitive; do not add another CSS exception for the screenshot.

## 16. Validation contract

Focused `[ui]` regression must validate both qB 4.1.9.1 and 5.2.0 in one Linux Chromium job and cover every Settings tab.

Required geometry assertions on wide desktop:

```text
SettingsGrid reports two columns
ordinary rows default span=1
odd final ordinary row does not stretch full width
SettingCopy left edge is aligned to the cell content edge
SettingControlSlot right edge is aligned to the cell content edge
no ordinary title is center-aligned
no forbidden key-name heuristic produces full-span
Downloads / Connection / Speed / BitTorrent / Web UI / Advanced share the same owners
Advanced reaches the final row
```

Header assertions:

```text
GitHub and Blog use the same icon-action geometry as Refresh/Theme
external links have correct href/target/rel/accessible label
Header Brand mark/name remain separate Home targets
```

Normal dev validation stays cheap. Full qB stable-tag audit, Linux/Windows browser matrices and multi-viewport Release validation run only from `main` manual Release candidate preparation.

Real exact-SHA validation on qB 4.1.9.1 and 5.2.x remains required before promotion. Fixture PASS never implies LIVE certification.

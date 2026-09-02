# WeiG qB WebUI — Design System

Version: **2.0**  
Status: **v0.3.7 Responsive UI System 3.3**  
Target revision: **Clean Settings + Verified Session 3.4**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This file is the single visual and interaction authority. New UI extends these rules; it never creates a second local design system.

WeiG qB WebUI follows the DESIGN.md method promoted by `VoltAgent/awesome-design-md`: Visual Theme & Atmosphere, semantic Color Palette & Roles, Typography Rules, Component Styling, Layout Principles, Depth & Elevation, Do/Don't guardrails, Responsive Behavior and an agent-executable implementation contract. The method is reused; another product's exact appearance is not copied.

## 1. Non-negotiable rules

1. One semantic purpose has one canonical component/controller/layout owner.
2. Feature code does not invent local Button/Select/Card/Chip/Badge/Modal/Popover/Settings-row systems.
3. **Active first-party runtime assets use stable semantic filenames, never release/version suffixes.** Product/cache identity lives in `VERSION`, exact Git SHA, tags and Releases, not filenames.
4. Git history is the archive. After functionality is migrated, old `*-vNNN.*` / `vNNN.*` first-party runtime files are deleted; no alias, shim, duplicate loader entry or compatibility copy remains.
5. **Settings has no legacy presentation compatibility layer after the 3.4 migration.** Source renderers emit the final canonical DOM directly.
6. Every ordinary editable Setting is one `SettingRow`: copy left, control right.
7. Setting title and description are always horizontally left aligned. Vertical centering is allowed; horizontal centering is not.
8. Desktop SettingsGrid defaults to two columns. Ordinary rows default to `span=1`.
9. Full-width Settings content is explicit schema semantics only; key names such as `path`, `url`, `host`, `username`, `password` never decide layout.
10. An odd final ordinary SettingRow stays in the left grid cell.
11. Settings layout must not depend on CSS load order, specificity battles, `!important` overrides, MutationObserver repair or delayed `setTimeout` repair.
12. qB WebAPI compatibility remains in `QBClient`; removing legacy presentation code does **not** remove qBittorrent 4.1.9.1 support.
13. Authentication actions use one `SessionController`; UI controls never own raw auth requests.
14. Logout is successful only after server-side invalidation is verified.
15. Browser Back/BFCache must never reveal a previously authenticated private shell after logout.
16. If qB authentication bypass creates a new session automatically, the UI reports that durable logout is impossible under the current server policy; it never fakes success.
17. Mobile is adaptive presentation, not a second business application.
18. Data count is not DOM count; large collections remain virtualized.
19. Display timezone is browser presentation state, never qB/server time.
20. Reduced Motion is mandatory.
21. README is the user manual; architecture/test/release detail belongs in `docs/` and this authority.

## 2. Visual Theme & Atmosphere

```text
Void      deep-space page background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      compact information/stat surface
Raised    toolbar / active input / detail summary
Floating  select / menu / popover / dialog
```

The interface is dark, precise and dense. Blue/cyan communicates ordinary interaction; purple is reserved for alternative-rate semantics and selected brand accents. Depth comes from restrained border contrast, surface luminance and small elevation, not permanent neon glow.

## 3. Color Palette & Roles

Color is semantic, never feature-local:

```text
--surface-void       page canvas
--surface-base       workspace
--surface-panel      Settings/DataGrid/sidebar
--surface-raised     active controls / toolbar
--surface-floating   menu/dialog/popover
--text-primary       titles and primary values
--text-secondary     normal copy
--text-muted         descriptions / metadata
--border             ordinary separators
--accent-blue        primary WeiG interaction
--accent-cyan        live/positive interactive detail
--accent-purple      alternative-rate mode only
--success / warning / danger  semantic state only
```

A Settings page does not introduce its own palette. Header utilities, Settings controls and About reuse global semantic roles.

## 4. Typography Rules

```text
Page title > Section title > Setting title > control/value > description/helper > metadata
```

Hard alignment rule:

```text
Section heading left axis
        ↓
SettingCopy left axis
Title
Description
```

No ordinary Settings title or description may use `text-align:center`, `justify-self:center`, `align-items:center` as a horizontal placement strategy, or a centered fixed-width rail.

Recommended role tokens:

```text
page title           existing heading token
section title        existing section heading token
setting title        body/label strong, 650–750 weight
description          muted body-small/description token
control/value        body token, tabular numerics where useful
code/path/SHA        mono token
```

## 5. Spacing, Radius and Depth

Reuse existing global token scales before adding values. Settings 3.4 geometry target:

```text
content max width             1240px
section horizontal inset      16px desktop / 12px compact
row min height                about 64px desktop
row vertical inset            about 10–12px
outer grid columns            2 wide / 1 narrow
column gap                    0 or one semantic divider
row inner gap                 16px
section radius                existing panel radius
control height                canonical control height
```

Section header and SettingCopy share the same left inset. SettingControlSlot shares the same right inset.

## 6. Canonical primitives and owners

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
PreferenceSchema
ControlRegistry
SettingsPageShell
SettingsViewportLayout
SettingsSectionPanel
SettingsGrid
SettingRow
SettingCopy
SettingControlSlot
SettingBlock
FactRow
AboutPanel
HeaderUtilityBar
HeaderUtilityAction
SessionController
SessionGate
BrandMark / BrandCluster / BrandIdentity / AmbientMark
Navigation.goHome
SelectionModel / BulkActionDispatcher
TorrentActionController
DataGridLayoutController
ResponsiveShell
```

Owner names are semantic, not release-labelled. A new release does not create `PreferenceSchemaV038`, `SettingsGridV038`, `SelectionModelV038` or equivalent parallel owners.

## 7. ASSET-NAMING-001 — stable semantic runtime filenames

Current first-party runtime code must be discoverable by responsibility, not by the release that introduced it.

Canonical target examples:

```text
webui/private/css/app.css
webui/private/css/ui.css
webui/private/css/layout.css
webui/private/css/settings.css
webui/private/css/brand.css
webui/private/css/logs.css

webui/private/scripts/core.js
webui/private/scripts/components.js
webui/private/scripts/i18n.js
webui/private/scripts/ui.js
webui/private/scripts/layout.js
webui/private/scripts/settings.js
webui/private/scripts/brand.js
webui/private/scripts/header.js
webui/private/scripts/session.js
webui/private/scripts/logs.js
webui/private/scripts/app.js
webui/private/scripts/bootstrap.js
```

The exact semantic split follows ownership, but these rules are absolute:

```text
no first-party runtime filename ending -vNNN.css / -vNNN.js
no generic vNNN.css / vNNN.js runtime layers
no old-name alias or import-only shim after migration
no loading both old and new files to preserve presentation compatibility
no version number as CSS/JS ownership
```

Do **not** replace `settings-brand-v037.css` with a permanent mixed `settings-brand.css`. The mixed owner itself is the problem. Settings presentation belongs in `settings.css`; Brand presentation belongs in `brand.css`; Header/Session behavior belongs to their semantic JS owners.

Cache identity remains:

```text
stable semantic filename + exact deployment Git SHA
```

`VERSION` is product version. Git SHA is code/cache identity. Tag/Release is distribution identity. Git history stores previous implementations.

## 8. SETTINGS-STRUCTURE-002 — one final DOM shape

Every ordinary editable preference renders directly as:

```text
SettingsSectionPanel
└─ SettingsGrid
   └─ SettingRow
      ├─ SettingCopy
      │  ├─ SettingTitleLine
      │  │  ├─ Title
      │  │  └─ optional SettingHelp
      │  └─ Description
      └─ SettingControlSlot
         └─ canonical control
```

Target conceptual DOM:

```html
<section class="settings-section" data-settings-owner="downloads">
  <header class="settings-section__header">...</header>
  <div class="settings-grid">
    <label class="setting-row" data-setting-key="save_path" data-setting-span="1">
      <span class="setting-copy">...</span>
      <span class="setting-control-slot">...</span>
    </label>
  </div>
</section>
```

The following are migration-only names and disappear from Settings presentation when 3.4 lands:

```text
.settings-control
.settings-row--canonical
.setting-row-grid
.settings-section--rows
.settings-grid-canonical
SETTINGS-FORM-RAIL-*
```

No adapter keeps these shapes alive for Settings.

## 9. SETTINGS-GRID-002 — deterministic outer grid

Applies identically to:

```text
WeiG WebUI
Downloads
Connection
Speed
BitTorrent
Web UI
Advanced
```

Wide desktop:

```text
┌──────────────────────────────┬──────────────────────────────┐
│ Title                  [ctl] │ Title                  [ctl] │
│ Description                  │ Description                  │
├──────────────────────────────┼──────────────────────────────┤
│ Title                  [ctl] │ Title                  [ctl] │
│ Description                  │ Description                  │
└──────────────────────────────┴──────────────────────────────┘
```

The left edge of every Title/Description is the cell inset, not a centered inner rail. The right edge of every control is the cell right inset.

## 10. SETTINGS-ALIGN-002 — one horizontal alignment contract

Inside every ordinary SettingRow:

```text
left edge                                  right edge
Title / description                 [control/value]
```

Implementation contract:

```text
SettingRow             grid-template-columns: minmax(0,1fr) auto
SettingCopy            justify-self:start; width:100%; text-align:left
SettingCopy contents   text-align:left; justify-self:start
SettingControlSlot     justify-self:end; align-items:center
```

Forbidden in ordinary Settings geometry:

```text
justify-content:center
justify-self:center
text-align:center
fixed 820px FormRail
per-tab alignment overrides
control-specific placement hacks
```

## 11. SETTINGS-SPAN-002 — explicit full width only

Default:

```text
span = 1
```

Allowed explicit `span=full`:

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

`PreferenceSchema` owns `span/layout`; CSS and string matching do not.

## 12. SETTINGS-CLEAN-CUT-003 — delete the old Settings system

After direct source rendering is implemented, these behaviors are removed rather than retained as compatibility:

```text
patchFactories() wrapping old factories
normalizeSettings()/normalizeSection() as primary renderer
consolidateWeiGGrid()
Settings MutationObserver moving rows after render
language card MutationObserver injection
timezone card MutationObserver injection
native-select upgrade as a requirement for Settings controls
CSS-order observers whose purpose is to beat old Settings CSS
legacy Settings timeout repair
version-layer loaders whose purpose is to stack new Settings CSS above old Settings CSS
```

Language and timezone become ordinary WeiG Settings schema items rendered in the same first pass as Theme, Font size, Density, Starfield, Motion, Page size and Refresh interval.

## 13. CONTROL-REGISTRY-002

```text
boolean       -> Switch
number        -> NumberInput
port          -> PortInput
select/enum   -> Select/Listbox
text          -> TextInput
path/url      -> TextInput semantic variant
rate          -> RateControl
duration      -> DurationControl
timezone      -> TimeZoneControl
readonly      -> Fact/readonly semantics
```

A verified enum should never remain an unexplained numeric code when qB semantics are known. Business/API ownership remains outside ControlRegistry.

## 14. HEADER-UTILITY-001

Desktop/tablet order:

```text
[+ Add Torrent] [GitHub] [Blog] [Refresh] [Theme] [Logout]
```

GitHub / Blog / Refresh / Theme / Logout use one `HeaderUtilityAction` presentation owner. External links are anchors; runtime actions are buttons; geometry, hover, focus-visible, active feedback, tooltip and accessible label are shared. Logout remains the rightmost desktop utility.

On narrow phones, GitHub / Blog / Logout move into ContextDrawer `Links`; the action registry is unchanged.

## 15. AUTH-SESSION-002 — verified logout, not navigation theater

Canonical flow:

```text
HeaderUtilityAction(Logout)
        ↓
SessionController.logout()
        ↓
QBClient.logout()
        ↓
POST api/v2/auth/logout
        ↓
QBClient.probeSession()
        ↓
403 / unauthenticated ?
   yes → commit logout
   no  → auth bypass / unexpected session still active
```

A successful HTTP response from `auth/logout` alone is **not** the acceptance criterion.

### 15.1 Logout commit

Only after invalidation is verified:

```text
stop polling / prevent new authenticated work
clear volatile in-memory private data
set sessionStorage logout guard
lock/hide private shell before navigation
location.replace(root public entry)
```

Display preferences such as theme/language/timezone may remain; torrent/settings/session data does not.

### 15.2 Back/BFCache protection

`SessionGate` owns private-shell re-entry:

```text
pageshow persisted OR logout guard present
→ do not reveal stale private content
→ reload/probe through server
→ unauthenticated server returns public login entry
```

Login success clears the logout guard.

### 15.3 Authentication bypass

Upstream qB automatically starts a new session when authentication is not required for the current client (localhost bypass or subnet whitelist). In that state a durable logout is impossible from frontend JavaScript alone.

Therefore:

```text
logout POST succeeds
protected probe still succeeds
→ do not show “logged out”
→ show blocking explanation that qB authentication bypass is active
→ require server Web UI auth policy to be changed for a durable logout
```

This is a server-policy state, not a frontend redirect problem.

## 16. BRAND-001 and ABOUT-001

Header Brand mark and `WeiG qB` remain separate Home targets using `Navigation.goHome()`. About reuses the same BrandMark and AmbientMark through `BrandIdentity`; it uses `FactRow`, never editable SettingRow. No duplicate SVG/logo animation implementation is allowed.

## 17. Responsive Behavior

```text
> 1180px    two SettingsGrid columns
821–1180px  one SettingsGrid column
<= 820px    one column + compact spacing; copy remains left, control remains right when it fits
```

Mobile does not get a separate Settings business renderer. If an individual semantic editor genuinely needs stacking, that is declared by the component/schema, not by page-specific CSS.

## 18. Do / Don't guardrails

Do:

```text
name runtime files by semantic responsibility
render final DOM at source
use one schema and one row factory
use one Settings CSS geometry owner
keep section header/copy/control axes measurable
verify logout server state
verify Back/BFCache behavior
fix owner/schema/primitive first
```

Don't:

```text
create v038.css because v037.css already exists
keep old versioned runtime files “just in case”
keep old Settings DOM “just in case”
patch screenshot symptoms with another selector
center copy in an inner rail
use MutationObserver as Settings renderer
let old and new !important rules compete
call navigation-to-login “logout” without server verification
claim success while qB auth bypass immediately recreates a session
```

## 19. Systemic failure modes discovered in v0.3.7

```text
1. Same semantic Setting emitted in multiple DOM shapes.
2. Old FormRail and new SettingsGrid both remain layout owners.
3. Three CSS generations can target the same row with !important.
4. Version-labelled runtime files encourage layering a new implementation instead of replacing the old owner.
5. Source renderers output legacy DOM and later observers repair it.
6. Language and timezone are injected by historical observers instead of the Settings schema.
7. Tests can pass because they see two outer columns while inner copy is still centered.
8. A migration bridge becomes permanent architecture.
9. A mixed settings-brand module owns unrelated Settings/Brand/Header/Session responsibilities.
10. Logout success was defined as “request resolved + redirect”, not “server session is gone”.
11. Browser history/BFCache was not part of the logout acceptance contract.
12. qB auth-bypass behavior was not distinguished from a valid logged-out state.
```

## 20. Validation contract

Focused `[ui]` regression on dev covers qB 4.1.9.1 + 5.2.0 in one Linux Chromium job.

Static asset assertions after 3.4 migration:

```text
no active first-party runtime *-vNNN.css / *-vNNN.js
no active first-party runtime vNNN.css / vNNN.js
no loader references old versioned assets
no duplicate old/new semantic asset pair
cache identity remains exact Git SHA
```

Settings assertions:

```text
all seven Settings tabs use the same source-rendered owners
no legacy Settings class names exist in rendered editable rows
no Settings MutationObserver is required for geometry
wide two-column / narrow one-column
ordinary span=1
copy absolute left-axis alignment within tolerance
control absolute right-axis alignment within tolerance
no ordinary title/description computed text-align=center
no forbidden key-name span heuristic
Advanced final row reachable
```

Session assertions:

```text
logout endpoint called through QBClient/SessionController
fixture session becomes invalid after logout
protected probe returns unauthenticated
private shell is locked before redirect
Back/BFCache cannot restore private UI
login clears logout guard
auth-bypass fixture is reported as non-durable logout, never false success
```

Normal dev validation stays cheap. Full qB stable-tag audit, Linux/Windows browser matrices and multi-viewport Release validation run only from `main` manual Release candidate preparation. Real exact-SHA qB 4.1.9.1 + 5.2.x LIVE remains required before promotion.

## 21. Agent implementation guide

When changing runtime UI or auth, use this order:

```text
DESIGN contract
→ canonical owner
→ stable semantic filename
→ schema/state boundary
→ source renderer/component
→ migrate unique behavior
→ delete obsolete/versioned owner and file
→ CSS/layout
→ focused regression
→ exact-SHA LIVE
```

Never begin with a new screenshot-specific CSS rule, a new version-suffixed runtime layer, or an old-name compatibility shim.
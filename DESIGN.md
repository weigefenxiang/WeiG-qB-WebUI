# WeiG qB WebUI — Design System

Version: **1.9**  
Status: **v0.3.7 unified interaction + Settings mother template + ResponsiveShell 3.0**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This file is the single visual and interaction authority. New UI extends these rules; it does not create a second local design system.

The project may study system-thinking references such as `VoltAgent/awesome-design-md`: tokens, reusable components, explicit interaction states, responsive contracts and restrained hierarchy. References are principles, not screenshots to copy.

## 1. Non-negotiable rules

1. One semantic purpose has one canonical component or controller.
2. Feature code does not invent local Button/Select/Card/Chip/Badge/Modal/Popover/Settings layout systems.
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
15. README is the concise user entry; engineering detail belongs in `docs/` and this design authority.
16. Presentation owners may normalize DOM/layout, but must not duplicate qB WebAPI save/business logic.

English is canonical source copy. The runtime may bundle verified/fallback UI dictionaries for `zh-CN`, `zh-TW`, `ja` and `ko`; the project README is maintained in English and Simplified Chinese.

## 2. Spatial hierarchy and canonical owners

```text
Void      page/deep-space background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      stats / information cards
Raised    search / toolbar / active input / detail summary
Floating  listbox / menu / popover / dialog
```

Canonical primitives/controllers include:

```text
Button / IconButton
Input / Search
Select / Listbox
Switch / CheckControl
FilterChip
Tooltip / SettingHelp
Dialog / AdaptiveDialog
Drawer / Action Sheet / ContextDrawer
Menu / Popover
Badge / StatusPill
Card / Panel
Tabs
DataGrid / Pagination / VirtualList
PreferenceSchemaV037
SettingsPageShell / SettingsViewportLayout
SettingsSectionPanel / SettingsGrid / SettingRow / FactRow
ControlRegistry
BrandMark / BrandCluster / BrandIdentity / AmbientMark
Navigation.goHome
FloatingLayer
SelectionModelV037 / BulkActionDispatcher
TorrentActionController
DataGridLayoutController
ResponsiveShell 3.0
AboutPanel
```

### PRIMITIVE-001 — no feature-local clone

Feature CSS may own layout, column geometry and feature-specific semantic states. It may not redefine canonical colors, radii, shadows, focus rings or interaction state for an existing primitive.

Required control states: Default, Hover, Focus-visible, Active/Selected and Disabled.

## 3. FLOATING-001 — one FloatingLayer system

Any surface that visually floats above normal content uses the canonical body-level portal:

```text
Trigger
  ↓ getBoundingClientRect()
#weigg-floating-layer
  ↓ position: fixed
Select / Dropdown / Menu / Popover / Tooltip / SettingHelp / Timezone picker
```

Collision policy is below → flip above → horizontal shift → viewport height cap → internal scroll. A floating surface must not depend on an ancestor `z-index` to escape clipping.

## 4. SELECT-001 — canonical Select/Listbox

Visible Select UI uses `W.Components.selectControl()`. Native `<select>` may remain only as an invisible compatibility/data bridge.

Keyboard/ARIA contract includes Arrow Up/Down, Home/End, Enter/Space, Escape, `aria-haspopup=listbox`, `role=listbox/option` and `aria-selected`.

Short values remain content-fit. A select does not become 180–330px wide merely because another field in the same row is long.

## 5. BRAND-001 / BRAND-002 — one reusable brand system

Brand visual, motion, text and navigation are separate owners:

```text
BrandCluster
├─ BrandMarkHome
│  └─ BrandMark
│     └─ AmbientMark
└─ BrandNameHome
   └─ WeiG qB
```

Header icon and `WeiG qB` are distinct click targets; both call the canonical `Navigation.goHome()` path. They are not wrapped in one inseparable link.

`AmbientMark` remains the single motion controller for header and About. It owns hover/click/idle effects such as orbit, spark, tilt, shine, flip, spin and breathe. It must not run a permanent RAF loop, pauses while the document is hidden, and disables nonessential motion under Reduced Motion.

About uses the same mark asset and controller through `BrandIdentity`; it may use a larger identity-size token and an identity motion profile, but it must not draw or animate a second logo implementation.

## 6. TIME-001 / TIME-002 — global Display Time Zone

Visible date/time is rendered through `W.Time` / `Intl.DateTimeFormat`:

```text
qB timestamp
→ normalized epoch
→ chosen IANA timezone
→ localized visible text
```

The sole configuration entry is `Settings → WeiG WebUI → Display Time Zone`. Logs and other pages consume the same state. Changing timezone changes visible text only; it never calls qB `setPreferences()` or changes daemon/host time.

## 7. SHELL-001 / SCROLL-001 — ResponsiveShell 3.0

Desktop retains Topbar + Sidebar + Workspace + StatusDock. Phones use one dynamic three-track shell:

```text
Topbar             auto
Workspace          minmax(0, 1fr)
Bottom navigation  auto + safe area
```

Phone layout uses `100dvh` where available with `100svh` fallback. Every active mobile route has one primary vertical scroll owner; feature pages must not reintroduce competing document/page/list scroll owners.

Representative mobile geometry includes 320×568, 360×800, 390×844 and 430×932 plus representative desktop widths.

## 8. MOBILE-NAV-001 / CONTEXT-DRAWER-001

Bottom navigation is one horizontal icon+label line. Labels do not wrap and safe-area inset is respected.

On phones, Settings categories move out of the Settings workspace into the hamburger `ContextDrawer`, after Torrent filters. Desktop keeps the category rail. `settings-content` remains the Settings primary scroll owner.

## 9. SETTINGS-001 / SETTINGS-GRID-001 — Settings mother template

All editable Settings tabs share one presentation hierarchy:

```text
SettingsPageShell
└─ SettingsViewportLayout
   ├─ SettingsSidebar
   └─ SettingsContentViewport      <- only Settings scroll owner
      └─ SettingsSectionPanel
         ├─ SectionHeader
         └─ SettingsGrid
            ├─ SettingRow
            └─ SettingRow
```

`WeiG WebUI`, `Downloads`, `Connection`, `Speed`, `BitTorrent`, `Web UI` and `Advanced` consume this same shell/panel/grid geometry. Pages may provide different schema/data, not different layout systems.

Current geometry contract:

```text
settings content max width  1240px
wide viewport              two SettingsGrid columns
viewport <= 1180px         one SettingsGrid column
row minimum height         64px desktop / compact on mobile
row structure              minmax(0,1fr) + auto control
copy                       left aligned
control/value              aligned to the row cell right edge
```

Ordinary rows use one grid cell. Semantically long fields such as path, URL, address, tracker, directory, username/password or wide textarea may use `data-setting-span="full"` and span both columns. Full-span is semantic, not a page-specific exception.

The presentation layer must recognize canonical setting rows directly and must not depend on an unrelated observer first adding a special class. It also must not use repeating timeout-based DOM repair as a normal ownership mechanism.

### 9.1 Settings data/business boundary

```text
              Settings UI System
                     │
        ┌────────────┴────────────┐
        │                         │
WeiG preference state      qB preference state
        │                         │
WeiG adapter/model              QBClient
                                  │
                            qB WebAPI
```

`ControlRegistry` maps semantic field types to canonical Select/Switch/Input/read-only controls. qB Preferences continue to use existing `QBClient`, preference draft and save paths. The Settings mother template is presentation-only and must not create a second `QBClient` or duplicate `setPreferences()` ownership.

## 10. ABOUT-001 / ABOUT-002 — shared shell, read-only semantics

About reuses `SettingsSectionPanel` and responsive grid spacing, but metadata is not an editable preference. Use `FactRow`, not `SettingRow`.

Canonical composition:

```text
AboutPanel / SettingsSectionPanel
├─ BrandIdentity
│  ├─ animated BrandMark
│  └─ WeiG qB WebUI
└─ Facts grid
   ├─ Version
   ├─ Git SHA
   ├─ qBittorrent
   ├─ WebAPI
   ├─ GitHub
   ├─ Blog
   └─ GNU GPL-3.0
```

Desktop uses compact two-column facts; mobile uses one column. Fact label and value/action stay on the same visual row. About must not contain Language, Theme or another editable preference control.

Public project/brand links are metadata. Deployment-specific host paths, instance URLs, credentials and container names must never be hardcoded into the open-source tree.

## 11. STATUS-DOCK-001 / STATUS-DOCK-002

Desktop StatusDock responsibilities:

```text
left          center runtime cluster                      right
Torrent N     Storage | TransferCapsule | Connection      reserved/status
```

The runtime cluster is visually centered. Refresh-success noise (`Refreshed` / `已刷新`) is silent; one-time meaningful status or failures may use the reserved status area.

Storage uses `sync/maindata → server_state.free_space_on_disk`, meaning free space on the filesystem containing qBittorrent's default save path. Format uses readable IEC units.

## 12. TRANSFER-001 / RATE-INPUT-001

Download/upload status is one `TransferCapsule`. One click opens one shared `TransferRateEditor` for normal and alternative limits.

Desktop editor target width is 720px with viewport cap; mobile uses remaining width. Rate fields reuse one value/unit/scrubber system. ALT mode retints the complete editor rather than a tiny label only.

## 13. SETTING-UNIT-001 / PREFERENCE-SCHEMA-001

`PreferenceSchemaV037` is the canonical semantic owner for ordinary qB Preferences; verified Advanced metadata follows the same rule. Units and conversions are applied only after qB source/API semantics are verified.

Examples include global/alternative rate limits, ports, ban duration, slow-torrent thresholds, socket buffers, torrent file size, disk queue size, memory limits, hostname cache TTL and resume-data interval. Special values such as `0` or `-1` display only the meaning verified for that exact field.

## 14. I18N-SETTING-001 / SETTING-HELP-001

Advanced translation data lives outside business logic with upstream provenance. Verified qB translations are distinct from WeiG explanations. `SettingHelp` uses the canonical FloatingLayer and remains short/operational.

## 15. SELECTION-001 / BULK-001

`SelectionModelV037` owns conceptual Torrent selection, not mounted DOM rows. It supports current-page and all-matching selection/inversion and bounded bulk dispatch through `BulkActionDispatcher`.

## 16. TORRENT-ACTION-001 — one action controller

Toolbar More, row/card More, desktop right-click and touch long-press all enter `TorrentActionController`. Long-press cancels on scrolling movement; interactive descendants do not start it.

## 17. DATAGRID-001 — responsive column resizing

Column drag is a layout operation:

```text
pointermove
→ requestAnimationFrame
→ DataGridLayoutController updates grid width state
```

No VirtualList reconstruction, API request or storage write is allowed during pointermove. Persist once on pointerup.

## 18. DIALOG-001 — AdaptiveDialog

Dialogs use Header / scrollable Body / Actions. Header and actions remain stable; Body scrolls only when content exceeds the dynamic viewport. Desktop dialogs with enough space must not show needless internal scrollbars.

## 19. Cache identity and COMPAT-001 / FUTURE-001 / FIXTURE-001

HTML declares no-store/no-cache bootstrap metadata. Local CSS/JS direct and lazy assets use the deployment Git SHA through `buildAssetUrl()`.

Compatibility is selected at WebAPI/endpoint/Preference/field/capability boundaries, not qB major version. Synthetic future-major fixtures are forward-compatibility sentinels only and never an official support claim.

## 20. Validation policy

Development and Release validation have different cost/coverage responsibilities:

```text
dev normal push
  → static/smoke/platform contracts
  → representative qB 4.1.9.1 + 5.2.0 upstream compatibility audit

dev [ui]
  → the above
  → one Linux Chromium focused shared-UI regression
     using qB 4.1.9.1 + 5.2.0 fixtures

main manual candidate
  → full official stable-tag source/API audit
  → full representative compatibility matrix
  → Linux browser matrix
  → Windows browser matrix
  → exact-SHA release candidate artifact
```

Full cross-platform matrices are not routine dev feedback. They are Release-candidate evidence.

## 21. Release UX gate

A release candidate must preserve all canonical UI contracts, including Select/FloatingLayer, AmbientMark/Reduced Motion, ResponsiveShell 3.0, Settings mother template, About `FactRow` semantics, StatusDock centering, Transfer editor, selection/actions, DataGrid resize, AdaptiveDialog, compatibility matrices and absence of unexpected console/page errors.

Real qB daemon validation remains required on the exact candidate SHA for the legacy 4.1.9.1 boundary and a modern 5.2.x target before promotion to `main`. Fixture PASS never implies production/live certification.

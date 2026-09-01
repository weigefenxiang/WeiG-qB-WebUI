# WeiG qB WebUI — Design System

Version: **1.8**  
Status: **v0.3.6 canonical interaction + adaptive mobile baseline**  
Theme: **Nebula Spatial Console**  
Compatibility floor: **qBittorrent 4.1.9.1**

> This file is the single visual and interaction authority. New UI extends these rules; it does not create a second local design system.

The project may study the system-thinking examples collected by `VoltAgent/awesome-design-md`: tokens, reusable components, explicit interaction states, responsive contracts and restrained hierarchy. References are principles, not screenshots to copy.

## 1. Non-negotiable rules

1. One semantic purpose has one canonical component.
2. Feature code does not invent local Button/Select/Card/Chip/Badge/Modal/Popover visual systems.
3. Capability detection, not qB major version, decides backend compatibility.
4. Data count is not DOM count; large collections stay virtualized.
5. Polling never destroys page, scroll, selection, detail-return or display-timezone state.
6. Mobile is a touch-first adaptive layout, not a squeezed desktop.
7. Primary data surfaces consume safe remaining workspace instead of arbitrary fixed height.
8. Display timezone is browser presentation state, never qB/server time.
9. Storage telemetry is the qB default-save filesystem value, never fabricated VPS telemetry.
10. HTML is a no-store bootstrap; CSS/JS cache identity is the deployment Git SHA.
11. Reduced Motion is mandatory.
12. English is canonical copy; English and Simplified Chinese are maintained product languages.

## 2. Spatial hierarchy

```text
Void      page/deep-space background
Base      workspace
Panel     Sidebar / DataGrid / Settings section
Card      stats / information cards
Raised    search / toolbar / active input / detail summary
Floating  listbox / menu / popover / dialog
```

Material hierarchy is created with restrained luminance, border contrast, inner highlight and shadow. Continuous neon is not hierarchy.

## 3. Canonical primitives

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
Connection / Transfer Dock
FloatingLayer
AmbientMark
```

### PRIMITIVE-001 — no feature-local clone

Feature CSS may own layout, column geometry and feature-specific semantic states. It may not redefine canonical colors, radii, shadows, focus rings or interaction state for an existing primitive.

Required control states:

```text
Default
Hover
Focus-visible
Active / Selected
Disabled
```

## 4. FLOATING-001 — one FloatingLayer system

Any UI that visually floats above normal content must be rendered through the canonical body-level portal:

```text
Trigger
  ↓ getBoundingClientRect()
#weigg-floating-layer
  ↓ position: fixed
Select / Dropdown / Menu / Popover / Tooltip / Timezone picker
```

A floating surface must never rely on an ancestor `z-index` to escape `overflow:hidden/auto` clipping.

Collision contract:

```text
prefer below
→ flip above when needed
→ shift horizontally inside viewport
→ cap height when vertical space is limited
→ internal scroll when capped
→ recompute on viewport resize/scroll/visualViewport changes
```

Safe edge target is approximately 8px from the visual viewport.

## 5. SELECT-001 — canonical Select/Listbox

Visible Select UI uses `W.Components.selectControl()`. Native `<select>` may remain as an invisible data/compatibility bridge.

Keyboard/ARIA contract:

```text
Arrow Up / Down
Home / End
Enter / Space
Escape
aria-haspopup=listbox
role=listbox / option
aria-selected
```

System/OS popup coloring is not a product dependency.

## 6. BRAND-001 — reusable AmbientMark

```text
AmbientMark
├─ Mark / Logo
├─ Orbit layer
├─ Spark layer
├─ Shine layer
└─ Ambient scheduler
```

Default is quiet. Typical random check interval is about 8–28 seconds and a check may intentionally do nothing. Allowed short effects include orbit, spark, 3D tilt, shine, breathe and low-probability combinations.

Requirements:

- no permanent RAF loop;
- no continuous orbit;
- scheduler pauses while the document is hidden;
- Reduced Motion disables nonessential brand motion;
- random source can be injected for deterministic tests;
- component is product-neutral and reusable by future WeiG sites.

## 7. TIME-001 / TIME-002 — global Display Time Zone

Visible date/time is rendered through `W.Time` / `Intl.DateTimeFormat`:

```text
qB timestamp
→ normalized epoch
→ chosen IANA timezone
→ localized visible text
```

The status dock is the global control surface. Canonical label:

```text
✓ UTC+08:00 · Asia/Shanghai
```

`UTC±HH:MM` is calculated from the selected IANA zone and current instant, supporting DST, `+05:30`, `+05:45` and other valid offsets.

Logs and other pages consume this state; they do not create route-local timezone selectors. Changing timezone changes visible text only. Epoch and `<time datetime>` stay immutable.

## 8. LOGS-001 — data-first newest-first Logs

```text
Newest
Older
Oldest
```

- initial request: `last_known_id=-1`;
- incremental cursor: current maximum ID;
- browser buffer: at most 5000 newest rows;
- Follow Latest ON: viewport stays at top;
- manual downward scroll: Follow is released;
- Follow OFF: insertion above compensates scroll position;
- search/severity changes are deliberate context changes and may reset top.

Logs compose canonical Search + FilterChip + CheckControl + Select + Button + StatusPill + DataPanel + VirtualList only.

## 9. NAV-001 — context-safe Torrent detail

Detail tab order begins with:

```text
[ ← Back to torrents ] [ Overview ] [ Files ] [ Trackers ] [ Peers ] ...
```

The application preserves originating Torrent page/filter state and list scroll position.

```text
Page 2 / scroll 600
        ↓
Torrent Detail
        ↓ Back / Esc
Page 2 / scroll 600
```

Directly opened detail URLs without a valid internal list context fall back to Torrent home instead of blindly navigating to an external history entry.

Escape priority:

```text
1. Select/Popover → close
2. Dialog         → dialog owns Esc
3. Editing input  → do not steal
4. Torrent Detail → Context Back
5. Torrent List   → existing list behavior
```

## 10. MOBILE-001 — remaining-space layout

On phones the shell owns viewport subtraction:

```text
Topbar
Workspace (remaining track)
Statusbar
Bottom navigation / safe area
```

Active page content uses flex/grid remaining-space ownership with `min-height:0`. Feature pages must not reintroduce `100vh - Npx`, arbitrary `min-height:360px` or similar magic viewport formulas.

The primary data surface is the main scroll owner. Nested scrolling is avoided unless the nested surface is itself the explicit data viewport.

Validation includes at least:

```text
320×568
360×800
390×844
430×932
```

and representative desktop widths.

## 11. MOBILE-CARD-001 / MOBILE-CARD-002 — Torrent density

Torrent cards remain readable but dense. Secondary metrics are one visual line whenever physically possible:

```text
↓0B/s  ↑0B/s  ETA  29.8MiB
```

Adaptation priority:

```text
remove redundant spaces/zero decimals
→ reduce gap
→ reduce font size/tracking
→ only then consider overflow fallback
```

CSS card height and JavaScript VirtualList row height share one mobile metric contract so a visually shorter card never leaves invisible virtual-row gaps.

Touch targets remain approximately 44×44px where interaction is required even when data typography becomes denser.

## 12. STATUS-SEMANTIC-001 — Torrent state colors

State must be legible through text plus tone, not color alone.

```text
Downloading       cyan / blue
Seeding           green
Stalled download  amber
Stalled seeding   purple
Stopped / paused  neutral gray family
Queued            indigo
Checking / moving amber
Error             danger red
```

All states use the same `StatusPill` primitive. Do not color the whole Torrent card as a substitute for hierarchy.

## 13. TOOL-PAGE-001 — Search / RSS / Logs on mobile

Search, RSS and Logs use one remaining-workspace tool-page contract. Empty results do not reserve a giant fixed-height box. Controls remain at the top, while the result/data viewport consumes the rest of the page when data exists.

A mobile route must not create a second document-height blank page below its useful content.

## 14. STORAGE-001 — free-disk status telemetry

Canonical source:

```text
sync/maindata
└─ server_state.free_space_on_disk
```

Meaning:

> Free space on the filesystem containing qBittorrent's default save path.

Do not label it as generic VPS root-disk space. In Docker, the filesystem may be a host bind-mounted data volume.

Formatting uses human-readable IEC units:

```text
B / KiB / MiB / GiB / TiB
```

Precision is adaptive for quick reading rather than a forced significant-digit count. Full bytes may be exposed in Tooltip/details.

Telemetry rules:

- low-frequency refresh independent of Torrent polling cadence;
- incremental sync RID after the first full snapshot;
- partial sync without a changed free-space field keeps the last valid value;
- missing/unsupported telemetry is hidden, never fabricated;
- actual `0 B` remains a valid value.

## 15. SETTING-UNIT-001 — Advanced units and enums

A numeric qB Preference must have verified semantics before WeiG adds a unit or conversion. Units are not guessed from the key name.

Examples of source-verified display contracts:

```text
slow_torrent_inactive_timer      s
slow torrent rate thresholds    KiB/s
send buffer watermarks           KiB
socket receive/send buffers      API bytes ⇄ display KiB
socket backlog                    connections
torrent_file_size_limit          API bytes ⇄ display MiB
disk_queue_size                  API bytes ⇄ display KiB
memory_working_set_limit         MiB
checking_memory_use              MiB
hostname_cache_ttl               s
refresh_interval                 ms
save_resume_data_interval        min
```

Verified special zero semantics are stated in the description, for example System default, Disabled or Permanent lease.

Verified enums use canonical Select rather than exposing unexplained codes. Display conversion must round-trip to the exact WebAPI representation before it is releaseable.

## 16. Settings layout

Settings maintain:

```text
Title
Description
Control
```

qB Preferences use `W.Components.preferenceField()`. WeiG readonly deployment metadata uses `W.Components.readonlySettingField()`. WeiG browser/interface preferences use `settings-control`.

Alternative WebUI keeps its path/disable safety behavior but does not own a second Settings visual system.

## 17. DataGrid, virtualization and polling

```text
API/cache item count != mounted DOM count
```

Torrent, Files, Peers, Trackers and Logs remain virtualized when cardinality warrants it.

Polling flow:

```text
fetch compatible data
→ update cache/model
→ refresh visible virtual window
```

Polling updates data, not navigation.

## 18. Cache identity

HTML declares no-store/no-cache bootstrap metadata. Local CSS/JS direct and lazy assets use the deployment Git SHA through `buildAssetUrl()`.

Historical filenames such as `v030.js` or `v036.css` describe lineage, not cache identity.

## 19. COMPAT-001 / FUTURE-001 / FIXTURE-001

Compatibility is selected at WebAPI/endpoint/Preference/field/capability boundaries. Feature code must not use `major > 5 => unsupported` style gates.

Representative fixtures span qB 4.1.9.1 through current stable and upstream next. A synthetic future-major node is allowed only as a forward-compatibility sentinel and must never be described as official support for an unreleased qB major version.

Fixtures must model meaningful API/capability differences instead of changing only version strings.

## 20. Release UX gate

A release candidate must pass static contracts plus Chromium checks for:

- canonical Select and FloatingLayer bounds;
- AmbientMark and Reduced Motion;
- Logs newest-first + global timezone invariants;
- Torrent Detail Back/Esc context restoration;
- mobile remaining-space layout;
- one-line Torrent metrics;
- semantic statuses;
- Search/RSS one-screen behavior;
- storage telemetry;
- Advanced unit/enum display and round-trip;
- representative compatibility nodes;
- no unexpected console/page errors.

Fixture PASS never implies production/live certification.

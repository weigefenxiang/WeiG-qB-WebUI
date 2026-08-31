# WeiG qB WebUI

A premium, modular and high-performance Alternate WebUI for qBittorrent.

Current version: **0.3.6**  
Compatibility floor: **qBittorrent 4.1.9.1 / WebAPI 2.2.1**  
Compatibility strategy: **WebAPI/capability detection, not qB major-version hardcoding**.

## v0.3.6 — Canonical UI, adaptive mobile, compatibility matrix

v0.3.6 consolidates interaction, responsive layout and compatibility behavior into reusable primitives instead of feature-local patches.

### Canonical UI primitives

- custom Select/Listbox progressively upgrades native selects;
- all Select/Dropdown/Popover surfaces use the body-level FloatingLayer portal with viewport flip/shift collision handling;
- AmbientMark provides sparse random orbit/spark/tilt/shine/breathe brand motion and honors Reduced Motion;
- Button, Chip, CheckControl, StatusPill, SettingCard and floating surfaces keep one visual implementation per semantic role.

### Global Display Time Zone

The status dock owns one browser-side display timezone:

```text
✓ UTC+08:00 · Asia/Shanghai
```

Offsets are calculated from the active IANA timezone, including half-hour, 45-minute and DST zones. The setting changes only presentation through `Intl.DateTimeFormat`; it does **not** modify qBittorrent, Docker or VPS time. Logs consume this global setting and do not create a second timezone selector.

### Logs

Logs are newest-first, incrementally fetched with the current maximum `last_known_id`, bounded to the newest 5000 records and rendered with VirtualList. Follow Latest keeps the viewport at the top; when the user reads older rows, inserting new rows does not destroy that position.

### Torrent detail context navigation

```text
Torrent list page + scroll position
        ↓
Torrent Detail
        ↓ Back / Escape
same list page + scroll position
```

The Back control sits left of Overview. Browser Back, the detail Back button and Escape share the same navigation contract.

### Adaptive mobile layout

Mobile pages consume the remaining application grid track instead of using `100vh - Npx` formulas. Torrent, Search, RSS and Logs therefore adapt to short and tall phones without creating a second blank page or leaving a large unused gap above the status/navigation bars.

Torrent cards keep secondary metrics on one line whenever physically possible:

```text
↓0B/s  ↑0B/s  ETA  29.8MiB
```

The runtime first removes redundant spacing/decimal zeroes, then tightens gap/font metrics. State remains visually semantic through the shared StatusPill: downloading is cyan/blue, seeding green, stalled download amber, stalled seeding purple, stopped gray, queued indigo, checking amber and errors retain the canonical danger tone.

### Free disk telemetry

The global status dock may show:

```text
◫ Free 1.23 TiB
```

The source is qBittorrent `sync/maindata → server_state.free_space_on_disk`. Its precise meaning is **free space on the filesystem containing qBittorrent's default save path**. In Docker this may correspond to a host bind-mounted download volume; it must not be mislabeled as VPS root-disk space.

Formatting uses human-readable IEC units (`B / KiB / MiB / GiB / TiB`) with adaptive decimals. Telemetry refresh is low-frequency and incremental; a partial sync response that omits an unchanged value keeps the last known valid value.

### Advanced Settings units and enums

Advanced preferences now have a source-verified display layer. Examples include:

```text
Slow Torrent Inactive Timer (s)
Slow Torrent Download Rate Threshold (KiB/s)
Socket Receive Buffer Size (KiB)
Torrent File Size Limit (MiB)
Memory Working Set Limit (MiB)
Hostname Cache TTL (s)
Refresh Interval (ms)
```

Where qB WebAPI exposes bytes but the official qB desktop UI presents a friendlier unit, WeiG performs an exact round trip. Example:

```text
104857600 API bytes ⇄ 100 MiB display
65536 API bytes    ⇄ 64 KiB display
```

Verified special values such as `0 = System default`, `0 = Disabled` and `0 = Permanent lease` are explained. Verified enums are rendered as readable canonical Select controls rather than exposing unexplained integer/string codes.

## Compatibility matrix

`tests/fixtures/qb-compat-matrix.json` is the canonical representative matrix:

| Role | qBittorrent | WebAPI |
| --- | --- | --- |
| Legacy floor | 4.1.9.1 | 2.2.1 |
| Early 4.x | 4.2.5 | 2.5.1 |
| Mature 4.x A | 4.3.9 | 2.8.2 |
| Mature 4.x B | 4.4.5 | 2.8.5 |
| Advanced-preferences era | 4.5.5 | 2.8.19 |
| Late 4.x | 4.6.7 | 2.9.3 |
| 5.x transition | 5.0.5 | 2.11.2 |
| Mature 5.x | 5.1.2 | 2.11.4 |
| Live 5.2 target | 5.2.0 | 2.15.1 |
| Current stable fixture | 5.2.3 | 2.15.1 |
| Upstream/next | master | 2.16.2 |
| Forward-major sentinel | 6.0.0-synthetic | 3.0.0-synthetic |

The synthetic 6.x node exists only to detect accidental major-version rejection. It is **not** a claim that an unreleased qBittorrent 6.x is officially supported.

The release-blocking live instances remain qBittorrent **4.1.9.1** and **5.2.x**. Fixture PASS never substitutes for real-server certification.

## Cache and deployment identity

HTML is a no-store bootstrap. CSS/JS asset identity is the exact deployed Git SHA:

```text
HTML                 → no-store/no-cache bootstrap
<meta build SHA>     → deployed commit
CSS / JS URL         → ?v=<40-char Git SHA>
VERSION              → product version
GIT_SHA              → exact deployed source
weigg-install.json   → qB path / host path / container / SHA metadata
```

Semver is not used as a static-resource cache key.

## Docker path boundary

A Docker qB process commonly sees:

```text
/config/weigg-qb-webui
```

while the VPS host may contain:

```text
/root/qbittorrent/config/weigg-qb-webui
/root/qbittorrent3/config/weigg-qb-webui
```

Only the container-visible path belongs in qBittorrent's `alternative_webui_path`. Host paths are deployment metadata and must never be written into the qB preference.

## Development and tests

Runtime is plain HTML/CSS/JavaScript. Run the static/contract suite with:

```sh
npm test
```

CI additionally runs:

```text
tests/browser-logs-v033.mjs
tests/browser-settings-v034.mjs
tests/browser-mobile-v036.mjs
tests/browser-ui-v036.mjs
```

The representative interaction browser gate uses **12 compatibility nodes × 3 viewports**. The dedicated mobile gate covers qB 4.1.9.1 and 5.2.3 at 320×568, 360×800, 390×844 and 430×932, including one-line Torrent metadata, semantic status colors, one-screen Search/RSS layout and storage telemetry.

Unit/display conversion is additionally locked by `tests/advanced-contract-v036.mjs`.

## Live v0.3.6 candidate deployment

`tests/live-v036.sh` can atomically stage and switch both known test installations from an exact Git SHA, with backups and rollback commands. It changes Alternate WebUI files only; **Docker/qBittorrent restart is not required**.

The final candidate SHA should always be supplied explicitly:

```sh
sh tests/live-v036.sh --sha <40-char-sha>
```

Targets:

```text
qB 4.1.9.1  /root/qbittorrent/config/weigg-qb-webui
qB 5.2.x    /root/qbittorrent3/config/weigg-qb-webui
```

After deployment, perform one browser hard refresh and run the live checklist before merging `dev` into `main`.

## Documentation authority

- `DESIGN.md` — canonical visual, interaction, mobile, status, timezone and primitive rules.
- `docs/001.项目总方案.md` — product plan and non-negotiable engineering rules.
- `docs/002.兼容与实现状态.md` — compatibility matrix, fixture/live boundaries and implementation status.
- `docs/003.项目架构.md` — runtime ownership, directory structure and data boundaries.
- `docs/004.UI与缓存契约.md` — UI primitive, FloatingLayer, mobile, storage, Advanced-unit and cache contracts.

## Core invariants

```text
One semantic purpose → one canonical component
Capability/field detection → not qB major checks
Data count → never DOM count
Polling → never destroys user navigation/scroll state
Display timezone → never backend timezone
Filesystem free space → never fabricated VPS telemetry
HTML bootstrap → no-store
Static asset identity → Git SHA
Fixture PASS → never advertised as live certification
```

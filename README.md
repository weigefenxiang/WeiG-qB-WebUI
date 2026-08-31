# WeiG qB WebUI

A premium, modular and high-performance Alternate WebUI for qBittorrent.

Current version: **0.3.2**  
Compatibility floor: **qBittorrent 4.1.9**  
Compatibility target: **qBittorrent 4.1.x → current 5.x**, using capability-based progressive enhancement.

## v0.3.2 — Cross-version Logs + Adaptive DataPanel

v0.3.2 fixes a compatibility mistake in the Logs capability gate and turns Logs into a first-class adaptive data page.

### Logs are supported on the 4.1.9 floor

The previous client incorrectly gated Logs on `WebAPI >= 2.3.0`. qBittorrent 4.1.x already exposes the log API, so a 4.1.9.1 / WebAPI 2.2.1 instance was being hidden by WeiG itself.

The Capability layer now treats Logs as available from the supported qBittorrent 4.1.x floor onward.

### Log timestamps are normalized across old and new qB

Older qB releases may return log timestamps in milliseconds while newer releases return seconds. `QBClient.logs()` and `QBClient.peerLogs()` now normalize the transport contract to seconds before feature/UI code sees the data.

```text
legacy milliseconds → normalized seconds → UI Date
modern seconds      → normalized seconds → UI Date
```

Feature code no longer needs a qB-version timestamp branch.

### Adaptive Logs DataPanel

Logs now use the same data-surface language as the Torrent page rather than a fixed `max-height: 62vh` utility box.

The page provides:

- **Auto / Compact / Max** workspace sizing;
- full remaining-height layout in Auto mode;
- a compact user-selected view when vertical space should be reduced;
- Max mode that gives the DataPanel the entire workspace;
- VirtualList rendering;
- incremental `last_known_id` polling;
- local log search;
- Normal / Info / Warning / Critical filtering;
- Follow latest mode;
- bounded in-browser history to avoid unbounded memory growth;
- desktop and mobile responsive rows.

The v0.3.2 UI follows the repository `DESIGN.md` and the design-system principles reviewed from `VoltAgent/awesome-design-md`: consistent tokens, reusable data surfaces, explicit interaction states, restrained depth, and responsive behavior instead of feature-local fixed boxes.

## Stable Virtual UI + Transfer Control

The v0.3 baseline preserves the user's Torrent scroll position during automatic polling and manual refresh. Deliberate context changes still reset to the top:

```text
Filter / Tracker / Save Path / Category / Tag
Page change
Page-size change
Torrent search change
```

Zero-result Torrent states use compact empty surfaces instead of large blank DataGrids.

The Transfer Dock exposes current download/upload rate, global limits, Alternative Speed mode, connection state, Torrent count and session/graph information. Cross-version transfer controls use the long-lived qB transfer endpoints.

## Compatibility matrix

| Capability | 4.1.9.1 / API 2.2.1 | Mature 4.x | 5.2.0 | Strategy |
| --- | ---: | ---: | ---: | --- |
| Start/Stop semantics | ✓ | ✓ | ✓ | QBClient bridge |
| Global DL/UL limits | ✓ | ✓ | ✓ | Native API |
| Alternative speed mode | ✓ | ✓ | ✓ | Native API |
| Session stats / graph | ✓ | ✓ | ✓ | Native data + WeiG UI |
| Logs | **✓** | ✓ | ✓ | Native API + normalization |
| Log search / level filter | ✓ | ✓ | ✓ | WeiG enhancement |
| Tags | — | ✓ | ✓ | Capability gate |
| Exact Private flag | — | — | ✓ | Native on modern qB |
| Private/PT fallback | ✓ | ✓ | ✓ | Tracker rules / Native |
| Torrent Creator foundation | — | — | capability | Native gate |
| Cookie foundation | — | version gate | capability | Native gate |

Static fixtures do not replace live certification. Release-blocking real instances remain qBittorrent **4.1.9.1** and **5.2.0**.

## Compatibility boundary

Feature/UI code must not scatter qB version checks.

```text
qB API
  ↓
QBClient + Capability + normalization
  ↓
stable application semantics
  ↓
WeiG feature enhancement
  ↓
UI
```

The general rule is:

1. **Native** — expose the qB capability directly.
2. **Compatible** — translate old/new API vocabulary inside QBClient.
3. **WeiG Enhanced** — derive UI behavior from existing data when the old backend lacks a modern convenience feature.
4. **Unavailable** — do not fabricate backend data or write APIs that do not exist.

## Core platform

- qBittorrent **4.1.9 compatibility floor** through current 5.x.
- `20 / 50 / 100 / 200` server page sizes using `limit` / `offset`.
- Virtualized Torrent/Files/Peers/Trackers/Logs lists.
- Desktop DataGrid and Mobile Torrent cards.
- Resizable/configurable Torrent columns and persisted layout.
- Tracker display/filter normalization that strips query/fragment credentials.
- Exact Private metadata when available; Tracker-domain fallback on old qB.
- Metadata-driven Settings.
- Search, RSS and Logs capability-aware feature surfaces.
- Back/Home/Reload recovery and Reduced Motion invariants.

## Languages

English is the canonical source language. English and Simplified Chinese are maintained product languages. Missing locale strings fall back to English.

## Linux installer

```sh
curl -fsSL https://raw.githubusercontent.com/weigefenxiang/WeiG-qB-WebUI/main/installers/install.sh -o /tmp/weigg-qb-install.sh
sh /tmp/weigg-qb-install.sh
```

Known Docker `/config` root:

```sh
sh /tmp/weigg-qb-install.sh \
  --config-root=/host/path/to/qbittorrent/config \
  --dir=/config/weigg-qb-webui
```

Rollback:

```sh
sh /tmp/weigg-qb-install.sh --rollback
```

Normal install/update does not modify WebUI credentials.

## Windows installer

```powershell
.\install.ps1
```

Optional Alternate-WebUI configuration:

```powershell
.\install.ps1 -Configure
```

Rollback:

```powershell
.\install.ps1 -Mode Rollback
```

## Development and tests

Runtime is plain HTML/CSS/JavaScript without a runtime application framework.

```sh
npm test
```

The suite includes syntax/smoke checks, `tests/compat-v030.mjs`, and `tests/log-compat-v032.mjs` for the 4.1.9 Logs capability, timestamp normalization and incremental `last_known_id` contract.

Documentation authority:

- `DESIGN.md` — visual and interaction authority, including DataPage/DataPanel rules.
- `docs/001.项目总方案.md` — product plan and engineering invariants.
- `docs/002.兼容与实现状态.md` — compatibility matrix and live/automated status.
- `docs/003.项目架构.md` — runtime layers and ownership boundaries.

## Certification status

`0.3.2` is the integrated code baseline. Automated fixtures validate API contracts, but a stable release still requires live regression on both release-blocking qB instances, including the 4.1.9 and 5.2 Logs pages, responsive sizing and incremental refresh behavior.

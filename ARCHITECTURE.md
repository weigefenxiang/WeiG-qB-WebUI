# WeiG qB WebUI Architecture

This document describes the long-lived architecture of the repository. Component-specific details live beside the component they describe.

## 1. System Overview

```text
qBittorrent
    │
    │ WebAPI + static Alternate WebUI hosting
    ▼
webui/                         production application
    ▲
    │ validated by
    │
simulator/ ────── tests/ ───── tools/
    │               │            │
    │               │            └─ source extraction, compatibility compilation,
    │               │               runtime materialization and distribution tools
    │               └─ contracts, browser checks, compatibility and real-qB validation
    └─ virtual qB environment used for development and Pages validation
```

The repository has one production runtime: `webui/**`. The simulator, test harnesses and source-processing tools exist to validate or build that runtime; they are not production dependencies.

## 2. Repository Boundaries

| Area | Responsibility |
| --- | --- |
| `webui/` | Self-contained qBittorrent Alternate WebUI delivered to users. |
| `simulator/` | Virtual qB protocol/runtime environment for deterministic development and validation. |
| `tests/` | Static contracts, browser acceptance, installer validation, compatibility matrices and real-qB harnesses. |
| `tools/` | qB source parsers, compatibility compilers, translation/copy materialization, build and audit utilities. |
| `installers/` | Linux, NAS, Docker and Windows installation/upgrade lifecycle. |
| `.github/workflows/` | CI, Pages materialization, real-qB validation, promotion and release orchestration. |
| `docs/` | Stable developer documentation. |

See the subsystem documents for implementation details:

- [webui/ARCHITECTURE.md](webui/ARCHITECTURE.md)
- [simulator/ARCHITECTURE.md](simulator/ARCHITECTURE.md)
- [tests/README.md](tests/README.md)
- [tools/README.md](tools/README.md)
- [installers/README.md](installers/README.md)

## 3. Production Runtime Flow

The browser-side runtime follows a small number of explicit ownership boundaries:

```text
qB WebAPI
  │
  ▼
W.QBClient
  │ transport + detected qB/WebAPI identity
  ▼
W.CapabilityRegistry
  │ exact/equivalent compatible domain facts
  ├─ torrent-compat.json
  ├─ detail-compat.json
  ├─ settings-compat.json
  ├─ rss-compat.json
  └─ source-actions.json
  │
  ▼
canonical semantic owners
  ├─ SettingsSchema / SettingsRenderer / PreferenceTransaction
  ├─ I18n
  ├─ DataViewport
  ├─ ActionRegistry
  ├─ DialogRuntime
  ├─ ColumnConfigurator
  ├─ RSSRules / RSS workspace
  ├─ Selection
  ├─ TransferRuntime
  └─ Theme / responsive presentation
```

`W.QBClient` owns transport. Feature modules do not create independent qB clients or duplicate polling loops.

`W.CapabilityRegistry` owns runtime compatibility resolution. UI code consumes resolved domain facts instead of guessing behavior from version strings.

## 4. Source-to-Runtime Compatibility Pipeline

Compatibility is derived from qBittorrent source and frozen release evidence:

```text
official qB source / release metadata
        │
        ▼
tools/qb-*-source*.mjs and parsers
        │
        ▼
frozen admitted release / locale evidence
        │
        ▼
compact domain compilers
        │
        ▼
webui/private/data/*
        │
        ▼
CapabilityRegistry + semantic owners
```

The complete admitted release catalog belongs to tooling, CI and simulator validation. The production WebUI carries only bounded runtime data required by the browser.

Generated compatibility data is treated as source-derived product input. Developers should change the responsible source/compiler and regenerate the output rather than hand-editing generated facts.

## 5. Architectural Invariants

### One responsibility, one owner

A semantic responsibility has one active owner. Replacing an owner includes retiring the old caller, state, event, styling and test expectations. Dual active implementations are not a compatibility strategy.

### DOM is not application state

Feature state belongs to controllers or explicit state objects. UI text, CSS classes, hidden labels and rendered counters are outputs, not databases for other features.

### Fail closed on unproven writes

Read-only presentation may degrade when upstream evidence is incomplete. Mutating qB preferences or actions require a proven endpoint, parameter/value projection and compatible runtime identity.

### Mobile is the same application

Desktop and mobile use the same qB client, selection state, settings draft, compatibility state and business owners. Responsive modules change geometry and presentation only.

### Exact Git SHA is build identity

Static assets and validation evidence are tied to an exact source SHA. Product versioning and source identity are separate concepts.

### Simulator is not a production dependency

The simulator may model production behavior and build Pages validation surfaces, but `webui/**` must remain independently deployable as a qBittorrent Alternate WebUI.

## 6. Product Version and Build Identity

`VERSION` and `webui/VERSION` represent the product version. Distribution builds also embed an exact `GIT_SHA`.

A repository-only documentation, test, workflow or tooling change does not require a product version change unless it modifies the delivered `webui/**` product bytes or intentionally changes the product version contract.

## 7. Runtime Data

The primary compact runtime files are under `webui/private/data/`:

- `capabilities.json` — release identity and high-level runtime capability index.
- `torrent-compat.json` — Torrent list/filter/field compatibility.
- `detail-compat.json` — Torrent detail surfaces and source-derived descriptors.
- `settings-compat.json` — bounded Settings structure and preference semantics.
- `rss-compat.json` — RSS runtime compatibility.
- `source-actions.json` — source-proven action availability.
- `qb-settings-native.txt` — compact qB-owned copy/translation registry.

Official qB WebUI translation assets required by the runtime live under `webui/translations/`.

## 8. Development and Validation

Use [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for local setup and [tests/README.md](tests/README.md) for validation.

Compatibility policy is documented in [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md). Release orchestration is documented in [docs/RELEASE.md](docs/RELEASE.md).

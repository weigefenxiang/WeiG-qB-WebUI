# Testing Guide

The test suite is organized by responsibility rather than by one monolithic end-to-end run.

## 1. Default Contracts

Install dependencies:

```sh
npm ci
```

Run the default repository contract suite:

```sh
npm test
```

This suite covers production ownership, compatibility contracts, Settings/locale behavior, simulator invariants, installer/release contracts and other static/deterministic checks.

## 2. Simulator Contracts

Run simulator-focused tests with:

```sh
npm run test:simulator
```

These contracts cover endpoint routing, preference behavior, storage, runtime profiles, services, search, torrent operations, performance constraints and simulator ownership boundaries.

## 3. Browser Tests

Browser tests use the shared `tests/browser-driver.mjs` owner.

Representative suites include:

- `browser-runtime.mjs`
- `browser-theme.mjs`
- `browser-feedback.mjs`
- `browser-feature-parity.mjs`
- `browser-torrent-workspace.mjs`
- `browser-adaptive-ui.mjs`
- `browser-settings-admitted.mjs`
- `browser-settings-fidelity.mjs`

A browser test should perform the real user action and assert the semantic result plus final visible/computed state. DOM existence alone is not sufficient for critical interaction acceptance.

## 4. Source and Compatibility Tests

Source-derived compatibility is guarded by dedicated contracts for:

- stable release admission,
- WebAPI evolution,
- torrent fields/surfaces,
- detail surfaces/actions,
- Settings preference structure and projections,
- locale/QM routing,
- qB-owned text,
- RSS surfaces,
- compact runtime identity.

When changing a parser/compiler, run both the tool-specific source contract and the runtime contract that consumes its output.

## 5. Real qBittorrent Validation

Files prefixed with `real-qb-` provide real-daemon validation infrastructure.

The suite includes:

- capability smoke checks,
- browser harnesses,
- session/authentication checks,
- file priority/search/torrent creator flows,
- full frozen release matrix support,
- locale matrix support.

Real-qB validation is intentionally heavier than normal development tests. Use focused checks while iterating and reserve broad matrix runs for stable checkpoints or release preparation.

## 6. Installer and Distribution Tests

Installer tests validate:

- initial install,
- upgrade and backup retention,
- rollback,
- Docker path mapping,
- configuration mutation,
- distribution identity,
- checksum and embedded Git SHA handling.

Distribution/release contracts also confirm that the packaged WebUI is self-contained and excludes retired runtime assets.

## 7. Pages Validation

Pages tests verify the materialized virtual site and development installer payload.

They cover branch identity, authentication, protocol behavior, services, preferences, locale bootstrap, mobile layout and release-profile behavior.

Pages validation is exact-SHA evidence. A result from another commit is not proof for the current source tree.

## 8. Choosing Tests for a Change

| Change | Minimum focused validation |
| --- | --- |
| Shared UI primitive | owner contract + affected browser suite |
| Settings schema/renderer | Settings contracts + browser Settings checks |
| Locale/copy pipeline | locale/source contracts + affected browser checks |
| Torrent/detail behavior | field/detail contracts + torrent browser suite |
| Simulator runtime | affected simulator contracts + `npm run test:simulator` when broad |
| Source parser/compiler | source contract + generated/runtime consumer contract |
| Installer | installer lifecycle contracts |
| Workflow/release | CI/release contract tests |
| Documentation only | documentation authority contract |

## 9. Test Naming

Test names describe durable responsibility. Avoid naming tests after temporary milestones or completed implementation phases.

If a regression exposes a shared-owner failure, add the regression to the shared family contract rather than creating a one-off test tied to a screenshot or one product version.

## 10. Evidence Layers

The repository uses several evidence layers with different purposes:

1. static/contract tests,
2. source and compatibility audits,
3. simulator/browser tests,
4. Pages materialization/live checks,
5. real-qB validation,
6. release/promotion checks.

Passing one layer does not automatically replace another when the change affects a different boundary.

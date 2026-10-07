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

This is the bounded Core suite: deterministic, high-value routine owners for runtime/bootstrap, Settings/session/capability safety, architecture/ownership, distribution identity, change classification and CI policy. Heavy compatibility, specialty UI/browser, stress/soak and historical release checks live in explicit audit suites instead of silently joining every `npm test` run.

## 2. Simulator Contracts

Run simulator-focused tests with:

```sh
npm run test:simulator
```

These contracts cover endpoint routing, preference behavior, storage, runtime profiles, services, search, torrent operations, performance constraints and simulator ownership boundaries.

## 3. Browser Tests

Browser tests use the shared `tests/browser-driver.mjs` owner.

Routine browser owners are:

- `browser-runtime.mjs`
- `browser-feature-parity.mjs`
- `browser-torrent-workspace.mjs`
- `browser-adaptive-ui.mjs`
- `browser-settings-admitted.mjs`
- `browser-settings-fidelity.mjs`

Theme, Feedback, Sidebar visual, deep Detail, field-provenance and entry-locale browser regressions remain preserved under `audits/` and are not duplicate Candidate blockers.

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

Run `npm run test:compat` for the grouped source/Frozen compatibility audit. When changing a parser/compiler, run the relevant source audit plus the runtime owner that consumes its output; do not add the entire compatibility set back to Core.

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


## A61 Validation Tiers

The repository validation owner is risk-tiered:

- `npm test` -> `test:core`: 30–40 deterministic, high-value contracts for every CI-relevant dev push.
- `npm run test:simulator`: 6–10 Virtual qB owner contracts; granular stress/soak checks are not routine blockers.
- `npm run test:compat`: source/Frozen compatibility audit contracts; heavy 65-version and 61-locale workflows are manual Compatibility Audits.
- Candidate Linux Chrome: runtime, Settings fidelity, feature parity, torrent workspace and adaptive UI.
- Candidate Windows: installer/platform checks plus runtime and Settings browser smoke.
- Candidate Deployment remains the real qB + real Chrome behavior owner.
- Promotion requires exact Candidate CI artifact + exact Candidate Deployment evidence + safe fast-forward. Compatibility Audits are not per-promotion prerequisites.

Milestone or implementation-layout tests must not re-enter Core merely to preserve historical workflow shape. Unique safety assertions must move to the current owner before an obsolete file is deleted.

Compatibility and specialty audits moved out of the routine `tests/` ownership surface live in root `audits/`. They keep exact assertions available without silently re-entering ordinary CI or Promotion.

Pages full live verification is intentionally bounded to six durable owners (core, startup performance, auth/session, modern services, protocol, mobile layout). Settings-only source/UI changes keep the dedicated locale/release-profile/preferences shard profile.

After A61, `tests/` is the routine/blocking owner surface; specialty compatibility, source, UI, Pages, browser and historical release checks belong in `audits/`. Moving a check never exempts it from syntax validation.

Core includes `audit-integrity-contract.mjs` so moving specialty checks out of routine CI never exempts their import graph or package entry points from deterministic validation.

Candidate is entered only through explicit `workflow_dispatch` with `validation_mode=candidate`; the historical `[candidate]` commit-message trigger is retired and must not return.

Release Prepare and publication follow the same A61 boundary: preview/orchestration may require Candidate, Deployment, Pages and Session, but Full Frozen/Locale remain independent manual Compatibility Audits. Promotion certification schema v3 and Release both certify Candidate + Deployment without retired compatibility fields.

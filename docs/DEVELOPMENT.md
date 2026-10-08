# Development Guide

This guide covers local repository development. For architecture boundaries, start with [../ARCHITECTURE.md](../ARCHITECTURE.md).

## Requirements

- Node.js 22
- npm
- Git
- Chrome when running browser validation
- Docker only for workflows that require real qBittorrent instances

Install dependencies:

```sh
npm ci
```

Run the default contract suite:

```sh
npm test
```

Run simulator-focused contracts:

```sh
npm run test:simulator
```

## Working on the Production WebUI

The production application lives under `webui/**`.

Important entry points:

- `webui/public/` — unauthenticated/login surface
- `webui/private/index.html` — authenticated shell/bootstrap
- `webui/private/scripts/` — browser modules
- `webui/private/css/` — shared and feature presentation
- `webui/private/data/` — compact runtime compatibility data
- `webui/translations/` — official qB WebUI QM assets used at runtime

Read [../webui/ARCHITECTURE.md](../webui/ARCHITECTURE.md) before changing ownership boundaries.

## UTF-8 Static Assets

All shipped WebUI CSS is UTF-8 without BOM and begins with the literal first-byte declaration `@charset "UTF-8";`. HTML entry documents declare UTF-8, while JavaScript and locale assets remain UTF-8 with readable native Unicode; do not replace international glyphs with feature-local ASCII workarounds or duplicate Select/Checkbox markers. The existing bootstrap inventory contract verifies CSS encoding and one selected-glyph owner. For Alternative WebUI hosting changes, validate **computed CSS content on real qB** in addition to file bytes: host HTTP charset can override stylesheet declarations.

## Working on Compatibility

Do not add product-version conditionals to presentation code when the behavior is source-derived.

The normal pipeline is:

```text
qB source/release evidence
  -> tools/
  -> frozen evidence in tools/data/
  -> compact runtime materialization
  -> webui/private/data/
  -> browser runtime owner
```

When a compatibility fact is wrong:

1. identify the exact source fact,
2. identify the responsible parser/compiler,
3. fix or extend the generic semantic rule,
4. regenerate/revalidate the compact output,
5. add a focused contract,
6. validate the product consumer.

See [COMPATIBILITY.md](COMPATIBILITY.md) and [../tools/README.md](../tools/README.md).

## Working on the Simulator

The simulator is a validation environment, not a production dependency.

Its main areas are:

- `simulator/core/`
- `simulator/protocol/`
- `simulator/preferences/`
- `simulator/storage/`
- `simulator/versions/`
- `simulator/service-worker/`
- `simulator/build/`
- `simulator/lab/`

See [../simulator/ARCHITECTURE.md](../simulator/ARCHITECTURE.md).

## Pages Build

The Pages site is assembled by `simulator/build/build-site.mjs` and `simulator/build/build-pages.mjs`.

These scripts are primarily workflow-owned and expect explicit inputs such as branch WebUI roots, exact SHAs, product versions, frozen catalog data and Settings translation evidence. Prefer using the repository workflows unless you specifically need to reproduce the full materialization pipeline.

The development distribution is produced by:

```text
tools/build-webui-dist.mjs
```

It verifies that the WebUI is self-contained, embeds the exact Git SHA, writes checksums and rejects retired runtime paths.

## Browser Resource Lifecycle and Build-time Bundles

Production source under `webui/private/css/` and `webui/private/scripts/` remains modular. `webui/private/bootstrap-plan.json` is the canonical **source** dependency inventory; do not edit it to point to generated `startup-*.css/js` files. `W.RuntimeAssets` owns network loading, ordered execution, retry, identity and cache keys, while `W.Navigation` owns the route module inventory and `App` determines when the first Torrent view is usable.

The self-contained installer distribution and the dev Virtual Pages source both run the same build-only `tools/css-bundle-materializer.mjs` and `tools/js-bundle-materializer.mjs`. CSS preserves order and UTF-8 declarations; JS groups only safe IIFEs within dependency phases. Files with special execution context (including `document.currentScript`) and selected large modules remain independent. Bundles have a 96-KiB bound, and no custom browser decompression or mandatory minification is added. Generated bundles and retired duplicate source CSS/JS belong to the **distribution**, not the canonical source tree.

Once the first valid Torrent view renders, route code for Settings/RSS/Logs may be offered as a browser-native, inert/low-priority prefetch under visibility/network safeguards. Prefetch does **not** execute the module, mark it loaded, or make the route ready. On navigation, the canonical loader performs actual execution; stale asynchronous navigation results cannot overwrite the active route.

The initial CSS/JS request budget is exercised by `tests/pages-live-startup-performance.mjs` against the *materialized* Virtual Pages output. The verified bundle layout reduced initial requests from 60 to 24 (19 to 3 CSS, 41 to 21 JS including the seed loader). These are asset-count observations, not promises about every client's cold-start timing.

For a qB Alternative WebUI regression, do not substitute `cp -a webui/.` for installer output. `tests/real-qb-docker.sh` now mounts the actual archive built by `tools/build-webui-dist.mjs` read-only, and `tests/real-qb-browser.mjs` verifies CSS/JS inventory, HTTP status, MIME and exact-SHA asset identity on real qB. The isolated temporary extraction root needs traversal permission for the qB container user; the mount itself remains read-only.

For source/build/runtime changes, use the existing `tests/runtime-asset-contracts.mjs`, `tests/runtime-asset-budget-contract.mjs`, Virtual Pages and applicable real-qB evidence, instead of creating another packer, load scheduler or gate.

## Testing Strategy

Use the smallest relevant test while iterating, then expand to the affected integration boundary.

Examples:

- shared UI behavior → focused owner contract + browser suite,
- Settings → Settings schema/projection contracts + browser Settings checks,
- locale/copy → source-text/locale/QM contracts + browser checks,
- source parser → parser contract + compact runtime consumer,
- simulator → affected simulator contracts,
- installer → installer lifecycle tests,
- workflow/release → CI/release contracts.

See [../tests/README.md](../tests/README.md).

## Historical Source and Materialization Regressions

The historical UI / locale regression source contract is `tests/qb-torrent-native-source-contract.mjs`; routine `tests/runtime-asset-contracts.mjs` and the canonical CI materializer gate reuse it. It checks original qB releases such as 4.1.0 and 5.2.3, instead of changing the tested version to avoid missing Statistics or Untagged source facts.

Keep `tools/qb-torrent-runtime-rebind.mjs` and `tools/qb-detail-runtime-rebind.mjs` on the one Frozen release identity even when their source inputs contain enriched evidence. A generator or Pages workflow which mutates historical Copy/QM/Detail assets without source admission is a regression, regardless of whether its generated files parse.

For an exact product change, use the appropriate CI, Pages Source, Virtual Pages, and isolated real-qB workflows. GitHub runs must agree on the exact product SHA; preserve the real-qB upload artifact as evidence. Routine docs-only commits do not justify a second product version bump.

## Generated Files

Do not treat generated runtime data as hand-maintained configuration.

If a file under `webui/private/data/` or `tools/data/` is generated or frozen evidence, update it through the responsible tool and validate its identity/provenance.

## Product Versioning

The product version is mirrored in:

- `VERSION`
- `webui/VERSION`
- `webui/private/product-identity.json`
- `package.json`
- `package-lock.json`

Change the product version when delivered `webui/**` product content changes. Repository-only documentation, tests, CI and tooling changes do not require a product version change unless they intentionally change the product version contract.

## Source Identity

Builds and validation evidence are tied to an exact Git SHA. Do not treat a successful run from another commit as proof for current bytes when the changed boundary is relevant.

## Documentation

Public developer documentation is English and describes current behavior. Keep historical implementation notes in Git history rather than adding milestone-specific current docs.

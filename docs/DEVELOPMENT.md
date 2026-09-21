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

## Generated Files

Do not treat generated runtime data as hand-maintained configuration.

If a file under `webui/private/data/` or `tools/data/` is generated or frozen evidence, update it through the responsible tool and validate its identity/provenance.

## Product Versioning

The product version is mirrored in:

- `VERSION`
- `webui/VERSION`
- `package.json`
- `package-lock.json`

Change the product version when delivered `webui/**` product content changes. Repository-only documentation, tests, CI and tooling changes do not require a product version change unless they intentionally change the product version contract.

## Source Identity

Builds and validation evidence are tied to an exact Git SHA. Do not treat a successful run from another commit as proof for current bytes when the changed boundary is relevant.

## Documentation

Public developer documentation is English and describes current behavior. Keep historical implementation notes in Git history rather than adding milestone-specific current docs.

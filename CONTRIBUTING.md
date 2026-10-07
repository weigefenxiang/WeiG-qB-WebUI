# Contributing

Contributions should preserve the repository's ownership boundaries and source-derived compatibility model.

## Branches

Development work targets `dev`. `main` is the stable release branch.

Keep changes focused. Do not mix unrelated product, compatibility, documentation and cleanup work in the same change unless they are required for one coherent contract.

## Setup

Requirements:

- Node.js 22
- npm
- Git
- Chrome for hosted-browser-equivalent local checks when browser tests are needed
- Docker only for real-qB and installer scenarios that require it

Install dependencies with:

```sh
npm ci
```

Run the default contract suite with:

```sh
npm test
```

Run simulator-focused contracts with:

```sh
npm run test:simulator
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) and [tests/README.md](tests/README.md) for deeper workflows.

## Engineering Rules

1. Keep one active owner for each semantic responsibility.
2. Do not make presentation modules own qB transport, polling or business state.
3. Do not add version-specific product branches when the behavior can be source-derived.
4. Do not bypass shared Select, Dialog, table, feedback or state primitives with feature-local copies.
5. Keep unknown or unproven mutation paths read-only.
6. Preserve exact-SHA build and validation identity.
7. Keep the production WebUI independent of simulator runtime code.
8. Treat generated compatibility data as outputs of canonical tools, not hand-maintained truth.
9. When a shared family is wrong, fix the shared owner and add a regression contract rather than patching one screenshot or one preference key.
10. Prefer bounded, deterministic runtime data over loading full historical catalogs in the browser.

## Product Versioning

The product version is mirrored in `VERSION`, `webui/VERSION`, `package.json` and `package-lock.json`.

Increment the product version when delivered `webui/**` product content changes. Repository-only documentation, tests, CI or tooling changes do not require a product version bump unless they intentionally alter the product version contract.

## Generated Data

Files under `webui/private/data/` and some frozen files under `tools/data/` are produced or validated by repository tools. Before editing one directly, identify its canonical generator in [tools/README.md](tools/README.md).

Generated output and its source evidence must move together.

## Tests

Every change should run the smallest relevant focused contracts first. Before release-grade promotion, the repository uses broader browser, compatibility and real-qB validation.

Examples:

- WebUI state or UI ownership → relevant contract + browser test.
- Settings changes → Settings contracts, source/projection tests and browser Settings checks.
- Compatibility parser/compiler changes → source contracts, compact-runtime contracts and affected stable-release checks.
- Simulator changes → `npm run test:simulator`.
- Installer changes → installer lifecycle contracts.
- Workflow/release changes → CI/release contract tests.

## Documentation

Public developer and architecture documentation is English and describes current behavior. User-facing README and installation-guide translations live under `translations/`; runtime qB translation assets remain separate under `webui/translations/`. Historical implementation notes and completed work logs do not belong in the current documentation tree.

Update the nearest subsystem documentation when an architectural boundary changes.

## Commits

Use short English commit messages that describe the resulting change, for example:

```text
webui: unify locale option ownership
tests: cover dialog ownership boundaries
docs: document compatibility pipeline
```

Avoid version-history narratives in current documentation; Git history already records completed changes.

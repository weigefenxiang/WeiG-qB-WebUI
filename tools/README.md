# Tooling Guide

`tools/**` contains build-time and validation utilities. These tools transform qB source/release evidence into bounded compatibility data consumed by the WebUI, simulator and tests.

## 1. Main Tool Families

### Release and catalog

Examples:

- `qb-release-tags.mjs`
- `qb-release-catalog*.mjs`
- `qb-stable-admission.mjs`
- `qb-catalog-identity.mjs`
- `qb-catalog-evolution.mjs`

These tools discover/admit stable releases, preserve source identity and build the frozen release evidence used by downstream compilers.

### Source parsers

Examples:

- `qb-source-parsers.mjs`
- `qb-torrent-surface-parsers.mjs`
- `qb-detail-surface-parsers.mjs`
- `qb-action-surface-parsers.mjs`
- `qb-torrent-fields-parser.mjs`

Parsers extract semantic facts from exact qB source. They should expose generic source semantics rather than encode product-version special cases.

### Settings and preferences

Examples:

- `qb-preferences-*.mjs`
- `qb-preference-semantics.mjs`
- `qb-settings-native-bundle.mjs`
- `qb-settings-runtime-rebind.mjs`

These tools derive preference inventory, source structure, value projection, writeability and compact runtime material.

### Locale and qB-owned copy

Examples:

- `qb-locale-source.mjs`
- `qb-locale-overlay.mjs`
- `qb-source-text.mjs`
- `qb-qbt-owned-string-inventory.mjs`
- `qb-qm-provisioning-source.mjs`
- `qb-settings-translation-*.mjs`

`qb-source-text.mjs` is the shared source-text canonicalization boundary. Consumers should reuse it instead of creating independent HTML/XML/entity decoders for qB translation identity.

### RSS

Examples:

- `qb-rss-surface-source.mjs`
- `qb-rss-source-overlay.mjs`
- `qb-rss-compact.mjs`

These tools compile RSS source facts into bounded runtime compatibility data.

### Runtime compilation and distribution

- `qb-compact-runtime.mjs` compiles bounded runtime contracts.
- `qb-webui-catalog.mjs` materializes WebUI compatibility assets.
- `build-webui-dist.mjs` creates the self-contained WebUI ZIP and identity/checksum files.
- `product-identity.mjs` validates canonical product identity.

## 2. Frozen Data

`tools/data/` contains frozen evidence required by repeatable builds and validation.

Current examples:

- `qb-stable-lkg.json`
- `qb-locale-lkg.json`
- `qb-translator-behavior-lkg.json`
- `qb-webapi-evolution-ledger.json`

These files are not generic hand-edited configuration. Update them through the responsible admission/materialization workflow and verify their identity relationships.

## 3. Generated Production Data

The production runtime consumes compact outputs under `webui/private/data/`.

A typical flow is:

```text
exact qB source
  -> parser/source tool
  -> frozen evidence
  -> compact compiler
  -> webui/private/data/*
  -> runtime owner
```

Do not hand-edit a generated production file to work around a browser symptom. Fix the source fact, parser, compiler or runtime consumer that owns the incorrect behavior.

## 4. Identity Rules

Source-derived outputs should preserve enough identity to prove which admitted release/source set produced them.

Mixed stale domains are unsafe: a current capability index must not silently combine with Settings/RSS/detail data compiled from a different admitted source set.

Where a tool family supports a shared catalog identity, downstream contracts should fail closed on mismatches.

## 5. Tool Design Rules

- Parse exact source; do not guess behavior from patch numbers when source evidence is available.
- Keep one canonical parser/canonicalizer for each semantic family.
- Preserve provenance when deduplicating repeated facts.
- Separate source identity from display text.
- Keep production artifacts bounded; full historical catalogs belong to tooling/validation.
- Prefer deterministic output suitable for exact-SHA verification.
- Add a focused contract when introducing or changing a compiler rule.

## 6. Adding a Tool

Before adding a new script, check whether an existing parser/compiler family already owns the responsibility.

A new tool should have:

1. one clearly defined input/source authority,
2. deterministic output,
3. provenance/identity where relevant,
4. a consuming runtime/test/build responsibility,
5. a focused contract.

Tools that produce no product, validation or build consumer should not become permanent repository subsystems.

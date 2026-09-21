# qBittorrent WebAPI Evolution

WeiG qB WebUI tracks WebAPI evolution as source/release evidence rather than scattering historical conditionals through product code.

## Data Source

The frozen ledger is stored at:

```text
tools/data/qb-webapi-evolution-ledger.json
```

The canonical tooling includes:

- `tools/qb-webapi-evolution.mjs`
- `tools/qb-webapi-evolution-audit.mjs`
- `tests/qb-webapi-evolution-contract.mjs`

## Purpose

The ledger records protocol evolution needed to interpret release behavior, such as:

- endpoint availability,
- parameter changes,
- response-shape changes,
- status/behavior milestones,
- modern API behavior and bounded supplements.

It is validation/source evidence. Product presentation code should consume the resulting capability/action semantics rather than inspect this ledger directly.

## Update Rule

When qB upstream changes an API surface:

1. identify the exact release/source evidence,
2. update the canonical evolution/source tooling,
3. update frozen evidence if required,
4. regenerate or revalidate affected compact domains,
5. add or update focused contracts,
6. validate the affected WebUI consumer.

Do not add a feature-local patch-number branch when the change belongs to the shared compatibility model.

## Relationship to Runtime Compatibility

WebAPI milestones are one source of compatibility evidence, but they do not replace exact source-derived feature facts.

A protocol milestone may establish that an endpoint exists. UI availability, source actions, Settings projections or qB-owned copy may require additional domain-specific evidence.

See [COMPATIBILITY.md](COMPATIBILITY.md) for the complete runtime model.

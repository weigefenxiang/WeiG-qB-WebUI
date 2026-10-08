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

## Safe Evolution Across Versions

Exact runtime qB version and WebAPI version are distinct from per-domain compatibility. Unknown future releases must not be globally aliased to a nearby version. A previously proven compatible WebAPI operation can be inherited only when the exact source action, parameters, semantics, dependencies and runtime identity permit it.

Read-only operations (including source-proven read-semantic POST such as `clientdata/load`) must not be blocked merely because the HTTP method is POST. Previously proven `torrents/add` may be admitted through a bounded operation-specific compatibility relation; destructive actions and unknown writes remain fail-closed. A matching WebAPI version alone does not prove equivalent native UI labels, Copy/QM, Detail, RSS or Settings semantics.

When admitting a new stable qB release, build fresh official-source evidence, require explicit exact SHA and successful source run in the manual stable-admission workflow, and preserve all previously certified historical assets.

## Relationship to Runtime Compatibility

WebAPI milestones are one source of compatibility evidence, but they do not replace exact source-derived feature facts.

A protocol milestone may establish that an endpoint exists. UI availability, source actions, Settings projections or qB-owned copy may require additional domain-specific evidence.

See [COMPATIBILITY.md](COMPATIBILITY.md) for the complete runtime model.

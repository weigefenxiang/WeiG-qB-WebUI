# Compatibility Model

WeiG qB WebUI uses source-derived compatibility rather than maintaining a large set of product-side version checks.

## Supported Catalog

The frozen stable catalog starts at qBittorrent `4.1.0`.

The verified 1.1.29 development baseline admits **66 frozen stable profiles through qBittorrent `5.2.4`**. The source-of-truth for the current count and latest release is **not this prose**; always read `profileCount` and `latestAdmittedStable` from:

- `tools/data/qb-stable-lkg.json`
- `tools/data/qb-locale-lkg.json`

These files are validated inputs, not browser runtime catalogs.

qBittorrent 4.0.x and earlier are outside the current implementation and CI support scope.

Future stable or new-major releases are not rejected solely by their major version. They enter the supported catalog through source-derived admission, compatibility comparison and validation.

## Domain-Specific Compatibility

Detected qBittorrent version and feature compatibility are related but not identical concepts.

A runtime may resolve a compatibility relation independently for domains such as:

- Torrent list/filter/fields,
- Torrent detail,
- Settings,
- RSS,
- source actions,
- locale/qB-owned copy.

A compatible Settings relation does not automatically prove an equivalent Detail, Torrent, RSS or translation relation.

The production resolver is `W.CapabilityRegistry`.

## Compact Runtime Contracts

The browser consumes bounded domain data under `webui/private/data/`:

| File | Role |
| --- | --- |
| `capabilities.json` | Release identity, high-level gates and compact domain index. |
| `torrent-compat.json` | Torrent field/filter/list compatibility. |
| `detail-compat.json` | Detail surface descriptors and source facts. |
| `settings-compat.json` | Settings structure, preference semantics and write projections. |
| `rss-compat.json` | RSS compatibility. |
| `source-actions.json` | Source-proven action availability. |
| `qb-copy-routes/<routeId>.json.gz` | Source-certified semantic Copy route selected by the exact release `copyRouteId`. |
| `qb-copy-bindings/<bindingId>.txt` | Shared deduplicated source/context bindings. |
| `qb-copy-fallback/<packId>.json.gz` | Optional content-addressed fallback pack for the selected current locale, only when native QBT_TR/QM is unavailable. |

The complete historical source catalog remains outside the production runtime.

## Certified Source Materialization and Frozen Identity

The admitted `qbVersion + sourceSha` inventory is immutable for historical releases. Enriched extraction may add source facts, but it must not relabel a different JSON hash as a different certified release set. `tools/qb-catalog-identity.mjs` and the frozen manifest provide one canonical `catalogIdentity` for `capabilities.json`, Torrent/Action, and Detail runtime facts.

Both CI and Pages Source materializers must preserve certified historical Copy routes, bindings and fallback packs. The Copy admission owner (`tools/qb-runtime-copy-admission.mjs`) checks or appends certified assets; it must not delete and regenerate the historical tree. Detail source facts and compiled identity are verified together.

The exact upstream source can support historical UI features even if an older compact snapshot omitted their descriptors. Official Statistics, status filters, special Tag rows (including Untagged), and locale inventories are source-extracted and consumed by the product's existing capability/UI owners. Do not silence an absent UI by moving a regression fixture to a newer qB version.

## Read and Write Policy

Reading can degrade when a source shape is incomplete.

Writes are stricter. A mutating path must prove the relevant combination of:

- runtime identity,
- source action/setter,
- current preference/action presence,
- parameter/value projection,
- compatible type/shape,
- required dependencies,
- safe-write classification.

Unknown or unproven mutations remain unavailable.

## Settings

Settings runtime structure is intersected with the current `GET /api/v2/app/preferences` response.

The source pipeline models semantic projections such as:

- direct identity values,
- scaled values,
- switch mappings,
- compound mappings,
- boolean/select mappings,
- sentinel/presence gates,
- structured values,
- unproven/read-only shapes.

Compound UI families are derived from source structure instead of preference-key-specific UI patches.

## Locale

The persisted `app/preferences.locale` value is the current locale, not the complete set of supported locales.

Locale options combine exact source/native inventory with trustworthy runtime information. Partial runtime probes do not replace a complete source-derived set.

The runtime also uses official qB WebUI QM assets under `webui/translations/`.

WeiG-owned presentation copy has one runtime owner: `W.I18n` in `webui/private/scripts/i18n.js`. Feature modules consume translation keys; they must not maintain feature-local English/Simplified-Chinese pairs or branch visible copy on `zh-CN`. The product runtime set is English, Simplified Chinese, Traditional Chinese (Taiwan and Hong Kong), Japanese, Korean, German, French, Spanish, Portuguese and Russian, and every WeiG runtime key must preserve the same interpolation placeholders across that set.

qB-owned visible copy remains a separate source-truth path: exact source text / compact qB-owned copy evidence and official QM assets stay authoritative for native qB labels. WeiG presentation translations must not replace or guess native qB copy.

## Source Text and Translation Identity

qB source text may pass through HTML, XML, CDATA or entity encoding layers.

`tools/qb-source-text.mjs` is the shared canonicalization owner for source-text identity used by translation/copy tooling. Independent decoders should not be introduced for the same semantic family.

## WebAPI Evolution

WebAPI changes are tracked as source/release evidence and audited by the tooling/tests rather than copied into feature-local conditionals.

See [WEBAPI-EVOLUTION.md](WEBAPI-EVOLUTION.md).

## Validation

Compatibility evidence is layered:

1. parser/source contracts,
2. frozen catalog and compact-runtime contracts,
3. simulator/browser checks,
4. Pages materialization/live validation,
5. real-qB checks,
6. release-grade validation.

The appropriate evidence layer depends on what changed. A parser test does not replace an affected browser interaction test, and a simulator result does not replace real-qB validation for daemon-specific behavior.

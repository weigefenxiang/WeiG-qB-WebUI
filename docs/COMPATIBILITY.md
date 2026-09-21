# Compatibility Model

WeiG qB WebUI uses source-derived compatibility rather than maintaining a large set of product-side version checks.

## Supported Catalog

The frozen stable catalog starts at qBittorrent `4.1.0`.

The current repository snapshot admits stable profiles through `5.2.3` with 65 frozen stable profiles. The authoritative current values live in:

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
| `qb-settings-native.txt` | Compact qB-owned copy/translation registry. |

The complete historical source catalog remains outside the production runtime.

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

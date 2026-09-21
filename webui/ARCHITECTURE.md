# WebUI Architecture

`webui/**` is the production qBittorrent Alternate WebUI. It must remain self-contained and deployable without the simulator.

## 1. Directory Layout

```text
webui/
├── public/          unauthenticated/login surface
├── private/         authenticated application shell and runtime
│   ├── assets/
│   ├── css/
│   ├── data/        compact compatibility/runtime contracts
│   ├── scripts/     browser modules
│   ├── views/
│   ├── index.html
│   └── product-identity.json
├── translations/    official qB WebUI QM assets required by runtime locale handling
├── VERSION
└── GIT_SHA
```

The distribution builder replaces the source SHA placeholder and emits the exact `GIT_SHA` used for the package.

## 2. Bootstrap Boundary

`private/index.html` owns the initial private-shell asset transport order.

Dependency-bearing scripts load in a deterministic order. A failed prerequisite must stop later execution and surface a deterministic bootstrap failure instead of allowing a partially initialized application.

Bootstrap owns initial asset transport only. Authentication, qB API semantics and feature state stay with their semantic modules.

## 3. Transport and Runtime Identity

### `qb-client.js`

`W.QBClient` owns qB WebAPI transport and detected qB/WebAPI identity.

Feature modules call methods on the shared client. They do not create independent HTTP clients for qB behavior.

### `capabilities.js`

`W.CapabilityRegistry` owns runtime compatibility resolution and lazy loading of compatibility domains.

The runtime resolves domain-specific facts rather than assuming that one qB version relation proves every feature family.

Primary compact inputs:

- `private/data/capabilities.json`
- `private/data/torrent-compat.json`
- `private/data/detail-compat.json`
- `private/data/settings-compat.json`
- `private/data/rss-compat.json`
- `private/data/source-actions.json`

Unknown or unproven mutating behavior fails closed.

## 4. Application State

`app.js` coordinates application startup and route-level consumers. It does not replace feature owners.

Important shared owners include:

| Owner | Responsibility |
| --- | --- |
| `W.VirtualList` | Virtual projection and scroll lifecycle for large list/table surfaces. |
| `W.Selection` | Torrent selection state and selection-driven actions. |
| `W.PreferenceTransaction` | Settings interaction, draft projection, verified preference writes and self-affecting handoff. |
| `W.SettingsSchema` | Source-derived Settings structure and writeability semantics. |
| `W.SettingsRenderer` | Settings DOM projection from the canonical schema. |
| `W.I18n` | Runtime locale, qB-owned text and locale option resolution. |
| `W.ActionRegistry` | Source action availability: loading, available, unsupported or error. |
| `W.DialogRuntime` | Shared modal lifecycle and desktop drag behavior. |
| `W.ColumnConfigurator` | Shared table column configuration presentation. |
| `W.RSSRules` | RSS rule collection/editing state. |
| `W.TransferRuntime` | Transfer runtime/history presentation state. |
| `W.Theme` | Theme preference/resolution. |

A module should consume the current owner instead of recreating equivalent state or lifecycle behavior.

## 5. Settings

Settings are driven by the current qB preference response intersected with source-derived runtime structure.

```text
GET /api/v2/app/preferences
        │
        ├─ current values
        ▼
W.SettingsSchema
        ▲
        │ settings-compat.json
        │ source-derived control graph / projections / gates
        ▼
W.SettingsRenderer
        │
        ▼
W.PreferenceTransaction
        │ verified safe writes
        ▼
W.QBClient.setPreferences()
        │
        └─ reread and promote verified state
```

The renderer does not infer writeability from a visible control. A mutation must pass the canonical write-safety gate.

Compound source structures are represented as reusable semantic families. For example, a time range is modeled as one semantic family and round-tripped to its raw preference fields rather than implemented as a preference-key-specific UI patch.

## 6. Locale and qB-Owned Text

`app/preferences.locale` is the persisted qB locale value. It is not, by itself, the complete supported locale inventory.

`W.I18n` combines exact source/native locale inventory with trustworthy runtime information. Partial runtime probes do not shrink a complete source-derived inventory.

qB-owned labels are resolved from the compact registry and official QM assets. Runtime lookup identity is based on canonical source/context semantics so encoding differences do not silently force English fallback when an official translation exists.

## 7. Torrent Workspace

Torrent list, filters, detail surfaces, selection and actions are separated by responsibility:

- `torrent-semantics.js` — shared torrent semantic interpretation.
- `torrent-fields.js` — source-derived field presentation.
- `torrent-filter-view.js` — filter projection.
- `selection.js` — selection/actions.
- `ui.js` and `layout.js` — shared detail/table projection.
- `spatial.js` — responsive/sidebar spatial presentation.

Virtualized surfaces keep one scroll owner. During active scrolling, a newer data snapshot may be buffered and committed after interaction settles instead of replacing the DOM underneath the user.

## 8. Shared Interaction Primitives

- `components.js` — canonical shared controls, including Select.
- `dialog-runtime.js` — modal lifecycle.
- `column-configurator.js` — column configuration.
- `floating.js` — floating-layer geometry.
- `feedback.js` — transient feedback.
- `navigation.js` — route navigation/module loading.

Feature modules may own labels, business mapping and content. They do not own parallel shared-control lifecycles.

## 9. Responsive Presentation

`responsive.js`, `spatial.js` and layout modules adapt the same application state to available space.

Mobile is not a second application. It reuses the same qB client, compatibility facts, selection, Settings draft and business state.

## 10. Adding or Changing a Feature

Before adding a new runtime path:

1. Identify the current semantic owner.
2. Confirm whether the feature is source-bound.
3. If compatibility facts are missing, update the appropriate source/tooling pipeline first.
4. Keep mutation paths read-only until exact action/parameter/value semantics are proven.
5. Reuse shared interaction primitives.
6. Add focused contracts for the owner boundary.
7. Add browser coverage when the change affects user interaction or final presentation.
8. Update this document when the ownership map changes.

See [../ARCHITECTURE.md](../ARCHITECTURE.md) for repository-wide boundaries and [../docs/COMPATIBILITY.md](../docs/COMPATIBILITY.md) for compatibility policy.

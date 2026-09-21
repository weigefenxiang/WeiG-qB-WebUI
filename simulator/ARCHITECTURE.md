# Simulator Architecture

The simulator is a deterministic development and validation environment for WeiG qB WebUI. It models qB WebAPI behavior and release-specific surfaces without becoming a production dependency.

## 1. Boundary

```text
production:  qBittorrent ──WebAPI──> webui/
validation:  simulator/ ──modeled API──> webui/
```

The simulator may reuse source-derived compatibility facts and product assets for validation. Production `webui/**` must never import simulator runtime modules.

## 2. Directory Layout

```text
simulator/
├── core/            virtual qB world and product-facing behavior
├── protocol/        endpoint routing and transport contracts
├── preferences/     preference schema, bindings, values and migration
├── storage/         persisted virtual-world/cache state
├── versions/        bounded version/profile bootstrap data
├── service-worker/  browser interception layer used by Virtual qB Pages
├── build/           Pages/site assembly
└── lab/             developer-facing Virtual qB Lab
```

## 3. Core Runtime

`core/engine.js` coordinates the virtual world.

The core layer owns modeled state and operations such as:

- torrent add/actions/query/content/metadata,
- transfer controls,
- peer and web-seed views,
- application services,
- network and low-power behavior,
- scenario/world profiles,
- session identity.

Core modules model qB behavior; they do not patch production WebUI code.

## 4. Protocol Layer

`protocol/router.js` and related modules map incoming requests to modeled endpoint behavior.

`endpoint-contracts.js` expresses endpoint semantics, while `upstream-gates.js` constrains behavior based on source-derived compatibility facts.

The protocol layer is responsible for request/response semantics, not UI presentation.

## 5. Preferences

The `preferences/` subsystem separates:

- schema/type knowledge,
- default values,
- runtime bindings,
- persistence,
- migration,
- resolution/fallback behavior.

This lets tests model Settings differences across admitted qB releases without embedding preference-version branches in production UI code.

## 6. Version Profiles

`versions/` contains bounded bootstrap/version profile material used by the simulator. The full admitted source catalog is generated or materialized by build/CI tooling rather than maintained as a browser production dependency.

Version profiles are test inputs, not a second production compatibility owner.

## 7. Storage

`storage/indexeddb.js` and `storage/world-cache.js` preserve simulator state where required by browser scenarios.

Cache identity is tied to the relevant build/source identity so stale simulator state does not silently validate different product bytes.

## 8. Service Worker

Virtual qB Pages uses `service-worker/service-worker.js` to intercept the app's network traffic and provide modeled qB responses.

The service worker is a validation transport boundary. It must preserve browser-visible request semantics closely enough for product browser tests to exercise the same WebUI code used against real qBittorrent.

## 9. Build Pipeline

`build/build-pages.mjs` assembles one branch-specific virtual app.

`build/build-site.mjs` assembles the Pages site, including:

- branch apps,
- Virtual qB Lab,
- simulator metadata,
- the development distribution payload,
- source-derived validation metadata.

The production source tree is copied into the virtual app; simulator adaptation must not mutate the original `webui/**` source.

## 10. Validation Role

The simulator is useful for:

- deterministic browser regression tests,
- release/profile routing checks,
- Settings and locale coverage,
- endpoint behavior,
- responsive/mobile acceptance,
- Pages live validation.

It does not replace real-qB validation for behaviors that depend on qB's real static-file server, authentication lifecycle, native translation behavior or daemon implementation details.

See [../tests/README.md](../tests/README.md) for test layers and [../docs/COMPATIBILITY.md](../docs/COMPATIBILITY.md) for the compatibility model.

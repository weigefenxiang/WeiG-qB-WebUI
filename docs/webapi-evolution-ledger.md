# qBittorrent WebAPI evolution ledger

Phase C established the full supported WebAPI chronology and classification ledger before Phase D changed runtime behavior. Phase D now consumes that ledger deliberately, one evidence-backed batch at a time.

The machine-readable source of truth is:

```text
tools/data/qb-webapi-evolution-ledger.json
```

Audited support window:

```text
qBittorrent 4.1.0 / WebAPI 2.0.0
-> qBittorrent 5.2.3 / WebAPI 2.15.1
```

The current stable matrix contains **65 official stable qBittorrent profiles**. Alpha/Beta/RC/master do not enter the formal stable matrix. Upstream master may expose newer WebAPI revisions, but those revisions do not automatically expand the audited semantic ceiling.

## 1. Terminal classifications

Each observable change must end in one of four terminal classifications:

- `SOURCE_DERIVED`: the source-derived release catalog already owns the structural fact, such as endpoint, Preference, filter or parameter-surface evolution.
- `CONTRACT_COVERED`: a canonical semantic owner models the observable boundary. By default this is Endpoint Contract; transport changes may explicitly name `simulator/protocol/transport-contract.js`.
- `MISSING`: upstream evidence identifies observable behavior not yet modeled by the current simulator contract. These items are the active Phase D backlog.
- `NOT_APPLICABLE`: chronology/evidence exists, but there is no equivalent WebUI-observable runtime responsibility in the simulator architecture.

`UNCLASSIFIED` is deliberately not a terminal ledger code. Validation fails if evidence cannot be mapped to one of the four outcomes.

## 2. Completeness gates

Completeness is checked independently in several ways:

1. **Stable revision spine.** Every supported stable qB profile reports a WebAPI revision present in the ledger. A future stable revision above the audited ceiling fails closed.
2. **Modern changelog coverage.** Every upstream `WebAPI_Changelog.md` PR from WebAPI 2.11.6 through 2.15.1 must have exactly one ledger entry; missing or invented PR evidence fails validation.
3. **Evidence anchors.** Source-commit entries verify exact upstream commit/API_VERSION; release-changelog entries and same-version supplements verify evidence inside the matching qB release history.
4. **Owner classification.** `CONTRACT_COVERED` must resolve to one canonical owner. Endpoint semantics default to `endpoint-contracts.js`; HTTP/transport semantics can explicitly override to `transport-contract.js`.

Stable releases can change observable WebAPI behavior without increasing `API_VERSION`. Those changes remain explicit `supplements`, not silent inheritance from the WebAPI number. Examples include qB 4.4.4 HTTP-method handling, qB 5.2.1 API result-buffer lifetime and qB 5.2.2 X-Forwarded-Host behavior.

## 3. Phase C baseline — COMPLETE

Phase C initial classification result:

```text
65 supported official stable profiles
77 evidence entries
117 classified changes
SOURCE_DERIVED = 37
CONTRACT_COVERED = 6
MISSING = 60
NOT_APPLICABLE = 14
UNCLASSIFIED = 0
modern WebAPI changelog PRs = 26
```

Phase C was classification-first: `MISSING` was intentionally allowed; `UNCLASSIFIED` was not.

## 4. Phase D current result — ACTIVE

Current ledger after the completed Phase D batches:

```text
77 evidence entries
120 classified changes
SOURCE_DERIVED = 38
CONTRACT_COVERED = 17
MISSING = 50
NOT_APPLICABLE = 15
UNCLASSIFIED = 0
```

Phase D has therefore reduced the explicit backlog from **60 MISSING -> 50 MISSING** while preserving the chronology/evidence spine and `UNCLASSIFIED=0` hard gate.

The increase from 117 to 120 classified changes reflects evidence being split into more precise observable subchanges where necessary; it is not a relaxation of the audit.

## 5. Completed Phase D closures

### 5.1 `sync/maindata.use_subcategories`

Upstream qB 4.5.x has no field. qB 4.6.0 / WebAPI 2.9.2 introduces `app/preferences.use_subcategories` and projects the same session value into `sync/maindata`; WebAPI 2.15.0 removes the sync field because subcategories become unconditional.

Ownership remains split correctly:

```text
Preference surface/value truth -> source-derived Preference pipeline
sync response lifecycle          -> Endpoint Contract
```

### 5.2 Early `sync/maindata` response evolution

- WebAPI 2.1.0 changes `categories` from ordered names to a name-keyed details map.
- WebAPI 2.1.1 introduces `server_state.free_space_on_disk`.

Endpoint Contract now owns these boundaries and runtime projection consumes the contract instead of recreating version checks in core.

### 5.3 Tracker semantics — WebAPI 2.13.0

Closed items include:

- tracker timing/endpoints response boundary;
- status values 5 and 6, with legacy projection back to status 4 before 2.13.0;
- `editTracker` tier/url/success semantics, including success 204.

### 5.4 `torrents/parseMetadata` — WebAPI 2.13.0

Existing runtime behavior was migrated from auxiliary-owned `apiAtLeast('2.13.0')` logic into Endpoint Contract ownership:

```text
legacy -> object
2.13.0+ through audited ceiling -> request-order array
future unclassified revision -> fail closed
```

### 5.5 PR #23202 — WebAPI 2.14.0

The PR was split into independent observable subchanges instead of being marked covered as a single opaque item:

- unknown endpoint returns `Endpoint does not exist`;
- `auth/login` success becomes 204 No Content and invalid credentials return 401 Unauthorized;
- `torrents/add` returns structured result with 200/202/409 semantics.

Legacy behavior remains explicit rather than overwritten by the modern projection.

### 5.6 Basic Auth — WebAPI 2.15.0

Basic Auth is an HTTP transport rule, not endpoint-domain semantics. It is therefore `CONTRACT_COVERED` with explicit owner:

```text
simulator/protocol/transport-contract.js
```

The Service Worker/transport adapter consumes this rule. Router/core must not duplicate it.

### 5.7 `sync/torrentPeers.host_name` — WebAPI 2.15.1

Endpoint Contract owns field presence. Peer projection owns deterministic value generation. The caller receives the contract explicitly and does not retain the revision boundary.

### 5.8 qB 5.2.1 result-buffer lifetime — NOT_APPLICABLE

Upstream fixed `APIController` result storage between calls. The Virtual qB simulator constructs a fresh JavaScript `Response` per request and has no persistent `m_result`-equivalent member. No runtime shim is justified, so the evidence is classified `NOT_APPLICABLE` rather than fabricating nonexistent state.

### 5.9 qB 5.2.2 X-Forwarded-Host gate

qB 5.2.2 keeps WebAPI 2.15.1 but changes transport behavior: `X-Forwarded-Host` is trusted only when reverse proxy support is enabled.

This is a same-WebAPI-version supplement and is owned by Transport Contract with an exact qB patch boundary.

## 6. Current owner map

```text
NEW/REMOVED endpoint -> apiActions/source catalog
PREFERENCE          -> Preference source pipeline
TORRENT_SURFACE     -> Torrent surface parser/catalog
PARAM/RESPONSE/
STATUS/MUTATION     -> Endpoint Contract
TRANSPORT           -> Transport Contract
NOT_APPLICABLE      -> audited ledger only
```

`CONTRACT_COVERED` does not mean “put all version logic in one file”. It means one canonical owner is explicitly named and tested.

## 7. Phase D working rules

Phase D consumes `MISSING` intentionally. It must not infer that behavior existed in every older version merely because a later removal/change boundary is already covered.

Every batch follows:

```text
upstream evidence
-> classify owner
-> model complete lifecycle
-> direct/runtime/ownership tests
-> ledger transition
-> candidate full upstream audit
-> SAFE-REF fast-forward
-> final exact-SHA CI / Upstream / Pages live
```

Rules:

- do not reintroduce scattered `apiAtLeast()` in router/core for migrated facts;
- do not treat a higher unknown revision as inheriting the final audited behavior;
- do not mark an entire PR covered when only one observable subchange is implemented;
- do not fabricate simulator state to turn an internal upstream implementation fix into `CONTRACT_COVERED`;
- stale tests using future WebAPI 2.16.x profiles are corrected back to the audited 2.15.1 ceiling unless the test is explicitly about future fail-close behavior.

## 8. Remaining backlog

Current explicit backlog: **50 MISSING**.

The next recommended cluster is Transport / HTTP history, because the Transport Contract owner now exists and can absorb the appropriate historical boundaries without polluting Endpoint Contract:

- qB 4.4.4 wrong HTTP method -> 405;
- qB 4.5.0 / WebAPI 2.8.18 status handling correction;
- qB 4.6.0 configurable session cookie name;
- qB 4.6.0 HTTP HEAD response behavior;
- qB 5.0.x binary filename/MIME transport details;
- qB 5.0.4 generic string parameters stop being trimmed.

Each item must still be checked individually: if upstream evidence shows it is endpoint-specific or domain mutation behavior, it belongs to Endpoint Contract or another domain owner instead.

After the transport cluster, the next likely grouping is Torrent/request/mutation semantics: historical add parameters, file priority multi-id/error semantics, rename/path changes, removeTracker no-reannounce, and other request/response fields still explicitly marked `MISSING`.

## 9. Future revisions

A new official stable release enters the source catalog automatically, but semantic certification does not.

```text
new stable tag
-> structural source profile
-> WebAPI revision/spine comparison
-> supplement/evolution audit
```

If the revision is above **2.15.1** or contains an unclassified semantic delta, the audit fails closed until evidence, classification and canonical ownership are added.

The public contract interfaces intentionally hide the internal evidence store so audited tables can later evolve into generated semantic catalogs without changing callers.

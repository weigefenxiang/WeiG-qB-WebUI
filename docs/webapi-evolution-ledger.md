# qBittorrent WebAPI evolution ledger

Phase C established the supported WebAPI chronology/classification ledger. It remains an important **evidence index for product compatibility**, but from Phase E onward it is no longer the product roadmap by itself.

Machine-readable source of truth:

```text
tools/data/qb-webapi-evolution-ledger.json
```

Current audited WebAPI v2 window:

```text
qBittorrent 4.1.0 / WebAPI 2.0.0
-> qBittorrent 5.2.3 / WebAPI 2.15.1
```

Current source-derived matrix: **65 official stable profiles**. Alpha/Beta/RC/master do not enter the formal stable matrix.

## 1. Why the ledger exists

The ledger answers:

```text
What changed in upstream WebAPI history?
Where is the evidence?
Which current owner models that change?
Is the change still unmodeled?
```

It does **not** directly answer:

```text
Is WeiG webui/** compatible with every qB4/qB5 feature?
```

That second question belongs to Phase E product compatibility audit.

## 2. Terminal classifications

- `SOURCE_DERIVED`: source catalog owns the structural fact.
- `CONTRACT_COVERED`: current simulator canonical contract models the audited observable boundary.
- `MISSING`: evidence identifies behavior not yet modeled in simulator/evolution infrastructure.
- `NOT_APPLICABLE`: no equivalent simulator runtime responsibility is justified.

`UNCLASSIFIED` is forbidden and remains a hard failure.

Important: `CONTRACT_COVERED` here usually means **simulator/evidence coverage**, not automatically “formal `webui/**` product compatibility complete”.

## 3. Current statistics

```text
65 supported official stable profiles
77 evidence entries
120 classified changes
SOURCE_DERIVED = 38
CONTRACT_COVERED = 17
MISSING = 50
NOT_APPLICABLE = 15
UNCLASSIFIED = 0
modern WebAPI changelog PRs = 26
```

Phase C initial baseline was:

```text
117 classified changes
SOURCE_DERIVED = 37
CONTRACT_COVERED = 6
MISSING = 60
NOT_APPLICABLE = 14
UNCLASSIFIED = 0
```

The increase to 120 reflects more precise splitting of observable subchanges.

## 4. Phase D completed historical closures

Important completed simulator/evidence work includes:

- `sync/maindata.use_subcategories` lifecycle；
- `sync/maindata.categories` 2.1.0 shape change；
- `free_space_on_disk` 2.1.1；
- trackers timing/status 5/6 2.13.0；
- `editTracker` 2.13.0；
- `parseMetadata` 2.13.0；
- PR #23202: missing endpoint / login / `torrents/add` 2.14.0；
- Basic Auth 2.15.0；
- `sync/torrentPeers.host_name` 2.15.1；
- qB 5.2.1 API result-buffer lifetime -> `NOT_APPLICABLE`；
- qB 5.2.2 X-Forwarded-Host gate。

These remain useful because they let Virtual qB reproduce historical upstream behavior accurately.

## 5. Phase E changes how MISSING is prioritized

Current `MISSING = 50` must not be consumed mechanically.

Before implementing a ledger item, first determine its relationship to formal `webui/**`:

```text
PRODUCT_BLOCKER
  current WeiG feature breaks/fails on some real stable qB

PRODUCT_NORMALIZATION
  feature exists but request/response/state differs and product needs normalization

PRODUCT_EMULATION
  old qB lacks a direct modern API but WeiG can reliably implement equivalent behavior

UNAVOIDABLE_PRODUCT_GAP
  real qB lacks required data/ability and no reliable equivalent exists

SIMULATOR_ONLY / UNUSED_BY_PRODUCT
  WeiG webui/** does not currently consume the behavior
```

Priority order follows product impact, not ledger order.

## 6. Product-first use of evidence

New workflow:

```text
ledger/upstream delta
-> map to webui/** feature/caller
-> inspect current product compatibility owner
-> fix product normalization/emulation if needed
-> add product direct tests
-> use Virtual qB profile to validate UI flow
-> add real-qB evidence where relevant
```

Only after product concerns are addressed should simulator-only fidelity be considered.

## 7. Owner map remains useful

Historical evidence still maps to the correct evidence/simulator owner:

```text
NEW/REMOVED endpoint -> apiActions/source catalog
PREFERENCE          -> Preference source pipeline
TORRENT_SURFACE     -> Torrent surface parser/catalog
PARAM/RESPONSE/
STATUS/MUTATION     -> simulator Endpoint Contract when modeling history
TRANSPORT           -> simulator Transport Contract when modeling history
NOT_APPLICABLE      -> audited ledger only
```

For the **formal product**, relevant differences must additionally map into canonical product owners such as:

```text
W.QBClient
W.ReleaseProfile
W.CapabilityRegistry
W.SettingsSchema
W.TorrentSemantics
```

Do not confuse simulator owner mapping with product owner mapping.

## 8. Product compatibility examples

### qB4/qB5 action names

Upstream difference:

```text
qB4 resume/pause
qB5 start/stop
```

Product resolution belongs in formal `webui/**` product compatibility logic, not just simulator history.

### Torrent filter names

```text
qB4 paused/resumed
qB5 stopped/running
```

Product `W.TorrentSemantics + W.ReleaseProfile` should normalize the difference.

### editTracker / torrents/add

Simulator accurately reproducing legacy/modern response semantics is useful, but Phase E must also verify the actual product `W.QBClient` normalization used by real UI flows.

## 9. qB4.0.x

This ledger currently starts at qB 4.1.0 / WebAPI v2.

The new product goal is qB4/qB5 stable compatibility. qB 4.0.x therefore remains a separate explicit gap rather than silently disappearing from project scope.

If support is implemented, WebAPI v1 evidence should live in a separate legacy adapter/evidence path instead of corrupting the existing v2 chronology.

## 10. Future revisions

A new stable release follows:

```text
new official tag
-> exact source profile
-> product impact analysis
-> WebAPI/supplement evidence
-> product compatibility implementation if required
-> simulator/evidence update if useful
```

Unknown future semantics must not be guessed. However, fail-close is a safety mechanism supporting product compatibility, not the product goal itself.

## 11. Working rule

The ledger remains authoritative for chronology/evidence, while [`010.真实qB产品兼容路线.md`](./010.真实qB产品兼容路线.md) is authoritative for **what the project works on next**.

A lower `MISSING` count is not success unless the same work improves or proves `webui/**` compatibility on real qB stable releases.

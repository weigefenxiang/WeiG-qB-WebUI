# qBittorrent WebAPI evolution ledger

Phase C is classification-first. It records the supported WebAPI history before Phase D changes simulator/runtime behavior.

The machine-readable source of truth is `tools/data/qb-webapi-evolution-ledger.json`. Its audited support window is qBittorrent 4.1.0 / WebAPI 2.0.0 through WebAPI 2.15.1.

Each observable change must end in one of four terminal classifications:

- `SOURCE_DERIVED`: the existing source-derived release catalog already owns the structural fact (for example endpoint, preference, or filter surface evolution).
- `CONTRACT_COVERED`: the existing canonical endpoint contract already owns the semantic boundary.
- `MISSING`: upstream evidence identifies an observable behavior that the current simulator contract does not yet model. These items are the Phase D backlog.
- `NOT_APPLICABLE`: chronology/evidence metadata that does not require a runtime contract.

`UNCLASSIFIED` is deliberately not a terminal ledger code. Validation fails if an evidence entry cannot be mapped to one of the four outcomes.

Completeness is checked in three independent ways:

1. **Stable revision spine.** Every supported stable qBittorrent profile must report a WebAPI revision present in the ledger, from the 4.1.0 floor through the audited ceiling. A future stable revision above the ceiling fails closed.
2. **Modern changelog coverage.** Every upstream `WebAPI_Changelog.md` pull request from WebAPI 2.11.6 through 2.15.1 must have exactly one ledger entry; missing or invented PR evidence fails validation.
3. **Evidence anchors.** Source-commit entries verify the exact upstream commit and `API_VERSION`; release-changelog entries and same-version stable supplements verify their text inside the matching qBittorrent release section.

Stable releases can change observable WebAPI behavior without increasing `API_VERSION`. Those changes are represented explicitly as `supplements` instead of being silently inherited from the WebAPI number. Examples include qBittorrent 4.4.4 HTTP method handling and later 5.x behavior fixes.

Phase D consumes the `MISSING` set intentionally. It must not infer that a behavior existed in every older version merely because a later removal/change boundary is already covered.

The first Phase D closure is the `sync/maindata.server_state.use_subcategories` lifecycle discovered during Phase C. Upstream qB 4.5.x has no field; qB 4.6.0 / WebAPI 2.9.2 introduces `app/preferences.use_subcategories` and projects the same session value into `sync/maindata`; WebAPI 2.15.0 removes the sync field because subcategories become unconditional. The ledger therefore keeps the Preference surface with the source-derived owner and moves the sync response lifecycle to Endpoint Contract coverage. Remaining `MISSING` entries stay explicit until a later Phase D batch proves and models them.

# Release Process

The repository separates development, validation, promotion and release.

## Branch Roles

- `dev` — active development and validation.
- `main` — stable release branch.

Normal product development is validated on `dev`. Promotion moves a validated exact commit to `main`; release tags must point to the current stable commit.

## Workflow Set

Current workflow responsibilities:

- `ci.yml` — repository contracts and requested validation modes.
- `pages-source.yml` — detects Pages-relevant source changes and dispatches Pages materialization.
- `pages.yml` — builds and publishes Virtual qB Pages/development payloads.
- `real-qb-full.yml` — broad frozen real-qB release validation.
- `real-qb-locale.yml` — current stable locale validation.
- `promote.yml` — validates evidence and fast-forwards the stable branch.
- `release.yml` — publishes tagged stable artifacts from the validated stable commit.

## Exact-SHA Rule

Validation artifacts belong to the exact commit that produced them.

Promotion and release must verify that required artifacts and checksums correspond to the exact source SHA being promoted or tagged.

Do not reuse evidence from another commit when relevant product/materialization inputs changed.

## Development Payload

Virtual qB Pages publishes the development installer payload under `downloads/dev`.

The payload includes:

- `WeiG-qB-WebUI.zip`
- `SHA256SUMS`
- `GIT_SHA`
- `VERSION`
- installer scripts
- distribution metadata

The distribution builder verifies that the WebUI is self-contained and that retired runtime assets are absent.

## Pages Relevance

Repository-only documentation changes do not require rebuilding product bytes.

Pages materialization is triggered when relevant inputs change, including product, simulator, installer, version or compatibility-materialization inputs.

Unknown compare state should remain fail closed.

## Promotion

Promotion is a controlled fast-forward from a validated `dev` commit to `main`.

The promotion workflow verifies the requested exact SHA and required validation artifacts before moving the stable branch.

## Tag and Release

A release tag must point to the current `main` commit.

`promote.yml` owns the stable-tag lifecycle. It resolves the tag through the GitHub REST API: an exact existing tag is accepted, a real 404 may create the tag, and every other API error fails closed. The retired stdout/empty-string probe is not a valid existence check.

`release.yml` is the only GitHub Release publisher. It reuses the certified candidate bytes, publishes the stable Release explicitly as GitHub `Latest`, then authoritative-rereads GitHub state. Publication is successful only when the exact tag is Latest, the canonical Release is first in the published Release list, title/body match the generated result, and the tag still points to the exact release SHA.

### Release Notes

GitHub Release notes have one repository-owned generator: `tools/release-notes.mjs`. Release Preview and final publication consume the same generator; there is no second public-copy or layout owner.

- Range: previous stable semantic-version tag → current release exact SHA.
- Public Release text is English/Latin-script only; non-Latin explicit metadata falls back to an eligible English commit subject or is omitted.
- Presentation order is `Highlights -> preview GIF -> folded details`, so the first Release viewport explains the current version before the showcase image.
- Highlights list at most 8 user-facing changes; folded details are bounded and grouped into Feature/UI, Fixes, Performance, and Compatibility.
- Identity/generated/support-only paths and engineering-only commits are excluded from public Release Notes unless an explicit eligible `Release-Note:` overrides the subject. `Release-Note: skip` omits that commit.
- The release workflow writes `release-notes.md` and passes it to `gh release create --notes-file`; GitHub auto-generated notes and static inline notes are not parallel owners.


## Product Version

Product version files must agree before release:

- `VERSION`
- `webui/VERSION`
- `package.json`
- `package-lock.json`

Repository-only maintenance does not require a product version change unless delivered product bytes or the product identity contract changes.

## Real-qB Validation

Broad real-qB matrices are expensive and should be used at stable checkpoints or release preparation rather than on every small edit.

Focused real-qB checks are appropriate when changing daemon-sensitive areas such as authentication/session behavior, static file serving, native translation behavior or version-specific WebAPI implementation details.

See [../tests/README.md](../tests/README.md) for test layers.

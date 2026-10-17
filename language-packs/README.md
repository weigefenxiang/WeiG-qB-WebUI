# External WeiG language overlays

The files in this directory are **source assets** for additional WeiG-owned
translations. They are deliberately outside `webui/**`.

- qBittorrent official 5.2.4 source inventory: `tools/data/qb-5.2.4-readme-languages.json`.
- Existing product-language overlays remain owned by `webui/private/data/weig-i18n/`.
- New extended-language files use `language-packs/weig-i18n/<slug>.json`, matching
  the current runtime overlay schema (`schemaVersion:1`,
  `source:"WeiG-runtime-locale-overlay"`, `locale`, `messages`).
- Locale slugs are the canonical README filename slugs in the official inventory.
- Do not copy extended files into the source `webui/**`. Any future all-languages
  package must stage these resources **only in materialized distribution output**
  and preserve the canonical `W.I18n` and qB-owned official QM owners.
- Additional README links intentionally exist ahead of corresponding translations.
- `node tools/external-weig-locale-assets.mjs --check` validates submitted overlays.
  `--require-complete` must refuse incomplete all-language sources; never
  substitute placeholders, untranslated Chinese/English or machine-literal text
  merely to make the asset count green.
- English regional variants (`en_AU`, `en_GB`) may correctly reuse the
  English baseline. The remaining 48 extended official locales require an actual
  reviewed WeiG-owned overlay before a package may claim full language coverage.
- Source content should follow the Simplified Chinese README semantics where
  README translation is requested; WeiG interface key semantics remain anchored
  to the current English key/value source, preserving brand/technical terminology.

## Native-language draft review

New language files must declare `translationStatus: "draft"` until linguistic
and semantic review is complete. A validated draft is **not** counted as a
release-ready locale. An approved overlay additionally needs the SHA256 of the **canonical English
WeiG message object** as `englishSourceSha256`, and an explicit
`reviewedEnglishFallbackKeys` array covering every intentionally untranslated
key. The union of translated keys and reviewed English fallback keys must equal
the complete canonical W.I18n key inventory, with no overlap. At least 90% of
canonical WeiG messages must carry reviewed native-locale copy; explicit
English fallback is bounded to 10% for intentional technical/identical terms.
This numeric guard is a minimum coverage gate, **not linguistic approval**;
translation accuracy and native phrasing still require real review. Approval is
invalidated whenever that English source changes. A sparse draft cannot simply
be renamed `approved` to claim a full translation.

Only `translationStatus: "approved"` with this complete review evidence may enter the
complete All Languages asset gate; publishing still requires normal SHA-bound
CI, real-qB and user acceptance. Sparse first drafts intentionally retain
English fallbacks and must not be described as complete translations.

## Progress report

Run `node tools/language-coverage-report.mjs` to inspect README coverage and
bundled, English-inherited, draft, approved and missing interface overlays.
Use `--details` for individual official locale records. Counts are derived
from the current official locale inventory and canonical W.I18n owners, not
maintained in a second hand-edited language table.

## Read-only translation review worklist

Run `node tools/translation-review-worklist.mjs --locale=ca --limit=30`
to see the next canonical WeiG messages requiring explicit native-language
review. Each entry shows current English source and available Simplified
Chinese semantic reference; these are **context**, not machine translations.
The tool never writes a locale JSON or marks anything approved. Run with
`--limit=693` to see all unreviewed keys. Empty or identical English copies
must be deliberately justified using the approved fallback mechanism.

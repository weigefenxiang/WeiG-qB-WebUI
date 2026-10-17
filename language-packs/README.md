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
  English baseline. All other 49 extended official locales require an actual
  reviewed WeiG-owned overlay before a package may claim full language coverage.
- Source content should follow the Simplified Chinese README semantics where
  README translation is requested; WeiG interface key semantics remain anchored
  to the current English key/value source, preserving brand/technical terminology.

## Native-language draft review

New language files must declare `translationStatus: "draft"` until linguistic
and semantic review is complete. A validated draft is **not** counted as a
release-ready locale. Only `translationStatus: "approved"` may enter the
complete All Languages asset gate; publishing still requires normal SHA-bound
CI, real-qB and user acceptance. Sparse first drafts intentionally retain
English fallbacks and must not be described as complete translations.

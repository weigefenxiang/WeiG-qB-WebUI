from pathlib import Path


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one target, found {count}')
    p.write_text(text.replace(old, new), encoding='utf-8')


replace_once(
    'tests/ci-contract.mjs',
    "releaseBase.includes('from 4.1.0')",
    "releaseBase.includes('4.1.0 to latest stable catalog')",
    'qB base-catalog wording assertion',
)

sh_path = Path('installers/install.sh')
sh = sh_path.read_text(encoding='utf-8')
old_header = "validate_qb_webui_config_file() {\n  cfg=$1\n  expected_root=${2-}\n  require_values=${3:-0}\n"
new_header = "validate_qb_webui_config_file() {\n  validate_cfg=$1\n  validate_expected_root=${2-}\n  validate_require_values=${3:-0}\n"
if sh.count(old_header) != 1:
    raise SystemExit(f'Linux qB validator header: expected exactly one target, found {sh.count(old_header)}')
sh = sh.replace(old_header, new_header)
start = sh.index('validate_qb_webui_config_file() {')
end = sh.index('\n}\n\nconfigure_qb_webui_file() {', start) + 3
block = sh[start:end]
block = block.replace('$expected_root', '$validate_expected_root')
block = block.replace('$require_values', '$validate_require_values')
block = block.replace('$cfg', '$validate_cfg')
sh = sh[:start] + block + sh[end:]
sh_path.write_text(sh, encoding='utf-8')

replace_once(
    'tests/platform-contract.mjs',
    r"assert.match(sh,/WebUI\\\\RootFolder=%s/,'Linux installer must persist qB-visible RootFolder');",
    r"assert.match(sh,/WebUI\\\\RootFolder=/,'Linux installer must persist qB-visible RootFolder');",
    'legacy Linux RootFolder source-shape assertion',
)

old_pipeline = """const generated='node tools/qb-release-catalog.mjs upstream-qb --output=qb-releases.json';
const enriched='node tools/qb-locale-source.mjs upstream-qb qb-releases.json';
const audited='node tests/full-stable-product-compat.mjs qb-releases.json';
assert.ok(ci.includes(generated)&&ci.includes(enriched)&&ci.includes(audited),'candidate pipeline must generate, source-enrich, and audit the exact catalog');
assert.ok(ci.indexOf(generated)<ci.indexOf(enriched)&&ci.indexOf(enriched)<ci.indexOf(audited),'qB locale and Settings UI facts must be source-derived before the exact catalog crosses the candidate boundary');"""
new_pipeline = """const generated='node tools/qb-release-catalog.mjs upstream-qb --output=qb-releases.json';
const enriched='node tools/qb-locale-source.mjs upstream-qb base-catalog/qb-releases.json';
const merged='node tools/qb-locale-source.mjs --merge base-catalog/qb-releases.json enriched-shards qb-releases.json';
const audited='node tests/full-stable-product-compat.mjs qb-releases.json';
assert.ok(ci.includes(generated)&&ci.includes(enriched)&&ci.includes('--shard-count=8')&&ci.includes(merged)&&ci.includes(audited),'candidate pipeline must generate, fan out source enrichment, merge, and audit the exact catalog');
assert.ok(ci.includes('release_locale_enrich:')&&ci.includes('needs: release_catalog_base')&&ci.includes('release_catalog_merge:')&&ci.includes('needs: release_locale_enrich')&&ci.includes('release_product_matrix:')&&ci.includes('needs: release_catalog_merge'),'qB locale and Settings UI facts must flow through the base -> 8-way enrich -> merge -> product DAG');
assert.ok(ci.includes('name: qb-release-catalog-${{ github.sha }}'),'merged qB locale/source catalog must cross job boundaries as an exact-SHA artifact');"""
replace_once(
    'tests/qb-locale-pipeline-contract.mjs',
    old_pipeline,
    new_pipeline,
    'legacy single-job qB locale pipeline assertion',
)

print('Applied deterministic post-candidate contract and shell-state adapters.')

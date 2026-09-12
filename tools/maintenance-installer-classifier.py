from pathlib import Path
import re

PAYLOAD = 'webui/*|simulator/*|installers/*|VERSION|tools/data/qb-stable-lkg.json|tools/data/qb-locale-lkg.json|tests/fixtures/qb-release-catalog.lkg.json'


def replace_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label} replacement count={count}')
    return updated


ps_path = Path('installers/install.ps1')
ps = ps_path.read_text(encoding='utf-8')
ps = replace_once(
    ps,
    r"function Test-PagesIrrelevantPath\(\[string\]\$Path\) \{.*?\n\}\n\nfunction Test-DevPayloadCanRepresentHead",
    """function Test-PagesIrrelevantPath([string]$Path) {
  if([string]::IsNullOrWhiteSpace($Path)){return $false}
  if($Path.StartsWith('webui/',[System.StringComparison]::Ordinal)){return $false}
  if($Path.StartsWith('simulator/',[System.StringComparison]::Ordinal)){return $false}
  if($Path.StartsWith('installers/',[System.StringComparison]::Ordinal)){return $false}
  switch -CaseSensitive ($Path) {
    'VERSION' { return $false }
    'tools/data/qb-stable-lkg.json' { return $false }
    'tools/data/qb-locale-lkg.json' { return $false }
    'tests/fixtures/qb-release-catalog.lkg.json' { return $false }
    default { return $true }
  }
}

function Test-DevPayloadCanRepresentHead""",
    'PowerShell classifier',
)
ps_path.write_text(ps, encoding='utf-8', newline='\n')

sh_path = Path('installers/install.sh')
sh = sh_path.read_text(encoding='utf-8')
sh = replace_once(
    sh,
    r"is_pages_irrelevant_path\(\) \{.*?\n\}\n\ndev_payload_can_represent_head\(\)",
    f"""is_pages_irrelevant_path() {{
  case \"$1\" in
    {PAYLOAD}) return 1 ;;
    *) return 0 ;;
  esac
}}

dev_payload_can_represent_head()""",
    'Linux classifier',
)
sh_path.write_text(sh, encoding='utf-8', newline='\n')

pages_path = Path('.github/workflows/pages.yml')
pages = pages_path.read_text(encoding='utf-8')
old = '''            case "$path" in
              docs/*|*.md|LICENSE|.github/workflows/ci.yml|.github/workflows/promote.yml|.github/workflows/real-qb-full.yml|.github/workflows/release.yml)
                echo "Pages-irrelevant head advance: $path"
                ;;
              *)
                echo "Pages-relevant head advance blocks stale deployment: $path" >&2
                relevant=true
                break
                ;;
            esac'''
new = f'''            case "$path" in
              {PAYLOAD})
                echo "Pages-relevant head advance blocks stale deployment: $path" >&2
                relevant=true
                break
                ;;
              *)
                echo "Pages-irrelevant head advance: $path"
                ;;
            esac'''
if pages.count(old) != 1:
    raise SystemExit(f'Pages stale classifier replacement count={pages.count(old)}')
pages_path.write_text(pages.replace(old, new, 1), encoding='utf-8', newline='\n')

test_path = Path('tests/dev-distribution-contract.mjs')
test = test_path.read_text(encoding='utf-8')
anchor = "assert.equal(windowsInstall.includes('archive/$sourceSha.zip'),false,'Windows dev installer must not download the raw GitHub source archive');\n"
extra = """assert.ok(linuxInstall.includes('webui/*|simulator/*|installers/*|VERSION|tools/data/qb-stable-lkg.json|tools/data/qb-locale-lkg.json|tests/fixtures/qb-release-catalog.lkg.json'),'Linux installer must share the Pages public-payload allowlist');
assert.ok(windowsInstall.includes(\"if($Path.StartsWith('webui/'\")&&windowsInstall.includes(\"'tests/fixtures/qb-release-catalog.lkg.json' { return $false }\")&&windowsInstall.includes('default { return $true }'),'Windows installer must share the Pages public-payload allowlist and default non-payload paths to reusable');
"""
if test.count(anchor) != 1:
    raise SystemExit('Windows installer contract anchor missing')
test = test.replace(anchor, anchor + extra, 1)
anchor2 = "assert.match(pagesWorkflow,/Pages-relevant head advance blocks stale deployment/,'Dev Pages stale gate must fail closed when any runtime/unknown path advanced after the build SHA');\n"
extra2 = "assert.ok(pagesWorkflow.includes('webui/*|simulator/*|installers/*|VERSION|tools/data/qb-stable-lkg.json|tools/data/qb-locale-lkg.json|tests/fixtures/qb-release-catalog.lkg.json'),'Dev Pages stale gate must share the same public-payload allowlist as the source relay and installers');\n"
if test.count(anchor2) != 1:
    raise SystemExit('Pages stale-gate contract anchor missing')
test_path.write_text(test.replace(anchor2, anchor2 + extra2, 1), encoding='utf-8', newline='\n')

platform_path = Path('tests/platform-contract.mjs')
platform = platform_path.read_text(encoding='utf-8')
linux_old = "assert.match(sh,/docs\\/\\*\\|\\*\\.md/,'Linux Dev payload reuse must recognize the explicit documentation-only exception set');"
linux_new = "assert.match(sh,/webui\\/\\*\\|simulator\\/\\*\\|installers\\/\\*\\|VERSION\\|tools\\/data\\/qb-stable-lkg\\.json\\|tools\\/data\\/qb-locale-lkg\\.json\\|tests\\/fixtures\\/qb-release-catalog\\.lkg\\.json/,'Linux Dev payload reuse must share the Pages public-payload allowlist');"
if platform.count(linux_old) != 1:
    raise SystemExit(f'Linux platform contract replacement count={platform.count(linux_old)}')
platform = platform.replace(linux_old, linux_new, 1)
windows_old = "assert.match(ps,/EndsWith\\('\\.md'/,'Windows Dev payload reuse must recognize Markdown as an explicit Pages-irrelevant path class');"
windows_new = "assert.ok(ps.includes(\"if($Path.StartsWith('webui/'\")&&ps.includes(\"'tests/fixtures/qb-release-catalog.lkg.json' { return $false }\")&&ps.includes('default { return $true }'),'Windows Dev payload reuse must share the Pages public-payload allowlist');"
if platform.count(windows_old) != 1:
    raise SystemExit(f'Windows platform contract replacement count={platform.count(windows_old)}')
platform = platform.replace(windows_old, windows_new, 1)
platform = platform.replace("Linux Dev channel must explicitly verify whether a materialized payload may represent a newer docs-only dev HEAD", "Linux Dev channel must explicitly verify whether a materialized payload may represent a newer non-payload dev HEAD")
platform = platform.replace("Windows Dev channel must verify whether a materialized payload may represent a newer docs-only dev HEAD", "Windows Dev channel must verify whether a materialized payload may represent a newer non-payload dev HEAD")
platform = platform.replace("Linux Dev payload reuse must fail closed when any non-exempt path changed", "Linux Dev payload reuse must fail closed when any public payload path changed")
platform = platform.replace("Windows Dev payload reuse must fail closed when any non-exempt path changed", "Windows Dev payload reuse must fail closed when any public payload path changed")
platform_path.write_text(platform, encoding='utf-8', newline='\n')

from pathlib import Path

p=Path(__file__).with_name('migrate_phase_b.py')
text=p.read_text(encoding='utf-8')
patches=[
    (
        "['webui/private/scripts/release-profile.js','webui/private/scripts/capabilities.js','webui/private/scripts/torrent-semantics.js','webui/private/scripts/torrent-fields.js','webui/private/scripts/settings-schema.js']",
        "['webui/private/scripts/release-profile.js','webui/private/scripts/capabilities.js']"
    ),
    (
        'needle="const allScripts=allFiles.filter(file=>file.startsWith(\'webui/\')&&file.endsWith(\'.js\'));"',
        'needle="const centralizedOwners=new Set([\'webui/private/scripts/capabilities.js\']);"'
    )
]
for old,new in patches:
    count=text.count(old)
    if count!=1:
        raise SystemExit(f'phase-b bootstrap patch expected 1 match, found {count}: {old[:100]!r}')
    text=text.replace(old,new,1)
p.write_text(text,encoding='utf-8')
print('Corrected Phase B architecture-contract anchors to current dev truth.')

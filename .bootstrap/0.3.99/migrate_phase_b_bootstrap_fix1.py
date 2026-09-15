from pathlib import Path

p=Path(__file__).with_name('migrate_phase_b.py')
text=p.read_text(encoding='utf-8')
old="['webui/private/scripts/release-profile.js','webui/private/scripts/capabilities.js','webui/private/scripts/torrent-semantics.js','webui/private/scripts/torrent-fields.js','webui/private/scripts/settings-schema.js']"
new="['webui/private/scripts/release-profile.js','webui/private/scripts/capabilities.js']"
count=text.count(old)
if count!=1:
    raise SystemExit(f'phase-b owner anchor patch expected 1 match, found {count}')
p.write_text(text.replace(old,new,1),encoding='utf-8')
print('Corrected Phase B centralized-owner anchor to current dev truth.')

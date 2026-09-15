from pathlib import Path

p=Path('tests/release-compat.mjs')
s=p.read_text(encoding='utf-8')
old="releaseProfile.upstreamTorrentFilter('stopped')"
new="capabilityRegistry.upstreamTorrentFilter('stopped')"
if old not in s:
    raise SystemExit('release-compat stale upstream filter owner anchor missing')
s=s.replace(old,new,1)
if 'releaseProfile' in s or 'ReleaseProfile' in s:
    raise SystemExit('release-compat still contains retired ReleaseProfile owner references')
p.write_text(s,encoding='utf-8')
print('Removed final release-compat ReleaseProfile variable reference.')

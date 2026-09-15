from pathlib import Path

p=Path('tests/full-stable-product-compat.mjs')
s=p.read_text(encoding='utf-8')
old="const settingsSurfaces=new Set(['downloads','connection','speed','bittorrent','webui','advanced']);"
new="const expectedSettingsSurfaces=['behavior','downloads','connection','speed','bittorrent','rss','webui','advanced'];const settingsSurfaces=new Set(Array.from(S.surfaces||[]));assert.deepEqual(Array.from(settingsSurfaces),expectedSettingsSurfaces,'formal product matrix must execute the exact eight qB SettingsSchema surfaces');"
if old not in s:
    raise SystemExit('full-stable Settings surface anchor missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('Full-stable Settings route gate now locks all eight canonical qB SettingsSchema surfaces.')

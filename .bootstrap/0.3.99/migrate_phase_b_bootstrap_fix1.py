from pathlib import Path

p=Path(__file__).with_name('migrate_phase_b.py')
text=p.read_text(encoding='utf-8')

old_owner="['webui/private/scripts/release-profile.js','webui/private/scripts/capabilities.js','webui/private/scripts/torrent-semantics.js','webui/private/scripts/torrent-fields.js','webui/private/scripts/settings-schema.js']"
new_owner="['webui/private/scripts/release-profile.js','webui/private/scripts/capabilities.js']"
count=text.count(old_owner)
if count!=1:
    raise SystemExit(f'phase-b owner anchor patch expected 1 match, found {count}')
text=text.replace(old_owner,new_owner,1)

start_marker='needle="const allScripts=allFiles.filter'
end_marker='\n\n# Dev distribution contract'
start=text.find(start_marker)
end=text.find(end_marker,start)
if start<0 or end<0:
    raise SystemExit(f'phase-b architecture guard block not found: start={start}, end={end}')
replacement="""replace_once('tests/compat-architecture-contract.mjs',\"const root=path.resolve(here,'..');\",\"const root=path.resolve(here,'..');\\nassert.equal(execFileSync('git',['-C',root,'ls-files','--','webui/private/scripts/release-profile.js'],{encoding:'utf8'}).trim(),'','retired ReleaseProfile runtime owner must stay deleted');\\nassert.equal(execFileSync('git',['-C',root,'ls-files','--','webui/private/data/qb-releases.json'],{encoding:'utf8'}).trim(),'','retired qB release runtime index must stay deleted');\")"""
text=text[:start]+replacement+text[end:]

old_dist="assert.equal(distBuilder.includes('packCatalog'),false,'formal dev distribution must not materialize release profiles');assert.equal(distBuilder.includes('qb-releases.json'),false);assert.equal(distBuilder.includes('qb-release-profiles'),false);"
new_dist="assert.equal(distBuilder.includes('packCatalog'),false,'formal dev distribution must not materialize release profiles');assert.ok(distBuilder.includes(\"for(const legacy of ['private/scripts/release-profile.js','private/data/qb-releases.json','private/data/qb-release-profiles'])\"),'formal dev distribution must reject retired runtime paths instead of materializing them');"
count=text.count(old_dist)
if count!=1:
    raise SystemExit(f'phase-b dev distribution assertion patch expected 1 match, found {count}')
text=text.replace(old_dist,new_dist,1)

old_ws="`--out=${path.join(out,'downloads','dev')}`, \""
new_ws="`--out=${path.join(out,'downloads','dev')}`,\""
count=text.count(old_ws)
if count!=1:
    raise SystemExit(f'phase-b build-site whitespace patch expected 1 match, found {count}')
text=text.replace(old_ws,new_ws,1)

marker="print('Phase B runtime retirement transform applied.')"
count=text.count(marker)
if count!=1:
    raise SystemExit(f'phase-b gitattributes insertion expected 1 marker, found {count}')
attrs_code="""attrs=read('.gitattributes')
registry_attr='webui/private/data/qb-settings-native.txt -whitespace'
if registry_attr not in attrs:
    write('.gitattributes',attrs.rstrip('\\n')+'\\n# qb-settings-native @@PROFILE keeps a semantic final empty TSV field; preserve its trailing tab.\\n'+registry_attr+'\\n')

"""
text=text.replace(marker,attrs_code+marker,1)
p.write_text(text,encoding='utf-8')
print('Corrected Phase B architecture guard, dev distribution contract, build-site whitespace, and semantic TSV whitespace policy.')

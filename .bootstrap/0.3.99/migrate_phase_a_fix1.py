from pathlib import Path

p=Path('tests/full-stable-product-compat.mjs')
s=p.read_text(encoding='utf-8')
anchor="const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));\n"
guards="""assert.ok(Array.isArray(catalog)&&catalog.length>0,'full-stable product matrix requires a non-empty generated release catalog');
assert.equal(catalog[0].qbVersion,'4.1.0','formal product matrix floor must be qB 4.1.0');
assert.ok(catalog.every(x=>x.stable===true&&x.officialWeiGSupport!==false),'formal product matrix accepts official supported stable profiles only');
"""
if anchor not in s:
    raise SystemExit('full-stable catalog anchor missing')
if guards not in s:
    s=s.replace(anchor,anchor+guards,1)
p.write_text(s,encoding='utf-8')
print('Restored full-stable catalog/floor/support guards.')

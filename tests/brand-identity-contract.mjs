import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const publicIcon=path.join(root,'webui/public/assets/Wei.G.ico');
const privateIcon=path.join(root,'webui/private/assets/Wei.G.ico');

assert.ok(fs.existsSync(publicIcon),'canonical Wei.G icon must live in public assets so both login and authenticated Alternative WebUI paths can resolve it');
assert.equal(fs.statSync(publicIcon).size,7905,'A8 must restore the last known-good Wei.G multi-size icon blob');
assert.equal(fs.existsSync(privateIcon),false,'private duplicate icon must stay retired; qB public fallback is the single physical asset owner');

for(const rel of ['webui/public/index.html','webui/public/login.html','webui/private/index.html','webui/private/scripts/brand.js']){
  assert.match(read(rel),/assets\/Wei\.G\.ico/,rel+' must consume the canonical Wei.G asset path');
}
const brand=read('webui/private/scripts/brand.js');
assert.match(brand,/var ICON='assets\/Wei\.G\.ico'/);
assert.match(brand,/function ensureFavicon\(\)/);
assert.match(brand,/function cloneMark\(size\)/,'Header/About identity marks must share the same brand asset owner');
console.log('Brand identity contract passed: Login, favicon, Header and About consume one restored public Wei.G icon source.');

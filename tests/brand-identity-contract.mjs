import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const publicMark=path.join(root,'webui/public/assets/Wei.G.png');
const publicIco=path.join(root,'webui/public/assets/Wei.G.ico');
const privatePng=path.join(root,'webui/private/assets/Wei.G.png');
const privateIco=path.join(root,'webui/private/assets/Wei.G.ico');

assert.ok(fs.existsSync(publicMark),'canonical Wei.G PNG must live in public assets so login and authenticated Alternative WebUI can share one physical brand owner');
assert.equal(fs.statSync(publicMark).size,7905,'canonical Wei.G PNG must keep the verified historical visible brand bytes');
assert.equal(fs.existsSync(publicIco),false,'damaged/blank Wei.G ICO must stay retired');
assert.equal(fs.existsSync(privatePng)||fs.existsSync(privateIco),false,'private duplicate brand assets must stay retired; qB authenticated static lookup falls back to public');

for(const rel of ['webui/public/index.html','webui/public/login.html','webui/private/index.html','webui/private/scripts/brand.js']){
  assert.match(read(rel),/assets\/Wei\.G\.png/,rel+' must consume the canonical Wei.G PNG path');
  assert.doesNotMatch(read(rel),/assets\/Wei\.G\.ico/,rel+' must not consume the retired ICO path');
}
const brand=read('webui/private/scripts/brand.js');
assert.match(brand,/var ICON='assets\/Wei\.G\.png'/);
assert.match(brand,/function ensureFavicon\(\)/);
assert.match(brand,/function cloneMark\(size\)/,'Header/About identity marks must share the same brand asset owner');
console.log('Brand identity contract passed: Login, favicon, Header and About consume one canonical public PNG with no private/ICO duplicate owner.');

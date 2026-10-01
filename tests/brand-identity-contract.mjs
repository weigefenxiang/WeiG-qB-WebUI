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
const faviconOwnerPath='webui/public/scripts/brand-favicon.js';
const privateFaviconDuplicate=path.join(root,'webui/private/scripts/brand-favicon.js');

assert.ok(fs.existsSync(publicMark),'canonical Wei.G PNG must live in public assets so Login/Header/About/favicon share one physical brand owner');
assert.equal(fs.statSync(publicMark).size,7905,'canonical Wei.G PNG bytes must remain unchanged');
assert.equal(fs.existsSync(publicIco),false,'retired Wei.G ICO must stay absent');
assert.equal(fs.existsSync(privatePng)||fs.existsSync(privateIco),false,'private duplicate brand assets must stay retired');
assert.equal(fs.existsSync(privateFaviconDuplicate),false,'favicon presentation owner must live once in public fallback namespace');
assert.ok(fs.existsSync(path.join(root,faviconOwnerPath)),'shared favicon presentation owner is missing');

for(const rel of ['webui/public/index.html','webui/public/login.html','webui/private/index.html','webui/private/scripts/brand.js']){
  assert.match(read(rel),/assets\/Wei\.G\.png/,rel+' must consume the canonical Wei.G PNG path');
  assert.doesNotMatch(read(rel),/assets\/Wei\.G\.ico/,rel+' must not consume retired ICO bytes');
}
for(const rel of ['webui/public/index.html','webui/public/login.html','webui/private/index.html'])assert.match(read(rel),/scripts\/brand-favicon\.js/,rel+' must consume the shared favicon presentation owner');

const brand=read('webui/private/scripts/brand.js'),css=read('webui/private/css/brand.css'),favicon=read(faviconOwnerPath),privateIndex=read('webui/private/index.html');
assert.match(brand,/var ICON='assets\/Wei\.G\.png'/);
assert.match(brand,/function ensureFavicon\(\)\{var owner=global\.WeiGBrandFavicon/,'private Brand must delegate favicon presentation instead of owning a second renderer');
assert.match(brand,/function cloneMark\(size\)/,'Header/About marks must share one Brand owner');
assert.doesNotMatch(brand,/shine|spark|orbit-spark/,'retired broad shine/spark motion vocabulary returned');
assert.doesNotMatch(css,/ambientShine|ambientSpark|ambient-mark__shine|ambient-mark__spark|is-ambient-shine|is-ambient-spark/,'retired shine/spark CSS returned');
assert.doesNotMatch(css,/\.brand-mark-home:hover\{/,'Header mark button must not regain an outer hover frame');
assert.match(css,/\.brand-mark-home:hover>\.brand__mark,\.brand-identity__mark-home:hover>\.brand__mark/,'Header/About must share the same mark hover motion');
assert.match(css,/rgba\(57,217,138,\.92\)/,'canonical rim orbit must include the green highlight');
assert.match(css,/@keyframes ambientOrbit/);
assert.match(favicon,/ctx\.arc\(SIZE\/2,SIZE\/2,RADIUS/,'favicon owner must circular-clip the canonical PNG');
assert.match(favicon,/canvas\.toDataURL\('image\/png'\)/,'favicon owner must derive an in-memory PNG without another physical logo asset');
assert.ok(privateIndex.indexOf('"scripts/brand-favicon.js"')<privateIndex.indexOf('"scripts/brand.js"'),'private bootstrap must load favicon owner before Brand consumer');

console.log('A39 Brand contract passed: one canonical PNG, one circular favicon presentation owner, unified Header/About motion, retired broad shine/spark and no outer Header hover frame.');

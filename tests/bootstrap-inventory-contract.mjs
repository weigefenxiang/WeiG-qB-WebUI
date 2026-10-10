import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),webui=path.join(root,'webui'),privateRoot=path.join(webui,'private'),publicRoot=path.join(webui,'public');
const plan=JSON.parse(fs.readFileSync(path.join(privateRoot,'bootstrap-plan.json'),'utf8'));
const navigation=fs.readFileSync(path.join(privateRoot,'scripts/navigation.js'),'utf8');
const routeBlock=(navigation.match(/ROUTE_MODULES=\{([^}]+)\}/)||[])[1]||'';
const routeModules=[...routeBlock.matchAll(/'([^']+\.js)'/g)].map(match=>match[1]);
assert.deepEqual(routeModules.sort(),['scripts/logs.js','scripts/rss.js','scripts/settings.js'],'route-demand module inventory drifted');

function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):(entry.isFile()&&file.endsWith('.js')?[file]:[]);});}
function physical(relative){
  for(const base of [privateRoot,publicRoot]){const file=path.join(base,relative);if(fs.existsSync(file)&&fs.statSync(file).isFile())return path.relative(webui,file).replaceAll('\\','/');}
  throw new Error('Runtime JS asset has no physical owner: '+relative);
}
const startup=plan.phases.flatMap(phase=>phase.scripts),seed=['scripts/runtime-assets.js'],publicEntry=['scripts/entry-locale.js','scripts/entry-select.js'];
const categories={
  seed:new Set(seed.map(physical)),
  startup:new Set(startup.map(physical)),
  routeDemand:new Set(routeModules.map(physical)),
  publicEntry:new Set(publicEntry.map(physical))
};
const allExpected=new Set(Object.values(categories).flatMap(set=>[...set]));
const allActual=new Set(walk(webui).map(file=>path.relative(webui,file).replaceAll('\\','/')));
assert.deepEqual([...allActual].sort(),[...allExpected].sort(),'every shipped WebUI JavaScript file must have exactly one declared lifecycle owner: seed, startup phase, route demand, or public entry');
for(const [name,set] of Object.entries(categories))for(const file of set)for(const [other,otherSet] of Object.entries(categories))if(name!==other)assert.equal(otherSet.has(file),false,file+' is classified by both '+name+' and '+other);
assert.equal(categories.seed.size,1);assert.equal(categories.startup.size,41);assert.equal(categories.routeDemand.size,3);assert.equal(categories.publicEntry.size,2);
const cssActual=fs.readdirSync(path.join(privateRoot,'css'),{withFileTypes:true}).filter(entry=>entry.isFile()&&entry.name.endsWith('.css')).map(entry=>'css/'+entry.name).sort();
assert.deepEqual([...plan.styles].sort(),cssActual,'every shipped private stylesheet must be owned by the bootstrap plan');
// All shipped CSS must declare UTF-8 as its first byte-level rule. qB's own
// Alternative WebUI hosts the same files across releases; a wrong charset
// must not silently mangle selected marks or other international symbols.
for(const dir of [path.join(privateRoot,'css'),path.join(publicRoot,'styles')]){
  for(const name of fs.readdirSync(dir).filter(name=>name.endsWith('.css'))){
    const file=path.join(dir,name),bytes=fs.readFileSync(file),label=path.relative(webui,file);
    assert.equal(bytes.subarray(0,3).equals(Buffer.from([0xef,0xbb,0xbf])),false,label+' must be UTF-8 without BOM');
    const decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    assert.ok(decoded.startsWith('@charset "UTF-8";\n'),label+' requires a first-byte CSS UTF-8 charset declaration');
    assert.equal(decoded,bytes.toString('utf8'),label+' has invalid UTF-8');
    assert.doesNotMatch(decoded,/âœ|â€|\uFFFD/,label+' contains mojibake or a replacement character');
  }
}
const controlCss=fs.readFileSync(path.join(privateRoot,'css/controls.css'),'utf8');
const layerCss=fs.readFileSync(path.join(privateRoot,'css/ui.css'),'utf8');
assert.match(controlCss,/\.ui-select__option\[aria-selected=true\]:before\{content:'✓'/,'shared Select owns the checked glyph');
assert.doesNotMatch(layerCss,/\.ui-select__option\[aria-selected="true"\]::before\{content:/,'UI geometry layer must not duplicate the shared selected glyph owner');
for(const file of walk(path.join(privateRoot,'scripts'))){const source=fs.readFileSync(file,'utf8'),relative=path.relative(webui,file).replaceAll('\\\\','/');if(relative==='private/scripts/runtime-assets.js')continue;assert.equal(/createElement\(['"](?:script|link)['"]\)/.test(source),false,relative+' must not recreate script/style transport outside W.RuntimeAssets');}
console.log('Bootstrap inventory contract passed: every shipped WebUI JavaScript asset has one lifecycle owner, every private stylesheet belongs to the bootstrap plan, and private feature modules do not recreate script/style transport.');

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
assert.equal(categories.seed.size,1);assert.equal(categories.startup.size,40);assert.equal(categories.routeDemand.size,3);assert.equal(categories.publicEntry.size,2);
console.log('Bootstrap inventory contract passed: every shipped WebUI JavaScript asset has exactly one lifecycle owner (1 seed, 40 startup, 3 route-demand, 2 public-entry).');

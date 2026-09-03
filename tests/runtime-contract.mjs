import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const runtimeBase=path.join(root,'webui/private');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};
function walk(abs,rel=''){
  return fs.readdirSync(abs,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()
    ?walk(path.join(abs,entry.name),path.join(rel,entry.name))
    :[path.join(rel,entry.name).replaceAll('\\','/')]);
}

// Global product identity belongs here; feature gates must not duplicate version policy.
const version=read('VERSION').trim();
const webVersion=read('webui/VERSION').trim();
const packageVersion=JSON.parse(read('package.json')).version;
assert(version===webVersion&&version===packageVersion,`Version sources diverged: VERSION=${version}, webui/VERSION=${webVersion}, package.json=${packageVersion}`);

const required=[
  'webui/private/index.html',
  'webui/private/scripts/core.js',
  'webui/private/scripts/qb-client.js',
  'webui/private/scripts/components.js',
  'webui/private/scripts/floating.js',
  'webui/private/scripts/app.js'
];
for(const rel of required)assert(fs.existsSync(path.join(root,rel)),`Missing global runtime asset ${rel}`);

const index=read('webui/private/index.html');
assert(!/(?:src|href)=["'][^"']*(?:\/v\d+|-[vV]\d+\.)/i.test(index),'Private index references a version-labelled runtime asset');
assert(index.indexOf('scripts/core.js')<index.indexOf('scripts/app.js'),'core.js must load before app.js');
assert(index.indexOf('scripts/qb-client.js')<index.indexOf('scripts/app.js'),'qb-client.js must load before app.js');

const runtimeFiles=walk(runtimeBase).filter(rel=>rel.startsWith('scripts/')&&rel.endsWith('.js'));
const qbClientCreators=[];
for(const rel of runtimeFiles){
  const source=read('webui/private/'+rel);
  assert(!source.includes('MutationObserver'),`${rel} contains observer-driven runtime repair/ownership`);
  assert(!/(?:window|globalThis|global)\.fetch\s*=|\.prototype\.(?:open|send|fetch)\s*=/.test(source),`${rel} contains fetch/prototype monkey patching`);
  assert(!/(?:scripts|css)\/[A-Za-z0-9._-]*-[vV]\d+\.(?:js|css)/.test(source),`${rel} contains a hidden version-labelled runtime loader`);
  const count=(source.match(/new W\.QBClient\s*\(/g)||[]).length;
  if(count)qbClientCreators.push([rel,count]);
}
assert(qbClientCreators.length===1&&qbClientCreators[0][0]==='scripts/app.js'&&qbClientCreators[0][1]===1,`Exactly app.js may create one QBClient: ${JSON.stringify(qbClientCreators)}`);

// Browser fixtures may read VERSION but must not pin a WeiG 0.3.x product version.
for(const rel of walk(path.join(root,'tests')).filter(rel=>/^browser-.*\.mjs$/.test(path.basename(rel)))){
  const source=read('tests/'+rel);
  assert(!/\b0\.3\.\d+\b/.test(source),`${rel} hard-codes a WeiG product version; read canonical VERSION instead`);
}

console.log(`Runtime contract passed for WeiG ${version}: global ownership, no repair/monkey-patch runtime, one QBClient owner, and version-neutral browser fixtures.`);

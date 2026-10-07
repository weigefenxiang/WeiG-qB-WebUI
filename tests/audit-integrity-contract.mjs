import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const auditsRoot=path.join(root,'audits');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const normalize=rel=>rel.replaceAll('\\','/');

function walk(dir,out=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,entry.name);
    if(entry.isDirectory())walk(abs,out);
    else if(entry.name.endsWith('.mjs'))out.push(abs);
  }
  return out;
}
function resolveImport(from,spec){
  if(!spec.startsWith('.'))return null;
  const target=path.resolve(path.dirname(from),spec);
  for(const candidate of [target,target+'.mjs',target+'.js',path.join(target,'index.mjs'),path.join(target,'index.js')]){
    if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return candidate;
  }
  return target;
}

const files=walk(auditsRoot).sort();
assert.ok(files.length>0,'audits/ must contain preserved non-routine validation');
const broken=[];
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const specs=[
    ...source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g),
    ...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)
  ].map(match=>match[1]);
  for(const spec of specs){
    const resolved=resolveImport(file,spec);
    if(resolved&&!fs.existsSync(resolved))broken.push(`${normalize(path.relative(root,file))} -> ${spec}`);
  }
}
assert.deepEqual(broken,[],`Audit relative import closure is broken:\n${broken.join('\n')}`);

const auditScripts=Object.entries(pkg.scripts||{}).filter(([name])=>name.startsWith('test:audit:')||name==='test:compat');
assert.ok(auditScripts.length>=5,'package.json must expose grouped audit entry points');
const missing=[];
for(const [name,command] of auditScripts){
  const refs=[...String(command).matchAll(/node\s+(audits\/[^\s&]+)/g)].map(match=>match[1]);
  assert.ok(refs.length>0,`${name} must execute at least one audits/ owner`);
  for(const rel of refs)if(!fs.existsSync(path.join(root,rel)))missing.push(`${name} -> ${rel}`);
}
assert.deepEqual(missing,[],`Audit package entry points reference missing files:\n${missing.join('\n')}`);

const routine=fs.readdirSync(path.join(root,'tests')).filter(name=>/^a\d+-/.test(name));
assert.deepEqual(routine,[],'Milestone-numbered tests must not return to the routine blocking surface');

console.log(`Audit integrity contract passed: ${files.length} audit modules have closed relative imports and ${auditScripts.length} grouped entry points resolve to real files.`);

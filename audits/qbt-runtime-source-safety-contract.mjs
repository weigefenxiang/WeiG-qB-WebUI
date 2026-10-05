import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const privateRoot=path.join(root,'webui','private');

function jsFiles(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...jsFiles(full));
    else if(entry.isFile()&&entry.name.endsWith('.js'))out.push(full);
  }
  return out;
}

const offenders=[];
for(const file of jsFiles(privateRoot)){
  const source=fs.readFileSync(file,'utf8');
  source.split(/\r?\n/).forEach((line,index)=>{
    if(line.includes('QBT_TR('))offenders.push({
      file:path.relative(root,file).replaceAll('\\','/'),
      line:index+1,
      excerpt:line.trim().slice(0,180)
    });
  });
}
assert.deepEqual(
  offenders,
  [],
  'Private runtime JavaScript must not contain a raw QBT_TR( token. qB 4.1.x may feed JS through its native WebUI translator; non-translation literals must construct the token at runtime instead.'
);

const settings=fs.readFileSync(path.join(privateRoot,'scripts','settings.js'),'utf8');
assert.ok(settings.includes(".includes('QBT_'+'TR(')"),'Settings placeholder guard must preserve QBT_TR( runtime semantics without embedding the raw source token');
console.log('QBT runtime source safety contract passed: private JS contains no raw QBT_TR( token.');

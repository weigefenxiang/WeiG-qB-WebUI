import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
function walk(dir,out=[]){
  if(!fs.existsSync(dir))return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,entry.name);
    if(entry.isDirectory())walk(abs,out);
    else out.push(abs);
  }
  return out;
}

const syntaxFiles=[
  ...walk(path.join(root,'webui/private/scripts')).filter(file=>file.endsWith('.js')),
  ...walk(path.join(root,'tests')).filter(file=>file.endsWith('.mjs'))
].sort();
for(const file of syntaxFiles){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0){
    const rel=path.relative(root,file).replaceAll('\\','/');
    throw new Error(`${rel}: JavaScript syntax check failed\n${result.stderr||result.stdout}`);
  }
}

console.log(`Syntax contract passed for ${syntaxFiles.length} runtime/test JavaScript files.`);

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

const repositoryFiles=['tests','docs','webui/private'].flatMap(dir=>walk(path.join(root,dir)));
const versionedName=/(?:^|[-.])(?:v\d+(?:\.\d+)*|qb\d+)(?=[^0-9]|$)/i;
const versionedPaths=repositoryFiles
  .map(file=>path.relative(root,file).replaceAll('\\','/'))
  .filter(file=>versionedName.test(path.basename(file)));
if(versionedPaths.length)throw new Error(`Version-labelled repository filenames are forbidden; use stable responsibility names and keep version facts in VERSION/Git/qB capability data:\n${versionedPaths.join('\n')}`);

console.log(`Syntax contract passed for ${syntaxFiles.length} runtime/test JavaScript files; repository filenames are version-neutral.`);

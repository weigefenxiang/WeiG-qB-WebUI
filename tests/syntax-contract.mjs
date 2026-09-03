import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const runtimeDir='webui/private/scripts';
const runtimeFiles=fs.readdirSync(runtimeDir).filter(x=>x.endsWith('.js')).sort();
for(const file of runtimeFiles){
  const source=fs.readFileSync(path.join(runtimeDir,file),'utf8');
  try{new vm.Script(source,{filename:file});}
  catch(e){throw new Error(`${file}: ${e.message}`);}
}

function walk(dir,out=[]){
  if(!fs.existsSync(dir))return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const rel=path.join(dir,entry.name);
    if(entry.isDirectory())walk(rel,out);
    else out.push(rel.replaceAll('\\','/'));
  }
  return out;
}
const repositoryFiles=['tests','docs','webui/private'].flatMap(dir=>walk(dir));
const versionedName=/(?:^|[-.])(?:v\d+(?:\.\d+)*|qb\d+)(?=[^0-9]|$)/i;
const versionedPaths=repositoryFiles.filter(file=>versionedName.test(path.basename(file)));
if(versionedPaths.length)throw new Error(`Version-labelled repository filenames are forbidden; use stable responsibility names and keep version facts in VERSION/Git/qB capability data:\n${versionedPaths.join('\n')}`);

console.log(`JavaScript syntax parsed for ${runtimeFiles.length} semantic runtime scripts; repository filenames are version-neutral.`);

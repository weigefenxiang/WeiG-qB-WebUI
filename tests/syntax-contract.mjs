import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const dir='webui/private/scripts';
const files=fs.readdirSync(dir).filter(x=>x.endsWith('.js')).sort();
for(const file of files){const source=fs.readFileSync(path.join(dir,file),'utf8');try{new vm.Script(source,{filename:file});}catch(e){throw new Error(`${file}: ${e.message}`);}}
console.log(`JavaScript syntax parsed for ${files.length} semantic runtime scripts.`);

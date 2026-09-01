import fs from 'node:fs';
import path from 'node:path';

function assert(condition,message){if(!condition)throw new Error(message);}

const roots=['README.md','DESIGN.md','docs','installers','tests','webui'];
const self=path.normalize('tests/opensource-contract-v036.mjs');
const extensions=new Set(['.md','.sh','.ps1','.js','.mjs','.json','.html','.css','.yml','.yaml','.txt']);
const files=[];

function collect(entry){
  if(!fs.existsSync(entry))return;
  const stat=fs.statSync(entry);
  if(stat.isDirectory()){
    for(const name of fs.readdirSync(entry))collect(path.join(entry,name));
    return;
  }
  if(path.normalize(entry)===self)return;
  if(extensions.has(path.extname(entry).toLowerCase())||path.basename(entry)==='VERSION'||path.basename(entry)==='GIT_SHA')files.push(entry);
}
for(const root of roots)collect(root);

/* Keep maintainer deployment details out of the distributable/open-source tree.
 * Build the sentinels from neutral fragments so this contract does not itself
 * become the only file containing the forbidden deployment strings. */
const maintainerDomain=['weig','share','.com'].join('');
const maintainerRoot=['/root/','qbit','torrent'].join('');
const violations=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  if(text.includes(maintainerDomain))violations.push(`${file}: deployment domain`);
  if(text.includes(maintainerRoot))violations.push(`${file}: machine-specific qB host path`);
}
assert(violations.length===0,`Open-source deployment boundary violated:\n${violations.join('\n')}`);

const live=fs.readFileSync('tests/live-v036.sh','utf8');
assert(live.includes('--target'),'live candidate deployment must require operator-supplied --target paths');
assert(!live.includes('--only qb'),'live candidate deployment must not encode maintainer instance identities');
assert(!live.includes(maintainerDomain),'live candidate deployment must not encode maintainer domains');
assert(!live.includes(maintainerRoot),'live candidate deployment must not encode maintainer host paths');
assert(live.includes('weigg-install.json'),'live candidate deployment should preserve existing deployment metadata rather than guessing it');

console.log('v0.3.6 open-source deployment boundary contract passed.');

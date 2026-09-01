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

/* Public project branding and the canonical Blog URL are allowed in an
 * open-source repository. Private/live qB deployment endpoints, credentials,
 * container identities and machine-specific host paths are not. Keep the
 * endpoint sentinels assembled from fragments so this contract does not
 * itself become a source of deployable instance addresses. */
const publicDomain=['weig','share','.com'].join('');
const forbiddenHosts=[['q','b','.',publicDomain].join(''),['q','.',publicDomain].join('')];
const maintainerRoot=['/root/','qbit','torrent'].join('');
const violations=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  for(const host of forbiddenHosts)if(text.includes(host))violations.push(`${file}: deployment endpoint`);
  if(text.includes(maintainerRoot))violations.push(`${file}: machine-specific qB host path`);
}
assert(violations.length===0,`Open-source deployment boundary violated:\n${violations.join('\n')}`);

for(const livePath of ['tests/live-v036.sh','tests/live-v037.sh']){
  if(!fs.existsSync(livePath))continue;
  const live=fs.readFileSync(livePath,'utf8');
  assert(live.includes('--target'),`${livePath} must require operator-supplied --target paths`);
  assert(!live.includes('--only qb'),`${livePath} must not encode maintainer instance identities`);
  for(const host of forbiddenHosts)assert(!live.includes(host),`${livePath} must not encode maintainer deployment endpoints`);
  assert(!live.includes(maintainerRoot),`${livePath} must not encode maintainer host paths`);
  assert(live.includes('weigg-install.json'),`${livePath} should preserve existing deployment metadata rather than guessing it`);
}

console.log('Open-source deployment boundary contract passed: public branding allowed, private deployment data forbidden.');

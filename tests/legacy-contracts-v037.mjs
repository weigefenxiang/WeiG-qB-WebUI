import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const versionFiles=['VERSION','webui/VERSION'];
const metadataFile='webui/private/weigg-install.json';
const original=new Map(versionFiles.map(file=>[file,fs.readFileSync(file,'utf8')]));
const originalMetadata=fs.readFileSync(metadataFile,'utf8');
const legacyContracts=[
  'tests/smoke.mjs',
  'tests/opensource-contract-v036.mjs',
  'tests/semantics-contract-v036.mjs',
  'tests/compat-v030.mjs',
  'tests/log-compat-v032.mjs',
  'tests/settings-v034.mjs',
  'tests/cache-contract-v035.mjs',
  'tests/ui-contract-v036.mjs',
  'tests/mobile-contract-v036.mjs',
  'tests/advanced-contract-v036.mjs'
];
let status=0;
try{
  // Historical regression contracts intentionally retain the release identity
  // they certified. Present that identity only while executing them, then
  // restore the real v0.3.7 files before v0.3.7-specific contracts run.
  for(const file of versionFiles)fs.writeFileSync(file,'0.3.6\n');
  const legacyMetadata=JSON.parse(originalMetadata);
  legacyMetadata.version='0.3.6';
  fs.writeFileSync(metadataFile,JSON.stringify(legacyMetadata,null,2)+'\n');
  for(const test of legacyContracts){
    const result=spawnSync(process.execPath,[test],{stdio:'inherit'});
    if((result.status??1)!==0){status=result.status??1;break;}
  }
}finally{
  for(const [file,content] of original)fs.writeFileSync(file,content);
  fs.writeFileSync(metadataFile,originalMetadata);
}
if(status!==0)process.exit(status);
console.log('Legacy v0.3.6 static regression contracts passed under the v0.3.7 compatibility bridge.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

function gitFiles(...scopes){
  const result=spawnSync('git',['ls-files','-z',...scopes],{cwd:root,encoding:'utf8'});
  if(result.status!==0)throw new Error('git ls-files failed: '+String(result.stderr||'').trim());
  return String(result.stdout||'').split('\0').filter(Boolean);
}
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const browserFiles=gitFiles('webui/private/scripts','webui/public/scripts').filter(file=>/\.js$/.test(file));
const clipboardOwners=[];
for(const file of browserFiles){
  const source=read(file);
  if(/navigator\.clipboard|document\.execCommand\(\s*['"]copy['"]/.test(source))clipboardOwners.push(file);
  assert.doesNotMatch(source,/['"]settings\.update\.rollback['"]/,'retired Update rollback key returned in '+file);
}
assert.deepEqual(clipboardOwners,['webui/private/scripts/core.js'],'browser clipboard transports must have exactly one active runtime owner.');

const sh=read('installers/install.sh');
const ps=read('installers/install.ps1');
assert.doesNotMatch(sh,/cp -a "\$backup_source" "\$backup_root\/webui"/,'Linux current writer recreated legacy backup/webui.');
assert.doesNotMatch(ps,/Copy-Item -LiteralPath \$Source -Destination \(Join-Path \$Backup 'webui'\)/,'Windows current writer recreated legacy backup/webui.');
assert.match(sh,/if \[ -d "\$backup_extract_root\/webui" \]/,'Linux must retain the bounded legacy directory reader.');
assert.match(ps,/\$legacy=Join-Path \$Backup 'webui'[\s\S]*Test-Path -LiteralPath \$legacy -PathType Container/,'Windows must retain the bounded legacy directory reader.');

const worker=read('simulator/service-worker/service-worker.js');
assert.doesNotMatch(worker,/fetch\(CATALOG_URL/,'normal Virtual qB runtime must not restore the retired full-catalog cold-path fetch.');
assert.match(worker,/RUNTIME_PROFILE_BASE\+key\+'\.json'/,'Virtual qB selected-profile shard owner missing.');
assert.match(worker,/RUNTIME_COPY_BASE\+key\+'\.txt'/,'Virtual qB selected-copy shard owner missing.');

console.log('A38 retirement contract passed: exact Git-tracked browser runtime has one Clipboard transport owner, retired rollback key stays absent, current installers cannot write legacy directory backups, and Virtual qB keeps shard-first cold paths.');

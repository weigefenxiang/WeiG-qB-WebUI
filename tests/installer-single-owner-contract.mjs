import assert from 'node:assert/strict';
import fs from 'node:fs';
const sh=fs.readFileSync(new URL('../installers/install.sh',import.meta.url),'utf8');
const count=s=>sh.split(s).length-1;
assert.equal(count('map_docker_destination()'),1,'Docker destination must have one active owner.');
assert.equal(count('STATE="${HOME}/.config/weig-qb-webui"'),1,'canonical installer state root must be initialized once.');
assert.equal(count('PACKAGE=""'),1,'payload lifecycle must not be duplicated.');
assert.ok(sh.split(/\r?\n/).length<1850,'installer source unexpectedly contains a duplicated lifecycle tail.');assert.equal(count('backup_record_read()'),1,'backup record metadata must have one active shell owner.');assert.equal(count('backup_record_pack()'),1,'backup record bundle writer must have one active shell owner.');
assert.match(sh,/docker_canonical="\$DOCKER_CONFIG_ROOT\/weig-qb-webui"[\s\S]*docker_legacy="\$DOCKER_CONFIG_ROOT\/weig_qb-webui"[\s\S]*Using existing legacy Docker install directory/);
assert.match(sh,/QBT_ROOT_FOLDER="\/config\/weig-qb-webui"/,'new Docker installs must use canonical lowercase hyphen root.');
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const installer=fileURLToPath(new URL('../installers/install.sh',import.meta.url));
function cli(args){
  return spawnSync('sh',[installer,...args,'-help'],{encoding:'utf8',timeout:5000,env:{...process.env,WEIG_QB_CHANNEL:'main'}});
}
for(const args of [
  ['--dev'],['--version','1.2.0'],['--version=1.2.0'],['--output','/tmp/weig'],['--output=/tmp/weig'],
  ['--configure'],['--rollback'],['--uninstall'],['--purge'],['--help'],['-h'],
  ['-update'],['--update'],['--channel=dev'],['--channel=release'],['--dir=/tmp/weig']
]){
  const result=cli(args);
  assert.equal(result.status,2,'retired CLI option must be rejected: '+args.join(' ')+' / '+result.stderr);
  assert.match(result.stderr,/Unknown option:/);
}
for(const args of [
  ['-dev'],['-version','1.2.0'],['-o','/tmp/weig'],['-configure'],['-rollback'],
  ['-uninstall'],['-purge'],['--container=qbittorrent'],['--config-root=/tmp'],['--list-containers']
]){
  const result=cli(args);
  assert.equal(result.status,0,'current CLI option must parse: '+args.join(' ')+' / '+result.stderr);
}
console.log('Installer single-owner contract passed: duplicated lifecycle tail retired and Docker defaults migrate safely.');

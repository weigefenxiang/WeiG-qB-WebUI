import assert from 'node:assert/strict';
import fs from 'node:fs';
const sh=fs.readFileSync(new URL('../installers/install.sh',import.meta.url),'utf8');
const ps=fs.readFileSync(new URL('../installers/install.ps1',import.meta.url),'utf8');

assert.match(sh,/^STATE="\$\{HOME\}\/\.config\/weig-qb-webui"$/m);
assert.match(sh,/^LEGACY_STATE="\$\{HOME\}\/\.config\/weig_qb-webui"$/m);
assert.match(sh,/state_marker_value\(\)[\s\S]*for marker_root in "\$STATE" "\$LEGACY_STATE"/);
assert.match(sh,/owned_backups_for_dest\(\)[\s\S]*for backup_root in "\$BACKUPS" "\$LEGACY_BACKUPS"/);
assert.match(sh,/candidate="\$BACKUPS\/\$name"/);
assert.doesNotMatch(sh,/candidate="\$LEGACY_BACKUPS\/\$name"/);

assert.match(ps,/^\$State=Join-Path \$env:APPDATA 'weig-qb-webui'$/m);
assert.match(ps,/^\$LegacyState=Join-Path \$env:APPDATA 'WeiG_qB-WebUI'$/m);
assert.match(ps,/function Get-InstallerStateMarker[\s\S]*@\(\$State,\$LegacyState\)/);
assert.match(ps,/function Get-OwnedBackupsForDestination[\s\S]*@\(\$Backups,\$LegacyBackups\)/);
assert.match(ps,/\$candidate=Join-Path \$Backups \$name/);
assert.doesNotMatch(ps,/\$candidate=Join-Path \$LegacyBackups \$name/);

console.log('Installer state namespace contract passed: only canonical current writers with bounded legacy readers.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
const sh=fs.readFileSync(new URL('../installers/install.sh',import.meta.url),'utf8');
const ps=fs.readFileSync(new URL('../installers/install.ps1',import.meta.url),'utf8');
assert.match(sh,/DEFAULT_DEST="\$\{HOME\}\/\.local\/share\/weig-qb-webui"/);
assert.match(sh,/LEGACY_DEFAULT_DEST="\$\{HOME\}\/\.local\/share\/weig_qb-webui"/);
assert.match(sh,/TARGET_COUNT" -eq 0[\s\S]*WEIG_QB_WEBUI_DIR[\s\S]*! -e "\$DEFAULT_DEST"[\s\S]*-d "\$LEGACY_DEFAULT_DEST"[\s\S]*private\/weig-install\.json[\s\S]*DEST="\$LEGACY_DEFAULT_DEST"/,'Linux may reuse the old default only when it is an installer-owned WeiG target');
assert.match(ps,/\[Alias\('output'\)\]\[string\]\$o="\$env:LOCALAPPDATA\\weig-qb-webui"/,'Windows current public -o defaults to canonical path');
assert.match(ps,/\$Destination=\$o/,'Windows internal destination is derived from canonical public -o');
assert.match(ps,/LegacyDefaultDestination="\$env:LOCALAPPDATA\\WeiG_qB-WebUI"/);
assert.match(ps,/!\$DestinationExplicit[\s\S]*Mode -eq 'Install'[\s\S]*LegacyDefaultDestination[\s\S]*private\\weig-install\.json[\s\S]*\$Destination=\$LegacyDefaultDestination/,'Windows may reuse the old default only when it is an installer-owned WeiG target');
console.log('Canonical install-path migration contract passed: new defaults use lowercase hyphen slug while existing legacy default directories remain updateable in place.');

assert.match(sh,/^STATE="\$\{HOME\}\/\.config\/weig-qb-webui"$/m,'Linux current state root must use canonical slug.');
assert.match(ps,/^\$State=Join-Path \$env:APPDATA 'weig-qb-webui'$/m,'Windows current state root must use canonical slug.');

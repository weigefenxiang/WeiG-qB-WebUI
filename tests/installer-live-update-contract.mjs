import assert from 'node:assert/strict';
import fs from 'node:fs';

const sh=fs.readFileSync('installers/install.sh','utf8');
const ps=fs.readFileSync('installers/install.ps1','utf8');

const shellDeploy=sh.slice(sh.indexOf('deploy_staged_webui() {'),sh.indexOf('restore_webui_from_backup() {'));
assert.ok(shellDeploy.includes('[ -f "$deploy_dest/public/index.html" ]')&&shellDeploy.includes('[ -f "$deploy_dest/private/index.html" ]'),'Linux live update must require both existing Alternative WebUI entry files before mutation.');
assert.ok(shellDeploy.includes('cp -p -- "$deploy_src" "$deploy_tmp"')&&shellDeploy.includes('mv -f -- "$deploy_tmp" "$deploy_dst"'),'Linux live update must stage each replacement in the destination directory and atomically rename it into place.');
assert.ok(!shellDeploy.includes('rm -rf -- "$deploy_dest"')&&!shellDeploy.includes('mv "$deploy_dest"'),'Linux live update must never remove or rename the active Root Folder.');
assert.ok(sh.includes('if [ "$CONFIGURE" -eq 1 ] && [ "$TARGET_COUNT" -eq 1 ]; then\n    cfg=$(find_config || true)'),'Linux ordinary Install/Update backups must not capture qBittorrent config unless Configure is explicit.');
assert.ok(sh.includes('if [ "$CONFIGURE" -eq 1 ]; then\n    [ -s "$b/config-path" ]'),'Linux rollback must make qB config restore an explicit Configure operation.');
assert.ok(!sh.includes('mv "$target" "$old"'),'Linux current deployment must retire the whole-directory live switch.');

const psDeploy=ps.slice(ps.indexOf('function Install-WebUiStage'),ps.indexOf('function Restore-WebUiBackup'));
assert.ok(psDeploy.includes("Join-Path $Target 'public\\index.html'")&&psDeploy.includes("Join-Path $Target 'private\\index.html'"),'Windows live update must require both existing Alternative WebUI entry files before mutation.');
assert.ok(psDeploy.includes('[IO.File]::Replace($temp,$destination,$replaceBackup,$true)'),'Windows live update must atomically replace existing files from same-directory temporary files.');
assert.ok(!psDeploy.includes('Remove-Item -LiteralPath $Target -Recurse')&&!psDeploy.includes('Move-Item -LiteralPath $Target'),'Windows live update must never remove or rename the active Root Folder.');
assert.ok(ps.includes("if($Configure){\n    $old=Join-Path $b 'qBittorrent.conf'"),'Windows rollback must make qB config restore an explicit Configure operation.');
assert.ok(!ps.includes('Move-Item $Destination $old'),'Windows current deployment must retire the whole-directory live switch.');

const windowsMain=ps.slice(ps.indexOf('$cfg=$null\nif($Configure){'),ps.indexOf('$tmp=Join-Path'));
assert.ok(windowsMain.includes('$deploymentBackup=Backup-Current $cfg'),'Windows ordinary Install/Update must feed Backup-Current a null config owner unless Configure was explicit.');

console.log('Installer live-update contract passed: Windows/Linux keep the active Alternative WebUI root continuously present, share live-safe restore primitives, and isolate qB config mutation behind explicit Configure.');

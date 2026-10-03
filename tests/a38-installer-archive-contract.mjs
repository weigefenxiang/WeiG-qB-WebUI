import assert from 'node:assert/strict';
import fs from 'node:fs';

const sh=fs.readFileSync('installers/install.sh','utf8');
const ps=fs.readFileSync('installers/install.ps1','utf8');

assert.match(sh,/create_webui_backup_payload\(\).*tar -C "\$backup_source" -czf[\s\S]*7z 7za[\s\S]*zip -qry/s,'Linux inner payload owner must retain its verified local-tool fallback chain.');
assert.match(sh,/record_backup_archive\(\).*backup_sha256[\s\S]*archive-manifest/s,'Linux inner payload remains SHA-256 bound.');
assert.match(sh,/backup_record_pack\(\)[\s\S]*tar -C "\$record" -czf[\s\S]*has_busybox_applet tar/s,'Linux outer single-file record must be tar.gz via native or BusyBox tar.');
assert.match(sh,/verify_backup_archive\(\).*checksum mismatch[\s\S]*extract_webui_backup_payload/s,'Linux rollback must continue verifying the inner payload before live restore.');
assert.match(sh,/if \[ -d "\$backup_extract_root\/webui" \][\s\S]*cp -Rp/s,'Linux keeps the explicit read-only legacy backup/webui reader.');
assert.match(sh,/restore_stage="\$dest\.weig-restore\.\$\$"[\s\S]*extract_webui_backup_payload[\s\S]*deploy_staged_webui "\$dest" "\$restore_stage"/s,'Linux rollback must reuse live-safe deployment after record/payload verification.');

assert.match(ps,/function New-WebUiBackupPayload[\s\S]*ZipFile\]::CreateFromDirectory[\s\S]*Get-Command tar\.exe,tar[\s\S]*Get-Command 7z\.exe,7za\.exe,7z,7za/s,'Windows inner payload owner must retain its verified local-tool fallback chain.');
assert.match(ps,/function Save-BackupArchiveManifest[\s\S]*Get-FileHash -Algorithm SHA256/s,'Windows inner payload remains SHA-256 bound.');
assert.match(ps,/function New-BackupRecordArchive[\s\S]*ZipFile\]::CreateFromDirectory\(\$Record,\$temp/s,'Windows outer current record must be one ZIP using the built-in archive owner.');
assert.match(ps,/function Assert-BackupArchive[\s\S]*checksum mismatch[\s\S]*function Expand-WebUiBackupPayload/s,'Windows rollback must continue checksum verification of the inner payload.');
assert.match(ps,/\$legacy=Join-Path \$Backup 'webui'[\s\S]*Copy-Item -LiteralPath \$legacy/s,'Windows keeps the bounded legacy backup/webui reader.');
assert.match(ps,/\$stage="\$Target\.weig-restore-\$PID-[^"]+"[\s\S]*Expand-WebUiBackupPayload[\s\S]*Install-WebUiStage \$stage \$Target/s,'Windows rollback must reuse live-safe deployment.');
assert.doesNotMatch(sh,/backup_target\(\)[\s\S]{0,1200}mkdir -p "\$b"/,'Linux current writer must not expose a per-backup directory.');
assert.doesNotMatch(ps,/function Backup-Current[\s\S]{0,1200}New-Item -ItemType Directory -Force -Path \$b/,'Windows current writer must not expose a per-backup directory.');
console.log('A48 installer archive contract passed: current backups are one outer archive while verified payload/legacy readers remain reusable compatibility owners.');

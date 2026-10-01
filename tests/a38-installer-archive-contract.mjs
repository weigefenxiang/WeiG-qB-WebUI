import assert from 'node:assert/strict';
import fs from 'node:fs';

const sh=fs.readFileSync('installers/install.sh','utf8');
const ps=fs.readFileSync('installers/install.ps1','utf8');

assert.match(sh,/create_webui_backup_payload\(\).*tar -C "\$backup_source" -czf[\s\S]*7z 7za[\s\S]*zip -qry/s,'Linux archive owner must prefer tar.gz and share one ordered 7z/zip fallback chain.');
assert.match(sh,/record_backup_archive\(\).*backup_sha256[\s\S]*archive-manifest/s,'Linux archive writer must bind payload metadata to SHA-256.');
assert.match(sh,/verify_backup_archive\(\).*checksum mismatch[\s\S]*extract_webui_backup_payload/s,'Linux rollback must checksum before extraction.');
assert.match(sh,/if \[ -d "\$backup_extract_root\/webui" \][\s\S]*cp -a/s,'Linux must retain one explicit read-only legacy directory path.');
assert.match(sh,/restore_stage="\$dest\.weig-restore\.\$\$"[\s\S]*extract_webui_backup_payload[\s\S]*rm -rf -- "\$dest"[\s\S]*mv "\$restore_stage" "\$dest"/s,'Linux must prepare a verified sibling staging tree before live replacement.');

assert.match(ps,/function New-WebUiBackupPayload[\s\S]*ZipFile\]::CreateFromDirectory[\s\S]*Get-Command tar\.exe,tar[\s\S]*Get-Command 7z\.exe,7za\.exe,7z,7za/s,'Windows must prefer built-in ZIP and discover local tar/7z fallbacks through one payload owner.');
assert.match(ps,/function Save-BackupArchiveManifest[\s\S]*Get-FileHash -Algorithm SHA256/s,'Windows archive writer must bind payload metadata to SHA-256.');
assert.match(ps,/function Assert-BackupArchive[\s\S]*checksum mismatch[\s\S]*function Expand-WebUiBackupPayload/s,'Windows rollback must checksum before extraction.');
assert.match(ps,/\$legacy=Join-Path \$Backup 'webui'[\s\S]*Copy-Item -LiteralPath \$legacy/s,'Windows must retain one explicit read-only legacy directory path.');
assert.match(ps,/\$stage="\$Destination\.weig-restore-\$PID-[^"]+"[\s\S]*Expand-WebUiBackupPayload[\s\S]*Remove-Item -LiteralPath \$Destination[\s\S]*Move-Item -LiteralPath \$stage -Destination \$Destination/s,'Windows must prepare a verified sibling staging tree before live replacement.');

assert.doesNotMatch(sh,/backup_target\(\)[\s\S]{0,900}cp -a "\$dest" "\$b\/webui"/,'Linux backup_target must no longer own an unconditional directory-copy writer.');
assert.doesNotMatch(ps,/function Backup-Current[\s\S]{0,900}Copy-Item \$Destination \(Join-Path \$b 'webui'\)/,'Windows Backup-Current must no longer own an unconditional directory-copy writer.');
assert.doesNotMatch(sh,/cp -a "\$backup_source" "\$backup_root\/webui"/,'Linux current backup writer must never recreate the legacy backup/webui directory format.');
assert.doesNotMatch(ps,/Copy-Item -LiteralPath \$Source -Destination \(Join-Path \$Backup 'webui'\)/,'Windows current backup writer must never recreate the legacy backup/webui directory format.');
assert.match(sh,/refusing an unverified directory backup[\s\S]*return 1/,'Linux must fail closed when no verified compressed backup backend remains.');
assert.match(ps,/refusing an unverified directory backup[\s\S]*return \$false/,'Windows must fail closed when no verified compressed backup backend remains.');
console.log('A38 installer archive contract passed: new backups are compressed + checksummed or fail closed; exact-target retention/rollback preserve only bounded legacy directory readers.');

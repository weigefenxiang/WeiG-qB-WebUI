import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ps=fs.readFileSync(path.join(root,'installers/install.ps1'),'utf8');
const sh=fs.readFileSync(path.join(root,'installers/install.sh'),'utf8');

assert.ok(sh.includes('BACKUP_RETENTION=3')&&sh.includes('owned_backups_for_dest() {')&&sh.includes('prune_backups_for_dest() {')&&sh.includes('purge_backups_for_dest() {'),'Linux must keep one exact-target inventory owner for rollback, retention and purge.');
assert.match(sh,/reserve_backup_path\(\)[\s\S]*name="\$stamp\.tar\.gz"[\s\S]*name="\$stamp-\$suffix\.tar\.gz"/s,'Linux current backups must use a readable minute stamp and add a suffix only on collision.');
assert.match(sh,/BACKUP_STAMP=\$\(date '\+%Y%m%d-%H%M'\)/,'Linux current timestamps must be minute-readable instead of exposing seconds/target/PID.');
assert.match(sh,/backup_target\(\)[\s\S]*record=\$\(portable_mktemp_dir\)[\s\S]*create_webui_backup_payload "\$dest" "\$record"[\s\S]*backup_record_pack "\$record" "\$b"/s,'Linux must stage the compatible record privately and publish one outer tar.gz only.');
assert.doesNotMatch(sh,/b="\$BACKUPS\/\$BACKUP_STAMP-\$suffix-\$\$"/,'Linux must retire PID/ordinal directory names as the current writer.');
assert.match(sh,/backup_is_owned\(\)[\s\S]*backup_record_read "\$backup" had-webui[\s\S]*backup_record_read "\$backup" dest-path/s,'Linux ownership must consume the same record reader for current archives and legacy directories.');
assert.match(sh,/owned_backups_for_dest\(\)[\s\S]*for backup_root in "\$BACKUPS" "\$LEGACY_BACKUPS"[\s\S]*backup_record_read "\$backup" dest-path/s,'Linux inventory must span canonical and bounded legacy roots without a second owner.');
assert.ok(sh.indexOf("printf '%s\\n' \"$b\" > \"$STATE/last-backup\"")<sh.indexOf('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'),'Linux must publish rollback identity before retention pruning.');
assert.match(sh,/extract_webui_backup_payload\(\)[\s\S]*if \[ -f "\$backup_extract_root" \][\s\S]*backup_record_unpack[\s\S]*if \[ -d "\$backup_extract_root\/webui" \]/s,'Linux restore must unwrap current bundles then retain the bounded legacy payload reader.');

assert.ok(ps.includes('function Get-OwnedBackupsForDestination([string]$Target)')&&ps.includes('function Prune-Backups([string]$Target,[int]$Keep=3)')&&ps.includes('function Purge-BackupsForDestination([string]$Target)'),'Windows must keep one exact-target inventory owner for rollback, retention and purge.');
assert.match(ps,/function New-BackupArchivePath[\s\S]*yyyyMMdd-HHmm[\s\S]*"\$stamp\.zip"[\s\S]*ToString\('00'\)[\s\S]*\.zip/s,'Windows current backups must use readable minute ZIP names with collision suffixes.');
assert.match(ps,/function Backup-Current[\s\S]*New-BackupArchivePath[\s\S]*New-WebUiBackupPayload \$Destination \$record[\s\S]*New-BackupRecordArchive \$record \$b/s,'Windows must stage the compatible record privately and publish one outer ZIP only.');
assert.match(ps,/function Test-BackupOwned[\s\S]*Read-BackupRecordText \$Backup 'had-webui'[\s\S]*Read-BackupRecordText \$Backup 'dest-path'/s,'Windows ownership must consume one record reader for current archives and legacy directories.');
assert.match(ps,/function Get-OwnedBackupsForDestination[\s\S]*@\(\$Backups,\$LegacyBackups\)[\s\S]*Test-BackupOwned/s,'Windows inventory must span canonical and bounded legacy roots.');
assert.match(ps,/function Expand-WebUiBackupPayload[\s\S]*Test-Path -LiteralPath \$Backup -PathType Leaf[\s\S]*ExtractToDirectory\(\$Backup,\$record\)[\s\S]*\$legacy=Join-Path \$Backup 'webui'/s,'Windows restore must unwrap current bundles then retain the bounded legacy reader.');
assert.ok(ps.indexOf("Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-backup') -Value $b")<ps.indexOf('Prune-Backups $Destination 3'),'Windows must publish rollback identity before retention pruning.');

console.log('Installer backup lifecycle contract passed: one visible current archive, shared exact-target inventory, bounded legacy readers, and target-scoped retention/purge.');

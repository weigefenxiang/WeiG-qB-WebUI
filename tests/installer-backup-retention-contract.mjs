import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ps=fs.readFileSync(path.join(root,'installers/install.ps1'),'utf8');
const sh=fs.readFileSync(path.join(root,'installers/install.sh'),'utf8');

assert.ok(ps.includes('function Get-OwnedBackupsForDestination([string]$Target)')&&ps.includes('function Prune-Backups([string]$Target,[int]$Keep=3)'), 'Windows installer must centralize exact-target backup ownership and retention.');
assert.ok(ps.includes("$item.Name -notmatch '^\\d{8}-\\d{6}(?:-\\d+)?
assert.ok(ps.includes("Join-Path $item.FullName 'had-webui'")&&ps.includes("Join-Path $item.FullName 'dest-path'"), 'Windows backup ownership must require installer markers before deletion.');
assert.ok(ps.includes('Sort-Object Name -Descending')&&ps.includes('Select-Object -Skip $Keep'), 'Windows pruning must preserve the newest owned backups.');
assert.ok(ps.includes('Prune-Backups $Destination 3'), 'Windows backup creation must cap retained backups at three for the exact destination.');
assert.ok(ps.indexOf("Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-backup') -Value $b")<ps.indexOf('Prune-Backups $Destination 3'), 'Windows must publish the new rollback pointer before pruning older backups.');
assert.ok(ps.includes('function Purge-BackupsForDestination([string]$Target)')&&ps.includes('Get-OwnedBackupsForDestination $Target'), 'Windows purge must reuse the canonical exact-target backup owner.');
assert.ok(ps.includes("if($Purge -and $Mode -ne 'Uninstall')")&&ps.includes('Purge-BackupsForDestination $Destination'), 'Windows -purge must be uninstall-only and target-scoped.');


assert.ok(ps.includes('function New-WebUiBackupPayload([string]$Source,[string]$Backup)')&&ps.includes('[IO.Compression.ZipFile]::CreateFromDirectory'),'Windows backup payload must prefer the built-in compressed ZIP owner before external tools.');
assert.ok(ps.includes("Get-Command tar.exe,tar")&&ps.includes("Get-Command 7z.exe,7za.exe,7z,7za"),'Windows archive owner must discover alternate local tar/7z backends without downloading tools.');
assert.ok(ps.includes('function Save-BackupArchiveManifest')&&ps.includes('Get-FileHash -Algorithm SHA256'),'Windows compressed backups must publish a SHA-256-bound archive manifest.');
assert.ok(ps.includes('function Expand-WebUiBackupPayload')&&ps.includes("Join-Path $Backup 'webui'"),'Windows restore must centralize archive extraction while retaining a bounded legacy directory reader.');
assert.ok(ps.includes('$stage="$Target.weig-restore-$PID-')&&ps.includes('Install-WebUiStage $stage $Target'),'Windows rollback must stage, verify, and restore through the shared live-safe deployment owner.');

assert.ok(sh.includes('BACKUP_RETENTION=3'), 'Shell installer must define the three-backup retention policy explicitly.');
assert.ok(sh.includes('prune_backups_for_dest() {'), 'Shell installer must own target-scoped backup retention.');
assert.ok(sh.includes('owned_backups_for_dest() {')&&sh.includes('latest_backup_for_dest() {'), 'Shell backup lookup must centralize exact-target ownership before rollback/retention/purge.');
assert.ok(sh.includes('backup_is_owned() {')&&sh.includes('[ -f "$backup/had-webui" ]')&&sh.includes('[ -f "$backup/dest-path" ]'), 'Shell backup ownership must require installer markers before deletion.');
assert.ok(sh.includes('saved_dest=$(cat "$backup/dest-path"')&&sh.includes('[ "$saved_dest" = "$target" ] || continue'), 'Shell canonical backup inventory must isolate ownership by exact install target.');
assert.match(sh,/owned_backups_for_dest\(\) \{[\s\S]*for backup_root in "\$BACKUPS" "\$LEGACY_BACKUPS"; do[\s\S]*for backup in "\$backup_root"\/\*; do[\s\S]*done \| sort -r/s, 'Shell backup inventory must retain newest-first ordering while sharing one owner across canonical and bounded legacy roots.');
assert.match(sh,/b="\$BACKUPS\/\$BACKUP_STAMP-\$suffix-\$\$"/, 'Shell multi-target backups must be uniquely timestamped under the shared backup root.');
assert.ok(sh.includes('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'), 'Shell successful deployment must cap each target independently at three backups.');
assert.ok(sh.indexOf("printf '%s\\n' \"$b\" > \"$STATE/last-backup\"")<sh.indexOf('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'), 'Shell must publish rollback pointers before pruning older target backups.');
assert.ok(sh.includes('purge_backups_for_dest() {')&&sh.includes('owned_backups_for_dest "$target"'), 'Shell purge must reuse the canonical exact-target backup owner.');
assert.ok(sh.includes('[ "$PURGE_BACKUPS" -eq 1 ] && [ "$MODE" != "uninstall" ]')&&sh.includes('purge_backups_for_dest "$target"'), 'Shell -purge must be uninstall-only and target-scoped.');

assert.ok(sh.includes('create_webui_backup_payload() {')&&sh.includes('tar -C "$backup_source" -czf'),'Linux backup payload must prefer compressed tar.gz when supported.');
assert.ok(sh.includes('for backup_tool in 7z 7za')&&sh.includes('command -v zip'),'Linux archive owner must discover alternate local 7z/zip backends without downloading tools.');
assert.ok(sh.includes('record_backup_archive() {')&&sh.includes('backup_sha256() {')&&sh.includes('archive-manifest'),'Linux compressed backups must publish a SHA-256-bound archive manifest.');
assert.ok(sh.includes('extract_webui_backup_payload() {')&&sh.includes('[ -d "$backup_extract_root/webui" ]'),'Linux restore must centralize archive extraction while retaining a bounded legacy directory reader.');
assert.ok(sh.includes('restore_stage="$dest.weig-restore.$$"')&&sh.includes('deploy_staged_webui "$dest" "$restore_stage"'),'Linux rollback must extract, verify, and restore through the shared live-safe deployment owner.');

console.log('Installer backup lifecycle contract passed: Linux and Windows keep exact-target ownership/retention, prefer SHA-256-bound compressed payloads, retain bounded legacy readers, and only permit destructive purge during uninstall.');
"), 'Windows backup ownership must accept canonical timestamps plus bounded historical numeric suffixes while rejecting unrelated directories.');
assert.ok(ps.includes("Join-Path $item.FullName 'had-webui'")&&ps.includes("Join-Path $item.FullName 'dest-path'"), 'Windows backup ownership must require installer markers before deletion.');
assert.ok(ps.includes('Sort-Object Name -Descending')&&ps.includes('Select-Object -Skip $Keep'), 'Windows pruning must preserve the newest owned backups.');
assert.ok(ps.includes('Prune-Backups $Destination 3'), 'Windows backup creation must cap retained backups at three for the exact destination.');
assert.ok(ps.indexOf("Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-backup') -Value $b")<ps.indexOf('Prune-Backups $Destination 3'), 'Windows must publish the new rollback pointer before pruning older backups.');
assert.ok(ps.includes('function Purge-BackupsForDestination([string]$Target)')&&ps.includes('Get-OwnedBackupsForDestination $Target'), 'Windows purge must reuse the canonical exact-target backup owner.');
assert.ok(ps.includes("if($Purge -and $Mode -ne 'Uninstall')")&&ps.includes('Purge-BackupsForDestination $Destination'), 'Windows -purge must be uninstall-only and target-scoped.');


assert.ok(ps.includes('function New-WebUiBackupPayload([string]$Source,[string]$Backup)')&&ps.includes('[IO.Compression.ZipFile]::CreateFromDirectory'),'Windows backup payload must prefer the built-in compressed ZIP owner before external tools.');
assert.ok(ps.includes("Get-Command tar.exe,tar")&&ps.includes("Get-Command 7z.exe,7za.exe,7z,7za"),'Windows archive owner must discover alternate local tar/7z backends without downloading tools.');
assert.ok(ps.includes('function Save-BackupArchiveManifest')&&ps.includes('Get-FileHash -Algorithm SHA256'),'Windows compressed backups must publish a SHA-256-bound archive manifest.');
assert.ok(ps.includes('function Expand-WebUiBackupPayload')&&ps.includes("Join-Path $Backup 'webui'"),'Windows restore must centralize archive extraction while retaining a bounded legacy directory reader.');
assert.ok(ps.includes('$stage="$Target.weig-restore-$PID-')&&ps.includes('Install-WebUiStage $stage $Target'),'Windows rollback must stage, verify, and restore through the shared live-safe deployment owner.');

assert.ok(sh.includes('BACKUP_RETENTION=3'), 'Shell installer must define the three-backup retention policy explicitly.');
assert.ok(sh.includes('prune_backups_for_dest() {'), 'Shell installer must own target-scoped backup retention.');
assert.ok(sh.includes('owned_backups_for_dest() {')&&sh.includes('latest_backup_for_dest() {'), 'Shell backup lookup must centralize exact-target ownership before rollback/retention/purge.');
assert.ok(sh.includes('backup_is_owned() {')&&sh.includes('[ -f "$backup/had-webui" ]')&&sh.includes('[ -f "$backup/dest-path" ]'), 'Shell backup ownership must require installer markers before deletion.');
assert.ok(sh.includes('saved_dest=$(cat "$backup/dest-path"')&&sh.includes('[ "$saved_dest" = "$target" ] || continue'), 'Shell canonical backup inventory must isolate ownership by exact install target.');
assert.match(sh,/owned_backups_for_dest\(\) \{[\s\S]*for backup in "\$BACKUPS"\/\*; do[\s\S]*done \| sort -r/s, 'Shell backup inventory must retain newest-first ordering while iterating quoted glob results instead of whitespace-splitting command output.');
assert.match(sh,/b="\$BACKUPS\/\$BACKUP_STAMP-\$suffix-\$\$"/, 'Shell multi-target backups must be uniquely timestamped under the shared backup root.');
assert.ok(sh.includes('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'), 'Shell successful deployment must cap each target independently at three backups.');
assert.ok(sh.indexOf("printf '%s\\n' \"$b\" > \"$STATE/last-backup\"")<sh.indexOf('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'), 'Shell must publish rollback pointers before pruning older target backups.');
assert.ok(sh.includes('purge_backups_for_dest() {')&&sh.includes('owned_backups_for_dest "$target"'), 'Shell purge must reuse the canonical exact-target backup owner.');
assert.ok(sh.includes('[ "$PURGE_BACKUPS" -eq 1 ] && [ "$MODE" != "uninstall" ]')&&sh.includes('purge_backups_for_dest "$target"'), 'Shell -purge must be uninstall-only and target-scoped.');

assert.ok(sh.includes('create_webui_backup_payload() {')&&sh.includes('tar -C "$backup_source" -czf'),'Linux backup payload must prefer compressed tar.gz when supported.');
assert.ok(sh.includes('for backup_tool in 7z 7za')&&sh.includes('command -v zip'),'Linux archive owner must discover alternate local 7z/zip backends without downloading tools.');
assert.ok(sh.includes('record_backup_archive() {')&&sh.includes('backup_sha256() {')&&sh.includes('archive-manifest'),'Linux compressed backups must publish a SHA-256-bound archive manifest.');
assert.ok(sh.includes('extract_webui_backup_payload() {')&&sh.includes('[ -d "$backup_extract_root/webui" ]'),'Linux restore must centralize archive extraction while retaining a bounded legacy directory reader.');
assert.ok(sh.includes('restore_stage="$dest.weig-restore.$$"')&&sh.includes('deploy_staged_webui "$dest" "$restore_stage"'),'Linux rollback must extract, verify, and restore through the shared live-safe deployment owner.');

console.log('Installer backup lifecycle contract passed: Linux and Windows keep exact-target ownership/retention, prefer SHA-256-bound compressed payloads, retain bounded legacy readers, and only permit destructive purge during uninstall.');

assert.ok(ps.includes('$stateMatchesTarget=$false')&&ps.includes("Join-Path $stateRoot 'last-backup'"),'Windows purge must clear stale canonical/legacy rollback markers by target ownership.');
assert.ok(sh.includes('marker_matches_target=0')&&sh.includes('marker_root/last-backup'),'Linux purge must clear stale canonical/legacy rollback markers by target ownership.');

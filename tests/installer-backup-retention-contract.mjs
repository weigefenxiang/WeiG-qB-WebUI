import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ps=fs.readFileSync(path.join(root,'installers/install.ps1'),'utf8');
const sh=fs.readFileSync(path.join(root,'installers/install.sh'),'utf8');

assert.ok(ps.includes('function Get-OwnedBackupsForDestination([string]$Target)')&&ps.includes('function Prune-Backups([string]$Target,[int]$Keep=3)'), 'Windows installer must centralize exact-target backup ownership and retention.');
assert.ok(ps.includes("$_.Name -match '^\\d{8}-\\d{6}$'"), 'Windows pruning must only consider timestamp-named backup directories.');
assert.ok(ps.includes("Join-Path $_.FullName 'had-webui'")&&ps.includes("Join-Path $_.FullName 'dest-path'"), 'Windows pruning must require installer ownership markers before deletion.');
assert.ok(ps.includes('Sort-Object Name -Descending')&&ps.includes('Select-Object -Skip $Keep'), 'Windows pruning must preserve the newest owned backups.');
assert.ok(ps.includes('Prune-Backups $Destination 3'), 'Windows backup creation must cap retained backups at three for the exact destination.');
assert.ok(ps.indexOf("Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-backup') -Value $b")<ps.indexOf('Prune-Backups $Destination 3'), 'Windows must publish the new rollback pointer before pruning older backups.');
assert.ok(ps.includes('function Purge-BackupsForDestination([string]$Target)')&&ps.includes('Get-OwnedBackupsForDestination $Target'), 'Windows purge must reuse the canonical exact-target backup owner.');
assert.ok(ps.includes("if($Purge -and $Mode -ne 'Uninstall')")&&ps.includes('Purge-BackupsForDestination $Destination'), 'Windows -purge must be uninstall-only and target-scoped.');

assert.ok(sh.includes('BACKUP_RETENTION=3'), 'Shell installer must define the three-backup retention policy explicitly.');
assert.ok(sh.includes('prune_backups_for_dest() {'), 'Shell installer must own target-scoped backup retention.');
assert.ok(sh.includes('owned_backups_for_dest() {')&&sh.includes('latest_backup_for_dest() {'), 'Shell backup lookup must centralize exact-target ownership before rollback/retention/purge.');
assert.ok(sh.includes('backup_is_owned() {')&&sh.includes('[ -f "$backup/had-webui" ]')&&sh.includes('[ -f "$backup/dest-path" ]'), 'Shell pruning must require installer ownership markers before deletion.');
assert.ok(sh.includes('saved_dest=$(cat "$backup/dest-path"')&&sh.includes('[ "$saved_dest" = "$target" ] || continue'), 'Shell canonical backup inventory must isolate ownership by exact install target.');
assert.ok(sh.includes('sort -r | while IFS= read -r backup'), 'Shell pruning must retain backups newest-first without whitespace-unsafe word splitting.');
assert.match(sh,/b="\$BACKUPS\/\$BACKUP_STAMP-\$suffix-\$\$"/, 'Shell multi-target backups must be uniquely timestamped under the shared backup root.');
assert.ok(sh.includes('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'), 'Shell successful deployment must cap each target independently at three backups.');
assert.ok(sh.indexOf("printf '%s\\n' \"$b\" > \"$STATE/last-backup\"")<sh.indexOf('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'), 'Shell must publish rollback pointers before pruning older target backups.');
assert.ok(sh.includes('purge_backups_for_dest() {')&&sh.includes('owned_backups_for_dest "$target"'), 'Shell purge must reuse the canonical exact-target backup owner.');
assert.ok(sh.includes('[ "$PURGE_BACKUPS" -eq 1 ] && [ "$MODE" != "uninstall" ]')&&sh.includes('purge_backups_for_dest "$target"'), 'Shell -purge must be uninstall-only and target-scoped.');

console.log('Installer backup lifecycle contract passed: Linux and Windows keep exact-target owned backups, share retention ownership with purge, and only permit destructive purge during uninstall.');

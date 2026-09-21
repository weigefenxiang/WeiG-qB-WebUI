import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ps=fs.readFileSync(path.join(root,'installers/install.ps1'),'utf8');
const sh=fs.readFileSync(path.join(root,'installers/install.sh'),'utf8');

assert.ok(ps.includes('function Prune-Backups([int]$Keep=3)'), 'Windows installer must own an explicit backup retention function.');
assert.ok(ps.includes("$_.Name -match '^\\d{8}-\\d{6}$'"), 'Windows pruning must only consider timestamp-named backup directories.');
assert.ok(ps.includes("Join-Path $_.FullName 'had-webui'")&&ps.includes("Join-Path $_.FullName 'dest-path'"), 'Windows pruning must require installer ownership markers before deletion.');
assert.ok(ps.includes('Sort-Object Name -Descending')&&ps.includes('Select-Object -Skip $Keep'), 'Windows pruning must preserve the newest owned backups.');
assert.ok(ps.includes('Prune-Backups 3'), 'Windows backup creation must cap retained backups at three.');
assert.ok(ps.indexOf("Set-Content -Encoding UTF8 -Path (Join-Path $State 'last-backup') -Value $b")<ps.indexOf('Prune-Backups 3'), 'Windows must publish the new rollback pointer before pruning older backups.');

assert.ok(sh.includes('BACKUP_RETENTION=3'), 'Shell installer must define the three-backup retention policy explicitly.');
assert.ok(sh.includes('prune_backups_for_dest() {'), 'Shell installer must own target-scoped backup retention.');
assert.ok(sh.includes('latest_backup_for_dest() {'), 'Shell rollback must resolve the newest backup for an explicit target.');
assert.ok(sh.includes('backup_is_owned() {')&&sh.includes('[ -f "$backup/had-webui" ]')&&sh.includes('[ -f "$backup/dest-path" ]'), 'Shell pruning must require installer ownership markers before deletion.');
assert.ok(sh.includes('saved_dest=$(cat "$backup/dest-path"')&&sh.includes('[ "$saved_dest" = "$target" ] || continue'), 'Shell pruning must isolate retention by exact install target.');
assert.ok(sh.includes('sort -r | while IFS= read -r backup'), 'Shell pruning must retain backups newest-first without whitespace-unsafe word splitting.');
assert.match(sh,/b="\$BACKUPS\/\$BACKUP_STAMP-\$suffix-\$\$"/, 'Shell multi-target backups must be uniquely timestamped under the shared backup root.');
assert.ok(sh.includes('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'), 'Shell successful deployment must cap each target independently at three backups.');
assert.ok(sh.indexOf("printf '%s\\n' \"$b\" > \"$STATE/last-backup\"")<sh.indexOf('prune_backups_for_dest "$target" "$BACKUP_RETENTION"'), 'Shell must publish rollback pointers before pruning older target backups.');

console.log('Installer backup retention contract passed: Windows keeps three owned backups; Linux keeps three owned backups independently per install target under the shared backup root, with exact target-scoped rollback and pruning.');

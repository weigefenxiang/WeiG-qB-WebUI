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

assert.ok(sh.includes('prune_backups() {'), 'Shell installer must own an explicit backup retention function.');
assert.ok(sh.includes("grep -Eq '^[0-9]{8}-[0-9]{6}$'"), 'Shell pruning must only consider timestamp-named backup directories.');
assert.ok(sh.includes('[ -f "$backup/had-webui" ] && [ -f "$backup/dest-path" ] || continue'), 'Shell pruning must require installer ownership markers before deletion.');
assert.ok(sh.includes('sort -r | while IFS= read -r backup'), 'Shell pruning must retain backups newest-first without whitespace-unsafe word splitting.');
assert.ok(sh.includes('prune_backups 3'), 'Shell backup creation must cap retained backups at three.');
assert.ok(sh.indexOf("printf '%s\\n' \"$b\" > \"$STATE/last-backup\"")<sh.indexOf('prune_backups 3'), 'Shell must publish the new rollback pointer before pruning older backups.');

console.log('Installer backup retention contract passed: Windows and shell retain at most the newest three owned backups while leaving unrelated backup-directory content outside the pruning ownership boundary.');

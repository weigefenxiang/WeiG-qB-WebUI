import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const sh=fs.readFileSync(path.join(root,'installers/install.sh'),'utf8');
const ps=fs.readFileSync(path.join(root,'installers/install.ps1'),'utf8');
const publicIndex=fs.readFileSync(path.join(root,'webui/public/index.html'),'utf8');
const publicLogin=fs.readFileSync(path.join(root,'webui/public/login.html'),'utf8');
const privateIndex=fs.readFileSync(path.join(root,'webui/private/index.html'),'utf8');

for(const rel of ['webui/public/index.html','webui/public/login.html','webui/private/index.html']){
  assert.ok(fs.statSync(path.join(root,rel)).isFile(),`${rel} must be a regular file`);
}

assert.match(sh,/\$SRC\/public\/index\.html/,'Linux installer must validate public/index.html before install');
assert.match(sh,/\$DEST\.new\/public\/index\.html/,'Linux installer must validate staged public/index.html');
assert.match(sh,/QBT_ROOT_FOLDER="\/config\/\$rel"/,'Linux Docker install must map host paths to qB-visible /config paths');
assert.match(sh,/WebUI\\\\AlternativeUIEnabled=true/,'Linux installer must enable Alternative WebUI only when configured');
assert.match(sh,/WebUI\\\\RootFolder=%s/,'Linux installer must persist qB-visible RootFolder');
assert.match(sh,/releases\/latest\/download\/WeiG-qB-WebUI\.zip/,'Linux stable installer must consume the latest Release asset');
assert.match(sh,/releases\/latest\/download\/SHA256SUMS/,'Linux stable installer must consume the published checksum');
assert.doesNotMatch(sh,/archive\/refs\/heads\/main\.zip/,'Linux stable installer must fail closed instead of falling back to main');
assert.doesNotMatch(sh,/resolve_main_sha/,'Linux stable installer must not resolve main as a payload source');

assert.match(ps,/public\\index\.html/,'Windows installer must validate public/index.html');
assert.match(ps,/\$env:LOCALAPPDATA\\WeiG-qB-WebUI/,'Windows installer must use a user-writable default destination');
assert.match(ps,/APPDATA 'qBittorrent\\qBittorrent\.ini'/,'Windows installer must search the canonical roaming qBittorrent config path');
assert.match(ps,/WebUI\\AlternativeUIEnabled=true/,'Windows installer must persist Alternative WebUI enabled state');
assert.match(ps,/WebUI\\RootFolder=/,'Windows installer must persist the native Windows RootFolder');
assert.match(ps,/releases\/latest\/download\/WeiG-qB-WebUI\.zip/,'Windows stable installer must consume the latest Release asset');
assert.match(ps,/releases\/latest\/download\/SHA256SUMS/,'Windows stable installer must consume the published checksum');
assert.doesNotMatch(ps,/archive\/refs\/heads\/main\.zip/,'Windows stable installer must fail closed instead of falling back to main');
assert.doesNotMatch(ps,/Resolve-MainSha/,'Windows stable installer must not resolve main as a payload source');

for(const [name,html] of [['public/index.html',publicIndex],['public/login.html',publicLogin]]){
  assert.match(html,/api\/v2\/auth\/login/,`${name} must use relative same-origin WebAPI login`);
  assert.match(html,/status===204/,`${name} must accept modern qB 5.x 204 login`);
  assert.match(html,/status===401/,`${name} must handle modern bad credentials`);
  assert.match(html,/text==='Ok\.'/ ,`${name} must accept legacy qB 4.x Ok. login`);
  assert.doesNotMatch(html,/[A-Za-z]:\\|\/config\/weigg-qb-webui/,`${name} must not embed OS/deployment-specific paths`);
}
assert.match(privateIndex,/scripts\/qb-client\.js/,'private WebUI must load the shared API compatibility client');

console.log('Platform contract passed: Windows/Linux stable installers are Release-only and fail closed; all Alternate WebUI entry points are validated; runtime remains same-origin and OS-neutral.');

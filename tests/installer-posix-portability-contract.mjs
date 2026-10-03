import assert from 'node:assert/strict';
import fs from 'node:fs';
const sh=fs.readFileSync(new URL('../installers/install.sh',import.meta.url),'utf8');
assert.ok(sh.startsWith('#!/usr/bin/env sh\nset -eu'));
for(const [label,re] of [
 ['GNU find depth/quit flags',/find[^\n]*-(?:maxdepth|mindepth|quit)\b/],
 ['sed -i',/\bsed\s+-i\b/],
 ['cp -a',/\bcp\s+-a\b/],
 ['GNU-style -- on fileutils',/\b(?:cp|mv|rm|rmdir)\b[^\n]*\s--(?:\s|$)/],
 ['direct mktemp lifecycle calls',/\b(?:TMP|tmp_cfg)=\$\(\s*mktemp\b/],
 ['BASH_SOURCE',/BASH_SOURCE/]
]) assert.doesNotMatch(sh,re,label);
assert.match(sh,/portable_mktemp_dir\(\)[\s\S]*command -v mktemp[\s\S]*has_busybox_applet mktemp[\s\S]*pm_candidate="\$pm_base\/weig-qb-webui-\$\$-\$pm_i"[\s\S]*mkdir "\$pm_candidate"/,'fallback temp directories must include the process id to avoid cross-process collisions');
assert.match(sh,/portable_mktemp_file\(\)[\s\S]*command -v mktemp[\s\S]*has_busybox_applet mktemp[\s\S]*pm_candidate="\$pm_dir\/\$pm_prefix-\$\$-\$pm_i"[\s\S]*mkdir "\$pm_lock"/,'fallback temp files must include the process id before the lock claim');
assert.match(sh,/download_file\(\)[\s\S]*command -v curl[\s\S]*command -v wget[\s\S]*has_busybox_applet wget[\s\S]*command -v python3/s);
assert.match(sh,/extract_zip\(\)[\s\S]*command -v unzip[\s\S]*has_busybox_applet unzip[\s\S]*command -v bsdtar[\s\S]*command -v python3/s);
assert.match(sh,/sha256_file\(\)[\s\S]*sha256sum[\s\S]*has_busybox_applet sha256sum[\s\S]*shasum[\s\S]*openssl[\s\S]*python3/s);
assert.match(sh,/owned_backups_for_dest\(\)[\s\S]*for backup in "\$BACKUPS"\/\*/s);
assert.match(sh,/inject_build_sha\(\)[\s\S]*sed "s\/__WEIG_GIT_SHA__[\s\S]*mv "\$inject_tmp" "\$inject_file"/s);
console.log('Installer POSIX portability contract passed.');

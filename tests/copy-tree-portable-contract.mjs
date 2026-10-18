import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {copyTreePortableSync} from '../tools/copy-tree-portable.mjs';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'weig-portable-copy-'));
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
try {
  for (const variant of ['ascii', '中文目录-Ελληνικά-日本語']) {
    const src = path.join(scratch, variant, 'source');
    const dst = path.join(scratch, variant, 'copied');
    fs.mkdirSync(path.join(src, '多级', 'nested'), {recursive:true});
    fs.mkdirSync(path.join(src, 'empty-folder'), {recursive:true});
    fs.writeFileSync(path.join(src, 'unicode-文件.txt'), '中文 / Ελληνικά / 日本語 / emoji 😀\n');
    fs.writeFileSync(path.join(src, '.hidden'), 'hidden\n');
    fs.writeFileSync(path.join(src, '多级', 'nested', 'binary.dat'), Buffer.from([0, 1, 2, 7, 19, 0, 255]));
    copyTreePortableSync(src, dst);
    for (const rel of ['unicode-文件.txt', '.hidden', '多级/nested/binary.dat']) {
      assert.equal(digest(path.join(src, rel)), digest(path.join(dst, rel)), `${variant} ${rel}: content changed`);
    }
    assert.ok(fs.statSync(path.join(dst, 'empty-folder')).isDirectory(), 'Empty directory must be preserved');
    fs.writeFileSync(path.join(src, 'unicode-文件.txt'), 'updated\n');
    copyTreePortableSync(src, dst);
    assert.equal(fs.readFileSync(path.join(dst, 'unicode-文件.txt'), 'utf8'), 'updated\n', 'Overwrite semantics must match force copy');
  }
  assert.throws(() => copyTreePortableSync(path.join(scratch, 'missing'), path.join(scratch, 'no-dest')), /ENOENT/);
  console.log('Portable WebUI directory copy PASS: ASCII/CJK source paths, nested Unicode paths, binary fidelity, empty/hidden files, overwrite and fail-closed source.');
} finally {
  fs.rmSync(scratch, {recursive:true, force:true});
}

import fs from 'node:fs';
import path from 'node:path';

// Copy WebUI source as regular files/directories without fs.cpSync, which
// can terminate Node 22 natively on Windows when a path contains CJK text.
// Fail closed on unexpected entry types instead of silently dropping assets.
export function copyTreePortableSync(source, destination) {
  const root = fs.lstatSync(source);
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error(`WebUI distribution source must be a real directory: ${source}`);
  }
  fs.mkdirSync(destination, {recursive:true});
  for (const entry of fs.readdirSync(source, {withFileTypes:true})) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyTreePortableSync(from, to);
    } else if (entry.isFile()) {
      fs.copyFileSync(from, to);
    } else {
      throw new Error(`Unsupported WebUI source entry (expected regular file/directory): ${from}`);
    }
  }
}

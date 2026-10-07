import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function verifyQbPeerFlags(root=defaultRoot){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/data/qb-peer-flags-manifest.json'),'utf8'));
  const dir=path.join(root,'webui/private/images/flags');
  const disk=fs.readdirSync(dir).filter(name=>name.endsWith('.svg')).sort();
  assert.equal(manifest.upstream.tag,'release-5.2.3');
  assert.equal(manifest.upstream.commit,'0b63c3d17373f6132ea211c9dcd4241284ccdfaf');
  assert.equal(disk.length,manifest.fileCount);
  let total=0;
  for(const item of manifest.files){
    const file=path.join(dir,item.path),buf=fs.readFileSync(file);total+=buf.length;
    assert.equal(buf.length,item.bytes,item.path+' byte size changed');
    const gitSha=crypto.createHash('sha1').update(Buffer.from('blob '+buf.length+'\0')).update(buf).digest('hex');
    assert.equal(gitSha,item.upstreamBlobSha,item.path+' is not the pinned upstream qB blob');
  }
  assert.equal(total,manifest.totalBytes);
  assert.deepEqual(disk,manifest.files.map(item=>item.path).slice().sort());
  return{fileCount:manifest.fileCount,totalBytes:manifest.totalBytes,tag:manifest.upstream.tag};
}
const isMain=process.argv[1]&&path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url));
if(isMain){const result=verifyQbPeerFlags();console.log('qB official flag snapshot verified:',result.fileCount,'SVGs,',result.totalBytes,'bytes,',result.tag);}

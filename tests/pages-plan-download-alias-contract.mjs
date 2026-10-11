import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publishDevPreviewZip} from '../tools/pages-dev-download-alias.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'weig-a73-pages-'));
const sha='a'.repeat(40),dist=path.join(root,'downloads','dev'),file='weig-qb-webui.zip';
try{
  await fs.mkdir(dist,{recursive:true});
  const zip=Buffer.from('verified A73 distribution ZIP fixture');
  const digest=crypto.createHash('sha256').update(zip).digest('hex');
  const manifest={
    schemaVersion:6,kind:'materialized-webui-dist',gitSha:sha,
    version:'1.2.1',zipArchive:file,artifacts:{zip:{file,sha256:digest,bytes:zip.length}}
  };
  const writeManifest=()=>fs.writeFile(path.join(dist,'manifest.json'),JSON.stringify(manifest),'utf8');
  await Promise.all([
    fs.writeFile(path.join(dist,file),zip),
    fs.writeFile(path.join(dist,'GIT_SHA'),sha+'\n'),
    fs.writeFile(path.join(dist,'VERSION'),'1.2.1\n'),
    writeManifest()
  ]);
  assert.equal(await publishDevPreviewZip({siteRoot:root,devSha:sha,devVersion:'1.2.2'}),null,'A new Dev version requires an explicit stage configuration update');
  await assert.rejects(publishDevPreviewZip({siteRoot:root,devSha:'b'.repeat(40),devVersion:'1.2.1'}),/mismatched/);
  const result=await publishDevPreviewZip({siteRoot:root,devSha:sha,devVersion:'1.2.1'});
  assert.equal(result.path,'downloads/dev/A73/'+file);
  const target=path.join(dist,'A73'),named='weig-qb-webui-A73.zip';
  assert.deepEqual(result.paths,['downloads/dev/A73/'+file,'downloads/dev/A73/'+named]);
  for(const name of [file,named])assert.deepEqual(await fs.readFile(path.join(target,name)),zip,'Both Pages names must contain the same verified payload');
  assert.equal(await fs.readFile(path.join(target,'SHA256SUMS'),'utf8'),digest+'  '+file+'\n'+digest+'  '+named+'\n');
  assert.equal((await fs.readFile(path.join(target,'GIT_SHA'),'utf8')).trim(),sha);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(target,'preview.json'),'utf8')),
    {schemaVersion:1,kind:'moving-plan-preview',plan:'A73',mutable:true,channel:'dev',gitSha:sha,version:'1.2.1',archive:file,archives:[file,named],sha256:digest,bytes:zip.length});
  await fs.writeFile(path.join(dist,file),Buffer.from('tampered ZIP'));
  await assert.rejects(publishDevPreviewZip({siteRoot:root,devSha:sha,devVersion:'1.2.1'}),/differs/,'Tampering must fail closed');
  console.log('A73 Pages alias contract passed: exact SHA, identical checksum-verified ZIP, mutable preview semantics, no A74 masquerade.');
}finally{
  await fs.rm(root,{recursive:true,force:true});
}

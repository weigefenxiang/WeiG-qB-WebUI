import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publishDevPreviewZip} from '../tools/pages-dev-download-alias.mjs';
import {readDevStage} from '../tools/dev-release-stage.mjs';

const stage=await readDevStage();
const otherVersion=stage.version.replace(/\d+$/,n=>String(Number(n)+1));
const root=await fs.mkdtemp(path.join(os.tmpdir(),'weig-dev-stage-pages-'));
const sha='a'.repeat(40),dist=path.join(root,'downloads','dev'),file='weig-qb-webui.zip';
try{
  await fs.mkdir(dist,{recursive:true});
  const zip=Buffer.from('verified '+stage.plan+' distribution ZIP fixture');
  const digest=crypto.createHash('sha256').update(zip).digest('hex');
  const manifest={
    schemaVersion:6,kind:'materialized-webui-dist',gitSha:sha,
    version:stage.version,zipArchive:file,artifacts:{zip:{file,sha256:digest,bytes:zip.length}}
  };
  const writeManifest=()=>fs.writeFile(path.join(dist,'manifest.json'),JSON.stringify(manifest),'utf8');
  await Promise.all([
    fs.writeFile(path.join(dist,file),zip),
    fs.writeFile(path.join(dist,'GIT_SHA'),sha+'\n'),
    fs.writeFile(path.join(dist,'VERSION'),stage.version+'\n'),
    writeManifest()
  ]);
  assert.equal(await publishDevPreviewZip({siteRoot:root,devSha:sha,devVersion:otherVersion}),null,'A different product version cannot impersonate the current Dev stage');
  await assert.rejects(publishDevPreviewZip({siteRoot:root,devSha:'b'.repeat(40),devVersion:stage.version}),/mismatched/);
  const result=await publishDevPreviewZip({siteRoot:root,devSha:sha,devVersion:stage.version});
  assert.equal(result.path,'downloads/dev/'+stage.plan+'/'+file);
  const target=path.join(dist,stage.plan),named=stage.namedZip;
  assert.deepEqual(result.paths,['downloads/dev/'+stage.plan+'/'+file,'downloads/dev/'+stage.plan+'/'+named]);
  for(const name of [file,named])assert.deepEqual(await fs.readFile(path.join(target,name)),zip,'Both Pages names must contain the same verified payload');
  assert.equal(await fs.readFile(path.join(target,'SHA256SUMS'),'utf8'),digest+'  '+file+'\n'+digest+'  '+named+'\n');
  assert.equal((await fs.readFile(path.join(target,'GIT_SHA'),'utf8')).trim(),sha);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(target,'preview.json'),'utf8')),
    {schemaVersion:1,kind:'moving-plan-preview',plan:stage.plan,mutable:true,channel:'dev',gitSha:sha,version:stage.version,archive:file,archives:[file,named],sha256:digest,bytes:zip.length});
  await fs.writeFile(path.join(dist,file),Buffer.from('tampered ZIP'));
  await assert.rejects(publishDevPreviewZip({siteRoot:root,devSha:sha,devVersion:stage.version}),/differs/,'Tampering must fail closed');
  console.log(stage.plan+' Pages alias contract passed: exact SHA, identical checksum-verified ZIP and stage-canonical preview.');
}finally{
  await fs.rm(root,{recursive:true,force:true});
}

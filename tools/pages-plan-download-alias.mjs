import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

// A73 is a moving, plan-scoped convenience URL, not an immutable test Release.
// It is published only while dev still has A73's product version.
export async function publishA73PreviewZip({siteRoot,devSha,devVersion}){
  if(devVersion!=='1.2.1')return null;
  if(!/^[0-9a-f]{40}$/i.test(devSha))throw new Error('A73 preview requires an exact dev SHA');
  const dist=path.join(siteRoot,'downloads','dev');
  const manifest=JSON.parse(await fs.readFile(path.join(dist,'manifest.json'),'utf8'));
  const archive='weig-qb-webui.zip';
  const archives=[archive,'weig-qb-webui-A73.zip'];
  const artifact=manifest.artifacts?.zip;
  if(manifest.schemaVersion!==6||manifest.kind!=='materialized-webui-dist'
    ||manifest.gitSha!==devSha||manifest.version!==devVersion||manifest.zipArchive!==archive
    ||artifact?.file!==archive||!/^[0-9a-f]{64}$/i.test(artifact.sha256))
    throw new Error('A73 preview cannot alias an unverified or mismatched dev distribution');
  const sourceSha=(await fs.readFile(path.join(dist,'GIT_SHA'),'utf8')).trim();
  const sourceVersion=(await fs.readFile(path.join(dist,'VERSION'),'utf8')).trim();
  if(sourceSha!==devSha||sourceVersion!==devVersion)
    throw new Error('A73 preview source identity does not match the dev distribution');
  const bytes=await fs.readFile(path.join(dist,archive));
  const actual=crypto.createHash('sha256').update(bytes).digest('hex');
  if(actual!==artifact.sha256.toLowerCase()||bytes.length!==artifact.bytes)
    throw new Error('A73 preview ZIP differs from the exact-SHA dev distribution');
  const target=path.join(dist,'A73');
  await fs.mkdir(target,{recursive:true});
  // Both Pages names contain the same exact-SHA, manifest-verified Dev ZIP.
  for(const name of archives)await fs.writeFile(path.join(target,name),bytes);
  await fs.writeFile(path.join(target,'SHA256SUMS'),archives.map(name=>actual+'  '+name).join('\n')+'\n','utf8');
  await fs.writeFile(path.join(target,'GIT_SHA'),devSha+'\n','utf8');
  await fs.writeFile(path.join(target,'VERSION'),devVersion+'\n','utf8');
  await fs.writeFile(path.join(target,'preview.json'),JSON.stringify({
    schemaVersion:1,kind:'moving-plan-preview',plan:'A73',mutable:true,
    channel:'dev',gitSha:devSha,version:devVersion,
    archive,archives,sha256:actual,bytes:bytes.length
  },null,2)+'\n','utf8');
  return{path:'downloads/dev/A73/'+archive,paths:archives.map(name=>'downloads/dev/A73/'+name),sha256:actual,bytes:bytes.length};
}

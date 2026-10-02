import fs from 'node:fs/promises';
import path from 'node:path';

export const RUNTIME_SHARD_SCHEMA_VERSION=1;

function decodeField(value){try{return decodeURIComponent(String(value||''));}catch{return String(value||'');}}
export function runtimeProfileKey(value){
  const key=String(value||'').trim();
  if(!key||!/^[0-9A-Za-z._-]+$/.test(key))throw new Error(`Unsafe runtime profile key: ${value}`);
  return key;
}

export function buildOwnedCopyProfileShard(registryText,qbVersion){
  const wanted=runtimeProfileKey(qbVersion),source=String(registryText||'').replace(/\r\n?/g,'\n'),lines=source.split('\n');
  const profiles=[],bridges=[],bindingLines=[],values=new Map(),sets=new Map(),refBlocks=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(line.startsWith('@@PROFILE\t'))profiles.push(line);
    else if(line.startsWith('@@BRIDGE\t'))bridges.push(line);
    else if(line.startsWith('@@PREF\t')||line.startsWith('@@UI\t'))bindingLines.push(line);
    else if(line.startsWith('@@VAL\t')){
      const fields=line.split('\t');if(fields[1])values.set(fields[1],line);
    }else if(line.startsWith('@@SET\t')){
      const fields=line.split('\t'),id=fields[1];
      if(id)sets.set(id,{line,parent:fields[2]&&fields[2]!=='-'?fields[2]:'',add:String(fields[3]||'').split(',').filter(Boolean),remove:String(fields[4]||'').split(',').filter(Boolean)});
    }else if(line.startsWith('@@REF\t')){
      const block=[line];
      while(++i<lines.length){block.push(lines[i]);if(lines[i]==='@@END')break;}
      if(block.at(-1)!=='@@END')throw new Error('Unterminated qB-owned copy REF block.');
      refBlocks.push(block.join('\n'));
    }
  }

  const profileLine=profiles.find(line=>decodeField(line.split('\t')[2])===wanted);
  if(!profileLine)throw new Error(`qB-owned copy registry has no profile for ${wanted}`);
  const profileFields=profileLine.split('\t'),sourceSha=profileFields[1],bindingId=profileFields[4];
  if(!/^[0-9a-f]{40}$/.test(sourceSha)||!/^b[0-9a-f]{20}$/.test(bindingId))throw new Error(`Invalid qB-owned profile identity for ${wanted}`);

  const selectedBridges=bridges.filter(line=>line.split('\t')[1]===sourceSha);
  const selectedBindings=bindingLines.filter(line=>line.split('\t')[1]===bindingId);
  if(!selectedBindings.length)throw new Error(`qB-owned copy registry has no binding ${bindingId} for ${wanted}`);

  const resolvedSets=new Map();
  function resolveSet(id,trail=new Set()){
    if(!id||id==='-')return new Set();
    if(resolvedSets.has(id))return new Set(resolvedSets.get(id));
    if(trail.has(id))throw new Error(`Cyclic qB-owned bridge set ${id}`);
    const def=sets.get(id);if(!def)throw new Error(`Missing qB-owned bridge set ${id} for ${wanted}`);
    const next=new Set(trail);next.add(id);const active=def.parent?resolveSet(def.parent,next):new Set();
    for(const token of def.remove)active.delete(token);
    for(const token of def.add)active.add(token);
    const resolved=[...active].sort((a,b)=>parseInt(a,36)-parseInt(b,36));
    resolvedSets.set(id,resolved);
    return new Set(resolved);
  }

  const selectedSetIds=new Set(),neededTokens=new Set();
  for(const line of selectedBridges){
    const setId=line.split('\t')[3];
    if(!setId||setId==='-')continue;
    selectedSetIds.add(setId);
    for(const token of resolveSet(setId))neededTokens.add(token);
  }

  const valueLines=[];
  for(const token of [...neededTokens].sort((a,b)=>parseInt(a,36)-parseInt(b,36))){
    const line=values.get(token);if(!line)throw new Error(`Missing qB-owned bridge value ${token} for ${wanted}`);
    valueLines.push(line);
  }
  const setLines=[...selectedSetIds].sort().map((id)=>{
    const tokens=[...resolveSet(id)].sort((a,b)=>parseInt(a,36)-parseInt(b,36));
    return `@@SET\t${id}\t-\t${tokens.join(',')}\t`;
  });
  return [
    '# WeiG qB-owned copy runtime IR v3 profile shard',
    profileLine,
    ...selectedBridges,
    ...selectedBindings,
    ...valueLines,
    ...setLines,
    ...refBlocks,
    ''
  ].join('\n');
}

export async function writeSimulatorRuntimeShards({catalog,registryPath='',out}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Runtime shards require a non-empty simulator catalog.');
  const root=path.resolve(String(out||''));if(!root)throw new Error('Runtime shard output is required.');
  const profilesDir=path.join(root,'profiles'),copyDir=path.join(root,'copy');
  await fs.mkdir(profilesDir,{recursive:true});await fs.mkdir(copyDir,{recursive:true});
  const registry=registryPath?await fs.readFile(path.resolve(registryPath),'utf8'):null;
  const profileStats=[],copyStats=[];
  for(const profile of catalog){
    const qbVersion=runtimeProfileKey(profile?.qbVersion),profileText=JSON.stringify(profile)+'\n';
    await fs.writeFile(path.join(profilesDir,`${qbVersion}.json`),profileText,'utf8');
    profileStats.push({qbVersion,bytes:Buffer.byteLength(profileText,'utf8'),sourceSha:String(profile?.sourceSha||'')});
    if(registry!==null){
      const shard=buildOwnedCopyProfileShard(registry,qbVersion),profileLine=shard.split('\n').find(line=>line.startsWith('@@PROFILE\t')),shardSha=profileLine&&profileLine.split('\t')[1]||'',expectedSha=String(profile?.sourceSha||'');
      if(expectedSha&&shardSha!==expectedSha)throw new Error(`Runtime copy shard identity mismatch for ${qbVersion}: catalog=${expectedSha} registry=${shardSha}`);
      await fs.writeFile(path.join(copyDir,`${qbVersion}.txt`),shard,'utf8');
      copyStats.push({qbVersion,bytes:Buffer.byteLength(shard,'utf8'),sourceSha:shardSha});
    }
  }
  const manifest={schemaVersion:RUNTIME_SHARD_SCHEMA_VERSION,profiles:profileStats,copyProfiles:copyStats,copySourceBytes:registry===null?0:Buffer.byteLength(registry,'utf8')};
  await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n','utf8');
  return manifest;
}

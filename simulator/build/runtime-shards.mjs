import fs from 'node:fs/promises';
import path from 'node:path';

export const RUNTIME_SHARD_SCHEMA_VERSION=1;

export function runtimeProfileKey(value){
  const key=String(value||'').trim();
  if(!key||!/^[0-9A-Za-z._-]+$/.test(key))throw new Error(\`Unsafe runtime profile key: \${value}\`);
  return key;
}

export async function writeSimulatorRuntimeShards({catalog,out}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Runtime shards require a non-empty simulator catalog.');
  const root=path.resolve(String(out||''));if(!root)throw new Error('Runtime shard output is required.');
  const profilesDir=path.join(root,'profiles');await fs.mkdir(profilesDir,{recursive:true});
  const profileStats=[];
  for(const profile of catalog){
    const qbVersion=runtimeProfileKey(profile?.qbVersion),profileText=JSON.stringify(profile)+'\\n';
    await fs.writeFile(path.join(profilesDir,\`\${qbVersion}.json\`),profileText,'utf8');
    profileStats.push({qbVersion,bytes:Buffer.byteLength(profileText,'utf8'),sourceSha:String(profile?.sourceSha||'')});
  }
  const manifest={schemaVersion:RUNTIME_SHARD_SCHEMA_VERSION,profiles:profileStats,copyRuntime:'product-source/qb-copy-profiles+bindings+fallback'};
  await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\\n','utf8');
  return manifest;
}

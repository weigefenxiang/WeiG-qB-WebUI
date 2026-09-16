import crypto from 'node:crypto';

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object'){
    const out={};
    for(const key of Object.keys(value).sort())out[key]=stable(value[key]);
    return out;
  }
  return value;
}
function sha256(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}

export function admittedCatalogRows(catalog){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Catalog identity requires a non-empty release catalog.');
  const rows=[],versions=new Set();
  for(const profile of catalog){
    if(profile?.stable===false||profile?.officialWeiGSupport===false)continue;
    const qbVersion=String(profile?.qbVersion||'').trim(),sourceSha=String(profile?.sourceSha||'').trim().toLowerCase();
    if(!qbVersion||!/^[0-9a-f]{40}$/.test(sourceSha))throw new Error(`Catalog identity requires exact qbVersion + sourceSha, got ${qbVersion||'unknown release'}.`);
    if(versions.has(qbVersion))throw new Error(`Catalog identity contains duplicate release ${qbVersion}.`);
    versions.add(qbVersion);rows.push({qbVersion,sourceSha});
  }
  if(!rows.length)throw new Error('Catalog identity found no admitted stable releases.');
  return rows;
}

export function catalogIdentity(catalog){
  const rows=admittedCatalogRows(catalog);
  return{
    supportFloor:rows[0].qbVersion,
    latestAdmittedStable:rows.at(-1).qbVersion,
    releaseCount:rows.length,
    releaseSetSha256:sha256(JSON.stringify(rows.map(row=>[row.qbVersion,row.sourceSha]))),
    sourceCatalogSha256:sha256(JSON.stringify(stable(catalog)))
  };
}

export function assertCatalogIdentity(actual,expected,label='catalog identity'){
  const fields=['supportFloor','latestAdmittedStable','releaseCount','releaseSetSha256','sourceCatalogSha256'];
  for(const field of fields)if(actual?.[field]!==expected?.[field])throw new Error(`${label} mismatch for ${field}: ${actual?.[field]??'missing'} != ${expected?.[field]??'missing'}.`);
  return true;
}

export const STABLE_INDEX_SCHEMA_VERSION=1;

export function stableProfileSummary(profile){
  profile=profile||{};
  const qbVersion=String(profile.qbVersion||'').trim();
  if(!qbVersion)throw new Error('Stable index profile is missing qbVersion');
  return {
    qbVersion,
    webApiVersion:String(profile.webApiVersion||'').trim(),
    tag:String(profile.tag||'').trim(),
    sourceSha:String(profile.sourceSha||'').trim(),
    officialWeiGSupport:profile.officialWeiGSupport===true
  };
}

export function buildStableIndex(catalog,{sourceCatalogSha256=''}={}){
  if(!Array.isArray(catalog)||!catalog.length)throw new Error('Stable index requires a non-empty catalog');
  const digest=String(sourceCatalogSha256||'').trim().toLowerCase();
  if(digest&&!/^[0-9a-f]{64}$/.test(digest))throw new Error('Stable index sourceCatalogSha256 must be a SHA-256 hex digest');
  const profiles=catalog.map(stableProfileSummary);
  const versions=new Set(profiles.map(item=>item.qbVersion));
  if(versions.size!==profiles.length)throw new Error('Stable index contains duplicate qB versions');
  return {
    schemaVersion:STABLE_INDEX_SCHEMA_VERSION,
    sourceCatalogSha256:digest,
    profileCount:profiles.length,
    supportFloor:profiles[0].qbVersion,
    latestAdmittedStable:profiles.at(-1).qbVersion,
    profiles
  };
}

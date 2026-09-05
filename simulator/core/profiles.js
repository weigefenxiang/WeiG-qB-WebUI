const normalizedProfileCache=new WeakMap();

export const BOOTSTRAP_RELEASES=[
  {qbVersion:'4.1.0',webApiVersion:'2.0.0',tag:'release-4.1.0',stable:true,officialWeiGSupport:false,protocolGeneration:'qb4'},
  {qbVersion:'4.1.1',webApiVersion:'2.0.1',tag:'release-4.1.1',stable:true,officialWeiGSupport:false,protocolGeneration:'qb4'},
  {qbVersion:'4.1.2',webApiVersion:'2.0.2',tag:'release-4.1.2',stable:true,officialWeiGSupport:false,protocolGeneration:'qb4'},
  {qbVersion:'4.1.3',webApiVersion:'2.1.0',tag:'release-4.1.3',stable:true,officialWeiGSupport:false,protocolGeneration:'qb4'},
  {qbVersion:'4.1.9.1',webApiVersion:'2.2.1',tag:'release-4.1.9.1',stable:true,officialWeiGSupport:true,protocolGeneration:'qb4'},
  {qbVersion:'4.2.0',webApiVersion:'2.3.0',tag:'release-4.2.0',stable:true,officialWeiGSupport:true,protocolGeneration:'qb4'},
  {qbVersion:'5.2.3',webApiVersion:'2.15.1',tag:'release-5.2.3',stable:true,officialWeiGSupport:true,protocolGeneration:'qb5'}
];

function clonePlain(value){
  if(Array.isArray(value))return value.map(item=>clonePlain(item));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clonePlain(item)]));
  return value;
}

export function versionParts(value){
  return String(value||'0').replace(/^v|^release-/,'').split('.').map(x=>Number.parseInt(x,10)||0);
}

export function compareVersions(a,b){
  const aa=versionParts(a),bb=versionParts(b),n=Math.max(aa.length,bb.length);
  for(let i=0;i<n;i++){
    const d=(aa[i]||0)-(bb[i]||0);
    if(d)return d<0?-1:1;
  }
  return 0;
}

export function atLeast(actual,minimum){
  return compareVersions(actual,minimum)>=0;
}

export function normalizeProfile(profile){
  if(profile&&typeof profile==='object'){
    const cached=normalizedProfileCache.get(profile);
    if(cached)return cached;
  }
  const qbVersion=String(profile?.qbVersion||'5.2.3').replace(/^v/,'');
  const major=versionParts(qbVersion)[0]||0;
  const normalized={
    qbVersion,
    webApiVersion:String(profile?.webApiVersion||'2.15.1'),
    tag:String(profile?.tag||`release-${qbVersion}`),
    sourceSha:profile?.sourceSha||profile?.tagSha||null,
    stable:profile?.stable!==false,
    officialWeiGSupport:profile?.officialWeiGSupport ?? compareVersions(qbVersion,'4.1.9.1')>=0,
    protocolGeneration:profile?.protocolGeneration||(major>=5?'qb5':'qb4'),
    preferenceKeys:Array.isArray(profile?.preferenceKeys)?[...profile.preferenceKeys]:null,
    preferenceDescriptors:Array.isArray(profile?.preferenceDescriptors)
      ?profile.preferenceDescriptors.map(entry=>clonePlain(entry))
      :(profile?.preferenceDescriptors&&typeof profile.preferenceDescriptors==='object'?clonePlain(profile.preferenceDescriptors):null),
    preferenceDefaults:profile?.preferenceDefaults&&typeof profile.preferenceDefaults==='object'
      ?clonePlain(profile.preferenceDefaults):null,
    preferenceInheritedDefaults:profile?.preferenceInheritedDefaults&&typeof profile.preferenceInheritedDefaults==='object'
      ?clonePlain(profile.preferenceInheritedDefaults):null,
    apiActions:Array.isArray(profile?.apiActions)?[...profile.apiActions]:null,
    major
  };
  if(profile&&typeof profile==='object')normalizedProfileCache.set(profile,normalized);
  normalizedProfileCache.set(normalized,normalized);
  return normalized;
}

export function profileByVersion(catalog,version){
  const list=(Array.isArray(catalog)&&catalog.length?catalog:BOOTSTRAP_RELEASES).map(normalizeProfile);
  return list.find(x=>x.qbVersion===String(version||''))||list.at(-1);
}

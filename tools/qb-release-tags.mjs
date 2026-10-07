function parts(value){return String(value||'').replace(/^release-/,'').split('.').map(item=>Number.parseInt(item,10)||0);}
export function compareQbVersions(left,right){const a=parts(left),b=parts(right),n=Math.max(a.length,b.length);for(let i=0;i<n;i++){const diff=(a[i]||0)-(b[i]||0);if(diff)return Math.sign(diff);}return 0;}
export function isStableReleaseTag(tag){return /^release-\d+\.\d+\.\d+(?:\.\d+)?$/.test(String(tag||''));}
export function isSupportedStableReleaseTag(tag,{floor='release-4.1.0'}={}){return isStableReleaseTag(tag)&&compareQbVersions(tag,floor)>=0;}
export function supportedStableReleaseTags(tags,{floor='release-4.1.0'}={}){return [...new Set((tags||[]).map(String).filter(tag=>isSupportedStableReleaseTag(tag,{floor})))].sort(compareQbVersions);}

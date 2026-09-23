import {canonicalQbHtmlText} from './qb-source-text.mjs';

const IDS={
  TRACKERS_ALL:'all',
  TRACKERS_TRACKERLESS:'trackerless',
  TRACKERS_ERROR:'error',
  TRACKERS_ANNOUNCE_ERROR:'otherError',
  TRACKERS_WARNING:'warning'
};
const ORDER=['all','trackerless','error','otherError','warning'];

export function extractTrackerFilterFacts(source,context='qB Tracker filters'){
  const text=String(source||''),byId=new Map();
  const pattern=/createLink\(\s*(TRACKERS_(?:ALL|TRACKERLESS|ERROR|ANNOUNCE_ERROR|WARNING))\s*,\s*(['"])(?:QBT_TR\()([\s\S]*?)(?:\)QBT_TR\[CONTEXT=TrackerFiltersList\])\2/g;
  for(const match of text.matchAll(pattern)){
    const id=IDS[match[1]],copy={source:canonicalQbHtmlText(match[3]),context:'TrackerFiltersList'};
    if(id&&copy.source&&!byId.has(id))byId.set(id,{id,copy});
  }
  return ORDER.filter(id=>byId.has(id)).map(id=>byId.get(id));
}


export function extractTrackerFacetMode(source){
  const text=String(source||'');
  const ownsTrackerSync=/response(?:JSON)?\s*\[?["']trackers["']\]?|response\[['"]trackers['"]\]/.test(text);
  if(!ownsTrackerSync)return 'none';
  const hostnameOwned=/genHash\(getHost\(tracker\)\)|trackerMap\.get\(host\)|trackerListItem\s*=\s*trackerMap\.get\(host\)/.test(text);
  if(hostnameOwned)return 'hostname';
  const urlOwned=/genHash\(tracker\)|trackerList\.set\(hash\s*,\s*\{[\s\S]*?url\s*:\s*tracker/.test(text);
  if(urlOwned)return 'url';
  return 'none';
}

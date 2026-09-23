import {canonicalQbHtmlText} from './qb-source-text.mjs';

const IDS={
  TRACKERS_TRACKERLESS:'trackerless',
  TRACKERS_ERROR:'error',
  TRACKERS_ANNOUNCE_ERROR:'otherError',
  TRACKERS_WARNING:'warning'
};
const ORDER=['trackerless','error','otherError','warning'];

export function extractTrackerFilterFacts(source,context='qB Tracker filters'){
  const text=String(source||''),byId=new Map();
  const pattern=/createLink\(\s*(TRACKERS_(?:TRACKERLESS|ERROR|ANNOUNCE_ERROR|WARNING))\s*,\s*(['"])(?:QBT_TR\()([\s\S]*?)(?:\)QBT_TR\[CONTEXT=TrackerFiltersList\])\2/g;
  for(const match of text.matchAll(pattern)){
    const id=IDS[match[1]],copy={source:canonicalQbHtmlText(match[3]),context:'TrackerFiltersList'};
    if(id&&copy.source&&!byId.has(id))byId.set(id,{id,copy});
  }
  return ORDER.filter(id=>byId.has(id)).map(id=>byId.get(id));
}

import {filesForTorrent} from './torrent-content.js';
import {hasTorrentMetadata,trackersForTorrent} from './torrent-metadata.js';
import {atLeast} from './profiles.js';

function enabled(value){
  if(value===true||value===1||value==='1')return true;
  return String(value??'').toLowerCase()==='true';
}

export function torrentInfoOptionSupport(profile={}){
  const version=String(profile.qbVersion||'0');
  return{
    includeTrackers:atLeast(version,'5.1.0'),
    includeFiles:atLeast(version,'5.2.0')
  };
}

export function expandTorrentInfoRows(world,rows,query={},now=Date.now()){
  const output=Array.isArray(rows)?rows:[];
  const support=torrentInfoOptionSupport(world?.profile||{});
  const wantTrackers=support.includeTrackers&&enabled(query.includeTrackers);
  const wantFiles=support.includeFiles&&enabled(query.includeFiles);
  if(!wantTrackers&&!wantFiles)return output;
  for(const row of output){
    const hash=String(row?.hash||'');
    if(!hash)continue;
    if(wantTrackers){
      const trackers=trackersForTorrent(world,hash,now);
      row.trackers=Array.isArray(trackers)?trackers:[];
    }
    if(wantFiles&&hasTorrentMetadata(world,hash)===true){
      const files=filesForTorrent(world,hash);
      if(Array.isArray(files))row.files=files;
    }
  }
  return output;
}

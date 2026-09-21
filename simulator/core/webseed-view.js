import {hash32} from './random.js';
import {torrentIndex} from './runtime-index.js';

export function indexedWebseedList(world,hash){
  const torrent=torrentIndex(world).byHash.get(String(hash||''));
  if(!torrent||torrent.private)return[];
  if(!Array.isArray(torrent.webseeds)){
    const count=1+(hash32(torrent.hash)%2);
    torrent.webseeds=Array.from({length:count},(_,i)=>({url:`https://cdn${i+1}.example.invalid/${torrent.hash.slice(0,12)}/${encodeURIComponent(torrent.name)}`}));
  }
  return torrent.webseeds;
}

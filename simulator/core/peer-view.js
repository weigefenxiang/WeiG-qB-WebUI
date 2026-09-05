import {createRng,deterministicUnit,pick} from './random.js';
import {torrentIndex} from './runtime-index.js';

export function generatedPeers(world,hash){
  const torrent=torrentIndex(world).byHash.get(String(hash||''));
  if(!torrent)return{};
  const count=Math.min(40,torrent.connectedPeers||Math.min(torrent.seeders+torrent.leechers,8)),out={};
  for(let i=0;i<count;i++){
    const key=`10.0.${(i>>8)&255}.${(i%254)+1}:${50000+i}`;
    out[key]={
      client:pick(createRng(`${torrent.hash}:peer:${i}`),['qBittorrent 5.2.3','Transmission 4.0','libtorrent','Deluge 2.x']),
      country_code:pick(createRng(`${torrent.hash}:country:${i}`),['US','DE','NL','JP','SG','CA']),
      country:'Virtual',dl_speed:Math.floor(torrent.effectiveDownloadRate/Math.max(1,count)),
      up_speed:Math.floor(torrent.effectiveUploadRate/Math.max(1,count)),downloaded:0,uploaded:0,
      progress:deterministicUnit(world.seed,`${torrent.hash}:peer-progress:${i}`),connection:'µTP',flags:'D U',
      flags_desc:'Interested; Unchoked',ip:`10.0.${(i>>8)&255}.${(i%254)+1}`,port:50000+i,
      relevance:.9,files:''
    };
  }
  return out;
}

import {createRng,deterministicUnit,hash32,pick} from './random.js';
import {torrentIndex} from './runtime-index.js';

const MAX_GENERATED_PEERS=100;
const COUNTRIES=[
  ['US','United States'],['GB','United Kingdom'],['DE','Germany'],['FR','France'],['NL','Netherlands'],['SG','Singapore'],
  ['JP','Japan'],['KR','South Korea'],['CN','China'],['HK','Hong Kong'],['TW','Taiwan'],['CA','Canada'],['AU','Australia'],
  ['NZ','New Zealand'],['ES','Spain'],['PT','Portugal'],['IT','Italy'],['SE','Sweden'],['NO','Norway'],['FI','Finland'],
  ['PL','Poland'],['CZ','Czechia'],['BR','Brazil'],['MX','Mexico'],['AR','Argentina'],['IN','India'],['TH','Thailand'],
  ['MY','Malaysia'],['ID','Indonesia'],['PH','Philippines'],['UA','Ukraine'],['RO','Romania'],['CH','Switzerland'],
  ['AT','Austria'],['BE','Belgium'],['DK','Denmark'],['IE','Ireland']
];
const CLIENTS=['qBittorrent 5.2.3','qBittorrent 4.6.x','Transmission 4.0','libtorrent 2.x','Deluge 2.x','BiglyBT','aria2'];
const peerTemplates=new WeakMap();
const peerDiagnostics=new WeakMap();

function diagnosticsFor(world){
  let stats=peerDiagnostics.get(world);
  if(!stats){stats={templateBuilds:0,templateRows:0,templateHits:0};peerDiagnostics.set(world,stats);}
  return stats;
}
function peerCountClass(world,torrent){
  const bucket=hash32(`${world.seed}:${torrent.hash}:peer-count-class`)%20;
  if(bucket===0)return 0;
  if(bucket===1)return 3;
  if(bucket===2)return 50;
  if(bucket===3)return 100;
  return 1+(hash32(`${world.seed}:${torrent.hash}:peer-count`)%MAX_GENERATED_PEERS);
}
export function peerCountForTorrent(world,hash){
  const torrent=torrentIndex(world).byHash.get(String(hash||''));
  if(!torrent)return 0;
  return Math.min(MAX_GENERATED_PEERS,peerCountClass(world,torrent));
}
function templateRow(world,torrent,i){
  const identityRng=createRng(`${torrent.hash}:peer:${i}`);
  const country=pick(createRng(`${torrent.hash}:country:${i}`),COUNTRIES);
  const third=(hash32(torrent.hash)>>8)&255,fourth=(i%253)+1,port=40000+(hash32(`${torrent.hash}:${i}:port`)%24000);
  const ip=`10.${third}.${(i>>8)&255}.${fourth}`;
  return{
    key:`${ip}:${port}`,
    value:{
      client:pick(identityRng,CLIENTS),country_code:country[0],country:country[1],downloaded:0,uploaded:0,
      progress:deterministicUnit(world.seed,`${torrent.hash}:peer-progress:${i}`),connection:identityRng()>.28?'µTP':'TCP',
      flags:'D U',flags_desc:'Interested; Unchoked',ip,port,relevance:.9,files:''
    }
  };
}
function templatesFor(world,torrent,count){
  const seed=String(world.seed||''),stats=diagnosticsFor(world);
  let cached=peerTemplates.get(torrent);
  if(!cached||cached.seed!==seed){cached={seed,rows:[]};peerTemplates.set(torrent,cached);stats.templateBuilds++;}
  else stats.templateHits++;
  while(cached.rows.length<count){cached.rows.push(templateRow(world,torrent,cached.rows.length));stats.templateRows++;}
  return cached.rows;
}
function virtualHostName(ip){
  const label=String(ip||'peer').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'peer';
  return `${label}.peer.virtual.invalid`;
}
export function projectPeerHostNames(world,peers,contract=null){
  if(!contract?.hostNameField)return peers;
  const enabled=world?.preferences?.[contract.hostNamePreference]===true,out={};
  for(const [key,row] of Object.entries(peers||{})){
    if(!row||typeof row!=='object'){out[key]=row;continue;}
    if(contract.hostNameNonI2POnly&&Object.prototype.hasOwnProperty.call(row,'i2p_dest')){out[key]={...row};continue;}
    out[key]={...row,host_name:enabled?virtualHostName(row.ip):''};
  }
  return out;
}
export function generatedPeers(world,hash){
  const torrent=torrentIndex(world).byHash.get(String(hash||''));
  if(!torrent)return{};
  const count=peerCountForTorrent(world,torrent.hash),out={};
  if(count===0)return out;
  const templates=templatesFor(world,torrent,count);
  const dlSpeed=Math.floor(torrent.effectiveDownloadRate/Math.max(1,count));
  const upSpeed=Math.floor(torrent.effectiveUploadRate/Math.max(1,count));
  for(let i=0;i<count;i++){const template=templates[i];out[template.key]={...template.value,dl_speed:dlSpeed,up_speed:upSpeed};}
  return out;
}
export function peerViewStats(world){return{...diagnosticsFor(world),maxGeneratedPeers:MAX_GENERATED_PEERS};}

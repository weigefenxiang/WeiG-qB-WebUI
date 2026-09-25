import {hash32} from './random.js';
import {TORRENT_NAME_POOL} from '../data/torrent-name-pool.js';
import {CURRENT_WORLD_SCHEMA_VERSION,VIRTUAL_PT_CATEGORIES} from './engine.js';

const LEGACY_PRIVATE_CATEGORY='Private';
const LEGACY_GENERATED_CATEGORIES=new Set(['','Private','Linux','Movies','TV','Music','Archive','Games','Books','Software']);
const LOG_SAMPLES=[
  [1,'Virtual qBittorrent session initialized.'],
  [2,'Virtual network and discovery services are ready.'],
  [4,'Virtual tracker latency warning sample.'],
  [8,'Virtual critical diagnostic sample (non-destructive).']
];

function tagList(torrent){
  if(Array.isArray(torrent?.tags))return torrent.tags.map(String).filter(Boolean);
  return String(torrent?.tags||'').split(',').map(x=>x.trim()).filter(Boolean);
}
function privateLike(torrent){
  if(torrent?.private===true)return true;
  if(tagList(torrent).some(tag=>tag.toLowerCase()==='pt'))return true;
  if(String(torrent?.category||'')===LEGACY_PRIVATE_CATEGORY)return true;
  return /(?:^|\.)pt\.example$/i.test((()=>{try{return new URL(String(torrent?.tracker||'')).hostname}catch{return''}})());
}
function ensureLogTypes(world,now){
  world.logs=Array.isArray(world.logs)?world.logs:[];
  const types=new Set(world.logs.map(item=>Number(item?.type)));
  let nextId=world.logs.reduce((max,item)=>Math.max(max,Number(item?.id)||0),0)+1;
  let offset=0,changed=false;
  for(const [type,message] of LOG_SAMPLES){
    if(types.has(type))continue;
    world.logs.push({id:nextId++,message,type,timestamp:Math.floor((now+offset*1000)/1000)});
    types.add(type);offset++;changed=true;
  }
  world.logs.sort((a,b)=>(Number(a?.id)||0)-(Number(b?.id)||0));
  if(world.logs.length>1000)world.logs.splice(0,world.logs.length-1000);
  return changed;
}
function deterministicPtCategory(world,torrent){
  const key=`${String(world?.seed||'20260905')}:${String(torrent?.hash||torrent?.name||'torrent')}:pt-category-v2`;
  return VIRTUAL_PT_CATEGORIES[hash32(key)%VIRTUAL_PT_CATEGORIES.length];
}
const LEGACY_EN_PREFIX='(?:Open|Blue|Silent|Northern|Golden|Rapid|Clear|Deep|Bright|Urban|Classic|Digital|Parallel|Hidden|Infinite|Modern|Prime|Solar|Vector|Wild)';
const LEGACY_EN_SUBJECT='(?:Archive|Atlas|Dataset|Documentary|Library|Source|Collection|Workshop|Chronicle|Studio|Manual|Sessions|Footage|Research|Bundle|Compendium|Projects|Reference|Samples|Vault)';
const LEGACY_EN_RE=new RegExp('^'+LEGACY_EN_PREFIX+' '+LEGACY_EN_SUBJECT+' · (?:Collection 2026|Pack 1080p)$');
const LEGACY_INTERNATIONAL=[
  '开源软件合集','纪录片资料库','古典音乐精选','城市摄影档案','编程课程资料',
  '開源軟體合集','紀錄片資料庫','古典音樂精選','城市攝影檔案','程式設計課程',
  'オープンソース資料集','ドキュメンタリー全集','クラシック音楽選集','都市写真アーカイブ','プログラミング教材',
  '오픈소스 자료 모음','다큐멘터리 컬렉션','클래식 음악 모음','도시 사진 아카이브','프로그래밍 강의',
  'Freie Software Sammlung','Dokumentarfilm Archiv','Klassik Sammlung','Stadtfotografie Archiv','Programmierkurs Material',
  'Collection logiciel libre','Archives documentaires','Sélection musique classique','Archives photo urbaines','Cours de programmation',
  'Colección de software libre','Archivo documental','Selección de música clásica','Archivo de fotografía urbana','Curso de programación',
  'Coleção de software livre','Arquivo de documentários','Seleção de música clássica','Arquivo de fotografia urbana','Curso de programação',
  'Коллекция свободного ПО','Архив документальных фильмов','Сборник классической музыки','Архив городской фотографии','Курс программирования'
];
function userAddedTorrent(torrent){
  return !!String(torrent?.addSourceKind||'').trim()||!!String(torrent?.addSource||'').trim();
}
function legacySyntheticName(value){
  const name=String(value||'');
  if(/^Virtual Torrent \d+ · (?:Ubuntu|Fedora|Archive|Dataset|Media|Backup|Source|Demo)$/.test(name))return true;
  if(LEGACY_EN_RE.test(name))return true;
  return LEGACY_INTERNATIONAL.some(prefix=>name.startsWith(prefix+' · ')&&/(?:2024|2025|2026|Vol\. 1|Complete)$/.test(name));
}
function replaceTorrentName(torrent,previous,next){
  if(!next||next===previous)return false;
  torrent.name=next;
  const path=String(torrent.contentPath||'');
  if(path&&path.endsWith(previous))torrent.contentPath=path.slice(0,-previous.length)+next.replace(/[\\/]+/g,'_');
  return true;
}
function deterministicRealName(world,torrent,salt='real-name-v1'){
  const previous=String(torrent?.name||'');
  const key=`${String(world?.seed||'20260905')}:${String(torrent?.hash||previous)}:${salt}`;
  return TORRENT_NAME_POOL[hash32(key)%TORRENT_NAME_POOL.length];
}
function migrateSyntheticName(world,torrent){
  if(userAddedTorrent(torrent)||!legacySyntheticName(torrent?.name))return false;
  const previous=String(torrent.name);
  return replaceTorrentName(torrent,previous,deterministicRealName(world,torrent));
}

const CLEAN_NAME_BY_FOLD=new Map(TORRENT_NAME_POOL.map(name=>[String(name).normalize('NFKC').toLocaleLowerCase(),name]));
function cleanedLegacySnapshotName(value){
  const previous=String(value||'').trim();
  let next=previous
    .replace(/\s+Torrent:\s*Magnet Link$/i,'')
    .replace(/\s+Magnet Link$/i,'')
    .replace(/\s+Torrent:\s*Download Mirror\s*#?\d+$/i,'')
    .replace(/^Discuss about\s+/i,'')
    .trim();
  const download=next.match(/^Download\s+(.+?)\s+Fast$/i);
  if(download)next=download[1].trim();
  if(/^(?:Order by Category|Torrent Magnet(?: Link)?|Magnet Link|Download this torrent using magnet|Magnet \(Ubuntu BT\)|I\.am\.a\.magnet|Discuss about this show)$/i.test(next))next='';
  if(next===previous)return null;
  if(!next)return'';
  return CLEAN_NAME_BY_FOLD.get(next.normalize('NFKC').toLocaleLowerCase())||'';
}
function migrateLegacySnapshotNoise(world,torrent){
  if(userAddedTorrent(torrent))return false;
  const previous=String(torrent?.name||'');
  const cleaned=cleanedLegacySnapshotName(previous);
  if(cleaned===null)return false;
  const next=cleaned||deterministicRealName(world,torrent,'real-name-clean-v2');
  return replaceTorrentName(torrent,previous,next);
}

function ensurePtCategories(world){
  let changed=false;
  if(!world.categories||typeof world.categories!=='object'||Array.isArray(world.categories)){world.categories={};changed=true;}
  for(const name of VIRTUAL_PT_CATEGORIES){
    if(world.categories[name])continue;
    world.categories[name]={name,savePath:`/downloads/${name.toLowerCase()}`};
    changed=true;
  }
  return changed;
}

export function upgradeWorldSchema(world,now=Date.now()){
  if(!world||typeof world!=='object')return{changed:false,from:null,to:CURRENT_WORLD_SCHEMA_VERSION,privateRemapped:0,logTypesAdded:0,namesRemapped:0};
  const from=Math.max(0,Number(world.schemaVersion)||0);
  if(from>=CURRENT_WORLD_SCHEMA_VERSION)return{changed:false,from,to:CURRENT_WORLD_SCHEMA_VERSION,privateRemapped:0,logTypesAdded:0,namesRemapped:0};

  let changed=false,privateRemapped=0,namesRemapped=0;
  const beforeLogTypes=new Set((Array.isArray(world.logs)?world.logs:[]).map(item=>Number(item?.type)));
  changed=ensureLogTypes(world,now)||changed;
  changed=ensurePtCategories(world)||changed;

  for(const torrent of Array.isArray(world.torrents)?world.torrents:[]){
    if(migrateSyntheticName(world,torrent)||migrateLegacySnapshotNoise(world,torrent)){namesRemapped++;changed=true;}
    if(!privateLike(torrent))continue;
    if(torrent.private!==true){torrent.private=true;changed=true;}
    const tags=tagList(torrent);
    if(!tags.some(tag=>tag.toLowerCase()==='pt')){tags.push('pt');torrent.tags=tags;changed=true;}
    const category=String(torrent.category||'');
    const legacyGeneratedCategory=!userAddedTorrent(torrent)&&from<CURRENT_WORLD_SCHEMA_VERSION&&LEGACY_GENERATED_CATEGORIES.has(category);
    if(!category||category===LEGACY_PRIVATE_CATEGORY||legacyGeneratedCategory){
      torrent.category=deterministicPtCategory(world,torrent);
      privateRemapped++;changed=true;
    }
  }

  if(world.categories?.[LEGACY_PRIVATE_CATEGORY]&&!(world.torrents||[]).some(t=>String(t?.category||'')===LEGACY_PRIVATE_CATEGORY)){
    delete world.categories[LEGACY_PRIVATE_CATEGORY];changed=true;
  }

  world.schemaVersion=CURRENT_WORLD_SCHEMA_VERSION;
  changed=true;
  const afterLogTypes=new Set(world.logs.map(item=>Number(item?.type)));
  const logTypesAdded=[1,2,4,8].filter(type=>!beforeLogTypes.has(type)&&afterLogTypes.has(type)).length;
  return{changed,from,to:CURRENT_WORLD_SCHEMA_VERSION,privateRemapped,logTypesAdded,namesRemapped};
}

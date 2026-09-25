import {hash32} from './random.js';
import {CURRENT_WORLD_SCHEMA_VERSION,VIRTUAL_PT_CATEGORIES} from './engine.js';

const LEGACY_PRIVATE_CATEGORY='Private';
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
  if(!world||typeof world!=='object')return{changed:false,from:null,to:CURRENT_WORLD_SCHEMA_VERSION,privateRemapped:0,logTypesAdded:0};
  const from=Math.max(0,Number(world.schemaVersion)||0);
  if(from>=CURRENT_WORLD_SCHEMA_VERSION)return{changed:false,from,to:CURRENT_WORLD_SCHEMA_VERSION,privateRemapped:0,logTypesAdded:0};

  let changed=false,privateRemapped=0;
  const beforeLogTypes=new Set((Array.isArray(world.logs)?world.logs:[]).map(item=>Number(item?.type)));
  changed=ensureLogTypes(world,now)||changed;
  changed=ensurePtCategories(world)||changed;

  for(const torrent of Array.isArray(world.torrents)?world.torrents:[]){
    if(!privateLike(torrent))continue;
    if(torrent.private!==true){torrent.private=true;changed=true;}
    const tags=tagList(torrent);
    if(!tags.some(tag=>tag.toLowerCase()==='pt')){tags.push('pt');torrent.tags=tags;changed=true;}
    const category=String(torrent.category||'');
    if(!category||category===LEGACY_PRIVATE_CATEGORY){
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
  return{changed,from,to:CURRENT_WORLD_SCHEMA_VERSION,privateRemapped,logTypesAdded};
}

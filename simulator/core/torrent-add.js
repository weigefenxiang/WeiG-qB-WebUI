import {addVirtualTorrent,CANONICAL,recordTorrentChanges,schedule} from './engine.js';
import {movePriority} from './torrent-actions.js';
import {setShareLimits} from './torrent-content.js';

const MiB=1024*1024;
const PIECE_SIZE=4*MiB;

function values(value){return Array.isArray(value)?value:[value];}
function optionalBool(value){
  if(value==null||String(value).trim()==='')return undefined;
  const text=String(value).trim().toLowerCase();
  if(['1','true','yes','on'].includes(text))return true;
  if(['0','false','no','off'].includes(text))return false;
  return undefined;
}
function finite(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function positiveLimit(value){const n=Number(value);return Number.isFinite(n)&&n>0?Math.round(n):0;}
function cleanPath(value){
  const text=String(value||'').trim().replace(/\\/g,'/').replace(/\/{2,}/g,'/');
  if(!text)return'';
  return text==='/'?'/':text.replace(/\/$/,'');
}
function joinPath(base,leaf){const a=cleanPath(base),b=String(leaf||'').replace(/[\\/]+/g,'_');return a==='/'?`/${b}`:`${a||'/downloads'}/${b}`;}
function sourceName(source){
  if(source.kind==='file')return String(source.file?.name||'Uploaded Virtual Torrent').replace(/\.torrent$/i,'').slice(0,180)||'Uploaded Virtual Torrent';
  const text=String(source.value||'').trim();
  try{
    const url=new URL(text);
    const dn=url.searchParams.get('dn');
    if(dn)return dn.slice(0,180);
    const leaf=decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1)||'').replace(/\.torrent$/i,'');
    if(leaf)return leaf.slice(0,180);
  }catch{}
  const magnet=text.match(/[?&]dn=([^&]+)/i);
  if(magnet){try{return decodeURIComponent(magnet[1].replace(/\+/g,' ')).slice(0,180);}catch{}}
  return (text.replace(/^.*[\\/]/,'').replace(/\.torrent$/i,'')||'Added Virtual Torrent').slice(0,180);
}
function sourcesFromForm(form){
  const out=[];
  for(const raw of values(form.urls)){
    if(raw==null||typeof raw==='object')continue;
    for(const line of String(raw).split(/\r?\n/)){
      const value=line.trim();if(value)out.push({kind:'url',value});
    }
  }
  for(const file of values(form.torrents)){
    if(file&&typeof file==='object'&&('name' in file||'size' in file))out.push({kind:'file',file});
  }
  if(!out.length)out.push({kind:'placeholder',value:'virtual://added'});
  return out;
}
function normalizeLayout(value){
  const text=String(value||'').trim().toLowerCase().replace(/[ _-]+/g,'');
  if(text==='nosubfolder')return'NoSubfolder';
  if(text==='subfolder')return'Subfolder';
  return'Original';
}
function priorityList(value){
  return String(value??'').split(',').map(x=>Number.parseInt(x.trim(),10)).filter(Number.isFinite).map(x=>Math.max(0,x));
}
function applyPriorities(t,priorities){
  if(!priorities.length)return;
  if(priorities.length===1){
    if(t.files?.[0])t.files[0].priority=priorities[0];
    return;
  }
  const total=Math.max(1,Number(t.size)||1),base=Math.floor(total/priorities.length);let used=0,pieceStart=0;
  t.files=priorities.map((priority,index)=>{
    const size=index===priorities.length-1?Math.max(1,total-used):Math.max(1,base);used+=size;
    const pieces=Math.max(1,Math.ceil(size/PIECE_SIZE));
    const file={index,name:`file-${String(index+1).padStart(2,'0')}.bin`,size,progress:0,priority,is_seed:false,piece_range:[pieceStart,pieceStart+pieces-1]};
    pieceStart+=pieces;return file;
  });
}
function applyContentLayout(t,layout){
  t.contentLayout=layout;
  if(layout==='NoSubfolder')t.contentPath=cleanPath(t.savePath)||'/downloads';
  else t.contentPath=joinPath(t.savePath,t.name);
}
function applyStopCondition(t,condition,now){
  const raw=String(condition||'').trim(),key=raw.toLowerCase().replace(/[ _-]+/g,'');
  t.stopCondition=raw||'None';
  if(key==='metadatareceived'){
    t.canonicalState=CANONICAL.DOWNLOAD_PAUSED;
    t.stopConditionSatisfied='MetadataReceived';
  }else if(key==='fileschecked'){
    t.maintenanceResumeState=CANONICAL.DOWNLOAD_PAUSED;
    t.canonicalState=CANONICAL.CHECKING;
    t.checkingUntil=now+2500;
    t.stopConditionSatisfied='';
  }
}
function hasShareParams(form){
  return ['ratioLimit','seedingTimeLimit','inactiveSeedingTimeLimit','shareLimitAction'].some(key=>Object.prototype.hasOwnProperty.call(form,key));
}

export function addVirtualTorrentBatch(world,form={},now=Date.now()){
  const sources=sourcesFromForm(form),added=[];
  const rename=String(form.rename||'').trim(),savepath=cleanPath(form.savepath)||cleanPath(world.preferences?.save_path)||'/downloads';
  const downloadPath=cleanPath(form.downloadPath),useDownloadPath=optionalBool(form.useDownloadPath)??!!downloadPath;
  const stopped=optionalBool(Object.prototype.hasOwnProperty.call(form,'stopped')?form.stopped:form.paused);
  const forced=optionalBool(form.forced)??false,top=optionalBool(form.addToTopOfQueue)??false;
  const sequential=optionalBool(form.sequentialDownload)??false,firstLast=optionalBool(form.firstLastPiecePrio)??false;
  const autoTMM=optionalBool(form.autoTMM)??!!world.preferences?.auto_tmm_enabled;
  const layout=normalizeLayout(form.contentLayout),priorities=priorityList(form.filePriorities);
  const dlLimit=positiveLimit(form.dlLimit),upLimit=positiveLimit(form.upLimit);
  const ssl={certificate:String(form.ssl_certificate??''),privateKey:String(form.ssl_private_key??''),dhParams:String(form.ssl_dh_params??'')};

  for(let i=0;i<sources.length;i++){
    const source=sources[i],sourceValue=source.kind==='url'?String(source.value):'',name=rename||sourceName(source);
    const t=addVirtualTorrent(world,{name,url:sourceValue,savepath,category:form.category,tags:form.tags,autoTMM},now+i);
    t.addSourceKind=source.kind;
    t.addSource=source.kind==='file'?String(source.file?.name||''):sourceValue;
    t.downloadPath=useDownloadPath?downloadPath:'';
    t.useDownloadPath=useDownloadPath;
    t.downloadLimit=dlLimit;
    t.uploadLimit=upLimit;
    t.forceStart=forced;
    t.sequential=sequential;
    t.firstLastPriority=firstLast;
    t.skipChecking=optionalBool(form.skip_checking)??false;
    t.downloader=String(form.downloader||'');
    t.sslParameters=ssl;
    applyContentLayout(t,layout);
    applyPriorities(t,priorities);
    if(stopped===true)t.canonicalState=CANONICAL.DOWNLOAD_PAUSED;
    else if(stopped===false&&t.canonicalState===CANONICAL.DOWNLOAD_PAUSED)t.canonicalState=CANONICAL.DOWNLOAD_QUEUED;
    applyStopCondition(t,form.stopCondition,now+i);
    t.ratioLimit=finite(form.ratioLimit,-2);
    t.seedingTimeLimit=Math.trunc(finite(form.seedingTimeLimit,-2));
    t.inactiveSeedingTimeLimit=Math.trunc(finite(form.inactiveSeedingTimeLimit,-2));
    t.shareLimitAction=String(form.shareLimitAction||'Default');
    added.push(t);
  }

  const hashes=added.map(t=>t.hash),hashText=hashes.join('|');
  if(hasShareParams(form))setShareLimits(world,hashText,form);
  if(top&&hashText)movePriority(world,hashText,'top',now+sources.length);
  const scheduled=schedule(world,now+sources.length,0);
  recordTorrentChanges(world,[...hashes,...scheduled.changed],[]);
  return{
    success_count:added.length,
    failure_count:0,
    pending_count:0,
    added_torrent_ids:hashes,
    torrents:added
  };
}

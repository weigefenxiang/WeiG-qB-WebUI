#!/usr/bin/env node

const DEFAULT_CONTEXT='AutomatedRssDownloader';
const own=(value,key)=>!!value&&Object.prototype.hasOwnProperty.call(value,key);

function decode(value){return String(value||'').replace(/&quot;|&#34;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');}
function text(value){return decode(String(value||'').replace(/<[^>]*>/g,'').trim());}
function escapeRegExp(value){return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function qbtRef(fragment){
  const match=String(fragment||'').match(/QBT_TR\(([\s\S]*?)\)QBT_TR(?:\[CONTEXT=([^\]]+)\])?/);
  if(!match)return null;
  return{source:text(match[1]),context:String(match[2]||DEFAULT_CONTEXT).trim()||DEFAULT_CONTEXT};
}
function elementIndex(source,id){const re=new RegExp(`<[^>]+\\bid=["']${escapeRegExp(id)}["'][^>]*>`,'i'),match=re.exec(source);return match?match.index:-1;}
function labelRef(source,id,index){
  const direct=new RegExp(`<label\\b[^>]*\\bfor=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/label>`,'i').exec(source);
  if(direct)return qbtRef(direct[1]);
  const before=String(source||'').slice(Math.max(0,index-700),index);
  const labels=[...before.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)];
  return labels.length?qbtRef(labels.at(-1)[1]):null;
}
function pathNeedle(path){return path?.[0]==='torrentParams'?`rulesList[rule].torrentParams.${path[1]}`:`rulesList[rule].${path?.[1]||''}`;}
function parseLiteral(raw){
  const value=String(raw||'').trim();
  if(value==='null')return{found:true,value:null};
  if(value==='true')return{found:true,value:true};
  if(value==='false')return{found:true,value:false};
  const quoted=value.match(/^(["'])([\s\S]*)\1$/);if(quoted)return{found:true,value:quoted[2].replace(/\\([\\"'])/g,'$1')};
  return{found:false,value:undefined};
}
function optionWriteValue(source,path,value){
  source=String(source||'');
  const assignment=new RegExp(`${escapeRegExp(pathNeedle(path))}\\s*=\\s*(null|true|false|["'][^"']*["'])\\s*;`,'i');
  const cases=[...source.matchAll(/\bcase\s+(["'])([^"']*)\1\s*:/gi)];
  for(let i=0;i<cases.length;i++){
    const item=cases[i];if(String(item[2])!==String(value))continue;
    const start=(item.index||0)+item[0].length,next=cases[i+1]?.index??source.length;
    const breakIndex=source.indexOf('break;',start),boundedBreak=breakIndex>=0&&breakIndex<next?breakIndex+6:next;
    const end=Math.min(boundedBreak,start+1200),match=assignment.exec(source.slice(start,end));
    if(match)return parseLiteral(match[1]);
  }
  return{found:false,value:undefined};
}
function selectOptions(source,id,path){
  const match=new RegExp(`<select\\b[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/select>`,'i').exec(source);
  if(!match)return[];
  return[...match[1].matchAll(/<option\b[^>]*\bvalue=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)].map(item=>{
    const option={value:String(item[1]),translation:qbtRef(item[2])},write=optionWriteValue(source,path,option.value);
    if(write.found)option.writeValue=write.value;
    return option;
  });
}
function sourcePath(source,candidates){
  for(const item of candidates){const needle=pathNeedle(item.path);if(String(source||'').includes(needle))return item.path.slice();}
  return null;
}

const CONTROL_DEFS=[
  {id:'useRegEx',key:'useRegex',kind:'checkbox',paths:[{path:['rule','useRegex']}]},
  {id:'mustContainText',key:'mustContain',kind:'text',paths:[{path:['rule','mustContain']}]},
  {id:'mustNotContainText',key:'mustNotContain',kind:'text',paths:[{path:['rule','mustNotContain']}]},
  {id:'episodeFilterText',key:'episodeFilter',kind:'text',paths:[{path:['rule','episodeFilter']}]},
  {id:'useSmartFilter',key:'smartFilter',kind:'checkbox',paths:[{path:['rule','smartFilter']}]},
  {id:'assignCategoryCombobox',key:'category',kind:'text',paths:[{path:['torrentParams','category']},{path:['rule','assignedCategory']}]},
  {id:'ruleAddTags',key:'tags',kind:'tags',paths:[{path:['torrentParams','tags']}]},
  {id:'saveToText',key:'savePath',kind:'text',paths:[{path:['torrentParams','save_path']},{path:['rule','savePath']}]},
  {id:'ignoreDaysValue',key:'ignoreDays',kind:'number',paths:[{path:['rule','ignoreDays']}]},
  {id:'addPausedCombobox',key:'stopped',kind:'triState',paths:[{path:['torrentParams','stopped']},{path:['rule','addPaused']},{path:['rule','addStopped']},{path:['torrentParams','paused']}]},
  {id:'addStoppedCombobox',key:'stopped',kind:'triState',paths:[{path:['torrentParams','stopped']},{path:['rule','addStopped']},{path:['rule','addPaused']},{path:['torrentParams','paused']}]},
  {id:'creatSubfolderCombobox',key:'subfolder',kind:'triState',paths:[{path:['rule','createSubfolder']}]},
  {id:'contentLayoutCombobox',key:'layout',kind:'select',paths:[{path:['torrentParams','content_layout']},{path:['rule','torrentContentLayout']}]}
];

function uniqueFields(fields){const seen=new Set(),out=[];for(const field of fields){const identity=`${field.key}\u0000${field.controlId}`;if(seen.has(identity))continue;seen.add(identity);out.push(field);}return out;}
function surfaceRef(source,pattern){const match=String(source||'').match(pattern);return match?qbtRef(match[1]):null;}

export function extractRssDownloaderSurface(source=''){
  source=String(source||'');
  if(!source.includes('RssDownloader')&&!source.includes('rssDownloaderRule'))return{available:false,source:'qb-upstream-rss-downloader',fields:[],copy:{}};
  const fields=[];
  for(const def of CONTROL_DEFS){
    const index=elementIndex(source,def.id);if(index<0)continue;
    const path=sourcePath(source,def.paths);if(!path)continue;
    const field={key:def.key,controlId:def.id,kind:def.kind,path,translation:labelRef(source,def.id,index)};
    if(def.kind==='number'){const tag=new RegExp(`<input\\b[^>]*\\bid=["']${escapeRegExp(def.id)}["'][^>]*>`,'i').exec(source)?.[0]||'';const min=/\bmin=["']([^"']+)["']/i.exec(tag);if(min)field.min=Number(min[1]);}
    if(def.kind==='triState'||def.kind==='select')field.options=selectOptions(source,def.id,path);
    fields.push({index,...field});
  }
  const feedsIndex=elementIndex(source,'rssDownloaderFeeds');
  if(feedsIndex>=0&&/rulesList\[rule\]\.affectedFeeds\s*=/.test(source)){
    const legend=surfaceRef(source,/<fieldset\b[^>]*\bid=["']rssDownloaderFeeds["'][^>]*>[\s\S]*?<legend>([\s\S]*?)<\/legend>/i);
    fields.push({index:feedsIndex,key:'affectedFeeds',controlId:'rssDownloaderFeeds',kind:'feeds',path:['rule','affectedFeeds'],translation:legend});
  }
  fields.sort((a,b)=>a.index-b.index);
  const normalized=uniqueFields(fields).map(({index,...field})=>field);
  return{
    available:true,
    source:'qb-upstream-rss-downloader',
    fields:normalized,
    copy:{
      rules:surfaceRef(source,/<[^>]+\bid=["']rulesTableDesc["'][^>]*>([\s\S]*?)<\//i),
      definition:surfaceRef(source,/<fieldset\b[^>]*\bid=["']ruleSettings["'][^>]*>[\s\S]*?<legend>([\s\S]*?)<\/legend>/i),
      matching:surfaceRef(source,/<[^>]+\bid=["']articleTableDesc["'][^>]*>([\s\S]*?)<\//i),
      save:surfaceRef(source,/<button\b[^>]*\bid=["']saveButton["'][^>]*>([\s\S]*?)<\/button>/i)
    }
  };
}

export function rssSurfaceTranslationRefs(surface){
  const refs=[];for(const ref of Object.values(surface?.copy||{}))if(ref?.source&&ref?.context)refs.push(ref);
  for(const field of surface?.fields||[]){if(field.translation?.source&&field.translation?.context)refs.push(field.translation);for(const option of field.options||[])if(option.translation?.source&&option.translation?.context)refs.push(option.translation);}
  const out=[],seen=new Set();for(const ref of refs){const id=`${ref.context}\u0000${ref.source}`;if(seen.has(id))continue;seen.add(id);out.push({...ref});}return out;
}

export function assertRssSurfaceBindings(surface,label='RSS surface'){
  if(!surface?.available)return surface;
  const keys=new Set();for(const field of surface.fields||[]){
    if(!field.key||!Array.isArray(field.path)||field.path.length!==2)throw new Error(`${label}: invalid RSS field binding`);
    const id=`${field.key}\u0000${field.controlId}`;if(keys.has(id))throw new Error(`${label}: duplicate RSS field ${id}`);keys.add(id);
    if(field.kind==='triState'||field.kind==='select'){
      if(!Array.isArray(field.options)||!field.options.length)throw new Error(`${label}: ${field.controlId} options are unresolved`);
      for(const option of field.options)if(!own(option,'writeValue'))throw new Error(`${label}: ${field.controlId} option ${option.value} write value is not source-proven`);
    }
  }
  return surface;
}

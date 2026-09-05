import {addVirtualTorrent} from './engine.js';
import {hash32} from './random.js';

function clampInt(value,min,max){return Math.max(min,Math.min(max,Math.round(Number(value)||0)));}
function ensure(world,key,fallback){if(world[key]==null)world[key]=fallback;return world[key];}
function slug(value){return String(value||'virtual').trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'virtual';}
function normalizePath(value){return String(value||'').trim().replace(/\\/g,'/').replace(/^\/+|\/+$/g,'').replace(/\/{2,}/g,'/');}
function joinPath(base,leaf){const a=normalizePath(base),b=normalizePath(leaf);return a&&b?`${a}/${b}`:(a||b);}
function leafName(path){const clean=normalizePath(path);return clean.split('/').filter(Boolean).at(-1)||clean;}

function feedKey(url,path){
  const cleanPath=normalizePath(path);
  if(cleanPath)return cleanPath;
  try{return new URL(String(url)).hostname.replace(/^www\./,'')||String(url);}catch{return String(url||'Virtual Feed');}
}
function feeds(world){return ensure(world,'rssFeeds',{});}
function folders(world){return ensure(world,'rssFolders',{});}
function feedByPath(world,path){
  const needle=normalizePath(path)||String(path||'');
  return Object.values(feeds(world)).find(feed=>feed.id===String(path||'')||normalizePath(feed.key)===needle)||null;
}

export function rssItems(world,withData=true){
  const out={};
  for(const folder of Object.values(folders(world)))out[folder.path]={isFolder:true,path:folder.path};
  for(const feed of Object.values(feeds(world))){
    out[feed.key]={url:feed.url,title:feed.title,lastBuildDate:feed.lastBuildDate,isLoading:false,hasError:false,refreshInterval:Number(feed.refreshInterval)||0};
    if(withData)out[feed.key].articles=feed.articles||[];
  }
  return out;
}

export function rssAddFolder(world,path){
  const clean=normalizePath(path);if(!clean)return false;
  const store=folders(world);if(store[clean])return false;
  store[clean]={path:clean};return true;
}

export function rssAddFeed(world,url,path='',now=Date.now(),refreshInterval=0){
  const store=feeds(world),key=feedKey(url,path),id=`rss-${hash32(`${url}:${path}`)}`;
  store[id]={id,key,url:String(url||''),title:leafName(key)||key,lastBuildDate:Math.floor(now/1000),refreshInterval:Math.max(0,Math.round(Number(refreshInterval)||0)),articles:[
    {id:`${id}-1`,title:`${leafName(key)||key} · Virtual release`,date:Math.floor(now/1000),description:'WeiG Virtual qB Lab RSS article',torrentURL:`magnet:?xt=urn:btih:${hash32(id).toString(16).padStart(40,'0').slice(0,40)}`,isRead:false}
  ]};
  return store[id];
}

export function rssSetFeedURL(world,path,url){
  const feed=feedByPath(world,path),next=String(url||'').trim();if(!feed||!next)return false;
  feed.url=next;return true;
}

export function rssSetFeedRefreshInterval(world,path,value){
  const feed=feedByPath(world,path),seconds=Number(value);if(!feed||!Number.isFinite(seconds)||seconds<0)return false;
  feed.refreshInterval=Math.floor(seconds);return true;
}

export function rssMoveItem(world,itemPath,destPath){
  const from=normalizePath(itemPath),dest=normalizePath(destPath),feed=feedByPath(world,itemPath);
  if(feed){const leaf=leafName(feed.key);feed.key=joinPath(dest,leaf);feed.title=leaf;return true;}
  const store=folders(world);if(!from||!store[from])return false;
  const next=joinPath(dest,leafName(from));if(!next||store[next])return false;
  delete store[from];store[next]={path:next};
  for(const entry of Object.values(feeds(world))){
    const key=normalizePath(entry.key);
    if(key===from||key.startsWith(`${from}/`))entry.key=`${next}${key.slice(from.length)}`;
  }
  return true;
}

export function rssMarkAsRead(world,itemPath,articleId=null){
  const feed=feedByPath(world,itemPath);if(feed){
    const articles=Array.isArray(feed.articles)?feed.articles:[];
    if(articleId!=null&&String(articleId)!==''){
      const article=articles.find(x=>String(x.id)===String(articleId));if(!article)return false;article.isRead=true;return true;
    }
    for(const article of articles)article.isRead=true;return true;
  }
  const folder=normalizePath(itemPath);if(!folder||!folders(world)[folder])return false;
  for(const entry of Object.values(feeds(world)))if(normalizePath(entry.key).startsWith(`${folder}/`))for(const article of entry.articles||[])article.isRead=true;
  return true;
}

export function rssRemoveItem(world,itemPath){
  const store=feeds(world),needle=normalizePath(itemPath)||String(itemPath||'');
  for(const [id,feed] of Object.entries(store))if(id===String(itemPath||'')||normalizePath(feed.key)===needle){delete store[id];return true;}
  const folderStore=folders(world);if(folderStore[needle]){
    delete folderStore[needle];
    for(const [id,feed] of Object.entries(store))if(normalizePath(feed.key).startsWith(`${needle}/`))delete store[id];
    return true;
  }
  return false;
}

export function rssRules(world){return ensure(world,'rssRules',{});}

export function rssSetRule(world,name,rule={}){
  const key=String(name||'').trim();if(!key)return false;
  const rules=rssRules(world),source=rule&&typeof rule==='object'?rule:{};
  rules[key]={
    enabled:source.enabled!==false,
    mustContain:String(source.mustContain||''),mustNotContain:String(source.mustNotContain||''),
    useRegex:!!source.useRegex,episodeFilter:String(source.episodeFilter||''),smartFilter:!!source.smartFilter,
    previouslyMatchedEpisodes:Array.isArray(source.previouslyMatchedEpisodes)?source.previouslyMatchedEpisodes:[],
    affectedFeeds:Array.isArray(source.affectedFeeds)?source.affectedFeeds:[],ignoreDays:Number(source.ignoreDays)||0,
    lastMatch:String(source.lastMatch||''),addPaused:!!source.addPaused,assignedCategory:String(source.assignedCategory||''),
    savePath:String(source.savePath||''),torrentContentLayout:String(source.torrentContentLayout||''),
    tags:Array.isArray(source.tags)?source.tags.map(String):String(source.tags||'').split(',').map(x=>x.trim()).filter(Boolean),
    matchedIds:Array.isArray(source.matchedIds)?source.matchedIds:[]
  };
  return true;
}

export function rssRemoveRule(world,name){const rules=rssRules(world),key=String(name||'');if(!(key in rules))return false;delete rules[key];return true;}
export function rssRenameRule(world,oldName,newName){const rules=rssRules(world),from=String(oldName||''),to=String(newName||'').trim();if(!to||!(from in rules)||from===to)return false;rules[to]=rules[from];delete rules[from];return true;}

function textMatch(title,value,useRegex){
  const needle=String(value||'').trim();if(!needle)return true;
  if(useRegex){try{return new RegExp(needle,'i').test(title);}catch{return false;}}
  return needle.split('|').map(x=>x.trim()).filter(Boolean).every(x=>title.toLowerCase().includes(x.toLowerCase()));
}
function textExcluded(title,value,useRegex){
  const needle=String(value||'').trim();if(!needle)return false;
  if(useRegex){try{return new RegExp(needle,'i').test(title);}catch{return false;}}
  return needle.split('|').map(x=>x.trim()).filter(Boolean).some(x=>title.toLowerCase().includes(x.toLowerCase()));
}
function ruleMatchesFeedArticle(rule,feed,article){
  if(rule.enabled===false)return false;
  if(Array.isArray(rule.affectedFeeds)&&rule.affectedFeeds.length&&!rule.affectedFeeds.includes(feed.key)&&!rule.affectedFeeds.includes(feed.url))return false;
  return textMatch(article.title,rule.mustContain,rule.useRegex)&&!textExcluded(article.title,rule.mustNotContain,rule.useRegex);
}

function applyRssRules(world,feed,article,now){
  let added=0;
  for(const [name,rule] of Object.entries(rssRules(world))){
    if(!ruleMatchesFeedArticle(rule,feed,article))continue;
    rule.matchedIds=Array.isArray(rule.matchedIds)?rule.matchedIds:[];
    if(rule.matchedIds.includes(article.id))continue;
    addVirtualTorrent(world,{name:article.title,url:article.torrentURL,savepath:rule.savePath,category:rule.assignedCategory,tags:(rule.tags||[]).join(',')},now);
    rule.matchedIds.push(article.id);if(rule.matchedIds.length>100)rule.matchedIds.splice(0,rule.matchedIds.length-100);
    rule.lastMatch=article.title;added++;
    world.logs=Array.isArray(world.logs)?world.logs:[];
    const id=(world.logs.at(-1)?.id||0)+1;
    world.logs.push({id,message:`RSS rule matched (${name}): ${article.title}`,type:1,timestamp:Math.floor(now/1000)});
  }
  return added;
}

export function rssMatchingArticles(world,ruleName){
  const rule=rssRules(world)[String(ruleName||'')];if(!rule)return null;
  const out={};
  for(const feed of Object.values(feeds(world))){
    const titles=(feed.articles||[]).filter(article=>ruleMatchesFeedArticle(rule,feed,article)).map(article=>article.title);
    if(titles.length)out[feed.title||feed.key]=titles;
  }
  return out;
}

export function rssRefreshItem(world,itemPath,now=Date.now()){
  const feed=feedByPath(world,itemPath);
  if(!feed)return false;
  feed.lastBuildDate=Math.floor(now/1000);
  const index=(feed.articles?.length||0)+1;
  feed.articles=Array.isArray(feed.articles)?feed.articles:[];
  const article={id:`${feed.id}-${index}`,title:`${feed.title} · Virtual update ${index}`,date:Math.floor(now/1000),description:'Generated by the deterministic Virtual RSS service.',torrentURL:`magnet:?xt=urn:btih:${hash32(`${feed.id}:${index}`).toString(16).padStart(40,'0').slice(0,40)}`,isRead:false};
  feed.articles.unshift(article);
  if(feed.articles.length>20)feed.articles.length=20;
  applyRssRules(world,feed,article,now);
  return true;
}

export function webseedList(world,hash){
  const t=(world.torrents||[]).find(x=>x.hash===String(hash||''));if(!t||t.private)return[];
  if(!Array.isArray(t.webseeds)){
    const count=1+(hash32(t.hash)%2);
    t.webseeds=Array.from({length:count},(_,i)=>({url:`https://cdn${i+1}.example.invalid/${t.hash.slice(0,12)}/${encodeURIComponent(t.name)}`}));
  }
  return t.webseeds;
}

function searchRows(pattern,id,count=60){
  const rows=[];
  for(let i=0;i<count;i++){
    const key=`${pattern}:${id}:${i}`,h=hash32(key),size=(700+((h>>>8)%95000))*1024*1024;
    rows.push({
      descrLink:`https://example.invalid/search/${id}/${i+1}`,
      fileName:`${pattern || 'Virtual search'} · Result ${String(i+1).padStart(2,'0')}`,
      fileSize:size,
      fileUrl:`magnet:?xt=urn:btih:${h.toString(16).padStart(40,'0').slice(0,40)}&dn=${encodeURIComponent(pattern||'Virtual')}`,
      nbLeechers:3+(h%180),
      nbSeeders:8+((h>>>5)%900),
      engineName:'Virtual Search',
      siteUrl:'https://example.invalid',
      pubDate:1700000000+i
    });
  }
  return rows;
}

function pluginStore(world){
  const store=ensure(world,'searchPlugins',{});
  if(!Object.keys(store).length)store.virtual={name:'virtual',version:'1.0.0',fullName:'Virtual Search',url:'https://example.invalid/search-plugin',enabled:true,supportedCategories:[{id:'all',name:'All'}]};
  return store;
}
export function searchPlugins(world){return Object.values(pluginStore(world)).map(plugin=>({...plugin,supportedCategories:Array.isArray(plugin.supportedCategories)?plugin.supportedCategories:[{id:'all',name:'All'}]}));}
export function searchInstallPlugins(world,sources){
  const store=pluginStore(world),values=String(sources||'').split('|').map(x=>x.trim()).filter(Boolean);let added=0;
  for(const source of values){
    const base=source.split(/[\\/]/).filter(Boolean).at(-1)||`plugin-${hash32(source)}`,name=slug(base.replace(/\.py$/i,''));
    if(store[name])continue;
    store[name]={name,version:'1.0.0',fullName:`Virtual ${base.replace(/\.py$/i,'')}`,url:source,enabled:true,supportedCategories:[{id:'all',name:'All'}]};added++;
  }
  return added;
}
export function searchUninstallPlugins(world,names){
  const store=pluginStore(world),values=String(names||'').split('|').map(x=>x.trim()).filter(Boolean);let removed=0;
  for(const name of values)if(store[name]){delete store[name];removed++;}
  return removed;
}
export function searchEnablePlugins(world,names,enable){
  const store=pluginStore(world),values=String(names||'').split('|').map(x=>x.trim()).filter(Boolean),next=String(enable).toLowerCase()==='true'||String(enable)==='1';let changed=0;
  for(const name of values)if(store[name]&&store[name].enabled!==next){store[name].enabled=next;changed++;}
  return changed;
}
export function searchUpdatePlugins(world,now=Date.now()){
  for(const plugin of Object.values(pluginStore(world))){
    const parts=String(plugin.version||'1.0.0').split('.').map(x=>Number(x)||0);parts[2]=(parts[2]||0)+1;plugin.version=parts.slice(0,3).join('.');plugin.updatedAt=Math.floor(now/1000);
  }
  return true;
}

export function searchStart(world,params={},now=Date.now()){
  const jobs=ensure(world,'searchJobs',{});
  world.searchSequence=(Number(world.searchSequence)||0)+1;
  const id=world.searchSequence,pattern=String(params.pattern||'').trim();
  jobs[id]={id,pattern,plugins:String(params.plugins||'enabled'),category:String(params.category||'all'),createdAt:now,stopped:false,results:searchRows(pattern,id)};
  return{id};
}
function searchJob(world,id){return ensure(world,'searchJobs',{})[Number(id)]||null;}
function visibleSearchCount(job,now){if(job.stopped)return job.results.length;const elapsed=Math.max(0,now-job.createdAt);return Math.min(job.results.length,Math.max(6,Math.floor(elapsed/450)*6));}
export function searchStatus(world,id,now=Date.now()){
  const jobs=ensure(world,'searchJobs',{}),selected=id==null?Object.values(jobs):[searchJob(world,id)].filter(Boolean);
  return selected.map(job=>({id:job.id,status:job.stopped||visibleSearchCount(job,now)>=job.results.length?'Stopped':'Running',total:visibleSearchCount(job,now)}));
}
export function searchResults(world,id,limit=50,offset=0,now=Date.now()){
  const job=searchJob(world,id);if(!job)return{status:'Stopped',total:0,results:[]};
  const visible=visibleSearchCount(job,now),start=clampInt(offset,0,visible),take=clampInt(limit,1,500),end=Math.min(visible,start+take);
  return{status:job.stopped||visible>=job.results.length?'Stopped':'Running',total:visible,results:job.results.slice(start,end)};
}
export function searchStop(world,id){const job=searchJob(world,id);if(!job)return false;job.stopped=true;return true;}
export function searchDelete(world,id){const jobs=ensure(world,'searchJobs',{}),key=Number(id);if(!jobs[key])return false;delete jobs[key];return true;}
export function searchDownloadTorrent(world,torrentUrl,pluginName='',now=Date.now()){
  const url=String(torrentUrl||'').trim();if(!url)return null;
  const name=(()=>{try{const parsed=new URL(url);return parsed.searchParams.get('dn')||leafName(parsed.pathname)||'Search result';}catch{return'Virtual search result';}})();
  return addVirtualTorrent(world,{name,url,tags:`search,${slug(pluginName||'virtual')}`},now);
}

export function creatorAddTask(world,params={},now=Date.now()){
  const tasks=ensure(world,'creatorTasks',{});world.creatorSequence=(Number(world.creatorSequence)||0)+1;
  const taskID=`virtual-task-${world.creatorSequence}`;
  tasks[taskID]={taskID,status:'Running',progress:0,createdAt:now,source:String(params.sourcePath||params.path||params.source||'/virtual/source'),comment:String(params.comment||''),pieceSize:Number(params.pieceSize)||0};
  return{taskID};
}
function creatorAdvance(task,now){if(!task)return null;if(task.status!=='Running')return task;task.progress=Math.min(1,Math.max(0,(now-task.createdAt)/1800));if(task.progress>=1)task.status='Finished';return task;}
export function creatorStatus(world,taskID,now=Date.now()){
  const tasks=ensure(world,'creatorTasks',{});
  if(taskID)return creatorAdvance(tasks[String(taskID)],now)||{taskID:String(taskID),status:'Failed',progress:0};
  return Object.values(tasks).map(task=>creatorAdvance(task,now));
}
export function creatorDeleteTask(world,taskID){const tasks=ensure(world,'creatorTasks',{});if(!(taskID in tasks))return false;delete tasks[taskID];return true;}
export function creatorTorrentFile(world,taskID,now=Date.now()){
  const task=creatorStatus(world,taskID,now);if(!task||task.status!=='Finished')return null;
  return `d4:infod4:name${slug(task.source).length}:${slug(task.source)}ee`;
}

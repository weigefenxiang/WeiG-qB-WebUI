export function createWorldCache(options={}){
  const load=options.load;
  const save=options.save;
  const remove=options.remove;
  const maxEntries=Math.max(1,Number(options.maxEntries)||6);
  const readPersistMs=Math.max(250,Number(options.readPersistMs)||30000);
  const largeWorldThreshold=Math.max(1,Number(options.largeWorldThreshold)||5000);
  const largeReadPersistMs=Math.max(readPersistMs,Number(options.largeReadPersistMs)||60000);
  const now=typeof options.now==='function'?options.now:Date.now;
  if(typeof load!=='function'||typeof save!=='function'||typeof remove!=='function')throw new TypeError('World cache requires load/save/remove functions.');

  const entries=new Map();
  let loadCount=0,saveCount=0;

  function persistIntervalFor(world){
    const count=Array.isArray(world?.torrents)?world.torrents.length:0;
    return count>=largeWorldThreshold?largeReadPersistMs:readPersistMs;
  }

  async function writeEntry(id,entry){
    if(!entry)return;
    await save(id,entry.world);
    entry.lastSavedAt=now();
    entry.dirty=false;
    saveCount++;
  }

  async function evictIfNeeded(){
    while(entries.size>maxEntries){
      const [id,entry]=entries.entries().next().value;
      entries.delete(id);
      if(entry?.dirty)await writeEntry(id,entry);
    }
  }

  function promote(id,entry){
    entries.delete(id);
    entries.set(id,entry);
    return entry;
  }

  async function get(id='default'){
    const key=String(id||'default');
    const cached=entries.get(key);
    if(cached)return promote(key,cached).world;
    const world=await load(key);loadCount++;
    if(world){
      entries.set(key,{world,lastSavedAt:now(),dirty:false});
      await evictIfNeeded();
    }
    return world||null;
  }

  async function seed(id='default',world,{persist=true}={}){
    const key=String(id||'default'),entry={world,lastSavedAt:now(),dirty:!persist};
    entries.set(key,entry);promote(key,entry);
    if(persist)await writeEntry(key,entry);
    await evictIfNeeded();
    return world;
  }

  async function touch(id='default',world,{mutation=false}={}){
    const key=String(id||'default');
    let entry=entries.get(key);
    if(!entry){entry={world,lastSavedAt:0,dirty:true};entries.set(key,entry);}else entry.world=world;
    promote(key,entry);entry.dirty=true;
    const due=now()-Number(entry.lastSavedAt||0)>=persistIntervalFor(world);
    if(mutation||due)await writeEntry(key,entry);
    await evictIfNeeded();
  }

  async function reset(id='default'){
    const key=String(id||'default');
    entries.delete(key);
    await remove(key);
  }

  async function flush(id){
    if(id!==undefined&&id!==null){
      const key=String(id),entry=entries.get(key);
      if(entry?.dirty)await writeEntry(key,entry);
      return;
    }
    for(const [key,entry] of entries)if(entry.dirty)await writeEntry(key,entry);
  }

  function stats(){return{entries:entries.size,loads:loadCount,saves:saveCount,ids:[...entries.keys()]};}

  return{get,seed,touch,reset,flush,stats};
}

const DB_NAME='weigg-virtual-qb';
const DB_VERSION=1;
const STORE='worlds';

function requestAsPromise(request){
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function openDb(){
  const request=indexedDB.open(DB_NAME,DB_VERSION);
  request.onupgradeneeded=()=>{
    const db=request.result;
    if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
  };
  return requestAsPromise(request);
}

export async function loadWorld(id='default'){
  const db=await openDb();
  try{
    const tx=db.transaction(STORE,'readonly');
    const value=await requestAsPromise(tx.objectStore(STORE).get(id));
    return value?.world||null;
  }finally{db.close();}
}

export async function saveWorld(id='default',world){
  const db=await openDb();
  try{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put({id,world,updatedAt:Date.now()});
    await new Promise((resolve,reject)=>{
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }finally{db.close();}
}

export async function deleteWorld(id='default'){
  const db=await openDb();
  try{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).delete(id);
    await new Promise((resolve,reject)=>{
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }finally{db.close();}
}

export async function listWorlds(){
  const db=await openDb();
  try{
    const tx=db.transaction(STORE,'readonly');
    const rows=await requestAsPromise(tx.objectStore(STORE).getAll());
    return rows.map(({id,updatedAt,world})=>({id,updatedAt,profile:world?.profile,count:world?.torrents?.length||0,seed:world?.seed}));
  }finally{db.close();}
}

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source=await fs.readFile(new URL('../webui/private/scripts/qb-client.js',import.meta.url),'utf8');
let profile=null,calls=[];
function descriptor(action){
  if(!profile||profile.fallback===true||!Array.isArray(profile.apiActions)||!profile.apiActions.includes(action))return null;
  const item=profile.apiActionParameters?.[action]||{};
  return{sourceAction:action,endpoint:(action.split(':')[1]||'').replace(/Action$/,''),parameters:item.parameters||[],required:item.required||[],optional:item.optional||[]};
}
const WeiG={
  util:{form:obj=>new URLSearchParams(Object.entries(obj||{}).map(([key,value])=>[key,String(value)])).toString()},
  I18n:{getLocale:()=> 'en-US'},
  ReleaseProfile:{current:()=>profile,actionDescriptor:descriptor,hasAction:action=>!!descriptor(action),isCertified:()=>!!(profile&&profile.fallback!==true)}
};
const window={WeiG};
const context={window,URLSearchParams,FormData,Blob,Response,console,fetch:async(url,init={})=>{
  calls.push({url:String(url),init});
  const path=String(url);
  if(path==='api/v2/torrents/categories')return new Response(JSON.stringify({Movies:{name:'Movies',savePath:'/downloads/movies'}}),{status:200});
  if(path==='api/v2/torrents/tags')return new Response(JSON.stringify(['linux','iso']),{status:200});
  return new Response('',{status:200});
}};
vm.runInNewContext(source,context,{filename:'qb-client.js'});
const client=new window.WeiG.QBClient();
client.qbVersion='6.0.0';client.webApiVersion='3.0.0';client.major=6;

const A={
  categories:'torrentscontroller.h:categoriesAction',
  setCategory:'torrentscontroller.h:setCategoryAction',
  createCategory:'torrentscontroller.h:createCategoryAction',
  removeCategories:'torrentscontroller.h:removeCategoriesAction',
  tags:'torrentscontroller.h:tagsAction',
  addTags:'torrentscontroller.h:addTagsAction',
  removeTags:'torrentscontroller.h:removeTagsAction',
  createTags:'torrentscontroller.h:createTagsAction',
  deleteTags:'torrentscontroller.h:deleteTagsAction'
};
const ALL=Object.values(A);
const body=call=>new URLSearchParams(String(call?.init?.body||''));
const operations={
  categories:()=>client.categories(),
  setCategory:()=>client.setCategory('hash-a','Movies'),
  createCategory:()=>client.createCategory('Movies','/downloads/movies'),
  removeCategories:()=>client.removeCategories('Movies'),
  tags:()=>client.tags(),
  addTags:()=>client.addTags('hash-a','linux'),
  removeTags:()=>client.removeTags('hash-a','linux'),
  createTags:()=>client.createTags('linux,iso'),
  deleteTags:()=>client.deleteTags('linux,iso')
};

profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:ALL,apiActionParameters:{}};
let before=calls.length;
const categories=await operations.categories();
const tags=await operations.tags();
await operations.setCategory();await operations.createCategory();await operations.removeCategories();await operations.addTags();await operations.removeTags();await operations.createTags();await operations.deleteTags();
assert.equal(calls.length,before+9,'nine source-proven taxonomy operations must emit exactly nine HTTP requests');
assert.equal(categories.Movies.name,'Movies');
assert.equal(Array.isArray(tags)&&tags.join(',')==='linux,iso',true);
assert.equal(calls[before].url,'api/v2/torrents/categories');
assert.equal(calls[before+1].url,'api/v2/torrents/tags');
assert.equal(calls[before+2].url,'api/v2/torrents/setCategory');assert.equal(body(calls[before+2]).get('category'),'Movies');
assert.equal(calls[before+3].url,'api/v2/torrents/createCategory');assert.equal(body(calls[before+3]).get('savePath'),'/downloads/movies');
assert.equal(calls[before+4].url,'api/v2/torrents/removeCategories');
assert.equal(calls[before+5].url,'api/v2/torrents/addTags');
assert.equal(calls[before+6].url,'api/v2/torrents/removeTags');
assert.equal(calls[before+7].url,'api/v2/torrents/createTags');
assert.equal(calls[before+8].url,'api/v2/torrents/deleteTags');

for(const [name,action] of Object.entries(A)){
  profile={qbVersion:'6.0.0',webApiVersion:'3.0.0',fallback:false,apiActions:ALL.filter(item=>item!==action),apiActionParameters:{}};
  before=calls.length;
  await assert.rejects(Promise.resolve().then(operations[name]),/source-proven/,`${name} must require its own exact source action`);
  assert.equal(calls.length,before,`${name} without its exact source action must make zero HTTP requests`);
}

profile={qbVersion:'4.1.0',webApiVersion:'2.0.0',fallback:false,apiActions:[A.setCategory,A.createCategory,A.removeCategories],apiActionParameters:{}};
before=calls.length;await operations.setCategory();await operations.createCategory();await operations.removeCategories();
assert.equal(calls.length,before+3,'qB 4.1.0-style source facts must preserve category writes');
for(const name of ['categories','tags','addTags','removeTags','createTags','deleteTags']){
  const count=calls.length;await assert.rejects(Promise.resolve().then(operations[name]),/source-proven/);assert.equal(calls.length,count,`${name} must fail closed on qB 4.1.0-style source facts`);
}

profile={qbVersion:'4.1.4',webApiVersion:'2.1.1',fallback:false,apiActions:[A.categories,A.setCategory,A.createCategory,A.removeCategories],apiActionParameters:{}};
before=calls.length;await operations.categories();assert.equal(calls.length,before+1,'qB 4.1.4-style source facts must enable categories read');
before=calls.length;await assert.rejects(Promise.resolve().then(operations.tags),/source-proven/);assert.equal(calls.length,before,'Tags read must remain zero-HTTP before exact tagsAction');

profile={qbVersion:'6.9.0',webApiVersion:'99.0.0',fallback:true,apiActions:ALL,apiActionParameters:{}};
before=calls.length;
for(const operation of Object.values(operations))await assert.rejects(Promise.resolve().then(operation),/source-proven/,'future fallback must not guess taxonomy support');
assert.equal(calls.length,before,'future fallback taxonomy operations must make zero HTTP requests');

console.log(`QBClient taxonomy provenance passed: ${calls.length} allowed HTTP calls; category/tag reads and writes are independently source-guarded and fallback profiles fail closed.`);

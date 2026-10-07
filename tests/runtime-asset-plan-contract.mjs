import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'webui/private/scripts/runtime-assets.js'),'utf8');

function harness({failOnce=new Set(),failAlways=new Set(),delays={},fetchBodies=[]}={}){
  const events=[],attempts=new Map(),fetchUrls=[];let fetchIndex=0;
  const meta={getAttribute(){return 'a'.repeat(40);}};
  const document={
    querySelector(selector){return selector==='meta[name="weig-build-sha"]'?meta:null;},
    createElement(tag){return{tagName:String(tag).toUpperCase(),dataset:{},remove(){events.push(['remove',this.dataset.weigRuntimeModule||this.dataset.weigRuntimeStyle||'']);}};},
    head:{appendChild(node){
      const name=node.dataset.weigRuntimeModule||node.dataset.weigRuntimeStyle||'',kind=node.tagName==='SCRIPT'?'script':'style';
      attempts.set(name,(attempts.get(name)||0)+1);events.push(['append',kind,name]);
      const attempt=attempts.get(name),delay=Number(delays[name]||0);
      setTimeout(()=>{
        if(failAlways.has(name)||(failOnce.has(name)&&attempt===1)){events.push(['error',kind,name,attempt]);node.onerror&&node.onerror();return;}
        events.push(['load',kind,name,attempt]);node.onload&&node.onload();
      },delay);
    }}
  };
  const window={document,location:{href:'http://example.test/app/index.html'},setTimeout,URL,indexedDB:null,WeiG:{},fetch(url){fetchUrls.push(String(url));const body=fetchBodies.length?fetchBodies[Math.min(fetchIndex++,fetchBodies.length-1)]:'';return Promise.resolve({ok:true,status:200,text(){return Promise.resolve(String(body));},arrayBuffer(){return Promise.resolve(new TextEncoder().encode(String(body)).buffer);}});}};
  window.window=window;
  const context=vm.createContext({window,document,URL,setTimeout,Promise,Map,Set,Uint8Array,Uint32Array,ArrayBuffer,TextDecoder,TextEncoder,console,Number,String,Object,Math,Date});
  vm.runInContext(source,context,{filename:'runtime-assets.js'});
  return{RuntimeAssets:window.WeiG.RuntimeAssets,events,attempts,fetchUrls};
}

const plan={schemaVersion:1,styleConcurrency:2,maxAttempts:2,retryDelays:[0],styles:['a.css','b.css','c.css'],phases:[
  {name:'foundation',scripts:['a.js','b.js']},
  {name:'feature',scripts:['c.js']},
  {name:'app',scripts:['app.js']}
]};
{
  const h=harness({failOnce:new Set(['b.js']),delays:{'a.js':8,'b.js':1}});
  const result=await h.RuntimeAssets.executePlan(plan);
  assert.equal(result.styles,3);assert.deepEqual(Array.from(result.phases,x=>String(x.name)),['foundation','feature','app']);
  assert.equal(h.attempts.get('b.js'),2,'transient script failure must retry inside RuntimeAssets');
  const append=x=>h.events.findIndex(e=>e[0]==='append'&&e[2]===x),load=x=>h.events.findIndex(e=>e[0]==='load'&&e[2]===x);
  assert.ok(append('a.js')>=0&&append('b.js')>=0&&append('a.js')<load('a.js')&&append('b.js')<load('a.js'),'independent scripts in one dependency phase must start before the slow sibling completes');
  assert.ok(append('c.js')>load('a.js')&&append('c.js')>load('b.js'),'next dependency phase must not start before all prior scripts succeed');
  assert.ok(append('app.js')>load('c.js'),'app phase must remain behind its prerequisite phase');
}
{
  const h=harness({failAlways:new Set(['b.js'])});
  await assert.rejects(()=>h.RuntimeAssets.executePlan(plan),/Runtime script b\.js failed/);
  assert.equal(h.attempts.get('b.js'),2,'permanent failure must stop after bounded retries');
  assert.equal(h.attempts.get('c.js')||0,0,'permanent prerequisite failure must block later dependency phases');
  assert.equal(h.attempts.get('app.js')||0,0,'failed plan must never start the app phase');
}
{
  const h=harness();
  assert.throws(()=>h.RuntimeAssets.executePlan({schemaVersion:1,phases:[{name:'one',scripts:['dup.js']},{name:'two',scripts:['dup.js']}]}),/multiple phases/);
}
{
  const h=harness({fetchBodies:['{broken',JSON.stringify({schemaVersion:1,styleConcurrency:1,maxAttempts:1,styles:[],phases:[{name:'app',scripts:['app.js']}]})]});
  const result=await h.RuntimeAssets.executePlanFile('bootstrap-plan.json');
  assert.deepEqual(Array.from(result.phases,x=>String(x.name)),['app']);
  assert.equal(h.fetchUrls.length,2,'bootstrap plan descriptor must bounded-retry after a transient malformed response');
  const first=new URL(h.fetchUrls[0]),second=new URL(h.fetchUrls[1]);
  assert.equal(first.searchParams.get('v'),'a'.repeat(40));assert.equal(first.searchParams.has('__weig_retry'),false);
  assert.equal(second.searchParams.get('v'),'a'.repeat(40));assert.equal(second.searchParams.get('__weig_retry'),'1','descriptor retry must preserve exact build identity and cache-bust only the retry attempt');
}
console.log('Runtime asset plan contract passed: one owner provides bounded style concurrency, parallel independent script phases, deterministic dependency barriers, retry, dedupe and fail-closed execution.');

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../webui/private/scripts/runtime-assets.js',import.meta.url),'utf8');
let fetchHandler=()=>new Promise(()=>{}),successStyle=false,opened=0;
const nodes=[];
const document={
  querySelector:()=>({getAttribute:()=> 'test-sha'}),
  createElement:type=>({tagName:type,dataset:{},remove(){this.removed=true;}}),
  head:{appendChild(node){nodes.push(node);if(successStyle&&node.tagName==='link')queueMicrotask(()=>node.onload?.());}}
};
const window={WeiG:{},document,location:{href:'https://example.invalid/private/index.html'},indexedDB:{open(){opened++;return {};}},
  fetch:(url,init)=>fetchHandler(url,init),setTimeout,clearTimeout,AbortController};
vm.runInNewContext(source,{window,document,URL,AbortController,setTimeout,clearTimeout,console},{filename:'runtime-assets.js'});
const assets=window.WeiG.RuntimeAssets;
async function rejectSoon(task,fragment){await assert.rejects(task,error=>String(error).includes(fragment),'Expected '+fragment);}
await rejectSoon(assets.readText('fixtures/a.json',{timeoutMs:30}),'timed out');
assert.equal(opened,1,'Hung IndexedDB open must fall back without restarting pending opens');
fetchHandler=()=>Promise.resolve(new Response('{"ok":1}',{status:200}));
assert.equal(await assets.readText('fixtures/a.json',{timeoutMs:1000}),'{"ok":1}','Fetch should recover after IDB fallback');
fetchHandler=()=>new Promise(()=>{});
await rejectSoon(assets.readBytes('fixtures/b.gz',{timeoutMs:30}),'timed out');
const scriptPath='scripts/uncertain.js';
await rejectSoon(assets.loadScript(scriptPath,{timeoutMs:30,maxAttempts:3,retryDelays:[0]}),'uncertain');
const scriptNodes=nodes.filter(x=>x.tagName==='script');
assert.equal(scriptNodes.length,1,'An uncertain script must never be inserted twice');
const priorOnload=scriptNodes[0].onload;priorOnload();
await rejectSoon(assets.loadScript(scriptPath,{timeoutMs:30,maxAttempts:3}),'uncertain');
assert.equal(nodes.filter(x=>x.tagName==='script').length,1,'Late onload must not permit duplicate execution');
await rejectSoon(assets.loadStyle('css/retry.css',{timeoutMs:25,maxAttempts:2,retryDelays:[0]}),'timed out');
assert.equal(nodes.filter(x=>x.tagName==='link').length,2,'Stylesheets may retry after bounded failures');
successStyle=true;
assert.equal(await assets.loadStyle('css/retry.css',{timeoutMs:1000,maxAttempts:2}),'css/retry.css');
console.log('RuntimeAssets reliability contract passed: bounded IDB/fetch/script/style with script fail-closed.');

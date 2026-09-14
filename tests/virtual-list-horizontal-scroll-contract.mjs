import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const core=fs.readFileSync(path.join(root,'webui/private/scripts/core.js'),'utf8');

assert.match(core,/this\._deferHorizontalUpdates=this\.el\.id==='torrent-list'/,'horizontal polling deferral must be scoped to the canonical main Torrent VirtualList');
assert.match(core,/horizontal=Math\.abs\(left-self\._lastScrollLeft\)>\.5/,'the native VirtualList scroll owner must detect real horizontal motion itself');
assert.match(core,/__weiggVirtualHorizontalIdleTimer=global\.setTimeout\(function\(\).*self\._flushPendingItems\(\);\},140\)/s,'horizontal idle must flush the latest pending snapshot once after the bounded 140ms quiet period');
assert.match(core,/setItems=function\(items,preserve\)\{if\(this\._deferHorizontalUpdates&&this\._horizontalScrolling\)\{this\._pendingItems=items\|\|\[\];this\._pendingPreserve=preserve;this\._hasPendingItems=true;return;\}this\._applyItems\(items,preserve\);\}/,'polling updates must coalesce in the canonical VirtualList instead of creating a second owner');

let nextTimer=0;
const timers=new Map();
function fakeNode(id=''){
  const listeners={};
  const classes=new Set();
  return {
    id,
    scrollTop:0,
    scrollLeft:0,
    clientHeight:400,
    offsetHeight:0,
    offsetParent:null,
    isConnected:true,
    parentNode:null,
    textContent:'',
    dataset:{},
    children:[],
    style:{
      height:'',
      setProperty(){},
      getPropertyValue(){return'';}
    },
    classList:{
      add(...names){for(const name of names)classes.add(name);},
      remove(...names){for(const name of names)classes.delete(name);},
      contains(name){return classes.has(name);}
    },
    appendChild(child){this.children.push(child);child.parentNode=this;child.isConnected=true;return child;},
    addEventListener(type,listener){listeners[type]=listener;},
    removeEventListener(type,listener){if(listeners[type]===listener)delete listeners[type];},
    getClientRects(){return [{}];},
    closest(){return null;},
    __listeners:listeners
  };
}

const head=fakeNode('torrent-table-head');
const document={
  documentElement:{dataset:{}},
  createElement(){return fakeNode();},
  getElementById(id){return id==='torrent-table-head'?head:null;},
  querySelectorAll(){return[];},
  elementFromPoint(){return null;}
};
const window={
  WeiG:{},
  document,
  setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},
  clearTimeout(id){timers.delete(id);}
};
window.window=window;
const localStorage={getItem(){return null;},setItem(){},removeItem(){}};
const context={
  window,
  document,
  localStorage,
  URL,
  URLSearchParams,
  console,
  setTimeout:window.setTimeout,
  clearTimeout:window.clearTimeout,
  matchMedia(){return{matches:false};}
};
vm.runInNewContext(core,context,{filename:'core.js'});

const main=fakeNode('torrent-list');
const list=new window.WeiG.VirtualList(main,{renderRow(){return fakeNode();}});
let renders=0;
list.render=()=>{renders++;};

main.scrollLeft=96;
main.__listeners.scroll();
assert.equal(list._horizontalScrolling,true,'horizontal movement must enter the bounded no-repaint window');
const firstTimer=main.__weiggVirtualHorizontalIdleTimer;
assert.ok(timers.has(firstTimer),'horizontal movement must arm an idle flush');

main.scrollLeft=160;
main.__listeners.scroll();
const latestTimer=main.__weiggVirtualHorizontalIdleTimer;
assert.notEqual(latestTimer,firstTimer,'continued horizontal movement must restart the idle window');
assert.equal(timers.has(firstTimer),false,'the superseded idle callback must be cancelled');
assert.ok(timers.has(latestTimer),'the latest idle callback must remain armed');

list.setItems([{id:'first'}],true);
list.setItems([{id:'latest'}],true);
assert.equal(renders,0,'background polling must not repaint while the main list is horizontally active');
assert.equal(list.items.length,0,'the visible VirtualList snapshot must remain stable during horizontal movement');
assert.equal(list._pendingItems.length,1);
assert.equal(list._pendingItems[0].id,'latest','only the newest polling snapshot may remain queued');

const flush=timers.get(latestTimer);
timers.delete(latestTimer);
flush();
assert.equal(list._horizontalScrolling,false,'idle completion must leave the horizontal interaction state');
assert.equal(renders,1,'idle completion must repaint exactly once');
assert.equal(list.items.length,1);
assert.equal(list.items[0].id,'latest','the single repaint must apply the newest polling snapshot');
assert.equal(list._hasPendingItems,false,'the pending snapshot marker must be cleared after the flush');

const detail=fakeNode('detail-table');
const detailList=new window.WeiG.VirtualList(detail,{renderRow(){return fakeNode();}});
let detailRenders=0;
detailList.render=()=>{detailRenders++;};
detailList.setItems([{id:'detail'}],true);
assert.equal(detailRenders,1,'non-main VirtualLists must keep immediate setItems behavior');
assert.equal(detailList.items[0].id,'detail');

console.log('VirtualList horizontal-scroll contract passed: main-list polling keeps only the latest snapshot without repainting during native horizontal motion, flushes once after 140ms idle, and leaves other VirtualLists unchanged.');

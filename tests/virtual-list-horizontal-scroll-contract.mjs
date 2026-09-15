import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),core=fs.readFileSync(path.join(root,'webui/private/scripts/core.js'),'utf8');
assert.match(core,/vertical=Math\.abs\(top-self\._lastScrollTop\)>\.5,horizontal=Math\.abs\(left-self\._lastScrollLeft\)>\.5/,'VirtualList must detect both vertical and horizontal native scroll motion.');
assert.match(core,/if\(vertical\|\|horizontal\)\{self\._scrolling=true/,'one VirtualList owner must enter scroll-priority mode for either axis.');
assert.match(core,/__weiggVirtualScrollIdleTimer=global\.setTimeout\(function\(\).*self\._flushPendingItems\(\);\},150\)/s,'the bounded quiet period must flush the newest pending snapshot after 150ms.');
assert.match(core,/setItems=function\(items,preserve\)\{if\(this\._scrolling\)\{this\._pendingItems=items\|\|\[\];/,'polling updates must coalesce in the existing VirtualList while the user scrolls.');
assert.match(core,/VirtualList\.prototype\.destroy=function\(\)/,'VirtualList must expose lifecycle cleanup instead of leaking scroll owners.');
const listeners=new Map(),timers=new Map();let nextTimer=0;
function fakeNode(tag='div'){return{tagName:tag.toUpperCase(),id:'',className:'',style:{height:'',setProperty(){},getPropertyValue(){return'';}},dataset:{},children:[],parentNode:null,isConnected:true,clientHeight:300,scrollTop:0,scrollLeft:0,offsetHeight:0,offsetParent:null,textContent:'',classList:{add(){},remove(){},toggle(){}},appendChild(ch){this.children.push(ch);ch.parentNode=this;return ch;},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);},addEventListener(type,fn){listeners.set(type,fn);},getClientRects(){return[{}];},closest(){return null;}};}
const document={createElement:fakeNode,getElementById(){return null;},querySelectorAll(){return[];},documentElement:{dataset:{}}};
const window={document,WeiG:{},setTimeout(fn){const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);},requestAnimationFrame:fn=>fn(),cancelAnimationFrame(){},history:{length:1,back(){}},location:{hash:''}};window.window=window;
const context={window,document,localStorage:{getItem(){return null;},setItem(){}},matchMedia(){return{matches:false};},URL,URLSearchParams,Set,Map,console,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,requestAnimationFrame:window.requestAnimationFrame,cancelAnimationFrame:window.cancelAnimationFrame,history:window.history,location:window.location};
vm.runInNewContext(core,context,{filename:'core.js'});const W=window.WeiG;
for(const [base,rel,full,dir] of [['/downloads','Anime/S01/E01.mkv','/downloads/Anime/S01/E01.mkv','/downloads/Anime/S01'],['/downloads/','Anime\\S01\\E01.mkv','/downloads/Anime/S01/E01.mkv','/downloads/Anime/S01'],['D:\\Downloads','Anime/S01/E01.mkv','D:\\Downloads\\Anime\\S01\\E01.mkv','D:\\Downloads\\Anime\\S01'],['C:\\','file.mkv','C:\\file.mkv','C:\\'],['/','file.mkv','/file.mkv','/']]){assert.equal(W.QbPath.join(base,rel),full);assert.equal(W.QbPath.dirname(full),dir);}
const el=fakeNode();el.id='detail-test';const list=new W.VirtualList(el,{rowHeight:20,renderRow(){return fakeNode();}});let renders=0;list.render=()=>{renders++;};list.setItems([{id:1},{id:2}]);renders=0;
el.scrollTop=40;listeners.get('scroll')();list.setItems([{id:3}]);list.setItems([{id:4}]);assert.equal(list.items[0].id,1,'vertical motion must hold the visible snapshot');assert.equal(list._pendingItems[0].id,4,'only the latest polling snapshot may remain queued');
const verticalTimer=el.__weiggVirtualScrollIdleTimer;assert.ok(timers.has(verticalTimer));const beforeIdle=renders;timers.get(verticalTimer)();timers.delete(verticalTimer);assert.equal(list.items[0].id,4);assert.equal(renders,beforeIdle+1,'idle must add exactly one repaint for the newest pending snapshot');
el.scrollLeft=120;listeners.get('scroll')();list.setItems([{id:5}]);assert.equal(list.items[0].id,4,'horizontal motion must use the same scroll-priority owner');const horizontalTimer=el.__weiggVirtualScrollIdleTimer;timers.get(horizontalTimer)();timers.delete(horizontalTimer);assert.equal(list.items[0].id,5);
list.destroy();assert.equal(el.__weiggVirtualScrollHandler,null);assert.equal(el.__weiggVirtualScrollIdleTimer,0);assert.equal(list._hasPendingItems,false);
console.log('VirtualList scroll-priority contract passed: one owner coalesces the latest snapshot during vertical or horizontal motion, flushes once after bounded idle, cleans up deterministically, and keeps qB host-path helpers canonical.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../webui/private/scripts/client-data-runtime.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../webui/private/index.html',import.meta.url),'utf8');
const time=fs.readFileSync(new URL('../webui/private/scripts/time.js',import.meta.url),'utf8');
const settings=fs.readFileSync(new URL('../webui/private/scripts/settings.js',import.meta.url),'utf8');
assert(index.includes('"scripts/client-data-runtime.js"')&&index.indexOf('"scripts/client-data-runtime.js"')<index.indexOf('"scripts/components.js"'));
assert(time.includes('W.ClientDataRuntime.dateFormat')&&time.includes('sourcePatternDate'));
assert(settings.includes('W.ClientDataRuntime&&W.ClientDataRuntime.merge')&&settings.includes('runtime.ready&&runtime.ready()'));
const metas={
 date_format:{key:'date_format',type:'string',defaultValue:'default',options:[{value:'default'},{value:'yyyy-MM-dd HH:mm:ss'}]},
 full_url_tracker_column:{key:'full_url_tracker_column',type:'boolean',defaultValue:false},
 use_virtual_list:{key:'use_virtual_list',type:'boolean',defaultValue:false},
 hide_zero_status_filters:{key:'hide_zero_status_filters',type:'boolean',defaultValue:false},
 dblclick_download:{key:'dblclick_download',type:'string',defaultValue:'1',options:[{value:'1'},{value:'0'}]},
 dblclick_complete:{key:'dblclick_complete',type:'string',defaultValue:'1',options:[{value:'1'},{value:'0'}]},
 dblclick_filter:{key:'dblclick_filter',type:'string',defaultValue:'1',options:[{value:'1'},{value:'0'}]}
};
const events=[];class FakeCustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
const window={WeiG:{SettingsSchema:{async loadCompatibility(){},clientDataKeys(){return Object.keys(metas);},clientDataForKey(key){return metas[key]?JSON.parse(JSON.stringify(metas[key])):null;}},util:{normalizeTracker:value=>String(value||''),trackerLabel:value=>'HOST:'+String(value||'')}},dispatchEvent(event){events.push(event);}};window.window=window;
vm.runInNewContext(source,{window,CustomEvent:FakeCustomEvent,console,Set,Number,Object,Array,String,Promise},{filename:'client-data-runtime.js'});
const R=window.WeiG.ClientDataRuntime;
assert.equal(R.virtualizeTables(),true,'before exact ClientData is loaded WeiG must preserve its existing bounded rendering behavior');
const client={async getClientData(keys){assert(keys.includes('date_format')&&keys.includes('use_virtual_list'));return{date_format:'yyyy-MM-dd HH:mm:ss',full_url_tracker_column:true,use_virtual_list:false,hide_zero_status_filters:true,dblclick_download:'0',dblclick_complete:'1',dblclick_filter:'1'};}};
await R.bind(client);
assert.equal(R.ready(),true);assert.equal(R.dateFormat(),'yyyy-MM-dd HH:mm:ss');assert.equal(R.trackerText('https://tracker.example/announce?passkey=secret'),'https://tracker.example/announce?passkey=secret');assert.equal(R.virtualizeTables(),false);assert.equal(R.hideZeroStatusFilters(),true);assert.equal(R.actionEnabled('dblclick_download'),false);assert.equal(R.actionEnabled('dblclick_complete'),true);assert.equal(R.actionEnabled('dblclick_filter'),true);
const rev=R.revision();R.merge({use_virtual_list:true,full_url_tracker_column:false});assert.equal(R.virtualizeTables(),true);assert.equal(R.trackerText('https://tracker.example/announce'),'HOST:https://tracker.example/announce');assert(R.revision()>rev);assert(events.some(event=>event.type==='weig:clientdatachange'));
console.log('ClientData runtime contract passed: exact source keys share one runtime snapshot and source-disabled features fail closed to existing behavior.');

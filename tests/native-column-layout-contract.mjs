import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const source=fs.readFileSync(path.join(root,'webui/private/scripts/torrent-fields.js'),'utf8');
const coreSource=fs.readFileSync(path.join(root,'webui/private/scripts/core.js'),'utf8');
const layoutSource=fs.readFileSync(path.join(root,'webui/private/scripts/layout.js'),'utf8');
const appSource=fs.readFileSync(path.join(root,'webui/private/scripts/app.js'),'utf8');
let saved={mobileFields:['status','progress','dl','up'],columns:[{key:'name',width:500},{key:'size',width:120},{key:'dlspeed',width:111},{key:'upspeed',width:112},{key:'state',width:125}]};
const profile={fallback:false,officialWeiGSupport:true,torrentInfoFields:['priority','name','selected_size','size','progress','state','dlspeed','upspeed','eta','ratio','category','tags','added_on','completion_on','tracker','dl_limit','up_limit','downloaded','uploaded','downloaded_session','uploaded_session','amount_left','time_active','save_path','download_path','completed','ratio_limit','seen_complete','last_activity','availability','infohash_v1','infohash_v2'],torrentTableColumns:[
  {key:'priority',caption:'#',defaultWidth:30,defaultVisible:true,dataProperties:['priority']},
  {key:'name',caption:'Name',defaultWidth:200,defaultVisible:true,dataProperties:['name','state']},
  {key:'selected_size',caption:'Selected Size',defaultWidth:100,defaultVisible:false,dataProperties:['selected_size']},
  {key:'size',caption:'Total Size',defaultWidth:100,defaultVisible:true,dataProperties:['size']},
  {key:'dlspeed',caption:'Down Speed',defaultWidth:100,defaultVisible:true,dataProperties:['dlspeed']},
  {key:'upspeed',caption:'Up Speed',defaultWidth:100,defaultVisible:true,dataProperties:['upspeed']},
  {key:'status',caption:'Status',defaultWidth:100,defaultVisible:true,dataProperties:['state']},
  {key:'infohash_v2',caption:'Info Hash v2',defaultWidth:200,defaultVisible:false,dataProperties:['infohash_v2']}
]};
const W={
  util:{formatBytes:v=>`B${v}`,percent:v=>Number(v)*100,formatSpeed:v=>`S${v}`,formatEta:v=>`E${v}`,formatRatio:v=>`R${v}`,trackerLabel:v=>String(v),isMobile:()=>false},
  Config:{load:()=>structuredClone(saved),save:value=>{saved=structuredClone(value);}},
  Components:{state:code=>[`STATE:${code}`,'']},
  I18n:{getLocale:()=> 'zh-CN'},
  ReleaseProfile:{current:()=>profile},
  DataGrid:{defaults:[]}
};
const window={WeiG:W};window.window=window;
vm.runInNewContext(source,{window,console,Date,Number,Set},{filename:'torrent-fields.js'});
const F=W.TorrentFieldRegistry;
assert.equal(F.layoutVersion,2,'native column preferences must use the v2 user-override layout');
assert.equal(F.columnMinWidth,24,'desktop columns must permit qB-like narrow user widths');
assert.deepEqual(Array.from(F.sourceColumns(profile),x=>x.key),profile.torrentTableColumns.map(x=>x.key),'exact runtime profile must remain the only native column schema owner');
const defs=F.availableColumnDefinitions(profile);
assert.deepEqual(Array.from(defs,x=>x.key),profile.torrentTableColumns.map(x=>x.key),'existing WeiG preferences may reorder known visible slots but must not delete source-only native columns');
assert.ok(defs.every(x=>x.min===24),'all exact-native columns must share the compact user-resize floor without changing upstream default widths');
assert.equal(defs.find(x=>x.key==='priority').width,30,'qB exact default width must remain the initial width even though the user may shrink further');
assert.equal(defs.find(x=>x.key==='selected_size').label,'选定大小','native source columns must receive bounded WeiG presentation labels without owning the schema');
assert.equal(defs.find(x=>x.key==='selected_size').sort,null,'source-only native columns must not infer server-side sort support from field presence');
assert.equal(defs.find(x=>x.key==='status').sort,'state','native columns may reuse an already-proven canonical WeiG sort semantic through dataProperties');
assert.equal(F.get('selected_size').format({selected_size:2048}),'B2048','source-only native columns must render their runtime torrentInfo value rather than a placeholder');
assert.equal(F.get('status').format({state:'downloading'}),'STATE:downloading','native status must render through the canonical state semantic');
let active=F.effectiveDesktopColumns(saved,profile);
assert.deepEqual(Array.from(active,x=>x.key),['name','size','dlspeed','upspeed','status'],'legacy WeiG user intent must survive migration while newly reachable native columns use exact source defaults');
assert.equal(active.find(x=>x.key==='name').width,500,'legacy user width override must survive migration');
F.saveEffectiveDesktopColumns(saved,[...active,defs.find(x=>x.key==='selected_size')],profile);
active=F.effectiveDesktopColumns(saved,profile);
assert.deepEqual(Array.from(active,x=>x.key),['name','selected_size','size','dlspeed','upspeed','status'],'enabling a hidden native column must restore it at its source-relative position rather than appending it');
const swapped=active.slice();
const down=swapped.findIndex(x=>x.key==='dlspeed'),up=swapped.findIndex(x=>x.key==='upspeed');
[swapped[down],swapped[up]]=[swapped[up],swapped[down]];
F.saveEffectiveDesktopColumns(saved,swapped,profile);
active=F.effectiveDesktopColumns(saved,profile);
assert.ok(active.findIndex(x=>x.key==='upspeed')<active.findIndex(x=>x.key==='dlspeed'),'visible user order override must support swapping upload/download columns');
const richer=structuredClone(profile);
richer.torrentInfoFields.push('popularity');
richer.torrentTableColumns.splice(7,0,{key:'popularity',caption:'Popularity',defaultWidth:90,defaultVisible:true,dataProperties:['popularity']});
const richerDefs=F.availableColumnDefinitions(richer),richerActive=F.effectiveDesktopColumns(saved,richer);
assert.ok(richerDefs.some(x=>x.key==='popularity'),'a newly admitted exact native column must automatically appear in column settings');
assert.ok(richerActive.some(x=>x.key==='popularity'),'a new native-default-visible column must automatically become visible when no user override exists');
assert.ok(richerDefs.findIndex(x=>x.key==='popularity')<richerDefs.findIndex(x=>x.key==='infohash_v2'),'new columns must be inserted using exact source-relative order');
const fresh={mobileFields:[],columns:null};
assert.deepEqual(Array.from(F.effectiveDesktopColumns(fresh,profile),x=>x.key),['priority','name','size','dlspeed','upspeed','status'],'fresh users must receive exact qB native default visibility rather than the legacy seven-column product default');
const unknown={fallback:true,officialWeiGSupport:false,torrentInfoFields:profile.torrentInfoFields,torrentTableColumns:profile.torrentTableColumns};
assert.equal(F.sourceColumns(unknown),null,'fallback/future-unknown profiles must not claim native column parity');
assert.ok(appSource.includes("row.addEventListener('dragstart'")&&appSource.includes("row.addEventListener('touchstart'")&&appSource.includes("{passive:false}")&&appSource.includes('touch.timer=setTimeout')&&appSource.includes('},360)'), 'desktop drag and Android-safe 360ms long-press drag must remain in the canonical Columns dialog without disabling ordinary vertical scroll');
assert.ok(coreSource.includes('var GRID_MIN_WIDTH=24')&&coreSource.includes("root.style.setProperty('--weigg-grid-template',template)")&&coreSource.includes("row.style.gridTemplateColumns='var(--weigg-grid-template)'"),'DataGrid resize must use one shared visual template instead of recalculating the complete column layout per visible row on every pointermove');
assert.ok(!coreSource.includes('onChange(cols,false)'),'pointermove resize must not rebuild the VirtualList or persist state on every frame');
assert.ok(coreSource.includes("if(!vertical||self._rendering||self.el.__weiggVirtualScrollFrame)return")&&coreSource.includes('self.render(false)'),'pure horizontal native scrollbar motion must bypass VirtualList rendering while vertical work is coalesced to animation frames');
assert.ok(coreSource.includes("if(!force&&range.key===this._lastRange)return"),'vertical scroll must not rebuild rows while the virtual visible range is unchanged');
assert.ok(coreSource.includes("this.staticHead=options.staticHead||((this.el.id==='torrent-list')?document.getElementById('torrent-table-head'):null)"),'the torrent header must be owned by the same native scroll container as the virtual rows');
assert.ok(coreSource.includes('function commitReorder(sourceKey,targetKey,before)')&&coreSource.includes("e.target.closest('.col-resize')")&&coreSource.includes('cell.__weiggSuppressSort'),'direct header reorder must share the same DataGrid columns while preserving resize and ordinary sort clicks');
assert.ok(coreSource.includes("e.pointerType==='touch'")&&coreSource.includes('longPress=setTimeout')&&coreSource.includes('},280)'),'shared Pointer Events must expose long-press column reorder to touch devices without turning ordinary touch scrolling into drag');
assert.ok(layoutSource.includes("var TABLE_COLUMN_KEY='weigg.tableColumns.v1:'")&&layoutSource.includes('W.SharedColumns={resolve:resolveColumns,commit:commitColumns,reset:resetColumns,read:tableState'),'all reusable detail tables must share one user-override column state owner');
assert.ok(layoutSource.includes('function insertMissingOfficialKeys(order,official)')&&layoutSource.includes('if(!sameOrder(order,official))state.order=order'),'shared column persistence must merge new official columns into current source order while persisting user order only when it is an override');
assert.ok(layoutSource.includes('if(!!column.visible!==!!base.defaultVisible)visibility[column.key]=!!column.visible')&&layoutSource.includes('Math.abs(width-defaultWidth)>.5'),'shared column persistence must store visibility/width differences rather than copying the current qB schema into localStorage');
assert.ok(layoutSource.includes("return W.I18n.qbText(String(key||''),source||String(key||''))")&&layoutSource.includes("out.label=officialText('column.'+out.key,native.translation,fallback)"),'main table labels must reuse the existing exact-qB official translation resolver instead of storing WeiG-owned translated column names');
assert.ok(layoutSource.includes('function exactProfile(){var R=W.ReleaseProfile')&&layoutSource.includes('!R.isCertified()')&&layoutSource.includes('profile.torrentDetailUi'),'detail UI evidence must fail closed outside exact/equivalent certified qB profiles');
assert.ok(layoutSource.includes("return'detail.'+String(surface||'')+'.'+String(key||'')")&&layoutSource.includes("officialText('detail.tab.'")&&layoutSource.includes("officialText('detail.property.'"),'detail tabs/properties/table columns must all resolve through the source-generated official translation keyspace');
assert.ok(appSource.includes('C.torrentRow(t,app.selection.has(t.hash),handlers,app.columns,W.DataGrid.template(app.columns))'),'VirtualList rows must render from the current column order/width instead of a stale captured template');
assert.ok(!source.includes('MutationObserver')&&!coreSource.includes('MutationObserver')&&!layoutSource.includes('MutationObserver'),'column layout must not use a post-render MutationObserver repair layer');
console.log('Native column layout contract passed: exact qB schema/defaults remain authoritative, shared column state persists only user overrides, official labels remain version/locale-derived, and native scroll/pointer hot paths avoid rebuild persistence.');

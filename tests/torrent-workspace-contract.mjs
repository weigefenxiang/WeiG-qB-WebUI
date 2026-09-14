import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const index=read('webui/private/index.html');
const app=read('webui/private/scripts/app.js');
const core=read('webui/private/scripts/core.js');
const ui=read('webui/private/scripts/ui.js');
const appCss=read('webui/private/css/app.css');
const tableCss=read('webui/private/css/table.css');
const selection=read('webui/private/scripts/selection.js');
const client=read('webui/private/scripts/qb-client.js');
const semantics=read('webui/private/scripts/torrent-semantics.js');
const filterView=read('webui/private/scripts/torrent-filter-view.js');
const spatial=read('webui/private/scripts/spatial.js');
const capabilities=read('webui/private/scripts/capabilities.js');
const data=JSON.parse(read('webui/private/data/capabilities.json'));
const docs=read('docs/008.Torrent工作区与状态所有权.md');

assert((index.match(/id="filter-nav"/g)||[]).length===1&&index.includes('id="sidebar-facet-slot"'));
assert(index.includes('scripts/release-profile.js')&&index.includes('scripts/torrent-filter-view.js'));
assert(index.indexOf('scripts/release-profile.js')<index.indexOf('scripts/capabilities.js'));
assert(index.indexOf('scripts/torrent-semantics.js')<index.indexOf('scripts/app.js'));

// Main Torrent table: one real native scroll owner. The header lives inside the same
// #torrent-list scroller as the virtual spacer so browser scrollLeft moves both directly.
assert(core.includes("this.staticHead=options.staticHead||((this.el.id==='torrent-list')?document.getElementById('torrent-table-head'):null)"),'Torrent VirtualList must resolve the canonical header as its static head');
assert(core.includes("if(this.staticHead){this.staticHead.classList.add('virtual-list__sticky-head');this.el.appendChild(this.staticHead);}"),'Torrent header must be a real child of the native VirtualList scroll owner');
assert(core.includes("var top=self.el.scrollTop,left=self.el.scrollLeft,vertical=Math.abs(top-self._lastScrollTop)>.5,horizontal=Math.abs(left-self._lastScrollLeft)>.5;"),'VirtualList scroll owner must distinguish vertical movement from pure horizontal movement');
assert(core.includes("if(!vertical||self._rendering||self.el.__weiggVirtualScrollFrame)return;"),'pure horizontal scroll must not schedule a VirtualList render');
assert(core.includes("self.el.__weiggVirtualScrollTop=top;self.el.__weiggVirtualScrollLeft=left;"),'native scroll coordinates must be recorded without a second synchronization state');
assert(!/scrollLeft[^;\n]*(?:transform|translate)|(?:transform|translate)[^;\n]*scrollLeft/.test(core),'header/rows must not be synchronized by scrollLeft transforms');
assert(appCss.includes('.torrent-list{overflow:auto;position:relative}'),'#torrent-list must remain the native x/y scroll owner');
assert(tableCss.includes('#torrent-list>.torrent-table-head{position:sticky;top:0;')&&tableCss.includes('width:max-content;min-width:100%'),'sticky header must participate in the same horizontally scrollable content width');
assert(tableCss.includes('#torrent-list>.virtual-list__spacer{position:relative;width:max-content;min-width:100%}'),'virtual rows must share the same native horizontal content extent as the header');
assert(!tableCss.includes('translateX(')&&!tableCss.includes('margin-left:calc(-1 *'),'table CSS must not repair header/body horizontal synchronization with presentation offsets');
assert(tableCss.includes('.shared-table__head .col-resize{right:0}'),'Detail resize hitbox must stay fully inside overflow-clipped header cells on desktop and coarse pointers');

// Resize/reorder hot path: pointermove only updates the CSS grid projection. VirtualList rebuild
// and persistence happen at the bounded interaction commit, never on each pointer frame.
assert(ui.includes("function move(ev){if(ev.pointerId!==pointerId)return;var active=columns.find(function(column){return column.key===key;});if(!active)return;active.width=Math.max(active.min||24,startW+(ev.clientX-startX));setTemplate();}function up(ev){if(ev.pointerId!==pointerId)return;"),'column resize pointermove must only guard the active pointer and project the new CSS grid template');
assert(ui.includes("notify('resize');}global.addEventListener('pointermove',move,true);"),'column resize must notify/persist only after pointerup/pointercancel commit while drag tracking lives outside the narrow handle');
assert(!ui.includes('localStorage'),'shared pointer interaction engine must not write localStorage directly in its hot path');
assert(app.includes("if(app.virtual)app.virtual.render();if(save)saveEffectiveColumns(cols);"),'main table may rebuild/persist once after a committed column interaction, not during pointermove');

assert(filterView.includes('W.TorrentSemantics.statusFilters')&&!filterView.includes("supports('privateFilter')"),'TorrentFilterView must render status semantics only; Private / PT belongs to the Tracker facet');
assert(app.includes('W.TorrentSemantics.matchesStatus')&&selection.includes('W.LibraryController.matchesTorrent'),'Page and Selection must consume one canonical LibraryController/TorrentSemantics matcher');
assert(app.includes("PRIVATE_TRACKER='__weigg_private__'")&&app.includes("W.CapabilityRegistry.supports('privateFilter')")&&app.includes("kind==='tracker'&&privateTrackerSupported()"),'Private / PT must be a capability-gated Tracker pseudo-option');
assert(app.includes('matchesTorrent:function(t,state){return filterMatch(t,state||app);}')&&selection.includes('return !!(W.LibraryController&&W.LibraryController.matchesTorrent'),'Selection must delegate matching to LibraryController instead of owning a second tracker/private matcher');
assert(app.includes('localStatusFilter')&&app.includes('needsCatalogFiltering')&&app.includes('rebuildCatalogFacets'),'formal App must own local catalog integration without per-torrent requests');
assert(!/filter==='seeding'[^\n]*progress/.test(app)&&!/filter==='seeding'[^\n]*progress/.test(selection),'callers must not reintroduce completed=>seeding heuristics');
assert(spatial.includes("kind:'category',capability:'categoryFacet'")&&spatial.includes("kind:'tag',capability:'tagFacet'"),'Facet presentation must consume product read/filter capabilities, not native taxonomy APIs');
assert(!spatial.includes("kind:'tag',capability:'tags'"),'Tags facet must never be disabled merely because the native Tags taxonomy API is absent');

const profile={fallback:false,torrentFilters:['all','downloading','seeding','completed','paused','resumed','active','inactive','errored'],torrentInfoFields:['hash','name','state','progress','dlspeed','upspeed','category','tags'],torrentStates:['downloading','stalledDL','uploading','stalledUP','pausedDL','pausedUP','checkingDL','checkingUP','error','missingFiles']};
const sandbox={URL,window:{WeiG:{util:{normalizeTracker(raw){const value=String(raw||'').trim();if(!value)return'';try{const u=new URL(value);return`${u.protocol}//${u.hostname}${u.port?':'+u.port:''}${u.pathname||'/'}`;}catch{return value;}}},ReleaseProfile:{current:()=>profile,torrentFilters:()=>profile.torrentFilters,supportsTorrentFilter:name=>profile.torrentFilters.includes(name)||(name==='stopped'&&profile.torrentFilters.includes('paused'))||(name==='running'&&profile.torrentFilters.includes('resumed')),hasTorrentInfoField:name=>profile.torrentInfoFields.includes(name),torrentStates:()=>profile.torrentStates}}}};
sandbox.window.window=sandbox.window;
vm.runInNewContext(semantics,sandbox,{filename:'torrent-semantics.js'});
const T=sandbox.window.WeiG.TorrentSemantics;
assert(T.matchesStatus({state:'uploading',progress:1},'seeding',[]));
assert(!T.matchesStatus({state:'pausedUP',progress:1},'seeding',[]),'completed paused torrent must not be classified as seeding');
assert(T.matchesStatus({state:'pausedUP',progress:1},'completed',[]));
assert(T.matchesStatus({state:'pausedUP'},'stopped',[]));
assert(T.statusFilters().includes('stopped')&&!T.statusFilters().includes('paused'));
assert(T.filterMode('stalled')==='local'&&T.filterMode('checking')==='local','qB4 source states must enable reliable local status filters when native filters are absent');
assert(T.statusFilters().includes('stalled')&&T.statusFilters().includes('stalled_uploading')&&T.statusFilters().includes('checking'),'derived qB4 filters must become formal product filters');

for(const id of ['privateFilter','categoryFacet','tagFacet'])assert(data.features[id].presentation.unsupported==='hide',`${id} unsupported UI policy must be hide`);
assert(!data.features.stalledFilter.selectors&&!data.features.stalledFilter.presentation,'native stalledFilter capability must not hide a locally derived product filter');
assert(data.features.privateFilter.upstream.torrentInfoField==='private'&&data.features.privateFilter.sourceRequired===true,'Private / PT visibility must remain exact-source capability-gated');
assert(!data.features.privateFilter.selectors,'Private capability must not own a retired status-filter selector');
assert(data.features.categoryFacet.upstream.torrentInfoField==='category');
assert(data.features.tagFacet.upstream.torrentInfoField==='tags');
assert(data.features.tags.upstream.action==='torrentscontroller.h:tagsAction');
assert(data.features.addTags.upstream.action==='torrentscontroller.h:addTagsAction');
assert(data.features.trackerRemove.upstream.action==='torrentscontroller.h:removeTrackersAction');
assert(capabilities.includes('torrentInfoField')&&capabilities.includes('sourceRequired===true'));

assert(selection.includes('supportsTorrentAction')&&selection.includes("capability:'addTags'")&&selection.includes('if(!actionSupported(def.kind))return'),'action menu must gate source-absent actions before rendering');
assert(client.includes("_guardedTorrentAction('reannounce'")&&client.includes("_guardedTorrentAction('removeTrackers'"),'QBClient must fail closed even if a UI caller bypasses presentation gates');
assert(app.includes("capabilitySupported('trackerRemove',false)")&&app.includes("capabilitySupported('trackerEdit',app.client.capabilities.trackerEdit)"),'Tracker detail controls must be source-gated before click');

for(const rule of ['TORRENT-FILTER-OWNER'])assert(docs.includes(rule));
assert(docs.includes('Tracker facet')&&docs.includes("W.CapabilityRegistry.supports('privateFilter')")&&docs.includes('LibraryController.matchesTorrent'),'Torrent ownership doc must preserve capability-gated Private/PT facet and selection parity');
console.log('Torrent workspace semantic ownership contract passed: one native horizontal scroll owner keeps header/rows attached without horizontal VirtualList renders, resize persistence stays off the pointer hot path, status filters remain source-backed, Private / PT is capability-gated in the Tracker facet, and page/selection matching share one canonical owner.');

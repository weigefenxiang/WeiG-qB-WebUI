import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const bytes=(p)=>fs.readFileSync(path.join(root,p));
function assert(ok,msg){if(!ok)throw new Error(msg);}

const brand=read('webui/private/scripts/brand.js');
const login=read('webui/public/index.html');
const loginAlias=read('webui/public/login.html');
const logs=read('webui/private/scripts/logs.js');
const components=read('webui/private/scripts/components.js');
const app=read('webui/private/scripts/app.js');
const css=read('webui/private/css/logs.css');
const appCss=read('webui/private/css/app.css');
const tableCss=read('webui/private/css/table.css');
const core=read('webui/private/scripts/core.js');
const publicMark=bytes('webui/public/assets/Wei.G.png');

assert(!fs.existsSync(path.join(root,'webui/private/assets/Wei.G.ico'))&&!fs.existsSync(path.join(root,'webui/private/assets/Wei.G.png')),'private Wei.G asset duplicates must stay absent; authenticated qB requests fall back to the one public asset');
assert(publicMark.length===7905,'canonical Wei.G PNG must keep the verified historical visible brand bytes');
assert(publicMark.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),'Wei.G brand asset must be a real PNG, not image bytes mislabeled as ICO');
assert(!fs.existsSync(path.join(root,'webui/public/assets/Wei.G.ico')),'damaged/blank ICO owner must stay retired once the canonical PNG is active');
assert(brand.includes("var ICON='assets/Wei.G.png'"),'Brand owner must use the canonical local Wei.G PNG');
for(const [name,source] of [['public/index.html',login],['public/login.html',loginAlias]]){
  assert(source.includes('href="assets/Wei.G.png?v=__WEIG_GIT_SHA__"'),`${name} favicon must use the canonical local Wei.G.png asset`);
  assert(source.includes('src="assets/Wei.G.png"'),`${name} brand image must keep the existing local Wei.G asset`);
  assert(!source.includes('favicon.svg'),`${name} must not reference the retired generated favicon.svg`);
}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const p=path.join(dir,entry.name);return entry.isDirectory()?walk(p):[p];});}
for(const file of walk(path.join(root,'webui')).filter(p=>/\.(?:html|js|css)$/i.test(p))){
  const source=fs.readFileSync(file,'utf8');
  assert(!source.includes('WeiG-OpenWrt-AutoBuild/main/site/wrt/Wei.G.ico'),`${path.relative(root,file)} must not depend on the external Wei.G icon`);
  assert(!source.includes('raw.githubusercontent.com/weigefenxiang/WeiG-OpenWrt-AutoBuild'),`${path.relative(root,file)} must not load the external Wei.G icon host`);
}

assert(logs.includes('if(state.types.has(type))state.types.delete(type);else state.types.add(type);'),'Each log level must be independently toggleable');
assert(!logs.includes('state.types.size>1'),'Logs must allow all four levels to be disabled');
for(const tone of ['normal','info','warning','danger'])assert(logs.includes('b.dataset.tone=typeTone(type)')&&css.includes(`--logs-tone-${tone}`),`Missing canonical ${tone} log tone`);
assert(logs.includes('expandedId:null')&&logs.includes("row.setAttribute('aria-expanded',expanded?'true':'false')"),'Log rows must expose one shared expand/collapse state');
assert(logs.includes('variableHeight:true')&&logs.includes('itemKey:rowKey'),'Logs must reuse the canonical DataViewport in variable-height mode');
assert(components.includes('C.pagerControl=function(opts)'),'Pager must have one canonical shared Components owner');
assert(app.includes('app.pagerControl=C.pagerControl')&&!app.includes("U.$('prev-btn').onclick"),'Torrent pager must consume the shared Pager owner and retire feature-local prev/next handlers');
assert(logs.includes('state.pager=C.pagerControl')&&logs.includes('items=all.slice(start,start+state.pageSize)'),'Logs must reuse the shared Pager owner and project one bounded history page into DataViewport');
assert(logs.includes("if(U.isMobile&&U.isMobile())return String(state.page+1)+' / '+pages"),'Mobile Logs pager label must expose only current/total pages without duplicating page size copy');
assert(components.includes("pager__copy")&&components.includes("pager__arrow"),'Shared Pager owner must expose semantic copy/arrow spans so compact mobile presentation does not rewrite feature buttons');
assert(!css.includes('height:calc(100svh - 230px)')&&!css.includes('height:calc(100svh - var(--topbar-h) - 118px)'),'Logs mobile layout must not own viewport magic subtraction outside the shared workspace contract');
assert(css.includes('.logs-page-size>span{display:inline}'),'Mobile Logs page-size control must keep the shared Per page label visible');
assert(css.includes('#logs-view.logs-size-compact>.tool-page,#logs-view.logs-size-max>.tool-page{flex:1 1 0;height:auto;min-height:0;max-height:100%}'),'Mobile Logs size modes must consume the available shared tool-page geometry instead of creating fixed-height second owners');
assert(logs.includes("panel.className='logs-panel surface surface--panel surface--scroll'"),'Dynamic Logs panel must consume the canonical scroll-surface compositor owner');
assert(logs.includes('pageSize:50')&&logs.includes("C.selectControl({id:'logs-page-size'")&&logs.includes('options:[20,50,100,200]')&&logs.includes('state.pageSize=Math.max(1,Number(value)||50)')&&logs.includes('var MAX_ITEMS=5000'),'Logs pagination must expose a canonical selectable 20/50/100/200 page size while bounding presentation independently from the retained 5000-item history');
assert(css.includes('.logs-pager{display:grid;grid-template-columns:auto minmax(0,1fr)')&&css.includes('.logs-page-size .ui-select{--ui-select-width:72px')&&css.includes('.logs-pager .pager__nav'),'Logs pager presentation must reuse the shared pager DOM and canonical Select for page size rather than a second control family');
assert(core.includes('this.variableHeight=!!options.variableHeight')&&core.includes('W.DataViewport.prototype.resetHeights'),'DataViewport must own the reusable variable-height behavior');
assert(css.includes('.logs-message{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),'Collapsed log messages must stay single-line with ellipsis');
assert(css.includes('.logs-row.is-expanded .logs-message{white-space:pre-wrap;overflow:visible;text-overflow:clip'),'Expanded log rows must reveal wrapped full content');

assert(appCss.includes('.data-viewport__spacer{position:relative;width:100%;min-width:100%}.torrent-list>.data-viewport__spacer{width:max-content}'),'Generic DataViewport spacer must own available width while Torrent alone may widen horizontally');
assert(appCss.includes('.status-pill{display:inline-flex;align-items:center;justify-content:center;width:max-content'),'Canonical status pills must center their content without log-specific fixed widths');
assert(!/(^|})\.virtual-list \.virtual-row\{display:grid;grid-template-columns:/.test(appCss),'Generic DataViewport must not impose detail row columns on Logs');
assert(!appCss.includes('#detail-content .data-viewport .data-viewport__row{display:grid;grid-template-columns:'),'Legacy Detail virtual-row columns must stay retired so Shared Detail is the only detail table geometry owner');
assert(tableCss.includes('.data-grid__head,.data-grid__row{display:grid;align-items:center;column-gap:10px;min-width:max-content}')&&tableCss.includes('.shared-table__head,.shared-table__row{grid-template-columns:var(--weig-detail-grid-template)}'),'Shared Detail tables must consume the canonical DataGrid geometry while keeping only their schema template locally.');
assert(!appCss.includes('.data-viewport .data-viewport__row:not(.torrent-mobile-card)>:nth-child(3){display:none}'),'Mobile third-column hiding must not apply to every DataViewport row');
assert(!appCss.includes('#detail-content .data-viewport .data-viewport__row>:nth-child(3){display:none}'),'Legacy mobile Detail third-column hiding must stay retired with the old virtual-row layout owner');
assert(!tableCss.includes('.shared-table__row>:nth-child(3){display:none}'),'Shared Detail mobile layout must not discard source columns by positional nth-child rules');

assert(css.includes('.logs-head,.logs-row{display:grid;grid-template-columns:'),'Desktop log header and rows must share one column geometry');
assert(css.includes('.logs-head>span:nth-child(3){justify-self:center;text-align:center}')&&css.includes('.logs-row .logs-level{justify-self:center;text-align:center'),'Desktop Level header and level pills must share the same center anchor');
assert(!/\.logs-row \.logs-level\{[^}]*\b(?:width|min-width|max-width)\s*:/.test(css),'Log level labels must use the canonical status-pill intrinsic width instead of fixed-width padding');
assert(css.includes('.logs-row{min-height:72px;grid-template-columns:max-content minmax(0,1fr);grid-template-rows:auto auto;gap:5px 8px'),'Mobile log metadata must form one compact left-aligned level/time group');
assert(css.includes('.logs-row .logs-level{grid-column:1;grid-row:2;justify-self:start}')&&css.includes('.logs-time{grid-column:2;grid-row:2;justify-self:start;align-self:center'),'Mobile metadata must place the visible colored level immediately before date/time');

console.log('Logs UI contract passed: shared bounded Pager + DataViewport history projection, canonical tones, Shared Detail isolation, responsive metadata, and click expansion.');

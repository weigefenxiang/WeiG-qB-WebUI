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
const css=read('webui/private/css/logs.css');
const appCss=read('webui/private/css/app.css');
const tableCss=read('webui/private/css/table.css');
const core=read('webui/private/scripts/core.js');
const privateIcon=bytes('webui/private/assets/Wei.G.ico');
const publicIcon=bytes('webui/public/assets/Wei.G.ico');
const privateFavicon=bytes('webui/private/favicon.svg');
const publicFavicon=bytes('webui/public/assets/favicon.svg');

assert(privateIcon.equals(publicIcon),'public/private Wei.G icon copies must remain byte-identical');
assert(privateIcon.length>100&&privateIcon.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),'Wei.G icon asset must contain the expected PNG payload');
assert(privateFavicon.equals(publicFavicon),'public/private browser favicon copies must remain byte-identical');
assert(publicFavicon.toString('utf8').includes('<circle cx="32" cy="32" r="30"'),'browser favicon must preserve a circular primary silhouette');
assert(brand.includes("var ICON='assets/Wei.G.ico'"),'Brand owner must use the local Wei.G asset');
for(const [name,source] of [['public/index.html',login],['public/login.html',loginAlias]]){
  assert(source.includes('href="assets/favicon.svg?v=round-1"'),`${name} favicon must use the local cache-busted round browser asset`);
  assert(source.includes('src="assets/Wei.G.ico"'),`${name} brand image must keep the existing local Wei.G asset`);
  assert(!source.includes('src="assets/favicon.svg'),`${name} page logo must not be replaced by the favicon asset`);
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
assert(logs.includes('variableHeight:true')&&logs.includes('itemKey:rowKey'),'Logs must reuse the canonical VirtualList in variable-height mode');
assert(core.includes('this.variableHeight=!!options.variableHeight')&&core.includes('W.VirtualList.prototype.resetHeights'),'VirtualList must own the reusable variable-height behavior');
assert(css.includes('.logs-message{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'),'Collapsed log messages must stay single-line with ellipsis');
assert(css.includes('.logs-row.is-expanded .logs-message{white-space:pre-wrap;overflow:visible;text-overflow:clip'),'Expanded log rows must reveal wrapped full content');

assert(appCss.includes('.virtual-list__spacer{position:relative;width:100%;min-width:100%}.torrent-list>.virtual-list__spacer{width:max-content}'),'Generic VirtualList spacer must own available width while Torrent alone may widen horizontally');
assert(appCss.includes('.status-pill{display:inline-flex;align-items:center;justify-content:center;width:max-content'),'Canonical status pills must center their content without log-specific fixed widths');
assert(!/(^|})\.virtual-list \.virtual-row\{display:grid;grid-template-columns:/.test(appCss),'Generic VirtualList must not impose detail row columns on Logs');
assert(!appCss.includes('#detail-content .virtual-list .virtual-row{display:grid;grid-template-columns:'),'Legacy Detail virtual-row columns must stay retired so Shared Detail is the only detail table geometry owner');
assert(tableCss.includes('.shared-table__head,.shared-table__row{display:grid;align-items:center;min-width:max-content;grid-template-columns:var(--weigg-detail-grid-template)}'),'Shared Detail header and rows must retain one canonical column geometry outside generic VirtualList CSS');
assert(!appCss.includes('.virtual-list .virtual-row:not(.torrent-mobile-card)>:nth-child(3){display:none}'),'Mobile third-column hiding must not apply to every VirtualList row');
assert(!appCss.includes('#detail-content .virtual-list .virtual-row>:nth-child(3){display:none}'),'Legacy mobile Detail third-column hiding must stay retired with the old virtual-row layout owner');
assert(!tableCss.includes('.shared-table__row>:nth-child(3){display:none}'),'Shared Detail mobile layout must not discard source columns by positional nth-child rules');

assert(css.includes('.logs-head,.logs-row{display:grid;grid-template-columns:'),'Desktop log header and rows must share one column geometry');
assert(css.includes('.logs-head>span:nth-child(3){justify-self:center;text-align:center}')&&css.includes('.logs-row .logs-level{justify-self:center;text-align:center'),'Desktop Level header and level pills must share the same center anchor');
assert(!css.includes('width:72px')&&!css.includes('min-width:72px')&&!css.includes('min-width:64px'),'Log level labels must use the canonical status-pill intrinsic width instead of fixed-width padding');
assert(css.includes('.logs-row{min-height:72px;grid-template-columns:max-content minmax(0,1fr);grid-template-rows:auto auto;gap:5px 8px'),'Mobile log metadata must form one compact left-aligned level/time group');
assert(css.includes('.logs-row .logs-level{grid-column:1;grid-row:2;justify-self:start}')&&css.includes('.logs-time{grid-column:2;grid-row:2;justify-self:start;align-self:center'),'Mobile metadata must place the visible colored level immediately before date/time');

console.log('Logs UI contract passed: local brand asset, independent filters, canonical tones, intrinsic centered desktop level pills, generic VirtualList isolation, Shared Detail table ownership, left-aligned mobile level/time metadata, and click expansion.');

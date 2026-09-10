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
const core=read('webui/private/scripts/core.js');
const privateIcon=bytes('webui/private/assets/Wei.G.ico');
const publicIcon=bytes('webui/public/assets/Wei.G.ico');

assert(privateIcon.equals(publicIcon),'public/private Wei.G icon copies must remain byte-identical');
assert(privateIcon.length>100&&privateIcon.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])),'Wei.G icon asset must contain the expected PNG payload');
assert(brand.includes("var ICON='assets/Wei.G.ico'"),'Brand owner must use the local Wei.G asset');
for(const [name,source] of [['public/index.html',login],['public/login.html',loginAlias]]){
  assert(source.includes('href="assets/Wei.G.ico"'),`${name} favicon must be local`);
  assert(source.includes('src="assets/Wei.G.ico"'),`${name} brand image must be local`);
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
assert(css.includes('.logs-head,.logs-row{display:grid;grid-template-columns:'),'Desktop log header and rows must share one column geometry');
assert(css.includes('.logs-head>span:nth-child(3){justify-self:center')&&css.includes('.logs-row .logs-level{justify-self:center'),'Desktop Level header and level pills must share the same center anchor');
assert(css.includes('.logs-row .logs-level{grid-column:1;grid-row:2;justify-self:start')&&css.includes('.logs-time{grid-column:2;grid-row:2'),'Mobile metadata must place the colored log level before date/time');
assert(css.includes('.logs-row .logs-level{justify-self:center;min-width:72px;text-align:center;color:var(--logs-tone)'),'Log level pills must explicitly own their canonical tone over generic status-pill styling');

console.log('Logs UI contract passed: local brand asset, independent level filters, four semantic tones, aligned desktop level column, mobile level-before-time metadata, and variable-height click expansion.');

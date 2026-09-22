import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const index=read('webui/private/index.html');
const theme=read('webui/private/css/theme.css');
const core=read('webui/private/scripts/core.js');
const app=read('webui/private/scripts/app.js');
const desktopNav=(index.match(/<nav id="app-nav"[\s\S]*?<\/nav>/)||[])[0]||'';
const mobileNav=(index.match(/<nav id="mobile-bottom-nav"[\s\S]*?<\/nav>/)||[])[0]||'';

assert(desktopNav,'Desktop navigation missing');
assert(mobileNav,'Mobile navigation missing');
assert(!desktopNav.includes('data-route="search"')&&!desktopNav.includes('data-i18n="nav.search"'),'Standalone Search navigation must be removed, not hidden');
assert(!mobileNav.includes('data-route="search"')&&!mobileNav.includes('data-i18n="nav.search"'),'Mobile Search navigation must not exist');
assert(index.includes('id="search-input"')&&index.includes('data-i18n-placeholder="search.torrents"'),'Torrent-list search must remain available after retiring standalone Search navigation');

for(const token of ['--scrollbar-track:','--scrollbar-thumb:','--scrollbar-thumb-hover:','--scrollbar-thumb-active:'])assert(theme.includes(token),`Scrollbar theme token missing: ${token}`);
assert(/html\[data-theme="light"\]\{[^}]*--scrollbar-track:[^}]*--scrollbar-thumb:/.test(theme),'Light scrollbar palette missing');
assert(theme.includes('scrollbar-width:thin')&&theme.includes('scrollbar-color:var(--scrollbar-thumb) var(--scrollbar-track)'),'Firefox scrollbar styling missing');
assert(theme.includes('::-webkit-scrollbar{width:10px;height:10px}'),'Desktop Chromium scrollbar sizing missing');
assert(theme.includes('::-webkit-scrollbar-thumb{background:var(--scrollbar-thumb)')&&theme.includes('border-radius:999px'),'Rounded Chromium scrollbar thumb missing');
assert(theme.includes('::-webkit-scrollbar-button{display:none;width:0;height:0}'),'Legacy scrollbar arrow buttons must be removed');
assert(/@media\(max-width:820px\)[\s\S]*::-webkit-scrollbar\{width:7px;height:7px\}/.test(theme),'Mobile scrollbar must use the slimmer presentation');

assert(core.includes("this.staticHead=options.staticHead||((this.el.id==='torrent-list')?document.getElementById('torrent-table-head'):null)"),'Torrent header and rows must share one native scroll owner');
assert(core.includes('self.el.__weigVirtualScrollLeft=left')&&core.includes('if(!vertical||self._rendering||self.el.__weigVirtualScrollFrame)return'),'VirtualList may remember horizontal position, but pure horizontal native scrollbar motion must not rebuild rows');
assert(!core.includes('Math.max(0,this.el.scrollWidth-this.el.clientWidth)'),'Horizontal scroll must not be repaired after row reconstruction; the native scroll owner keeps scrollLeft continuously');
assert(!/function renderList\(\)\{var list=U\.\$\('torrent-list'\),items=app\.torrents;list\.textContent='';/.test(app),'App renderList must not clear the horizontal scroll owner before VirtualList can preserve native ownership');
assert(core.includes("W.VirtualList.prototype.resetScroll=function(){this.el.__weigVirtualScrollTop=0;this._lastScrollTop=0;this.el.scrollTop=0;this._lastRange='';this.render(true);}"),'Semantic filter/page reset remains vertical-only and must not reset user horizontal position');

console.log('Navigation/scrollbar contract passed: standalone Search nav retired, themed scrollbars remain canonical, and torrent header/rows share native horizontal scroll ownership without VirtualList rebuild repair.');

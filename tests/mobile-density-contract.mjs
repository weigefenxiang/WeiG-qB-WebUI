import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const assert=(ok,msg)=>{if(!ok)throw new Error(msg);};

const index=read('webui/private/index.html');
const layout=read('webui/private/css/layout.css');
const settingsCss=read('webui/private/css/settings.css');
const navigation=read('webui/private/scripts/navigation.js');
const responsive=read('webui/private/scripts/responsive.js');
const settings=read('webui/private/scripts/settings.js');
const i18n=read('webui/private/scripts/i18n.js');

// Mobile navigation follows Desktop information architecture without duplicating the canonical Header Search.
const bottom=index.match(/<nav id="mobile-bottom-nav"[\s\S]*?<\/nav>/)?.[0]||'';
const routes=[...bottom.matchAll(/data-route="([^"]*)"/g)].map(m=>m[1]);
assert(JSON.stringify(routes)===JSON.stringify(['','rss','logs','settings']),`Mobile bottom route order must be Torrents/RSS/Logs/Settings: ${JSON.stringify(routes)}`);
assert(!bottom.includes('data-route="search"'),'Mobile bottom navigation must not duplicate Header Search');
assert((index.match(/id="search-input"/g)||[]).length===1,'Canonical Torrent Search input must remain unique');

// Torrent detail density is responsive presentation of the existing semantic nodes.
assert(index.includes('id="detail-context-slot"')&&index.includes('class="detail-state-row"'),'Mobile detail must provide one adaptive Back/status row slot');
assert((index.match(/id="detail-state"/g)||[]).length===1&&(index.match(/id="detail-progress-bar"/g)||[]).length===1,'Detail status/progress must retain one semantic DOM owner');
assert(navigation.includes("target=mobile&&slot?slot:tabs")&&navigation.includes("label.textContent=mobile?'Back':'Back to torrents'"),'Navigation must move the same Back control between Mobile status row and Desktop tabs');
assert(!navigation.includes('cloneNode'),'Adaptive Back presentation must not duplicate the navigation control');
assert(layout.includes('#detail-view .detail-hero .eyebrow{display:none}')&&layout.includes('grid-template-columns:repeat(5,minmax(0,1fr))'),'Mobile detail must hide eyebrow and keep all five tabs on one row');
assert(layout.includes('[data-tab="webseeds"]::after{content:"HTTP"'),'Mobile Web Seeds tab must use the compact HTTP label');
assert(layout.includes("font-size:calc(19px + var(--font-scale-offset))")&&layout.includes('#detail-title.is-expanded'),'Mobile Torrent title must be 2px smaller than prior narrow title and support explicit expansion');
assert(responsive.includes("dataset.detailTitleAction='copy-expand'")&&responsive.includes("addEventListener('dblclick'")&&responsive.includes('navigator.clipboard')&&responsive.includes('W.toast'),'Torrent title must use canonical single-copy / double-expand interaction with Feedback');
const createsLegacyHoverMetadata=/\.dataset\.tooltip\s*=|setAttribute\(\s*['"]data-tooltip['"]|\.title\s*=|setAttribute\(\s*['"]title['"]/.test(responsive);
assert(!createsLegacyHoverMetadata,'Responsive presentation must not create native title/data-tooltip hover metadata; cleanup via removeAttribute remains allowed');

// Settings remove mobile-only chrome, keep Search+Save in one row, and share one Save owner.
assert(settingsCss.includes('#settings-view>.settings-header>div:first-child{display:none}'),'Mobile Settings title/description block must be retired from presentation');
assert(settingsCss.includes('grid-template-columns:minmax(0,1fr) auto')&&!settingsCss.includes('@media(max-width:560px){.settings-header__actions{grid-template-columns:1fr}'),'Mobile Search and Save must remain on the same row at narrow widths');
assert(index.includes('id="save-settings-btn"')&&(index.match(/id="save-settings-btn"/g)||[]).length===1,'Settings must retain exactly one Save button');
assert(settings.includes("save.hidden=ctx.tab==='about'")&&settings.includes('weiggDraft')&&settings.includes('async function saveWeiG()')&&settings.includes("if(controller.tab==='weigg')return saveWeiG()"),'WeiG and qB Settings must share the canonical Save entry while keeping separate persistence targets');
assert(settings.includes('await client.setPreferences(pending)')&&settings.includes('controller.prefs=await client.getPreferences()'),'qB Save must retain write plus verification readback');
assert(i18n.includes("'settings.save':'Save'")&&i18n.includes("'settings.save':'保存'"),'Settings Save label must be compact in English and Simplified Chinese');
assert(!index.includes('settings-add-torrent')&&!settings.includes('settings-add-torrent'),'Settings must not introduce a duplicate Add Torrent surface');

console.log('Mobile density contract passed: compact detail hierarchy, canonical title interaction, Torrents/RSS/Logs/Settings navigation, and shared draft-based Settings Save.');

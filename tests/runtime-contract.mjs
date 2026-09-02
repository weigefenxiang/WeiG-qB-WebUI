import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..');
function assert(ok,msg){if(!ok)throw new Error(msg);}
function text(p){return fs.readFileSync(path.join(root,p),'utf8');}
function walk(abs,rel=''){return fs.readdirSync(abs,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(abs,e.name),path.join(rel,e.name)):[path.join(rel,e.name).replaceAll('\\','/')]);}
const runtimeBase=path.join(root,'webui/private'),runtimeFiles=walk(runtimeBase);
const versioned=runtimeFiles.filter(p=>/(?:^|\/)(?:v\d{3}|[^/]+-v\d{3})(?:\.[^/]+)$/.test(p));
assert(versioned.length===0,`Versioned runtime assets remain: ${versioned.join(', ')}`);
const required=[
 'css/app.css','css/base.css','css/spatial.css','css/transfer.css','css/controls.css','css/layout.css','css/theme.css','css/ui.css','css/polish.css','css/logs.css','css/brand.css','css/header.css','css/session.css','css/settings.css',
 'scripts/i18n.js','scripts/core.js','scripts/i18n-time.js','scripts/i18n-alternative-webui.js','scripts/i18n-interface.js','scripts/i18n-transfer.js','scripts/torrent-semantics.js','scripts/settings-schema.js','scripts/settings-translations.js','scripts/qb-client.js','scripts/components.js','scripts/floating.js','scripts/time.js','scripts/advanced-settings.js','scripts/brand.js','scripts/session.js','scripts/settings.js','scripts/navigation.js','scripts/spatial.js','scripts/transfer.js','scripts/responsive.js','scripts/selection.js','scripts/layout.js','scripts/ui.js','scripts/polish.js','scripts/app.js','scripts/ux.js','scripts/header.js','scripts/logs.js'
];
required.forEach(p=>assert(fs.existsSync(path.join(runtimeBase,p)),`Missing semantic runtime asset ${p}`));
const index=text('webui/private/index.html');
assert(!/(?:src|href)=["'][^"']*(?:\/v\d{3}|-v\d{3}\.)/i.test(index),'Private index references a versioned runtime asset');
for(const name of ['settings.js','settings.css','brand.js','brand.css','session.js','session.css','header.js','header.css'])assert(index.includes(name),`Private index missing ${name}`);
assert(index.includes('data-weigg-layer="brand-031"'),'Brand compatibility loader guard missing');assert(index.includes('data-weigg-layer="ui-polish-037"'),'Polish compatibility loader guard missing');
const settings=text('webui/private/scripts/settings.js'),settingsCss=text('webui/private/css/settings.css');
assert(settings.includes("className='setting-row'"),'Canonical SettingRow owner missing');assert(settings.includes("className='settings-grid'"),'Canonical SettingsGrid owner missing');
assert(!/settings-row--canonical|setting-row-grid|settings-grid-canonical|settings-section--rows/.test(settings),'Legacy Settings owner recreated in settings.js');
assert(settingsCss.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'Wide two-column SettingsGrid contract missing');assert(settingsCss.includes('@media(max-width:1180px)'),'Single-column SettingsGrid breakpoint missing');assert(settingsCss.includes('justify-content:flex-end')&&settingsCss.includes('text-align:left'),'SettingRow alignment contract missing');
const brand=text('webui/private/scripts/brand.js');assert(brand.includes('brand-mark-home')&&brand.includes('brand-name-home'),'Header brand targets are not separated');assert(brand.includes('createIdentity')&&brand.includes('AmbientMark'),'Shared About/Header BrandMark owner missing');
const advanced=text('webui/private/scripts/advanced-settings.js');assert(advanced.includes('AdvancedSettingsV036=W.AdvancedSettings'),'Semantic AdvancedSettings must suppress the removed legacy loader');
const session=text('webui/private/scripts/session.js');assert(session.includes('auth/logout')&&session.includes('probeSession'),'Verified logout contract missing');assert(session.indexOf('client.logout()')<session.indexOf('client.probeSession()'),'Logout must precede protected session probe');assert(session.includes('pageshow')&&session.includes('weigg.logoutGuard'),'BFCache/logout guard missing');
const header=text('webui/private/scripts/header.js');assert(header.includes('github-link')&&header.includes('blog-link')&&header.includes('logout-btn'),'Header utility actions incomplete');
console.log(`Semantic runtime contract passed: ${runtimeFiles.length} runtime files, 0 versioned asset filenames.`);

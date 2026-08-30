import fs from 'node:fs';

const required = [
  'webui/public/login.html',
  'webui/private/index.html',
  'webui/private/css/app.css',
  'webui/private/css/v021.css',
  'webui/private/scripts/i18n.js',
  'webui/private/scripts/core.js',
  'webui/private/scripts/settings-schema.js',
  'webui/private/scripts/settings-translations.js',
  'webui/private/scripts/qb-client.js',
  'webui/private/scripts/components.js',
  'webui/private/scripts/app.js',
  'webui/private/scripts/ux-v021.js',
  'installers/install.sh'
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}

const index = fs.readFileSync('webui/private/index.html', 'utf8');
for (const id of ['torrent-list','back-btn','fatal-home','prev-btn','next-btn','page-size','tracker-nav','settings-view','settings-search-input','app-nav','mobile-bottom-nav','actions-dialog','columns-dialog']) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Missing v0.2.1 UI invariant: ${id}`);
}
if (!index.includes('<html lang="en"')) throw new Error('English must be the canonical markup language');
for (const route of ['search','rss','logs','settings']) {
  if (!index.includes(`data-route="${route}"`)) throw new Error(`Missing application route: ${route}`);
}
for (const size of ['20','50','100','200']) {
  if (!index.includes(`<option${size === '50' ? ' selected' : ''}>${size}</option>`) && !index.includes(`<option>${size}</option>`)) throw new Error(`Missing page size ${size}`);
}
if (!index.includes('data-i18n="nav.settings"') || !index.includes('data-i18n-placeholder="settings.search"')) throw new Error('Canonical i18n attributes missing');
if (index.includes('>TOOLS<')) throw new Error('Application navigation must not live in the Torrent sidebar');

const i18n = fs.readFileSync('webui/private/scripts/i18n.js', 'utf8');
for (const token of ["'en':EN","'zh-CN'","'zh-TW'","'ja'","'ko'",'browserLocale','unsupported locales fall back to English']) {
  if (!i18n.includes(token)) throw new Error(`i18n invariant missing: ${token}`);
}
const schema = fs.readFileSync('webui/private/scripts/settings-schema.js', 'utf8');
for (const token of ['auto_tmm_enabled','save_path','web_ui_port','humanize','pref.generic.desc']) {
  if (!schema.includes(token)) throw new Error(`Settings schema invariant missing: ${token}`);
}
const translations = fs.readFileSync('webui/private/scripts/settings-translations.js', 'utf8');
for (const token of ['Automatic Torrent Management','自动 Torrent 管理','Web UI port','Web UI 端口']) {
  if (!translations.includes(token)) throw new Error(`Settings translation missing: ${token}`);
}

const qb = fs.readFileSync('webui/private/scripts/qb-client.js', 'utf8');
for (const token of ["'resume','start'","'pause','stop'",'limit','offset','recheck','reannounce','setPreferences','search/start','rss/items','addTrackers','banPeers']) {
  if (!qb.includes(token)) throw new Error(`Compatibility/capability token missing: ${token}`);
}

const app = fs.readFileSync('webui/private/scripts/app.js', 'utf8');
for (const token of ['pageSize','buildCatalog','renderTrackerNav','renderSettings','openColumns','privateFlag','VirtualList','normalizeTracker']) {
  if (!app.includes(token)) throw new Error(`v0.2 app token missing: ${token}`);
}

const core = fs.readFileSync('webui/private/scripts/core.js', 'utf8');
for (const token of ['normalizeTracker','VirtualList','DataGrid','fontSize','ptTrackers',"label:'Name'"]) {
  if (!core.includes(token)) throw new Error(`Core architecture token missing: ${token}`);
}

const components = fs.readFileSync('webui/private/scripts/components.js','utf8');
for (const token of ['SettingsSchema.describe','setting-card','switch-control',"'state.downloading'"]) {
  if (!components.includes(token)) throw new Error(`Component standardization token missing: ${token}`);
}

const css = fs.readFileSync('webui/private/css/app.css', 'utf8');
const v021 = fs.readFileSync('webui/private/css/v021.css', 'utf8');
for (const token of ['--font-scale-offset','--text-description','--text-table-cell','prefers-reduced-motion','torrent-mobile-card','col-resize']) {
  if (!css.includes(token)) throw new Error(`Design/performance token missing: ${token}`);
}
for (const token of ['app-nav__item','settings-group','setting-card','mobile-bottom-nav','switch-control']) {
  if (!v021.includes(token)) throw new Error(`v0.2.1 UX style missing: ${token}`);
}
if (/https?:\/\//.test(index + css + v021)) throw new Error('Runtime UI must not depend on external assets');

const installer = fs.readFileSync('installers/install.sh', 'utf8');
for (const token of ['--container=*','--config-root=*','Multiple qBittorrent Docker containers found','/var/lib/docker/*','Installed and verified:']) {
  if (!installer.includes(token)) throw new Error(`Installer safety token missing: ${token}`);
}

console.log('WeiG qB WebUI v0.2.1 smoke checks passed.');

import fs from 'node:fs';

const required = [
  'webui/public/login.html',
  'webui/private/index.html',
  'webui/private/css/app.css',
  'webui/private/scripts/core.js',
  'webui/private/scripts/qb-client.js',
  'webui/private/scripts/components.js',
  'webui/private/scripts/app.js',
  'installers/install.sh'
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}

const index = fs.readFileSync('webui/private/index.html', 'utf8');
for (const id of ['torrent-list','back-btn','fatal-home','prev-btn','next-btn','page-size','tracker-nav','settings-view','actions-dialog','columns-dialog']) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Missing v0.2 UI invariant: ${id}`);
}
for (const size of ['20','50','100','200']) {
  if (!index.includes(`<option${size === '50' ? ' selected' : ''}>${size}</option>`) && !index.includes(`<option>${size}</option>`)) {
    throw new Error(`Missing page size ${size}`);
  }
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
for (const token of ['normalizeTracker','VirtualList','DataGrid','fontSize','ptTrackers']) {
  if (!core.includes(token)) throw new Error(`Core architecture token missing: ${token}`);
}

const css = fs.readFileSync('webui/private/css/app.css', 'utf8');
for (const token of ['--font-scale-offset','--text-description','--text-table-cell','prefers-reduced-motion','torrent-mobile-card','col-resize']) {
  if (!css.includes(token)) throw new Error(`Design/performance token missing: ${token}`);
}
if (/https?:\/\//.test(index + css)) throw new Error('Runtime UI must not depend on external assets');

const installer = fs.readFileSync('installers/install.sh', 'utf8');
for (const token of ['--container=*','--config-root=*','Multiple qBittorrent Docker containers found','/var/lib/docker/*','Installed and verified:']) {
  if (!installer.includes(token)) throw new Error(`Installer safety token missing: ${token}`);
}

console.log('WeiG qB WebUI v0.2 smoke checks passed.');

import fs from 'node:fs';

const required = [
  'README.md',
  'DESIGN.md',
  'docs/001.项目总方案.md',
  'docs/002.兼容与实现状态.md',
  'docs/003.项目架构.md',
  'webui/public/login.html',
  'webui/private/index.html',
  'webui/private/css/app.css',
  'webui/private/css/v021.css',
  'webui/private/css/v022.css',
  'webui/private/css/v030.css',
  'webui/private/css/logs-v032.css',
  'webui/private/scripts/i18n.js',
  'webui/private/scripts/i18n-v030.js',
  'webui/private/scripts/core.js',
  'webui/private/scripts/settings-schema.js',
  'webui/private/scripts/settings-translations.js',
  'webui/private/scripts/qb-client.js',
  'webui/private/scripts/components.js',
  'webui/private/scripts/app.js',
  'webui/private/scripts/ux-v021.js',
  'webui/private/scripts/spatial-v022.js',
  'webui/private/scripts/v030.js',
  'webui/private/scripts/logs-v032.js',
  'tests/compat-v030.mjs',
  'tests/log-compat-v032.mjs',
  'installers/install.sh'
];
for (const file of required) {
  if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
}
if (fs.readFileSync('VERSION','utf8').trim() !== '0.3.2') throw new Error('VERSION must be 0.3.2');

const login = fs.readFileSync('webui/public/login.html','utf8');
for (const token of [
  "api/v2/auth/login",
  "application/x-www-form-urlencoded",
  "x.status===403",
  "x.text==='Fails.'",
  "x.text==='Ok.'",
  "kind:'banned'",
  "kind:'rejected'",
  "用户名或密码错误。",
  "Wei.G.ico",
  "border-radius:50%"
]) {
  if (!login.includes(token)) throw new Error(`Legacy login/branding invariant missing: ${token}`);
}

const index = fs.readFileSync('webui/private/index.html', 'utf8');
for (const id of ['torrent-list','back-btn','fatal-home','prev-btn','next-btn','page-size','tracker-nav','settings-view','settings-search-input','app-nav','mobile-bottom-nav','actions-dialog','columns-dialog','status-dl','status-up','status-connection']) {
  if (!index.includes(`id="${id}"`)) throw new Error(`Missing UI invariant: ${id}`);
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
for (const token of ['css/logs-v032.css?v=0.3.2','scripts/logs-v032.js?v=0.3.2']) {
  if (!index.includes(token)) throw new Error(`v0.3.2 Logs asset missing: ${token}`);
}

const i18n = fs.readFileSync('webui/private/scripts/i18n.js', 'utf8');
for (const token of ["'en':EN","'zh-CN'",'browserLocale','unsupported locales fall back to English']) {
  if (!i18n.includes(token)) throw new Error(`i18n invariant missing: ${token}`);
}
const i18n030 = fs.readFileSync('webui/private/scripts/i18n-v030.js','utf8');
for (const token of ["'v030.limit.download':'Global download limit'","'v030.limit.download':'全局下载限速'","'v030.transfer.title':'Transfer & session'","'v030.transfer.title':'传输与会话'",'W.V030I18n']) {
  if (!i18n030.includes(token)) throw new Error(`v0.3 translation overlay missing: ${token}`);
}
const schema = fs.readFileSync('webui/private/scripts/settings-schema.js', 'utf8');
for (const token of ['auto_tmm_enabled','save_path','web_ui_port','humanize','pref.generic.desc','max_ratio_act','max_seeding_time_act']) {
  if (!schema.includes(token)) throw new Error(`Settings schema invariant missing: ${token}`);
}
const translations = fs.readFileSync('webui/private/scripts/settings-translations.js', 'utf8');
for (const token of ['Automatic Torrent Management','自动 Torrent 管理','Web UI port','Web UI 端口','Share ratio action','分享率达限动作']) {
  if (!translations.includes(token)) throw new Error(`Settings translation missing: ${token}`);
}

const qb = fs.readFileSync('webui/private/scripts/qb-client.js', 'utf8');
for (const token of [
  "'resume','start'","'pause','stop'",'limit','offset','recheck','reannounce','setPreferences','search/start','rss/items','addTrackers','banPeers',
  'globalSpeedLimits:true','altSpeedLimits:true','getGlobalDownloadLimit','setGlobalDownloadLimit','getGlobalUploadLimit','setGlobalUploadLimit','getAltSpeedMode','toggleAltSpeedMode','getMainData','torrentCreator','getCookies','setCookies',
  "logs:atLeast(this.qbVersion,'4.1.0')",'normalizeLogItems','last_known_id='
]) {
  if (!qb.includes(token)) throw new Error(`Compatibility/capability token missing: ${token}`);
}
if (qb.includes("throw new ApiError('会话已失效")) throw new Error('QBClient must not use Chinese-only canonical errors');

const app = fs.readFileSync('webui/private/scripts/app.js', 'utf8');
for (const token of ['pageSize','buildCatalog','renderTrackerNav','renderSettings','openColumns','privateFlag','VirtualList','normalizeTracker']) {
  if (!app.includes(token)) throw new Error(`App architecture token missing: ${token}`);
}

const core = fs.readFileSync('webui/private/scripts/core.js', 'utf8');
for (const token of ['normalizeTracker','VirtualList','DataGrid','fontSize','ptTrackers',"label:'Name'",'__weiggVirtualScrollTop','__weiggVirtualScrollHandler','preserve!==false','resetScroll','spacer.isConnected','spacer.parentNode!==self.el']) {
  if (!core.includes(token)) throw new Error(`Core architecture/scroll token missing: ${token}`);
}

const components = fs.readFileSync('webui/private/scripts/components.js','utf8');
for (const token of ['SettingsSchema.describe','setting-card','switch-control',"'state.downloading'",'v022.css?v=0.3.2','v030.css?v=0.3.2','spatial-v022.js?v=0.3.2','i18n-v030.js?v=0.3.2','v030.js?v=0.3.2','i18.onload=loadV030']) {
  if (!components.includes(token)) throw new Error(`Component/runtime loader token missing: ${token}`);
}

const css = fs.readFileSync('webui/private/css/app.css', 'utf8');
const v021 = fs.readFileSync('webui/private/css/v021.css', 'utf8');
const v022 = fs.readFileSync('webui/private/css/v022.css', 'utf8');
const v030 = fs.readFileSync('webui/private/css/v030.css', 'utf8');
const logs032 = fs.readFileSync('webui/private/css/logs-v032.css', 'utf8');
for (const token of ['--font-scale-offset','--text-description','--text-table-cell','prefers-reduced-motion','torrent-mobile-card','col-resize']) {
  if (!css.includes(token)) throw new Error(`Design/performance token missing: ${token}`);
}
for (const token of ['app-nav__item','settings-group','setting-card','mobile-bottom-nav','switch-control']) {
  if (!v021.includes(token)) throw new Error(`v0.2.1 UX style missing: ${token}`);
}
for (const token of ['--spatial-floating','filter-shelf','facet-popover','connection-dock','grid-template-rows:auto auto auto','setting-card--half','is-tool-route','search-box:focus-within','SIDEBAR-001','SETTING-001']) {
  if (!v022.includes(token)) throw new Error(`v0.2.2 spatial style missing: ${token}`);
}
for (const token of ['torrent-panel.is-empty','transfer-dock','transfer-dialog','speed-presets','transfer-stats','transfer-chart-shell','EMPTY-001','DOCK-001','TRANSFER-001','.statusbar--v030 .transfer-dock>.desktop-only']) {
  if (!v030.includes(token)) throw new Error(`v0.3 transfer/empty style missing: ${token}`);
}
for (const token of ['#logs-view.is-active','logs-size-compact','logs-size-max','logs-v032-panel','logs-v032-row']) {
  if (!logs032.includes(token)) throw new Error(`v0.3.2 Logs style missing: ${token}`);
}
const spatial = fs.readFileSync('webui/private/scripts/spatial-v022.js','utf8');
for (const token of ['installBranding','Wei.G.ico','borderRadius=\'50%\'','installFilterShelf','installConnectionDock','createFacet','facet-search','settings-content','syncRouteFrame','syncSettingsTabState','balanceSettingGroups']) {
  if (!spatial.includes(token)) throw new Error(`Spatial/branding controller missing: ${token}`);
}
const runtime = fs.readFileSync('webui/private/scripts/v030.js','utf8');
for (const token of ['installScrollResetBoundaries','syncEmptyState','installDock','openSpeedDialog','toggleAltSpeed','openTransferDialog','MAX_SAMPLES=900','getMainData','weigg:transfer','installRenderedMultiSelect','W.V030I18n']) {
  if (!runtime.includes(token)) throw new Error(`v0.3 runtime controller missing: ${token}`);
}
if (runtime.includes("locale()==='zh-CN'")) throw new Error('v0.3 feature runtime must not branch directly on language');
const logsRuntime = fs.readFileSync('webui/private/scripts/logs-v032.js','utf8');
for (const token of ['MAX_ITEMS=5000','lastId','fetchIncremental','state.virtual','logs-size-mode','Follow latest','last_known_id']) {
  if (!logsRuntime.includes(token)) throw new Error(`v0.3.2 Logs runtime missing: ${token}`);
}
if (/https?:\/\//.test(index + css + v021 + v022 + v030 + logs032)) throw new Error('Core runtime markup/CSS must not depend on external assets');

const architecture = fs.readFileSync('docs/003.项目架构.md','utf8');
for (const token of ['QBClient','spatial-v022.js','v030.js','v030.css','Data count != DOM count','__weiggVirtualScrollTop','MAX 900','English','简体中文','logs-v032.js','logs-v032.css']) {
  if (!architecture.includes(token)) throw new Error(`Architecture documentation missing: ${token}`);
}

const installer = fs.readFileSync('installers/install.sh', 'utf8');
for (const token of ['--container=*','--config-root=*','Multiple qBittorrent Docker containers found','/var/lib/docker/*','Installed and verified:']) {
  if (!installer.includes(token)) throw new Error(`Installer safety token missing: ${token}`);
}

console.log('WeiG qB WebUI v0.3.2 smoke checks passed.');

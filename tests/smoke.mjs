import fs from 'node:fs';

const required = [
  'README.md','DESIGN.md','docs/001.项目总方案.md','docs/002.兼容与实现状态.md','docs/003.项目架构.md','docs/004.UI与缓存契约.md',
  'webui/VERSION','webui/GIT_SHA','webui/public/login.html','webui/private/index.html','webui/private/weigg-install.json',
  'webui/private/css/app.css','webui/private/css/v021.css','webui/private/css/v022.css','webui/private/css/v030.css','webui/private/css/logs-v032.css','webui/private/css/v036.css','webui/private/css/mobile-v036.css','webui/private/css/brand-v031.css',
  'webui/private/scripts/i18n.js','webui/private/scripts/i18n-v030.js','webui/private/scripts/i18n-v034.js','webui/private/scripts/i18n-v036.js','webui/private/scripts/core.js','webui/private/scripts/settings-schema.js','webui/private/scripts/settings-translations.js','webui/private/scripts/qb-client.js','webui/private/scripts/components.js','webui/private/scripts/app.js','webui/private/scripts/settings-v034.js','webui/private/scripts/ux-v021.js','webui/private/scripts/spatial-v022.js','webui/private/scripts/v030.js','webui/private/scripts/v036.js','webui/private/scripts/adaptive-v036.js','webui/private/scripts/advanced-v036.js','webui/private/scripts/logs-v032.js',
  'tests/compat-v030.mjs','tests/log-compat-v032.mjs','tests/browser-logs-v033.mjs','tests/settings-v034.mjs','tests/browser-settings-v034.mjs','tests/cache-contract-v035.mjs','tests/ui-contract-v036.mjs','tests/mobile-contract-v036.mjs','tests/advanced-contract-v036.mjs','tests/browser-ui-v036.mjs','tests/browser-mobile-v036.mjs','tests/compat-matrix-v036.mjs','tests/fixtures/qb-compat-matrix.json','tests/live-v036.sh',
  'installers/install.sh','installers/install.ps1'
];
for (const file of required) if (!fs.existsSync(file)) throw new Error(`Missing ${file}`);
if (fs.existsSync('webui/private/css/settings-v034.css')) throw new Error('Standalone Alternative WebUI CSS must be removed');
if (fs.readFileSync('VERSION','utf8').trim() !== '0.3.6') throw new Error('VERSION must be 0.3.6');
if (fs.readFileSync('webui/VERSION','utf8').trim() !== '0.3.6') throw new Error('webui/VERSION must be 0.3.6');
if (fs.readFileSync('webui/GIT_SHA','utf8').trim() !== '__WEIGG_GIT_SHA__') throw new Error('source GIT_SHA must be a deploy-time placeholder');

const login=fs.readFileSync('webui/public/login.html','utf8');
for(const token of ["api/v2/auth/login","application/x-www-form-urlencoded","x.status===403","x.text==='Fails.'","x.text==='Ok.'","kind:'banned'","kind:'rejected'","用户名或密码错误。","Wei.G.ico","border-radius:50%",'no-store, no-cache, must-revalidate','name="weigg-build-sha" content="__WEIGG_GIT_SHA__"']) if(!login.includes(token)) throw new Error(`Legacy login/branding/cache invariant missing: ${token}`);

const index=fs.readFileSync('webui/private/index.html','utf8');
for(const id of ['torrent-list','back-btn','fatal-home','prev-btn','next-btn','page-size','tracker-nav','settings-view','settings-search-input','app-nav','mobile-bottom-nav','actions-dialog','columns-dialog','status-dl','status-up','status-connection']) if(!index.includes(`id="${id}"`)) throw new Error(`Missing UI invariant: ${id}`);
if(!index.includes('<html lang="en"')) throw new Error('English must be the canonical markup language');
for(const route of ['search','rss','logs','settings']) if(!index.includes(`data-route="${route}"`)) throw new Error(`Missing application route: ${route}`);
for(const size of ['20','50','100','200']) if(!index.includes(`<option${size==='50'?' selected':''}>${size}</option>`)&&!index.includes(`<option>${size}</option>`)) throw new Error(`Missing page size ${size}`);
if(!index.includes('data-i18n="nav.settings"')||!index.includes('data-i18n-placeholder="settings.search"')||!index.includes('data-i18n="tag.all"')) throw new Error('Canonical i18n attributes missing');
if(index.includes('>TOOLS<')) throw new Error('Application navigation must not live in the Torrent sidebar');
if(index.includes('settings-v034.css')) throw new Error('Alternative WebUI must not ship a standalone visual template');
for(const token of ['css/app.css?v=__WEIGG_GIT_SHA__','css/logs-v032.css?v=__WEIGG_GIT_SHA__','css/mobile-v036.css?v=__WEIGG_GIT_SHA__','scripts/logs-v032.js?v=__WEIGG_GIT_SHA__','scripts/adaptive-v036.js?v=__WEIGG_GIT_SHA__','scripts/i18n-v034.js?v=__WEIGG_GIT_SHA__','scripts/settings-v034.js?v=__WEIGG_GIT_SHA__','no-store, no-cache, must-revalidate','name="weigg-build-sha" content="__WEIGG_GIT_SHA__"']) if(!index.includes(token)) throw new Error(`Runtime/cache asset invariant missing: ${token}`);
if(/\?v=\d+\.\d+\.\d+/.test(index)) throw new Error('Private HTML must not use semver asset cache busters');

const i18n=fs.readFileSync('webui/private/scripts/i18n.js','utf8');
for(const token of ["'en':EN","'zh-CN'",'browserLocale','unsupported locales fall back to English']) if(!i18n.includes(token)) throw new Error(`i18n invariant missing: ${token}`);
const i18n030=fs.readFileSync('webui/private/scripts/i18n-v030.js','utf8');
for(const token of ["'v030.limit.download':'Global download limit'","'v030.limit.download':'全局下载限速'","'v030.transfer.title':'Transfer & session'","'v030.transfer.title':'传输与会话'",'W.V030I18n']) if(!i18n030.includes(token)) throw new Error(`v0.3 translation overlay missing: ${token}`);
const i18n034=fs.readFileSync('webui/private/scripts/i18n-v034.js','utf8');
for(const token of ["'v034.alt.qbPath':'qBittorrent WebUI path'","'v034.alt.qbPath':'qBittorrent WebUI 路径'",'W.V034I18n']) if(!i18n034.includes(token)) throw new Error(`Alternative WebUI translation overlay missing: ${token}`);
const i18n036=fs.readFileSync('webui/private/scripts/i18n-v036.js','utf8');
for(const token of ["'v036.logs.follow':'Follow latest'","'v036.logs.follow':'跟随最新'","'v036.settings.timeZone':'Display time zone'","'v036.storage.free':'Free'","'v036.storage.free':'可用'",'W.V036I18n']) if(!i18n036.includes(token)) throw new Error(`v0.3.6 translation overlay missing: ${token}`);

const schema=fs.readFileSync('webui/private/scripts/settings-schema.js','utf8');
for(const token of ['auto_tmm_enabled','save_path','web_ui_port','humanize','pref.generic.desc','max_ratio_act','max_seeding_time_act']) if(!schema.includes(token)) throw new Error(`Settings schema invariant missing: ${token}`);
const translations=fs.readFileSync('webui/private/scripts/settings-translations.js','utf8');
for(const token of ['Automatic Torrent Management','自动 Torrent 管理','Web UI port','Web UI 端口','Share ratio action','分享率达限动作']) if(!translations.includes(token)) throw new Error(`Settings translation missing: ${token}`);

const qb=fs.readFileSync('webui/private/scripts/qb-client.js','utf8');
for(const token of ["'resume','start'","'pause','stop'",'limit','offset','recheck','reannounce','setPreferences','search/start','rss/items','addTrackers','banPeers','globalSpeedLimits:true','altSpeedLimits:true','getGlobalDownloadLimit','setGlobalDownloadLimit','getGlobalUploadLimit','setGlobalUploadLimit','getAltSpeedMode','toggleAltSpeedMode','getMainData','torrentCreator','getCookies','setCookies',"logs:atLeast(this.qbVersion,'4.1.0')",'normalizeLogItems','last_known_id=']) if(!qb.includes(token)) throw new Error(`Compatibility/capability token missing: ${token}`);
if(qb.includes("throw new ApiError('会话已失效")) throw new Error('QBClient must not use Chinese-only canonical errors');

const app=fs.readFileSync('webui/private/scripts/app.js','utf8');
for(const token of ['pageSize','buildCatalog','renderTrackerNav','renderSettings','openColumns','privateFlag','VirtualList','normalizeTracker']) if(!app.includes(token)) throw new Error(`App architecture token missing: ${token}`);
const settings034=fs.readFileSync('webui/private/scripts/settings-v034.js','utf8');
for(const token of ['alternative_webui_enabled','alternative_webui_path','getPreferences','setPreferences','weigg-install.json','hostPath','gitSha','data-v035-alt','readonlySettingField','v034SaveBridge','global.location.href=\'/\'']) if(!settings034.includes(token)) throw new Error(`Alternative WebUI compatibility/runtime token missing: ${token}`);
for(const forbidden of ['alt-webui-v034__head','alt-webui-v034__control','alt-webui-v034__meta','alt-webui-v034__info']) if(settings034.includes(forbidden)) throw new Error(`Alternative WebUI must reuse canonical SettingCard, found legacy visual token: ${forbidden}`);
if(settings034.includes("getLocale()==='zh-CN'")) throw new Error('Alternative WebUI feature runtime must not branch directly on language');

const core=fs.readFileSync('webui/private/scripts/core.js','utf8');
for(const token of ['normalizeTracker','VirtualList','DataGrid','fontSize','ptTrackers',"label:'Name'",'__weiggVirtualScrollTop','__weiggVirtualScrollHandler','preserve!==false','resetScroll','spacer.isConnected','spacer.parentNode!==self.el']) if(!core.includes(token)) throw new Error(`Core architecture/scroll token missing: ${token}`);

const components=fs.readFileSync('webui/private/scripts/components.js','utf8');
for(const token of ['SettingsSchema.describe','setting-card','switch-control','readonlySettingField',"'state.downloading'",'weigg-build-sha','currentBuildToken','buildAssetUrl',"css('css/v022.css'","css('css/v030.css'","css('css/v036.css'","asyncScript('scripts/spatial-v022.js'","buildAssetUrl('scripts/v030.js')","buildAssetUrl('scripts/v036.js')",'selectControl','upgradeNativeSelects','W.Time']) if(!components.includes(token)) throw new Error(`Component/runtime loader token missing: ${token}`);
if(/\?v=\d+\.\d+\.\d+/.test(components)) throw new Error('Dynamic runtime loader must not use semver cache busters');

const css=fs.readFileSync('webui/private/css/app.css','utf8'),v021=fs.readFileSync('webui/private/css/v021.css','utf8'),v022=fs.readFileSync('webui/private/css/v022.css','utf8'),v030=fs.readFileSync('webui/private/css/v030.css','utf8'),logs032=fs.readFileSync('webui/private/css/logs-v032.css','utf8'),v036=fs.readFileSync('webui/private/css/v036.css','utf8'),mobile036=fs.readFileSync('webui/private/css/mobile-v036.css','utf8');
for(const token of ['--font-scale-offset','--text-description','--text-table-cell','prefers-reduced-motion','torrent-mobile-card','col-resize']) if(!css.includes(token)) throw new Error(`Design/performance token missing: ${token}`);
for(const token of ['app-nav__item','settings-group','setting-card','mobile-bottom-nav','switch-control']) if(!v021.includes(token)) throw new Error(`v0.2.1 UX style missing: ${token}`);
for(const token of ['--spatial-floating','filter-shelf','facet-popover','connection-dock','grid-template-rows:auto auto auto','setting-card--half','is-tool-route','search-box:focus-within','SIDEBAR-001','SETTING-001']) if(!v022.includes(token)) throw new Error(`v0.2.2 spatial style missing: ${token}`);
for(const token of ['torrent-panel.is-empty','transfer-dock','transfer-dialog','speed-presets','transfer-stats','transfer-chart-shell','EMPTY-001','DOCK-001','TRANSFER-001','.statusbar--v030 .transfer-dock>.desktop-only']) if(!v030.includes(token)) throw new Error(`v0.3 transfer/empty style missing: ${token}`);
for(const token of ['#logs-view.is-active','logs-size-compact','logs-size-max','logs-v032-panel','logs-v032-row']) if(!logs032.includes(token)) throw new Error(`v0.3.2 Logs style missing: ${token}`);
for(const token of ['.ui-select__trigger','.ui-chip','.ui-check','.ambient-mark__orbit','.detail-context-back','prefers-reduced-motion']) if(!v036.includes(token)) throw new Error(`v0.3.6 canonical style missing: ${token}`);
for(const token of ['#torrent-list{flex:1 1 0','mobile-card-meta','status-storage','stalled-up','#search-view>.tool-page']) if(!mobile036.includes(token)) throw new Error(`v0.3.6 mobile adaptive style missing: ${token}`);

const spatial=fs.readFileSync('webui/private/scripts/spatial-v022.js','utf8');
for(const token of ['installBranding','Wei.G.ico','borderRadius=\'50%\'','installFilterShelf','installConnectionDock','createFacet','facet-search','settings-content','syncRouteFrame','syncSettingsTabState','balanceSettingGroups','buildAssetUrl']) if(!spatial.includes(token)) throw new Error(`Spatial/branding controller missing: ${token}`);
if(/brand-v031\.css\?v=/.test(spatial)) throw new Error('Brand stylesheet must use the build SHA helper');
const runtime=fs.readFileSync('webui/private/scripts/v030.js','utf8');
for(const token of ['installScrollResetBoundaries','syncEmptyState','installDock','openSpeedDialog','toggleAltSpeed','openTransferDialog','MAX_SAMPLES=900','getMainData','weigg:transfer','installRenderedMultiSelect','W.V030I18n']) if(!runtime.includes(token)) throw new Error(`v0.3 runtime controller missing: ${token}`);
if(runtime.includes("locale()==='zh-CN'")) throw new Error('v0.3 feature runtime must not branch directly on language');
const runtime036=fs.readFileSync('webui/private/scripts/v036.js','utf8');
for(const token of ['AmbientMark','torrentListContext.v036','detail-context-back','weigg:timezonechange','upgradeNativeSelects','weigg-floating-layer']) if(!runtime036.includes(token)) throw new Error(`v0.3.6 runtime controller missing: ${token}`);
const adaptive036=fs.readFileSync('webui/private/scripts/adaptive-v036.js','utf8');
for(const token of ['compactMetricText','free_space_on_disk','getMainData(storageRid)','30000','advanced-v036.js']) if(!adaptive036.includes(token)) throw new Error(`v0.3.6 adaptive runtime missing: ${token}`);
const advanced036=fs.readFileSync('webui/private/scripts/advanced-v036.js','utf8');
for(const token of ['torrent_file_size_limit','1048576','socket_receive_buffer_size','socket_send_buffer_size','disk_queue_size','MoveToTrash','toDisplay','toRaw']) if(!advanced036.includes(token)) throw new Error(`v0.3.6 Advanced runtime missing: ${token}`);
const logsRuntime=fs.readFileSync('webui/private/scripts/logs-v032.js','utf8');
for(const token of ['MAX_ITEMS=5000','lastId','fetchIncremental','state.virtual','logs-size-mode','client.logs(state.lastId)','return bi-ai','TIME-002']) if(!logsRuntime.includes(token)) throw new Error(`v0.3.6 Logs runtime missing: ${token}`);
if(logsRuntime.includes('logs-time-zone')) throw new Error('Logs must not own a second timezone selector; Display Time Zone belongs to the global status dock');
if(logsRuntime.includes('function zh()')||logsRuntime.includes('function text(en,cn)')) throw new Error('Logs runtime must use the i18n overlay rather than direct locale branching');
if(/https?:\/\//.test(index+css+v021+v022+v030+logs032+v036+mobile036)) throw new Error('Core runtime markup/CSS must not depend on external assets');

const architecture=fs.readFileSync('docs/003.项目架构.md','utf8');
for(const token of ['QBClient','spatial-v022.js','v030.js','v030.css','Data count != DOM count','__weiggVirtualScrollTop','MAX 900','English','简体中文','logs-v032.js','logs-v032.css','settings-v034.js','weigg-install.json']) if(!architecture.includes(token)) throw new Error(`Architecture documentation missing: ${token}`);
const installer=fs.readFileSync('installers/install.sh','utf8');
for(const token of ['--container=*','--config-root=*','Multiple qBittorrent Docker containers found','/var/lib/docker/*','Installed and verified:','SOURCE_SHA','GIT_SHA','gitSha','inject_build_sha']) if(!installer.includes(token)) throw new Error(`Installer safety/cache token missing: ${token}`);

console.log('WeiG qB WebUI v0.3.6 smoke checks passed.');

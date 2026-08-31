import fs from 'node:fs';
function assert(condition,message){if(!condition)throw new Error(message);}
const version=fs.readFileSync('VERSION','utf8').trim();
const webVersion=fs.readFileSync('webui/VERSION','utf8').trim();
assert(version==='0.3.4','Root VERSION must be 0.3.4');
assert(webVersion===version,'Installed webui/VERSION must match root VERSION');
const index=fs.readFileSync('webui/private/index.html','utf8');
for(const token of ['css/settings-v034.css?v=0.3.4','scripts/i18n-v034.js?v=0.3.4','scripts/settings-v034.js?v=0.3.4'])assert(index.includes(token),`v0.3.4 index token missing: ${token}`);
const runtime=fs.readFileSync('webui/private/scripts/settings-v034.js','utf8');
for(const token of ['alternative_webui_enabled','alternative_webui_path','getPreferences','setPreferences','weigg-install.json','hostPath','qbPath','global.confirm','global.location.href=\'/\'','v034SaveBridge','repairTagI18n',"setAttribute('data-i18n','tag.all')"])assert(runtime.includes(token),`v0.3.4 runtime token missing: ${token}`);
assert(!runtime.includes("getLocale()==='zh-CN'"),'v0.3.4 feature runtime must not branch directly on language');
const i18n=fs.readFileSync('webui/private/scripts/i18n-v034.js','utf8');
for(const token of ["'v034.alt.qbPath':'qBittorrent WebUI path'","'v034.alt.qbPath':'qBittorrent WebUI 路径'","W.V034I18n"])assert(i18n.includes(token),`v0.3.4 i18n token missing: ${token}`);
const css=fs.readFileSync('webui/private/css/settings-v034.css','utf8');
for(const token of ['alt-webui-v034__control','alt-webui-v034__meta','@media(max-width:780px)'])assert(css.includes(token),`v0.3.4 CSS token missing: ${token}`);
const meta=JSON.parse(fs.readFileSync('webui/private/weigg-install.json','utf8'));
assert(meta.version==='0.3.4','Fallback install metadata version mismatch');
console.log('WeiG qB WebUI v0.3.4 Alternative WebUI contract checks passed.');

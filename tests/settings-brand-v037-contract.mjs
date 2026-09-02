import fs from 'node:fs';
function read(p){return fs.readFileSync(p,'utf8');}
function assert(ok,msg){if(!ok)throw new Error(msg);}

const js=read('webui/private/scripts/settings-brand-v037.js');
const css=read('webui/private/css/settings-brand-v037.css');
const loader=read('webui/private/scripts/v037.js');
const app=read('webui/private/scripts/app.js');
const ambient=read('webui/private/scripts/v036.js');

for(const token of ['BRAND-SYSTEM-001','SETTINGS-STRUCTURE-002','HEADER-UTILITY-001','W.Navigation.goHome','BrandMark','BrandCluster','BrandIdentity','normalizeAboutIdentity','cloneBrandMark','ControlRegistry','settings-grid-canonical','settings-row__control','settingSpan','settingsOwner','activeSettingsOwner','mergeExtraGrids','decorateRow','patchFactories','SessionController','HeaderUtilityV037'])assert(js.includes(token),`Settings/Brand/Header canonical owner missing ${token}`);
assert(js.includes("W.AmbientMark&&W.AmbientMark.install")&&js.includes("W.AmbientMark&&W.AmbientMark.trigger"),'BrandMark must compose the existing AmbientMark controller instead of cloning animation logic');
assert(js.includes("homeButton('brand-mark-home'")&&js.includes("homeButton('brand-name-home'"),'Header mark and WeiG qB text must be separate home targets');
assert(js.includes("homeButton('brand-identity__mark-home'")&&js.includes("homeButton('brand-identity__name-home'"),'About BrandIdentity mark and name must reuse shared home-target semantics');
assert(js.includes("source.cloneNode(true)")&&js.includes("installBrandMark(mark,profile||'identity')"),'About must reuse the actual header BrandMark rather than draw a second icon');
assert(js.includes("group.classList.add('settings-section-panel')")&&js.includes("grid.dataset.settingsGrid='auto'")&&js.includes("grid.dataset.settingsOwner=group.dataset.settingsOwner"),'all Settings sections must normalize into one explicitly owned SettingsSectionPanel/SettingsGrid');
assert(js.includes("querySelectorAll('.settings-row,.settings-row--canonical,.settings-control')"),'SettingsGrid must recognize qB/legacy rows directly');
assert(js.includes("row.classList.add('settings-row--canonical','setting-row-grid')"),'SettingsGrid must decorate its own rows through one canonical owner');
assert(js.includes("owner==='weigg'&&index>0?'weigg-metrics':owner"),'WeiG diagnostic section must not impersonate the editable interface grid');
assert(js.includes("return'1'"),'ordinary SettingRow must default to one outer SettingsGrid cell');
assert(!/(path\|url\|domain\|address\|tracker\|directory\|location\|save\|host\|username\|password\|rule)/.test(js),'full-span must never be guessed from setting key names');
assert(js.includes("row.matches('.setting-block")&&js.includes("row.querySelector('textarea')"),'full-span must be explicit block/multiline semantics');
assert(js.includes("ensureCopy(row)")&&js.includes("ensureControlSlot(row,copyEl)"),'legacy flat rows must adapt once into canonical copy/control-slot structure');
assert(!js.includes(',>span>strong')&&!js.includes(',>strong'),'row title lookup must not use invalid relative selectors that abort Settings normalization');
assert(!js.includes('settleSettings'),'Settings normalization must be mutation-driven migration, not timer repair loops');
assert(!js.includes('setPreferences('),'Settings/Brand/Header presentation must not duplicate qB preference-save business logic');
assert(js.includes("request('auth/logout',{method:'POST',type:'void'})"),'Logout must use the qB auth/logout contract through SessionController');
assert(js.includes('https://github.com/weigefenxiang/WeiG-qB-WebUI')&&js.includes('https://www.weigshare.com/'),'Header external action registry URLs missing');
assert(js.includes("actions.lastElementChild!==logoutNode"),'Logout must be the rightmost desktop utility action');
assert(app.includes('W.Components.preferenceField')&&app.includes('app.prefsDraft'),'qB preference data/save ownership must remain in the existing app path');
assert(ambient.includes('W.AmbientMark={install:function'),'AmbientMark must remain the single reusable motion controller');

for(const token of ['--settings-content-max:1240px','--settings-grid-breakpoint:1180px','repeat(2,minmax(0,1fr))','grid-template-columns:minmax(0,1fr) auto','>.settings-row__copy','>.settings-row__control','justify-self:end!important','data-setting-span="full"','not([data-setting-span="full"])','--brand-mark-identity:50px','brand-mark-home','brand-name-home','brand-identity__mark-home','.header-utility-action','.header-utility-icon','@media(max-width:1180px)','@media(prefers-reduced-motion:reduce)'])assert(css.includes(token),`Settings/Brand/Header CSS contract missing ${token}`);
assert(css.includes('.settings-section-panel>.settings-grid-canonical{')&&css.includes('width:100%!important')&&css.includes('min-width:0!important'),'SettingsGrid must consume the actual Settings viewport width');
assert(!css.includes('container-type:inline-size'),'Settings scroll shell must not use inline-size containment because it can collapse mobile intrinsic width');
assert(css.includes('@media(max-width:1180px)')&&css.includes('grid-template-columns:minmax(0,1fr)!important'),'SettingsGrid must collapse from two columns to one through one responsive viewport owner');

for(const token of ["css/settings-brand-v037.css","scripts/settings-brand-v037.js","W.V037SettingsBrand.init()","settingsBrand:W.V037SettingsBrand"])assert(loader.includes(token),`v0.3.7 loader missing Settings/Brand layer token ${token}`);
assert(loader.indexOf("scripts/settings-brand-v037.js")>loader.indexOf("scripts/ui-polish-v037.js"),'Settings/Brand ownership layer must load after legacy polish so it has final structure authority');

console.log('v0.3.7 canonical Settings row + Brand + Header utility static contract passed.');
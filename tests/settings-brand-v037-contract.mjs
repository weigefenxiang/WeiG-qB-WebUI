import fs from 'node:fs';
function read(p){return fs.readFileSync(p,'utf8');}
function assert(ok,msg){if(!ok)throw new Error(msg);}

const js=read('webui/private/scripts/settings-brand-v037.js');
const css=read('webui/private/css/settings-brand-v037.css');
const loader=read('webui/private/scripts/v037.js');
const app=read('webui/private/scripts/app.js');
const ambient=read('webui/private/scripts/v036.js');

for(const token of ['BRAND-SYSTEM-001','BRAND-IDENTITY-001','SETTINGS-DESIGN-001','W.Navigation.goHome','BrandMark','BrandCluster','BrandIdentity','ControlRegistry','settings-grid-canonical','settingSpan'])assert(js.includes(token),`Settings/Brand canonical owner missing ${token}`);
assert(js.includes("W.AmbientMark&&W.AmbientMark.install")&&js.includes("W.AmbientMark&&W.AmbientMark.trigger"),'BrandMark must compose the existing AmbientMark controller instead of cloning animation logic');
assert(js.includes("homeButton('brand-mark-home'")&&js.includes("homeButton('brand-name-home'"),'Header mark and WeiG qB text must be separate home targets');
assert(js.includes("homeButton('brand-identity__mark-home'")&&js.includes("homeButton('brand-identity__name-home'"),'About BrandIdentity mark and name must reuse shared home-target semantics');
assert(js.includes("source.cloneNode(true)")&&js.includes("installBrandMark(mark,profile||'identity')"),'About must reuse the actual header BrandMark rather than draw a second icon');
assert(js.includes("group.classList.add('settings-section-panel')")&&js.includes("grid.dataset.settingsGrid='auto'"),'all Settings sections must normalize into the shared SettingsSectionPanel/SettingsGrid system');
assert(js.includes("return wide?'full':'1'"),'long settings must use the shared full-span policy');
assert(!js.includes('new W.QBClient')&&!js.includes('setPreferences('),'Settings/Brand presentation owner must not duplicate qB WebAPI business logic');
assert(app.includes('W.Components.preferenceField')&&app.includes('app.prefsDraft'),'qB preference data/save ownership must remain in the existing app path');
assert(ambient.includes('W.AmbientMark={install:function'),'AmbientMark must remain the single reusable motion controller');

for(const token of ['--settings-content-max:1240px','--settings-grid-breakpoint:980px','repeat(2,minmax(0,1fr))','grid-template-columns:minmax(0,1fr) auto','justify-self:end!important','data-setting-span="full"','--brand-mark-identity:50px','brand-mark-home','brand-name-home','brand-identity__mark-home','@media(prefers-reduced-motion:reduce)'])assert(css.includes(token),`Settings/Brand CSS contract missing ${token}`);
assert(css.includes('@container settings-content (max-width:980px)')&&css.includes('grid-template-columns:minmax(0,1fr)!important'),'SettingsGrid must collapse from two columns to one through one responsive owner');

for(const token of ["css/settings-brand-v037.css","scripts/settings-brand-v037.js","W.V037SettingsBrand.init()","settingsBrand:W.V037SettingsBrand"])assert(loader.includes(token),`v0.3.7 loader missing Settings/Brand layer token ${token}`);
assert(loader.indexOf("scripts/settings-brand-v037.js")>loader.indexOf("scripts/ui-polish-v037.js"),'Settings/Brand ownership layer must load after legacy polish so it has final structure authority');

console.log('v0.3.7 canonical Settings grid + reusable Brand identity static contract passed.');

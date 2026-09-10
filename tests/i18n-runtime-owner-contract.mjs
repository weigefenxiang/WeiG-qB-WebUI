import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const exists=relative=>fs.existsSync(path.join(root,relative));
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const p=path.join(dir,entry.name);return entry.isDirectory()?walk(p):[p];});}

const retiredFiles=[
  'webui/private/scripts/i18n-time.js',
  'webui/private/scripts/i18n-alternative-webui.js',
  'webui/private/scripts/i18n-interface.js',
  'webui/private/scripts/i18n-transfer.js',
  'webui/private/scripts/settings-translations.js',
  'webui/private/scripts/qb-locale-bridge.js'
];
for(const file of retiredFiles)assert.equal(exists(file),false,`${file} is a retired runtime owner and must leave the current tree`);

const privateScripts=walk(path.join(root,'webui/private/scripts')).filter(file=>file.endsWith('.js'));
const retiredSymbols=['RuntimeI18n','InterfaceText','TransferText','AlternativeWebUIText','QBLocaleBridge'];
for(const file of privateScripts){
  const source=fs.readFileSync(file,'utf8');
  for(const symbol of retiredSymbols)assert.equal(source.includes(symbol),false,`${path.relative(root,file)} still references retired ${symbol}`);
  assert.equal(source.includes('weigg-language'),false,`${path.relative(root,file)} still persists a second language truth`);
}

const index=read('webui/private/index.html');
assert.ok(index.includes('scripts/i18n.js'),'W.I18n must remain the runtime locale/text owner');
assert.ok(index.indexOf('scripts/i18n.js')<index.indexOf('scripts/core.js'),'W.I18n must initialize before first-party runtime callers');
for(const file of retiredFiles)assert.equal(index.includes(path.basename(file)),false,`private index still loads retired ${path.basename(file)}`);

const i18n=read('webui/private/scripts/i18n.js');
assert.ok(i18n.includes('function applyLocale(value)')&&i18n.includes('getQbLocale')&&i18n.includes('loadLocaleOptions')&&i18n.includes('qbSetting'),'W.I18n must own qB locale projection, option discovery and source-derived Settings copy');
assert.equal(i18n.includes('localStorage.getItem(\'weigg-language\')'),false,'W.I18n must not read a WeiG language preference');
assert.equal(i18n.includes('localStorage.setItem(\'weigg-language\''),false,'W.I18n must not write a WeiG language preference');
assert.equal(i18n.includes('function setLocale('),false,'W.I18n must not expose an independent persisted language setter');

const projection=JSON.parse(read('webui/private/data/qb-settings-translations.json'));
assert.deepEqual(projection,{schemaVersion:1,source:'qb-upstream-preferences-ui+webui-ts',profiles:[],sets:{}},'source-tree Settings translation projection must be schema-valid and fact-free');
const packer=read('tools/qb-webui-catalog.mjs');
assert.ok(packer.includes('export function settingsTranslationData(catalog)')&&packer.includes("'qb-settings-translations.json'")&&packer.includes('fs.writeFileSync(settingsPath,settingsPacked)')&&packer.includes('JSON.stringify(settingsTranslationData(catalog))'),'release packaging must overwrite the fact-free source placeholder from the canonical exact-release catalog');

const app=read('webui/private/scripts/app.js');
assert.ok(app.includes('app.preferences=await app.client.getPreferences()'),'startup must read qB preferences into shared application state');
assert.ok(app.includes('W.SettingsState.prefs=app.preferences'),'Settings must reuse the startup preference snapshot');
assert.ok(app.includes('W.I18n.applyLocale(app.preferences.locale)'),'startup locale must come from qB preferences.locale');

const settings=read('webui/private/scripts/settings.js');
assert.ok(settings.includes("own(ctx.draft,'locale')?ctx.draft.locale:ctx.prefs.locale"),'WeiG Language and Advanced Locale must share the same qB draft');
assert.ok(settings.includes("ctx.onDraft('locale',v)"),'Language control must edit the canonical qB preference draft');
assert.equal(settings.includes("onWeiGChange('language'"),false,'Language must not use a WeiG-local draft');
assert.equal(settings.includes('W.I18n.setLocale'),false,'Settings must not switch an independent language owner');
assert.equal((settings.match(/\.setPreferences\(pending\)/g)||[]).length,1,'one canonical save path must issue exactly one qB setPreferences call');
assert.ok(settings.includes('var verified=await client.getPreferences()')&&settings.includes('W.I18n.applyLocale(controller.prefs.locale)'),'locale must switch only after qB verification reread succeeds');

const logs=read('webui/private/scripts/logs.js');
const responsive=read('webui/private/scripts/responsive.js');
const header=read('webui/private/scripts/header.js');
assert.ok(logs.includes('var I=W.I18n'),'Logs must call W.I18n directly');
assert.ok(responsive.includes('W.I18n&&W.I18n.t'),'Responsive runtime must call W.I18n directly');
assert.ok(header.includes("localized('Add','添加')"),'Header short copy must no longer depend on InterfaceText');

console.log('I18n runtime owner contract passed: qB preferences.locale is the only language truth, W.I18n is the only text/locale owner, the source projection is fact-free, and retired bridges/dictionaries are absent.');

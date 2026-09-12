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
assert.ok(i18n.includes('function applyLocale(value)')&&i18n.includes('getQbLocale')&&i18n.includes('loadLocaleOptions')&&i18n.includes('qbSetting'),'W.I18n must own qB locale projection, option discovery and official Settings copy');
assert.ok(i18n.includes('canonicalQbTag')&&i18n.includes('matchBrowserLocale')&&i18n.includes('hasExactLocale'),'W.I18n must remain the single qB/browser locale normalization and matching owner');
assert.ok(i18n.includes("replace(/@(?:latin|latn)$/i,'-Latn')"),'qB @latin/@Latn source codes must canonicalize without losing script identity');
assert.equal(i18n.includes('localStorage.getItem(\'weigg-language\')'),false,'W.I18n must not read a WeiG language preference');
assert.equal(i18n.includes('localStorage.setItem(\'weigg-language\''),false,'W.I18n must not write a WeiG language preference');
assert.equal(i18n.includes('function setLocale('),false,'W.I18n must not expose an independent persisted language setter');
assert.equal(i18n.includes('data/qb-settings-translations.json'),false,'runtime must not download one all-release Settings translation payload');
assert.ok(i18n.includes("fetch(asset('data/qb-settings-native.txt')")&&i18n.includes('parseNativeSettingsRegistry'),'native-capable exact releases must consume the qB server-translated QBT_TR registry');
assert.ok(i18n.includes('current.settingsNativeLocales')&&i18n.includes('current.settingsTranslationLocales'),'runtime translation routing must come from source-derived release capability facts');
assert.ok(i18n.includes('current.settingsTranslationPath')&&i18n.includes("fetch(asset('data/'+current.settingsTranslationPath)"),'non-native exact release/locales must lazily fetch only their exact official compatibility shard');
assert.ok(i18n.includes('String(value.qbVersion)!==expectedVersion')&&i18n.includes('String(value.sourceSha)!==expectedSha'),'runtime must reject a compatibility shard that is not bound to the current exact qB release');
assert.ok(i18n.includes('nativeSettingsData.sourceSha')&&i18n.includes('String(current.sourceSha)'),'native QBT_TR copy must also be bound to the exact running source SHA');
assert.ok(i18n.includes("source:'qb-native-QBT_TR+official-QM'")&&i18n.includes('qb-upstream-preferences-ui+webui-ts-compatibility-only'),'runtime must distinguish native official translation from the exact-TS compatibility path');
assert.ok(i18n.includes("type:'script'")&&i18n.includes('loc.maximize')&&i18n.includes("+' ('+raw+')'"),'locale labels must expose source-derived locale codes and script distinctions instead of collapsing zh_CN/zh_HK/zh_TW to the same language name');
assert.ok(i18n.includes('counts[item.label]>1')&&i18n.includes('nativeLabel(item.value)'),'duplicate upstream locale labels must be disambiguated from their exact locale code');
assert.ok(i18n.includes('localeApplied=false,reloadScheduled=false')&&i18n.includes('changed&&wasApplied&&!reloadScheduled')&&i18n.includes('global.location.reload()'),'a verified runtime locale change must reload once so qB-owned QBT_TR/server-rendered copy is fetched in the new locale');

assert.equal(exists('webui/private/data/qb-settings-translations.json'),false,'retired all-release translation sidecar must leave the source tree');
const packer=read('tools/qb-webui-catalog.mjs');
assert.ok(packer.includes('buildNativeSettingsBundle')&&packer.includes('qb-settings-native.txt'),'release packaging must build the native QBT_TR registry from exact upstream evidence');
assert.ok(packer.includes('settingsTranslationShard')&&packer.includes('bridgeLocales'),'release packaging must keep the browser shard only for source-proven non-native locales');
assert.ok(packer.includes("delete runtime[key]")&&packer.includes('settingsNativeLocales')&&packer.includes('settingsTranslationLocales'),'runtime catalog must carry routing facts, not translation bodies');

const app=read('webui/private/scripts/app.js');
assert.ok(app.includes('app.preferences=await app.client.getPreferences()'),'startup must read qB preferences into shared application state');
assert.ok(app.includes('W.SettingsState.prefs=app.preferences'),'Settings must reuse the startup preference snapshot');
assert.ok(app.includes('W.I18n.applyLocale(app.preferences.locale)'),'initial render must project the current canonical qB preferences.locale while browser bootstrap resolves asynchronously');

const settings=read('webui/private/scripts/settings.js');
assert.ok(settings.includes("own(ctx.draft,'locale')?ctx.draft.locale:ctx.prefs.locale"),'WeiG Language and Advanced Locale must share the same qB draft');
assert.ok(settings.includes("ctx.onDraft('locale',v)"),'Language control must edit the canonical qB preference draft');
assert.equal(settings.includes("onWeiGChange('language'"),false,'Language must not use a WeiG-local draft');
assert.equal(settings.includes('W.I18n.setLocale'),false,'Settings must not switch an independent language owner');
assert.equal((settings.match(/\.setPreferences\(pending\)/g)||[]).length,1,'one canonical Settings save path must issue exactly one qB setPreferences call');
assert.ok(settings.includes('var verified=await client.getPreferences()')&&settings.includes('W.I18n.applyLocale(controller.prefs.locale)'),'locale must switch only after qB verification reread succeeds');

const session=read('webui/private/scripts/session.js');
assert.ok(session.includes("LEGACY_HANDOFF_KEY='weigg.localeHandoff.v1'")&&session.includes("BOOTSTRAP_KEY='weigg.localeBootstrap.v2'"),'Session must explicitly retire reversible locale handoff metadata and own one-way browser bootstrap completion metadata');
assert.ok(session.includes('W.I18n.matchBrowserLocale')&&session.includes('W.I18n.sameQbLocale')&&session.includes('W.I18n.hasExactLocale'),'Session must consume W.I18n locale matching rather than define a second normalization owner');
assert.equal(session.includes('new Intl.Locale'),false,'Session must not duplicate W.I18n locale normalization');
assert.equal(session.includes('Intl.getCanonicalLocales'),false,'Session must not duplicate canonical locale conversion');
assert.equal(session.includes('QBClient.prototype.setPreferences'),false,'locale bootstrap must not monkey-patch the qB transport owner');
assert.ok(session.includes('await client.setPreferences({locale:target})')&&session.includes('var verified=await client.getPreferences()'),'browser locale bootstrap must persist through the canonical qB preference transport and verify by reread');
assert.ok(session.includes("reason:'already-initialized'")&&session.includes('initialized:true'),'browser locale bootstrap must run once per browser storage lifecycle instead of overriding later user/native qB locale choices');
assert.ok(session.includes('W.SettingsSchema.isWritable')&&session.includes("W.SettingsSchema.isWritable('locale',value)"),'automatic locale bootstrap writes must keep source-proven Settings write provenance');
assert.equal(session.includes('previousLocale'),false,'Session must never retain a previous locale for restoration');
assert.equal(session.includes('rollbackLocale'),false,'Session must never roll a browser-selected qB locale back to the pre-WeiG locale');
assert.equal(session.includes('draft.locale=record.previousLocale'),false,'returning to native WebUI must never inject a previous locale into Settings');
assert.equal(session.includes('onSettingsSaveCapture'),false,'Session must not intercept Settings saves to restore language state');

const defaults=read('simulator/preferences/defaults.js');
assert.ok(defaults.includes("locale: 'en'"),'Virtual qB preference materialization must expose a canonical non-empty locale so browser bootstrap can run against Virtual qB');

const logs=read('webui/private/scripts/logs.js');
const responsive=read('webui/private/scripts/responsive.js');
const header=read('webui/private/scripts/header.js');
assert.ok(logs.includes('var I=W.I18n'),'Logs must call W.I18n directly');
assert.ok(responsive.includes('W.I18n&&W.I18n.t'),'Responsive runtime must call W.I18n directly');
assert.ok(header.includes("localized('Add','添加')"),'Header short copy must no longer depend on InterfaceText');

console.log('I18n runtime owner contract passed: qB preferences.locale remains the single language truth; W.I18n owns locale normalization/matching; browser locale is a one-time bootstrap source that persists directly into qB and is never restored on native return; Virtual qB exposes a canonical locale default; verified locale changes reload qB-owned translated resources; native-capable releases use server-translated QBT_TR/official QM and only source-proven gaps keep exact official TS shards.');

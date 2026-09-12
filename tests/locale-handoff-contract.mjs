import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const i18nSource=read('webui/private/scripts/i18n.js');
const sessionSource=read('webui/private/scripts/session.js');
const lkg=JSON.parse(read('tools/data/qb-locale-lkg.json'));
const workflow=read('.github/workflows/real-qb-locale.yml');
assert.equal(lkg.supportFloor,'4.1.0');
assert.equal(lkg.latestAdmittedStable,'5.2.3');
assert.equal(lkg.profileCount,65);
for(const special of ['4.1.9.1','4.3.0.1','4.3.4.1','4.4.3.1'])assert.ok(lkg.profiles.some(item=>item.qbVersion===special),`${special} must remain an exact admitted stable profile`);
const latest=lkg.profiles.find(item=>item.qbVersion===lkg.latestAdmittedStable);
assert.ok(latest&&lkg.localeSets[latest.localeSet],`${lkg.latestAdmittedStable} locale set is missing`);
const stableLocales=lkg.localeSets[latest.localeSet];
assert.equal(stableLocales.length,61,'current qB 5.2.3 must expose the frozen 61-locale WebUI surface');
assert.match(workflow,/max-parallel:\s*16/,'focused current-stable locale evidence must use up to 16 concurrent matrix jobs');
assert.ok(workflow.includes('tools/data/qb-locale-lkg.json')&&workflow.includes('locales.length!==61'),'locale workflow must derive its current stable locale set from Frozen LKG, not capabilities milestones');
assert.ok(workflow.includes('tests/real-qb-locale-runner.sh')&&workflow.includes('tests/real-qb-locale-aggregate.mjs'),'locale workflow must use stable responsibility filenames');
assert.ok(workflow.includes("contains(github.event.head_commit.message, '[locale-matrix]')")&&workflow.includes('workflow_dispatch:'),'heavy locale matrix must be explicit/marker-triggered instead of running on every dev push');
const HANDOFF_KEY='weigg.localeHandoff.v1';

class Storage{
  constructor(){this.map=new Map();}
  getItem(k){return this.map.has(k)?this.map.get(k):null;}
  setItem(k,v){this.map.set(k,String(v));}
  removeItem(k){this.map.delete(k);}
}
class FakeClient{
  constructor(prefs){this.prefs={...prefs};this.writes=[];}
  async request(){return {};}
  async getPreferences(){return {...this.prefs};}
  async setPreferences(prefs){this.writes.push({...prefs});Object.assign(this.prefs,prefs);return null;}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const localeHtml=`<select id="weigg-qb-locale-options">${stableLocales.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select>`;
async function makeRuntime(browserLanguages,prefs={locale:'ja',alternative_webui_enabled:true}){
  const localStorage=new Storage(),sessionStorage=new Storage(),events={};
  const client=new FakeClient(prefs);
  const document={
    readyState:'loading',
    documentElement:{dataset:{},lang:'en'},
    getElementById(){return null;},
    querySelectorAll(){return [];},
    addEventListener(type,fn,capture){events[`document:${type}:${capture===true?'capture':'bubble'}`]=fn;}
  };
  const location={reload(){},replace(){}};
  const window={
    WeiG:{},
    navigator:{languages:[...browserLanguages],language:browserLanguages[0]||''},
    location,
    addEventListener(type,fn){events[`window:${type}`]=fn;},
    dispatchEvent(event){const fn=events[`window:${event?.type}`];if(fn)fn(event);},
    console,setTimeout,clearTimeout
  };
  window.window=window;
  const fetch=async()=>({ok:true,status:200,text:async()=>localeHtml,json:async()=>({})});
  class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}}
  const context={window,document,localStorage,sessionStorage,location,CustomEvent,Intl,JSON,Promise,Date,setTimeout,clearTimeout,console,fetch};
  vm.runInNewContext(i18nSource,context,{filename:'i18n.js'});
  await window.WeiG.I18n.loadLocaleOptions();
  const appState={client,preferences:{...client.prefs}};
  const settingsState={prefs:appState.preferences,draft:{}};
  Object.assign(window.WeiG,{QBClient:FakeClient,SettingsSchema:{isWritable:(key)=>key==='locale'},SettingsState:settingsState,AppState:appState});
  vm.runInNewContext(sessionSource,context,{filename:'session.js'});
  return{window,document,events,client,localStorage,appState,settingsState};
}
async function bootstrap(runtime){
  const fn=runtime.events['document:DOMContentLoaded:bubble'];
  assert.equal(typeof fn,'function','session owner must register bounded locale bootstrap at DOMContentLoaded');
  fn();await delay(10);
}
function browserForm(locale){return String(locale).replace(/@(?:latin|latn)$/i,'-Latn').replace(/_/g,'-');}
function handoff(storage){const raw=storage.getItem(HANDOFF_KEY);return raw?JSON.parse(raw):null;}
function saveClick(runtime){
  const fn=runtime.events['document:click:capture'];
  assert.equal(typeof fn,'function','session owner must prepare the canonical Settings draft before the Settings save handler');
  fn({target:{closest(selector){return selector==='#save-settings-btn'?{}:null;}}});
}
async function verifiedSave(runtime){
  await runtime.client.setPreferences(runtime.settingsState.draft);
  runtime.appState.preferences=await runtime.client.getPreferences();
  runtime.settingsState.prefs=runtime.appState.preferences;
  runtime.window.WeiG.I18n.applyLocale(runtime.appState.preferences.locale);
  await delay(5);
}

for(const locale of stableLocales){
  const runtime=await makeRuntime([browserForm(locale)],{locale:'en',alternative_webui_enabled:true});
  const matched=runtime.window.WeiG.I18n.matchBrowserLocale([browserForm(locale)],runtime.window.WeiG.I18n.localeOptions());
  assert.equal(matched,locale,`W.I18n browser/qB normalization failed: ${locale}`);
  await bootstrap(runtime);
  const expected=locale==='en'?[]:[{locale}];
  assert.deepEqual(runtime.client.writes,expected,`current-stable browser-locale handoff failed: ${locale}`);
  const record=handoff(runtime.localStorage);
  assert.ok(record&&record.previousLocale==='en',`${locale}: reversible handoff metadata missing`);
  assert.equal(record.autoLocale,locale,`${locale}: browser locale did not resolve to exact qB locale`);
}
{
  const runtime=await makeRuntime(['en-US'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.deepEqual(runtime.client.writes,[{locale:'en'}],'generic qB English must accept browser en-US');
}
{
  const runtime=await makeRuntime(['de-AT'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.deepEqual(runtime.client.writes,[{locale:'de'}],'unique generic German must accept browser de-AT');
}
{
  const runtime=await makeRuntime(['pt-AO'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.deepEqual(runtime.client.writes,[],'ambiguous Portuguese browser locale must preserve existing qB locale');
  assert.equal(handoff(runtime.localStorage).autoLocale,null);
}
{
  const runtime=await makeRuntime(['xx-ZZ'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.deepEqual(runtime.client.writes,[],'unsupported browser locale must not fall back to English');
}
{
  const runtime=await makeRuntime(['zh-CN'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  runtime.settingsState.draft={alternative_webui_enabled:false};saveClick(runtime);
  assert.equal(runtime.settingsState.draft.locale,'ja','return-to-native must inject previous locale into the same canonical Settings draft');
  await verifiedSave(runtime);
  assert.equal(runtime.appState.preferences.locale,'ja');
  assert.equal(handoff(runtime.localStorage),null,'verified native-WebUI return must clear handoff metadata before locale reload can race it');
}
{
  const runtime=await makeRuntime(['zh-CN'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  runtime.settingsState.draft={locale:'de'};saveClick(runtime);await verifiedSave(runtime);
  assert.equal(handoff(runtime.localStorage).explicitOverride,true,'verified manual locale save must cancel automatic restoration before reload');
  runtime.settingsState.draft={alternative_webui_enabled:false};saveClick(runtime);
  assert.equal(Object.hasOwn(runtime.settingsState.draft,'locale'),false,'explicit user locale must win when leaving WeiG');
  await verifiedSave(runtime);
  assert.equal(runtime.appState.preferences.locale,'de');
  assert.equal(handoff(runtime.localStorage),null);
}
assert.ok(sessionSource.includes('W.I18n.matchBrowserLocale')&&sessionSource.includes('W.I18n.sameQbLocale')&&sessionSource.includes('W.I18n.hasExactLocale'),'Session lifecycle must consume the canonical W.I18n locale matcher instead of duplicating normalization');
assert.ok(!sessionSource.includes('new Intl.Locale')&&!sessionSource.includes('Intl.getCanonicalLocales'),'Session must not become a second locale normalization owner');
assert.ok(!sessionSource.includes('QBClient.prototype.setPreferences')&&!sessionSource.includes('proto.setPreferences'),'handoff must not monkey-patch the qB client owner');
assert.ok(!sessionSource.includes('weigg-language'),'handoff metadata must never recreate an independent persisted language truth');
assert.ok(!sessionSource.includes('W.LocaleHandoff='),'handoff stays a private Session lifecycle detail instead of becoming a second public language owner');

console.log('Locale handoff contract passed: W.I18n owns exact locale matching, all 61 current-stable locales roundtrip, native return restores atomically, and explicit user locale wins before reload.');

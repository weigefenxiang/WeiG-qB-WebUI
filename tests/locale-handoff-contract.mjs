import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createWorld} from '../simulator/core/engine.js';
import {createPreferenceRuntime} from '../simulator/preferences/runtime.js';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const i18nSource=read('webui/private/scripts/i18n.js');
const sessionSource=read('webui/private/scripts/session.js');
const runnerSource=read('tests/real-qb-locale-runner.sh');
const harnessSource=read('tests/real-qb-locale-harness.mjs');
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
assert.ok(workflow.includes('runtime_image:')&&workflow.includes('docker save')&&workflow.includes('qb-current-stable-runtime-${{ github.sha }}'),'current-stable qB runtime must be materialized once per exact SHA instead of pulled independently by every locale job');
assert.ok(workflow.includes('actions/download-artifact@v8')&&workflow.includes("WEIG_QB_RUNTIME_PRELOADED: '1'"),'locale matrix jobs must reuse the exact pre-materialized runtime artifact');
assert.equal(workflow.includes('real-qb-current-locale-runtime-${{ github.sha }}'),false,'runtime artifact must not share the per-locale evidence prefix consumed by the aggregate glob');
assert.ok(runnerSource.includes('WEIG_QB_RUNTIME_PRELOADED')&&runnerSource.includes('docker image inspect "$IMAGE_TAG"'),'locale runner must support fail-closed preloaded runtime reuse');
assert.ok(runnerSource.includes('IMAGE_PIN=')&&runnerSource.includes('sha256:9ebb534fe30bab98622cb84a8c3acecfd88319b2d540f52ecdec7b9f866374d7'),'direct runner fallback must retain the immutable current-stable qB image pin');
assert.ok(runnerSource.includes("TARGET=\"http://${ip}:8080\"")&&!runnerSource.includes('-p 127.0.0.1::8080'),'locale runner must use the isolated Docker bridge like the established real-qB harness instead of host ephemeral-port publication');
assert.ok(runnerSource.includes('[[ "$code" =~ ^(200|403)$ ]]'),'authenticated qB readiness must accept 403 exactly like the established real-qB harness');
assert.ok(harnessSource.includes("requireStatus(login,'auth/login',[200,204])"),'real qB login evidence must accept the native 200/204 success variants while still requiring a session cookie');
assert.ok(harnessSource.includes('version!==expectedVersion')&&harnessSource.includes('Expected exact qB ${expectedVersion}, got ${version}.'),'403 readiness must never replace authenticated exact-version verification');

const LEGACY_HANDOFF_KEY='weigg.localeHandoff.v1';
const BOOTSTRAP_KEY='weigg.localeBootstrap.v2';
class Storage{
  constructor(initial={}){this.map=new Map(Object.entries(initial).map(([k,v])=>[k,String(v)]));}
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
class VirtualClient{
  constructor(runtime){this.runtime=runtime;this.writes=[];}
  async request(){return {};}
  async getPreferences(){return this.runtime.read();}
  async setPreferences(prefs){this.writes.push({...prefs});this.runtime.write(prefs);return null;}
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const localeHtml=`<select id="weigg-qb-locale-options">${stableLocales.map(value=>`<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}</select>`;

async function makeRuntime(browserLanguages,prefs={locale:'ja',alternative_webui_enabled:true},options={}){
  const localStorage=options.localStorage||new Storage(),sessionStorage=new Storage(),events={};
  const client=options.client||new FakeClient(prefs);
  const initialPrefs=await client.getPreferences();
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
  const appState={client,preferences:{...initialPrefs}};
  const settingsState={prefs:appState.preferences,draft:{}};
  Object.assign(window.WeiG,{QBClient:FakeClient,SettingsSchema:{isWritable:(key)=>key==='locale'},SettingsState:settingsState,AppState:appState});
  vm.runInNewContext(sessionSource,context,{filename:'session.js'});
  return{window,document,events,client,localStorage,appState,settingsState};
}
async function bootstrap(runtime){
  const fn=runtime.events['document:DOMContentLoaded:bubble'];
  assert.equal(typeof fn,'function','session owner must register bounded browser-locale bootstrap at DOMContentLoaded');
  fn();await delay(15);
}
function browserForm(locale){return String(locale).replace(/@(?:latin|latn)$/i,'-Latn').replace(/_/g,'-');}
function bootstrapRecord(storage){const raw=storage.getItem(BOOTSTRAP_KEY);return raw?JSON.parse(raw):null;}

for(const locale of stableLocales){
  const runtime=await makeRuntime([browserForm(locale)],{locale:'en',alternative_webui_enabled:true});
  const matched=runtime.window.WeiG.I18n.matchBrowserLocale([browserForm(locale)],runtime.window.WeiG.I18n.localeOptions());
  assert.equal(matched,locale,`W.I18n browser/qB normalization failed: ${locale}`);
  await bootstrap(runtime);
  const expected=locale==='en'?[]:[{locale}];
  assert.deepEqual(runtime.client.writes,expected,`current-stable browser-locale bootstrap failed: ${locale}`);
  assert.equal(runtime.client.prefs.locale,locale,`${locale}: verified browser locale must become the persisted qB preference`);
  const record=bootstrapRecord(runtime.localStorage);
  assert.ok(record&&record.schemaVersion===2&&record.initialized===true,`${locale}: bootstrap completion metadata missing`);
  assert.equal(record.selectedLocale,locale,`${locale}: bootstrap metadata must record the selected canonical qB locale`);
  assert.equal(Object.hasOwn(record,'previousLocale'),false,`${locale}: bootstrap metadata must never preserve a locale for later restoration`);
}
{
  const runtime=await makeRuntime(['en-US'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.deepEqual(runtime.client.writes,[{locale:'en'}],'generic qB English must accept browser en-US');
  assert.equal(runtime.client.prefs.locale,'en');
}
{
  const runtime=await makeRuntime(['de-AT'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.deepEqual(runtime.client.writes,[{locale:'de'}],'unique generic German must accept browser de-AT');
  assert.equal(runtime.client.prefs.locale,'de');
}
{
  const runtime=await makeRuntime(['pt-AO'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.deepEqual(runtime.client.writes,[],'ambiguous Portuguese browser locale must preserve existing qB locale');
  assert.equal(runtime.client.prefs.locale,'ja');
  assert.equal(bootstrapRecord(runtime.localStorage).selectedLocale,null);
}
{
  const runtime=await makeRuntime(['xx-ZZ'],{locale:'ja',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.deepEqual(runtime.client.writes,[],'unsupported browser locale must preserve current qB locale and never fall back to English');
  assert.equal(runtime.client.prefs.locale,'ja');
}
{
  const storage=new Storage();
  const first=await makeRuntime(['zh-CN'],{locale:'en',alternative_webui_enabled:true},{localStorage:storage});await bootstrap(first);
  assert.equal(first.client.prefs.locale,'zh_CN','first WeiG bootstrap must persist browser-matched Chinese in qB');
  const secondClient=new FakeClient({...first.client.prefs,locale:'de'});
  const second=await makeRuntime(['zh-CN'],secondClient.prefs,{localStorage:storage,client:secondClient});await bootstrap(second);
  assert.deepEqual(second.client.writes,[],'an initialized browser must not repeatedly override a later explicit qB locale');
  assert.equal(second.client.prefs.locale,'de','later qB/native/manual locale must remain authoritative after bootstrap completion');
}
{
  const runtime=await makeRuntime(['zh-CN'],{locale:'en',alternative_webui_enabled:true});await bootstrap(runtime);
  assert.equal(runtime.client.prefs.locale,'zh_CN');
  await runtime.client.setPreferences({alternative_webui_enabled:false});
  runtime.appState.preferences=await runtime.client.getPreferences();
  assert.equal(runtime.appState.preferences.locale,'zh_CN','returning to native WebUI must keep the browser-selected qB locale and never restore the old English locale');
  assert.equal(runtime.events['document:click:capture'],undefined,'Session must not intercept Settings save to inject a previous locale');
}
{
  const runtime=await makeRuntime(['zh-CN'],{locale:'en',alternative_webui_enabled:true});await bootstrap(runtime);
  await runtime.client.setPreferences({locale:'de'});
  await runtime.client.setPreferences({alternative_webui_enabled:false});
  runtime.appState.preferences=await runtime.client.getPreferences();
  assert.equal(runtime.appState.preferences.locale,'de','an explicit user-selected qB locale must survive leaving WeiG unchanged');
}
{
  const legacy={schemaVersion:1,active:true,previousLocale:'ja',autoLocale:'zh_CN',explicitOverride:false,closing:false};
  const storage=new Storage({[LEGACY_HANDOFF_KEY]:JSON.stringify(legacy)});
  const runtime=await makeRuntime(['zh-CN'],{locale:'en',alternative_webui_enabled:true},{localStorage:storage});await bootstrap(runtime);
  assert.equal(storage.getItem(LEGACY_HANDOFF_KEY),null,'legacy reversible locale handoff metadata must be removed');
  assert.equal(runtime.client.prefs.locale,'zh_CN','legacy metadata must never block the new canonical browser-locale bootstrap');
}
{
  const world=createWorld({count:1,profile:{qbVersion:'5.2.3',webApiVersion:'2.15.1',preferenceKeys:['locale','alternative_webui_enabled']}});
  const preferenceRuntime=createPreferenceRuntime(world);
  assert.equal(preferenceRuntime.read().locale,'en','Virtual qB must materialize a canonical English locale instead of an empty placeholder');
  const client=new VirtualClient(preferenceRuntime);
  const runtime=await makeRuntime(['zh-CN'],null,{client});await bootstrap(runtime);
  assert.deepEqual(client.writes,[{locale:'zh_CN'}],'Virtual qB must receive the same browser-locale write as a real qB preference service');
  assert.equal(preferenceRuntime.read().locale,'zh_CN','Virtual qB locale write must survive reread through the real preference runtime');
  assert.equal(world.preferences.locale,'zh_CN','Virtual qB world state must persist the canonical locale after bootstrap');
}

assert.ok(sessionSource.includes("BOOTSTRAP_KEY='weigg.localeBootstrap.v2'")&&sessionSource.includes("LEGACY_HANDOFF_KEY='weigg.localeHandoff.v1'"),'Session must use one-way locale bootstrap metadata and explicitly retire the old reversible handoff key');
assert.ok(sessionSource.includes('W.I18n.matchBrowserLocale')&&sessionSource.includes('W.I18n.sameQbLocale')&&sessionSource.includes('W.I18n.hasExactLocale'),'Session lifecycle must consume the canonical W.I18n locale matcher instead of duplicating normalization');
assert.ok(sessionSource.includes('await client.setPreferences({locale:target})')&&sessionSource.includes('var verified=await client.getPreferences()'),'browser locale initialization must write qB preferences.locale and verify by reread');
assert.ok(!sessionSource.includes('previousLocale')&&!sessionSource.includes('rollbackLocale')&&!sessionSource.includes('draft.locale=record.previousLocale'),'Session must never retain or restore a pre-WeiG locale');
assert.ok(!sessionSource.includes('new Intl.Locale')&&!sessionSource.includes('Intl.getCanonicalLocales'),'Session must not become a second locale normalization owner');
assert.ok(!sessionSource.includes('QBClient.prototype.setPreferences')&&!sessionSource.includes('proto.setPreferences'),'bootstrap must not monkey-patch the qB client owner');
assert.ok(!sessionSource.includes('weigg-language'),'bootstrap metadata must never recreate an independent persisted language truth');
assert.ok(!sessionSource.includes('W.LocaleHandoff='),'locale bootstrap stays a private Session lifecycle detail instead of becoming a second public language owner');

console.log('Locale bootstrap contract passed: W.I18n owns exact browser/qB matching; all 61 current-stable locales can become canonical persisted qB preferences; native return never restores a previous locale; explicit qB locale changes win; legacy handoff metadata is retired; Virtual qB defaults to en and persists browser-selected locale through its real preference runtime.');

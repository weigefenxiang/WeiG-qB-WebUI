import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=relative=>fs.readFileSync(new URL(`../${relative}`,import.meta.url),'utf8');
const sessionSource=read('webui/private/scripts/session.js');
const settingsSource=read('webui/private/scripts/settings.js');

const prepareIndex=settingsSource.indexOf('await W.SessionController.prepareNativeWebUiReturn(client,nativePlan)');
const switchIndex=settingsSource.indexOf('await client.setPreferences(rootPending)',prepareIndex);
const completeIndex=settingsSource.indexOf('await W.SessionController.completeNativeWebUiReturn(client,nativePlan)',switchIndex);
assert.ok(prepareIndex>=0&&switchIndex>prepareIndex&&completeIndex>switchIndex,'native WebUI return must change locale before the root switch, switch root without locale, then restore the selected locale after the native root owns translations');
assert.ok(settingsSource.includes('delete rootPending.locale'),'the root-switch write must not process locale before alternative_webui_enabled in qB app/setPreferences');
assert.ok(!sessionSource.includes('previousLocale'),'native WebUI return must not create a second persisted language owner');
assert.ok(settingsSource.includes('W.PreferenceTransaction={canDraft:preferenceCanDraft,canInteract:preferenceCanInteract,pending:preferencePending,execute:executePreferenceTransaction,handoff:handoffPreferenceTransaction}'),'Settings must expose one PreferenceTransaction owner for interaction, draftability, write/verify and native-WebUI handoff.');
assert.ok(settingsSource.includes('sourceState[key]=prefs[key]')&&settingsSource.includes("preferenceTransitionKind(key,value,prefs)")&&!settingsSource.includes("key==='alternative_webui_enabled'"),'self-affecting OFF drafts must use the Session transition owner plus pre-transition dependency state instead of a Settings key special-case.');
assert.ok(settingsSource.includes('W.PreferenceTransaction.pending(controller.draft'),'save must consume the transaction-owned writable draft rather than call SettingsSchema.writableDraft directly.');

class Storage{constructor(){this.map=new Map();}getItem(k){return this.map.has(k)?this.map.get(k):null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
const events={};
const document={documentElement:{dataset:{}},getElementById(){return null;}};
const localStorage=new Storage(),sessionStorage=new Storage();
const window={WeiG:{},navigator:{languages:['zh-CN'],language:'zh-CN'},location:{replace(){},reload(){}},addEventListener(type,fn){events[type]=fn;},dispatchEvent(){},console,setTimeout,clearTimeout};
window.window=window;
const CustomEvent=class{constructor(type,init){this.type=type;this.detail=init?.detail;}};
const exact=['zh_CN','en','de'];
window.WeiG.QBClient=function(){};
window.WeiG.SettingsSchema={isWritable:(key,value)=>key==='locale'&&exact.includes(String(value))};
window.WeiG.I18n={
  localeOptions:()=>exact.map(value=>({value,label:value})),
  matchBrowserLocale(){return 'zh_CN';},
  sameQbLocale:(a,b)=>String(a).replace('-','_').toLowerCase()===String(b).replace('-','_').toLowerCase(),
  hasExactLocale:value=>exact.includes(String(value))
};
vm.runInNewContext(sessionSource,{window,document,localStorage,sessionStorage,location:window.location,CustomEvent,JSON,Date,Promise,setTimeout,clearTimeout,console},{filename:'session.js'});
const S=window.WeiG.SessionController;
assert.ok(S?.isNativeWebUiReturnTransition&&S?.planNativeWebUiReturn&&S?.prepareNativeWebUiReturn&&S?.completeNativeWebUiReturn,'SessionController must own native WebUI transition classification, locale refresh planning and verified writes');

const prefs={locale:'zh_CN',alternative_webui_enabled:true};
const writes=[];
const client={
  async setPreferences(next){writes.push({...next});Object.assign(prefs,next);},
  async getPreferences(){return {...prefs};}
};
assert.equal(S.isNativeWebUiReturnTransition({...prefs},{alternative_webui_enabled:false}),true,'native WebUI return classification must be independent from locale refresh readiness');
const plan=S.planNativeWebUiReturn({...prefs},{alternative_webui_enabled:false});
assert.equal(plan.targetLocale,'zh_CN');
assert.ok(plan.temporaryLocale&&plan.temporaryLocale!=='zh_CN');
await S.prepareNativeWebUiReturn(client,plan);
await client.setPreferences({alternative_webui_enabled:false});
await S.completeNativeWebUiReturn(client,plan);
assert.deepEqual(writes,[{locale:plan.temporaryLocale},{alternative_webui_enabled:false},{locale:'zh_CN'}]);
assert.equal(prefs.alternative_webui_enabled,false);
assert.equal(prefs.locale,'zh_CN','the final canonical qB preferences.locale must remain the selected language');
assert.equal(S.planNativeWebUiReturn({...prefs},{alternative_webui_enabled:false}),null,'an already-native WebUI must not run a locale refresh sequence');

const explicit=S.planNativeWebUiReturn({locale:'zh_CN',alternative_webui_enabled:true},{alternative_webui_enabled:false,locale:'de'});
assert.equal(explicit.targetLocale,'de','an explicit locale selected in the same save must remain the final native WebUI locale');
assert.notEqual(explicit.temporaryLocale,'de');
const noLocaleWindow={...window.WeiG.I18n,hasExactLocale:()=>false};window.WeiG.I18n=noLocaleWindow;const degraded=S.planNativeWebUiReturn({locale:'zz',alternative_webui_enabled:true},{alternative_webui_enabled:false});assert.ok(degraded&&degraded.targetLocale===''&&degraded.temporaryLocale===''&&degraded.localeRefresh===false,'native WebUI OFF must remain a valid transition even when optional locale-refresh proof is unavailable');

console.log('Native WebUI return contract passed: qB locale is temporarily changed before the root switch and restored only after the built-in WebUI root is active, with preferences.locale remaining the sole final language truth.');

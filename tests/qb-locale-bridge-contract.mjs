import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const bridgeSource=fs.readFileSync(new URL('../webui/private/scripts/qb-locale-bridge.js',import.meta.url),'utf8');
const schemaSource=fs.readFileSync(new URL('../webui/private/scripts/settings-schema.js',import.meta.url),'utf8');
assert.ok(schemaSource.includes("description:known?'qBittorrent preference.'"),'generic qBittorrent preference copy must remain unchanged');
assert.ok(!schemaSource.includes('webuiLocales')&&!schemaSource.includes('release-4.')&&!schemaSource.includes('release-5.'),'SettingsSchema must not grow a hand-maintained qB release locale table');

const listeners=new Map();
const writes=[];
let currentProfile=null;
const state={prefs:{locale:'en'},tab:'advanced'};
const schema={
  meta:{},
  isWritable:(key,value)=>key==='locale'&&typeof value==='string'&&value.length>0
};
const window={
  WeiG:{
    SettingsSchema:schema,
    ReleaseProfile:{current:()=>currentProfile},
    I18n:{getLocale:()=> 'zh-CN',getSetting:()=> 'auto'},
    SettingsState:state,
    AppState:{client:{
      setPreferences:async patch=>{writes.push(patch);state.prefs={...state.prefs,...patch};},
      getPreferences:async()=>({...state.prefs})
    }}
  },
  addEventListener:(name,fn)=>{const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},
  dispatchEvent:()=>{}
};
window.window=window;
const context={
  window,
  console,
  Intl,
  CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}},
  fetch:async()=>({ok:true,text:async()=>'<select id="weigg-qb-locale-options">${LANGUAGE_OPTIONS}</select>'})
};
vm.runInNewContext(bridgeSource,context,{filename:'qb-locale-bridge.js'});
const B=window.WeiG.QBLocaleBridge;
assert.ok(B&&typeof B.refresh==='function'&&typeof B.qBForWeiG==='function','QBLocaleBridge must expose canonical locale helpers');
assert.deepEqual(B.parseProbe('<select id="weigg-qb-locale-options">${LANGUAGE_OPTIONS}</select>'),[],'unexpanded qB placeholder must fail closed');

currentProfile={webuiLocales:[
  {value:'en',label:'English'},
  {value:'zh',label:'简体中文'},
  {value:'zh_TW',label:'正體中文'},
  {value:'ja_JP',label:'日本語'},
  {value:'ko_KR',label:'한국어'}
]};
await B.refresh();
assert.deepEqual(schema.meta.locale.enum.map(item=>item.value),['en','zh','zh_TW','ja_JP','ko_KR'],'exact profile locale options must become SettingsSchema locale enum');
assert.equal(B.qBForWeiG('zh-CN'),'zh','old qB Simplified Chinese alias must map from WeiG language without version branching');
assert.equal(B.qBForWeiG('zh-TW'),'zh_TW');
assert.equal(B.qBForWeiG('ja'),'ja_JP');
assert.equal(B.qBForWeiG('ko'),'ko_KR');

const languageHandler=(listeners.get('weigg:languagechange')||[])[0];
assert.ok(languageHandler,'WeiG language change must be linked to qB locale sync');
await languageHandler({detail:{setting:'zh-CN'}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.deepEqual(writes,[{locale:'zh'}],'WeiG language save must reuse qB setPreferences only for a source-writable locale');

schema.isWritable=()=>false;
await languageHandler({detail:{setting:'ja'}});
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(writes.length,1,'locale sync must fail closed when exact setter provenance is not writable');

console.log('qB locale bridge contract passed: SettingsSchema owns the enum, aliases are version-independent, and language sync reuses safe qB preference writes.');

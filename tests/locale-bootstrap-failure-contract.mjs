import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sessionSource=fs.readFileSync(new URL('../webui/private/scripts/session.js',import.meta.url),'utf8');
const BOOTSTRAP_KEY='weigg.localeBootstrap.v2';

class Storage{
  constructor(){this.map=new Map();}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}

class BaseClient{
  constructor(){this.prefs={locale:'en',alternative_webui_enabled:true};this.writes=[];}
  async request(){return {};}
  async getPreferences(){return {...this.prefs};}
}
class MismatchClient extends BaseClient{
  async setPreferences(value){this.writes.push({...value});}
}
class ThrowClient extends BaseClient{
  async setPreferences(value){this.writes.push({...value});throw new Error('simulated write failure');}
}
class RecoveredClient extends BaseClient{
  async setPreferences(value){this.writes.push({...value});Object.assign(this.prefs,value);throw new Error('response lost after persisted write');}
}

function sameLocale(left,right){
  const normalize=value=>String(value||'').trim().replace(/_/g,'-').toLowerCase();
  return normalize(left)===normalize(right);
}

function makeRuntime(client){
  const localStorage=new Storage(),sessionStorage=new Storage();
  let appliedLocale=null;
  const document={
    documentElement:{dataset:{}},
    getElementById(){return null;},
    addEventListener(){}
  };
  const location={reload(){},replace(){}};
  class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}}
  const window={
    WeiG:{
      QBClient:BaseClient,
      I18n:{
        ready(){return Promise.resolve();},
        localeOptions(){return ['en','zh_CN'];},
        matchBrowserLocale(){return 'zh_CN';},
        sameQbLocale:sameLocale,
        hasExactLocale(){return true;},
        applyLocale(value){appliedLocale=value;}
      },
      SettingsSchema:{isWritable(key){return key==='locale';}}
    },
    navigator:{languages:['zh-CN'],language:'zh-CN'},
    location,
    addEventListener(){},
    dispatchEvent(){},
    console,setTimeout,clearTimeout
  };
  window.window=window;
  const context={window,document,localStorage,sessionStorage,location,CustomEvent,JSON,Promise,Date,setTimeout,clearTimeout,console};
  vm.runInNewContext(sessionSource,context,{filename:'session.js'});
  return{
    controller:window.WeiG.SessionController,
    localStorage,
    get appliedLocale(){return appliedLocale;},
    prefs:{...client.prefs}
  };
}

function rawRecord(storage){
  const raw=storage.getItem(BOOTSTRAP_KEY);
  return raw?JSON.parse(raw):null;
}

{
  const client=new MismatchClient();
  const runtime=makeRuntime(client);
  const first=await runtime.controller.bootstrapBrowserLocale(client,runtime.prefs);
  assert.equal(first.reason,'verification-mismatch');
  assert.equal(first.verified,false);
  assert.equal(rawRecord(runtime.localStorage)?.initialized,false,'verification mismatch must not complete browser bootstrap');
  assert.equal(runtime.controller.readLocaleBootstrap(),null,'unverified bootstrap metadata must not be treated as completed');
  await runtime.controller.bootstrapBrowserLocale(client,await client.getPreferences());
  assert.equal(client.writes.length,2,'verification mismatch must retry on the next bootstrap attempt');
}

{
  const client=new ThrowClient();
  const runtime=makeRuntime(client);
  const first=await runtime.controller.bootstrapBrowserLocale(client,runtime.prefs);
  assert.equal(first.reason,'write-failed');
  assert.equal(first.verified,false);
  assert.equal(rawRecord(runtime.localStorage)?.initialized,false,'failed write must remain retryable');
  assert.equal(runtime.controller.readLocaleBootstrap(),null,'failed write metadata must not be treated as completed');
  await runtime.controller.bootstrapBrowserLocale(client,await client.getPreferences());
  assert.equal(client.writes.length,2,'failed write must retry on the next bootstrap attempt');
}

{
  const client=new RecoveredClient();
  const runtime=makeRuntime(client);
  const result=await runtime.controller.bootstrapBrowserLocale(client,runtime.prefs);
  assert.equal(result.verified,true,'a thrown response may recover only when qB reread proves the target locale persisted');
  assert.equal(result.recovered,true);
  assert.equal(result.reloadRequired,true);
  assert.equal(client.prefs.locale,'zh_CN');
  assert.equal(rawRecord(runtime.localStorage)?.initialized,true,'verified recovery is a completed bootstrap');
  assert.equal(runtime.controller.readLocaleBootstrap()?.selectedLocale,'zh_CN');
}

assert.ok(sessionSource.includes("bootstrapRecord('verification-mismatch',target,observed,false)"),'verification mismatch must be stored as incomplete');
assert.ok(sessionSource.includes("bootstrapRecord('write-failed',target,after&&after.locale||current,false)"),'write failure must be stored as incomplete');

console.log('Locale bootstrap failure contract passed: only a qB reread that proves the target locale completes initialization; mismatches and failed writes remain retryable.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=fs.readFileSync(path.join(root,'webui/private/scripts/i18n.js'),'utf8');
const localeDir=path.join(root,'webui/private/data/weig-i18n');
const supported=['en','zh-CN','zh-TW','zh-HK','ja','ko','de','fr','es','pt','ru'];
const overlays=supported.filter(locale=>locale!=='en');

assert.ok(source.length<80000,'I18n core must stay bounded; non-English WeiG copy belongs in locale shards');
for(const legacy of ['var WEIG_SETTINGS=','var WEIG_CORE=','var WEIG_RUNTIME=','var ZH=','var ZHT=','var ZHHK=','var JA=','var KO=','var DE=','var FR=','var ES=','var PT=','var RU='])assert.equal(source.includes(legacy),false,'embedded multi-locale owner must stay retired: '+legacy);
assert.ok(source.includes('var SUPPORTED_LOCALES=')&&source.includes("data/weig-i18n/'+target+'.json")&&source.includes("namespace:'weig-i18n'")&&source.includes('identity:target'),'W.I18n must route one normalized current locale through RuntimeAssets');
assert.ok(source.includes('loadWeiGLocale(locale)'),'W.I18n.ready must wait for the current WeiG locale shard');
assert.ok(fs.existsSync(localeDir)&&fs.statSync(localeDir).isDirectory(),'WeiG locale shard directory missing');
const shardFiles=fs.readdirSync(localeDir).filter(name=>name.endsWith('.json')).sort();
assert.deepEqual(shardFiles,overlays.map(locale=>locale+'.json').sort(),'only non-English supported WeiG locale overlays should be materialized');

const emptyDocument={documentElement:{lang:''},querySelectorAll(){return[];},querySelector(){return null;}};
class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail;}}
function makeRuntime(failures=[]){
  const reads=[];
  const window={WeiG:{RuntimeAssets:{readJson(asset,options){reads.push({asset,options});if(failures.includes(options.identity))return Promise.reject(new Error('Mock shard failure: '+options.identity));return Promise.resolve(JSON.parse(fs.readFileSync(path.join(root,'webui/private',asset),'utf8')));}}},dispatchEvent(){},location:{reload(){}}};
  window.window=window;
  const context={window,document:emptyDocument,CustomEvent,Intl,JSON,Promise,Map,Set,Date,setTimeout,clearTimeout,console};
  vm.runInNewContext(source,context,{filename:'i18n.js'});
  return{window,reads};
}
const runtime=makeRuntime(),I=runtime.window.WeiG.I18n,en=I.english;
assert.deepEqual(Array.from(I.supported),supported);
assert.ok(Object.keys(en).length>=600,'English synchronous baseline unexpectedly shrank');
const placeholders=value=>Array.from(String(value||'').matchAll(/\{([^}]+)\}/g),match=>match[1]).sort();

for(const locale of overlays){
  const data=JSON.parse(fs.readFileSync(path.join(localeDir,locale+'.json'),'utf8'));
  assert.equal(data.schemaVersion,1);assert.equal(data.source,'WeiG-runtime-locale-overlay');assert.equal(data.locale,locale);
  assert.ok(data.messages&&typeof data.messages==='object'&&!Array.isArray(data.messages));
  assert.ok(Object.keys(data.messages).length>0,locale+' overlay must contain translated deltas');
  for(const [key,value] of Object.entries(data.messages)){
    assert.ok(Object.hasOwn(en,key),locale+' overlay contains unknown key '+key);
    assert.notEqual(value,en[key],locale+' overlay must not duplicate the English baseline for '+key);
    assert.deepEqual(placeholders(value),placeholders(en[key]),locale+' placeholder contract drifted for '+key);
  }
}
I.applyLocale('zh_CN',{reload:false});
await I.loadWeiGLocale('zh-CN');
assert.equal(runtime.reads.length,1);assert.equal(runtime.reads[0].asset,'data/weig-i18n/zh-CN.json');assert.equal(runtime.reads[0].options.namespace,'weig-i18n');assert.equal(runtime.reads[0].options.identity,'zh-CN');
assert.equal(I.getLocale(),'zh-CN');assert.notEqual(I.t('settings.title'),en['settings.title']);
await I.loadWeiGLocale('zh-CN');assert.equal(runtime.reads.length,1,'same locale must reuse RuntimeAssets/in-memory owner without a second read');
I.applyLocale('en',{reload:false});assert.equal(runtime.reads.length,1,'English baseline must require no locale shard');
I.applyLocale('ja',{reload:false});await I.loadWeiGLocale('ja');assert.deepEqual(runtime.reads.map(item=>item.asset),['data/weig-i18n/zh-CN.json','data/weig-i18n/ja.json']);
assert.notEqual(I.t('settings.title'),en['settings.title']);


const twMessages=JSON.parse(fs.readFileSync(path.join(localeDir,'zh-TW.json'),'utf8')).messages;
const hkMessages=JSON.parse(fs.readFileSync(path.join(localeDir,'zh-HK.json'),'utf8')).messages;
for(const [key,value] of Object.entries(hkMessages))assert.notEqual(value,twMessages[key],`Hong Kong delta must not duplicate Taiwan text: ${key}`);
assert.ok(Object.keys(hkMessages).length<80,'Hong Kong locale must remain an actual sparse delta');
{
  const hkRuntime=makeRuntime(),hkI=hkRuntime.window.WeiG.I18n;
  hkI.applyLocale('zh_HK',{reload:false});await hkI.loadWeiGLocale('zh-HK');
  assert.deepEqual(hkRuntime.reads.map(item=>item.asset).sort(),['data/weig-i18n/zh-TW.json','data/weig-i18n/zh-HK.json'].sort());
  assert.equal(hkI.t('transfer.upload'),'上載');
  assert.equal(hkI.t('nav.logs'),twMessages['nav.logs']);
  assert.equal(hkI.t('logs.ui.follow'),en['logs.ui.follow']);
  await hkI.loadWeiGLocale('zh-HK');
  assert.equal(hkRuntime.reads.length,2,'Fully loaded HK shard must reuse both cached source layers');
}
for(const failed of [['zh-HK'],['zh-TW'],['zh-TW','zh-HK']]){
  const runtime=makeRuntime(failed),i18n=runtime.window.WeiG.I18n;
  i18n.applyLocale('zh-HK',{reload:false});await i18n.loadWeiGLocale('zh-HK');
  assert.equal(i18n.t('nav.logs'),failed.includes('zh-TW')?en['nav.logs']:twMessages['nav.logs']);
  assert.equal(i18n.t('transfer.upload'),failed.includes('zh-HK')?(failed.includes('zh-TW')?en['transfer.upload']:twMessages['transfer.upload']):'上載');
}

console.log('WeiG locale sharding contract passed: English stays synchronous; exactly one non-English current-locale overlay is loaded through RuntimeAssets and all overlays preserve the canonical key/placeholder contract.');
